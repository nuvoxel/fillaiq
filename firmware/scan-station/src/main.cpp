#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>
#include <WiFi.h>
#include <Preferences.h>

#include "scan_config.h"
#include "sensors.h"
#include "filament_data.h"
#include "weight.h"
#include "nfc.h"
#include "api_client.h"
#include "backlight.h"
#include "display.h"
#include "provision.h"
#include "bambu_tag.h"
#include "distance.h"
#include "color.h"
#include "ota_update.h"
#include "environment.h"
#include "device_config.h"
#include "device_identity.h"
#include "printer.h"
#include <BLEDevice.h>
#include <BLEScan.h>

// ============================================================
// Filla IQ — FillaScan Firmware
//
// Architecture:
//   Core 0: Main loop — state machine, display, LED, serial, WiFi, API
//   Core 1: Weight task — continuous HX711 reading
//
// Sensors: HX711 (weight), PN532 (NFC), VL53L1X (TOF), AS7341 (color)
// Connectivity: WiFi + BLE provisioning
// API: POST /api/v1/scan with all sensor data
// ============================================================

static Preferences prefs;

// Forward declarations
void startProvisioning();
void startPairing();

// Pairing state
bool pairingActive = false;
unsigned long lastPairingPoll = 0;
#define PAIRING_POLL_INTERVAL_MS  5000

// Auth failure tracking — only unpair after consecutive failures
uint8_t authFailCount = 0;
#define AUTH_FAIL_THRESHOLD  3

// ── Scan State Machine ────────────────────────────────────────────────────────

ScanState scanState = SCAN_IDLE;
ScanResult currentScan;
ScanResponse lastResponse;
unsigned long stateEnteredAt = 0;
unsigned long lastApiPost = 0;
unsigned long lastApiPoll = 0;
bool objectWasPresent = false;

void enterState(ScanState newState) {
    if (newState == scanState) return;
    Serial.printf("[State] %s -> %s\n", scanStateName(scanState), scanStateName(newState));
    scanState = newState;
    stateEnteredAt = millis();
}

// ── Calibration State ─────────────────────────────────────────────────────────

enum CalState { CAL_NONE, CAL_WAIT_EMPTY, CAL_WAIT_WEIGHT };
CalState calState = CAL_NONE;

void saveCalibration(float factor) {
    prefs.begin("cal", false);
    prefs.putFloat("ch0", factor);
    prefs.end();
    Serial.printf("Calibration saved: %.4f\n", factor);
}

float loadCalibration() {
    prefs.begin("cal", true);
    float f = prefs.getFloat("ch0", 0);
    prefs.end();
    return f;
}

// ── WiFi Management ───────────────────────────────────────────────────────────

unsigned long lastWifiAttempt = 0;
bool wifiEverConnected = false;

void tryWifiConnect() {
    if (apiClient.isWiFiConnected()) return;
    unsigned long now = millis();
    if (wifiEverConnected && now - lastWifiAttempt < WIFI_RETRY_INTERVAL_MS) return;
    lastWifiAttempt = now;

    if (apiClient.connectWiFi()) {
        wifiEverConnected = true;
        // Auto-start pairing if needed
        if (apiClient.hasApiUrl() && !apiClient.isPaired()) {
            startPairing();
        }
    }
}

// ── Captive Portal Provisioning Check ─────────────────────────────────────────

void checkProvisioning() {
    if (!provisioner.hasNewCredentials()) return;

    char ssid[64] = {0}, pass[64] = {0};
    provisioner.getCredentials(ssid, pass, sizeof(ssid), sizeof(pass));
    provisioner.clearNewCredentials();

    Serial.printf("[Provision] Applying: SSID=%s\n", ssid);

    // Stop AP and captive portal before switching to STA
    provisioner.stop();
    display.showMessage("Connecting...", ssid);

    apiClient.setCredentials(ssid, pass);

    // Try connecting
    if (apiClient.connectWiFi()) {
        wifiEverConnected = true;
        display.showMessage("WiFi Connected!", WiFi.localIP().toString().c_str());
        delay(1000);

        // Start pairing if API URL configured and not yet paired
        if (apiClient.hasApiUrl() && !apiClient.isPaired()) {
            startPairing();
        }
    } else {
        display.showMessage("WiFi Failed", "Restarting setup...");
        delay(2000);
        startProvisioning();
    }
}

void startProvisioning() {
    uint8_t mac[6];
    WiFi.macAddress(mac);
    char apName[32];
    snprintf(apName, sizeof(apName), "%s%02X%02X%02X",
             BLE_DEVICE_NAME_PREFIX, mac[3], mac[4], mac[5]);
    provisioner.begin(apName);

    // Build WiFi QR code string: WIFI:T:WPA;S:<ssid>;P:<password>;;
    char qrData[128];
    snprintf(qrData, sizeof(qrData), "WIFI:T:WPA;S:%s;P:%s;;",
             apName, PROV_AP_PASSWORD);
    display.showQrCode(qrData, apName);

    Serial.printf("[Setup] AP: %s  Pass: %s\n", apName, PROV_AP_PASSWORD);
}

