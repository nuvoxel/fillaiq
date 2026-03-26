// ============================================================
// Filla IQ — NFC Pico Coprocessor
// RP2040 Arduino firmware: PN5180 + I2C slave + LPCD
//
// Handles all NFC autonomously, exposes data to ESP32 over I2C.
// Same PN5180 library as scan-station (Arduino SPI).
// ============================================================

#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <PN5180ISO14443.h>
#include <PN5180ISO15693.h>
#include "i2c_regs.h"

// BearSSL HKDF (included in arduino-pico core)
#include <bearssl/bearssl_hash.h>
#include <bearssl/bearssl_hmac.h>
#include <bearssl/bearssl_kdf.h>

// ==================== Pin Definitions ====================

// PN5180 SPI (SPI0)
#define PIN_SCK     2
#define PIN_MOSI    3   // SPI TX
#define PIN_MISO    4   // SPI RX
#define PIN_NSS     5
#define PIN_BUSY    6
#define PIN_RST     7
#define PIN_IRQ     8   // PN5180 IRQ (LPCD wake)

// I2C slave to ESP32 (I2C0)
#define PIN_SDA     0
#define PIN_SCL     1

// INT output to ESP32 (active LOW)
#define PIN_INT     9

// Onboard LED
#define PIN_LED     25

// ==================== PN5180 Instances ====================

// arduino-pico: SPI is SPI0, SPI1 is SPI1
// Configure SPI0 pins before begin()
static PN5180ISO14443 reader14443(PIN_NSS, PIN_BUSY, PIN_RST, &SPI);
static PN5180ISO15693 reader15693(PIN_NSS, PIN_BUSY, PIN_RST, &SPI);

// ==================== State Machine ====================

enum NfcPicoState : uint8_t {
    STATE_INIT,
    STATE_IDLE,
    STATE_LPCD_WAITING,
    STATE_ACTIVATING,
    STATE_READING,
    STATE_TAG_PRESENT,
    STATE_ERROR,
};

static NfcPicoState state = STATE_INIT;
static bool reader_ok = false;
static bool data_ready_flag = false;
static bool tag_present_flag = false;
static unsigned long last_presence_ms = 0;
static unsigned long lpcd_enter_ms = 0;

#define LPCD_WAKEUP_MS          500
#define PRESENCE_CHECK_MS       500
#define LPCD_RETRY_MS           100
#define NFC_POLL_INTERVAL_MS    250

// ==================== Tag Data ====================

struct PicoTagData {
    uint8_t  tag_type = TAG_TYPE_UNKNOWN;
    uint8_t  uid[8] = {};
    uint8_t  uid_len = 0;

    // MIFARE Classic
    uint8_t  sector_data[16][3][16];
    bool     sector_ok[16];
    uint8_t  sectors_read = 0;

    // NTAG / ISO15693
    uint8_t  page_data[NTAG_MAX_PAGES][4];
    uint8_t  pages_read = 0;

    bool     valid = false;

    void clear() {
        tag_type = TAG_TYPE_UNKNOWN;
        memset(uid, 0, sizeof(uid));
        uid_len = 0;
        memset(sector_data, 0, sizeof(sector_data));
        memset(sector_ok, 0, sizeof(sector_ok));
        sectors_read = 0;
        memset(page_data, 0, sizeof(page_data));
        pages_read = 0;
        valid = false;
    }
};

static PicoTagData tag;

// Packed data buffer for I2C transfer
static uint8_t data_buf[MAX_DATA_BUF_SIZE];
static uint16_t data_buf_len = 0;

// ==================== I2C Slave State ====================

static volatile uint8_t reg_ptr = 0;
static volatile uint16_t data_ptr = 0;
static volatile uint8_t cmd_pending = 0;

// Register file snapshot (updated from main loop, read by ISR)
static uint8_t regs[256];

// ==================== HKDF Key Derivation ====================

struct BambuKeys {
    uint8_t keyA[16][6];
    uint8_t keyB[16][6];
};

