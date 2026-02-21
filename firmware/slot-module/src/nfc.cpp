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

// Toggle a reader's RF field on/off via RFConfiguration command
// CfgItem 0x01: bit 0 = auto RFCA, bit 1 = RF on
static void setRfField(Adafruit_PN532 &reader, bool on) {
    pn532_packetbuffer[0] = 0x32;  // PN532_COMMAND_RFCONFIGURATION
    pn532_packetbuffer[1] = 0x01;  // CfgItem: RF Field
    pn532_packetbuffer[2] = on ? 0x01 : 0x00;
    reader.sendCommandCheckAck(pn532_packetbuffer, 3, 50);
}

// Set 106kbps Type A analog settings for maximum read range
// CfgItem 0x0D: CIU register configuration
static void setMaxRxGain(Adafruit_PN532 &reader) {
    pn532_packetbuffer[0]  = 0x32;  // RFConfiguration
    pn532_packetbuffer[1]  = 0x0D;  // CfgItem: 106kbps Type A
    pn532_packetbuffer[2]  = 0x79;  // CIU_RFCfg: RxGain=48dB (max, default 0x59=38dB)
    pn532_packetbuffer[3]  = 0xFF;  // CIU_GsNOn: max N-driver (TX power)
    pn532_packetbuffer[4]  = 0x3F;  // CIU_CWGsP: max P-driver
    pn532_packetbuffer[5]  = 0x11;  // CIU_ModGsP: default modulation
    pn532_packetbuffer[6]  = 0x41;  // CIU_Demod (RF on): default
    pn532_packetbuffer[7]  = 0x85;  // CIU_RxThreshold: default
    pn532_packetbuffer[8]  = 0x61;  // CIU_Demod (RF off): default
    pn532_packetbuffer[9]  = 0x6F;  // CIU_GsNOff: default
    reader.sendCommandCheckAck(pn532_packetbuffer, 10, 100);
}

// ==================== Init ====================

void NfcReader::begin() {
    _poll_idx = 0;

    for (uint8_t i = 0; i < NFC_NUM_READERS; i++) {
        _tags[i].clear();
        _connected[i] = false;

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
            readers[i].setPassiveActivationRetries(0xFF);  // Max retries
            setMaxRxGain(readers[i]);  // 48dB receiver gain (max)
            _connected[i] = true;
        } else {
            Serial.printf("  NFC %d: not detected (CS=GPIO%d)\n",
                i, (i == 0) ? NFC_CS_PIN_0 : NFC_CS_PIN_1);
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
            Serial.printf("Bay %d: tag %s\n", bay, getUidString(bay).c_str());

            // 4-byte UID = MIFARE Classic → try reading as Bambu tag
            // Retry once if first attempt fails (tag may not be stable yet)
            if (uid_len == 4) {
                Serial.printf("Bay %d: reading Bambu tag...\n", bay);
                bool success = readBambuTag(bay, _filament[bay]);
                if (!success) {
                    // Re-select tag and retry
                    uint8_t retryUid[7]; uint8_t retryLen;
                    if (readers[bay].readPassiveTargetID(
                            PN532_MIFARE_ISO14443A, retryUid, &retryLen, 200)) {
                        success = readBambuTag(bay, _filament[bay]);
                    }
                }
                if (success) {
                    Serial.printf("Bay %d: Bambu tag OK\n", bay);
                    bambuPrintInfo(_filament[bay]);

                    // Push filament data to display
                    SpoolInfo si;
                    si.brand = "BAMBU";
                    si.name = _filament[bay].name;
                    si.material = _filament[bay].material;
                    si.diameter = _filament[bay].filament_diameter;
                    si.fullWeight = _filament[bay].spool_net_weight;
                    si.color = lv_color_make(
                        _filament[bay].color_r,
                        _filament[bay].color_g,
                        _filament[bay].color_b);
                    setDisplaySpoolInfo(bay, si);
                } else {
                    Serial.printf("Bay %d: Bambu tag read failed\n", bay);
                    _filament[bay].clear();
                }
            }
        }
    } else {
        // Check for tag removal (timeout)
        if (_tags[bay].present &&
            now - _tags[bay].last_seen >= NFC_TIMEOUT_MS) {
            _tags[bay].present = false;
            _filament[bay].clear();
            // Don't reset display here — keep showing last known info
            // while spool is still on the scale. Display resets its own
            // SpoolInfo when weight drops below threshold.
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
            }
        }
    }
}

// ==================== Bambu Tag Reading ====================

bool NfcReader::readBambuTag(uint8_t bay, FilamentInfo &info) {
    if (bay >= NFC_NUM_READERS || !_connected[bay]) return false;
    if (_tags[bay].uid_len != 4) return false;
    return bambuReadTag(readers[bay], _tags[bay].uid, _tags[bay].uid_len, info);
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
