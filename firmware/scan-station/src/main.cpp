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
#ifdef BOARD_SCAN_TOUCH
#include "touch.h"
#include "sdcard.h"
#include "audio.h"
#endif
#include <BLEDevice.h>
#include <BLEScan.h>

// ============================================================
// Filla IQ -- FillaScan Firmware
//
// Architecture (ESP32-S3 dual-core):
//   Core 1 (Arduino loop): UI, display, LVGL, I2C sensors, state machine
//   Core 0 (NFC task):     PN5180 SPI polling -- dedicated HSPI bus
//   Core 0 (Network task): WiFi, HTTP API, OTA -- all blocking network I/O
//   Core 0 (Weight task):  HX711 bit-bang only (NAU7802 polled on Core 1)
//
// Bus ownership:
//   Wire (I2C):    Core 1 only (touch, NAU7802, TOF, color, env)
//   nfcSPI (HSPI): NFC task only (PN5180)
//   WiFi/HTTP:     Network task only
//   Display/LVGL:  Core 1 only
// ============================================================

static Preferences prefs;

// Forward declarations
void startProvisioning();
void startPairing();

// Pairing state
bool pairingActive = false;
unsigned long lastPairingPoll = 0;
#define PAIRING_POLL_INTERVAL_MS  5000

// Auth failure tracking -- only unpair after consecutive failures
uint8_t authFailCount = 0;
#define AUTH_FAIL_THRESHOLD  3

// Menu action flags (set by LVGL callbacks, processed in main loop)
#ifdef BOARD_SCAN_TOUCH
enum MenuAction : uint8_t { MENU_NONE = 0, MENU_FORMAT_SD, MENU_WIFI_SETUP, MENU_TARE_SCALE, MENU_RAW_SENSORS, MENU_CALIBRATE, MENU_REBOOT };
volatile MenuAction menuActionPending = MENU_NONE;
#endif

// ============================================================
// FreeRTOS Shared State
// ============================================================

// -- NFC Task Result (written by NFC task, read by main loop) --
struct NfcTaskResult {
    SemaphoreHandle_t mutex;
    bool tagPresent;
    bool tagIsNew;          // set true when new tag detected, cleared by main loop
    uint8_t uid[NFC_UID_MAX_LEN];
    uint8_t uidLen;
    TagData tagData;
    unsigned long lastSeen;
    bool hasData;           // tagData is valid
    bool connected;         // NFC reader detected
    String uidString;       // cached UID string
};

static NfcTaskResult nfcResult;

// -- Network Work Queue --
enum NetworkWorkType : uint8_t {
    NET_POST_SCAN,
    NET_CHECK_OTA,
    NET_POLL_PAIRING,
    NET_POST_ENV,
    NET_WIFI_CONNECT,
    NET_POLL_RESULT,
};

struct NetworkWorkItem {
    NetworkWorkType type;
    // For NET_POLL_RESULT: scan ID is read from shared state
};

#define NET_QUEUE_SIZE 8
static QueueHandle_t networkQueue;

// -- Shared scan data for network task (protected by mutex) --
struct SharedScanData {
    SemaphoreHandle_t mutex;

    // Input: main loop writes before enqueueing NET_POST_SCAN
    ScanResult scanResult;
    TagData tagData;
    bool hasTagData;

    // Output: network task writes after API response
    ScanResponse response;
    ApiStatus lastStatus;
    bool responseReady;     // new response available
    bool postInFlight;      // a post is currently being processed

    // For NET_POLL_RESULT
    char pollScanId[64];
    ScanResponse pollResponse;
    ApiStatus pollStatus;
    bool pollReady;
    bool pollInFlight;

    // For NET_POLL_PAIRING
    bool pairingPollResult;
    ApiStatus pairingPollStatus;
    bool pairingPollReady;

    // WiFi connect result
    bool wifiConnectResult;
    bool wifiConnectReady;

    // For NET_POST_ENV: env data written by main loop before enqueue
    EnvData envData;
};

static SharedScanData sharedScan;

// -- OTA progress flag (set by network task, read by main loop) --
static volatile bool otaRunning = false;

// Task handles
static TaskHandle_t nfcTaskHandle = nullptr;
static TaskHandle_t networkTaskHandle = nullptr;

// ============================================================
// NFC Task (Core 0, Priority 2, 8KB stack)
// ============================================================
// Owns the HSPI bus (PN5180). Calls pollNfc() which uses nfcScanner.poll().
// Writes results into nfcResult protected by mutex.

static void nfcTask(void* param) {
    Serial.println("[NFC Task] Started on core " + String(xPortGetCoreID()));

    for (;;) {
        // Poll NFC reader (this accesses HSPI only)
        nfcScanner.poll();

        // Copy results to shared struct
        if (xSemaphoreTake(nfcResult.mutex, pdMS_TO_TICKS(10)) == pdTRUE) {
            bool wasPresent = nfcResult.tagPresent;
            uint8_t oldUid[NFC_UID_MAX_LEN];
            uint8_t oldUidLen = nfcResult.uidLen;
            memcpy(oldUid, nfcResult.uid, NFC_UID_MAX_LEN);

            nfcResult.tagPresent = nfcScanner.isTagPresent();
            nfcResult.connected = nfcScanner.isConnected();

            if (nfcResult.tagPresent) {
                uint8_t uid[NFC_UID_MAX_LEN];
                uint8_t uidLen;
                nfcScanner.getUid(uid, &uidLen);

                // Detect new tag
                bool isNew = !wasPresent ||
                    uidLen != oldUidLen ||
                    memcmp(uid, oldUid, uidLen) != 0;

                memcpy(nfcResult.uid, uid, uidLen);
                nfcResult.uidLen = uidLen;
                nfcResult.lastSeen = millis();
                nfcResult.uidString = nfcScanner.getUidString();

                if (isNew) {
                    nfcResult.tagIsNew = true;
                }

                if (nfcScanner.hasTagData()) {
                    nfcResult.tagData = nfcScanner.getTagData();
                    nfcResult.hasData = true;
                }
            } else {
                // Tag removed
                if (wasPresent) {
                    nfcResult.tagPresent = false;
                    nfcResult.hasData = false;
                    nfcResult.uidLen = 0;
                    nfcResult.uidString = "";
                }
            }

            xSemaphoreGive(nfcResult.mutex);
        }

        vTaskDelay(pdMS_TO_TICKS(NFC_POLL_INTERVAL_MS));
    }
}

// ============================================================
// Network Task (Core 0, Priority 1, 8KB stack)
// ============================================================
// Owns all WiFi/HTTP operations. Receives work items from main loop via queue.
// Also runs periodic WiFi reconnect and OTA checks on its own timers.