static const uint8_t BAMBU_MASTER_KEY[] = {
    0x9a, 0x75, 0x9c, 0xf2, 0xc4, 0xf7, 0xca, 0xff,
    0x22, 0x2c, 0xb9, 0x76, 0x9b, 0x41, 0xbc, 0x96
};
static const uint8_t HKDF_INFO_A[] = { 'R','F','I','D','-','A', 0x00 };
static const uint8_t HKDF_INFO_B[] = { 'R','F','I','D','-','B', 0x00 };

#define HKDF_INFO_LEN   7
#define HKDF_KEY_OUTPUT  96

// HKDF-SHA256 using BearSSL (native in arduino-pico)
static void hkdfDerive(const uint8_t *salt, size_t saltLen,
                       const uint8_t *ikm, size_t ikmLen,
                       const uint8_t *info, size_t infoLen,
                       uint8_t *okm, size_t okmLen) {
    br_hkdf_context ctx;
    br_hkdf_init(&ctx, &br_sha256_vtable, salt, saltLen);
    br_hkdf_inject(&ctx, ikm, ikmLen);
    br_hkdf_flip(&ctx);
    br_hkdf_produce(&ctx, info, infoLen, okm, okmLen);
}

static void bambuDeriveKeys(const uint8_t uid[4], BambuKeys &keys) {
    uint8_t okm[HKDF_KEY_OUTPUT];

    hkdfDerive(BAMBU_MASTER_KEY, sizeof(BAMBU_MASTER_KEY),
               uid, 4, HKDF_INFO_A, HKDF_INFO_LEN, okm, HKDF_KEY_OUTPUT);
    for (uint8_t s = 0; s < 16; s++) memcpy(keys.keyA[s], okm + s * 6, 6);

    hkdfDerive(BAMBU_MASTER_KEY, sizeof(BAMBU_MASTER_KEY),
               uid, 4, HKDF_INFO_B, HKDF_INFO_LEN, okm, HKDF_KEY_OUTPUT);
    for (uint8_t s = 0; s < 16; s++) memcpy(keys.keyB[s], okm + s * 6, 6);
}

// ==================== NFC Protocol Helpers ====================

static bool setupRF14443() {
    return reader14443.setupRF();
}

// Activate 14443A tag, returns UID length (4 or 7) or 0
static int8_t activateTag14443(uint8_t *uid) {
    if (digitalRead(PIN_BUSY) == HIGH) {
        reader14443.reset();
        reader14443.setupRF();
        if (digitalRead(PIN_BUSY) == HIGH) return 0;
    }

    uint8_t response[10] = {0};
    int8_t result = reader14443.activateTypeA(response, 1);

    static unsigned long lastActDebug = 0;
    if (millis() - lastActDebug > 3000) {
        uint32_t irq = reader14443.getIRQStatus();
        uint32_t rf, rx;
        reader14443.readRegister(RF_STATUS, &rf);
        reader14443.readRegister(RX_STATUS, &rx);
        Serial.printf("[ACT] r=%d ATQA=%02X%02X IRQ=%08X RF=%08X RX=%08X\n",
            result, response[0], response[1], irq, rf, rx);
        Serial.flush();
        lastActDebug = millis();
    }

    if (result >= 4 && result <= 7) {
        memcpy(uid, response + 3, result);
        return result;
    }
    return 0;
}

static bool reselectTag() {
    reader14443.mifareHalt();
    uint8_t resp[10] = {0};
    return (reader14443.activateTypeA(resp, 1) >= 4);
}

