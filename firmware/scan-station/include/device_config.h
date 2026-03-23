#pragma once
#include <Arduino.h>
#include "scan_config.h"

// Device configuration pushed from server via heartbeat
// Stored in NVS, applied on receipt
struct DeviceConfig {
    // Reporting
    unsigned long envReportIntervalMs = DEFAULT_ENV_REPORT_INTERVAL_MS;
    unsigned long statusIntervalMs = DEFAULT_STATUS_INTERVAL_MS;

    // Weight
    float weightCalibration = WEIGHT_CALIBRATION;
    float weightStableThreshold = WEIGHT_STABLE_THRESHOLD;
    int weightStableCount = WEIGHT_STABLE_COUNT;

    // OTA
    unsigned long otaCheckIntervalMs = OTA_CHECK_INTERVAL_MS;

    // Display
    uint8_t displayBrightness = 255;  // 0-255
    uint8_t ledBrightness = 50;       // 0-255

    // Audio
    uint8_t audioVolume = 70;   // 0-100 (0 = mute)
};

class DeviceConfigManager {
public:
    void begin();  // Load from NVS
    void applyFromJson(const char* json);  // Parse server response and apply
    const DeviceConfig& get() const { return _config; }

    // Convenience accessors
    unsigned long envReportInterval() const { return _config.envReportIntervalMs; }
    unsigned long statusInterval() const { return _config.statusIntervalMs; }
    float weightCalibration() const { return _config.weightCalibration; }
    unsigned long otaCheckInterval() const { return _config.otaCheckIntervalMs; }
    uint8_t displayBrightness() const { return _config.displayBrightness; }
    uint8_t ledBrightness() const { return _config.ledBrightness; }
    uint8_t audioVolume() const { return _config.audioVolume; }

    void setWeightCalibration(float factor);  // Update from local calibration
    void printStatus();

private:
    DeviceConfig _config;
    void save();  // Persist to NVS
    void load();  // Load from NVS
};

extern DeviceConfigManager deviceConfig;