void startPairing() {
    char code[12] = {0};
    display.showMessage("Pairing...", "Contacting server");

    ApiStatus status = apiClient.requestPairingCode(code, sizeof(code));

    if (status == API_OK && apiClient.isPaired()) {
        // Server recognized device as already paired — token refreshed
        display.showMessage("Paired!", "Ready to scan");
        delay(1000);
    } else if (status == API_OK && code[0] != '\0') {
        // New pairing — show code on display
        pairingActive = true;
        lastPairingPoll = millis();

        display.showPairingCode(code);
        Serial.printf("[Pair] Enter code on web app: %s\n", code);
    } else {
        Serial.printf("[Pair] Failed: %d\n", status);
        display.showMessage("Pair Failed", "Check API URL");
        delay(3000);
    }
}

// ── Per-loop weight snapshot (avoid repeated mutex acquisitions) ─────────────

struct WeightSnapshot {
    float weight;
    float stableWeight;
    bool stable;
};
static WeightSnapshot weightSnap;

void snapshotWeight() {
    weightSnap.weight = scale.getWeight();
    weightSnap.stableWeight = scale.getStableWeight();
    weightSnap.stable = scale.isStable();
}

// ── Scan State Machine Logic ──────────────────────────────────────────────────

void updateScanState() {
    float w = weightSnap.weight;
    bool weightPresent = w > OBJECT_PRESENT_THRESHOLD;
    bool weightRemoved = w < OBJECT_REMOVED_THRESHOLD;
    unsigned long now = millis();
    unsigned long elapsed = now - stateEnteredAt;

    switch (scanState) {

    case SCAN_IDLE:
        if (weightPresent) {
            currentScan.clear_data();
            currentScan.timestamp = now;
            enterState(SCAN_DETECTED);
        }
        break;

    case SCAN_DETECTED:
        // Wait for weight to stabilize before reading other sensors
        if (weightRemoved) {
            enterState(SCAN_IDLE);
            break;
        }
        if (elapsed >= SCAN_STABILIZE_MS || scale.isStable()) {
            enterState(SCAN_READING);
        }
        break;

    case SCAN_READING: {
        // Gather all sensor data
        if (weightRemoved) {
            enterState(SCAN_IDLE);
            break;
        }

        // Weight
        currentScan.weight.grams = weightSnap.stable ? weightSnap.stableWeight : weightSnap.weight;
        currentScan.weight.stable = weightSnap.stable;
        currentScan.weight.valid = true;

        // NFC
        currentScan.nfcPresent = nfcScanner.isTagPresent();
        if (currentScan.nfcPresent) {
            String uid = nfcScanner.getUidString();
            strncpy(currentScan.nfcUid, uid.c_str(), sizeof(currentScan.nfcUid) - 1);
            uint8_t uidBuf[7];
            uint8_t uidLen;
            nfcScanner.getUid(uidBuf, &uidLen);
            currentScan.nfcUidLen = uidLen;
            currentScan.nfcTagType = nfcScanner.getTagData().type;
        }

        // Wait until weight is stable and NFC read is complete (or timeout)
        bool nfcDone = !nfcScanner.isTagPresent() || nfcScanner.hasTagData();
        bool ready = weightSnap.stable && (nfcDone || elapsed > 5000);

        if (ready) {
            enterState(SCAN_POSTING);
        }
        break;
    }

    case SCAN_POSTING: {
        if (weightRemoved) {
            enterState(SCAN_IDLE);
            break;
        }

        if (!apiClient.isWiFiConnected()) {
            // No WiFi — can't identify without server
            display.update(SCAN_NEEDS_INPUT, currentScan.weight.grams, true,
                          currentScan.nfcUid, nullptr, nullptr, nullptr);
            backlight.needsInput();
            enterState(SCAN_NEEDS_INPUT);
            break;
        }

        if (now - lastApiPost < API_POST_DEBOUNCE_MS) break;
        lastApiPost = now;

        const TagData* tagPtr = nfcScanner.hasTagData() ? &nfcScanner.getTagData() : nullptr;
        ApiStatus status = apiClient.postScan(currentScan, tagPtr, lastResponse);

        if (status == API_OK) {
            authFailCount = 0;
            Serial.printf("[API] Scan posted: id=%s identified=%d\n",
                         lastResponse.scanId, lastResponse.identified);

            if (lastResponse.identified) {
                enterState(SCAN_IDENTIFIED);
            } else if (lastResponse.needsCamera) {
                enterState(SCAN_NEEDS_INPUT);
            } else {
                enterState(SCAN_AWAITING_RESULT);
            }
        } else if (status == API_AUTH_FAILED) {
            authFailCount++;
            Serial.printf("[API] Auth failed (%d/%d)\n", authFailCount, AUTH_FAIL_THRESHOLD);
            if (authFailCount >= AUTH_FAIL_THRESHOLD) {
                Serial.println("[API] Too many auth failures — unpairing. Use 'pair' to re-pair.");
                apiClient.unpair();
                authFailCount = 0;
            }
            enterState(SCAN_IDLE);
        } else {
            Serial.printf("[API] Post failed: %d\n", status);
            enterState(SCAN_NEEDS_INPUT);
        }
        break;
    }

    case SCAN_AWAITING_RESULT: {
        if (weightRemoved) {
            enterState(SCAN_IDLE);
            break;
        }

        if (now - lastApiPoll >= API_POLL_INTERVAL_MS && lastResponse.scanId[0]) {
            lastApiPoll = now;
            ScanResponse pollResp;
            ApiStatus status = apiClient.pollResult(lastResponse.scanId, pollResp);
            if (status == API_OK) {
                authFailCount = 0;
                if (pollResp.identified) {
                    lastResponse = pollResp;
                    enterState(SCAN_IDENTIFIED);
                } else if (pollResp.needsCamera) {
                    enterState(SCAN_NEEDS_INPUT);
                }
            } else if (status == API_AUTH_FAILED) {
                authFailCount++;
                Serial.printf("[API] Auth failed during poll (%d/%d)\n", authFailCount, AUTH_FAIL_THRESHOLD);
                if (authFailCount >= AUTH_FAIL_THRESHOLD) {
                    Serial.println("[API] Too many auth failures — unpairing.");
                    apiClient.unpair();
                    authFailCount = 0;
                }
                enterState(SCAN_IDLE);
            }
        }

        // Timeout after 30s
        if (elapsed > 30000) {
            enterState(SCAN_NEEDS_INPUT);
        }
        break;
    }

    case SCAN_IDENTIFIED:
        if (weightRemoved) {
            enterState(SCAN_IDLE);
        }
        break;

    case SCAN_NEEDS_INPUT:
        if (weightRemoved) {
            enterState(SCAN_IDLE);
        }
        break;

    default:
        enterState(SCAN_IDLE);
        break;
    }
}