static void readMifareSectors(PicoTagData &t) {
    BambuKeys keys;
    bambuDeriveKeys(t.uid, keys);
    const uint8_t defaultKey[6] = {0xFF,0xFF,0xFF,0xFF,0xFF,0xFF};

    for (int pass = 0; pass <= 2; pass++) {
        bool anyFailed = false;
        for (uint8_t sector = 0; sector < 16; sector++) {
            if (t.sector_ok[sector]) continue;

            if (digitalRead(PIN_BUSY) == HIGH) {
                reader14443.reset();
                reader14443.setupRF();
                if (!reselectTag()) return;
                continue;
            }

            uint8_t firstBlock = sector * 4;
            bool authed = reader14443.mifareAuthenticate(firstBlock, 0x60,
                keys.keyA[sector], t.uid, t.uid_len);

            if (!authed) {
                if (!reselectTag()) return;
                authed = reader14443.mifareAuthenticate(firstBlock, 0x60,
                    defaultKey, t.uid, t.uid_len);
            }

            if (authed) {
                bool allOk = true;
                for (uint8_t b = 0; b < 3; b++) {
                    if (!reader14443.mifareBlockRead(firstBlock + b, t.sector_data[sector][b])) {
                        allOk = false;
                        break;
                    }
                }
                if (allOk) {
                    t.sector_ok[sector] = true;
                    t.sectors_read++;
                } else {
                    anyFailed = true;
                    if (!reselectTag()) return;
                }
            } else {
                anyFailed = true;
                if (!reselectTag()) return;
            }
        }
        if (!anyFailed || t.sectors_read >= 16) break;
        if (!reselectTag()) break;
    }

    reader14443.writeRegisterWithAndMask(SYSTEM_CONFIG, SYSTEM_CONFIG_CLEAR_CRYPTO_MASK);
    t.valid = (t.sectors_read > 0);
}

static void readNtagPages(PicoTagData &t) {
    for (uint8_t page = 0; page < NTAG_MAX_PAGES; page++) {
        uint8_t buf[16];
        if (reader14443.mifareBlockRead(page, buf)) {
            memcpy(t.page_data[page], buf, 4);
            t.pages_read = page + 1;
        } else {
            break;
        }
    }
    t.valid = (t.pages_read > 0);
}

// ISO 15693 detection with double-read confirmation
static bool detect15693(uint8_t *uid) {
    if (!reader15693.setupRF()) return false;

    uint8_t uid1[8] = {0};
    if (reader15693.getInventory(uid1) != ISO15693_EC_OK) {
        reader14443.setupRF();
        return false;
    }

    // Validate not all zeros/FF
    bool allZero = true, allFF = true;
    for (int i = 0; i < 8; i++) {
        if (uid1[i] != 0x00) allZero = false;
        if (uid1[i] != 0xFF) allFF = false;
    }
    if (allZero || allFF) {
        reader14443.setupRF();
        return false;
    }

    // Confirm with second read
    delay(5);
    uint8_t uid2[8] = {0};
    if (reader15693.getInventory(uid2) != ISO15693_EC_OK ||
        memcmp(uid1, uid2, 8) != 0) {
        reader14443.setupRF();
        return false;
    }

    memcpy(uid, uid1, 8);
    return true; // Stay in 15693 mode for block reads
}

static void read15693Blocks(PicoTagData &t) {
    uint8_t blockSize = 0, numBlocks = 0;
    reader15693.getSystemInfo(t.uid, &blockSize, &numBlocks);

    for (uint8_t b = 0; b < numBlocks && b < NTAG_MAX_PAGES; b++) {
        uint8_t blockData[32];
        if (reader15693.readSingleBlock(t.uid, b, blockData, blockSize) == ISO15693_EC_OK) {
            memcpy(t.page_data[b], blockData, min((int)blockSize, 4));
            t.pages_read = b + 1;
        }
    }
    t.valid = (t.pages_read > 0);
}

// Pack tag data into flat I2C transfer buffer
static void packDataBuffer() {
    data_buf_len = 0;
    if (tag.tag_type == TAG_TYPE_MIFARE_CLASSIC) {
        for (uint8_t s = 0; s < 16; s++) {
            for (uint8_t b = 0; b < 3; b++) {
                memcpy(&data_buf[data_buf_len], tag.sector_data[s][b], 16);
                data_buf_len += 16;
            }
        }
    } else {
        uint16_t len = tag.pages_read * 4;
        if (len > MAX_DATA_BUF_SIZE) len = MAX_DATA_BUF_SIZE;
        memcpy(data_buf, tag.page_data, len);
        data_buf_len = len;
    }
}

// ==================== I2C Slave Handlers ====================

