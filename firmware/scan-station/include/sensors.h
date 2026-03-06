#pragma once

#include <Arduino.h>

// ============================================================
// Filla IQ — Scan Station Sensor Data Structures
// ============================================================

// --- Color Sensor Type (auto-detected at runtime) ---
enum ColorSensorType : uint8_t {
    COLOR_NONE = 0,
    COLOR_AS7341,       // 11-channel spectral (8 vis + clear + NIR + flicker)
    COLOR_AS7265X,      // 18-channel spectral (UV + VIS + NIR, 3 sensors)
    COLOR_TCS34725,     // 4-channel RGBC
    COLOR_OPT4048,      // 4-channel CIE XYZ + lux
};

// --- Color Data (unified across all sensor types) ---
struct ColorData {
    ColorSensorType sensorType;

    // AS7341 — 11 channels (8 spectral + clear + NIR)
    uint16_t f1_415nm;   // Violet
    uint16_t f2_445nm;   // Indigo
    uint16_t f3_480nm;   // Blue
    uint16_t f4_515nm;   // Cyan
    uint16_t f5_555nm;   // Green
    uint16_t f6_590nm;   // Yellow
    uint16_t f7_630nm;   // Orange
    uint16_t f8_680nm;   // Red
    uint16_t clear;
    uint16_t nir;

    // AS7265x — 18 channels (adds UV + extended NIR)
    // Channels A-R covering 410nm–940nm
    uint16_t channels[18];  // Raw values, indexed by channel
    uint8_t  channelCount;  // How many channels actually populated

    // TCS34725 — RGBC
    uint16_t rgbc_r, rgbc_g, rgbc_b, rgbc_c;
    uint16_t colorTemp;     // Calculated CCT (Kelvin)
    uint16_t lux;

    // OPT4048 — CIE XYZ native
    float cie_x, cie_y, cie_z;
    float opt_lux;

    bool valid;

    void clear_data() {
        sensorType = COLOR_NONE;
        f1_415nm = f2_445nm = f3_480nm = f4_515nm = 0;
        f5_555nm = f6_590nm = f7_630nm = f8_680nm = 0;
        clear = nir = 0;
        memset(channels, 0, sizeof(channels));
        channelCount = 0;
        rgbc_r = rgbc_g = rgbc_b = rgbc_c = 0;
        colorTemp = lux = 0;
        cie_x = cie_y = cie_z = opt_lux = 0;
        valid = false;
    }
};

// --- TOF Distance Data (VL53L1X) ---
struct DistanceData {
    float distanceMm;       // Raw distance from sensor to object
    float objectHeightMm;   // Calculated: armHeight - distance
    bool valid;

    void clear_data() {
        distanceMm = 0;
        objectHeightMm = 0;
        valid = false;
    }
};

// --- Weight Data ---
struct WeightData {
    float grams;
    bool stable;
    bool valid;

    void clear_data() {
        grams = 0;
        stable = false;
        valid = false;
    }
};

// --- Turntable State ---
struct TurntableData {
    float angleDeg;         // Current rotation angle (0-360)
    bool  homed;            // Has been homed via hall sensor
    bool  spinning;         // Currently rotating

    void clear_data() {
        angleDeg = 0;
        homed = false;
        spinning = false;
    }
};

// --- Scan Station State Machine ---
enum ScanState : uint8_t {
    SCAN_IDLE = 0,          // Nothing on platform
    SCAN_DETECTED,          // Object detected (weight threshold crossed)
    SCAN_READING,           // Reading sensors (NFC, color, height)
    SCAN_ROTATING,          // Turntable rotating for multi-angle scan
    SCAN_POSTING,           // Sending data to server
    SCAN_AWAITING_RESULT,   // Waiting for server identification
    SCAN_IDENTIFIED,        // Object identified (green LED)
    SCAN_NEEDS_INPUT,       // Needs user camera/input (yellow LED)
};

inline const char* scanStateName(ScanState s) {
    switch (s) {
        case SCAN_IDLE:             return "Idle";
        case SCAN_DETECTED:         return "Detected";
        case SCAN_READING:          return "Reading sensors...";
        case SCAN_ROTATING:         return "Rotating...";
        case SCAN_POSTING:          return "Posting to server...";
        case SCAN_AWAITING_RESULT:  return "Awaiting result...";
        case SCAN_IDENTIFIED:       return "Identified";
        case SCAN_NEEDS_INPUT:      return "Needs input";
        default:                    return "???";
    }
}

// --- Complete Scan Result (all sensor data for one scan) ---
struct ScanResult {
    WeightData weight;
    ColorData color;
    DistanceData height;
    TurntableData turntable;

    // NFC (references external TagData/FilamentInfo)
    bool nfcPresent;
    char nfcUid[22];        // "04:A2:B3:C4:D5:E6:F7\0"
    uint8_t nfcUidLen;
    uint8_t nfcTagType;     // TagType enum value

    unsigned long timestamp;

    void clear_data() {
        weight.clear_data();
        color.clear_data();
        height.clear_data();
        turntable.clear_data();
        nfcPresent = false;
        memset(nfcUid, 0, sizeof(nfcUid));
        nfcUidLen = 0;
        nfcTagType = 0;
        timestamp = 0;
    }
};