// ── Display + LED Update ──────────────────────────────────────────────────────

void updateDisplayAndLed() {
    float w = weightSnap.stable ? weightSnap.stableWeight : weightSnap.weight;
    bool stable = weightSnap.stable;

    // Cache NFC UID — persist after tag removal until spool is lifted
    static char uidBuf[32];
    static bool hasUid = false;

    // Update cache when tag is present
    if (nfcScanner.isTagPresent()) {
        String uidStr = nfcScanner.getUidString();
        strncpy(uidBuf, uidStr.c_str(), sizeof(uidBuf) - 1);
        uidBuf[sizeof(uidBuf) - 1] = '\0';
        hasUid = true;
    }

    // Clear cache when spool is removed (weight drops)
    if (scanState == SCAN_IDLE) {
        hasUid = false;
    }

    const char* uid = hasUid ? uidBuf : nullptr;

    // Use server response for display (persists until next scan)
    const ScanResponse* serverData = lastResponse.identified ? &lastResponse : nullptr;

    // TOF distance
    static DistanceData distData;
    const DistanceData* dist = nullptr;
    if (distanceSensor.isConnected() && distanceSensor.read(distData)) {
        dist = &distData;
    }

    // Color sensor
    static ColorData colorData;
    const ColorData* color = nullptr;
    if (colorSensor.isConnected() && colorSensor.read(colorData)) {
        color = &colorData;
    }

    // Build status icon flags
    uint8_t icons = 0;
    if (apiClient.isWiFiConnected()) icons |= ICON_WIFI;
    if (apiClient.isPaired())        icons |= ICON_PAIRED;

    // Update display
    display.update(scanState, w, stable, uid, serverData, dist, color, icons);

    // LED backlight based on state (only change mode on state transitions)
    static ScanState lastLedState = SCAN_IDLE;
    static bool lastLedHadData = false;
    bool hasDataNow = (serverData != nullptr);
    bool ledStateChanged = (scanState != lastLedState) || (hasDataNow != lastLedHadData);

    if (ledStateChanged) {
        lastLedState = scanState;
        lastLedHadData = hasDataNow;
        switch (scanState) {
        case SCAN_IDLE:
            backlight.idle();
            break;
        case SCAN_DETECTED:
        case SCAN_READING:
            backlight.scanning();
            break;
        case SCAN_POSTING:
        case SCAN_AWAITING_RESULT:
            backlight.spin(0, 150, 255);
            break;
        case SCAN_IDENTIFIED:
            if (serverData && (serverData->colorR || serverData->colorG || serverData->colorB)) {
                backlight.color(serverData->colorR, serverData->colorG, serverData->colorB);
            } else {
                backlight.success();
            }
            break;
        case SCAN_NEEDS_INPUT:
            backlight.needsInput();
            break;
        default:
            break;
        }
    }

    backlight.update();
}

// ── Serial Commands ───────────────────────────────────────────────────────────

void printHelp() {
    Serial.println("Commands:");
    Serial.println("  status (s)      Full device status");
    Serial.println("  scan            Current scan/session details");
    Serial.println("  nfc             NFC reader status");
    Serial.println("  i2c             Scan I2C bus");
    Serial.println("  config          Device config (from server)");
    Serial.println("  identity        Hardware identity (eFuse HMAC)");
    Serial.println("  tare            Zero the scale");
    Serial.println("  cal             Calibrate scale (interactive)");
    Serial.println("  calreset        Reset calibration to default");
    Serial.println("  wifi <s> <p>    Set WiFi SSID and password");
    Serial.println("  apiurl <url>    Set API server URL");
    Serial.println("  apikey <key>    Set API key");
    Serial.println("  provision       Start WiFi setup AP");
    Serial.println("  pair            Pair with web app");
    Serial.println("  unpair          Remove pairing");
    Serial.println("  pr              Printer status");
    Serial.println("  prscan          Scan for BLE printers");
    Serial.println("  prconnect       Connect to found printer");
    Serial.println("  prdisconnect    Disconnect printer");
    Serial.println("  prinfo          Query printer info");
    Serial.println("  prtest          Print test pattern");
    Serial.println("  blescan         Scan all BLE devices");
    Serial.println("  ota             Check for firmware update");
    Serial.println("  reset           Reboot device");
}