void i2cReceiveHandler(int numBytes) {
    if (numBytes < 1) return;
    reg_ptr = Wire.read();  // First byte = register address

    // Remaining bytes = data writes
    while (Wire.available()) {
        uint8_t val = Wire.read();
        switch (reg_ptr) {
            case REG_DATA_PTR_H:
                data_ptr = (data_ptr & 0x00FF) | ((uint16_t)val << 8);
                break;
            case REG_DATA_PTR_L:
                data_ptr = (data_ptr & 0xFF00) | val;
                break;
            case REG_CMD:
                cmd_pending = val;
                break;
        }
        reg_ptr++;
    }
}

void i2cRequestHandler() {
    // Send up to 32 bytes starting at current register pointer
    uint8_t buf[32];
    uint8_t rp = reg_ptr;  // Local copy

    for (int i = 0; i < 32; i++) {
        if (rp == REG_DATA) {
            // Read from data buffer, auto-increment data_ptr
            buf[i] = (data_ptr < data_buf_len) ? data_buf[data_ptr++] : 0xFF;
            // Stay at REG_DATA for subsequent bytes
        } else {
            buf[i] = regs[rp];
            rp++;
        }
    }

    Wire.write(buf, 32);
    reg_ptr = rp;
}

// ==================== Register File Update ====================

static void updateRegs() {
    uint8_t status = 0;
    if (tag_present_flag)  status |= STATUS_TAG_PRESENT;
    if (data_ready_flag)   status |= STATUS_DATA_READY;
    if (reader_ok)         status |= STATUS_READER_OK;
    if (state == STATE_READING) status |= STATUS_READING;

    noInterrupts();

    regs[REG_STATUS]       = status;
    regs[REG_TAG_TYPE]     = tag.tag_type;
    regs[REG_UID_LEN]      = tag.uid_len;
    memcpy(&regs[REG_UID], tag.uid, 8);
    regs[REG_SECTORS_READ] = tag.sectors_read;
    regs[REG_PAGES_READ]   = tag.pages_read;

    uint8_t okH = 0, okL = 0;
    for (int i = 0; i < 8; i++) {
        if (tag.sector_ok[i])     okL |= (1 << i);
        if (tag.sector_ok[i + 8]) okH |= (1 << i);
    }
    regs[REG_SECTOR_OK_H] = okH;
    regs[REG_SECTOR_OK_L] = okL;

    regs[REG_DATA_LEN_H]  = (data_buf_len >> 8) & 0xFF;
    regs[REG_DATA_LEN_L]  = data_buf_len & 0xFF;
    regs[REG_FW_VERSION]   = NFC_PICO_FW_VERSION;
    regs[REG_DEVICE_ID]    = NFC_PICO_DEVICE_ID;

    interrupts();
}

// ==================== Bambu Tag Parsing & Debug Dump ====================

// Read a null-terminated ASCII string from sector data
static String readSectorString(const PicoTagData &t, uint8_t sector, uint8_t block, uint8_t offset, uint8_t maxLen) {
    if (!t.sector_ok[sector]) return "";
    const uint8_t *src = &t.sector_data[sector][block][offset];
    char buf[17] = {0};
    uint8_t len = (maxLen > 16) ? 16 : maxLen;
    for (uint8_t i = 0; i < len; i++) {
        uint8_t c = src[i];
        if (c == 0) break;
        if (c < 0x20 || c > 0x7E) { buf[i] = '?'; } else { buf[i] = c; }
    }
    return String(buf);
}

static uint16_t readU16LE(const uint8_t *p) {
    return p[0] | ((uint16_t)p[1] << 8);
}

static float readFloatLE(const uint8_t *p) {
    float f;
    memcpy(&f, p, 4);
    return f;
}

