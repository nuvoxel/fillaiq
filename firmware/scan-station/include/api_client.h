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

    // Device pairing
    ApiStatus requestPairingCode(char* codeOut, size_t codeLen);
    ApiStatus pollPairingStatus(bool& paired);
    bool isPaired() const { return _deviceToken[0] != '\0' && _paired; }
    const char* getPairingCode() const { return _pairingCode; }

    // Config (stored in NVS)
    void setApiUrl(const char* url);
    void setApiKey(const char* key);
    void setStationId(const char* id);

    bool hasApiUrl() const { return _apiUrl[0] != '\0'; }
    void printStatus();

private:
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
