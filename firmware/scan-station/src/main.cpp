#include <Arduino.h>
#include <SPI.h>
#include <Wire.h>

#include "scan_config.h"
#include "sensors.h"
#include "weight.h"
#include "nfc.h"
#include "turntable.h"
#include "backlight.h"
#include "color.h"
#include "distance.h"
#include "api_client.h"

// ============================================================
// Filla IQ — Scan Station Main
// State machine: detect object → read sensors → post → display result
// ============================================================

// --- State ---
static ScanState state = SCAN_IDLE;
static ScanResult currentScan;
static ScanResponse lastResponse;
static unsigned long stateEnteredAt = 0;
static unsigned long lastApiPoll = 0;

// --- Forward declarations ---
void handleSerial();
void transitionTo(ScanState newState);
void runStateMachine();

// ==================== Setup ====================

void setup() {
    Serial.begin(SERIAL_BAUD);
    delay(1000);
    Serial.println("\n========================================");
    Serial.println("  Filla IQ — Scan Station v0.1");
    Serial.println("========================================\n");

    // Init SPI bus (shared with PN532)
    SPI.begin(NFC_SCK_PIN, NFC_MISO_PIN, NFC_MOSI_PIN);

    // Init I2C bus (AS7341, VL53L1X, future sensors)
    Wire.begin(I2C_SDA_PIN, I2C_SCL_PIN);

    // Hold VL53L1X in reset so TCS34725 can init at 0x29 first
    pinMode(VL53L1X_XSHUT_PIN, OUTPUT);
    digitalWrite(VL53L1X_XSHUT_PIN, LOW);

    // Init subsystems
    Serial.println("Initializing subsystems...");

    backlight.begin();
    backlight.idle();

    scale.begin();
    scale.startTask(1, 2);  // Weight reading on Core 1

    initNfc();

    // Color sensor first (TCS34725 needs 0x29 before VL53L1X is released)
    colorSensor.begin();

    // TOF distance (releases XSHUT, reprograms VL53L1X to 0x52)
    distanceSensor.begin();

    turntable.begin();

    apiClient.begin();
    apiClient.connectWiFi();

    Serial.println("\nScan station ready. Place an object on the platform.\n");
    Serial.println("Commands: tare, cal, status, wifi <ssid> <pass>,");
    Serial.println("          apiurl <url>, apikey <key>, home, rotate <deg>\n");

    state = SCAN_IDLE;
    stateEnteredAt = millis();
}

// ==================== Loop ====================

void loop() {
    // NFC polling (non-blocking, one read per call)
    pollNfc();

    // LED animations
    backlight.update();

    // Turntable non-blocking stepping
    turntable.stepIfNeeded();

    // State machine
    runStateMachine();

    // Serial commands
    handleSerial();
}

// ==================== State Machine ====================

void transitionTo(ScanState newState) {
    Serial.printf("[State] %s -> %s\n", scanStateName(state), scanStateName(newState));
    state = newState;
    stateEnteredAt = millis();
}

