#include "api_client.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "bambu_tag.h"

ApiClient apiClient;

static Preferences prefs;
static WiFiClientSecure& getSecureClient() {
    static WiFiClientSecure client;
    static bool init = false;
    if (!init) { client.setInsecure(); init = true; }
    client.stop();  // Ensure clean state for each request
    return client;
}

void ApiClient::begin() {
    memset(_ssid, 0, sizeof(_ssid));
    memset(_password, 0, sizeof(_password));
    memset(_apiUrl, 0, sizeof(_apiUrl));
    memset(_apiKey, 0, sizeof(_apiKey));
    memset(_stationId, 0, sizeof(_stationId));
    memset(_deviceToken, 0, sizeof(_deviceToken));
    memset(_pairingCode, 0, sizeof(_pairingCode));
    _wifiConfigured = false;
    _paired = false;

    loadConfig();

    // If we have a device token, we may already be paired
    if (_deviceToken[0] != '\0') {
        _paired = true;  // Assume paired if we have a saved token
    }

    if (_ssid[0] != '\0') {
        _wifiConfigured = true;
        Serial.printf("  WiFi: SSID=%s\n", _ssid);
    } else {
        Serial.println("  WiFi: not configured (use 'wifi <ssid> <pass>' command)");
    }

    if (_apiUrl[0] == '\0') {
        strncpy(_apiUrl, DEFAULT_API_URL, sizeof(_apiUrl) - 1);
    }
    Serial.printf("  API: %s\n", _apiUrl);

    if (_stationId[0] == '\0') {
        // Generate from MAC address
        uint8_t mac[6];
        WiFi.macAddress(mac);
        snprintf(_stationId, sizeof(_stationId), "scan-%02X%02X%02X",
            mac[3], mac[4], mac[5]);
    }
    Serial.printf("  Station ID: %s\n", _stationId);
}

bool ApiClient::connectWiFi() {
    if (!_wifiConfigured) return false;
    if (WiFi.status() == WL_CONNECTED) return true;

    Serial.printf("Connecting to WiFi: %s...\n", _ssid);
    WiFi.begin(_ssid, _password);

    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED &&
           millis() - start < WIFI_CONNECT_TIMEOUT_MS) {
        delay(250);
    }

    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("  WiFi connected: %s\n", WiFi.localIP().toString().c_str());
        return true;
    }

    Serial.println("  WiFi connection failed");
    return false;
}

bool ApiClient::isWiFiConnected() {
    return WiFi.status() == WL_CONNECTED;
}

void ApiClient::setCredentials(const char* ssid, const char* password) {
    strncpy(_ssid, ssid, sizeof(_ssid) - 1);
    strncpy(_password, password, sizeof(_password) - 1);
    _wifiConfigured = true;
    saveConfig();
}

void ApiClient::setApiUrl(const char* url) {
    strncpy(_apiUrl, url, sizeof(_apiUrl) - 1);
    saveConfig();
}

void ApiClient::setApiKey(const char* key) {
    strncpy(_apiKey, key, sizeof(_apiKey) - 1);
    saveConfig();
}

void ApiClient::setStationId(const char* id) {
    strncpy(_stationId, id, sizeof(_stationId) - 1);
    saveConfig();
}

void ApiClient::setCapabilities(const DeviceCapabilities& caps) {
    _capabilities = caps;
}

// ==================== API Calls ====================

ApiStatus ApiClient::postScan(const ScanResult& scan, const TagData* tagData,
                               ScanResponse& response) {
    response.clear();

    if (!isWiFiConnected()) return API_NO_WIFI;
    if (_apiUrl[0] == '\0') return API_CONNECT_FAILED;

    String url = String(_apiUrl) + "/api/v1/scan";
    String payload = buildScanPayload(scan, tagData);

    HTTPClient http;
    http.begin(getSecureClient(), url);
    http.addHeader("Content-Type", "application/json");
    if (_deviceToken[0] != '\0') {
        http.addHeader("X-Device-Token", _deviceToken);
    } else if (_apiKey[0] != '\0') {
        http.addHeader("X-API-Key", _apiKey);
    }
    http.setTimeout(API_TIMEOUT_MS);

    int httpCode = http.POST(payload);

    if (httpCode <= 0) {
        http.end();
        return API_CONNECT_FAILED;
    }

    if (httpCode == 401 || httpCode == 403) {
        Serial.printf("API auth failed: HTTP %d\n", httpCode);
        http.end();
        return API_AUTH_FAILED;
    }

    if (httpCode != 200 && httpCode != 201) {
        Serial.printf("API error: HTTP %d\n", httpCode);
        http.end();
        return API_HTTP_ERROR;
    }

    String body = http.getString();
    http.end();

    if (!parseResponse(body, response)) {
        return API_PARSE_ERROR;
    }

    return API_OK;
}