static void networkTask(void* param) {
    Serial.println("[Net Task] Started on core " + String(xPortGetCoreID()));

    unsigned long lastWifiAttempt = 0;
    unsigned long lastOtaCheck = millis();
    unsigned long lastEnvReport = 0;
    bool wifiEverConnected_net = false;

    for (;;) {
        // Process queued work items (non-blocking peek with short timeout)
        NetworkWorkItem item;
        if (xQueueReceive(networkQueue, &item, pdMS_TO_TICKS(100)) == pdTRUE) {
            switch (item.type) {

            case NET_POST_SCAN: {
                ScanResult scanCopy;
                TagData tagCopy;
                bool hasTag;

                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                    scanCopy = sharedScan.scanResult;
                    tagCopy = sharedScan.tagData;
                    hasTag = sharedScan.hasTagData;
                    xSemaphoreGive(sharedScan.mutex);
                } else {
                    break;
                }

                const TagData* tagPtr = hasTag ? &tagCopy : nullptr;
                ScanResponse resp;
                ApiStatus status = apiClient.postScan(scanCopy, tagPtr, resp);

                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                    sharedScan.response = resp;
                    sharedScan.lastStatus = status;
                    sharedScan.responseReady = true;
                    sharedScan.postInFlight = false;
                    xSemaphoreGive(sharedScan.mutex);
                }
                break;
            }

            case NET_POLL_RESULT: {
                char scanId[64];
                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                    strncpy(scanId, sharedScan.pollScanId, sizeof(scanId));
                    xSemaphoreGive(sharedScan.mutex);
                } else {
                    break;
                }

                if (scanId[0] == '\0') break;

                ScanResponse pollResp;
                ApiStatus status = apiClient.pollResult(scanId, pollResp);

                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                    sharedScan.pollResponse = pollResp;
                    sharedScan.pollStatus = status;
                    sharedScan.pollReady = true;
                    sharedScan.pollInFlight = false;
                    xSemaphoreGive(sharedScan.mutex);
                }
                break;
            }

            case NET_POLL_PAIRING: {
                bool paired = false;
                ApiStatus status = apiClient.pollPairingStatus(paired);

                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                    sharedScan.pairingPollResult = paired;
                    sharedScan.pairingPollStatus = status;
                    sharedScan.pairingPollReady = true;
                    xSemaphoreGive(sharedScan.mutex);
                }
                break;
            }

            case NET_POST_ENV: {
                EnvData env;
                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                    env = sharedScan.envData;
                    xSemaphoreGive(sharedScan.mutex);
                } else {
                    break;
                }
                if (env.valid) {
                    apiClient.postEnvironment(env);
                }
                break;
            }

            case NET_WIFI_CONNECT: {
                bool result = apiClient.connectWiFi();
                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                    sharedScan.wifiConnectResult = result;
                    sharedScan.wifiConnectReady = true;
                    xSemaphoreGive(sharedScan.mutex);
                }
                if (result) wifiEverConnected_net = true;
                break;
            }

            case NET_CHECK_OTA: {
                otaRunning = true;
                otaLoop();
                otaRunning = false;
                break;
            }

            } // switch
        }

        // Periodic: WiFi reconnect (every 30s if disconnected)
        {
            unsigned long now = millis();
            if (!apiClient.isWiFiConnected() && wifiEverConnected_net &&
                now - lastWifiAttempt >= WIFI_RETRY_INTERVAL_MS) {
                lastWifiAttempt = now;
                if (apiClient.connectWiFi()) {
                    wifiEverConnected_net = true;
                }
            }
        }

        // Periodic: OTA check (every 5 min after first 30s)
        {
            unsigned long now = millis();
            if (!otaRunning && apiClient.isWiFiConnected() && apiClient.isPaired() &&
                now - lastOtaCheck >= deviceConfig.otaCheckInterval()) {
                lastOtaCheck = now;
                otaRunning = true;
                otaLoop();
                otaRunning = false;
            }
        }

        // Note: Environmental reporting is enqueued by the main loop
        // (sensor reads require I2C which is only safe on Core 1)
    }
}

// ============================================================
// Scan State Machine
// ============================================================

ScanState scanState = SCAN_IDLE;
ScanResult currentScan;
ScanResponse lastResponse;
unsigned long stateEnteredAt = 0;
unsigned long lastApiPost = 0;

void enterState(ScanState newState) {
    if (newState == scanState) return;
    Serial.printf("[State] %s -> %s\n", scanStateName(scanState), scanStateName(newState));
    scanState = newState;
    stateEnteredAt = millis();
}

// -- Calibration State --

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

// -- WiFi Management (enqueues to network task) --

bool wifiEverConnected = false;

void tryWifiConnect() {
    if (apiClient.isWiFiConnected()) return;
    // Don't spam -- the network task handles periodic reconnect
    // But if wifi was never connected, enqueue a connect request
    if (!wifiEverConnected) {
        static unsigned long lastEnqueue = 0;
        unsigned long now = millis();
        if (now - lastEnqueue < WIFI_RETRY_INTERVAL_MS) return;
        lastEnqueue = now;
        NetworkWorkItem item = { NET_WIFI_CONNECT };
        xQueueSend(networkQueue, &item, 0);
    }
}

