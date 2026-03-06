#include "nfc.h"
#include <SPI.h>
#include <Adafruit_PN532.h>
#include "bambu_tag.h"
#include "display.h"

// Global instance
NfcReader nfcReader;

// PN532 instances — hardware SPI with per-reader CS pins
static Adafruit_PN532 readers[] = {
    Adafruit_PN532(NFC_CS_PIN_0, &SPI),
    Adafruit_PN532(NFC_CS_PIN_1, &SPI)
};

// Shared packet buffer (global in Adafruit_PN532.cpp)
extern byte pn532_packetbuffer[];

// Cached Bambu keys for incremental MIFARE reading (derived once per tag)
static BambuKeys cachedKeys[NFC_NUM_READERS];

// Toggle a reader's RF field on/off via RFConfiguration command
static void setRfField(Adafruit_PN532 &reader, bool on) {
    pn532_packetbuffer[0] = 0x32;
    pn532_packetbuffer[1] = 0x01;
    pn532_packetbuffer[2] = on ? 0x01 : 0x00;
    reader.sendCommandCheckAck(pn532_packetbuffer, 3, 50);
}

// Set 106kbps Type A analog settings for maximum read range
static void setMaxRxGain(Adafruit_PN532 &reader) {
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
    reader.sendCommandCheckAck(pn532_packetbuffer, 10, 100);
}

// ==================== Init ====================

void NfcReader::begin() {
    _poll_idx = 0;

    for (uint8_t i = 0; i < NFC_NUM_READERS; i++) {
        _tags[i].clear();
        _connected[i] = false;
        _nextSector[i] = 0xFF;
        _nextPage[i] = 0xFF;

        readers[i].begin();

        uint32_t ver = readers[i].getFirmwareVersion();
        if (ver) {
            uint8_t ic   = (ver >> 24) & 0xFF;
            uint8_t maj  = (ver >> 16) & 0xFF;
            uint8_t min  = (ver >> 8)  & 0xFF;
            Serial.printf("  NFC %d: PN5%02X v%d.%d (CS=GPIO%d)\n",
                i, ic, maj, min,
                (i == 0) ? NFC_CS_PIN_0 : NFC_CS_PIN_1);

            readers[i].SAMConfig();
            readers[i].setPassiveActivationRetries(0xFF);
            setMaxRxGain(readers[i]);
            _connected[i] = true;
        } else {
            Serial.printf("  NFC %d: not detected (CS=GPIO%d)\n",
                i, (i == 0) ? NFC_CS_PIN_0 : NFC_CS_PIN_1);
        }
    }
}

// ==================== Incremental Read Helpers ====================

void NfcReader::_startRead(uint8_t bay) {
    _tagData[bay].clear();
    memcpy(_tagData[bay].uid, _tags[bay].uid, _tags[bay].uid_len);
    _tagData[bay].uid_len = _tags[bay].uid_len;

    if (_tags[bay].uid_len == 4) {
        _tagData[bay].type = TAG_MIFARE_CLASSIC;
        // Derive keys once, cache for incremental reads
        bambuDeriveKeys(_tags[bay].uid, cachedKeys[bay]);
        _nextSector[bay] = 0;
        Serial.printf("Bay %d: new MIFARE Classic tag %s — reading...\n",
            bay, getUidString(bay).c_str());
    } else if (_tags[bay].uid_len == 7) {
        _tagData[bay].type = TAG_NTAG;
        _nextPage[bay] = 0;
        Serial.printf("Bay %d: new NTAG tag %s — reading...\n",
            bay, getUidString(bay).c_str());
    }
}

