#include "bambu_tag.h"
#include <Adafruit_PN532.h>
#include "mbedtls/md.h"

// ============================================================
// Bambu Lab MIFARE Classic 1K — Key Derivation & Data Reading
// ============================================================

// Bambu Lab master key (16 bytes)
static const uint8_t BAMBU_MASTER_KEY[] = {
    0x9a, 0x75, 0x9c, 0xf2, 0xc4, 0xf7, 0xca, 0xff,
    0x22, 0x2c, 0xb9, 0x76, 0x9b, 0x41, 0xbc, 0x96
};

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
    // HKDF-SHA256: IKM = uid (4 bytes), salt = master_key (16 bytes)
    // Extract: PRK = HMAC-SHA256(salt, IKM)
    // Expand:  OKM = HKDF-Expand(PRK, info, 96)  where info = "RFID-A\0" or "RFID-B\0"

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

    // --- Key B ---
    // Same PRK (same salt + IKM), different info string
    hkdfExpand(prk, HKDF_INFO_B, HKDF_INFO_LEN, okm, HKDF_KEY_OUTPUT);
    for (uint8_t s = 0; s < 16; s++) {
        memcpy(keys.keyB[s], okm + s * 6, 6);
    }
}

// ==================== MIFARE Block Reading ====================

// Re-select tag after auth failure (tag goes to HALT state)
static bool reselectTag(Adafruit_PN532 &reader) {
    uint8_t uid[7];
    uint8_t uidLen;
    return reader.readPassiveTargetID(PN532_MIFARE_ISO14443A, uid, &uidLen, 200);
}

// Read a single sector (authenticate + read data blocks).
// Returns number of data blocks successfully read (0-3).
// If auth fails, attempts to re-select the tag and retry once.
static uint8_t readSector(Adafruit_PN532 &reader,
                          const uint8_t *uid, uint8_t uidLen,
                          uint8_t sector, const uint8_t keyA[6],
                          uint8_t blockData[3][16]) {
    uint8_t firstBlock = sector * 4;

    // Authenticate with Key A (retry once on failure)
    if (!reader.mifareclassic_AuthenticateBlock((uint8_t*)uid, uidLen, firstBlock, 0, (uint8_t*)keyA)) {
        // Auth failure puts tag in HALT — re-select and retry
        if (!reselectTag(reader) ||
            !reader.mifareclassic_AuthenticateBlock((uint8_t*)uid, uidLen, firstBlock, 0, (uint8_t*)keyA)) {
            Serial.printf("  MIFARE auth failed: sector %d\n", sector);
            return 0;
        }
    }

    uint8_t blocksRead = 0;
    for (uint8_t b = 0; b < 3; b++) {  // Skip block 3 (sector trailer)
        if (reader.mifareclassic_ReadDataBlock(firstBlock + b, blockData[b])) {
            blocksRead++;
        } else {
            Serial.printf("  MIFARE read failed: block %d\n", firstBlock + b);
            memset(blockData[b], 0, 16);
        }
    }
    return blocksRead;
}