static void dumpTagData(const PicoTagData &t) {
    Serial.println("\n========== TAG RAW DUMP ==========");
    Serial.printf("Type: %d  UID(%d): ", t.tag_type, t.uid_len);
    for (int i = 0; i < t.uid_len; i++) Serial.printf("%02X", t.uid[i]);
    Serial.println();

    if (t.tag_type == TAG_TYPE_MIFARE_CLASSIC) {
        // Dump sector bitmask
        Serial.printf("Sectors read: %d  OK mask: ", t.sectors_read);
        for (int s = 0; s < 16; s++) Serial.print(t.sector_ok[s] ? '1' : '0');
        Serial.println();

        // Dump raw hex for each sector
        for (uint8_t s = 0; s < 16; s++) {
            if (!t.sector_ok[s]) continue;
            Serial.printf("  S%02d: ", s);
            for (uint8_t b = 0; b < 3; b++) {
                for (uint8_t i = 0; i < 16; i++) {
                    Serial.printf("%02X", t.sector_data[s][b][i]);
                }
                if (b < 2) Serial.print(" | ");
            }
            Serial.println();
        }

        // Parse as Bambu tag
        Serial.println("\n---------- BAMBU PARSE ----------");

        // Sector 0: material ID
        if (t.sector_ok[0]) {
            String variantId = readSectorString(t, 0, 1, 0, 8);
            String materialId = readSectorString(t, 0, 1, 8, 8);
            String material = readSectorString(t, 0, 2, 0, 16);
            Serial.printf("  S0 variantId : \"%s\"\n", variantId.c_str());
            Serial.printf("  S0 materialId: \"%s\"\n", materialId.c_str());
            Serial.printf("  S0 material  : \"%s\"\n", material.c_str());
        } else {
            Serial.println("  S0: NOT READ");
        }

        // Sector 1: name, color, weight, temps
        if (t.sector_ok[1]) {
            String name = readSectorString(t, 1, 0, 0, 16);
            const uint8_t *b1 = t.sector_data[1][1];
            uint8_t r = b1[0], g = b1[1], b = b1[2], a = b1[3];
            uint16_t netWeight = readU16LE(&b1[4]);
            float diameter = readFloatLE(&b1[8]);

            const uint8_t *b2 = t.sector_data[1][2];
            uint16_t dryTemp = readU16LE(&b2[0]);
            uint16_t dryTime = readU16LE(&b2[2]);
            uint16_t bedTemp = readU16LE(&b2[6]);
            uint16_t nozzleMax = readU16LE(&b2[8]);
            uint16_t nozzleMin = readU16LE(&b2[10]);

            Serial.printf("  S1 name      : \"%s\"\n", name.c_str());
            Serial.printf("  S1 color     : R=%d G=%d B=%d A=%d (#%02X%02X%02X)\n", r, g, b, a, r, g, b);
            Serial.printf("  S1 netWeight : %d g\n", netWeight);
            Serial.printf("  S1 diameter  : %.2f mm\n", diameter);
            Serial.printf("  S1 dryTemp   : %d C  dryTime: %d h\n", dryTemp, dryTime);
            Serial.printf("  S1 bedTemp   : %d C\n", bedTemp);
            Serial.printf("  S1 nozzle    : %d-%d C\n", nozzleMin, nozzleMax);
        } else {
            Serial.println("  S1: NOT READ");
        }

        // Sector 2: X-cam, tray UID
        if (t.sector_ok[2]) {
            const uint8_t *b0 = t.sector_data[2][0];
            uint16_t xcA = readU16LE(&b0[0]);
            uint16_t xcB = readU16LE(&b0[2]);
            uint16_t xcC = readU16LE(&b0[4]);
            uint16_t xcD = readU16LE(&b0[6]);
            float xcE = readFloatLE(&b0[8]);
            float xcF = readFloatLE(&b0[12]);
            Serial.printf("  S2 xcam      : A=%d B=%d C=%d D=%d E=%.2f F=%.2f\n", xcA, xcB, xcC, xcD, xcE, xcF);

            Serial.print("  S2 trayUid   : ");
            for (int i = 0; i < 16; i++) Serial.printf("%02X", t.sector_data[2][1][i]);
            Serial.println();
        } else {
            Serial.println("  S2: NOT READ");
        }

        // Sector 3: production date, filament length
        if (t.sector_ok[3]) {
            String prodDate = readSectorString(t, 3, 0, 0, 16);
            uint16_t filLen = readU16LE(&t.sector_data[3][2][4]);
            Serial.printf("  S3 prodDate  : \"%s\"\n", prodDate.c_str());
            Serial.printf("  S3 filLength : %d m\n", filLen);
        } else {
            Serial.println("  S3: NOT READ");
        }

        // Sector 4: multicolor
        if (t.sector_ok[4]) {
            Serial.print("  S4 multicolor: ");
            bool allZero = true;
            for (int i = 0; i < 16; i++) {
                Serial.printf("%02X", t.sector_data[4][0][i]);
                if (t.sector_data[4][0][i] != 0) allZero = false;
            }
            Serial.println(allZero ? " (empty)" : "");
        } else {
            Serial.println("  S4: NOT READ");
        }

        // Dump the hex string as it would be sent over I2C (for comparison with server)
        Serial.println("\n---------- I2C DATA HEX ----------");
        Serial.printf("Length: %d bytes\n", data_buf_len);
        for (uint16_t i = 0; i < data_buf_len; i++) {
            Serial.printf("%02X", data_buf[i]);
            if ((i + 1) % 48 == 0) Serial.printf("  [S%d]\n", i / 48);
        }
        if (data_buf_len % 48 != 0) Serial.println();

        Serial.println("==================================\n");

    } else if (t.tag_type == TAG_TYPE_NTAG) {
        Serial.printf("NTAG pages: %d\n", t.pages_read);
        for (uint8_t p = 0; p < t.pages_read; p++) {
            Serial.printf("  P%03d: %02X %02X %02X %02X\n", p,
                t.page_data[p][0], t.page_data[p][1], t.page_data[p][2], t.page_data[p][3]);
        }
        Serial.println("==================================\n");

    } else if (t.tag_type == TAG_TYPE_ISO15693) {
        Serial.printf("ISO15693 blocks: %d\n", t.pages_read);
        for (uint8_t b = 0; b < t.pages_read; b++) {
            Serial.printf("  B%03d: %02X %02X %02X %02X\n", b,
                t.page_data[b][0], t.page_data[b][1], t.page_data[b][2], t.page_data[b][3]);
        }
        Serial.println("==================================\n");
    }
    Serial.flush();
}

