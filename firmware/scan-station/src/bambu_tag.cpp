#include "bambu_tag.h"
#include <Adafruit_PN532.h>
#include "mbedtls/md.h"

// ============================================================
// Generic NFC Tag Reading + Bambu Lab Parsing
// ============================================================

// Bambu Lab master key (16 bytes)
static const uint8_t BAMBU_MASTER_KEY[] = {
    0x9a, 0x75, 0x9c, 0xf2, 0xc4, 0xf7, 0xca, 0xff,
    0x22, 0x2c, 0xb9, 0x76, 0x9b, 0x41, 0xbc, 0x96
};

// Default MIFARE Classic key (factory default)
static const uint8_t DEFAULT_KEY[6] = { 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF };

// HKDF info strings (7 bytes each, including null terminator)
static const uint8_t HKDF_INFO_A[] = { 'R','F','I','D','-','A', 0x00 };
static const uint8_t HKDF_INFO_B[] = { 'R','F','I','D','-','B', 0x00 };

#define HKDF_INFO_LEN    7
#define HKDF_KEY_OUTPUT  96   // 6 bytes × 16 sectors
#define SHA256_HASH_LEN  32

// ==================== HKDF-SHA256 (manual from HMAC) ====================

// HKDF-Expand: OKM = T(1) || T(2) || ... truncated to okmLen
// T(i) = HMAC-SHA256(PRK, T(i-1) || info || i)   (counter is 1-based byte)
static void hkdfExpand(const uint8_t prk[SHA256_HASH_LEN],
                       const uint8_t *info, size_t infoLen,
                       uint8_t *okm, size_t okmLen) {
    const mbedtls_md_info_t *mdInfo = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
    uint8_t T[SHA256_HASH_LEN];
    size_t tLen = 0;  // T(0) is empty
    size_t offset = 0;
    uint8_t counter = 1;

    while (offset < okmLen) {
        mbedtls_md_context_t ctx;
        mbedtls_md_init(&ctx);
        mbedtls_md_setup(&ctx, mdInfo, 1);
        mbedtls_md_hmac_starts(&ctx, prk, SHA256_HASH_LEN);

        if (tLen > 0) {
            mbedtls_md_hmac_update(&ctx, T, tLen);
        }
        mbedtls_md_hmac_update(&ctx, info, infoLen);
        mbedtls_md_hmac_update(&ctx, &counter, 1);
        mbedtls_md_hmac_finish(&ctx, T);
        mbedtls_md_free(&ctx);

        tLen = SHA256_HASH_LEN;
        size_t copyLen = min(okmLen - offset, (size_t)SHA256_HASH_LEN);
        memcpy(okm + offset, T, copyLen);
        offset += copyLen;
        counter++;
    }
}

// ==================== Key Derivation ====================

void bambuDeriveKeys(const uint8_t uid[4], BambuKeys &keys) {
    uint8_t prk[SHA256_HASH_LEN];
    uint8_t okm[HKDF_KEY_OUTPUT];

    // Extract: PRK = HMAC-SHA256(salt=masterKey, IKM=uid)
    {
        mbedtls_md_context_t ctx;
        mbedtls_md_init(&ctx);
        const mbedtls_md_info_t *mdInfo = mbedtls_md_info_from_type(MBEDTLS_MD_SHA256);
        mbedtls_md_setup(&ctx, mdInfo, 1);
        mbedtls_md_hmac_starts(&ctx, BAMBU_MASTER_KEY, sizeof(BAMBU_MASTER_KEY));
        mbedtls_md_hmac_update(&ctx, uid, 4);
        mbedtls_md_hmac_finish(&ctx, prk);
        mbedtls_md_free(&ctx);
    }
    hkdfExpand(prk, HKDF_INFO_A, HKDF_INFO_LEN, okm, HKDF_KEY_OUTPUT);
    for (uint8_t s = 0; s < 16; s++) {
        memcpy(keys.keyA[s], okm + s * 6, 6);
    }

    hkdfExpand(prk, HKDF_INFO_B, HKDF_INFO_LEN, okm, HKDF_KEY_OUTPUT);
    for (uint8_t s = 0; s < 16; s++) {
        memcpy(keys.keyB[s], okm + s * 6, 6);
    }
}

// ==================== MIFARE Helpers ====================

// Re-select tag after auth failure (tag goes to HALT state)
static bool reselectTag(Adafruit_PN532 &reader) {
    uint8_t uid[7];
    uint8_t uidLen;
    return reader.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 200);
}

// Try to authenticate a sector with a given key. Silent on failure.
// Returns true if auth succeeded (tag stays in authenticated state).
static bool trySectorAuth(Adafruit_PN532 &reader, const uint8_t *uid, uint8_t uidLen,
                           uint8_t sector, const uint8_t key[6]) {
    uint8_t firstBlock = sector * 4;
    if (reader.mifareclassic_AuthenticateBlock((uint8_t*)uid, uidLen, firstBlock, 0, (uint8_t*)key)) {
        return true;
    }
    // Auth failure puts tag in HALT — re-select and retry once
    if (reselectTag(reader) &&
        reader.mifareclassic_AuthenticateBlock((uint8_t*)uid, uidLen, firstBlock, 0, (uint8_t*)key)) {
        return true;
    }
    return false;
}

