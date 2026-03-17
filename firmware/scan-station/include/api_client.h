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
    char sessionId[64];     // Session for accumulating multi-scan data

    // Display fields (from server-side NFC parsing + color conversion)
    char material[16];      // e.g. "PLA" (from nfcParsedData.material)
    uint8_t colorR, colorG, colorB;  // From nfcParsedData or colorHex
    uint16_t nozzleTempMin; // From nfcParsedData
    uint16_t nozzleTempMax;
    uint16_t bedTemp;
    char nfcTagFormat[20];  // "bambu_mifare", "ntag", etc.
    char colorHex[8];       // "#RRGGBB" from spectral conversion

    void clear() {
        identified = false;
        confidence = 0;
        memset(itemType, 0, sizeof(itemType));
        memset(itemName, 0, sizeof(itemName));
        memset(suggestion, 0, sizeof(suggestion));
        needsCamera = false;
        memset(scanId, 0, sizeof(scanId));
        memset(sessionId, 0, sizeof(sessionId));
        memset(material, 0, sizeof(material));
        colorR = colorG = colorB = 0;
        nozzleTempMin = nozzleTempMax = bedTemp = 0;
        memset(nfcTagFormat, 0, sizeof(nfcTagFormat));
        memset(colorHex, 0, sizeof(colorHex));
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

struct PrinterInfo {
    bool detected = false;
    char model[32] = {0};           // e.g. "Niimbot B21", "Niimbot D110"
    char connection[8] = {0};       // "USB", "BLE", or "BOTH"
    int labelWidthMm = 0;           // Max label width in mm
    int labelHeightMm = 0;          // Max label height in mm
    int dpi = 0;                    // Print resolution
    char protocol[16] = {0};        // "niimbot", "escpos", etc.
    uint16_t usbVid = 0;           // USB vendor ID
    uint16_t usbPid = 0;           // USB product ID
    char bleAddr[18] = {0};        // BLE MAC address if connected via BLE

    void set(const char* m, const char* conn, int w, int h, int res = 203, const char* proto = "escpos") {
        detected = true;
        strncpy(model, m, sizeof(model) - 1);
        strncpy(connection, conn, sizeof(connection) - 1);
        labelWidthMm = w;
        labelHeightMm = h;
        dpi = res;
        strncpy(protocol, proto, sizeof(protocol) - 1);
    }

    void setUsb(uint16_t vid, uint16_t pid) {
        usbVid = vid;
        usbPid = pid;
    }

    void setBle(const char* addr) {
        strncpy(bleAddr, addr, sizeof(bleAddr) - 1);
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
    SensorInfo touch;
    SensorInfo sdCard;
    SensorInfo audio;
    SensorInfo battery;
    PrinterInfo printer;
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
    String buildCapabilitiesJson() const;
    bool hasNfc() const { return _capabilities.nfc.detected; }
    bool hasScale() const { return _capabilities.scale.detected; }
    bool hasTof() const { return _capabilities.tof.detected; }
    bool hasColor() const { return _capabilities.colorSensor.detected; }
    bool hasTurntable() const { return _capabilities.turntable; }
    bool hasCamera() const { return _capabilities.camera; }
    bool hasEnv() const { return _capabilities.environment.detected; }
    bool hasPrinter() const { return _capabilities.printer.detected; }

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