// ==================== State Machine ====================

static void nfcPoll() {
    unsigned long now = millis();

    switch (state) {

    case STATE_IDLE:
        // Skip LPCD for now — go straight to active polling
        // (LPCD needs IRQ pin wired + threshold tuning)
        state = STATE_ACTIVATING;
        break;

    case STATE_LPCD_WAITING: {
        bool irqFired = digitalRead(PIN_IRQ);

        if (!irqFired && (now - lpcd_enter_ms > LPCD_WAKEUP_MS + 50)) {
            uint32_t irq = reader14443.getIRQStatus();
            if (irq & LPCD_IRQ_STAT) {
                irqFired = true;
            } else {
                // LPCD timeout — do an active poll anyway as fallback
                irqFired = true;
            }
        }

        if (irqFired) {
            reader14443.clearIRQStatus(0xFFFFFFFF);
            state = STATE_ACTIVATING;
        }
        break;
    }

    case STATE_ACTIVATING: {
        static unsigned long lastHB = 0;
        static uint16_t pollCount = 0;
        pollCount++;
        if (now - lastHB > 3000) {
            Serial.printf("[NFC] polls=%d\n", pollCount);
            Serial.flush();
            lastHB = now;
            pollCount = 0;
        }

        if (!setupRF14443()) {
            Serial.println("[NFC] setupRF failed!");
            Serial.flush();
            state = STATE_ERROR;
            break;
        }

        uint8_t uid[8] = {0};
        int8_t uidLen = activateTag14443(uid);

        if (uidLen >= 4) {
            tag.clear();
            memcpy(tag.uid, uid, uidLen);
            tag.uid_len = uidLen;
            tag.tag_type = (uidLen == 4) ? TAG_TYPE_MIFARE_CLASSIC : TAG_TYPE_NTAG;
            tag_present_flag = true;
            state = STATE_READING;

            Serial.printf("[NFC] %s UID=", (uidLen == 4) ? "MIFARE" : "NTAG");
            for (int i = 0; i < uidLen; i++) Serial.printf("%02X%s", uid[i], i < uidLen-1 ? ":" : "");
            Serial.println();
            break;
        }

        // No 14443A — try ISO 15693
        uint8_t uid15[8] = {0};
        if (detect15693(uid15)) {
            tag.clear();
            memcpy(tag.uid, uid15, 8);
            tag.uid_len = 8;
            tag.tag_type = TAG_TYPE_ISO15693;
            tag_present_flag = true;
            state = STATE_READING;

            Serial.print("[NFC] ISO15693 UID=");
            for (int i = 7; i >= 0; i--) Serial.printf("%02X%s", uid15[i], i > 0 ? ":" : "");
            Serial.println();
            break;
        }

        // No tag — brief delay then retry
        delay(NFC_POLL_INTERVAL_MS);
        break;
    }

    case STATE_READING:
        Serial.println("[NFC] Reading...");

        if (tag.tag_type == TAG_TYPE_MIFARE_CLASSIC) {
            readMifareSectors(tag);
        } else if (tag.tag_type == TAG_TYPE_NTAG) {
            readNtagPages(tag);
        } else if (tag.tag_type == TAG_TYPE_ISO15693) {
            read15693Blocks(tag);
            setupRF14443();
        }

        if (!tag.valid) {
            Serial.println("[NFC] Ghost, no data");
            tag_present_flag = false;
            state = STATE_IDLE;
            break;
        }

        packDataBuffer();
        reader14443.mifareHalt();
        reader14443.writeRegisterWithAndMask(0x00, 0xFFFFFFBF);

        Serial.printf("[NFC] Done: %d %s\n",
            tag.tag_type == TAG_TYPE_MIFARE_CLASSIC ? tag.sectors_read : tag.pages_read,
            tag.tag_type == TAG_TYPE_MIFARE_CLASSIC ? "sectors" : "pages");

        // Dump raw data and parse Bambu tags for debugging
        dumpTagData(tag);

        data_ready_flag = true;
        digitalWrite(PIN_INT, LOW);  // Signal ESP32
        last_presence_ms = now;
        state = STATE_TAG_PRESENT;
        break;

    case STATE_TAG_PRESENT:
        if (now - last_presence_ms < PRESENCE_CHECK_MS) break;
        last_presence_ms = now;

        // Quick presence check
        if (!setupRF14443()) { state = STATE_ERROR; break; }

        {
            uint8_t uid[8] = {0};
            int8_t uidLen = activateTag14443(uid);

            if (uidLen >= 4 && tag.uid_len == uidLen &&
                memcmp(uid, tag.uid, uidLen) == 0) {
                reader14443.mifareHalt();
                break; // Still there
            }

            // Try 15693 for 15693 tags
            if (tag.tag_type == TAG_TYPE_ISO15693) {
                uint8_t uid15[8];
                if (detect15693(uid15) && memcmp(uid15, tag.uid, 8) == 0) {
                    setupRF14443();
                    break;
                }
                setupRF14443();
            }
        }

        Serial.println("[NFC] Tag removed");
        tag_present_flag = false;
        data_ready_flag = false;
        digitalWrite(PIN_INT, HIGH);
        state = STATE_IDLE;
        break;

    case STATE_ERROR:
        Serial.println("[NFC] Error — recovering...");
        reader_ok = false;
        if (reader14443.reset()) {
            reader14443.clearIRQStatus(0xFFFFFFFF);
            if (reader14443.prepareLPCD()) {
                reader_ok = true;
                state = STATE_IDLE;
                Serial.println("[NFC] Recovered");
            }
        }
        if (!reader_ok) delay(1000);
        break;

    case STATE_INIT:
        break;
    }
}