void runStateMachine() {
    unsigned long now = millis();
    unsigned long elapsed = now - stateEnteredAt;

    switch (state) {
        case SCAN_IDLE: {
            // Watch for object placement
            if (scale.isStable() && scale.getStableWeight() > OBJECT_PRESENT_THRESHOLD) {
                currentScan.clear_data();
                lastResponse.clear();
                transitionTo(SCAN_DETECTED);
                backlight.scanning();
            }
            break;
        }

        case SCAN_DETECTED: {
            // Wait for weight to stabilize, then start sensor reads
            if (elapsed > SCAN_DEBOUNCE_MS && scale.isStable()) {
                transitionTo(SCAN_READING);
            }
            // Object removed before stabilizing?
            if (scale.getWeight() < OBJECT_REMOVED_THRESHOLD) {
                transitionTo(SCAN_IDLE);
                backlight.idle();
            }
            break;
        }

        case SCAN_READING: {
            // Gather all sensor data
            // Weight
            currentScan.weight.grams = scale.getStableWeight();
            currentScan.weight.stable = scale.isStable();
            currentScan.weight.valid = true;

            // NFC (already being polled in background)
            if (nfcScanner.isTagPresent()) {
                currentScan.nfcPresent = true;
                uint8_t uid[NFC_UID_MAX_LEN];
                uint8_t uidLen;
                nfcScanner.getUid(uid, &uidLen);
                currentScan.nfcUidLen = uidLen;
                // Format UID string
                String uidStr = nfcScanner.getUidString();
                strncpy(currentScan.nfcUid, uidStr.c_str(), sizeof(currentScan.nfcUid) - 1);
                // Tag type
                if (nfcScanner.hasTagData()) {
                    currentScan.nfcTagType = nfcScanner.getTagData().type;
                }
            }

            // Turntable angle
            currentScan.turntable.angleDeg = turntable.getAngle();
            currentScan.turntable.homed = turntable.isHomed();

            // Color sensor (auto-detected type)
            colorSensor.read(currentScan.color);

            // TOF height
            distanceSensor.read(currentScan.height);

            currentScan.timestamp = now;

            // Wait for NFC read to complete (if tag present)
            bool nfcDone = !nfcScanner.isTagPresent() || nfcScanner.hasTagData();
            bool timeoutReached = elapsed > SCAN_STABILIZE_MS;

            if (nfcDone && timeoutReached) {
                // Print summary
                Serial.println("\n--- Scan Complete ---");
                Serial.printf("  Weight: %.1fg %s\n",
                    currentScan.weight.grams,
                    currentScan.weight.stable ? "[stable]" : "");
                if (currentScan.nfcPresent) {
                    Serial.printf("  NFC: %s (type=%d)\n",
                        currentScan.nfcUid, currentScan.nfcTagType);
                    if (nfcScanner.hasFilamentInfo()) {
                        const FilamentInfo& fi = nfcScanner.getFilamentInfo();
                        Serial.printf("  Bambu: %s %s (%s)\n", fi.brand, fi.name, fi.material);
                    }
                } else {
                    Serial.println("  NFC: no tag");
                }

                // Post to server
                if (apiClient.isWiFiConnected()) {
                    transitionTo(SCAN_POSTING);
                } else {
                    // No WiFi — show local result only
                    Serial.println("  (No WiFi — local data only)");
                    if (nfcScanner.hasFilamentInfo()) {
                        transitionTo(SCAN_IDENTIFIED);
                        backlight.success();
                    } else {
                        transitionTo(SCAN_NEEDS_INPUT);
                        backlight.needsInput();
                    }
                }
            }
            break;
        }

        case SCAN_ROTATING: {
            // Future: rotate turntable during scan for multi-angle reads
            if (!turntable.isMoving()) {
                transitionTo(SCAN_POSTING);
            }
            break;
        }

        case SCAN_POSTING: {
            backlight.spin(0, 100, 255);

            const TagData* td = nfcScanner.hasTagData() ? &nfcScanner.getTagData() : nullptr;
            ApiStatus result = apiClient.postScan(currentScan, td, lastResponse);

            if (result == API_OK) {
                Serial.printf("  Server: scanId=%s\n", lastResponse.scanId);
                if (lastResponse.identified) {
                    Serial.printf("  Identified: %s (%s, %.0f%%)\n",
                        lastResponse.itemName, lastResponse.itemType,
                        lastResponse.confidence * 100);
                    transitionTo(SCAN_IDENTIFIED);
                    backlight.success();
                } else if (lastResponse.needsCamera) {
                    Serial.println("  Server needs camera input");
                    transitionTo(SCAN_NEEDS_INPUT);
                    backlight.needsInput();
                } else {
                    transitionTo(SCAN_AWAITING_RESULT);
                }
            } else {
                Serial.printf("  API error: %d\n", result);
                backlight.error();
                // Fall back to local result
                if (nfcScanner.hasFilamentInfo()) {
                    transitionTo(SCAN_IDENTIFIED);
                    backlight.success();
                } else {
                    transitionTo(SCAN_NEEDS_INPUT);
                    backlight.needsInput();
                }
            }
            break;
        }

        case SCAN_AWAITING_RESULT: {
            // Poll server periodically
            if (now - lastApiPoll > API_POLL_INTERVAL_MS) {
                lastApiPoll = now;
                ApiStatus result = apiClient.pollResult(lastResponse.scanId, lastResponse);
                if (result == API_OK && lastResponse.identified) {
                    Serial.printf("  Identified: %s\n", lastResponse.itemName);
                    transitionTo(SCAN_IDENTIFIED);
                    backlight.success();
                } else if (result == API_OK && lastResponse.needsCamera) {
                    transitionTo(SCAN_NEEDS_INPUT);
                    backlight.needsInput();
                }
            }
            // Timeout after 30s
            if (elapsed > 30000) {
                Serial.println("  Identification timeout");
                transitionTo(SCAN_NEEDS_INPUT);
                backlight.needsInput();
            }
            break;
        }

        case SCAN_IDENTIFIED:
        case SCAN_NEEDS_INPUT: {
            // Stay in this state until object is removed
            if (scale.getWeight() < OBJECT_REMOVED_THRESHOLD) {
                Serial.println("\nObject removed.\n");
                transitionTo(SCAN_IDLE);
                backlight.idle();
            }
            break;
        }
    }
}

