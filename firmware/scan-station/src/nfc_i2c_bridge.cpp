#include "nfc_i2c_bridge.h"

// I2C bus mutex — shared with sensor/weight/touch tasks
extern SemaphoreHandle_t i2cMutex;

// I2C read chunk size (Wire library has 32-byte buffer)
#define I2C_CHUNK_SIZE 32

// Acquire I2C mutex for the duration of a single transaction
static bool i2cLock()   { return i2cMutex && xSemaphoreTake(i2cMutex, pdMS_TO_TICKS(50)) == pdTRUE; }
static void i2cUnlock() { if (i2cMutex) xSemaphoreGive(i2cMutex); }

// ==================== I2C Helpers ====================

uint8_t NfcI2CBridge::readReg(uint8_t reg) {
    if (!i2cLock()) return 0xFF;
    _wire->beginTransmission(NFC_PICO_ADDR);
    _wire->write(reg);
    _wire->endTransmission(false); // repeated start
    _wire->requestFrom((uint8_t)NFC_PICO_ADDR, (uint8_t)1);
    uint8_t val = _wire->available() ? _wire->read() : 0xFF;
    i2cUnlock();
    return val;
}

void NfcI2CBridge::readRegs(uint8_t reg, uint8_t *buf, uint8_t len) {
    if (!i2cLock()) return;
    _wire->beginTransmission(NFC_PICO_ADDR);
    _wire->write(reg);
    _wire->endTransmission(false);
    _wire->requestFrom((uint8_t)NFC_PICO_ADDR, len);
    for (uint8_t i = 0; i < len && _wire->available(); i++) {
        buf[i] = _wire->read();
    }
    i2cUnlock();
}

void NfcI2CBridge::writeReg(uint8_t reg, uint8_t val) {
    if (!i2cLock()) return;
    _wire->beginTransmission(NFC_PICO_ADDR);
    _wire->write(reg);
    _wire->write(val);
    _wire->endTransmission();
    i2cUnlock();
}

void NfcI2CBridge::writeRegs(uint8_t reg, const uint8_t *buf, uint8_t len) {
    if (!i2cLock()) return;
    _wire->beginTransmission(NFC_PICO_ADDR);
    _wire->write(reg);
    for (uint8_t i = 0; i < len; i++) _wire->write(buf[i]);
    _wire->endTransmission();
    i2cUnlock();
}

// ==================== Public API ====================

bool NfcI2CBridge::begin(TwoWire &wire, int int_pin) {
    _wire = &wire;
    _intPin = int_pin;
    _connected = false;

    // Check if Pico is present
    uint8_t device_id = readReg(PICO_REG_DEVICE_ID);
    if (device_id != 0x55) {
        Serial.printf("  NFC Pico: not detected (ID=0x%02X, expected 0x55)\n", device_id);
        return false;
    }

    uint8_t fw_ver = readReg(PICO_REG_FW_VERSION);
    uint8_t status = readReg(PICO_REG_STATUS);
    Serial.printf("  NFC Pico: fw=v%d, status=0x%02X (reader %s)\n",
        fw_ver, status, (status & PICO_STATUS_READER_OK) ? "OK" : "ERROR");

    // Setup INT pin as input with pullup (Pico drives it LOW when data ready)
    if (_intPin >= 0) {
        pinMode(_intPin, INPUT_PULLUP);
    }

    _connected = true;
    return true;
}

bool NfcI2CBridge::checkDataReady() {
    if (!_connected) return false;

    // Check hardware interrupt pin first (fastest path)
    if (_intPin >= 0 && digitalRead(_intPin) == LOW) {
        return true;
    }

    // Fall back to polling status register
    uint8_t status = readReg(PICO_REG_STATUS);
    return (status & PICO_STATUS_DATA_READY);
}

uint8_t NfcI2CBridge::readStatus() {
    if (!_connected) return 0;
    return readReg(PICO_REG_STATUS);
}

bool NfcI2CBridge::isTagPresent() {
    if (!_connected) return false;
    return (readReg(PICO_REG_STATUS) & PICO_STATUS_TAG_PRESENT);
}