// -- Captive Portal Provisioning Check --

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

    // Try connecting (blocking -- acceptable during provisioning flow)
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

    // This is a blocking HTTP call -- acceptable during setup flow
    // (only called from setup() or user-initiated actions)
    ApiStatus status = apiClient.requestPairingCode(code, sizeof(code));

    if (status == API_OK && apiClient.isPaired()) {
        // Server recognized device as already paired -- token refreshed
        display.showMessage("Paired!", "Ready to scan");
        delay(1000);
    } else if (status == API_OK && code[0] != '\0') {
        // New pairing -- show code on display
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

// -- Per-loop weight snapshot (avoid repeated mutex acquisitions) --

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

// -- NFC snapshot (read from shared NfcTaskResult, used by state machine) --

struct NfcSnapshot {
    bool tagPresent;
    bool tagIsNew;
    uint8_t uid[NFC_UID_MAX_LEN];
    uint8_t uidLen;
    bool hasData;
    TagData tagData;
    String uidString;
    bool connected;
};
static NfcSnapshot nfcSnap;

void snapshotNfc() {
    if (xSemaphoreTake(nfcResult.mutex, pdMS_TO_TICKS(5)) == pdTRUE) {
        nfcSnap.tagPresent = nfcResult.tagPresent;
        nfcSnap.tagIsNew = nfcResult.tagIsNew;
        memcpy(nfcSnap.uid, nfcResult.uid, NFC_UID_MAX_LEN);
        nfcSnap.uidLen = nfcResult.uidLen;
        nfcSnap.hasData = nfcResult.hasData;
        nfcSnap.connected = nfcResult.connected;
        nfcSnap.uidString = nfcResult.uidString;
        if (nfcResult.hasData) {
            nfcSnap.tagData = nfcResult.tagData;
        }
        // Clear the "new" flag after main loop consumes it
        if (nfcResult.tagIsNew) {
            nfcResult.tagIsNew = false;
        }
        xSemaphoreGive(nfcResult.mutex);
    }
}

// ============================================================
// Scan State Machine Logic
// ============================================================

void updateScanState() {
    unsigned long now = millis();
    unsigned long elapsed = now - stateEnteredAt;

    switch (scanState) {

    case SCAN_IDLE:
        // No auto-transitions. The Scan button press triggers SCAN_SUBMITTING.
        // For DevKitC (non-touch): serial "scan" command triggers it via handleSerial().
#ifdef BOARD_SCAN_TOUCH
        if (display.scanButtonPressed) {
            display.scanButtonPressed = false;
            // Snapshot all sensor data
            currentScan.clear_data();
            currentScan.timestamp = now;
            currentScan.weight.grams = weightSnap.stable ? weightSnap.stableWeight : weightSnap.weight;
            currentScan.weight.stable = weightSnap.stable;
            currentScan.weight.valid = true;

            // Copy NFC data from snapshot
            if (nfcSnap.tagPresent) {
                currentScan.nfcPresent = true;
                strncpy(currentScan.nfcUid, nfcSnap.uidString.c_str(), sizeof(currentScan.nfcUid) - 1);
                currentScan.nfcUidLen = nfcSnap.uidLen;
                currentScan.nfcTagType = nfcSnap.hasData ? nfcSnap.tagData.type : 0;
            }

            // Read color sensor now
            if (colorSensor.isConnected()) {
                ColorData color;
                if (colorSensor.read(color)) {
                    currentScan.color = color;
                }
            }

            // Read TOF
            if (distanceSensor.isConnected()) {
                DistanceData dist;
                if (distanceSensor.read(dist)) {
                    currentScan.height = dist;
                }
            }

            enterState(SCAN_SUBMITTING);
        }
#endif
        break;

    case SCAN_SUBMITTING: {
        if (!apiClient.isWiFiConnected()) {
            // No WiFi -- show result as unknown
            Serial.println("[Scan] No WiFi -- showing as unknown");
            lastResponse = ScanResponse();
            enterState(SCAN_RESULT);
            break;
        }

        if (now - lastApiPost < API_POST_DEBOUNCE_MS) break;

        // Check if a previous post response is ready
        bool responseReady = false;
        bool postInFlight = false;
        if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(5)) == pdTRUE) {
            responseReady = sharedScan.responseReady;
            postInFlight = sharedScan.postInFlight;
            if (responseReady) {
                lastResponse = sharedScan.response;
                ApiStatus status = sharedScan.lastStatus;
                sharedScan.responseReady = false;
                xSemaphoreGive(sharedScan.mutex);

                lastApiPost = now;
                if (status == API_OK) {
                    authFailCount = 0;
                    Serial.printf("[API] Scan posted: id=%s identified=%d\n",
                                 lastResponse.scanId, lastResponse.identified);

#ifdef BOARD_SCAN_TOUCH
                    if (lastResponse.identified) {
                        if (audio.isConnected()) audio.playSuccessBeep();
                    } else {
                        if (audio.isConnected()) audio.playSubmitBeep();
                    }
                    if (sdCard.isConnected()) sdCard.logScan(currentScan, lastResponse);
#endif
                    enterState(SCAN_RESULT);
                } else if (status == API_AUTH_FAILED) {
                    authFailCount++;
                    Serial.printf("[API] Auth failed (%d/%d)\n", authFailCount, AUTH_FAIL_THRESHOLD);
                    if (authFailCount >= AUTH_FAIL_THRESHOLD) {
                        Serial.println("[API] Too many auth failures -- unpairing.");
                        apiClient.unpair();
                        authFailCount = 0;
                    }
                    enterState(SCAN_RESULT);  // Show error result
                } else {
                    Serial.printf("[API] Post failed: %d\n", status);
                    enterState(SCAN_RESULT);  // Show unknown result
                }
            } else if (!postInFlight) {
                // No response yet and no post in flight -- enqueue one
                sharedScan.scanResult = currentScan;
                if (nfcSnap.hasData) {
                    sharedScan.tagData = nfcSnap.tagData;
                    sharedScan.hasTagData = true;
                } else {
                    sharedScan.hasTagData = false;
                }
                sharedScan.postInFlight = true;
                sharedScan.responseReady = false;
                xSemaphoreGive(sharedScan.mutex);

                lastApiPost = now;
                NetworkWorkItem item = { NET_POST_SCAN };
                xQueueSend(networkQueue, &item, 0);
            } else {
                xSemaphoreGive(sharedScan.mutex);
            }
        }

        // Timeout submitting after 15s
        if (elapsed > 15000) {
            Serial.println("[Scan] Submit timeout");
            enterState(SCAN_RESULT);
        }
        break;
    }

    case SCAN_RESULT: {
        // Wait for user tap "Done" or 30s timeout
#ifdef BOARD_SCAN_TOUCH
        if (display.doneButtonPressed) {
            display.doneButtonPressed = false;
            enterState(SCAN_IDLE);
        }
#endif
        if (elapsed > 30000) {
            enterState(SCAN_IDLE);
        }
        break;
    }

    default:
        enterState(SCAN_IDLE);
        break;
    }
}

// ============================================================
// Display + LED Update
// ============================================================

