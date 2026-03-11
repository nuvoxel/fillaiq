#include "nfc.h"
#include <SPI.h>
#include <Adafruit_PN532.h>
#include "bambu_tag.h"

// Global instance
NfcScanner nfcScanner;

// Single PN532 reader — hardware SPI
static Adafruit_PN532 reader(NFC_CS_PIN, &SPI);

// Shared packet buffer (global in Adafruit_PN532.cpp)
extern byte pn532_packetbuffer[];

// Cached Bambu keys for incremental MIFARE reading
static BambuKeys cachedKeys;

// --- IRQ flag (set by GPIO ISR, cleared by poll) ---
static volatile bool irqFired = false;

static void IRAM_ATTR nfcIrqISR() {
    irqFired = true;
}

// Presence check interval — how often to re-start detection
// to confirm the tag is still on the reader
#define PRESENCE_CHECK_MS 500

// Set 106kbps Type A analog settings for maximum read range
static void setMaxRxGain(Adafruit_PN532 &r) {
    pn532_packetbuffer[0]  = 0x32;
    pn532_packetbuffer[1]  = 0x0D;
    pn532_packetbuffer[2]  = 0x79;
    pn532_packetbuffer[3]  = 0xFF;
    pn532_packetbuffer[4]  = 0x3F;
    pn532_packetbuffer[5]  = 0x11;
    pn532_packetbuffer[6]  = 0x41;
    pn532_packetbuffer[7]  = 0x85;
    pn532_packetbuffer[8]  = 0x61;
    pn532_packetbuffer[9]  = 0x6F;
    r.sendCommandCheckAck(pn532_packetbuffer, 10, 100);
}

// ==================== Init ====================

void NfcScanner::begin() {
    _tag.clear();
    _connected = false;
    _state = NFC_IDLE;
    _nextSector = 0xFF;
    _nextPage = 0xFF;

    // Configure IRQ pin
    pinMode(NFC_IRQ_PIN, INPUT_PULLUP);

    reader.begin();

    uint32_t ver = reader.getFirmwareVersion();
    if (ver) {
        uint8_t ic  = (ver >> 24) & 0xFF;
        uint8_t maj = (ver >> 16) & 0xFF;
        uint8_t min = (ver >> 8)  & 0xFF;
        Serial.printf("  NFC: PN5%02X v%d.%d (CS=GPIO%d, IRQ=GPIO%d)\n",
            ic, maj, min, NFC_CS_PIN, NFC_IRQ_PIN);

        reader.SAMConfig();
        reader.setPassiveActivationRetries(0xFF);
        setMaxRxGain(reader);
        _connected = true;

        // Attach interrupt and start listening
        attachInterrupt(digitalPinToInterrupt(NFC_IRQ_PIN), nfcIrqISR, FALLING);
        _startListening();
    } else {
        Serial.printf("  NFC: not detected (CS=GPIO%d)\n", NFC_CS_PIN);
    }
}

// ==================== IRQ-driven Listening ====================

void NfcScanner::_startListening() {
    irqFired = false;
    if (reader.startPassiveTargetIDDetection(PN532_MIFARE_ISO14443A)) {
        _state = NFC_LISTENING;
        _listenStartTime = millis();
    } else {
        // Command failed — retry next poll cycle
        _state = NFC_IDLE;
    }
}

// ==================== Incremental Read Helpers ====================

void NfcScanner::_startRead() {
    _tagData.clear();
    memcpy(_tagData.uid, _tag.uid, _tag.uid_len);
    _tagData.uid_len = _tag.uid_len;

    if (_tag.uid_len == 4) {
        _tagData.type = TAG_MIFARE_CLASSIC;
        bambuDeriveKeys(_tag.uid, cachedKeys);
        _nextSector = 0;
        Serial.printf("Scan: new MIFARE Classic tag %s — reading...\n",
            getUidString().c_str());
    } else if (_tag.uid_len == 7) {
        _tagData.type = TAG_NTAG;
        _nextPage = 0;
        Serial.printf("Scan: new NTAG tag %s — reading...\n",
            getUidString().c_str());
    }
}

