#pragma once

#include <Arduino.h>

// ============================================================
// Filla IQ — Filament & Spool Data Structures
// ============================================================

#define NFC_UID_LEN     7
#define MAX_NAME_LEN    32
#define MAX_BRAND_LEN   24
#define MAX_MATERIAL_LEN 12
#define MAX_VARIANT_ID_LEN 16
#define MAX_MATERIAL_ID_LEN 16
#define MAX_TRAY_UID_LEN 33    // 16 bytes as hex + null
#define MAX_PROD_DATE_LEN 20   // "2025_11_22_00_48" + null

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

// --- Filament Info (from NFC tag or web service) ---
struct FilamentInfo {
    // Core identity
    char     name[MAX_NAME_LEN];       // e.g. "PLA Basic" (sector 1 block 4)
    char     brand[MAX_BRAND_LEN];     // e.g. "Hatchbox" (or tray UID hex for Bambu)
    char     material[MAX_MATERIAL_LEN]; // e.g. "PLA" (sector 0 block 2)

    // Bambu-specific IDs
    char     variant_id[MAX_VARIANT_ID_LEN];   // e.g. "A00-K00" (sector 0 block 1 [0:7])
    char     material_id[MAX_MATERIAL_ID_LEN]; // e.g. "GFA00" (sector 0 block 1 [8:15])
    char     tray_uid[MAX_TRAY_UID_LEN];       // 16-byte tray UID as hex (sector 2 block 9)
    char     production_date[MAX_PROD_DATE_LEN]; // e.g. "2025_11_22_00_48" (sector 3 block 12)

    // Color
    uint8_t  color_r;
    uint8_t  color_g;
    uint8_t  color_b;
    uint8_t  color_a;                  // Alpha (usually 0xFF)

    // Temperatures
    uint16_t nozzle_temp_min;          // Min nozzle temp (C)
    uint16_t nozzle_temp_max;          // Max nozzle temp (C)
    uint16_t bed_temp;                 // Recommended bed temp (C)
    uint16_t drying_temp;              // Drying temp (C) (sector 1 block 6 [0:1])
    uint16_t drying_time;              // Drying time (hrs) (sector 1 block 6 [2:3])

    // Physical
    float    spool_net_weight;         // Full spool net filament weight (g)
    float    filament_diameter;        // Filament diameter (mm) (sector 1 block 5 [8:11])
    uint16_t filament_length_m;        // Filament length (m) (sector 3 block 14 [4:5])

    // MIFARE block 0 — manufacturer/chip data (bytes 4-15)
    uint8_t  mfr_data[12];

    // X-cam info (sector 2 block 8) — purpose TBD
    uint16_t xcam_a;                   // bytes 0-1
    uint16_t xcam_b;                   // bytes 2-3
    uint16_t xcam_c;                   // bytes 4-5
    uint16_t xcam_d;                   // bytes 6-7
    float    xcam_e;                   // bytes 8-11
    float    xcam_f;                   // bytes 12-15

    // Sector 4 multi-color info (block 16, raw 16 bytes)
    uint8_t  multicolor_data[16];

    bool     valid;                    // Has this been populated?

    void clear() {
        memset(name, 0, sizeof(name));
        memset(brand, 0, sizeof(brand));
        memset(material, 0, sizeof(material));
        memset(variant_id, 0, sizeof(variant_id));
        memset(material_id, 0, sizeof(material_id));
        memset(tray_uid, 0, sizeof(tray_uid));
        memset(production_date, 0, sizeof(production_date));
        color_r = color_g = color_b = 0;
        color_a = 0xFF;
        nozzle_temp_min = nozzle_temp_max = bed_temp = 0;
        drying_temp = drying_time = 0;
        spool_net_weight = 1000.0f;
        filament_diameter = 1.75f;
        filament_length_m = 0;
        memset(mfr_data, 0, sizeof(mfr_data));
        xcam_a = xcam_b = xcam_c = xcam_d = 0;
        xcam_e = xcam_f = 0.0f;
        memset(multicolor_data, 0, sizeof(multicolor_data));
        valid = false;
    }
};

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

    // Filament info (populated from tag/service)
    FilamentInfo filament;

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
        filament.clear();
        state_entered_at = millis();
        last_display_update = 0;
    }
};
