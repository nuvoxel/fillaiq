#include "nfc.h"
#include <SPI.h>
#include "bambu_tag.h"

// Global instance
NfcScanner nfcScanner;

#ifdef BOARD_SCAN_TOUCH
// ── PN5180 on dedicated SPI bus (HSPI/SPI3) ──
#include <PN5180ISO14443.h>
#include <PN5180ISO15693.h>

static SPIClass nfcSPI(HSPI);
static PN5180ISO14443 reader14443(NFC_SPI_NSS, NFC_BUSY_PIN, NFC_RST_PIN, &nfcSPI);
static PN5180ISO15693 reader15693(NFC_SPI_NSS, NFC_BUSY_PIN, NFC_RST_PIN, &nfcSPI);

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

#ifdef BOARD_SCAN_TOUCH
    // Init dedicated SPI bus for PN5180
    Serial.printf("  NFC pins: SCK=%d MOSI=%d MISO=%d NSS=%d BUSY=%d RST=%d\n",
        NFC_SPI_SCK, NFC_SPI_MOSI, NFC_SPI_MISO, NFC_SPI_NSS, NFC_BUSY_PIN, NFC_RST_PIN);

    // Step 1: Configure pins before anything else
    pinMode(NFC_BUSY_PIN, INPUT);
    pinMode(NFC_RST_PIN, OUTPUT);
    Serial.printf("  [1] Pins configured. BUSY=%d RST=output\n", digitalRead(NFC_BUSY_PIN));

    // Step 2: Init SPI bus
    nfcSPI.begin(NFC_SPI_SCK, NFC_SPI_MISO, NFC_SPI_MOSI, -1);
    Serial.printf("  [2] SPI bus started. BUSY=%d\n", digitalRead(NFC_BUSY_PIN));

    // Step 3: PN5180 library pin setup (NSS HIGH, BUSY INPUT, RST HIGH)
    reader14443.begin();
    Serial.printf("  [3] PN5180 begin done. BUSY=%d\n", digitalRead(NFC_BUSY_PIN));
    delay(100);

    // Step 4: Hardware reset — pull RST LOW, hold, release, wait generously
    Serial.println("  [4] Hard reset: RST LOW...");
    digitalWrite(NFC_RST_PIN, LOW);
    delay(50);  // Hold reset 50ms (datasheet: min 250ns)
    Serial.printf("      RST LOW held 50ms. BUSY=%d\n", digitalRead(NFC_BUSY_PIN));

    digitalWrite(NFC_RST_PIN, HIGH);
    Serial.printf("      RST released HIGH. BUSY=%d\n", digitalRead(NFC_BUSY_PIN));
    delay(10);
    Serial.printf("      +10ms. BUSY=%d\n", digitalRead(NFC_BUSY_PIN));
    delay(50);
    Serial.printf("      +60ms. BUSY=%d\n", digitalRead(NFC_BUSY_PIN));
    delay(200);
    Serial.printf("      +260ms. BUSY=%d\n", digitalRead(NFC_BUSY_PIN));

    // Step 5: Wait for BUSY LOW (PN5180 ready) — up to 2 seconds
    unsigned long rstWait = millis();
    while (digitalRead(NFC_BUSY_PIN) == HIGH && millis() - rstWait < 2000) delay(1);
    Serial.printf("  [5] BUSY wait done: %s (%lums)\n",
        digitalRead(NFC_BUSY_PIN) ? "STILL HIGH" : "LOW (ready)", millis() - rstWait);

    // Step 6: Software reset via library
    Serial.println("  [6] Soft reset...");
    bool rstOk = reader14443.reset();
    Serial.printf("      reset() returned %s. BUSY=%d\n", rstOk ? "OK" : "FAIL", digitalRead(NFC_BUSY_PIN));
    delay(100);
    Serial.printf("      +100ms. BUSY=%d\n", digitalRead(NFC_BUSY_PIN));

    // Step 7: Read firmware version
    Serial.println("  [7] Reading EEPROM...");
    uint8_t fwVersion[2] = {0, 0};
    reader14443.readEEprom(FIRMWARE_VERSION, fwVersion, 2);
    Serial.printf("      FW raw: 0x%02X 0x%02X. BUSY=%d\n", fwVersion[0], fwVersion[1], digitalRead(NFC_BUSY_PIN));

    if (fwVersion[0] == 0xFF && fwVersion[1] == 0xFF) {
        Serial.println("  NFC: PN5180 not detected (MISO 0xFF — not connected?)");
        return;
    }
    if (fwVersion[0] == 0 && fwVersion[1] == 0) {
        Serial.println("  NFC: PN5180 not detected (SPI — no response)");
        return;
    }

    uint8_t prodVersion[2];
    reader14443.readEEprom(PRODUCT_VERSION, prodVersion, 2);
    Serial.printf("  NFC: PN5180 fw=%d.%d prod=%d.%d\n",
        fwVersion[1], fwVersion[0], prodVersion[1], prodVersion[0]);

    // Step 8: Read IRQ and RF status registers
    uint32_t irqStatus = reader14443.getIRQStatus();
    uint32_t rfStatus = 0;
    reader14443.readRegister(RF_STATUS, &rfStatus);
    Serial.printf("  [8] IRQ=0x%08X RF_STATUS=0x%08X BUSY=%d\n", irqStatus, rfStatus, digitalRead(NFC_BUSY_PIN));

    // Step 9: Clear IRQs, ensure RF off
    Serial.println("  [9] Clearing IRQs, RF off...");
    reader14443.clearIRQStatus(0xFFFFFFFF);
    reader14443.setRF_off();
    delay(10);
    Serial.printf("      Done. BUSY=%d\n", digitalRead(NFC_BUSY_PIN));

    // Step 10: Setup RF with retry
    bool rfOk = false;
    for (int i = 0; i < 3 && !rfOk; i++) {
        if (i > 0) {
            Serial.printf("  [10] RF retry %d/3...\n", i + 1);
            reader14443.reset();
            delay(200);
            reader14443.clearIRQStatus(0xFFFFFFFF);
            reader14443.setRF_off();
            delay(10);
        }
        Serial.printf("  [10] setupRF attempt %d. BUSY=%d\n", i + 1, digitalRead(NFC_BUSY_PIN));
        rfOk = reader14443.setupRF();
        Serial.printf("       result: %s. BUSY=%d\n", rfOk ? "OK" : "FAIL", digitalRead(NFC_BUSY_PIN));

        if (!rfOk) {
            // Dump register state on failure
            irqStatus = reader14443.getIRQStatus();
            reader14443.readRegister(RF_STATUS, &rfStatus);
            Serial.printf("       IRQ=0x%08X RF_STATUS=0x%08X\n", irqStatus, rfStatus);
        }
    }

    if (rfOk) {
        reader14443.readRegister(RF_STATUS, &rfStatus);
        Serial.printf("  NFC: RF ON — ready (RF_STATUS=0x%08X)\n", rfStatus);
    } else {
        Serial.println("  NFC: RF setup failed after 3 attempts");
    }
    _connected = true;
    _state = NFC_LISTENING;

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