ApiStatus ApiClient::pollResult(const char* scanId, ScanResponse& response) {
    response.clear();

    if (!isWiFiConnected()) return API_NO_WIFI;
    if (_apiUrl[0] == '\0') return API_CONNECT_FAILED;

    String url = String(_apiUrl) + "/api/v1/scan/" + scanId + "/status";

    HTTPClient http;
    http.begin(getSecureClient(), url);
    if (_deviceToken[0] != '\0') {
        http.addHeader("X-Device-Token", _deviceToken);
    } else if (_apiKey[0] != '\0') {
        http.addHeader("X-API-Key", _apiKey);
    }
    http.setTimeout(API_TIMEOUT_MS);

    int httpCode = http.GET();

    if (httpCode <= 0) {
        http.end();
        return API_CONNECT_FAILED;
    }

    if (httpCode == 401 || httpCode == 403) {
        http.end();
        return API_AUTH_FAILED;
    }

    if (httpCode != 200) {
        http.end();
        return API_HTTP_ERROR;
    }

    String body = http.getString();
    http.end();

    if (!parseResponse(body, response)) {
        return API_PARSE_ERROR;
    }

    return API_OK;
}

// ==================== Payload Building ====================

String ApiClient::buildScanPayload(const ScanResult& scan, const TagData* tagData) {
    JsonDocument doc;

    doc["stationId"] = _stationId;

    // Weight
    if (scan.weight.valid) {
        JsonObject w = doc["weight"].to<JsonObject>();
        w["grams"] = scan.weight.grams;
        w["stable"] = scan.weight.stable;
    }

    // NFC
    if (scan.nfcPresent && tagData) {
        JsonObject nfc = doc["nfc"].to<JsonObject>();
        nfc["present"] = true;
        nfc["uid"] = scan.nfcUid;
        nfc["uidLength"] = scan.nfcUidLen;
        nfc["tagType"] = scan.nfcTagType;

        // Base64 encode raw tag data
        if (tagData->valid) {
            if (tagData->type == TAG_MIFARE_CLASSIC) {
                // Encode sector data as hex string
                String hexData;
                for (int s = 0; s < tagData->sectors_read; s++) {
                    for (int b = 0; b < 3; b++) {
                        for (int i = 0; i < 16; i++) {
                            char hex[3];
                            snprintf(hex, 3, "%02X", tagData->sector_data[s][b][i]);
                            hexData += hex;
                        }
                    }
                }
                nfc["rawData"] = hexData;
                nfc["sectorsRead"] = tagData->sectors_read;
            } else if (tagData->type == TAG_NTAG) {
                String hexData;
                for (int p = 0; p < tagData->pages_read; p++) {
                    for (int i = 0; i < 4; i++) {
                        char hex[3];
                        snprintf(hex, 3, "%02X", tagData->page_data[p][i]);
                        hexData += hex;
                    }
                }
                nfc["rawData"] = hexData;
                nfc["pagesRead"] = tagData->pages_read;
            }
        }
    }

    // Color sensor data (any sensor type)
    if (scan.color.valid) {
        JsonObject c = doc["color"].to<JsonObject>();
        const char* sensorNames[] = {"none", "as7341", "as7265x", "tcs34725", "opt4048"};
        c["sensor"] = sensorNames[scan.color.sensorType];
        c["channelCount"] = scan.color.channelCount;

        // Raw channel array (unified across all sensor types)
        JsonArray ch = c["channels"].to<JsonArray>();
        for (int i = 0; i < scan.color.channelCount; i++) {
            ch.add(scan.color.channels[i]);
        }

        // Sensor-specific named fields
        if (scan.color.sensorType == COLOR_AS7341 || scan.color.sensorType == COLOR_AS7265X) {
            c["f1_415nm"] = scan.color.f1_415nm;
            c["f2_445nm"] = scan.color.f2_445nm;
            c["f3_480nm"] = scan.color.f3_480nm;
            c["f4_515nm"] = scan.color.f4_515nm;
            c["f5_555nm"] = scan.color.f5_555nm;
            c["f6_590nm"] = scan.color.f6_590nm;
            c["f7_630nm"] = scan.color.f7_630nm;
            c["f8_680nm"] = scan.color.f8_680nm;
            c["clear"] = scan.color.clear;
            c["nir"] = scan.color.nir;
        }
        if (scan.color.sensorType == COLOR_TCS34725) {
            c["r"] = scan.color.rgbc_r;
            c["g"] = scan.color.rgbc_g;
            c["b"] = scan.color.rgbc_b;
            c["c"] = scan.color.rgbc_c;
            c["colorTemp"] = scan.color.colorTemp;
            c["lux"] = scan.color.lux;
        }
        if (scan.color.sensorType == COLOR_OPT4048) {
            c["cie_x"] = scan.color.cie_x;
            c["cie_y"] = scan.color.cie_y;
            c["cie_z"] = scan.color.cie_z;
            c["lux"] = scan.color.opt_lux;
        }
    }

    // Height
    if (scan.height.valid) {
        JsonObject h = doc["height"].to<JsonObject>();
        h["distanceMm"] = scan.height.distanceMm;
        h["objectHeightMm"] = scan.height.objectHeightMm;
    }

    // Turntable
    if (scan.turntable.homed) {
        doc["turntableAngle"] = scan.turntable.angleDeg;
    }

    String output;
    serializeJson(doc, output);
    return output;
}