void updateDisplayAndLed() {
    float w = weightSnap.stable ? weightSnap.stableWeight : weightSnap.weight;
    bool stable = weightSnap.stable;

    // Build status icon flags
    uint8_t icons = 0;
    if (apiClient.isWiFiConnected()) icons |= ICON_WIFI;
    if (apiClient.isPaired())        icons |= ICON_PAIRED;
    if (labelPrinter.isConnected())  icons |= ICON_PRINTER;

    // For SCAN_IDLE: update the live dashboard with current sensor readings
    if (scanState == SCAN_IDLE) {
        // Build the dashboard screen if not already showing
        const ScanResponse* serverData = nullptr;
        display.update(scanState, w, stable, nullptr, serverData, nullptr, nullptr, icons);

        // Read sensors for dashboard display (round-robin to avoid blocking)
        static DistanceData cachedDist = {};
        static ColorData cachedColor = {};
        static EnvData cachedEnv = {};
        static uint8_t dashSensorSlot = 0;

        switch (dashSensorSlot) {
            case 0:
                if (distanceSensor.isConnected()) distanceSensor.read(cachedDist);
                break;
            case 1:
                if (colorSensor.isConnected()) colorSensor.read(cachedColor);
                break;
            case 2:
                if (envSensor.isConnected()) envSensor.read(cachedEnv);
                break;
        }
        dashSensorSlot = (dashSensorSlot + 1) % 3;

        // Build NFC info string — show reading progress
        static char nfcInfoBuf[80];
        const char* nfcInfo = nullptr;
        if (nfcSnap.tagPresent && nfcSnap.uidString.length() > 0) {
            if (nfcSnap.hasData && nfcSnap.tagData.valid) {
                const TagData& td = nfcSnap.tagData;
                const char* typeName = tagTypeName(td.type);
                if (td.type == TAG_MIFARE_CLASSIC)
                    snprintf(nfcInfoBuf, sizeof(nfcInfoBuf), "%s %d/%d sec",
                             typeName, td.sectors_read, TagData::NUM_SECTORS);
                else if (td.type == TAG_ISO15693)
                    snprintf(nfcInfoBuf, sizeof(nfcInfoBuf), "%s %d blk",
                             typeName, td.pages_read);
                else
                    snprintf(nfcInfoBuf, sizeof(nfcInfoBuf), "%s %d pg",
                             typeName, td.pages_read);
            } else {
                snprintf(nfcInfoBuf, sizeof(nfcInfoBuf), "NFC: reading...");
            }
            nfcInfo = nfcInfoBuf;
        }

        // Build color info string + RGB values for swatch
        static char colorInfoBuf[48];
        const char* colorInfo = nullptr;
        uint8_t cR = 0, cG = 0, cB = 0;
        if (colorSensor.isConnected() && cachedColor.valid) {
            if (cachedColor.sensorType == COLOR_TCS34725 && cachedColor.rgbc_c > 0) {
                cR = (uint8_t)min(255.0f, cachedColor.rgbc_r * 255.0f / cachedColor.rgbc_c);
                cG = (uint8_t)min(255.0f, cachedColor.rgbc_g * 255.0f / cachedColor.rgbc_c);
                cB = (uint8_t)min(255.0f, cachedColor.rgbc_b * 255.0f / cachedColor.rgbc_c);
                snprintf(colorInfoBuf, sizeof(colorInfoBuf), "#%02X%02X%02X %uK", cR, cG, cB, cachedColor.colorTemp);
            } else if (cachedColor.sensorType == COLOR_OPT4048) {
                snprintf(colorInfoBuf, sizeof(colorInfoBuf), "%.0f lux", cachedColor.opt_lux);
            } else if (cachedColor.sensorType == COLOR_AS7341 || cachedColor.sensorType == COLOR_AS7343) {
                uint16_t mx = cachedColor.f3_480nm;
                if (cachedColor.f5_555nm > mx) mx = cachedColor.f5_555nm;
                if (cachedColor.f7_630nm > mx) mx = cachedColor.f7_630nm;
                if (mx == 0) mx = 1;
                cR = (uint8_t)(cachedColor.f7_630nm * 255 / mx);
                cG = (uint8_t)(cachedColor.f5_555nm * 255 / mx);
                cB = (uint8_t)(cachedColor.f3_480nm * 255 / mx);
                snprintf(colorInfoBuf, sizeof(colorInfoBuf), "#%02X%02X%02X", cR, cG, cB);
            } else {
                const char* names[] = {"?", "AS7341", "AS7265x", "TCS34725", "OPT4048", "AS7343", "AS7331"};
                snprintf(colorInfoBuf, sizeof(colorInfoBuf), "%s", names[cachedColor.sensorType]);
            }
            colorInfo = colorInfoBuf;
        }

        // TOF distance
        float distMm = -1;
        if (distanceSensor.isConnected() && cachedDist.valid) {
            distMm = cachedDist.distanceMm;
        }

        // Env data
        float tempC = -1, humidity = 0, pressureHPa = 0;
        if (envSensor.isConnected() && cachedEnv.valid) {
            tempC = cachedEnv.temperatureC;
            humidity = cachedEnv.humidity;
            pressureHPa = cachedEnv.pressureHPa;
        }

        display.updateDashboard(w, stable, nfcInfo, colorInfo, cR, cG, cB,
                                 distMm, tempC, humidity, pressureHPa, true);
    } else {
        // For SCAN_SUBMITTING or SCAN_RESULT, just update the display state
        const ScanResponse* serverData = lastResponse.scanId[0] ? &lastResponse : nullptr;

        // Build session URL for QR code
        static char sessionUrl[128] = {0};
        if (scanState == SCAN_RESULT && lastResponse.sessionId[0]) {
            snprintf(sessionUrl, sizeof(sessionUrl), "%s/scan/%s",
                     apiClient.getApiUrl(), lastResponse.sessionId);
        }

        // Only transition screen on state change
        if (scanState == SCAN_RESULT && sessionUrl[0]) {
            display.showResult(serverData, w, sessionUrl);
        } else {
            display.update(scanState, w, stable, nullptr, serverData, nullptr, nullptr, icons);
        }
    }

    // LED backlight based on state (only change mode on state transitions)
    static ScanState lastLedState = SCAN_IDLE;
    static bool lastLedHadData = false;
    const ScanResponse* ledServerData = lastResponse.identified ? &lastResponse : nullptr;
    bool hasDataNow = (ledServerData != nullptr);
    bool ledStateChanged = (scanState != lastLedState) || (hasDataNow != lastLedHadData);

    if (ledStateChanged) {
        lastLedState = scanState;
        lastLedHadData = hasDataNow;
        switch (scanState) {
        case SCAN_IDLE:
            backlight.idle();
            break;
        case SCAN_SUBMITTING:
            backlight.spin(0, 150, 255);
            break;
        case SCAN_RESULT:
            if (ledServerData && ledServerData->identified) {
                if (ledServerData->colorR || ledServerData->colorG || ledServerData->colorB) {
                    backlight.color(ledServerData->colorR, ledServerData->colorG, ledServerData->colorB);
                } else {
                    backlight.success();
                }
            } else {
                backlight.needsInput();
            }
            break;
        default:
            break;
        }
    }

    backlight.update();
}

// ============================================================
// Serial Commands
// ============================================================