void NfcReader::_continueRead(uint8_t bay) {
    if (_tagData[bay].type == TAG_MIFARE_CLASSIC && _nextSector[bay] < TagData::NUM_SECTORS) {
        // Read SECTORS_PER_POLL sectors this cycle
        uint8_t count = SECTORS_PER_POLL;
        if (_nextSector[bay] + count > TagData::NUM_SECTORS) {
            count = TagData::NUM_SECTORS - _nextSector[bay];
        }
        readMifareClassicSectors(readers[bay], _tags[bay].uid, _tags[bay].uid_len,
                                  cachedKeys[bay], _nextSector[bay], count, _tagData[bay]);
        _nextSector[bay] += count;

        // Check if done
        if (_nextSector[bay] >= TagData::NUM_SECTORS) {
            _nextSector[bay] = 0xFF;  // Done
            _finishRead(bay);
        }
    } else if (_tagData[bay].type == TAG_NTAG && _nextPage[bay] < TagData::MAX_PAGES) {
        // Read PAGES_PER_POLL pages this cycle
        uint8_t end = _nextPage[bay] + PAGES_PER_POLL;
        if (end > TagData::MAX_PAGES) end = TagData::MAX_PAGES;

        for (uint8_t page = _nextPage[bay]; page < end; page++) {
            uint8_t buf[4];
            if (readers[bay].ntag2xx_ReadPage(page, buf)) {
                memcpy(_tagData[bay].page_data[page], buf, 4);
                _tagData[bay].pages_read = page + 1;
            } else {
                break;  // End of readable pages
            }
        }

        // Done if we hit end or a read failed
        if (_tagData[bay].pages_read < _nextPage[bay] + PAGES_PER_POLL ||
            _nextPage[bay] + PAGES_PER_POLL >= TagData::MAX_PAGES) {
            _nextPage[bay] = 0xFF;  // Done
            _tagData[bay].valid = (_tagData[bay].pages_read > 0);
            _finishRead(bay);
        } else {
            _nextPage[bay] += PAGES_PER_POLL;
        }
    }
}

void NfcReader::_finishRead(uint8_t bay) {
    Serial.printf("Bay %d: %s tag %s (%d %s read)\n",
        bay, tagTypeName(_tagData[bay].type), getUidString(bay).c_str(),
        _tagData[bay].type == TAG_MIFARE_CLASSIC ? _tagData[bay].sectors_read : _tagData[bay].pages_read,
        _tagData[bay].type == TAG_MIFARE_CLASSIC ? "sectors" : "pages");

    // TODO: POST _tagData[bay] to web service, receive FilamentInfo back
    // For now: try Bambu parsing locally as fallback
    _filament[bay].clear();
    if (_tagData[bay].type == TAG_MIFARE_CLASSIC && _tagData[bay].sectors_read >= 2) {
        if (parseBambuFromRaw(_tagData[bay], _filament[bay]) &&
            _filament[bay].material[0] != '\0' && _filament[bay].spool_net_weight > 0) {
            Serial.printf("Bay %d: Bambu tag parsed OK\n", bay);
            bambuPrintInfo(_filament[bay]);

            SpoolInfo si;
            si.brand = "BAMBU";
            si.name = _filament[bay].name;
            si.material = _filament[bay].material;
            si.diameter = _filament[bay].filament_diameter;
            si.fullWeight = _filament[bay].spool_net_weight;
            si.color_r = _filament[bay].color_r;
            si.color_g = _filament[bay].color_g;
            si.color_b = _filament[bay].color_b;
            setDisplaySpoolInfo(bay, si);
        } else {
            _filament[bay].clear();
            Serial.printf("Bay %d: tag data captured (not Bambu)\n", bay);
        }
    }
}

// ==================== Polling ====================

