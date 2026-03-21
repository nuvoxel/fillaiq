#pragma once

#include <Arduino.h>
#include <Wire.h>
#include "filament_data.h"

// ============================================================
// Filla IQ — NFC Pico I2C Bridge Client
// Reads tag data from the RP2040 NFC coprocessor over I2C
// ============================================================

// I2C register map (must match Pico firmware i2c_regs.h)
#define NFC_PICO_ADDR           0x55

#define PICO_REG_STATUS         0x00
#define PICO_STATUS_TAG_PRESENT (1 << 0)
#define PICO_STATUS_DATA_READY  (1 << 1)
#define PICO_STATUS_READER_OK   (1 << 2)
#define PICO_STATUS_READING     (1 << 3)

#define PICO_REG_TAG_TYPE       0x01
#define PICO_REG_UID_LEN        0x02
#define PICO_REG_UID            0x03
#define PICO_REG_SECTORS_READ   0x0B
#define PICO_REG_PAGES_READ     0x0C
#define PICO_REG_SECTOR_OK_H    0x0D
#define PICO_REG_SECTOR_OK_L    0x0E
#define PICO_REG_DATA_LEN_H     0x10
#define PICO_REG_DATA_LEN_L     0x11
#define PICO_REG_DATA_PTR_H     0x20
#define PICO_REG_DATA_PTR_L     0x21
#define PICO_REG_DATA           0x30
#define PICO_REG_CMD            0xE0
#define PICO_REG_FW_VERSION     0xFE
#define PICO_REG_DEVICE_ID      0xFF

#define PICO_CMD_RESCAN         0x01
#define PICO_CMD_RESET          0x02
#define PICO_CMD_ACK            0x03

class NfcI2CBridge {
public:
    // Initialize: verify Pico is present on I2C bus
    bool begin(TwoWire &wire, int int_pin);

    // Check if Pico coprocessor is connected
    bool isConnected() { return _connected; }

    // Check if new tag data is available (interrupt-driven or polled)
    bool checkDataReady();

    // Read tag data into TagData struct. Call when checkDataReady() returns true.
    bool readTagData(TagData &out);

    // Acknowledge data read (releases Pico INT line, allows next scan)
    void ack();

    // Force a rescan
    void rescan();

    // Force PN5180 reset
    void resetReader();

    // Read status register
    uint8_t readStatus();

    // Is a tag currently present?
    bool isTagPresent();

private:
    TwoWire *_wire = nullptr;
    int _intPin = -1;
    bool _connected = false;
    volatile bool _intFired = false;

    // I2C helpers
    uint8_t readReg(uint8_t reg);
    void readRegs(uint8_t reg, uint8_t *buf, uint8_t len);
    void writeReg(uint8_t reg, uint8_t val);
    void writeRegs(uint8_t reg, const uint8_t *buf, uint8_t len);
};