// ==================== Tag Detection (PN5180) ====================

#ifdef BOARD_SCAN_TOUCH

// Hardware reset PN5180 to recover from stuck states
static void resetPN5180() {
    reader14443.reset();
    reader14443.setupRF();
}

// Watchdog: reset PN5180 only when BUSY pin is stuck HIGH (real SPI/hardware issue).
// Negative returns from activateTypeA are normal RF noise when no tag is present.
static uint8_t busyStuckCount = 0;
#define NFC_BUSY_STUCK_THRESHOLD 5  // 5 consecutive BUSY-HIGH polls before hard reset

// Detect and activate a 14443A tag, returns UID length (0 = no tag)
static uint8_t activateTag14443(uint8_t *uid) {
    // Watchdog: if BUSY is HIGH, PN5180 is stuck — reset it
    if (digitalRead(NFC_BUSY_PIN) == HIGH) {
        busyStuckCount++;
        if (busyStuckCount >= NFC_BUSY_STUCK_THRESHOLD) {
            Serial.println("[NFC] Watchdog: BUSY stuck HIGH — hard reset");
            busyStuckCount = 0;
        }
        resetPN5180();
        if (digitalRead(NFC_BUSY_PIN) == HIGH) return 0;
    } else {
        busyStuckCount = 0;
    }

    uint8_t response[10] = {0};
    int8_t result = reader14443.activateTypeA(response, 1);  // WUPA


    if (result >= 4 && result <= 7) {
        memcpy(uid, response + 3, result);
        return (uint8_t)result;
    }

    // result <= 0: no tag or RF noise — both normal, not a failure
    return 0;
}