void printHelp() {
    Serial.println("Commands:");
    Serial.println("  status (s)      Full device status");
    Serial.println("  scan            Trigger scan (or show details if not idle)");
    Serial.println("  nfc             NFC reader status");
    Serial.println("  i2c             Scan I2C bus");
    Serial.println("  config          Device config (from server)");
    Serial.println("  identity        Hardware identity (eFuse HMAC)");
    Serial.println("  weight (w)      Current weight + raw ADC value");
    Serial.println("  raw             Continuous raw ADC output (any key to stop)");
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

    // Architecture info
    Serial.println("\n  Tasks");
    Serial.printf("    NFC task:  core 0, %s\n", nfcTaskHandle ? "running" : "not started");
    Serial.printf("    Net task:  core 0, %s\n", networkTaskHandle ? "running" : "not started");
    Serial.printf("    Weight:    %s\n", scale.isTaskRunning() ? "task (core 0)" : "main loop poll");
    Serial.printf("    Free heap: %u bytes\n", ESP.getFreeHeap());

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
    Serial.printf("    NFC:    %s\n", nfcSnap.connected ? "PN5180" : "--");
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

    if (nfcSnap.tagPresent) {
        Serial.printf("  NFC: %s", nfcSnap.uidString.c_str());
        if (nfcSnap.hasData) {
            const TagData& td = nfcSnap.tagData;
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
        if (scanState == SCAN_IDLE) {
            // Trigger a scan (same as pressing the Scan button on touch)
            unsigned long now = millis();
            currentScan.clear_data();
            currentScan.timestamp = now;
            currentScan.weight.grams = weightSnap.stable ? weightSnap.stableWeight : weightSnap.weight;
            currentScan.weight.stable = weightSnap.stable;
            currentScan.weight.valid = true;

            if (nfcSnap.tagPresent) {
                currentScan.nfcPresent = true;
                strncpy(currentScan.nfcUid, nfcSnap.uidString.c_str(), sizeof(currentScan.nfcUid) - 1);
                currentScan.nfcUidLen = nfcSnap.uidLen;
                currentScan.nfcTagType = nfcSnap.hasData ? nfcSnap.tagData.type : 0;
            }

            if (colorSensor.isConnected()) {
                ColorData color;
                if (colorSensor.read(color)) {
                    currentScan.color = color;
                }
            }

            if (distanceSensor.isConnected()) {
                DistanceData dist;
                if (distanceSensor.read(dist)) {
                    currentScan.height = dist;
                }
            }

            Serial.println("[Scan] Triggered from serial");
            enterState(SCAN_SUBMITTING);
        } else {
            printScanDetails();
        }
    }
    else if (line == "nfc") {
        // Print NFC status from snapshot (thread-safe)
        Serial.println("=== NFC ===");
        Serial.printf("  Connected: %s\n", nfcSnap.connected ? "YES" : "no");
        Serial.printf("  Tag: %s\n", nfcSnap.tagPresent ? nfcSnap.uidString.c_str() : "none");
        if (nfcSnap.tagPresent && nfcSnap.hasData) {
            const TagData& td = nfcSnap.tagData;
            Serial.printf("  Tag data: %d %s\n",
                td.type == TAG_MIFARE_CLASSIC ? td.sectors_read : td.pages_read,
                td.type == TAG_MIFARE_CLASSIC ? "sectors" : "pages");
        }
        Serial.printf("  Task: %s (core 0)\n", nfcTaskHandle ? "running" : "not started");
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
    else if (line == "weight" || line == "w") {
        if (!scale.isConnected()) {
            Serial.println("Scale not connected.");
        } else {
            scale.pauseTask();
            delay(100);
            double raw = scale.getValueForCalibration(5);
            float w = scale.getWeight();
            Serial.printf("Weight: %.2fg  Stable: %.2fg %s  Raw: %.0f  Factor: %.4f\n",
                w, scale.getStableWeight(), scale.isStable() ? "[STABLE]" : "",
                raw, scale.getScaleFactor());
            scale.resumeTask();
        }
    }
    else if (line == "raw") {
        if (!scale.isConnected()) {
            Serial.println("Scale not connected.");
        } else {
            Serial.println("Streaming raw ADC values (send any key to stop)...");
            scale.pauseTask();
            delay(100);
            while (!Serial.available()) {
                double raw = scale.getValueForCalibration(1);
                float w = scale.getWeight();
                Serial.printf("Raw: %12.0f  Weight: %8.2fg\n", raw, w);
                delay(100);
            }
            while (Serial.available()) Serial.read();  // flush
            scale.resumeTask();
            Serial.println("Stopped.");
        }
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
            // Enqueue WiFi connect to network task
            NetworkWorkItem item = { NET_WIFI_CONNECT };
            xQueueSend(networkQueue, &item, 0);
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
        NetworkWorkItem item = { NET_CHECK_OTA };
        xQueueSend(networkQueue, &item, 0);
    }

#ifdef BOARD_SCAN_TOUCH
    else if (line == "beep") {
        if (audio.isConnected()) {
            Serial.println("Playing submit beep...");
            audio.playSubmitBeep();
        } else {
            Serial.println("Audio not connected.");
        }
    }
    else if (line == "beep2") {
        if (audio.isConnected()) {
            Serial.println("Playing success beep...");
            audio.playSuccessBeep();
        } else {
            Serial.println("Audio not connected.");
        }
    }
    else if (line == "beep3") {
        if (audio.isConnected()) {
            Serial.println("Playing error beep...");
            audio.playErrorBeep();
        } else {
            Serial.println("Audio not connected.");
        }
    }
#endif
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
    Serial.printf("  Filla IQ -- FillaScan v%s (%s)\n", FW_VERSION, FW_CHANNEL);
    Serial.println("========================================\n");

    // Display + backlight first -- show boot screen immediately
    backlight.begin();
    backlight.color(0, 0, 255);  // Blue = booting
    display.begin();
    display.showBootScreen(FW_VERSION);

    // I2C bus (sensors + NFC on touch board)
    display.setBootStatus("I2C bus init...");

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

    // Touch init first -- reset FT6336G so it releases SDA before we scan
#ifdef BOARD_SCAN_TOUCH
    display.setBootStatus("Touch init...");
    touchInput.begin();
    if (touchInput.isConnected()) {
        touchInput.registerLvglInput();
    }
    display.addBootItem("Touch", touchInput.isConnected());
#endif

    // Probe known addresses only (full scan can hang on stuck bus)
    display.setBootStatus("Scanning I2C...");
    const uint8_t knownAddrs[] = { NAU7802_ADDR, VL53L1X_ADDR, VL53L1X_DEFAULT_ADDR,
                                    AS7341_ADDR, TCS34725_ADDR, OPT4048_ADDR,
                                    AS7265X_ADDR, AS7331_ADDR, 0x24 /*PN532*/,
#ifdef BOARD_SCAN_TOUCH
                                    0x38 /*FT6336*/, ES8311_ADDR,
#endif
                                    };
    Serial.print("  I2C:"); Serial.flush();
    for (size_t i = 0; i < sizeof(knownAddrs); i++) {
        Wire.beginTransmission(knownAddrs[i]);
        uint8_t err = Wire.endTransmission();
        if (err == 0) { Serial.printf(" 0x%02X", knownAddrs[i]); Serial.flush(); }
    }
    Serial.println(); Serial.flush();
    // Keep short timeout during sensor detection -- restored after init
    Wire.setTimeOut(100);

    // Hardware-rooted device identity (eFuse HMAC)
    display.setBootStatus("Identity...");
    deviceIdentity.begin();

    // NFC reader (SPI init happens in begin() -- still on main thread during setup)
    display.setBootStatus("NFC init...");
    initNfc();
    display.addBootItem("NFC", nfcScanner.isConnected());

    // TOF distance sensor
    display.setBootStatus("TOF init...");
    distanceSensor.begin();
    display.addBootItem("TOF", distanceSensor.isConnected());

    // Color sensor (auto-detect)
    display.setBootStatus("Color init...");
    colorSensor.begin();
    {
        const char* colorNames[] = { nullptr, "AS7341", "AS7265x", "TCS34725", "OPT4048", "AS7343", "AS7331" };
        bool found = colorSensor.isConnected();
        const char* name = found ? colorNames[colorSensor.getType()] : "Color";
        display.addBootItem(name ? name : "Color", found);
    }

    // Environmental sensor (auto-detect)
    display.setBootStatus("Environment...");
    envSensor.begin();
    display.addBootItem(envSensor.isConnected() ? envSensor.getChipName() : "Env", envSensor.isConnected());

    // Weight
    display.setBootStatus("Weight init...");
    scale.begin();
    float savedCal = loadCalibration();
    if (savedCal != 0) {
        scale.setScale(savedCal);
        Serial.printf("  Calibration: %.4f (from NVS)\n", savedCal);
    }
    display.addBootItem(scale.isConnected() ? scale.getChipName() : "Scale", scale.isConnected());
    if (scale.isConnected()) {
        scale.tare();
#ifdef BOARD_SCAN_TOUCH
        // NAU7802 uses I2C -- poll in main loop to avoid I2C bus contention
        // (HX711 needs dedicated task for bit-banged GPIO timing)
        if (scale.getDriverType() != WEIGHT_HX711) {
            Serial.println("  Weight: polling in main loop (I2C)");
        } else
#endif
        {
            scale.startTask(0, 2);  // Weight task on Core 0
        }
    }

    // SD card
#ifdef BOARD_SCAN_TOUCH
    display.setBootStatus("SD card init...");
    sdCard.begin();
    display.addBootItem("SD", sdCard.isConnected());
#endif

    // Audio
#ifdef BOARD_SCAN_TOUCH
    display.setBootStatus("Audio init...");
    audio.begin();
    display.addBootItem("Audio", audio.isConnected());
#endif

    // Set sensor flags for status bar icons on runtime screens
    {
        uint8_t sf = 0;
        if (nfcScanner.isConnected())       sf |= SENSOR_NFC;
        if (scale.isConnected())            sf |= SENSOR_SCALE;
        if (distanceSensor.isConnected())   sf |= SENSOR_TOF;
        if (colorSensor.isConnected())      sf |= SENSOR_COLOR;
        if (envSensor.isConnected())        sf |= SENSOR_ENV;
#ifdef BOARD_SCAN_TOUCH
        if (sdCard.isConnected())           sf |= SENSOR_SD;
        if (audio.isConnected())            sf |= SENSOR_AUDIO;
#endif
        display.setSensorFlags(sf);
    }

    // Build hardware manifest from detected sensors
    DeviceCapabilities caps;
    if (nfcScanner.isConnected()) {
#ifdef BOARD_SCAN_TOUCH
        caps.nfc.set("PN5180", "SPI", 0, NFC_SPI_NSS);
#else
        caps.nfc.set("PN532", "SPI", 0, NFC_CS_PIN);
#endif
    }
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

#ifdef BOARD_SCAN_TOUCH
    if (touchInput.isConnected())
        caps.touch.set("FT6336G", "I2C", 0x38);
    if (sdCard.isConnected())
        caps.sdCard.set(sdCard.getChipName(), "SDMMC");
    if (audio.isConnected())
        caps.audio.set("ES8311", "I2S", ES8311_ADDR);
    // Battery ADC -- always present on touch board
    caps.battery.set("ADC", "GPIO", 0, BATTERY_ADC_PIN);
#endif

    // Label printer -- BLE scan
    display.setBootStatus("Scanning BLE printer...");
    labelPrinter.begin();
    if (labelPrinter.scan(5000)) {
        const char* prName = labelPrinter.getDeviceName();
        const char* prAddr = labelPrinter.getBleAddr();
        caps.printer.set(prName, "BLE",
                         PRINTER_MAX_WIDTH_MM, PRINTER_MAX_HEIGHT_MM,
                         PRINTER_DPI, "escpos");
        caps.printer.setBle(prAddr);

        display.addBootItem(prName, true);
        display.setBootStatus("Connecting printer...");
        labelPrinter.connect();
    } else {
        display.addBootItem("Printer", false);
    }

    // Device config (loads from NVS)
    deviceConfig.begin();

    // API client (loads WiFi creds from NVS)
    apiClient.begin();
    apiClient.setCapabilities(caps);

    // Try WiFi if configured
    display.setBootStatus("Connecting WiFi...");
    if (apiClient.connectWiFi()) {
        wifiEverConnected = true;
        display.addBootItem("WiFi", true);
        delay(500);

        // Check if we need to pair with the backend
        if (apiClient.hasApiUrl() && !apiClient.isPaired()) {
            startPairing();
        }
    } else {
        // Start WiFi AP + captive portal provisioning
        startProvisioning();
    }

    // Menu action callbacks -- set flags for main loop to handle
    // (LVGL event callbacks run on lv_timer_handler stack, can't do heavy work)
#ifdef BOARD_SCAN_TOUCH
    display.onMenuFormatSd  = []() { menuActionPending = MENU_FORMAT_SD; };
    display.onMenuWifiSetup = []() { menuActionPending = MENU_WIFI_SETUP; };
    display.onMenuTareScale = []() { menuActionPending = MENU_TARE_SCALE; };
    display.onMenuRawSensors = []() { menuActionPending = MENU_RAW_SENSORS; };
    display.onMenuCalibrate  = []() { menuActionPending = MENU_CALIBRATE; };
    display.onMenuReboot    = []() { menuActionPending = MENU_REBOOT; };
#endif

    // OTA updates (init only -- periodic checks happen in network task)
    otaBegin();

    // ============================================================
    // Create FreeRTOS shared state and tasks
    // ============================================================

    // Initialize shared state mutexes
    nfcResult.mutex = xSemaphoreCreateMutex();
    nfcResult.tagPresent = false;
    nfcResult.tagIsNew = false;
    nfcResult.uidLen = 0;
    nfcResult.hasData = false;
    nfcResult.connected = nfcScanner.isConnected();

    sharedScan.mutex = xSemaphoreCreateMutex();
    sharedScan.responseReady = false;
    sharedScan.postInFlight = false;
    sharedScan.pollReady = false;
    sharedScan.pollInFlight = false;
    sharedScan.pairingPollReady = false;
    sharedScan.wifiConnectReady = false;
    memset(sharedScan.pollScanId, 0, sizeof(sharedScan.pollScanId));

    // Create network work queue
    networkQueue = xQueueCreate(NET_QUEUE_SIZE, sizeof(NetworkWorkItem));

    // Create NFC task on Core 0 (PN5180 uses its own HSPI bus)
#ifdef BOARD_SCAN_TOUCH
    if (nfcScanner.isConnected()) {
        xTaskCreatePinnedToCore(
            nfcTask,            // task function
            "nfc",              // name
            8192,               // stack size (bytes)
            nullptr,            // parameter
            2,                  // priority (higher than network)
            &nfcTaskHandle,     // task handle
            0                   // core 0
        );
        Serial.println("  NFC task: started on core 0 (priority 2)");
    }
#endif

    // Create network task on Core 0
    xTaskCreatePinnedToCore(
        networkTask,        // task function
        "net",              // name
        8192,               // stack size (bytes)
        nullptr,            // parameter
        1,                  // priority (lower than NFC)
        &networkTaskHandle, // task handle
        0                   // core 0
    );
    Serial.println("  Net task: started on core 0 (priority 1)");

    Wire.setTimeOut(500);  // Restore normal I2C timeout for runtime
    backlight.idle();
    enterState(SCAN_IDLE);

    Serial.println("\nReady. Type 'help' for commands.\n");
}

// ============================================================
// Main Loop (Core 1 -- Arduino default)
// ============================================================
// UI only. No blocking operations. No NFC SPI. No HTTP.
// I2C sensors (NAU7802, TOF, color, env) are read here.

static unsigned long lastDisplayUpdate = 0;
static unsigned long lastSerialStatus = 0;

void loop() {
    unsigned long now = millis();

    // LVGL tick -- must run frequently for rendering + animations
    display.tick();

    // Process deferred menu actions (set by LVGL event callbacks)
#ifdef BOARD_SCAN_TOUCH
    if (menuActionPending != MENU_NONE) {
        MenuAction action = menuActionPending;
        menuActionPending = MENU_NONE;
        switch (action) {
            case MENU_FORMAT_SD:
                if (sdCard.isConnected()) {
                    display.showMessage("Formatting...", "Please wait");
                    sdCard.format();
                    display.showMessage("SD Formatted", "Scan log cleared");
                    delay(1500);
                } else {
                    display.showMessage("No SD Card", "Insert card and reboot");
                    delay(1500);
                }
                break;
            case MENU_WIFI_SETUP:
                startProvisioning();
                break;
            case MENU_TARE_SCALE:
                if (scale.isConnected()) {
                    display.showMessage("Taring...", "Keep platform empty");
                    scale.pauseTask();
                    delay(200);
                    scale.tare();
                    scale.resumeTask();
                    display.showMessage("Tared!", "Scale zeroed");
                    delay(1000);
                }
                break;
            case MENU_RAW_SENSORS:
                // Enter raw sensors mode -- loop will continuously update
                display.showRawSensors("Loading...");
                break;
            case MENU_CALIBRATE: {
                if (!scale.isConnected()) {
                    display.showMessage("No Scale", "Scale not detected");
                    delay(1500);
                    break;
                }
                // Step 1: Remove weight
                display.showCalibrate("Remove all weight", "Then tap screen...");
                display.touchSubmitRequested = false;
                while (!display.touchSubmitRequested) {
                    display.tick();
                    delay(10);
                }
                // Step 2: Tare
                display.showCalibrate("Taring...", "Hold still");
                scale.pauseTask();
                delay(500);
                scale.tare();
                // Step 3: Place known weight
                display.showCalibrate("Place 100g weight", "Then tap screen...");
                display.touchSubmitRequested = false;
                while (!display.touchSubmitRequested) {
                    display.tick();
                    delay(10);
                }
                // Step 4: Calculate
                display.showCalibrate("Measuring...", "Hold still");
                delay(500);
                double raw = scale.getValueForCalibration(20);
                float factor = (float)(raw / 100.0);
                scale.setScale(factor);
                scale.resumeTask();
                // Save to NVS
                Preferences prefs;
                prefs.begin("cal", false);
                prefs.putFloat("factor", factor);
                prefs.end();
                char msg[48];
                snprintf(msg, sizeof(msg), "Factor: %.4f", factor);
                display.showCalibrate("Calibrated!", msg);
                Serial.printf("Calibration: %.4f (saved)\n", factor);
                delay(2000);
                // Return to normal
                display.showMessage("Done", "Tap Back to return");
                break;
            }
            case MENU_REBOOT:
                display.showMessage("Rebooting...", "");
                delay(500);
                ESP.restart();
                break;
            default: break;
        }
    }
#endif

    // Weight: poll NAU7802 inline if not using dedicated task (I2C thread safety)
    if (scale.isConnected() && !scale.isTaskRunning()) {
        static unsigned long lastWeightPoll = 0;
        if (now - lastWeightPoll >= WEIGHT_READ_INTERVAL_MS) {
            lastWeightPoll = now;
            scale.pollOnce();
        }
    }

    // Snapshot weight once per loop (avoids repeated mutex acquisitions)
    snapshotWeight();

    // Snapshot NFC state from NFC task (thread-safe read)
    snapshotNfc();

    // NFC polling for DevKitC (PN532 on shared SPI -- no NFC task)
#ifndef BOARD_SCAN_TOUCH
    pollNfc();
    // For DevKitC, manually populate nfcSnap from nfcScanner directly
    nfcSnap.tagPresent = nfcScanner.isTagPresent();
    nfcSnap.connected = nfcScanner.isConnected();
    if (nfcSnap.tagPresent) {
        nfcScanner.getUid(nfcSnap.uid, &nfcSnap.uidLen);
        nfcSnap.uidString = nfcScanner.getUidString();
        nfcSnap.hasData = nfcScanner.hasTagData();
        if (nfcSnap.hasData) {
            nfcSnap.tagData = nfcScanner.getTagData();
        }
    }
#endif

    // Captive portal processing (must run frequently when AP is active)
    provisioner.loop();

    // Skip heavy processing during OTA
    if (otaRunning) {
        // Still tick display so OTA progress can be shown
        return;
    }

    // WiFi management (only when not in setup mode)
    // Actual connection happens in network task; this just enqueues requests
    if (!provisioner.isActive()) {
        tryWifiConnect();
    }

    // Check for WiFi connect result from network task
    if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(2)) == pdTRUE) {
        if (sharedScan.wifiConnectReady) {
            sharedScan.wifiConnectReady = false;
            if (sharedScan.wifiConnectResult) {
                wifiEverConnected = true;
                if (apiClient.hasApiUrl() && !apiClient.isPaired()) {
                    startPairing();
                }
            }
        }
        xSemaphoreGive(sharedScan.mutex);
    }

    // Captive portal provisioning check
    checkProvisioning();

    // Device pairing poll (enqueue to network task)
    if (pairingActive && now - lastPairingPoll >= PAIRING_POLL_INTERVAL_MS) {
        lastPairingPoll = now;

        // Check for pairing poll result
        bool gotResult = false;
        if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(5)) == pdTRUE) {
            if (sharedScan.pairingPollReady) {
                sharedScan.pairingPollReady = false;
                gotResult = true;
                bool paired = sharedScan.pairingPollResult;
                ApiStatus pairStatus = sharedScan.pairingPollStatus;
                xSemaphoreGive(sharedScan.mutex);

                if (paired) {
                    pairingActive = false;
                    display.showMessage("Paired!", "Ready to scan");
                    delay(2000);
                } else if (pairStatus == API_EXPIRED) {
                    Serial.println("[Pair] Code expired, requesting new code");
                    startPairing();
                } else if (pairStatus != API_OK) {
                    Serial.printf("[Pair] Poll error: %d\n", pairStatus);
                }
            } else {
                xSemaphoreGive(sharedScan.mutex);
            }
        }

        // Enqueue next poll if still pairing
        if (pairingActive && !gotResult) {
            NetworkWorkItem item = { NET_POLL_PAIRING };
            xQueueSend(networkQueue, &item, 0);
        }
    }

    // Environmental data reporting (read I2C sensor on main loop, enqueue HTTP post)
    {
        static unsigned long lastEnvReport = 0;
        if (envSensor.isConnected() && apiClient.isPaired() && apiClient.isWiFiConnected()
            && now - lastEnvReport >= deviceConfig.envReportInterval()) {
            lastEnvReport = now;
            EnvData env;
            if (envSensor.read(env)) {
                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(5)) == pdTRUE) {
                    sharedScan.envData = env;
                    xSemaphoreGive(sharedScan.mutex);
                    NetworkWorkItem item = { NET_POST_ENV };
                    xQueueSend(networkQueue, &item, 0);
                }
            }
        }
    }

    // Scan state machine (skip while pairing or in menu)
    if (!pairingActive && !display.isMenuActive()) {
        updateScanState();
    }

    // Display + LED (throttled, skip while in setup mode, pairing, or menu)
    if (!provisioner.isActive() && !pairingActive && !display.isMenuActive() && now - lastDisplayUpdate >= 100) {
        lastDisplayUpdate = now;
        updateDisplayAndLed();
    }

