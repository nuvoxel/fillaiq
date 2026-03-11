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

// ============================================================
// Filla IQ — Scan Station Firmware
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
    }
}

// ── Captive Portal Provisioning Check ─────────────────────────────────────────

void checkProvisioning() {
    if (!provisioner.hasNewCredentials()) return;

    char ssid[64] = {0}, pass[64] = {0}, url[256] = {0}, key[128] = {0};
    provisioner.getCredentials(ssid, pass, url, key,
                                sizeof(ssid), sizeof(pass), sizeof(url), sizeof(key));
    provisioner.clearNewCredentials();

    Serial.printf("[Provision] Applying: SSID=%s\n", ssid);

    // Stop AP and captive portal before switching to STA
    provisioner.stop();
    display.showMessage("Connecting...", ssid);

    apiClient.setCredentials(ssid, pass);
    if (url[0]) apiClient.setApiUrl(url);
    if (key[0]) apiClient.setApiKey(key);

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
        // Already paired
        display.showMessage("Paired!", "Ready to scan");
        delay(2000);
        return;
    }

    if (status == API_OK && code[0] != '\0') {
        // Show pairing code on display
        pairingActive = true;
        lastPairingPoll = millis();

        // Build a message with the code
        char line2[48];
        snprintf(line2, sizeof(line2), "Code: %s", code);
        display.showMessage("Pair Device", line2);

        Serial.printf("[Pair] Enter code on web app: %s\n", code);
    } else {
        Serial.printf("[Pair] Failed to get pairing code: %d\n", status);
        display.showMessage("Pair Failed", "Check API URL");
        delay(3000);
    }
}

// ── Scan State Machine Logic ──────────────────────────────────────────────────