bool NfcI2CBridge::readTagData(TagData &out) {
    if (!_connected) return false;

    out.clear();

    // Read tag metadata
    uint8_t tag_type = readReg(PICO_REG_TAG_TYPE);
    uint8_t uid_len  = readReg(PICO_REG_UID_LEN);

    if (uid_len == 0 || uid_len > 8) return false;

    // Read UID
    readRegs(PICO_REG_UID, out.uid, uid_len);
    out.uid_len = uid_len;

    // Map tag type
    switch (tag_type) {
        case 1: out.type = TAG_MIFARE_CLASSIC; break;
        case 2: out.type = TAG_NTAG; break;
        case 3: out.type = TAG_ISO15693; break;
        default: out.type = TAG_UNKNOWN; return false;
    }

    // Read sector/page counts
    out.sectors_read = readReg(PICO_REG_SECTORS_READ);
    out.pages_read   = readReg(PICO_REG_PAGES_READ);

    // Read sector OK bitmask
    uint8_t ok_l = readReg(PICO_REG_SECTOR_OK_L);
    uint8_t ok_h = readReg(PICO_REG_SECTOR_OK_H);
    for (int i = 0; i < 8; i++) {
        out.sector_ok[i]     = (ok_l >> i) & 1;
        out.sector_ok[i + 8] = (ok_h >> i) & 1;
    }

    // Read data length
    uint16_t data_len = ((uint16_t)readReg(PICO_REG_DATA_LEN_H) << 8)
                      | readReg(PICO_REG_DATA_LEN_L);

    if (data_len == 0) return false;

    // Set data pointer to start
    writeReg(PICO_REG_DATA_PTR_H, 0);
    writeReg(PICO_REG_DATA_PTR_L, 0);

    // Read data in chunks — Pico always sends 32 bytes per I2C request
    // (its onRequest handler fills a 32-byte buffer and advances data_ptr
    // by 32 regardless of how many bytes the master actually clocks).
    // We MUST always request exactly 32 bytes to stay in sync.
    if (out.type == TAG_MIFARE_CLASSIC) {
        // Read into sector_data[16][3][16] — 768 bytes total
        // Read 32 bytes at a time (2 blocks per read), 24 reads total
        uint16_t offset = 0;
        while (offset < data_len && offset < TagData::NUM_SECTORS * 3 * 16) {
            if (!i2cLock()) { offset += I2C_CHUNK_SIZE; continue; }
            _wire->beginTransmission(NFC_PICO_ADDR);
            _wire->write(PICO_REG_DATA);
            _wire->endTransmission(false);
            _wire->requestFrom((uint8_t)NFC_PICO_ADDR, (uint8_t)I2C_CHUNK_SIZE);
            for (uint8_t i = 0; i < I2C_CHUNK_SIZE && _wire->available(); i++) {
                uint16_t pos = offset + i;
                uint8_t s = pos / 48;          // sector (48 bytes each)
                uint8_t b = (pos % 48) / 16;   // block within sector
                uint8_t j = pos % 16;           // byte within block
                if (s < TagData::NUM_SECTORS) {
                    out.sector_data[s][b][j] = _wire->read();
                } else {
                    _wire->read();
                }
            }
            i2cUnlock();
            offset += I2C_CHUNK_SIZE;
        }
    } else {
        // NTAG or ISO15693 — read into page_data[N][4]
        uint16_t pages = data_len / 4;
        if (pages > TagData::MAX_PAGES) pages = TagData::MAX_PAGES;

        uint16_t total = pages * 4;
        uint16_t offset = 0;
        while (offset < total) {
            if (!i2cLock()) { offset += I2C_CHUNK_SIZE; continue; }
            _wire->beginTransmission(NFC_PICO_ADDR);
            _wire->write(PICO_REG_DATA);
            _wire->endTransmission(false);
            _wire->requestFrom((uint8_t)NFC_PICO_ADDR, (uint8_t)I2C_CHUNK_SIZE);
            for (uint8_t i = 0; i < I2C_CHUNK_SIZE && _wire->available(); i++) {
                uint16_t pos = offset + i;
                uint16_t p = pos / 4;
                uint8_t b = pos % 4;
                if (p < TagData::MAX_PAGES && pos < total) {
                    out.page_data[p][b] = _wire->read();
                } else {
                    _wire->read();
                }
            }
            i2cUnlock();
            offset += I2C_CHUNK_SIZE;
        }
    }

    out.valid = (out.type == TAG_MIFARE_CLASSIC)
              ? (out.sectors_read > 0)
              : (out.pages_read > 0);

    return out.valid;
}

void NfcI2CBridge::ack() {
    if (_connected) writeReg(PICO_REG_CMD, PICO_CMD_ACK);
}

void NfcI2CBridge::rescan() {
    if (_connected) writeReg(PICO_REG_CMD, PICO_CMD_RESCAN);
}

void NfcI2CBridge::resetReader() {
    if (_connected) writeReg(PICO_REG_CMD, PICO_CMD_RESET);
}