// ==================== Arduino Setup ====================

void setup() {
    // LED first — blink to prove we're running
    pinMode(PIN_LED, OUTPUT);
    for (int i = 0; i < 6; i++) {
        digitalWrite(PIN_LED, i & 1);
        delay(200);
    }
    digitalWrite(PIN_LED, HIGH);

    Serial.begin(115200);
    // Wait for USB serial up to 3s (don't block forever — I2C must start)
    for (int i = 0; i < 300 && !Serial; i++) delay(10);
    Serial.println("\n=== Filla IQ — NFC Pico Coprocessor ===");

    // INT pin (active LOW, idle HIGH)
    pinMode(PIN_INT, OUTPUT);
    digitalWrite(PIN_INT, HIGH);

    // Init SPI for PN5180 (set pins before begin)
    SPI.setRX(PIN_MISO);
    SPI.setTX(PIN_MOSI);
    SPI.setSCK(PIN_SCK);
    SPI.begin();

    // Init I2C slave
    Wire.setSDA(PIN_SDA);
    Wire.setSCL(PIN_SCL);
    Wire.begin(NFC_PICO_I2C_ADDR);
    Wire.onReceive(i2cReceiveHandler);
    Wire.onRequest(i2cRequestHandler);
    Serial.printf("[I2C] Slave at 0x%02X\n", NFC_PICO_I2C_ADDR);

    // Init register file
    memset(regs, 0, sizeof(regs));
    regs[REG_FW_VERSION] = NFC_PICO_FW_VERSION;
    regs[REG_DEVICE_ID]  = NFC_PICO_DEVICE_ID;

    // Init PN5180
    Serial.println("[NFC] Init PN5180...");
    pinMode(PIN_BUSY, INPUT);
    pinMode(PIN_RST, OUTPUT);
    pinMode(PIN_IRQ, INPUT);

    reader14443.begin();

    // Hard reset
    digitalWrite(PIN_RST, LOW);
    delay(50);
    digitalWrite(PIN_RST, HIGH);
    delay(260);

    if (!reader14443.reset()) {
        Serial.println("[NFC] ERROR: Reset failed");
        state = STATE_ERROR;
        updateRegs();
        return;
    }

    // Verify firmware
    uint8_t fw[2] = {0};
    reader14443.readEEprom(FIRMWARE_VERSION, fw, 2);
    if ((fw[0] == 0 && fw[1] == 0) || (fw[0] == 0xFF && fw[1] == 0xFF)) {
        Serial.println("[NFC] ERROR: PN5180 not detected");
        state = STATE_ERROR;
        updateRegs();
        return;
    }

    uint8_t prod[2];
    reader14443.readEEprom(PRODUCT_VERSION, prod, 2);
    Serial.printf("[NFC] PN5180 fw=%d.%d prod=%d.%d\n", fw[1], fw[0], prod[1], prod[0]);

    // Antenna auto-tune + RF setup + LPCD
    reader14443.clearIRQStatus(0xFFFFFFFF);
    reader14443.setRF_off();

    if (setupRF14443()) {
        reader14443.setRF_off();
        if (reader14443.prepareLPCD()) {
            Serial.println("[NFC] LPCD configured");
        } else {
            Serial.println("[NFC] LPCD failed, using active polling");
        }
        reader_ok = true;
        state = STATE_IDLE;
        digitalWrite(PIN_LED, HIGH);
    } else {
        Serial.println("[NFC] RF setup failed");
        state = STATE_ERROR;
    }

    updateRegs();
    Serial.println("[NFC] Ready");
}

