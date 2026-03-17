#include "bambu_tag.h"
#ifndef BOARD_SCAN_TOUCH
#include <Adafruit_PN532.h>
#endif
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

// ==================== MIFARE Helpers (PN532 only) ====================
#ifndef BOARD_SCAN_TOUCH

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
        // Skip sectors already successfully read
        if (out.sector_ok[s]) continue;

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

#endif // !BOARD_SCAN_TOUCH

// Bambu-specific NFC parsing removed — now handled server-side.
// See web/src/lib/services/nfc-parser.ts