bool ApiClient::parseResponse(const String& json, ScanResponse& response) {
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, json);
    if (err) {
        Serial.printf("JSON parse error: %s\n", err.c_str());
        return false;
    }

    response.identified = doc["identified"] | false;
    response.confidence = doc["confidence"] | 0.0f;
    response.needsCamera = doc["needsCamera"] | false;

    const char* type = doc["itemType"];
    if (type) strncpy(response.itemType, type, sizeof(response.itemType) - 1);

    const char* name = doc["itemName"];
    if (name) strncpy(response.itemName, name, sizeof(response.itemName) - 1);

    const char* suggestion = doc["suggestion"];
    if (suggestion) strncpy(response.suggestion, suggestion, sizeof(response.suggestion) - 1);

    const char* scanId = doc["scanId"];
    if (scanId) strncpy(response.scanId, scanId, sizeof(response.scanId) - 1);

    return true;
}

// ==================== Device Pairing ====================

ApiStatus ApiClient::requestPairingCode(char* codeOut, size_t codeLen) {
    if (!isWiFiConnected()) return API_NO_WIFI;
    if (_apiUrl[0] == '\0') return API_CONNECT_FAILED;

    String url = String(_apiUrl) + "/api/v1/devices/pair";

    JsonDocument doc;
    doc["hardwareId"] = _stationId;
    doc["sku"] = FW_SKU;
    doc["firmwareVersion"] = FW_VERSION;

    doc["firmwareChannel"] = FW_CHANNEL;

    // Rich hardware manifest
    JsonObject caps = doc["capabilities"].to<JsonObject>();
    auto addSensor = [&](const char* key, const SensorInfo& s) {
        if (!s.detected) return;
        JsonObject obj = caps[key].to<JsonObject>();
        obj["detected"] = true;
        if (s.chip[0]) obj["chip"] = s.chip;
        if (s.interface[0]) obj["interface"] = s.interface;
        if (s.i2cAddr > 0) {
            char addr[8];
            snprintf(addr, sizeof(addr), "0x%02X", s.i2cAddr);
            obj["address"] = addr;
        }
        if (s.pin1 >= 0) obj["pin"] = s.pin1;
        if (s.pin2 >= 0) obj["pin2"] = s.pin2;
    };
    addSensor("nfc", _capabilities.nfc);
    addSensor("scale", _capabilities.scale);
    addSensor("tof", _capabilities.tof);
    addSensor("colorSensor", _capabilities.colorSensor);
    addSensor("display", _capabilities.display);
    addSensor("leds", _capabilities.leds);
    caps["turntable"] = _capabilities.turntable;
    caps["camera"] = _capabilities.camera;

    String payload;
    serializeJson(doc, payload);

    HTTPClient http;
    http.begin(getSecureClient(), url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(API_TIMEOUT_MS);

    int httpCode = http.POST(payload);

    if (httpCode <= 0) {
        http.end();
        return API_CONNECT_FAILED;
    }

    if (httpCode != 200) {
        Serial.printf("[Pair] HTTP %d\n", httpCode);
        http.end();
        return API_HTTP_ERROR;
    }

    String body = http.getString();
    http.end();

    JsonDocument resp;
    if (deserializeJson(resp, body)) return API_PARSE_ERROR;

    bool alreadyPaired = resp["paired"] | false;
    if (alreadyPaired) {
        // Already paired to a user — we're good
        _paired = true;
        saveConfig();
        Serial.println("[Pair] Already paired");
        return API_OK;
    }

    const char* code = resp["pairingCode"];
    const char* token = resp["deviceToken"];

    if (code && token) {
        strncpy(_pairingCode, code, sizeof(_pairingCode) - 1);
        strncpy(_deviceToken, token, sizeof(_deviceToken) - 1);
        strncpy(codeOut, code, codeLen - 1);
        codeOut[codeLen - 1] = '\0';
        _paired = false;
        saveConfig();
        Serial.printf("[Pair] Code: %s\n", code);
        return API_OK;
    }

    return API_PARSE_ERROR;
}

ApiStatus ApiClient::pollPairingStatus(bool& paired) {
    paired = false;
    if (!isWiFiConnected()) return API_NO_WIFI;
    if (_apiUrl[0] == '\0') return API_CONNECT_FAILED;
    if (_deviceToken[0] == '\0') return API_CONNECT_FAILED;

    String url = String(_apiUrl) + "/api/v1/devices/pair?token=" + String(_deviceToken);

    HTTPClient http;
    http.begin(getSecureClient(), url);
    http.setTimeout(API_TIMEOUT_MS);

    int httpCode = http.GET();

    if (httpCode <= 0) {
        http.end();
        return API_CONNECT_FAILED;
    }

    String body = http.getString();
    http.end();

    if (httpCode != 200) return API_HTTP_ERROR;

    JsonDocument resp;
    if (deserializeJson(resp, body)) return API_PARSE_ERROR;

    paired = resp["paired"] | false;
    bool expired = resp["expired"] | false;

    if (paired) {
        _paired = true;
        memset(_pairingCode, 0, sizeof(_pairingCode));
        saveConfig();
        Serial.println("[Pair] Device paired!");
        return API_OK;
    }

    if (expired) {
        Serial.println("[Pair] Code expired");
        return API_EXPIRED;
    }

    return API_OK;
}

void ApiClient::unpair() {
    _paired = false;
    memset(_deviceToken, 0, sizeof(_deviceToken));
    memset(_pairingCode, 0, sizeof(_pairingCode));
    saveConfig();
    Serial.println("[Pair] Device unpaired");
}

// ==================== Config Persistence ====================

void ApiClient::loadConfig() {
    prefs.begin("scan-api", true);
    prefs.getString("ssid", _ssid, sizeof(_ssid));
    prefs.getString("pass", _password, sizeof(_password));
    prefs.getString("apiurl", _apiUrl, sizeof(_apiUrl));
    prefs.getString("apikey", _apiKey, sizeof(_apiKey));
    prefs.getString("station", _stationId, sizeof(_stationId));
    prefs.getString("devtoken", _deviceToken, sizeof(_deviceToken));
    _paired = prefs.getBool("paired", false);
    prefs.end();
}

void ApiClient::saveConfig() {
    prefs.begin("scan-api", false);
    prefs.putString("ssid", _ssid);
    prefs.putString("pass", _password);
    prefs.putString("apiurl", _apiUrl);
    prefs.putString("apikey", _apiKey);
    prefs.putString("station", _stationId);
    prefs.putString("devtoken", _deviceToken);
    prefs.putBool("paired", _paired);
    prefs.end();
}

void ApiClient::printStatus() {
    Serial.println("=== API Client ===");
    Serial.printf("  WiFi: %s (%s)\n",
        _wifiConfigured ? _ssid : "not configured",
        isWiFiConnected() ? "connected" : "disconnected");
    if (isWiFiConnected()) {
        Serial.printf("  IP: %s\n", WiFi.localIP().toString().c_str());
        Serial.printf("  RSSI: %d dBm\n", WiFi.RSSI());
    }
    Serial.printf("  API URL: %s\n", _apiUrl[0] ? _apiUrl : "not set");
    Serial.printf("  Station: %s\n", _stationId);
    Serial.printf("  Firmware: v%s (%s) [%s]\n", FW_VERSION, FW_CHANNEL, FW_SKU);
    Serial.printf("  Paired: %s\n", isPaired() ? "yes" : "no");
    if (_pairingCode[0] != '\0') {
        Serial.printf("  Pairing code: %s\n", _pairingCode);
    }
    if (_deviceToken[0] != '\0') {
        Serial.printf("  Device token: %.8s...\n", _deviceToken);
    }
}