// Read 3 data blocks from an already-authenticated sector into blockData.
// Returns number of blocks successfully read (0-3).
static uint8_t readSectorBlocks(Adafruit_PN532 &reader, uint8_t sector, uint8_t blockData[3][16]) {
    uint8_t firstBlock = sector * 4;
    uint8_t blocksRead = 0;
    for (uint8_t b = 0; b < 3; b++) {
        if (reader.mifareclassic_ReadDataBlock(firstBlock + b, blockData[b])) {
            blocksRead++;
        } else {
            memset(blockData[b], 0, 16);
        }
    }
    return blocksRead;
}

// ==================== Generic MIFARE Classic Reading ====================

// Read a range of sectors [startSector, startSector+count) into TagData.
// Tag must already be selected (readPassiveTargetID succeeded).
// Keys must already be derived and passed in.
void readMifareClassicSectors(Adafruit_PN532 &reader, const uint8_t *uid, uint8_t uidLen,
                              const BambuKeys &bambuKeys, uint8_t startSector, uint8_t count,
                              TagData &out) {
    uint8_t end = startSector + count;
    if (end > TagData::NUM_SECTORS) end = TagData::NUM_SECTORS;

    for (uint8_t s = startSector; s < end; s++) {
        out.sector_ok[s] = false;

        // Try Bambu key first, then default key
        bool authed = trySectorAuth(reader, uid, uidLen, s, bambuKeys.keyA[s]);
        if (!authed) {
            reselectTag(reader);
            authed = trySectorAuth(reader, uid, uidLen, s, DEFAULT_KEY);
        }

        if (authed) {
            uint8_t blocks = readSectorBlocks(reader, s, out.sector_data[s]);
            if (blocks > 0) {
                out.sector_ok[s] = true;
                out.sectors_read++;
            }
        } else {
            memset(out.sector_data[s], 0, sizeof(out.sector_data[s]));
            reselectTag(reader);
        }
    }

    out.valid = (out.sectors_read > 0);
}

// Read all sectors at once (convenience wrapper, blocks for ~10s)
void readMifareClassicRaw(Adafruit_PN532 &reader, const uint8_t *uid, uint8_t uidLen,
                          TagData &out) {
    BambuKeys bambuKeys;
    bambuDeriveKeys(uid, bambuKeys);
    out.sectors_read = 0;
    readMifareClassicSectors(reader, uid, uidLen, bambuKeys, 0, TagData::NUM_SECTORS, out);
}

// ==================== Generic NTAG/Ultralight Reading ====================

void readNtagRaw(Adafruit_PN532 &reader, TagData &out) {
    out.pages_read = 0;

    // NTAG pages are 4 bytes each. Read sequentially until failure.
    // Page 0-3 are header/capability container, 4+ are user data.
    // We read everything — web service decides what matters.
    for (uint8_t page = 0; page < TagData::MAX_PAGES; page++) {
        uint8_t buf[4];
        if (reader.ntag2xx_ReadPage(page, buf)) {
            memcpy(out.page_data[page], buf, 4);
            out.pages_read = page + 1;
        } else {
            break;  // End of readable pages
        }
    }

    out.valid = (out.pages_read > 0);
}

// ==================== Bambu Parsing from Raw Data ====================

// Helper: copy string from block data, null-terminate
static void copyBlockString(char *dst, size_t dstLen, const uint8_t *src, size_t srcLen) {
    size_t len = min(dstLen - 1, srcLen);
    memcpy(dst, src, len);
    dst[len] = '\0';
    while (len > 0 && (dst[len-1] == ' ' || dst[len-1] == '\0')) {
        dst[--len] = '\0';
    }
}

// Helper: read uint16 little-endian
static uint16_t readU16LE(const uint8_t *p) {
    return (uint16_t)p[0] | ((uint16_t)p[1] << 8);
}

// Helper: read float little-endian
static float readFloatLE(const uint8_t *p) {
    float val;
    memcpy(&val, p, 4);
    return val;
}

