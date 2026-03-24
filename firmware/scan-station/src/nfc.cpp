#include "nfc.h"
#include <SPI.h>
#include "bambu_tag.h"

// Global instance
NfcScanner nfcScanner;

#ifdef BOARD_SCAN_TOUCH
// ── NFC via Pico I2C coprocessor ──
#include "nfc_i2c_bridge.h"
#include <Wire.h>
static NfcI2CBridge picoBridge;

#else
// ── PN532 on shared SPI bus (DevKitC) ──
#include <Adafruit_PN532.h>
static Adafruit_PN532 reader(NFC_CS_PIN, &SPI);
extern byte pn532_packetbuffer[];
#endif

// Cached Bambu keys for incremental MIFARE reading
static BambuKeys cachedKeys;

// Presence check interval
#define PRESENCE_CHECK_MS 500

// ==================== Init ====================

void NfcScanner::begin() {
    _tag.clear();
    _connected = false;
    _state = NFC_IDLE;
    _nextSector = 0xFF;
    _nextPage = 0xFF;
    _retryPass = 0;

#ifdef BOARD_SCAN_TOUCH
    // ── NFC via Pico I2C coprocessor ──
    Serial.printf("  NFC: Pico bridge on I2C 0x55, INT=GPIO%d\n", NFC_PICO_INT_PIN);

    // Retry — Pico may still be booting (takes ~500ms after power-on)
    for (int attempt = 0; attempt < 10; attempt++) {
        if (picoBridge.begin(Wire, NFC_PICO_INT_PIN)) {
            _connected = true;
            _state = NFC_LISTENING;
            Serial.printf("  NFC: Pico coprocessor ready (attempt %d)\n", attempt + 1);
            break;
        }
        delay(200);
    }
    if (!_connected) {
        Serial.println("  NFC: Pico coprocessor not found on I2C bus");
    }

#else
    // PN532 SPI init (DevKitC variant)
    pinMode(TFT_CS_PIN, OUTPUT);
    digitalWrite(TFT_CS_PIN, HIGH);

    if (NFC_RST_PIN >= 0) {
        pinMode(NFC_RST_PIN, OUTPUT);
        digitalWrite(NFC_RST_PIN, LOW);
        delay(100);
        digitalWrite(NFC_RST_PIN, HIGH);
        delay(500);
    }

    reader.begin();
    delay(100);

    uint32_t ver = reader.getFirmwareVersion();
    if (ver) {
        Serial.printf("  NFC: PN5%02X v%d.%d (CS=GPIO%d, IRQ=GPIO%d)\n",
            (ver >> 24) & 0xFF, (ver >> 16) & 0xFF, (ver >> 8) & 0xFF,
            NFC_CS_PIN, NFC_IRQ_PIN);
        reader.SAMConfig();
        reader.setPassiveActivationRetries(0xFF);
        _connected = true;
    } else {
        Serial.printf("  NFC: not detected (CS=GPIO%d)\n", NFC_CS_PIN);
    }
#endif
}

// (Pico bridge handles tag data reads via NfcI2CBridge class)

// ==================== Incremental Read Helpers ====================