// Detect an ISO 15693 tag, returns 8-byte UID (false = no tag).
// Requires two consecutive successful reads with the same UID to filter noise.
// NOTE: Leaves RF in 15693 mode on success so caller can read blocks before switching back.
// On failure, switches back to 14443A.
static bool detectTag15693(uint8_t *uid) {
    // Switch to ISO 15693 RF config
    if (!reader15693.setupRF()) return false;

    // First read
    uint8_t uid1[8] = {0};
    ISO15693ErrorCode rc = reader15693.getInventory(uid1);
    if (rc != ISO15693_EC_OK) {
        reader14443.setupRF();
        return false;
    }

    // Validate UID is not all zeros or all 0xFF
    bool allZero = true, allFF = true;
    for (int i = 0; i < 8; i++) {
        if (uid1[i] != 0x00) allZero = false;
        if (uid1[i] != 0xFF) allFF = false;
    }
    if (allZero || allFF) {
        reader14443.setupRF();
        return false;
    }

    // Second read to confirm (filters noise/ghost detections)
    delay(5);
    uint8_t uid2[8] = {0};
    rc = reader15693.getInventory(uid2);

    if (rc != ISO15693_EC_OK) {
        reader14443.setupRF();
        return false;
    }
    if (memcmp(uid1, uid2, 8) != 0) {
        reader14443.setupRF();
        return false;  // UIDs don't match — noise
    }

    memcpy(uid, uid1, 8);
    // Leave RF in 15693 mode — caller reads blocks then switches back
    return true;
}

// Re-select tag after auth failure or crypto clear
static bool reselectTag5180() {
    reader14443.mifareHalt();
    uint8_t resp[10] = {0};
    return (reader14443.activateTypeA(resp, 1) >= 4);
}