void printStatus() {
    Serial.println();
    Serial.println("========================================");
    Serial.printf("  FillaScan v%s (%s)\n", FW_VERSION, FW_CHANNEL);
    Serial.printf("  %s  |  %s\n", FW_SKU, apiClient.getStationId());
    Serial.printf("  eFuse: %s  HMAC: %s\n",
        deviceIdentity.getHardwareId(),
        deviceIdentity.isProvisioned() ? "yes" : "no");
    Serial.println("========================================");

    // Network
    Serial.println("\n  Network");
    if (apiClient.isWiFiConnected()) {
        Serial.printf("    WiFi: %s  RSSI: %d dBm\n",
            WiFi.localIP().toString().c_str(), WiFi.RSSI());
    } else {
        Serial.println("    WiFi: disconnected");
    }
    Serial.printf("    API:  %s\n", apiClient.getApiUrl());
    Serial.printf("    Paired: %s", apiClient.isPaired() ? "yes" : "no");
    if (apiClient.getPairingCode()[0] != '\0')
        Serial.printf("  (code: %s)", apiClient.getPairingCode());
    Serial.println();
    if (provisioner.isActive())
        Serial.println("    Setup AP: active");

    // Sensors
    Serial.println("\n  Sensors");
    if (scale.isConnected()) {
        float w = weightSnap.stable ? weightSnap.stableWeight : weightSnap.weight;
        Serial.printf("    Scale:  %s  %.1fg %s  (cal %.4f)\n",
            scale.getChipName(), w,
            weightSnap.stable ? "STABLE" : "unstable", scale.getScaleFactor());
    } else {
        Serial.println("    Scale:  --");
    }
    Serial.printf("    NFC:    %s\n", nfcScanner.isConnected() ? "PN532" : "--");
    Serial.printf("    TOF:    %s\n", distanceSensor.isConnected() ? "VL53L1X" : "--");
    {
        const char* colorNames[] = {"--", "AS7341", "AS7265x", "TCS34725", "OPT4048", "AS7343", "AS7331"};
        Serial.printf("    Color:  %s\n", colorNames[colorSensor.isConnected() ? colorSensor.getType() : 0]);
    }
    if (envSensor.isConnected()) {
        EnvData env;
        if (envSensor.read(env)) {
            Serial.printf("    Env:    %s  %.1fC  %.0f%%", envSensor.getChipName(),
                env.temperatureC, env.humidity);
            if (env.pressureHPa > 0) Serial.printf("  %.0fhPa", env.pressureHPa);
            Serial.println();
        } else {
            Serial.printf("    Env:    %s (read failed)\n", envSensor.getChipName());
        }
    } else {
        Serial.println("    Env:    --");
    }
    if (labelPrinter.isConnected()) {
        Serial.printf("    Printer: %s (BLE)\n", labelPrinter.getDeviceName());
    } else if (labelPrinter.getDeviceName()[0]) {
        Serial.printf("    Printer: %s (disconnected)\n", labelPrinter.getDeviceName());
    } else {
        Serial.println("    Printer: --");
    }

    // Scan state
    Serial.println("\n  Scan");
    Serial.printf("    State:   %s\n", scanStateName(scanState));
    if (lastResponse.scanId[0])
        Serial.printf("    Last ID: %.16s...\n", lastResponse.scanId);
    if (lastResponse.sessionId[0])
        Serial.printf("    Session: %.16s...\n", lastResponse.sessionId);
    if (lastResponse.identified) {
        Serial.printf("    Result:  %s", lastResponse.itemName[0] ? lastResponse.itemName : "(identified)");
        if (lastResponse.material[0])
            Serial.printf("  [%s]", lastResponse.material);
        if (lastResponse.colorHex[0])
            Serial.printf("  %s", lastResponse.colorHex);
        Serial.println();
        if (lastResponse.nozzleTempMin || lastResponse.nozzleTempMax)
            Serial.printf("    Temps:   nozzle %d-%dC  bed %dC\n",
                lastResponse.nozzleTempMin, lastResponse.nozzleTempMax, lastResponse.bedTemp);
    }

    // System
    Serial.printf("\n  Uptime: %lus  Heap: %u bytes\n", millis() / 1000, ESP.getFreeHeap());
    Serial.println("========================================\n");
}