void NfcScanner::_startRead() {
    _tagData.clear();
    memcpy(_tagData.uid, _tag.uid, _tag.uid_len);
    _tagData.uid_len = _tag.uid_len;

    _retryPass = 0;

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
#ifndef BOARD_SCAN_TOUCH
    // PN532: use existing bambu_tag.cpp helpers
    if (_tagData.type == TAG_MIFARE_CLASSIC && _nextSector < TagData::NUM_SECTORS) {
        uint8_t count = SECTORS_PER_POLL;
        if (_nextSector + count > TagData::NUM_SECTORS)
            count = TagData::NUM_SECTORS - _nextSector;
        readMifareClassicSectors(reader, _tag.uid, _tag.uid_len,
                                  cachedKeys, _nextSector, count, _tagData);
        _nextSector += count;

        if (_nextSector >= TagData::NUM_SECTORS) {
            // Check if all sectors were read
            bool allOk = (_tagData.sectors_read >= TagData::NUM_SECTORS);
            if (!allOk && _retryPass < MAX_RETRY_PASSES) {
                // Retry failed sectors — start another pass
                _retryPass++;
                _nextSector = 0;
                Serial.printf("Scan: retry pass %d (%d/%d sectors OK)\n",
                    _retryPass, _tagData.sectors_read, TagData::NUM_SECTORS);
            } else {
                _nextSector = 0xFF;
                if (!allOk) {
                    Serial.printf("Scan: %d/%d sectors after %d retries\n",
                        _tagData.sectors_read, TagData::NUM_SECTORS, _retryPass);
                }
                _finishRead();
            }
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
#endif
}

void NfcScanner::_finishRead() {
    Serial.printf("Scan: %s tag %s (%d %s read)\n",
        tagTypeName(_tagData.type), getUidString().c_str(),
        _tagData.type == TAG_MIFARE_CLASSIC ? _tagData.sectors_read : _tagData.pages_read,
        _tagData.type == TAG_MIFARE_CLASSIC ? "sectors" : (_tagData.type == TAG_ISO15693 ? "blocks" : "pages"));

    _state = NFC_PRESENT;
    _presenceCheckTime = millis();
}

// ==================== Polling ====================

void NfcScanner::poll() {
    if (!_connected) return;

    unsigned long now = millis();

    switch (_state) {
        case NFC_IDLE:
        case NFC_LISTENING: {
#ifdef BOARD_SCAN_TOUCH
            // ── Pico coprocessor: interrupt-driven ──
            if (picoBridge.checkDataReady()) {
                TagData newData;
                if (picoBridge.readTagData(newData)) {
                    bool is_new = !_tag.present ||
                        newData.uid_len != _tag.uid_len ||
                        memcmp(newData.uid, _tag.uid, newData.uid_len) != 0;

                    memcpy(_tag.uid, newData.uid, newData.uid_len);
                    _tag.uid_len = newData.uid_len;
                    _tag.last_seen = now;
                    _tag.was_present = _tag.present;
                    _tag.present = true;

                    if (is_new) {
                        _tagData = newData;
                        Serial.printf("Scan: %s tag %s — %d %s read (via Pico)\n",
                            tagTypeName(_tagData.type), getUidString().c_str(),
                            _tagData.type == TAG_MIFARE_CLASSIC ? _tagData.sectors_read : _tagData.pages_read,
                            _tagData.type == TAG_MIFARE_CLASSIC ? "sectors" : "pages/blocks");
                    }

                    _state = NFC_PRESENT;
                    _presenceCheckTime = now;
                    picoBridge.ack();
                }
            } else if (_tag.present) {
                // Check if Pico still reports tag present
                uint8_t status = picoBridge.readStatus();
                if (!(status & PICO_STATUS_TAG_PRESENT)) {
                    if (now - _tag.last_seen >= NFC_TIMEOUT_MS) {
                        _tag.present = false;
                        _tagData.clear();
                        Serial.println("Scan: tag removed (via Pico)");
                    }
                } else {
                    _tag.last_seen = now;
                }
            }
#else
            // PN532: handled by IRQ or serial polling (not implemented here for DevKitC)
#endif
            break;
        }

        case NFC_READING: {
            bool reading = (_nextSector != 0xFF || _nextPage != 0xFF);
            if (reading) {
                _continueRead();
            } else {
                _state = NFC_PRESENT;
                _presenceCheckTime = now;
            }
            break;
        }

        case NFC_PRESENT: {
            if (now - _presenceCheckTime >= PRESENCE_CHECK_MS) {
                _presenceCheckTime = now;
                _state = NFC_LISTENING;  // Go back to check for card
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
    static char cachedUid[26];  // 8 bytes * 3 chars + null
    static uint8_t cachedLen = 0;
    static uint8_t cachedBytes[NFC_UID_MAX_LEN];  // 8 bytes for ISO 15693
    if (_tag.uid_len == cachedLen && memcmp(_tag.uid, cachedBytes, cachedLen) == 0) {
        return String(cachedUid);
    }
    int pos = 0;
    for (uint8_t i = 0; i < _tag.uid_len; i++) {
        if (i > 0) cachedUid[pos++] = ':';
        pos += snprintf(cachedUid + pos, sizeof(cachedUid) - pos, "%02X", _tag.uid[i]);
    }
    cachedUid[pos] = '\0';
    cachedLen = _tag.uid_len;
    memcpy(cachedBytes, _tag.uid, _tag.uid_len);
    return String(cachedUid);
}

const TagData& NfcScanner::getTagData() { return _tagData; }
bool NfcScanner::hasTagData() { return _tagData.valid; }

// ==================== Diagnostics ====================

void NfcScanner::printStatus() {
    Serial.println("=== NFC ===");
    Serial.printf("  Connected: %s\n", _connected ? "YES" : "no");
    if (_connected) {
        const char* stateNames[] = {"IDLE", "LISTENING", "READING", "PRESENT"};
#ifdef BOARD_SCAN_TOUCH
        uint8_t picoStatus = picoBridge.readStatus();
        Serial.printf("  State: %s (Pico I2C, INT=%d, pico_status=0x%02X)\n",
            stateNames[_state], NFC_PICO_INT_PIN, picoStatus);
#else
        Serial.printf("  State: %s (PN532 SPI, CS=%d)\n", stateNames[_state], NFC_CS_PIN);
#endif
        Serial.printf("  Tag: %s\n", _tag.present ? getUidString().c_str() : "none");
        if (_tag.present) {
            Serial.printf("  Last seen: %lums ago\n", millis() - _tag.last_seen);
            if (_tagData.valid) {
                Serial.printf("  Tag data: %d %s\n",
                    _tagData.type == TAG_MIFARE_CLASSIC ? _tagData.sectors_read : _tagData.pages_read,
                    _tagData.type == TAG_MIFARE_CLASSIC ? "sectors" : "pages");
            }
        }
    }
}

// ==================== Free Function API ====================

static unsigned long lastNfcPoll = 0;

void initNfc() {
    Serial.println("Initializing NFC reader...");
    nfcScanner.begin();
}

void pollNfc() {
    unsigned long now = millis();
    if (now - lastNfcPoll >= NFC_POLL_INTERVAL_MS) {
        lastNfcPoll = now;
        nfcScanner.poll();
    }
}