// Read all MIFARE Classic sectors in one shot with retry.
// Tag must be in ACTIVE state (just selected by activateTypeA).
//
// Optimizations vs naive approach:
// - Auth carries over between blocks in same sector (no re-auth per block)
// - Only re-select tag when auth fails (not after every sector)
// - Retry failed sectors up to 2 times
// - Bail immediately on BUSY stuck or tag gone
static void readAllMifareSectors5180(const uint8_t *uid, uint8_t uidLen,
                                      const BambuKeys &keys, TagData &tagData) {
    const uint8_t defaultKey[6] = {0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF};
    const int MAX_RETRIES = 2;

    for (int pass = 0; pass <= MAX_RETRIES; pass++) {
        bool anyFailed = false;

        for (uint8_t sector = 0; sector < TagData::NUM_SECTORS; sector++) {
            // Skip already-read sectors on retry passes
            if (tagData.sector_ok[sector]) continue;

            // Bail if PN5180 is stuck
            if (digitalRead(NFC_BUSY_PIN) == HIGH) {
                resetPN5180();
                if (!reselectTag5180()) goto done;
                continue;
            }

            uint8_t firstBlock = sector * 4;

            // Try Bambu key A first
            bool authed = reader14443.mifareAuthenticate(firstBlock, 0x60,
                keys.keyA[sector], uid, uidLen);

            if (!authed) {
                // Auth failure — re-select and try default key
                if (!reselectTag5180()) goto done;
                authed = reader14443.mifareAuthenticate(firstBlock, 0x60,
                    defaultKey, uid, uidLen);
            }

            if (authed) {
                // Read 3 data blocks (block 3 is the trailer, skip it)
                bool allOk = true;
                for (uint8_t b = 0; b < 3; b++) {
                    if (!reader14443.mifareBlockRead(firstBlock + b,
                            tagData.sector_data[sector][b])) {
                        allOk = false;
                        break;
                    }
                }

                if (allOk) {
                    tagData.sector_ok[sector] = true;
                    tagData.sectors_read++;
                } else {
                    anyFailed = true;
                    if (!reselectTag5180()) goto done;
                }
            } else {
                anyFailed = true;
                if (!reselectTag5180()) goto done;
            }
        }

        // All sectors read or no failures to retry
        if (!anyFailed || tagData.sectors_read >= TagData::NUM_SECTORS) break;

        // Re-select tag for retry pass
        if (!reselectTag5180()) break;
    }

done:
    // Clean up crypto state
    reader14443.writeRegisterWithAndMask(SYSTEM_CONFIG, SYSTEM_CONFIG_CLEAR_CRYPTO_MASK);
    tagData.valid = (tagData.sectors_read > 0);
}

// Read all NTAG pages in one shot.
// Tag must be in ACTIVE state.
static void readAllNtagPages5180(TagData &tagData) {
    for (uint8_t page = 0; page < TagData::MAX_PAGES; page++) {
        uint8_t buf[16];  // PN5180 reads 16 bytes
        if (reader14443.mifareBlockRead(page, buf)) {
            memcpy(tagData.page_data[page], buf, 4);
            tagData.pages_read = page + 1;
        } else {
            break;
        }
    }
    tagData.valid = (tagData.pages_read > 0);
}