void printScanDetails() {
    Serial.println("\n--- Scan State ---");
    Serial.printf("  State: %s  (%.1fs in state)\n",
        scanStateName(scanState), (millis() - stateEnteredAt) / 1000.0f);

    // Current sensor readings
    float w = weightSnap.stable ? weightSnap.stableWeight : weightSnap.weight;
    Serial.printf("  Weight: %.1fg %s\n", w, weightSnap.stable ? "STABLE" : "unstable");

    if (nfcScanner.isTagPresent()) {
        Serial.printf("  NFC: %s", nfcScanner.getUidString().c_str());
        if (nfcScanner.hasTagData()) {
            const TagData& td = nfcScanner.getTagData();
            if (td.type == TAG_MIFARE_CLASSIC)
                Serial.printf("  (MIFARE, %d sectors)", td.sectors_read);
            else
                Serial.printf("  (NTAG, %d pages)", td.pages_read);
        }
        Serial.println();
    } else {
        Serial.println("  NFC: no tag");
    }

    if (distanceSensor.isConnected()) {
        DistanceData d;
        if (distanceSensor.read(d))
            Serial.printf("  TOF: %.0fmm (height: %.0fmm)\n", d.distanceMm, d.objectHeightMm);
    }

    if (colorSensor.isConnected()) {
        ColorData c;
        if (colorSensor.read(c)) {
            const char* names[] = {"?", "AS7341", "AS7265x", "TCS34725", "OPT4048", "AS7343", "AS7331"};
            Serial.printf("  Color: %s  %d channels\n", names[c.sensorType], c.channelCount);
        }
    }

    // Last server response
    if (lastResponse.scanId[0]) {
        Serial.println("\n--- Last Response ---");
        Serial.printf("  Scan:    %.16s...\n", lastResponse.scanId);
        if (lastResponse.sessionId[0])
            Serial.printf("  Session: %.16s...\n", lastResponse.sessionId);
        Serial.printf("  Identified: %s  Confidence: %.0f%%\n",
            lastResponse.identified ? "yes" : "no", lastResponse.confidence * 100);
        if (lastResponse.itemName[0])
            Serial.printf("  Name: %s\n", lastResponse.itemName);
        if (lastResponse.material[0])
            Serial.printf("  Material: %s\n", lastResponse.material);
        if (lastResponse.nfcTagFormat[0])
            Serial.printf("  Tag format: %s\n", lastResponse.nfcTagFormat);
        if (lastResponse.colorHex[0])
            Serial.printf("  Color: %s  RGB(%d,%d,%d)\n",
                lastResponse.colorHex, lastResponse.colorR, lastResponse.colorG, lastResponse.colorB);
        if (lastResponse.nozzleTempMin || lastResponse.nozzleTempMax)
            Serial.printf("  Nozzle: %d-%dC  Bed: %dC\n",
                lastResponse.nozzleTempMin, lastResponse.nozzleTempMax, lastResponse.bedTemp);
        if (lastResponse.suggestion[0])
            Serial.printf("  Suggestion: %s\n", lastResponse.suggestion);
    } else {
        Serial.println("\n  No scan data yet.");
    }
    Serial.println();
}