// ==================== Serial Command Handler ====================

void handleSerial() {
    if (!Serial.available()) return;

    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) return;

    if (line == "tare") {
        Serial.println("Taring...");
        scale.tare();
        Serial.println("Done.");
    }
    else if (line == "status") {
        Serial.println("\n========================================");
        Serial.printf("State: %s\n\n", scanStateName(state));
        scale.printStatus();
        nfcScanner.printStatus();
        colorSensor.printStatus();
        distanceSensor.printStatus();
        turntable.printStatus();
        backlight.printStatus();
        apiClient.printStatus();
        Serial.println("========================================\n");
    }
    else if (line == "home") {
        Serial.println("Homing turntable...");
        turntable.home();
    }
    else if (line.startsWith("rotate ")) {
        float deg = line.substring(7).toFloat();
        Serial.printf("Rotating %.1f degrees...\n", deg);
        turntable.rotateDegrees(deg);
        Serial.printf("Angle: %.1f\n", turntable.getAngle());
    }
    else if (line.startsWith("wifi ")) {
        int spaceIdx = line.indexOf(' ', 5);
        if (spaceIdx > 0) {
            String ssid = line.substring(5, spaceIdx);
            String pass = line.substring(spaceIdx + 1);
            apiClient.setCredentials(ssid.c_str(), pass.c_str());
            Serial.printf("WiFi credentials saved. Connecting to %s...\n", ssid.c_str());
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
        Serial.println("API key saved.");
    }
    else if (line == "scan") {
        // Force a scan even if weight is low (for testing)
        Serial.println("Forcing scan...");
        currentScan.clear_data();
        transitionTo(SCAN_READING);
        backlight.scanning();
    }
    else if (line == "led off") { backlight.off(); }
    else if (line == "led white") { backlight.white(); }
    else if (line == "led rainbow") { backlight.rainbow(); }
    else if (line == "led green") { backlight.success(); }
    else if (line == "led red") { backlight.error(); }
    else if (line == "led yellow") { backlight.needsInput(); }
    else {
        Serial.printf("Unknown command: %s\n", line.c_str());
        Serial.println("Commands: tare, status, home, rotate <deg>, scan,");
        Serial.println("          wifi <ssid> <pass>, apiurl <url>, apikey <key>,");
        Serial.println("          led off|white|rainbow|green|red|yellow");
    }
}
