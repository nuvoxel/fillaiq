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

// --- Slot State Machine ---
enum SlotState : uint8_t {
    SLOT_EMPTY = 0,       // No spool detected (no weight)
    SLOT_DETECTING,       // Weight detected, reading NFC tag...
    SLOT_ACTIVE,          // Spool identified — tag read + weight stable
    SLOT_UNKNOWN_SPOOL,   // Weight present but no/unrecognized NFC tag
    SLOT_REMOVED,         // Spool was just removed (transitional)
    SLOT_ERROR            // Sensor error
};

// Human-readable state names for serial/display
inline const char* slotStateName(SlotState s) {
    switch (s) {
        case SLOT_EMPTY:         return "Empty";
        case SLOT_DETECTING:     return "Detecting...";
        case SLOT_ACTIVE:        return "Active";
        case SLOT_UNKNOWN_SPOOL: return "Unknown Spool";
        case SLOT_REMOVED:       return "Removed";
        case SLOT_ERROR:         return "Error";
        default:                 return "???";
    }
}

// FilamentInfo removed — NFC parsing now happens server-side.
// Display uses ScanResponse fields from the API.

// --- Spool Status (runtime state for one slot) ---
struct SpoolStatus {
    SlotState state;

    // NFC tag
    uint8_t  nfc_uid[NFC_UID_LEN];
    uint8_t  nfc_uid_len;
    bool     nfc_present;
    unsigned long nfc_last_seen;

    // Weight
    float    weight_raw;             // Latest raw reading (g)
    float    weight_stable;          // Last confirmed stable reading (g)
    bool     weight_is_stable;
    float    weight_on_load;         // Weight when spool was first placed
    uint8_t  percent_remaining;      // 0-100

    // Timing
    unsigned long state_entered_at;
    unsigned long last_display_update;

    void clear() {
        state = SLOT_EMPTY;
        memset(nfc_uid, 0, sizeof(nfc_uid));
        nfc_uid_len = 0;
        nfc_present = false;
        nfc_last_seen = 0;
        weight_raw = 0;
        weight_stable = 0;
        weight_is_stable = false;
        weight_on_load = 0;
        percent_remaining = 0;
        state_entered_at = millis();
        last_display_update = 0;
    }
};