// Helper: copy string from block data, null-terminate
static void copyBlockString(char *dst, size_t dstLen, const uint8_t *src, size_t srcLen) {
    size_t len = min(dstLen - 1, srcLen);
    memcpy(dst, src, len);
    dst[len] = '\0';
    // Trim trailing spaces/nulls
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

// ==================== Tag Reading & Parsing ====================

bool bambuReadTag(Adafruit_PN532 &reader, const uint8_t *uid, uint8_t uidLen,
                  FilamentInfo &out) {
    out.clear();

    if (uidLen != 4) {
        Serial.println("  Not a 4-byte UID — not MIFARE Classic");
        return false;
    }

    // Derive keys
    BambuKeys keys;
    bambuDeriveKeys(uid, keys);

    uint8_t blockData[3][16];
    bool ok = true;

    // --- Sector 0: Block 0 (mfr data), Block 1 (variant/material IDs), Block 2 (material type) ---
    if (readSector(reader, uid, uidLen, 0, keys.keyA[0], blockData) >= 3) {
        // Block 0 [4:15] = MIFARE manufacturer/chip data
        memcpy(out.mfr_data, blockData[0] + 4, 12);

        // Block 1 [0:7] = material variant ID (e.g. "A00-K00")
        copyBlockString(out.variant_id, sizeof(out.variant_id), blockData[1], 8);

        // Block 1 [8:15] = Bambu material ID (e.g. "GFA00")
        copyBlockString(out.material_id, sizeof(out.material_id), blockData[1] + 8, 8);

        // Block 2 [0:15] = filament type string (e.g. "PLA")
        copyBlockString(out.material, sizeof(out.material), blockData[2], 16);
    } else {
        ok = false;
    }

    // --- Sector 1: Color, weight, diameter, temps, drying ---
    if (readSector(reader, uid, uidLen, 1, keys.keyA[1], blockData) >= 3) {
        // Block 4 [0:15] = detailed filament type → use as name
        copyBlockString(out.name, sizeof(out.name), blockData[0], 16);

        // Block 5 [0:3] = RGBA color
        out.color_r = blockData[1][0];
        out.color_g = blockData[1][1];
        out.color_b = blockData[1][2];
        out.color_a = blockData[1][3];

        // Block 5 [4:5] = spool weight (g)
        out.spool_net_weight = (float)readU16LE(&blockData[1][4]);

        // Block 5 [8:11] = filament diameter (float LE, mm)
        out.filament_diameter = readFloatLE(&blockData[1][8]);

        // Block 6 [0:1] = drying temp (C)
        out.drying_temp = readU16LE(&blockData[2][0]);

        // Block 6 [2:3] = drying time (hrs)
        out.drying_time = readU16LE(&blockData[2][2]);

        // Block 6 [6:7] = bed temp
        out.bed_temp = readU16LE(&blockData[2][6]);

        // Block 6 [8:9] = max nozzle temp
        out.nozzle_temp_max = readU16LE(&blockData[2][8]);

        // Block 6 [10:11] = min nozzle temp
        out.nozzle_temp_min = readU16LE(&blockData[2][10]);
    } else {
        ok = false;
    }

    // --- Sector 2: X-cam data, Tray UID ---
    if (readSector(reader, uid, uidLen, 2, keys.keyA[2], blockData) >= 3) {
        // Block 8 = X-cam info (parsed fields)
        out.xcam_a = readU16LE(&blockData[0][0]);
        out.xcam_b = readU16LE(&blockData[0][2]);
        out.xcam_c = readU16LE(&blockData[0][4]);
        out.xcam_d = readU16LE(&blockData[0][6]);
        out.xcam_e = readFloatLE(&blockData[0][8]);
        out.xcam_f = readFloatLE(&blockData[0][12]);

        // Block 9 = tray UID (binary 16 bytes) → format as full hex string
        int pos = 0;
        for (uint8_t i = 0; i < 16 && pos < (int)sizeof(out.tray_uid) - 2; i++) {
            pos += snprintf(out.tray_uid + pos, sizeof(out.tray_uid) - pos, "%02X", blockData[1][i]);
        }

        // Also store first 8 bytes as brand shorthand
        pos = 0;
        for (uint8_t i = 0; i < 8 && pos < (int)sizeof(out.brand) - 2; i++) {
            pos += snprintf(out.brand + pos, sizeof(out.brand) - pos, "%02X", blockData[1][i]);
        }
    }

    // --- Sector 3: Production date, filament length ---
    if (readSector(reader, uid, uidLen, 3, keys.keyA[3], blockData) >= 3) {
        // Block 12 [0:15] = production date (e.g. "2025_11_22_00_48")
        copyBlockString(out.production_date, sizeof(out.production_date), blockData[0], 16);

        // Block 14 [4:5] = filament length (m)
        out.filament_length_m = readU16LE(&blockData[2][4]);
    }

    // --- Sector 4: Multi-color data ---
    if (readSector(reader, uid, uidLen, 4, keys.keyA[4], blockData) >= 1) {
        // Block 16 = multi-color format info
        memcpy(out.multicolor_data, blockData[0], 16);
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
    // Manufacturer chip data (block 0 bytes 4-15)
    Serial.printf("  Mfr data:    ");
    for (uint8_t i = 0; i < 12; i++) {
        Serial.printf("%02X", info.mfr_data[i]);
    }
    Serial.println();
    // X-cam parsed fields
    if (info.xcam_a || info.xcam_b || info.xcam_c || info.xcam_d) {
        Serial.printf("  X-cam:       %u, %u, %u, %u, %.4f, %.4f\n",
            info.xcam_a, info.xcam_b, info.xcam_c, info.xcam_d,
            info.xcam_e, info.xcam_f);
    }
    // Multi-color data (sector 4 block 16)
    bool hasMC = false;
    for (uint8_t i = 0; i < 16; i++) { if (info.multicolor_data[i]) { hasMC = true; break; } }
    if (hasMC) {
        Serial.printf("  Multicolor:  ");
        for (uint8_t i = 0; i < 16; i++) Serial.printf("%02X", info.multicolor_data[i]);
        Serial.println();
    }
}