#endif // BOARD_SCAN_TOUCH

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
            // PN5180: detect and read tag in one shot
            uint8_t uid[NFC_UID_MAX_LEN] = {0};
            uint8_t uid_len = activateTag14443(uid);

            if (uid_len > 0) {
                bool is_new = !_tag.present ||
                    uid_len != _tag.uid_len ||
                    memcmp(uid, _tag.uid, uid_len) != 0;

                memcpy(_tag.uid, uid, uid_len);
                _tag.uid_len = uid_len;
                _tag.last_seen = now;
                _tag.was_present = _tag.present;
                _tag.present = true;

                if (is_new) {
                    // Tag is ACTIVE right now — read everything immediately
                    _tagData.clear();
                    memcpy(_tagData.uid, uid, uid_len);
                    _tagData.uid_len = uid_len;

                    if (uid_len == 4) {
                        _tagData.type = TAG_MIFARE_CLASSIC;
                        BambuKeys keys;
                        bambuDeriveKeys(uid, keys);
                        Serial.printf("Scan: MIFARE Classic %02X:%02X:%02X:%02X — reading all sectors...\n",
                            uid[0], uid[1], uid[2], uid[3]);
                        readAllMifareSectors5180(uid, uid_len, keys, _tagData);
                    } else if (uid_len == 7) {
                        _tagData.type = TAG_NTAG;
                        Serial.printf("Scan: NTAG %02X:%02X:%02X:%02X:%02X:%02X:%02X — reading pages...\n",
                            uid[0], uid[1], uid[2], uid[3], uid[4], uid[5], uid[6]);
                        readAllNtagPages5180(_tagData);
                    }

                    // Ghost filter: only accept the tag if we read at least one block
                    if (!_tagData.valid) {
                        // No data read — ghost detection from EMI noise
                        _tag.present = false;
                        _tag.uid_len = 0;
                        _tagData.clear();
                        break;
                    }

                    Serial.printf("Scan: %s %s — %d %s read\n",
                        tagTypeName(_tagData.type), getUidString().c_str(),
                        _tagData.type == TAG_MIFARE_CLASSIC ? _tagData.sectors_read : _tagData.pages_read,
                        _tagData.type == TAG_MIFARE_CLASSIC ? "sectors" : "pages");
                }

                _state = NFC_PRESENT;
                _presenceCheckTime = now;

                // Halt tag; only reset if stuck
                reader14443.mifareHalt();
                // Disable crypto mode (bit 6) after MIFARE Classic to prevent stuck state
                reader14443.writeRegisterWithAndMask(0x00, 0xFFFFFFBF);
                if (digitalRead(NFC_BUSY_PIN) == HIGH) resetPN5180();
            } else {
                // No 14443A tag — try ISO 15693 every 2 seconds (RF switch is expensive)
                static unsigned long last15693Poll = 0;
                static bool just_polled_15693 = false;
                if (now - last15693Poll < 2000) {
                    if (_tag.present && !just_polled_15693 &&
                        now - _tag.last_seen >= NFC_TIMEOUT_MS + 2500) {
                        _tag.present = false;
                        _tagData.clear();
                        Serial.println("Scan: tag removed");
                    }
                    break;
                }
                last15693Poll = now;
                just_polled_15693 = true;

                uint8_t uid15693[8] = {0};
                if (detectTag15693(uid15693)) {
                    bool is_new = !_tag.present || _tag.uid_len != 8 ||
                        memcmp(_tag.uid, uid15693, 8) != 0;

                    memcpy(_tag.uid, uid15693, 8);
                    _tag.uid_len = 8;
                    _tag.last_seen = now;
                    _tag.was_present = _tag.present;
                    _tag.present = true;

                    if (is_new) {
                        _tagData.clear();
                        memcpy(_tagData.uid, uid15693, 8);
                        _tagData.uid_len = 8;
                        _tagData.type = TAG_ISO15693;
                        Serial.printf("Scan: ISO15693 tag %02X:%02X:%02X:%02X:%02X:%02X:%02X:%02X — reading blocks...\n",
                            uid15693[7], uid15693[6], uid15693[5], uid15693[4],
                            uid15693[3], uid15693[2], uid15693[1], uid15693[0]);

                        uint8_t blockSize = 0, numBlocks = 0;
                        reader15693.getSystemInfo(uid15693, &blockSize, &numBlocks);
                        for (uint8_t b = 0; b < numBlocks && b < TagData::MAX_PAGES; b++) {
                            uint8_t blockData[32];
                            if (reader15693.readSingleBlock(uid15693, b, blockData, blockSize) == ISO15693_EC_OK) {
                                memcpy(_tagData.page_data[b], blockData, min(blockSize, (uint8_t)4));
                                _tagData.pages_read = b + 1;
                            }
                        }
                        _tagData.valid = (_tagData.pages_read > 0);

                        Serial.printf("Scan: ISO15693 %s — %d blocks read (blockSize=%d)\n",
                            getUidString().c_str(), _tagData.pages_read, blockSize);
                    }

                    _state = NFC_PRESENT;
                    _presenceCheckTime = now;
                    reader14443.setupRF();
                } else {
                    just_polled_15693 = false;
                    if (_tag.present && now - _tag.last_seen >= NFC_TIMEOUT_MS) {
                        _tag.present = false;
                        _tagData.clear();
                        Serial.println("Scan: tag removed");
                    }
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
        Serial.printf("  State: %s (PN5180 SPI, NSS=%d BUSY=%d)\n",
            stateNames[_state], NFC_SPI_NSS, NFC_BUSY_PIN);
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