void NfcScanner::_continueRead() {
    if (_tagData.type == TAG_MIFARE_CLASSIC && _nextSector < TagData::NUM_SECTORS) {
        uint8_t count = SECTORS_PER_POLL;
        if (_nextSector + count > TagData::NUM_SECTORS) {
            count = TagData::NUM_SECTORS - _nextSector;
        }
        readMifareClassicSectors(reader, _tag.uid, _tag.uid_len,
                                  cachedKeys, _nextSector, count, _tagData);
        _nextSector += count;

        if (_nextSector >= TagData::NUM_SECTORS) {
            _nextSector = 0xFF;
            _finishRead();
        }
    } else if (_tagData.type == TAG_NTAG && _nextPage < TagData::MAX_PAGES) {
        uint8_t end = _nextPage + PAGES_PER_POLL;
        if (end > TagData::MAX_PAGES) end = TagData::MAX_PAGES;

        for (uint8_t page = _nextPage; page < end; page++) {
            uint8_t buf[4];
            if (reader.ntag2xx_ReadPage(page, buf)) {
                memcpy(_tagData.page_data[page], buf, 4);
                _tagData.pages_read = page + 1;
            } else {
                break;
            }
        }

        if (_tagData.pages_read < _nextPage + PAGES_PER_POLL ||
            _nextPage + PAGES_PER_POLL >= TagData::MAX_PAGES) {
            _nextPage = 0xFF;
            _tagData.valid = (_tagData.pages_read > 0);
            _finishRead();
        } else {
            _nextPage += PAGES_PER_POLL;
        }
    }
}

void NfcScanner::_finishRead() {
    Serial.printf("Scan: %s tag %s (%d %s read)\n",
        tagTypeName(_tagData.type), getUidString().c_str(),
        _tagData.type == TAG_MIFARE_CLASSIC ? _tagData.sectors_read : _tagData.pages_read,
        _tagData.type == TAG_MIFARE_CLASSIC ? "sectors" : "pages");

    _filament.clear();
    if (_tagData.type == TAG_MIFARE_CLASSIC && _tagData.sectors_read >= 2) {
        if (parseBambuFromRaw(_tagData, _filament) &&
            _filament.material[0] != '\0' && _filament.spool_net_weight > 0) {
            Serial.printf("Scan: Bambu tag parsed OK\n");
            bambuPrintInfo(_filament);
        } else {
            _filament.clear();
            Serial.printf("Scan: tag data captured (not Bambu)\n");
        }
    }

    // Read complete — switch to presence monitoring
    _state = NFC_PRESENT;
    _presenceCheckTime = millis();
}

// ==================== Polling (IRQ-driven) ====================

