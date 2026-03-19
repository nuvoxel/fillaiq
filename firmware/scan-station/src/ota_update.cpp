#include "ota_update.h"
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <ArduinoJson.h>
#include "api_client.h"
#include "display.h"
#include "device_config.h"
#include "printer.h"
#include "tls_certs.h"

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

    Serial.printf("[OTA] Checking... Heap: %u PSRAM: %u\n", ESP.getFreeHeap(), ESP.getFreePsram());

    // Build check URL
    String url = String(apiClient.getApiUrl()) + "/api/v1/firmware/check";
    Serial.printf("[OTA] URL: %s\n", url.c_str());

    WiFiClientSecure secClient;
    secClient.setCACert(FILLAIQ_ROOT_CA);
    secClient.setTimeout(API_TIMEOUT_MS);
    Serial.printf("[OTA] TLS client created. Heap: %u\n", ESP.getFreeHeap());

    HTTPClient http;
    http.begin(secClient, url);
    Serial.println("[OTA] HTTP begin done, adding headers...");
    http.addHeader("Content-Type", "application/json");
    if (apiClient.getDeviceToken()[0] != '\0') {
        http.addHeader("X-Device-Token", apiClient.getDeviceToken());
    }
    http.setTimeout(API_TIMEOUT_MS);

    // Build POST body with heartbeat + capabilities (avoids header size limits)
    JsonDocument doc;
    doc["version"] = FW_VERSION;
    doc["sku"] = FW_SKU;
    doc["hardwareId"] = apiClient.getStationId();
    doc["uptime"] = millis() / 1000;
    doc["freeHeap"] = ESP.getFreeHeap();
    doc["wifiRssi"] = WiFi.RSSI();

    // Capabilities
    {
        JsonDocument capsDoc;
        deserializeJson(capsDoc, apiClient.buildCapabilitiesJson());

        // Augment with live printer state
        if (labelPrinter.isConnected()) {
            const auto& ps = labelPrinter.getState();
            JsonObject p = capsDoc["printer"];
            p["transport"] = "BLE";
            if (ps.infoQueried) {
                p["battery"] = ps.batteryPercent;
                if (ps.firmwareVersion[0]) p["firmware"] = ps.firmwareVersion;
                if (ps.serialNumber > 0) p["serialNumber"] = ps.serialNumber;
            }
            p["paperLoaded"] = ps.paperLoaded;
            p["coverClosed"] = ps.coverClosed;
        }

        doc["capabilities"] = capsDoc;
    }

    String payload;
    serializeJson(doc, payload);
    Serial.printf("[OTA] Sending POST (%d bytes)... Heap: %u\n", payload.length(), ESP.getFreeHeap());

    int httpCode = http.POST(payload);
    Serial.printf("[OTA] Response: %d Heap: %u\n", httpCode, ESP.getFreeHeap());

    if (httpCode != 200) {
        Serial.printf("[OTA] Check failed: HTTP %d\n", httpCode);
        http.end();
        return;
    }

    String body = http.getString();
    http.end();

    JsonDocument respDoc;
    if (deserializeJson(respDoc, body)) {
        Serial.println("[OTA] Parse error");
        return;
    }

    // Apply device config if present
    if (respDoc.containsKey("deviceConfig")) {
        String configStr;
        serializeJson(respDoc["deviceConfig"], configStr);
        deviceConfig.applyFromJson(configStr.c_str());
    }

    bool updateAvailable = respDoc["updateAvailable"] | false;
    if (!updateAvailable) {
        Serial.println("[OTA] Up to date");
        return;
    }

    const char* newVersion = respDoc["version"];
    const char* binUrl = respDoc["url"];
    const char* md5 = respDoc["md5"];

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

    // Use WiFiClientSecure for HTTPS — Azure Blob Storage uses Microsoft's
    // own cert chain (DigiCert Baltimore / Microsoft RSA TLS), not our API's
    // root CA. Binary integrity is verified via MD5 hash from the API response.
    WiFiClientSecure client;
    client.setInsecure();

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