void handleSerial() {
    if (!Serial.available()) return;

    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) return;

    // Calibration state machine
    if (calState == CAL_WAIT_EMPTY) {
        if (line == "ready") {
            Serial.println("Taring...");
            scale.pauseTask();
            delay(500);
            scale.tare();
            Serial.println("Place known weight and type weight in grams:");
            calState = CAL_WAIT_WEIGHT;
        } else if (line == "abort") {
            calState = CAL_NONE;
            scale.resumeTask();
            Serial.println("Calibration aborted.");
        }
        return;
    }
    if (calState == CAL_WAIT_WEIGHT) {
        float knownWeight = line.toFloat();
        if (knownWeight <= 0) {
            Serial.println("Invalid. Type weight in grams or 'abort':");
            return;
        }
        double raw = scale.getValueForCalibration(20);
        float factor = (float)(raw / knownWeight);
        Serial.printf("Raw: %.0f  Factor: %.4f\n", raw, factor);
        scale.setScale(factor);
        saveCalibration(factor);
        calState = CAL_NONE;
        scale.resumeTask();
        Serial.println("Calibration complete.");
        return;
    }

    // Commands
    if (line == "help" || line == "h" || line == "?") {
        printHelp();
    }
    else if (line == "status" || line == "s") {
        printStatus();
    }
    else if (line == "scan") {
        printScanDetails();
    }
    else if (line == "nfc") {
        nfcScanner.printStatus();
    }
    else if (line == "i2c") {
        Serial.print("I2C:");
        for (uint8_t addr = 1; addr < 127; addr++) {
            Wire.beginTransmission(addr);
            if (Wire.endTransmission() == 0)
                Serial.printf(" 0x%02X", addr);
        }
        Serial.println();
    }
    else if (line == "config") {
        deviceConfig.printStatus();
    }
    else if (line == "identity" || line == "id") {
        deviceIdentity.printStatus();
    }
    else if (line == "tare") {
        scale.pauseTask();
        delay(200);
        scale.tare();
        scale.resumeTask();
        Serial.println("Tared.");
    }
    else if (line == "cal") {
        Serial.println("Remove all weight, then type 'ready':");
        calState = CAL_WAIT_EMPTY;
    }
    else if (line == "calreset") {
        prefs.begin("cal", false);
        prefs.clear();
        prefs.end();
        scale.setScale(WEIGHT_CALIBRATION);
        Serial.println("Calibration reset to default.");
    }
    else if (line.startsWith("wifi ")) {
        int spaceIdx = line.indexOf(' ', 5);
        if (spaceIdx > 5) {
            String ssid = line.substring(5, spaceIdx);
            String pass = line.substring(spaceIdx + 1);
            apiClient.setCredentials(ssid.c_str(), pass.c_str());
            Serial.printf("WiFi: %s\n", ssid.c_str());
            apiClient.connectWiFi();
        } else {
            Serial.println("Usage: wifi <ssid> <password>");
        }
    }
    else if (line.startsWith("apiurl ")) {
        apiClient.setApiUrl(line.substring(7).c_str());
        Serial.printf("API URL: %s\n", line.substring(7).c_str());
    }
    else if (line.startsWith("apikey ")) {
        apiClient.setApiKey(line.substring(7).c_str());
        Serial.println("API key set.");
    }
    else if (line == "provision") {
        if (!provisioner.isActive()) {
            startProvisioning();
        } else {
            Serial.println("Already in setup mode.");
        }
    }
    else if (line == "pair") {
        if (apiClient.isPaired()) {
            Serial.println("Already paired. Use 'unpair' first.");
        } else if (!apiClient.isWiFiConnected()) {
            Serial.println("No WiFi.");
        } else {
            startPairing();
        }
    }
    else if (line == "unpair") {
        apiClient.unpair();
    }
    else if (line == "pr" || line == "printer") {
        labelPrinter.printStatusInfo();
    }
    else if (line == "prscan" || line == "printerscan") {
        Serial.println("Scanning for BLE printer...");
        if (labelPrinter.scan(10000)) {
            Serial.printf("Found: %s @ %s\n", labelPrinter.getDeviceName(), labelPrinter.getBleAddr());
        } else {
            Serial.println("No printer found.");
        }
    }
    else if (line == "prconnect") {
        if (labelPrinter.isConnected()) {
            Serial.println("Already connected.");
        } else if (labelPrinter.getDeviceName()[0]) {
            labelPrinter.connect();
        } else {
            Serial.println("No printer. Use 'prscan' first.");
        }
    }
    else if (line == "prdisconnect") {
        labelPrinter.disconnect();
    }
    else if (line == "prinfo") {
        if (!labelPrinter.isConnected()) {
            Serial.println("Printer not connected.");
        } else {
            labelPrinter.queryInfo();
            labelPrinter.printStatusInfo();
        }
    }
    else if (line == "prtest") {
        if (!labelPrinter.isConnected()) {
            Serial.println("Printer not connected.");
        } else {
            const int W = PRINTER_BYTES_PER_LINE;
            const int Wpx = W * 8;
            const int H = 240;
            uint8_t* testBitmap = (uint8_t*)calloc(W * H, 1);
            if (!testBitmap) {
                Serial.println("Out of memory.");
            } else {
                auto setPixel = [&](int x, int y) {
                    if (x >= 0 && x < Wpx && y >= 0 && y < H)
                        testBitmap[y * W + (x / 8)] |= (0x80 >> (x % 8));
                };
                for (int y = 0; y < H; y++) {
                    for (int x = 0; x < Wpx; x++) {
                        if (x < 2 || x >= Wpx - 2 || y < 2 || y >= H - 2)
                            setPixel(x, y);
                        int dx = x * H / Wpx;
                        if (abs(dx - y) <= 1 || abs(dx - (H - 1 - y)) <= 1)
                            setPixel(x, y);
                        if ((abs(y - H / 2) <= 1 && x > 10 && x < Wpx - 10) ||
                            (abs(x - Wpx / 2) <= 1 && y > 10 && y < H - 10))
                            setPixel(x, y);
                    }
                }
                Serial.printf("Printing %dx%d test pattern...\n", Wpx, H);
                labelPrinter.printRaster(testBitmap, W, H);
                free(testBitmap);
            }
        }
    }
    else if (line == "blescan") {
        Serial.println("Scanning BLE (10s)...");
        BLEScan* pScan = BLEDevice::getScan();
        pScan->setActiveScan(true);
        pScan->setInterval(100);
        pScan->setWindow(99);
        BLEScanResults results = pScan->start(10, false);
        int count = results.getCount();
        Serial.printf("Found %d devices:\n", count);
        for (int i = 0; i < count; i++) {
            BLEAdvertisedDevice d = results.getDevice(i);
            String name = d.getName().c_str();
            if (name.length() == 0) name = "(unnamed)";
            Serial.printf("  %-20s  %s  %d dBm\n",
                name.c_str(), d.getAddress().toString().c_str(), d.getRSSI());
        }
        pScan->clearResults();
    }
    else if (line == "ota") {
        Serial.println("Checking for update...");
        otaCheckNow();
    }
    else if (line == "reset" || line == "reboot") {
        Serial.println("Rebooting...");
        delay(500);
        ESP.restart();
    }
    else {
        Serial.printf("Unknown: %s\n", line.c_str());
        printHelp();
    }
}

// ============================================================
// Setup
// ============================================================