void NfcScanner::poll() {
    if (!_connected) return;

    unsigned long now = millis();

    switch (_state) {
        case NFC_IDLE:
            // Retry starting detection
            _startListening();
            break;

        case NFC_LISTENING: {
            // Check if IRQ fired (tag detected)
            if (irqFired) {
                irqFired = false;

                uint8_t uid[NFC_UID_MAX_LEN] = {0};
                uint8_t uid_len = 0;
                bool found = reader.readDetectedPassiveTargetID(uid, &uid_len);

                if (found && uid_len > 0) {
                    bool is_new = !_tag.present ||
                        uid_len != _tag.uid_len ||
                        memcmp(uid, _tag.uid, uid_len) != 0;

                    memcpy(_tag.uid, uid, uid_len);
                    _tag.uid_len = uid_len;
                    _tag.last_seen = now;
                    _tag.was_present = _tag.present;
                    _tag.present = true;

                    if (is_new) {
                        _startRead();
                        _state = NFC_READING;
                    } else {
                        // Same tag still present — keep monitoring
                        _state = NFC_PRESENT;
                        _presenceCheckTime = now;
                    }
                } else {
                    // IRQ fired but no valid read — restart
                    _startListening();
                }
            }
            // No timeout needed — PN532 listens indefinitely until a card appears
            break;
        }

        case NFC_READING: {
            // Continue incremental sector/page reads
            bool reading = (_nextSector != 0xFF || _nextPage != 0xFF);
            if (reading) {
                _continueRead();
                // _finishRead() transitions to NFC_PRESENT when done
            } else {
                // Shouldn't happen, but recover
                _state = NFC_PRESENT;
                _presenceCheckTime = now;
            }
            break;
        }

        case NFC_PRESENT: {
            // Tag is on the reader, periodically check if it's still there
            if (now - _presenceCheckTime >= PRESENCE_CHECK_MS) {
                _presenceCheckTime = now;
                // Restart detection — if tag is still present, IRQ fires quickly
                _startListening();
            }

            // If we're listening (presence re-check started) and no IRQ within timeout
            if (_state == NFC_LISTENING && _tag.present &&
                now - _tag.last_seen >= NFC_TIMEOUT_MS) {
                _tag.present = false;
                _filament.clear();
                _tagData.clear();
                _nextSector = 0xFF;
                _nextPage = 0xFF;
                Serial.println("Scan: tag removed");
                // Already listening for next tag
            }
            break;
        }
    }
}

// ==================== Getters ====================

bool NfcScanner::isTagPresent() { return _tag.present; }
bool NfcScanner::isConnected() { return _connected; }

void NfcScanner::getUid(uint8_t* buf, uint8_t* len) {
    *len = _tag.uid_len;
    memcpy(buf, _tag.uid, _tag.uid_len);
}

String NfcScanner::getUidString() {
    if (_tag.uid_len == 0) return "none";
    String s;
    for (uint8_t i = 0; i < _tag.uid_len; i++) {
        if (i > 0) s += ":";
        if (_tag.uid[i] < 0x10) s += "0";
        s += String(_tag.uid[i], HEX);
    }
    s.toUpperCase();
    return s;
}

const TagData& NfcScanner::getTagData() { return _tagData; }
bool NfcScanner::hasTagData() { return _tagData.valid; }
const FilamentInfo& NfcScanner::getFilamentInfo() { return _filament; }
bool NfcScanner::hasFilamentInfo() { return _filament.valid; }

// ==================== Diagnostics ====================

void NfcScanner::printStatus() {
    Serial.println("=== NFC ===");
    Serial.printf("  Connected: %s\n", _connected ? "YES" : "no");
    if (_connected) {
        const char* stateNames[] = {"IDLE", "LISTENING", "READING", "PRESENT"};
        Serial.printf("  State: %s (IRQ-driven, GPIO%d)\n", stateNames[_state], NFC_IRQ_PIN);
        Serial.printf("  Tag: %s\n", _tag.present ? getUidString().c_str() : "none");
        if (_tag.present) {
            Serial.printf("  Last seen: %lums ago\n", millis() - _tag.last_seen);
            bool reading = (_nextSector != 0xFF || _nextPage != 0xFF);
            if (reading) {
                Serial.printf("  Reading in progress...\n");
            }
            if (_filament.valid) {
                Serial.printf("  Filament: %s %s (%s)\n",
                    _filament.brand, _filament.name, _filament.material);
            }
        }
    }
}

// ==================== Free Function API ====================

static unsigned long lastNfcPoll = 0;

void initNfc() {
    Serial.println("Initializing NFC reader (IRQ mode)...");
    nfcScanner.begin();
}

void pollNfc() {
    unsigned long now = millis();
    if (now - lastNfcPoll >= NFC_POLL_INTERVAL_MS) {
        lastNfcPoll = now;
        nfcScanner.poll();
    }
}
