#pragma once

#include <Arduino.h>

// ============================================================
// Filla IQ — Filament & Spool Data Structures
// ============================================================

#define NFC_UID_LEN     7

// --- NFC Tag Type ---
enum TagType : uint8_t {
    TAG_UNKNOWN = 0,
    TAG_MIFARE_CLASSIC,    // 4-byte UID, sector-based (Bambu, Creality, etc.)
    TAG_NTAG,              // 7-byte UID, page-based (NTAG213/215/216, Ultralight)
    TAG_ISO15693,          // 8-byte UID, block-based (ICODE SLIX, etc.)
};

inline const char* tagTypeName(TagType t) {
    switch (t) {
        case TAG_MIFARE_CLASSIC: return "MIFARE Classic";
        case TAG_NTAG:           return "NTAG";
        case TAG_ISO15693:       return "ISO15693";
        default:                 return "Unknown";
    }
}

// --- Raw Tag Data (sent to web service for identification/parsing) ---
struct TagData {
    TagType  type;
    uint8_t  uid[8];    // 8 bytes for ISO 15693 UIDs
    uint8_t  uid_len;
    bool     valid;         // At least some data was read

    // MIFARE Classic: all 16 sectors, 3 data blocks × 16 bytes each
    static const uint8_t NUM_SECTORS = 16;
    uint8_t  sector_data[NUM_SECTORS][3][16];  // [sector][block][byte]
    bool     sector_ok[NUM_SECTORS];           // Per-sector auth+read success
    uint8_t  sectors_read;                      // Count of successful sectors

    // NTAG: raw page data
    // NTAG213=45 pages, NTAG215=135, NTAG216=231
    static const uint8_t MAX_PAGES = 231;
    uint8_t  page_data[MAX_PAGES][4];           // 4 bytes per page
    uint8_t  pages_read;

    void clear() {
        type = TAG_UNKNOWN;
        memset(uid, 0, sizeof(uid));
        uid_len = 0;
        valid = false;
        memset(sector_data, 0, sizeof(sector_data));
        memset(sector_ok, 0, sizeof(sector_ok));
        sectors_read = 0;
        memset(page_data, 0, sizeof(page_data));
        pages_read = 0;
    }
};

// FilamentInfo removed — NFC parsing now happens server-side.
// Display uses ScanResponse fields from the API.
// SlotState/SpoolStatus removed — those are FillaShelf concepts, not FillaScan.
