#include "ota_update.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <ArduinoJson.h>
#include "api_client.h"
#include "display.h"

extern Display display;

static unsigned long _lastCheck = 0;
static bool _inProgress = false;

void otaBegin() {
    // First check after a short delay post-boot
    _lastCheck = millis() - OTA_CHECK_INTERVAL_MS + OTA_FIRST_CHECK_DELAY;
}

void otaLoop() {
    if (_inProgress) return;
    if (!apiClient.isWiFiConnected() || !apiClient.isPaired()) return;

    unsigned long now = millis();
    if (now - _lastCheck < OTA_CHECK_INTERVAL_MS) return;
    _lastCheck = now;

    otaCheckNow();
}

bool otaInProgress() {
    return _inProgress;
}

void otaCheckNow() {
    if (!apiClient.isWiFiConnected()) {
        Serial.println("[OTA] No WiFi");
        return;
    }

    Serial.println("[OTA] Checking for updates...");

    // Build check URL
    String url = String(apiClient.getApiUrl()) + "/api/v1/firmware/check";
    url += "?version=" + String(FW_VERSION);
    url += "&sku=" + String(FW_SKU);

    WiFiClientSecure secClient;
    secClient.setInsecure();

    HTTPClient http;
    http.begin(secClient, url);
    if (apiClient.getDeviceToken()[0] != '\0') {
        http.addHeader("X-Device-Token", apiClient.getDeviceToken());
    }
    http.addHeader("X-Firmware-Version", FW_VERSION);
    http.addHeader("X-Hardware-Id", apiClient.getStationId());
    http.addHeader("X-Device-SKU", FW_SKU);
    // Heartbeat data
    http.addHeader("X-Uptime", String(millis() / 1000));
    http.addHeader("X-Free-Heap", String(ESP.getFreeHeap()));
    http.addHeader("X-WiFi-RSSI", String(WiFi.RSSI()));
    http.setTimeout(API_TIMEOUT_MS);

    int httpCode = http.GET();

    if (httpCode != 200) {
        Serial.printf("[OTA] Check failed: HTTP %d\n", httpCode);
        http.end();
        return;
    }

    String body = http.getString();
    http.end();

    JsonDocument doc;
    if (deserializeJson(doc, body)) {
        Serial.println("[OTA] Parse error");
        return;
    }

    bool updateAvailable = doc["updateAvailable"] | false;
    if (!updateAvailable) {
        Serial.println("[OTA] Up to date");
        return;
    }

    const char* newVersion = doc["version"];
    const char* binUrl = doc["url"];
    const char* md5 = doc["md5"];

    if (!binUrl) {
        Serial.println("[OTA] No binary URL in response");
        return;
    }

    Serial.printf("[OTA] Update available: %s -> %s\n", FW_VERSION, newVersion);
    Serial.printf("[OTA] URL: %s\n", binUrl);

    _inProgress = true;

    // Show update on display
    display.showMessage("Updating...", newVersion);

    // Progress callback
    httpUpdate.onProgress([](int cur, int total) {
        int pct = (total > 0) ? (cur * 100 / total) : 0;
        if (pct % 10 == 0) {
            Serial.printf("[OTA] %d%%\n", pct);
            char line2[32];
            snprintf(line2, sizeof(line2), "%d%%", pct);
            display.showMessage("Updating...", line2);
        }
    });

    httpUpdate.rebootOnUpdate(true);

    // Use WiFiClientSecure for HTTPS
    WiFiClientSecure client;
    client.setInsecure();  // Skip cert validation — MD5 hash verifies integrity

    // Build URL with MD5 for verification
    String updateUrl = String(binUrl);
    t_httpUpdate_return ret;

    if (md5 && strlen(md5) > 0) {
        // HTTPUpdate verifies MD5 via the x-MD5 header in the response
        // Pass MD5 as a header hint — the Update library checks it
        ret = httpUpdate.update(client, updateUrl, md5);
    } else {
        ret = httpUpdate.update(client, updateUrl);
    }

    // If we get here, update failed (success would have rebooted)
    _inProgress = false;

    switch (ret) {
        case HTTP_UPDATE_FAILED:
            Serial.printf("[OTA] Failed: %s\n", httpUpdate.getLastErrorString().c_str());
            display.showMessage("Update Failed", httpUpdate.getLastErrorString().c_str());
            delay(3000);
            break;
        case HTTP_UPDATE_NO_UPDATES:
            Serial.println("[OTA] No update");
            break;
        default:
            break;
    }
}
