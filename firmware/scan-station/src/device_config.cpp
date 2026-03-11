#include "device_config.h"
#include <ArduinoJson.h>
#include <Preferences.h>

DeviceConfigManager deviceConfig;

static Preferences configPrefs;

void DeviceConfigManager::begin() {
    load();
    Serial.printf("  Config: env=%lus ota=%lus cal=%.4f\n",
        _config.envReportIntervalMs / 1000,
        _config.otaCheckIntervalMs / 1000,
        _config.weightCalibration);
}

void DeviceConfigManager::applyFromJson(const char* json) {
    JsonDocument doc;
    if (deserializeJson(doc, json)) return;

    // Only apply fields that are present in the response
    bool changed = false;

    if (doc.containsKey("envReportIntervalMs")) {
        _config.envReportIntervalMs = doc["envReportIntervalMs"].as<unsigned long>();
        changed = true;
    }
    if (doc.containsKey("statusIntervalMs")) {
        _config.statusIntervalMs = doc["statusIntervalMs"].as<unsigned long>();
        changed = true;
    }
    if (doc.containsKey("weightCalibration")) {
        _config.weightCalibration = doc["weightCalibration"].as<float>();
        changed = true;
    }
    if (doc.containsKey("weightStableThreshold")) {
        _config.weightStableThreshold = doc["weightStableThreshold"].as<float>();
        changed = true;
    }
    if (doc.containsKey("weightStableCount")) {
        _config.weightStableCount = doc["weightStableCount"].as<int>();
        changed = true;
    }
    if (doc.containsKey("otaCheckIntervalMs")) {
        _config.otaCheckIntervalMs = doc["otaCheckIntervalMs"].as<unsigned long>();
        changed = true;
    }
    if (doc.containsKey("displayBrightness")) {
        _config.displayBrightness = doc["displayBrightness"].as<uint8_t>();
        changed = true;
    }
    if (doc.containsKey("ledBrightness")) {
        _config.ledBrightness = doc["ledBrightness"].as<uint8_t>();
        changed = true;
    }

    if (changed) {
        Serial.println("[Config] Updated from server");
        save();
    }
}

void DeviceConfigManager::save() {
    configPrefs.begin("dev-cfg", false);
    configPrefs.putULong("envInterval", _config.envReportIntervalMs);
    configPrefs.putULong("statusInterval", _config.statusIntervalMs);
    configPrefs.putFloat("weightCal", _config.weightCalibration);
    configPrefs.putFloat("weightThresh", _config.weightStableThreshold);
    configPrefs.putInt("weightStable", _config.weightStableCount);
    configPrefs.putULong("otaInterval", _config.otaCheckIntervalMs);
    configPrefs.putUChar("dispBright", _config.displayBrightness);
    configPrefs.putUChar("ledBright", _config.ledBrightness);
    configPrefs.end();
}

void DeviceConfigManager::load() {
    configPrefs.begin("dev-cfg", true);
    _config.envReportIntervalMs = configPrefs.getULong("envInterval", DEFAULT_ENV_REPORT_INTERVAL_MS);
    _config.statusIntervalMs = configPrefs.getULong("statusInterval", 2000);
    _config.weightCalibration = configPrefs.getFloat("weightCal", WEIGHT_CALIBRATION);
    _config.weightStableThreshold = configPrefs.getFloat("weightThresh", WEIGHT_STABLE_THRESHOLD);
    _config.weightStableCount = configPrefs.getInt("weightStable", WEIGHT_STABLE_COUNT);
    _config.otaCheckIntervalMs = configPrefs.getULong("otaInterval", OTA_CHECK_INTERVAL_MS);
    _config.displayBrightness = configPrefs.getUChar("dispBright", 255);
    _config.ledBrightness = configPrefs.getUChar("ledBright", 50);
    configPrefs.end();
}

void DeviceConfigManager::printStatus() {
    Serial.println("--- Device Config ---");
    Serial.printf("  Env report: %lus\n", _config.envReportIntervalMs / 1000);
    Serial.printf("  Status interval: %lus\n", _config.statusIntervalMs / 1000);
    Serial.printf("  Weight cal: %.4f  threshold: %.1fg  stable count: %d\n",
        _config.weightCalibration, _config.weightStableThreshold, _config.weightStableCount);
    Serial.printf("  OTA check: %lus\n", _config.otaCheckIntervalMs / 1000);
    Serial.printf("  Display brightness: %d  LED brightness: %d\n",
        _config.displayBrightness, _config.ledBrightness);
}