bool parseBambuFromRaw(const TagData &tag, FilamentInfo &out) {
    out.clear();

    if (tag.type != TAG_MIFARE_CLASSIC) return false;

    bool ok = true;

    // Sector 0: Block 0 (mfr data), Block 1 (variant/material IDs), Block 2 (material type)
    if (tag.sector_ok[0]) {
        memcpy(out.mfr_data, tag.sector_data[0][0] + 4, 12);
        copyBlockString(out.variant_id, sizeof(out.variant_id), tag.sector_data[0][1], 8);
        copyBlockString(out.material_id, sizeof(out.material_id), tag.sector_data[0][1] + 8, 8);
        copyBlockString(out.material, sizeof(out.material), tag.sector_data[0][2], 16);
    } else {
        ok = false;
    }

    // Sector 1: Color, weight, diameter, temps, drying
    if (tag.sector_ok[1]) {
        copyBlockString(out.name, sizeof(out.name), tag.sector_data[1][0], 16);

        out.color_r = tag.sector_data[1][1][0];
        out.color_g = tag.sector_data[1][1][1];
        out.color_b = tag.sector_data[1][1][2];
        out.color_a = tag.sector_data[1][1][3];

        out.spool_net_weight = (float)readU16LE(&tag.sector_data[1][1][4]);
        out.filament_diameter = readFloatLE(&tag.sector_data[1][1][8]);

        out.drying_temp = readU16LE(&tag.sector_data[1][2][0]);
        out.drying_time = readU16LE(&tag.sector_data[1][2][2]);
        out.bed_temp = readU16LE(&tag.sector_data[1][2][6]);
        out.nozzle_temp_max = readU16LE(&tag.sector_data[1][2][8]);
        out.nozzle_temp_min = readU16LE(&tag.sector_data[1][2][10]);
    } else {
        ok = false;
    }

    // Sector 2: X-cam data, Tray UID
    if (tag.sector_ok[2]) {
        out.xcam_a = readU16LE(&tag.sector_data[2][0][0]);
        out.xcam_b = readU16LE(&tag.sector_data[2][0][2]);
        out.xcam_c = readU16LE(&tag.sector_data[2][0][4]);
        out.xcam_d = readU16LE(&tag.sector_data[2][0][6]);
        out.xcam_e = readFloatLE(&tag.sector_data[2][0][8]);
        out.xcam_f = readFloatLE(&tag.sector_data[2][0][12]);

        int pos = 0;
        for (uint8_t i = 0; i < 16 && pos < (int)sizeof(out.tray_uid) - 2; i++) {
            pos += snprintf(out.tray_uid + pos, sizeof(out.tray_uid) - pos, "%02X", tag.sector_data[2][1][i]);
        }
        pos = 0;
        for (uint8_t i = 0; i < 8 && pos < (int)sizeof(out.brand) - 2; i++) {
            pos += snprintf(out.brand + pos, sizeof(out.brand) - pos, "%02X", tag.sector_data[2][1][i]);
        }
    }

    // Sector 3: Production date, filament length
    if (tag.sector_ok[3]) {
        copyBlockString(out.production_date, sizeof(out.production_date), tag.sector_data[3][0], 16);
        out.filament_length_m = readU16LE(&tag.sector_data[3][2][4]);
    }

    // Sector 4: Multi-color data
    if (tag.sector_ok[4]) {
        memcpy(out.multicolor_data, tag.sector_data[4][0], 16);
    }

    if (ok) {
        out.valid = true;
    }
    return ok;
}

// ==================== Diagnostics ====================

void bambuPrintInfo(const FilamentInfo &info) {
    if (!info.valid) {
        Serial.println("  (no valid data)");
        return;
    }
    Serial.printf("  Material:    %s\n", info.material);
    Serial.printf("  Name:        %s\n", info.name);
    Serial.printf("  Variant ID:  %s\n", info.variant_id);
    Serial.printf("  Material ID: %s\n", info.material_id);
    Serial.printf("  Color:       #%02X%02X%02X (a=%02X)\n",
        info.color_r, info.color_g, info.color_b, info.color_a);
    Serial.printf("  Nozzle:      %d-%dC\n", info.nozzle_temp_min, info.nozzle_temp_max);
    Serial.printf("  Bed:         %dC\n", info.bed_temp);
    Serial.printf("  Drying:      %dC for %dhrs\n", info.drying_temp, info.drying_time);
    Serial.printf("  Weight:      %.0fg\n", info.spool_net_weight);
    Serial.printf("  Diameter:    %.2fmm\n", info.filament_diameter);
    if (info.filament_length_m > 0) {
        Serial.printf("  Length:      %dm\n", info.filament_length_m);
    }
    if (info.production_date[0]) {
        Serial.printf("  Produced:    %s\n", info.production_date);
    }
    if (info.tray_uid[0]) {
        Serial.printf("  Tray UID:    %s\n", info.tray_uid);
    }
    Serial.printf("  Mfr data:    ");
    for (uint8_t i = 0; i < 12; i++) {
        Serial.printf("%02X", info.mfr_data[i]);
    }
    Serial.println();
    if (info.xcam_a || info.xcam_b || info.xcam_c || info.xcam_d) {
        Serial.printf("  X-cam:       %u, %u, %u, %u, %.4f, %.4f\n",
            info.xcam_a, info.xcam_b, info.xcam_c, info.xcam_d,
            info.xcam_e, info.xcam_f);
    }
    bool hasMC = false;
    for (uint8_t i = 0; i < 16; i++) { if (info.multicolor_data[i]) { hasMC = true; break; } }
    if (hasMC) {
        Serial.printf("  Multicolor:  ");
        for (uint8_t i = 0; i < 16; i++) Serial.printf("%02X", info.multicolor_data[i]);
        Serial.println();
    }
}