#ifdef BOARD_SCAN_TOUCH
    // Live sensor screens -- continuous update
    if (display.isMenuActive() && now - lastDisplayUpdate >= 200) {
        lastDisplayUpdate = now;

        // Raw sensors screen — only update if on that screen
        if (display.isRawSensorsScreen()) {
        static char sensorBuf[512];
        static DistanceData cachedDist = {};
        static ColorData cachedColor = {};
        static EnvData cachedEnv = {};
        static uint8_t sensorReadSlot = 0;

        // Read one sensor per frame (round-robin) with LVGL ticks between
        // to keep touch responsive during slow I2C reads (AS7341 can take 50-100ms)
        switch (sensorReadSlot) {
            case 0:
                if (distanceSensor.isConnected()) distanceSensor.read(cachedDist);
                display.tick();
                break;
            case 1:
                if (colorSensor.isConnected()) colorSensor.read(cachedColor);
                display.tick();
                break;
            case 2:
                if (envSensor.isConnected()) envSensor.read(cachedEnv);
                display.tick();
                break;
        }
        sensorReadSlot = (sensorReadSlot + 1) % 3;

        // Build display string from cached values
        {
            int pos = 0;

            // Weight (non-blocking)
            if (scale.isConnected())
                pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos,
                    "Weight: %.2fg %s\n  Raw: %ld  Cal: %.4f\n",
                    weightSnap.weight, weightSnap.stable ? "[STABLE]" : "",
                    scale.getLastRawAdc(), scale.getScaleFactor());
            else
                pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos, "Weight: --\n");

            // TOF (cached)
            if (distanceSensor.isConnected()) {
                if (cachedDist.valid)
                    pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos,
                        "TOF: %.0fmm (obj: %.0fmm)\n", cachedDist.distanceMm, cachedDist.objectHeightMm);
                else
                    pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos, "TOF: waiting...\n");
            } else {
                pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos, "TOF: --\n");
            }

            // Color (cached)
            if (colorSensor.isConnected() && cachedColor.valid) {
                switch (cachedColor.sensorType) {
                    case COLOR_AS7341:
                    case COLOR_AS7343:
                        pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos,
                            "Color: %s\n  415:%u 445:%u 480:%u 515:%u\n  555:%u 590:%u 630:%u 680:%u\n  Clr:%u NIR:%u\n",
                            cachedColor.sensorType == COLOR_AS7343 ? "AS7343" : "AS7341",
                            cachedColor.f1_415nm, cachedColor.f2_445nm, cachedColor.f3_480nm, cachedColor.f4_515nm,
                            cachedColor.f5_555nm, cachedColor.f6_590nm, cachedColor.f7_630nm, cachedColor.f8_680nm,
                            cachedColor.clear, cachedColor.nir);
                        break;
                    case COLOR_OPT4048:
                        pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos,
                            "Color: OPT4048\n  X:%.1f Y:%.1f Z:%.1f Lux:%.0f\n",
                            cachedColor.cie_x, cachedColor.cie_y, cachedColor.cie_z, cachedColor.opt_lux);
                        break;
                    case COLOR_TCS34725:
                        pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos,
                            "Color: TCS34725\n  R:%u G:%u B:%u C:%u\n  CCT:%uK Lux:%u\n",
                            cachedColor.rgbc_r, cachedColor.rgbc_g, cachedColor.rgbc_b, cachedColor.rgbc_c,
                            cachedColor.colorTemp, cachedColor.lux);
                        break;
                    default: break;
                }
            } else if (colorSensor.isConnected()) {
                pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos, "Color: waiting...\n");
            } else {
                pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos, "Color: --\n");
            }

            // Environment (cached)
            if (envSensor.isConnected()) {
                if (cachedEnv.valid)
                    pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos,
                        "Env: %.1fC %.0f%%RH%s\n",
                        cachedEnv.temperatureC, cachedEnv.humidity,
                        cachedEnv.pressureHPa > 0 ? String(" " + String((int)cachedEnv.pressureHPa) + "hPa").c_str() : "");
                else
                    pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos, "Env: waiting...\n");
            } else {
                pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos, "Env: --\n");
            }

            // NFC (from snapshot -- thread-safe)
            if (nfcSnap.connected) {
                if (nfcSnap.tagPresent) {
                    const TagData& td = nfcSnap.tagData;
                    const char* typeName = nfcSnap.hasData ? tagTypeName(td.type) : "?";
                    if (td.type == TAG_MIFARE_CLASSIC)
                        pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos,
                            "NFC: %s %s\n %d/%d sectors\n",
                            typeName, nfcSnap.uidString.c_str(),
                            td.sectors_read, TagData::NUM_SECTORS);
                    else if (td.type == TAG_ISO15693)
                        pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos,
                            "NFC: %s %s\n %d blocks\n",
                            typeName, nfcSnap.uidString.c_str(), td.pages_read);
                    else
                        pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos,
                            "NFC: %s %s\n %d pages\n",
                            typeName, nfcSnap.uidString.c_str(), td.pages_read);
                } else {
                    pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos, "NFC: no tag\n");
                }
            } else {
                pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos, "NFC: --\n");
            }

            display.showRawSensors(sensorBuf);
        }
        } // isRawSensorsScreen
    }
#endif

    // Periodic serial status line
    if (now - lastSerialStatus >= deviceConfig.statusInterval()) {
        lastSerialStatus = now;
        float w = weightSnap.stable ? weightSnap.stableWeight : weightSnap.weight;

        // [State] W:123.4g STABLE | NFC:04:A2:.. [PLA] | T:23.1C H:45%
        Serial.printf("[%s] W:%.1fg%s",
            scanStateName(scanState), w, weightSnap.stable ? " STABLE" : "");

        if (nfcSnap.tagPresent) {
            Serial.printf(" | NFC:%s", nfcSnap.uidString.c_str());
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