void setup() {
    Serial.begin(SERIAL_BAUD);
    delay(1000);
    Serial.println("\n========================================");
    Serial.printf("  Filla IQ — FillaScan v%s (%s)\n", FW_VERSION, FW_CHANNEL);
    Serial.println("========================================\n");

    // Display + backlight first — show boot screen immediately
    backlight.begin();
    backlight.color(0, 0, 255);  // Blue = booting
    display.begin();
    char bootMsg[48];
    snprintf(bootMsg, sizeof(bootMsg), "v%s %s", FW_VERSION, FW_CHANNEL);
    display.showMessage("Filla IQ", bootMsg);

    // I2C bus (sensors + NFC on touch board)
    display.showMessage("Booting...", "I2C init");

    // Bus recovery: toggle SCL 9 times to release any stuck device
    pinMode(I2C_SDA, INPUT_PULLUP);
    pinMode(I2C_SCL, OUTPUT);
    for (int i = 0; i < 9; i++) {
        digitalWrite(I2C_SCL, LOW);
        delayMicroseconds(5);
        digitalWrite(I2C_SCL, HIGH);
        delayMicroseconds(5);
    }
    // STOP condition
    pinMode(I2C_SDA, OUTPUT);
    digitalWrite(I2C_SDA, LOW);
    delayMicroseconds(5);
    digitalWrite(I2C_SCL, HIGH);
    delayMicroseconds(5);
    digitalWrite(I2C_SDA, HIGH);
    delayMicroseconds(5);

    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setTimeOut(50);
    Serial.printf("  I2C bus: SDA=%d SCL=%d\n", I2C_SDA, I2C_SCL); Serial.flush();

    // Probe known addresses only (full scan can hang on stuck bus)
    display.showMessage("Booting...", "I2C scan");
    const uint8_t knownAddrs[] = { NAU7802_ADDR, VL53L1X_ADDR, VL53L1X_DEFAULT_ADDR,
                                    AS7341_ADDR, TCS34725_ADDR, OPT4048_ADDR,
                                    AS7265X_ADDR, AS7331_ADDR, 0x24 /*PN532*/ };
    Serial.print("  I2C:"); Serial.flush();
    for (size_t i = 0; i < sizeof(knownAddrs); i++) {
        Wire.beginTransmission(knownAddrs[i]);
        uint8_t err = Wire.endTransmission();
        if (err == 0) { Serial.printf(" 0x%02X", knownAddrs[i]); Serial.flush(); }
    }
    Serial.println(); Serial.flush();
    // Keep short timeout during sensor detection — restored after init
    Wire.setTimeOut(100);
    display.showMessage("Booting...", "I2C done");

    // Hardware-rooted device identity (eFuse HMAC)
    display.showMessage("Booting...", "Identity");
    deviceIdentity.begin();

    // NFC reader
    display.showMessage("Booting...", "NFC");
    initNfc();

    // TOF distance sensor
    display.showMessage("Booting...", "TOF");
    distanceSensor.begin();

    // Color sensor (auto-detect)
    display.showMessage("Booting...", "Color");
    colorSensor.begin();

    // Environmental sensor (auto-detect)
    display.showMessage("Booting...", "Environment");
    envSensor.begin();

    // Weight
    display.showMessage("Booting...", "Weight");
    scale.begin();
    float savedCal = loadCalibration();
    if (savedCal != 0) {
        scale.setScale(savedCal);
        Serial.printf("  Calibration: %.4f (from NVS)\n", savedCal);
    }
    if (scale.isConnected()) {
        scale.tare();
        scale.startTask(0, 2);  // Weight task on Core 0, loop() on Core 1
    }

    // Build hardware manifest from detected sensors
    DeviceCapabilities caps;
    if (nfcScanner.isConnected())
        caps.nfc.set("PN532", "SPI", 0, NFC_CS_PIN);
    if (scale.isConnected()) {
        if (scale.getDriverType() == WEIGHT_NAU7802)
            caps.scale.set("NAU7802", "I2C", NAU7802_ADDR);
        else
            caps.scale.set("HX711", "GPIO", 0, HX711_SCK_PIN, HX711_DT_PIN);
    }
    if (distanceSensor.isConnected())
        caps.tof.set("VL53L1X", "I2C", VL53L1X_ADDR);
    if (colorSensor.isConnected()) {
        const char* chipName = "Unknown";
        uint8_t addr = 0;
        switch (colorSensor.getType()) {
            case COLOR_AS7341:   chipName = "AS7341";  addr = AS7341_ADDR;  break;
            case COLOR_AS7343:   chipName = "AS7343";  addr = AS7341_ADDR;  break;
            case COLOR_AS7265X:  chipName = "AS7265x"; addr = AS7265X_ADDR; break;
            case COLOR_TCS34725: chipName = "TCS34725"; addr = TCS34725_ADDR; break;
            case COLOR_OPT4048:  chipName = "OPT4048"; addr = OPT4048_ADDR; break;
            case COLOR_AS7331:   chipName = "AS7331";  addr = AS7331_ADDR;  break;
            default: break;
        }
        caps.colorSensor.set(chipName, "I2C", addr);
    }
#ifdef BOARD_SCAN_TOUCH
    caps.display.set("ILI9341", "SPI", 0, TFT_CS_PIN);
#else
    caps.display.set("ST7789", "SPI", 0, TFT_CS_PIN);
#endif
    caps.leds.set("WS2812B", "GPIO", 0, LED_PIN);
    if (envSensor.isConnected())
        caps.environment.set(envSensor.getChipName(), "I2C", envSensor.getI2CAddr());

    // Label printer — BLE scan
    display.showMessage("Booting...", "BLE Printer");
    labelPrinter.begin();
    if (labelPrinter.scan(5000)) {
        const char* prName = labelPrinter.getDeviceName();
        const char* prAddr = labelPrinter.getBleAddr();
        caps.printer.set(prName, "BLE",
                         PRINTER_MAX_WIDTH_MM, PRINTER_MAX_HEIGHT_MM,
                         PRINTER_DPI, "escpos");
        caps.printer.setBle(prAddr);

        char prMsg[48];
        snprintf(prMsg, sizeof(prMsg), "%s", prName);
        display.showMessage("Printer Found", prMsg);
        delay(500);

        // Auto-connect
        if (labelPrinter.connect()) {
            display.showMessage("Printer Ready", prMsg);
            delay(500);
        }
    } else {
        display.showMessage("No Printer", "Continuing...");
        delay(500);
    }

    // Device config (loads from NVS)
    deviceConfig.begin();

    // API client (loads WiFi creds from NVS)
    apiClient.begin();
    apiClient.setCapabilities(caps);

    // Try WiFi if configured
    if (apiClient.connectWiFi()) {
        wifiEverConnected = true;
        display.showMessage("WiFi Connected", WiFi.localIP().toString().c_str());
        delay(1000);

        // Check if we need to pair with the backend
        if (apiClient.hasApiUrl() && !apiClient.isPaired()) {
            startPairing();
        }
    } else {
        // Start WiFi AP + captive portal provisioning
        startProvisioning();
    }

    // OTA updates
    otaBegin();

    Wire.setTimeOut(500);  // Restore normal I2C timeout for runtime
    backlight.idle();
    enterState(SCAN_IDLE);

    Serial.println("\nReady. Type 'help' for commands.\n");
}