// ==================== Arduino Loop ====================

void loop() {
    // Handle commands from ESP32
    if (cmd_pending) {
        uint8_t cmd = cmd_pending;
        cmd_pending = 0;

        switch (cmd) {
        case CMD_RESCAN:
            Serial.println("[CMD] Rescan");
            tag_present_flag = false;
            data_ready_flag = false;
            digitalWrite(PIN_INT, HIGH);
            state = STATE_IDLE;
            break;
        case CMD_RESET:
            Serial.println("[CMD] Reset");
            tag_present_flag = false;
            data_ready_flag = false;
            digitalWrite(PIN_INT, HIGH);
            state = STATE_ERROR;
            break;
        case CMD_ACK:
            data_ready_flag = false;
            digitalWrite(PIN_INT, HIGH);
            break;
        }
    }

    // Run NFC state machine
    nfcPoll();

    // Update I2C register file
    updateRegs();

    // LED feedback
    unsigned long now = millis();
    if (state == STATE_ERROR) {
        digitalWrite(PIN_LED, LOW);
    } else if (state == STATE_READING) {
        digitalWrite(PIN_LED, (now / 100) & 1);
    } else if (tag_present_flag) {
        digitalWrite(PIN_LED, HIGH);
    } else {
        digitalWrite(PIN_LED, (now % 2000) < 50);
    }
}