void updateScanState() {
    float w = scale.getWeight();
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
        currentScan.weight.grams = scale.isStable() ? scale.getStableWeight() : scale.getWeight();
        currentScan.weight.stable = scale.isStable();
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
        bool ready = scale.isStable() && (nfcDone || elapsed > 5000);

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
            // No WiFi — show local data only
            if (nfcScanner.hasFilamentInfo()) {
                const FilamentInfo& fi = nfcScanner.getFilamentInfo();
                display.update(SCAN_IDENTIFIED, currentScan.weight.grams, true,
                              currentScan.nfcUid, &fi, nullptr, nullptr);
                backlight.color(fi.color_r, fi.color_g, fi.color_b);
            } else {
                display.update(SCAN_NEEDS_INPUT, currentScan.weight.grams, true,
                              currentScan.nfcUid, nullptr, nullptr, nullptr);
                backlight.needsInput();
            }
            enterState(SCAN_NEEDS_INPUT);
            break;
        }

        if (now - lastApiPost < API_POST_DEBOUNCE_MS) break;
        lastApiPost = now;

        const TagData* tagPtr = nfcScanner.hasTagData() ? &nfcScanner.getTagData() : nullptr;
        ApiStatus status = apiClient.postScan(currentScan, tagPtr, lastResponse);

        if (status == API_OK) {
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
            Serial.println("[API] Auth failed — device may have been revoked");
            apiClient.unpair();
            startPairing();
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
                if (pollResp.identified) {
                    lastResponse = pollResp;
                    enterState(SCAN_IDENTIFIED);
                } else if (pollResp.needsCamera) {
                    enterState(SCAN_NEEDS_INPUT);
                }
            } else if (status == API_AUTH_FAILED) {
                apiClient.unpair();
                startPairing();
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
    float w = scale.isStable() ? scale.getStableWeight() : scale.getWeight();
    bool stable = scale.isStable();

    // Cache NFC data — persist after tag removal until spool is lifted
    static char uidBuf[32];
    static bool hasUid = false;
    static FilamentInfo cachedFilament;
    static bool hasFilament = false;

    // Update cache when tag is present
    if (nfcScanner.isTagPresent()) {
        String uidStr = nfcScanner.getUidString();
        strncpy(uidBuf, uidStr.c_str(), sizeof(uidBuf) - 1);
        uidBuf[sizeof(uidBuf) - 1] = '\0';
        hasUid = true;
    }
    if (nfcScanner.hasFilamentInfo()) {
        cachedFilament = nfcScanner.getFilamentInfo();
        hasFilament = true;
    }

    // Clear cache when spool is removed (weight drops)
    if (scanState == SCAN_IDLE) {
        hasUid = false;
        hasFilament = false;
    }

    const char* uid = hasUid ? uidBuf : nullptr;
    const FilamentInfo* filament = hasFilament ? &cachedFilament : nullptr;

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
    display.update(scanState, w, stable, uid, filament, dist, color, icons);

    // LED backlight based on state
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
        if (filament) {
            backlight.color(filament->color_r, filament->color_g, filament->color_b);
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

    backlight.update();
}

// ── Serial Commands ───────────────────────────────────────────────────────────

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

    // Normal commands
    if (line == "tare") {
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
        // wifi <ssid> <password>
        int spaceIdx = line.indexOf(' ', 5);
        if (spaceIdx > 5) {
            String ssid = line.substring(5, spaceIdx);
            String pass = line.substring(spaceIdx + 1);
            apiClient.setCredentials(ssid.c_str(), pass.c_str());
            Serial.printf("WiFi set: %s\n", ssid.c_str());
            apiClient.connectWiFi();
        } else {
            Serial.println("Usage: wifi <ssid> <password>");
        }
    }
    else if (line.startsWith("apiurl ")) {
        apiClient.setApiUrl(line.substring(7).c_str());
        Serial.printf("API URL set: %s\n", line.substring(7).c_str());
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
    else if (line == "status" || line == "s") {
        Serial.println("\n========================================");
        Serial.printf("Scan state: %s\n", scanStateName(scanState));
        scale.printStatus();
        nfcScanner.printStatus();
        apiClient.printStatus();
        Serial.printf("Setup AP: %s\n", provisioner.isActive() ? "active" : "off");
        Serial.println("========================================\n");
    }
    else if (line == "nfc") {
        nfcScanner.printStatus();
    }
    else if (line == "i2c") {
        Serial.print("I2C scan:");
        for (uint8_t addr = 1; addr < 127; addr++) {
            Wire.beginTransmission(addr);
            if (Wire.endTransmission() == 0) {
                Serial.printf(" 0x%02X", addr);
            }
        }
        Serial.println();
    }
    else if (line == "ota") {
        Serial.println("Checking for OTA update...");
        otaCheckNow();
    }
    else if (line == "pair") {
        if (apiClient.isPaired()) {
            Serial.println("Already paired. Use 'unpair' first to re-pair.");
        } else if (!apiClient.isWiFiConnected()) {
            Serial.println("No WiFi connection.");
        } else {
            startPairing();
        }
    }
    else if (line == "unpair") {
        apiClient.unpair();
        Serial.println("Device unpaired.");
    }
    else if (line == "reset" || line == "reboot") {
        Serial.println("Rebooting...");
        delay(500);
        ESP.restart();
    }
    else {
        Serial.println("Commands: tare, cal, calreset, wifi, apiurl, apikey, provision, status, nfc, i2c, ota, pair, unpair, reset");
    }
}

// ============================================================
// Setup
// ============================================================

void setup() {
    Serial.begin(SERIAL_BAUD);
    delay(1000);
    Serial.println("\n========================================");
    Serial.printf("  Filla IQ — Scan Station v%s (%s)\n", FW_VERSION, FW_CHANNEL);
    Serial.println("========================================\n");

    // I2C bus (TOF + Color)
    Wire.begin(I2C_SDA, I2C_SCL);
    Wire.setTimeOut(500);

    // I2C scan (skip 0x3C SSD1306 — U8g2 handles it)
    Serial.print("  I2C:");
    for (uint8_t addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        uint8_t err = Wire.endTransmission();
        if (err == 0) Serial.printf(" 0x%02X", addr);
        if (err == 4) Serial.printf(" 0x%02X?", addr);  // unknown error
    }
    Serial.println();

    // Init subsystems
    backlight.begin();
    backlight.color(0, 0, 255);  // Blue = booting

    display.begin();
    char bootMsg[48];
    snprintf(bootMsg, sizeof(bootMsg), "v%s %s", FW_VERSION, FW_CHANNEL);
    display.showMessage("Filla IQ", bootMsg);

    // NFC reader
    initNfc();

    // TOF distance sensor
    distanceSensor.begin();

    // Color sensor (auto-detect)
    colorSensor.begin();

    // Weight
    scale.begin();
    float savedCal = loadCalibration();
    if (savedCal != 0) {
        scale.setScale(savedCal);
        Serial.printf("  Calibration: %.4f (from NVS)\n", savedCal);
    }
    if (scale.isConnected()) {
        scale.tare();
        scale.startTask(0, 2);  // Core 0 (loop runs on Core 1)
    }

    // API client (loads WiFi creds from NVS)
    apiClient.begin();

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

    backlight.idle();
    enterState(SCAN_IDLE);

    Serial.println("\nReady. Type 'status' for info.\n");
}

// ============================================================
// Main Loop (Core 0)
// ============================================================

static unsigned long lastDisplayUpdate = 0;
static unsigned long lastNfcPollTime = 0;
static unsigned long lastSerialStatus = 0;

void loop() {
    unsigned long now = millis();

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

    // Scan state machine (skip while pairing)
    if (!pairingActive) {
        updateScanState();
    }

    // Display + LED (throttled, skip while in setup mode or pairing — screen is showing code)
    if (!provisioner.isActive() && !pairingActive && now - lastDisplayUpdate >= 100) {
        lastDisplayUpdate = now;
        updateDisplayAndLed();
    }

    // Periodic serial status (every 2s)
    if (now - lastSerialStatus >= 2000) {
        lastSerialStatus = now;
        float w = scale.isStable() ? scale.getStableWeight() : scale.getWeight();
        Serial.printf("W:%.1fg%s", w, scale.isStable() ? " STABLE" : "");
        if (nfcScanner.isTagPresent()) {
            String uid = nfcScanner.getUidString();
            Serial.printf(" NFC:%s", uid.c_str());
            if (nfcScanner.hasFilamentInfo()) {
                Serial.printf(" [%s]", nfcScanner.getFilamentInfo().name);
            }
        }
        Serial.println();
    }

    // Serial commands
    handleSerial();
}