void NfcReader::poll() {
    uint8_t bay = _poll_idx;
    _poll_idx = (_poll_idx + 1) % NFC_NUM_READERS;

    if (!_connected[bay]) return;

    // Turn OFF the other reader's RF field to prevent interference,
    // then ensure this reader's field is ON
    uint8_t other = (bay + 1) % NFC_NUM_READERS;
    if (_connected[other]) {
        setRfField(readers[other], false);
    }
    setRfField(readers[bay], true);

    uint8_t uid[NFC_UID_MAX_LEN] = {0};
    uint8_t uid_len = 0;

    bool found = readers[bay].readPassiveTargetID(
        PN532_MIFARE_ISO14443A, uid, &uid_len, 150);

    unsigned long now = millis();

    if (found) {
        // Check if this is a new tag or same tag
        bool is_new = !_tags[bay].present ||
            uid_len != _tags[bay].uid_len ||
            memcmp(uid, _tags[bay].uid, uid_len) != 0;

        memcpy(_tags[bay].uid, uid, uid_len);
        _tags[bay].uid_len = uid_len;
        _tags[bay].last_seen = now;
        _tags[bay].was_present = _tags[bay].present;
        _tags[bay].present = true;

        if (is_new) {
            // New tag — start incremental read
            _startRead(bay);
        }

        // Continue incremental read if in progress
        bool reading = (_nextSector[bay] != 0xFF || _nextPage[bay] != 0xFF);
        if (reading) {
            _continueRead(bay);
        }
    } else {
        // Check for tag removal (timeout)
        if (_tags[bay].present &&
            now - _tags[bay].last_seen >= NFC_TIMEOUT_MS) {
            _tags[bay].present = false;
            _filament[bay].clear();
            _tagData[bay].clear();
            _nextSector[bay] = 0xFF;
            _nextPage[bay] = 0xFF;
            Serial.printf("Bay %d: tag removed\n", bay);
        }
    }
}

// ==================== Getters ====================

bool NfcReader::isTagPresent(uint8_t bay) {
    if (bay >= NFC_NUM_READERS) return false;
    return _tags[bay].present;
}

bool NfcReader::isConnected(uint8_t bay) {
    if (bay >= NFC_NUM_READERS) return false;
    return _connected[bay];
}

void NfcReader::getUid(uint8_t bay, uint8_t* buf, uint8_t* len) {
    if (bay >= NFC_NUM_READERS) { *len = 0; return; }
    *len = _tags[bay].uid_len;
    memcpy(buf, _tags[bay].uid, _tags[bay].uid_len);
}

String NfcReader::getUidString(uint8_t bay) {
    if (bay >= NFC_NUM_READERS || _tags[bay].uid_len == 0) return "none";
    String s;
    for (uint8_t i = 0; i < _tags[bay].uid_len; i++) {
        if (i > 0) s += ":";
        if (_tags[bay].uid[i] < 0x10) s += "0";
        s += String(_tags[bay].uid[i], HEX);
    }
    s.toUpperCase();
    return s;
}

// ==================== Diagnostics ====================

void NfcReader::printStatus() {
    for (uint8_t i = 0; i < NFC_NUM_READERS; i++) {
        Serial.printf("=== NFC %d ===\n", i);
        Serial.printf("  Connected: %s\n", _connected[i] ? "YES" : "no");
        if (_connected[i]) {
            Serial.printf("  Tag: %s\n",
                _tags[i].present ? getUidString(i).c_str() : "none");
            if (_tags[i].present) {
                Serial.printf("  Last seen: %lums ago\n",
                    millis() - _tags[i].last_seen);
                bool reading = (_nextSector[i] != 0xFF || _nextPage[i] != 0xFF);
                if (reading) {
                    Serial.printf("  Reading: sector %d\n", _nextSector[i]);
                }
            }
        }
    }
}

// ==================== Tag Data Access ====================

const TagData& NfcReader::getTagData(uint8_t bay) {
    static TagData empty;
    if (bay >= NFC_NUM_READERS) return empty;
    return _tagData[bay];
}

bool NfcReader::hasTagData(uint8_t bay) {
    if (bay >= NFC_NUM_READERS) return false;
    return _tagData[bay].valid;
}

const FilamentInfo& NfcReader::getFilamentInfo(uint8_t bay) {
    static FilamentInfo empty;
    if (bay >= NFC_NUM_READERS) return empty;
    return _filament[bay];
}

bool NfcReader::hasFilamentInfo(uint8_t bay) {
    if (bay >= NFC_NUM_READERS) return false;
    return _filament[bay].valid;
}

// ==================== Free Function API ====================

static unsigned long lastNfcPoll = 0;

void initNfc() {
    Serial.println("Initializing NFC readers...");
    nfcReader.begin();
}

void pollNfc() {
    unsigned long now = millis();
    if (now - lastNfcPoll >= NFC_POLL_INTERVAL_MS) {
        lastNfcPoll = now;
        nfcReader.poll();
    }
}
