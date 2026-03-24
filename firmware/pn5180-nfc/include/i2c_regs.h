// ============================================================
// Filla IQ — NFC Pico Coprocessor I2C Register Map
// Shared between Pico firmware and ESP32 client
// ============================================================
#ifndef NFC_PICO_I2C_REGS_H
#define NFC_PICO_I2C_REGS_H

#define NFC_PICO_I2C_ADDR       0x55

// --- Status Register (0x00) ---
#define REG_STATUS              0x00
#define STATUS_TAG_PRESENT      (1 << 0)
#define STATUS_DATA_READY       (1 << 1)
#define STATUS_READER_OK        (1 << 2)
#define STATUS_READING          (1 << 3)

// --- Tag Info (0x01-0x0E) ---
#define REG_TAG_TYPE            0x01
#define REG_UID_LEN             0x02
#define REG_UID                 0x03    // 8 bytes (0x03-0x0A)
#define REG_SECTORS_READ        0x0B
#define REG_PAGES_READ          0x0C
#define REG_SECTOR_OK_H         0x0D    // Sectors 8-15 bitmask
#define REG_SECTOR_OK_L         0x0E    // Sectors 0-7 bitmask

// --- Data Buffer (0x10-0x11, 0x20-0x21, 0x30) ---
#define REG_DATA_LEN_H          0x10
#define REG_DATA_LEN_L          0x11
#define REG_DATA_PTR_H          0x20    // Write-only: set read cursor
#define REG_DATA_PTR_L          0x21
#define REG_DATA                0x30    // Read-only: auto-increment

// --- Command (0xE0) ---
#define REG_CMD                 0xE0
#define CMD_RESCAN              0x01
#define CMD_RESET               0x02
#define CMD_ACK                 0x03

// --- Device Info (0xFE-0xFF) ---
#define REG_FW_VERSION          0xFE
#define REG_DEVICE_ID           0xFF

#define NFC_PICO_FW_VERSION     0x01
#define NFC_PICO_DEVICE_ID      0x55

// --- Tag Types (match ESP32 TagType enum) ---
#define TAG_TYPE_UNKNOWN        0
#define TAG_TYPE_MIFARE_CLASSIC 1
#define TAG_TYPE_NTAG           2
#define TAG_TYPE_ISO15693       3

#define MIFARE_DATA_SIZE        768     // 16 * 3 * 16
#define NTAG_MAX_PAGES          231
#define MAX_DATA_BUF_SIZE       1024

#endif