// ============================================================
// Main Loop (Core 0)
// ============================================================

static unsigned long lastDisplayUpdate = 0;
static unsigned long lastSerialStatus = 0;
static unsigned long lastEnvReport = 0;

void loop() {
    unsigned long now = millis();

    // LVGL tick — must run frequently for rendering + animations
    display.tick();

    // Snapshot weight once per loop (avoids repeated mutex acquisitions)
    snapshotWeight();

    // NFC polling (main loop, not a separate task)
    pollNfc();

    // Captive portal processing (must run frequently when AP is active)
    provisioner.loop();

    // OTA update check
    if (!otaInProgress()) {
        otaLoop();
    }

    // Skip everything else during OTA
    if (otaInProgress()) return;

    // WiFi management (only when not in setup mode)
    if (!provisioner.isActive()) {
        tryWifiConnect();
    }

    // Captive portal provisioning check
    checkProvisioning();

    // Device pairing poll
    if (pairingActive && now - lastPairingPoll >= PAIRING_POLL_INTERVAL_MS) {
        lastPairingPoll = now;
        bool paired = false;
        ApiStatus pairStatus = apiClient.pollPairingStatus(paired);
        if (paired) {
            pairingActive = false;
            display.showMessage("Paired!", "Ready to scan");
            delay(2000);
        } else if (pairStatus == API_EXPIRED) {
            // Code expired — request a new one
            Serial.println("[Pair] Code expired, requesting new code");
            startPairing();
        } else if (pairStatus != API_OK) {
            Serial.printf("[Pair] Poll error: %d\n", pairStatus);
        }
    }

    // Environmental data reporting (every 5 min)
    if (envSensor.isConnected() && apiClient.isPaired() && apiClient.isWiFiConnected()
        && now - lastEnvReport >= deviceConfig.envReportInterval()) {
        lastEnvReport = now;
        EnvData env;
        if (envSensor.read(env)) {
            apiClient.postEnvironment(env);
        }
    }

    // Scan state machine (skip while pairing)
    if (!pairingActive) {
        updateScanState();
    }

    // Display + LED (throttled, skip while in setup mode or pairing — screen is showing code)
    if (!provisioner.isActive() && !pairingActive && now - lastDisplayUpdate >= 100) {
        lastDisplayUpdate = now;
        updateDisplayAndLed();
    }

    // Periodic serial status line
    if (now - lastSerialStatus >= deviceConfig.statusInterval()) {
        lastSerialStatus = now;
        float w = weightSnap.stable ? weightSnap.stableWeight : weightSnap.weight;

        // [State] W:123.4g STABLE | NFC:04:A2:.. [PLA] | T:23.1C H:45%
        Serial.printf("[%s] W:%.1fg%s",
            scanStateName(scanState), w, weightSnap.stable ? " STABLE" : "");

        if (nfcScanner.isTagPresent()) {
            Serial.printf(" | NFC:%s", nfcScanner.getUidString().c_str());
            if (lastResponse.material[0])
                Serial.printf(" [%s]", lastResponse.material);
        }

        if (lastResponse.identified && lastResponse.itemName[0])
            Serial.printf(" | %s", lastResponse.itemName);

        static EnvData envData;
        if (envSensor.read(envData)) {
            Serial.printf(" | %.1fC %.0f%%", envData.temperatureC, envData.humidity);
        }

        Serial.println();
    }

    // Serial commands
    handleSerial();
}
