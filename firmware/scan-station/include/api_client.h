#pragma once

#include <Arduino.h>
#include "scan_config.h"
#include "sensors.h"
#include "filament_data.h"

// ============================================================
// Filla IQ — Scan Station HTTP API Client
// Posts sensor data to web app, polls for identification result.
// ============================================================

enum ApiStatus : uint8_t {
    API_OK = 0,
    API_NO_WIFI,
    API_CONNECT_FAILED,
    API_TIMEOUT,
    API_HTTP_ERROR,
    API_PARSE_ERROR,
    API_AUTH_FAILED,
    API_EXPIRED,
};

struct ScanResponse {
    bool identified;
    float confidence;
    char itemType[32];      // "filament", "bolt", "electronic", etc.
    char itemName[128];     // "Bambu PLA Basic - Black"
    char suggestion[256];   // AI suggestion text
    bool needsCamera;       // Server wants a photo
    char scanId[64];        // Server-assigned scan ID for follow-up

    void clear() {
        identified = false;
        confidence = 0;
        memset(itemType, 0, sizeof(itemType));
        memset(itemName, 0, sizeof(itemName));
        memset(suggestion, 0, sizeof(suggestion));
        needsCamera = false;
        memset(scanId, 0, sizeof(scanId));
    }
};

struct SensorInfo {
    bool detected = false;
    char chip[24] = {0};        // e.g. "PN532", "HX711", "VL53L1X", "AS7341"
    char interface[8] = {0};    // "SPI", "I2C", "GPIO"
    uint8_t i2cAddr = 0;        // I2C address (0 if not I2C)
    int pin1 = -1;              // CS pin (SPI) or SCK (GPIO)
    int pin2 = -1;              // DT pin (GPIO) or -1

    void set(const char* c, const char* iface, uint8_t addr = 0, int p1 = -1, int p2 = -1) {
        detected = true;
        strncpy(chip, c, sizeof(chip) - 1);
        strncpy(interface, iface, sizeof(interface) - 1);
        i2cAddr = addr;
        pin1 = p1;
        pin2 = p2;
    }
};

struct DeviceCapabilities {
    SensorInfo nfc;
    SensorInfo scale;
    SensorInfo tof;
    SensorInfo colorSensor;
    SensorInfo display;
    SensorInfo leds;
    SensorInfo environment;
    bool turntable = false;
    bool camera = false;
};

class ApiClient {
public:
    void begin();

    // WiFi
    bool connectWiFi();
    bool isWiFiConnected();
    void setCredentials(const char* ssid, const char* password);

    // API
    ApiStatus postScan(const ScanResult& scan, const TagData* tagData, ScanResponse& response);
    ApiStatus pollResult(const char* scanId, ScanResponse& response);
    void postEnvironment(const struct EnvData& env);

    // Device pairing
    ApiStatus requestPairingCode(char* codeOut, size_t codeLen);
    ApiStatus pollPairingStatus(bool& paired);
    bool isPaired() const { return _deviceToken[0] != '\0' && _paired; }
    const char* getPairingCode() const { return _pairingCode; }
    void unpair();

    // Config (stored in NVS)
    void setApiUrl(const char* url);
    void setApiKey(const char* key);
    void setStationId(const char* id);

    bool hasApiUrl() const { return _apiUrl[0] != '\0'; }
    const char* getApiUrl() const { return _apiUrl; }
    const char* getDeviceToken() const { return _deviceToken; }
    const char* getStationId() const { return _stationId; }
    // Device capabilities
    void setCapabilities(const DeviceCapabilities& caps);
    const DeviceCapabilities& getCapabilities() const { return _capabilities; }
    bool hasNfc() const { return _capabilities.nfc.detected; }
    bool hasScale() const { return _capabilities.scale.detected; }
    bool hasTof() const { return _capabilities.tof.detected; }
    bool hasColor() const { return _capabilities.colorSensor.detected; }
    bool hasTurntable() const { return _capabilities.turntable; }
    bool hasCamera() const { return _capabilities.camera; }
    bool hasEnv() const { return _capabilities.environment.detected; }

    void printStatus();

private:
    DeviceCapabilities _capabilities;
    char _ssid[64];
    char _password[64];
    char _apiUrl[256];
    char _apiKey[128];
    char _stationId[32];
    char _deviceToken[128];
    char _pairingCode[12];
    bool _wifiConfigured;
    bool _paired;

    void loadConfig();
    void saveConfig();
    String buildScanPayload(const ScanResult& scan, const TagData* tagData);
    bool parseResponse(const String& json, ScanResponse& response);
};

extern ApiClient apiClient;
