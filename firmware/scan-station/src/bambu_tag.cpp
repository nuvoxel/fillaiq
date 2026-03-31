#include "bambu_tag.h"
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

// Bambu-specific NFC parsing removed — now handled server-side.
// See web/src/lib/services/nfc-parser.ts
// PN532 MIFARE/NTAG reading removed — PN5180 via Pico handles all tag I/O.
