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
#include "display.h"
#include "provision.h"
#include "bambu_tag.h"
#include "color.h"
#include "ota_update.h"
#include "environment.h"
#include "device_config.h"
#include "device_identity.h"
#include "printer.h"
#include "fiq_mqtt.h"
#include "bambu_mqtt.h"
#include <ArduinoJson.h>
#include <WiFi.h>
#include "touch.h"
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
//   Wire (I2C):    Shared — guarded by i2cMutex (NAU7802, Pico NFC bridge, color, env)
//   nfcSPI (HSPI): NFC task only (PN5180)
//   WiFi/HTTP:     Network task only
//   Display/LVGL:  Core 1 only
// ============================================================

static Preferences prefs;

// Global I2C bus mutex — guards Wire access from multiple cores/tasks
// (NAU7802 weight on main loop + Pico NFC bridge on NFC task)
SemaphoreHandle_t i2cMutex = nullptr;

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
enum MenuAction : uint8_t { MENU_NONE = 0, MENU_WIFI_SETUP, MENU_TARE_SCALE, MENU_RAW_SENSORS, MENU_CALIBRATE, MENU_REBOOT, MENU_CHECK_UPDATE, MENU_BLE_SCAN };
volatile MenuAction menuActionPending = MENU_NONE;

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
    char uidString[26];     // Fixed buffer (no heap alloc): "XX:XX:XX:XX:XX:XX:XX:XX\0"
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
    NET_PRINT_LABEL,
    NET_POLL_PRINT_JOBS,
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

    // For NET_PRINT_LABEL: label bitmap download + print
    char printSessionId[64];
    bool printInFlight;
    bool printDone;
    bool printSuccess;
    char printError[64];

    // Target slot override (when user cycles to a different return location)
    char targetSlotId[64];
};

static SharedScanData sharedScan;

// -- Shared NFC lookup result (written by MQTT callback, read by main loop) --
struct EmptySlot {
    char id[64];
    char path[128];
};

struct NfcLookupResult {
    volatile bool ready;        // new result available
    bool known;
    char productName[64];
    char material[32];
    char returnLocation[128];
    char returnSlotId[64];      // currently assigned slot UUID
    char uid[26];               // UID that was looked up
    EmptySlot emptySlots[20];
    int emptySlotCount;
    int selectedSlotIndex;      // -1 = original location, 0+ = empty slot index
};
static NfcLookupResult nfcLookup = {};

// Track last UID we sent a lookup for (avoid duplicate requests)
static char lastLookupUid[26] = {0};

// -- OTA progress flag (set by network task, read by main loop) --
static volatile bool otaRunning = false;

// Task handles
static TaskHandle_t nfcTaskHandle = nullptr;
static TaskHandle_t networkTaskHandle = nullptr;
static TaskHandle_t lvglTaskHandle = nullptr;
static TaskHandle_t sensorTaskHandle = nullptr;

// Pause background tasks during calibration, tare, settings, etc.
// Uses a cooperative flag — tasks check it each loop and sleep if set.
static volatile bool backgroundTasksPaused = false;

static void suspendBackgroundTasks() {
    backgroundTasksPaused = true;
}

static void resumeBackgroundTasks() {
    backgroundTasksPaused = false;
}

// -- Sensor Cache (written by sensor task, read by main loop) --
#include "color.h"
#include "environment.h"

struct SensorCache {
    SemaphoreHandle_t mutex;
    ColorData color;
    EnvData env;
    volatile bool colorReadRequested = false;  // Set true to trigger LED-on color read
    uint8_t colorLedBrightness = 200;          // LED brightness for color measurement
};
static SensorCache sensorCache;

// ============================================================
// ============================================================
// LVGL Task (Core 1, Priority 5) — Touch Board Only
// ============================================================
// Highest priority on Core 1 so UI always preempts sensor reads.
// Touch input callback runs within lv_timer_handler via LVGL indev.

static void lvglTask(void* param) {
    Serial.println("[LVGL Task] Started on core " + String(xPortGetCoreID()));
    const TickType_t period = pdMS_TO_TICKS(30);  // ~33fps
    TickType_t lastWake = xTaskGetTickCount();

    for (;;) {
        lv_lock();
        display.processPendingCmd();  // Execute display commands from main loop
        lv_timer_handler();
        lv_unlock();
        vTaskDelayUntil(&lastWake, period);
    }
}

// ============================================================
// Sensor Task (Core 1, Priority 2) — Touch Board Only
// ============================================================
// Round-robin I2C reads: color (async), env.
// Writes to sensorCache protected by mutex.

static void sensorTask(void* param) {
    Serial.println("[Sensor Task] Started on core " + String(xPortGetCoreID()));

    enum SensorSlot : uint8_t { SLOT_START_COLOR, SLOT_WAIT_COLOR, SLOT_ENV };
    SensorSlot slot = SLOT_START_COLOR;

    for (;;) {
        if (backgroundTasksPaused) {
            vTaskDelay(pdMS_TO_TICKS(100));
            continue;
        }

        // Acquire mutex per-read, release between slots so weight task can get in
        switch (slot) {
            case SLOT_START_COLOR:
                if (colorSensor.isConnected() && sensorCache.colorReadRequested) {
                    if (xSemaphoreTake(i2cMutex, pdMS_TO_TICKS(30)) == pdTRUE) {
                        colorSensor.ledOn(50);
                        colorSensor.startRead();
                        xSemaphoreGive(i2cMutex);
                        slot = SLOT_WAIT_COLOR;  // Only advance if read started
                    }
                    // else: mutex busy, retry next iteration
                } else {
                    slot = SLOT_ENV;
                }
                break;
            case SLOT_WAIT_COLOR:
                if (xSemaphoreTake(i2cMutex, pdMS_TO_TICKS(30)) == pdTRUE) {
                    if (colorSensor.isReady()) {
                        ColorData c;
                        colorSensor.finishRead(c);
                        colorSensor.ledOff();
                        xSemaphoreGive(i2cMutex);
                        sensorCache.colorReadRequested = false;
                        if (xSemaphoreTake(sensorCache.mutex, pdMS_TO_TICKS(5)) == pdTRUE) {
                            sensorCache.color = c;
                            xSemaphoreGive(sensorCache.mutex);
                        }
                        slot = SLOT_ENV;
                    } else {
                        xSemaphoreGive(i2cMutex);
                        // Still integrating — stay in WAIT_COLOR
                    }
                }
                break;
            case SLOT_ENV:
                if (envSensor.isConnected()) {
                    if (xSemaphoreTake(i2cMutex, pdMS_TO_TICKS(30)) == pdTRUE) {
                        EnvData e;
                        bool ok = envSensor.read(e);
                        xSemaphoreGive(i2cMutex);
                        if (ok && xSemaphoreTake(sensorCache.mutex, pdMS_TO_TICKS(5)) == pdTRUE) {
                            sensorCache.env = e;
                            xSemaphoreGive(sensorCache.mutex);
                        }
                    }
                }
                slot = SLOT_START_COLOR;
                break;
        }

        vTaskDelay(pdMS_TO_TICKS(50));  // Yield between slots
    }
}

// ============================================================
// NFC Task (Core 0, Priority 2, 8KB stack)
// ============================================================
// Owns the HSPI bus (PN5180). Calls pollNfc() which uses nfcScanner.poll().
// Writes results into nfcResult protected by mutex.

static void nfcTask(void* param) {
    Serial.println("[NFC Task] Started on core " + String(xPortGetCoreID()));

    for (;;) {
        // Cooperative pause — sleep while menu/calibration is active
        if (backgroundTasksPaused) {
            vTaskDelay(pdMS_TO_TICKS(100));
            continue;
        }

        // Poll NFC reader — Pico bridge methods acquire i2cMutex internally,
        // so INT pin check (digitalRead) doesn't block the I2C bus.
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
                strncpy(nfcResult.uidString, nfcScanner.getUidString().c_str(), sizeof(nfcResult.uidString) - 1);

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
                    nfcResult.uidString[0] = '\0';
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
    unsigned long lastPrintJobPoll = 0;
    unsigned long lastMqttTelemetry = 0;
    unsigned long lastBambuRelay = 0;
    bool wifiEverConnected_net = false;
    bool mqttStarted = false;
    bool mqttCapsSent = false;

    for (;;) {
        // Process queued work items (non-blocking peek with short timeout)
        NetworkWorkItem item;
        if (xQueueReceive(networkQueue, &item, pdMS_TO_TICKS(100)) == pdTRUE) {
            switch (item.type) {

            case NET_POST_SCAN: {
                // Use static to keep large structs off the task stack
                static ScanResult scanCopy;
                static TagData tagCopy;
                static char targetSlotCopy[64];
                bool hasTag;

                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                    scanCopy = sharedScan.scanResult;
                    tagCopy = sharedScan.tagData;
                    hasTag = sharedScan.hasTagData;
                    strlcpy(targetSlotCopy, sharedScan.targetSlotId, sizeof(targetSlotCopy));
                    xSemaphoreGive(sharedScan.mutex);
                } else {
                    break;
                }

                if (fillaiqMqtt.isConnected()) {
                    const TagData* tagPtr = hasTag ? &tagCopy : nullptr;
                    const char* slotPtr = targetSlotCopy[0] ? targetSlotCopy : nullptr;
                    String payload = apiClient.buildScanPayload(scanCopy, tagPtr, slotPtr);
                    fillaiqMqtt.publishScan(payload.c_str());
                    Serial.printf("[Scan] Published via MQTT (%d bytes)\n", payload.length());
                } else {
                    Serial.println("[Scan] MQTT not connected, cannot submit");
                    if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                        sharedScan.postInFlight = false;
                        xSemaphoreGive(sharedScan.mutex);
                    }
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
                    if (fillaiqMqtt.isConnected()) {
                        JsonDocument doc;
                        doc["temperatureC"] = env.temperatureC;
                        doc["humidity"] = env.humidity;
                        if (env.pressureHPa > 0) doc["pressureHPa"] = env.pressureHPa;
                        String payload;
                        serializeJson(doc, payload);
                        fillaiqMqtt.publishEnv(payload.c_str());
                        Serial.printf("[Env] Reported via MQTT: T=%.1fC H=%.0f%%\n", env.temperatureC, env.humidity);
                    }
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
                otaCheckNow();
                otaRunning = false;
                break;
            }

            case NET_PRINT_LABEL: {
                // Download label bitmap from server and send to printer
                char sessionId[64];
                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                    strncpy(sessionId, sharedScan.printSessionId, sizeof(sessionId));
                    xSemaphoreGive(sharedScan.mutex);
                } else {
                    break;
                }

                if (sessionId[0] == '\0') {
                    if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                        sharedScan.printDone = true;
                        sharedScan.printSuccess = false;
                        strncpy(sharedScan.printError, "No session", sizeof(sharedScan.printError));
                        xSemaphoreGive(sharedScan.mutex);
                    }
                    break;
                }

                // Ensure printer is connected
                if (!labelPrinter.isConnected()) {
                    Serial.println("[Print] Printer not connected, scanning...");
                    if (!labelPrinter.scan(5000) || !labelPrinter.connect()) {
                        if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                            sharedScan.printDone = true;
                            sharedScan.printSuccess = false;
                            strncpy(sharedScan.printError, "Printer not found", sizeof(sharedScan.printError));
                            xSemaphoreGive(sharedScan.mutex);
                        }
                        break;
                    }
                }

                // Download bitmap via ApiClient
                uint8_t* bitmap = nullptr;
                int labelWidth = 0, labelHeight = 0, bytesPerRow = 0;
                bool downloaded = apiClient.downloadLabelBitmap(
                    sessionId, PRINTER_DOTS_PER_LINE, PRINTER_DPI,
                    &bitmap, &labelWidth, &labelHeight, &bytesPerRow);

                if (!downloaded || !bitmap) {
                    if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                        sharedScan.printDone = true;
                        sharedScan.printSuccess = false;
                        strncpy(sharedScan.printError, "Download failed", sizeof(sharedScan.printError));
                        xSemaphoreGive(sharedScan.mutex);
                    }
                    break;
                }

                // Send to printer
                bool ok = labelPrinter.printRaster(bitmap, bytesPerRow, labelHeight);
                free(bitmap);

                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                    sharedScan.printDone = true;
                    sharedScan.printSuccess = ok;
                    if (!ok) {
                        strncpy(sharedScan.printError, "Print failed", sizeof(sharedScan.printError));
                    } else {
                        sharedScan.printError[0] = '\0';
                    }
                    xSemaphoreGive(sharedScan.mutex);
                }

                Serial.printf("[Print] %s\n", ok ? "Success" : "Failed");
                break;
            }

            case NET_POLL_PRINT_JOBS:
                // Replaced by MQTT — no-op
                break;

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

        // Start MQTT client once WiFi is connected and device is paired
        if (apiClient.isWiFiConnected() && apiClient.isPaired() && !mqttStarted) {
            mqttStarted = true;
            Serial.println("[Net] Starting MQTT client...");
            // Set up incoming message callbacks
            fillaiqMqtt.onScanResult = [](const char* json, int len) {
                // Parse scan result and write to shared state
                ScanResponse resp = {};
                if (apiClient.parseResponse(String(json).substring(0, len), resp)) {
                    if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(100)) == pdTRUE) {
                        sharedScan.response = resp;
                        sharedScan.lastStatus = API_OK;
                        sharedScan.responseReady = true;
                        sharedScan.postInFlight = false;
                        xSemaphoreGive(sharedScan.mutex);
                    }
                    Serial.println("[MQTT] Scan result received");
                }
            };

            fillaiqMqtt.onConfig = [](const char* json, int len) {
                // Parse config — check for Bambu printer settings
                JsonDocument doc;
                if (deserializeJson(doc, json, len)) return;

                // Apply device config (brightness, volume, etc.)
                String configStr;
                serializeJson(doc, configStr);
                deviceConfig.applyFromJson(configStr.c_str());

                // Check for Bambu printer config
                if (doc.containsKey("bambuPrinter")) {
                    JsonObject bp = doc["bambuPrinter"];
                    const char* ip = bp["ip"] | "";
                    const char* code = bp["accessCode"] | "";
                    const char* serial = bp["serialNumber"] | "";
                    const char* machId = bp["machineId"] | "";

                    if (ip[0] && code[0]) {
                        Serial.printf("[Config] Bambu printer: %s (serial: %s)\n", ip, serial);
                        bambuMqtt.begin(ip, code, serial, machId);
                    } else if (bambuMqtt.isConnected()) {
                        // Config cleared — disconnect
                        bambuMqtt.stop();
                    }
                }
            };

            fillaiqMqtt.onNfcLookupResult = [](const char* json, int len) {
                JsonDocument doc;
                if (deserializeJson(doc, json, len)) return;

                nfcLookup.known = doc["known"] | false;
                if (nfcLookup.known) {
                    strlcpy(nfcLookup.productName, doc["productName"] | "Unknown", sizeof(nfcLookup.productName));
                    strlcpy(nfcLookup.material, doc["material"] | "", sizeof(nfcLookup.material));
                    strlcpy(nfcLookup.returnLocation, doc["returnLocation"] | "", sizeof(nfcLookup.returnLocation));
                    strlcpy(nfcLookup.returnSlotId, doc["returnSlotId"] | "", sizeof(nfcLookup.returnSlotId));

                    // Parse empty slots array
                    nfcLookup.emptySlotCount = 0;
                    nfcLookup.selectedSlotIndex = -1;  // default to original location
                    JsonArray arr = doc["emptySlots"].as<JsonArray>();
                    for (JsonObject slot : arr) {
                        if (nfcLookup.emptySlotCount >= 20) break;
                        int idx = nfcLookup.emptySlotCount;
                        strlcpy(nfcLookup.emptySlots[idx].id, slot["id"] | "", sizeof(nfcLookup.emptySlots[idx].id));
                        strlcpy(nfcLookup.emptySlots[idx].path, slot["path"] | "", sizeof(nfcLookup.emptySlots[idx].path));
                        nfcLookup.emptySlotCount++;
                    }
                } else {
                    nfcLookup.productName[0] = '\0';
                    nfcLookup.material[0] = '\0';
                    nfcLookup.returnLocation[0] = '\0';
                    nfcLookup.returnSlotId[0] = '\0';
                    nfcLookup.emptySlotCount = 0;
                    nfcLookup.selectedSlotIndex = -1;
                }
                nfcLookup.ready = true;
                Serial.printf("[MQTT] NFC lookup: %s (%d empty slots)\n",
                    nfcLookup.known ? nfcLookup.productName : "unknown",
                    nfcLookup.emptySlotCount);
            };

            fillaiqMqtt.begin(
                apiClient.getMqttUrl(),
                apiClient.getDeviceToken(),
                apiClient.getStationId()
            );
        }

        // Publish capabilities once after MQTT connects
        if (fillaiqMqtt.isConnected() && !mqttCapsSent) {
            mqttCapsSent = true;
            // Build capabilities JSON (same format as old heartbeat)
            String capsJson = apiClient.buildCapabilitiesJson();

            // Augment with live printer state
            if (labelPrinter.isConnected()) {
                JsonDocument capsDoc;
                deserializeJson(capsDoc, capsJson);
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
                capsJson = "";
                serializeJson(capsDoc, capsJson);
            }

            fillaiqMqtt.publishCapabilities(capsJson.c_str());
            Serial.println("[MQTT] Published capabilities");
        }
        if (!fillaiqMqtt.isConnected()) mqttCapsSent = false;

        // Periodic: MQTT telemetry heartbeat
        {
            unsigned long now = millis();
            if (fillaiqMqtt.isConnected() &&
                now - lastMqttTelemetry >= MQTT_TELEMETRY_INTERVAL_MS) {
                lastMqttTelemetry = now;

                JsonDocument doc;
                doc["version"] = FW_VERSION;
                doc["sku"] = FW_SKU;
                doc["uptime"] = millis() / 1000;
                doc["freeHeap"] = ESP.getFreeHeap();
                doc["wifiRssi"] = WiFi.RSSI();
                doc["ipAddress"] = WiFi.localIP().toString();
                doc["weightCalibration"] = deviceConfig.weightCalibration();

                // Include label printer status in telemetry
                if (labelPrinter.isConnected()) {
                    JsonObject pr = doc["printer"].to<JsonObject>();
                    pr["connected"] = true;
                    const auto& ps = labelPrinter.getState();
                    pr["battery"] = ps.batteryPercent;
                    pr["paperLoaded"] = ps.paperLoaded;
                    pr["coverClosed"] = ps.coverClosed;
                } else {
                    JsonObject pr = doc["printer"].to<JsonObject>();
                    pr["connected"] = false;
                }

                String payload;
                serializeJson(doc, payload);
                fillaiqMqtt.publishTelemetry(payload.c_str());
            }
        }

        // OTA checks + print jobs now arrive via MQTT push — no more HTTP polling

        // Relay Bambu printer status to server (every 5s if connected)
        #define BAMBU_RELAY_INTERVAL_MS 5000
        {
            unsigned long now = millis();
            if (fillaiqMqtt.isConnected() && bambuMqtt.isConnected() &&
                bambuMqtt.getStatus().valid &&
                now - lastBambuRelay >= BAMBU_RELAY_INTERVAL_MS) {
                lastBambuRelay = now;

                String statusJson = bambuMqtt.toJson();
                fillaiqMqtt.publishMachineStatus(bambuMqtt.getMachineId(), statusJson.c_str());
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
    deviceConfig.setWeightCalibration(factor);
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
    lv_lock(); display.showMessage("Connecting...", ssid); lv_unlock();

    apiClient.setCredentials(ssid, pass);

    // Try connecting (blocking -- acceptable during provisioning flow)
    if (apiClient.connectWiFi()) {
        wifiEverConnected = true;
        lv_lock(); display.showMessage("WiFi Connected!", WiFi.localIP().toString().c_str()); lv_unlock();
        delay(1000);

        // Verify existing pairing or start new pairing
        if (apiClient.hasApiUrl()) {
            if (apiClient.isPaired()) {
                // Check server still recognizes our token
                apiClient.verifyPairing();
            }
            if (!apiClient.isPaired()) {
                startPairing();
            }
        }
    } else {
        lv_lock(); display.showMessage("WiFi Failed", "Restarting setup..."); lv_unlock();
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
    lv_lock(); display.showQrCode(qrData, apName); lv_unlock();

    Serial.printf("[Setup] AP: %s  Pass: %s\n", apName, PROV_AP_PASSWORD);
}

void startPairing() {
    char code[12] = {0};
    lv_lock(); display.showMessage("Pairing...", "Contacting server"); lv_unlock();

    // This is a blocking HTTP call -- acceptable during setup flow
    // (only called from setup() or user-initiated actions)
    ApiStatus status = apiClient.requestPairingCode(code, sizeof(code));

    if (status == API_OK && apiClient.isPaired()) {
        // Server recognized device as already paired -- token refreshed
        lv_lock(); display.showMessage("Paired!", "Ready to scan"); lv_unlock();
        delay(1000);
    } else if (status == API_OK && code[0] != '\0') {
        // New pairing -- show code on display
        pairingActive = true;
        lastPairingPoll = millis();

        lv_lock(); display.showPairingCode(code); lv_unlock();
        Serial.printf("[Pair] Enter code on web app: %s\n", code);
    } else {
        Serial.printf("[Pair] Failed: %d\n", status);
        lv_lock(); display.showMessage("Pair Failed", "Check API URL"); lv_unlock();
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
    scale.getSnapshot(weightSnap.weight, weightSnap.stableWeight, weightSnap.stable);
}

// -- NFC snapshot (read from shared NfcTaskResult, used by state machine) --

struct NfcSnapshot {
    bool tagPresent;
    bool tagIsNew;
    uint8_t uid[NFC_UID_MAX_LEN];
    uint8_t uidLen;
    bool hasData;
    TagData tagData;
    char uidString[26];  // Fixed buffer: 8 bytes * 3 chars + null (no heap alloc)
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
        strncpy(nfcSnap.uidString, nfcResult.uidString, sizeof(nfcSnap.uidString) - 1);
        nfcSnap.uidString[sizeof(nfcSnap.uidString) - 1] = '\0';
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

// -- Sensor snapshot (read from sensor task cache, used by state machine) --
static ColorData cachedColor = {};
static EnvData cachedEnv = {};

void snapshotSensors() {
    if (xSemaphoreTake(sensorCache.mutex, pdMS_TO_TICKS(5)) == pdTRUE) {
        cachedColor = sensorCache.color;
        cachedEnv = sensorCache.env;
        xSemaphoreGive(sensorCache.mutex);
    }
}

// -- Trigger a scan (snapshot sensors + enter SUBMITTING state) --

void triggerScan() {
    unsigned long now = millis();
    currentScan.clear_data();
    currentScan.timestamp = now;
    currentScan.weight.grams = weightSnap.stable ? weightSnap.stableWeight : weightSnap.weight;
    currentScan.weight.stable = weightSnap.stable;
    currentScan.weight.valid = true;

    if (nfcSnap.tagPresent) {
        currentScan.nfcPresent = true;
        strncpy(currentScan.nfcUid, nfcSnap.uidString, sizeof(currentScan.nfcUid) - 1);
        currentScan.nfcUidLen = nfcSnap.uidLen;
        currentScan.nfcTagType = nfcSnap.hasData ? nfcSnap.tagData.type : 0;
    }

    // If color sensor is connected, go to color read screen first
    if (colorSensor.isConnected()) {
        enterState(SCAN_COLOR_READ);
        return;
    }

    enterState(SCAN_SUBMITTING);
}

// Capture color data and proceed to submission
void submitScanWithColor() {
    snapshotSensors();
    if (cachedColor.valid) currentScan.color = cachedColor;
    enterState(SCAN_SUBMITTING);
}

void submitScanSkipColor() {
    // No color data — submit as-is
    enterState(SCAN_SUBMITTING);
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
        if (display.scanButtonPressed) {
            display.scanButtonPressed = false;
            snapshotSensors();
            triggerScan();
        }
        break;

    case SCAN_COLOR_READ:
        if (display.colorReadButtonPressed) {
            display.colorReadButtonPressed = false;
            Serial.println("[Scan] Reading color...");
            sensorCache.colorReadRequested = true;
            vTaskDelay(pdMS_TO_TICKS(300));
            submitScanWithColor();
        }
        if (display.colorSkipButtonPressed) {
            display.colorSkipButtonPressed = false;
            Serial.println("[Scan] Color skipped");
            submitScanSkipColor();
        }
        // Timeout after 30s — skip color automatically
        if (elapsed > 30000) {
            Serial.println("[Scan] Color read timeout, skipping");
            submitScanSkipColor();
        }
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
                // Pass target slot override if user cycled to a different location
                if (nfcLookup.known && nfcLookup.selectedSlotIndex >= 0) {
                    strlcpy(sharedScan.targetSlotId,
                            nfcLookup.emptySlots[nfcLookup.selectedSlotIndex].id,
                            sizeof(sharedScan.targetSlotId));
                } else {
                    sharedScan.targetSlotId[0] = '\0';
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

        // Timeout submitting
        unsigned long submitTimeout = 5000;
        if (elapsed > submitTimeout) {
            Serial.println("[Scan] Submit timeout");
            if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(50)) == pdTRUE) {
                sharedScan.postInFlight = false;
                xSemaphoreGive(sharedScan.mutex);
            }
            enterState(SCAN_RESULT);
        }
        break;
    }

    case SCAN_RESULT: {
        // Wait for user tap "Done" or "Print", or 30s timeout
        if (display.doneButtonPressed) {
            display.doneButtonPressed = false;
            enterState(SCAN_IDLE);
        }

        // Handle print button — enqueue label download+print to network task
        if (display.printButtonPressed) {
            display.printButtonPressed = false;

            if (lastResponse.sessionId[0] != '\0' && apiClient.isWiFiConnected()) {
                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(10)) == pdTRUE) {
                    if (!sharedScan.printInFlight) {
                        strncpy(sharedScan.printSessionId, lastResponse.sessionId,
                                sizeof(sharedScan.printSessionId));
                        sharedScan.printInFlight = true;
                        sharedScan.printDone = false;
                        sharedScan.printSuccess = false;
                        sharedScan.printError[0] = '\0';
                        xSemaphoreGive(sharedScan.mutex);

                        NetworkWorkItem item = { NET_PRINT_LABEL };
                        xQueueSend(networkQueue, &item, 0);
                        Serial.println("[Print] Label print job enqueued");
                    } else {
                        xSemaphoreGive(sharedScan.mutex);
                        Serial.println("[Print] Already printing");
                    }
                }
            } else {
                Serial.println("[Print] No session or no WiFi");
            }
        }

        // Check for print completion
        if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(5)) == pdTRUE) {
            if (sharedScan.printDone) {
                sharedScan.printDone = false;
                sharedScan.printInFlight = false;
                if (sharedScan.printSuccess) {
                    Serial.println("[Print] Label printed successfully");
                } else {
                    Serial.printf("[Print] Error: %s\n", sharedScan.printError);
                }
            }
            xSemaphoreGive(sharedScan.mutex);
        }
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
    if (fillaiqMqtt.isConnected())   icons |= ICON_MQTT;
    if (labelPrinter.isConnected())  icons |= ICON_PRINTER;

    // For SCAN_IDLE: update the live dashboard with current sensor readings
    if (scanState == SCAN_IDLE) {
        // Build the dashboard screen if not already showing
        const ScanResponse* serverData = nullptr;
        lv_lock();
        display.update(scanState, w, stable, nullptr, serverData, nullptr, icons);
        lv_unlock();

        // Sensor data comes from sensor task cache (snapshotSensors)
        // No I2C reads here — dashboard uses cachedColor, cachedEnv

        // Build NFC info string — show reading progress
        static char nfcInfoBuf[80];
        const char* nfcInfo = nullptr;
        if (nfcSnap.tagPresent && nfcSnap.uidString[0] != '\0') {
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

            // Trigger NFC UID lookup when a new tag is detected
            if (nfcSnap.tagIsNew && fillaiqMqtt.isConnected() &&
                strcmp(nfcSnap.uidString, lastLookupUid) != 0) {
                strlcpy(lastLookupUid, nfcSnap.uidString, sizeof(lastLookupUid));
                nfcLookup.ready = false;
                fillaiqMqtt.publishNfcLookup(nfcSnap.uidString);
                Serial.printf("[NFC] Lookup request: %s\n", nfcSnap.uidString);
            }
        } else {
            // Tag removed — reset lookup state
            if (lastLookupUid[0] != '\0') {
                lastLookupUid[0] = '\0';
                nfcLookup.ready = false;
                nfcLookup.known = false;
                nfcLookup.emptySlotCount = 0;
                nfcLookup.selectedSlotIndex = -1;
                lv_lock();
                display.setScanButtonLabel("SCAN");
                lv_unlock();
            }
        }

        // Consume NFC lookup result from server
        if (nfcLookup.ready) {
            nfcLookup.ready = false;
            lv_lock();
            display.updateNfcLookup(
                nfcLookup.productName,
                nfcLookup.material,
                nfcLookup.returnLocation,
                nfcLookup.known,
                nfcLookup.emptySlotCount);
            display.setScanButtonLabel(nfcLookup.known ? "UPDATE" : "SCAN");
            lv_unlock();
        }

        // Handle location cycling (user tapped < or > on the NFC panel)
        if (display.locationCycleDelta != 0 && nfcLookup.known) {
            int delta = display.locationCycleDelta;
            display.locationCycleDelta = 0;

            // Total options: original slot (if exists) + empty slots
            bool hasOriginal = nfcLookup.returnLocation[0] != '\0';
            int totalOptions = nfcLookup.emptySlotCount + (hasOriginal ? 1 : 0);
            if (totalOptions > 0) {
                // selectedSlotIndex: -1 = original, 0..N-1 = empty slot
                // Map to 0-based for cycling: 0 = original (if exists), then empty slots
                int currentPos;
                if (hasOriginal) {
                    currentPos = nfcLookup.selectedSlotIndex + 1;  // -1 → 0, 0 → 1, etc.
                } else {
                    currentPos = nfcLookup.selectedSlotIndex;      // 0-based among empty slots
                }
                currentPos = (currentPos + delta + totalOptions) % totalOptions;

                if (hasOriginal) {
                    nfcLookup.selectedSlotIndex = currentPos - 1;  // 0 → -1, 1 → 0, etc.
                } else {
                    nfcLookup.selectedSlotIndex = currentPos;
                }

                // Determine the display path for the selected location
                const char* selectedPath;
                if (nfcLookup.selectedSlotIndex == -1) {
                    selectedPath = nfcLookup.returnLocation;
                } else {
                    selectedPath = nfcLookup.emptySlots[nfcLookup.selectedSlotIndex].path;
                }

                lv_lock();
                display.updateReturnLocation(selectedPath, currentPos, totalOptions);
                lv_unlock();
            }
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

        // Env data
        float tempC = -1, humidity = 0, pressureHPa = 0;
        if (envSensor.isConnected() && cachedEnv.valid) {
            tempC = cachedEnv.temperatureC;
            humidity = cachedEnv.humidity;
            pressureHPa = cachedEnv.pressureHPa;
        }

        lv_lock();
        display.updateDashboard(w, stable, nfcInfo, colorInfo, cR, cG, cB,
                                 tempC, humidity, pressureHPa, true);
        lv_unlock();
    } else {
        // For SCAN_SUBMITTING or SCAN_RESULT — only rebuild screen on state change,
        // not every frame (rebuilding destroys buttons and breaks touch events)
        const ScanResponse* serverData = lastResponse.scanId[0] ? &lastResponse : nullptr;

        // Build session URL for result screen QR code
        static char sessionUrl[128] = {0};
        if (scanState == SCAN_RESULT && lastResponse.sessionId[0]) {
            snprintf(sessionUrl, sizeof(sessionUrl), "%s/scan/%s",
                     apiClient.getApiUrl(), lastResponse.sessionId);
        }

        lv_lock();
        display.update(scanState, w, stable, nullptr, serverData, nullptr, icons,
                       sessionUrl, labelPrinter.isConnected());
        lv_unlock();
    }
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
    Serial.printf("    MQTT: %s\n", fillaiqMqtt.isConnected() ? "connected" : "disconnected");
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
        Serial.printf("  NFC: %s", nfcSnap.uidString);
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
            Serial.println("[Scan] Triggered from serial");
            triggerScan();
        } else {
            printScanDetails();
        }
    }
    else if (line == "nfc") {
        // Print NFC status from snapshot (thread-safe)
        Serial.println("=== NFC ===");
        Serial.printf("  Connected: %s\n", nfcSnap.connected ? "YES" : "no");
        Serial.printf("  Tag: %s\n", nfcSnap.tagPresent ? nfcSnap.uidString : "none");
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

    // Display first -- show boot screen immediately
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
    Wire.setClock(400000);  // 400kHz fast mode — all devices support it
    Wire.setTimeOut(50);
    i2cMutex = xSemaphoreCreateMutex();
    Serial.printf("  I2C bus: SDA=%d SCL=%d @ 400kHz\n", I2C_SDA, I2C_SCL); Serial.flush();

    // Touch init first -- reset FT6336G so it releases SDA before we scan
    display.setBootStatus("Touch init...");
    touchInput.begin();
    if (touchInput.isConnected()) {
        touchInput.registerLvglInput();
    }
    display.addBootItem("Touch", touchInput.isConnected());

    // Probe known addresses only (full scan can hang on stuck bus)
    display.setBootStatus("Scanning I2C...");
    const uint8_t knownAddrs[] = { NAU7802_ADDR,
                                    AS7341_ADDR, TCS34725_ADDR, OPT4048_ADDR,
                                    AS7265X_ADDR, AS7331_ADDR, 0x24 /*PN532*/,
                                    0x38 /*FT6336*/, 0x55 /*Pico NFC*/,
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

    // Color sensor (auto-detect)
    display.setBootStatus("Color init...");
    colorSensor.begin();
    if (colorSensor.isConnected()) {
        display.setBootStatus("Color baseline...");
        colorSensor.calibrateAmbient();
    }
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
        // Weight task on Core 1 — NAU7802 I2C guarded by i2cMutex internally
        scale.startTask(1, 3);  // Core 1, priority 3 (above sensors, below LVGL)
    }


    // Set sensor flags for status bar icons on runtime screens
    {
        uint8_t sf = 0;
        if (nfcScanner.isConnected())       sf |= SENSOR_NFC;
        if (scale.isConnected())            sf |= SENSOR_SCALE;
        if (colorSensor.isConnected())      sf |= SENSOR_COLOR;
        if (envSensor.isConnected())        sf |= SENSOR_ENV;
        display.setSensorFlags(sf);
    }

    // Build hardware manifest from detected sensors
    DeviceCapabilities caps;
    if (nfcScanner.isConnected()) {
        caps.nfc.set("PN5180", "I2C", 0x55);
    }
    if (scale.isConnected()) {
        if (scale.getDriverType() == WEIGHT_NAU7802)
            caps.scale.set("NAU7802", "I2C", NAU7802_ADDR);
        else
            caps.scale.set("HX711", "GPIO", 0, HX711_SCK_PIN, HX711_DT_PIN);
    }
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
    caps.display.set("ILI9341", "SPI", 0, TFT_CS_PIN);
    if (envSensor.isConnected())
        caps.environment.set(envSensor.getChipName(), "I2C", envSensor.getI2CAddr());

    if (touchInput.isConnected())
        caps.touch.set("FT6336G", "I2C", 0x38);
    // Battery ADC -- always present on touch board
    caps.battery.set("ADC", "GPIO", 0, BATTERY_ADC_PIN);

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

        // Verify existing pairing or start new pairing
        if (apiClient.hasApiUrl()) {
            if (apiClient.isPaired()) {
                apiClient.verifyPairing();
            }
            if (!apiClient.isPaired()) {
                startPairing();
            }
        }
    } else {
        // Start WiFi AP + captive portal provisioning
        startProvisioning();
    }

    // Menu action callbacks -- set flags for main loop to handle
    // (LVGL event callbacks run on lv_timer_handler stack, can't do heavy work)
    display.onMenuWifiSetup = []() { menuActionPending = MENU_WIFI_SETUP; };
    display.onMenuTareScale = []() { menuActionPending = MENU_TARE_SCALE; };
    display.onMenuRawSensors = []() { menuActionPending = MENU_RAW_SENSORS; };
    display.onMenuCalibrate  = []() { menuActionPending = MENU_CALIBRATE; };
    display.onMenuReboot       = []() { menuActionPending = MENU_REBOOT; };
    display.onMenuCheckUpdate  = []() { menuActionPending = MENU_CHECK_UPDATE; };
    display.onMenuBleScan      = []() { menuActionPending = MENU_BLE_SCAN; };

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

    // Create network task on Core 0
    xTaskCreatePinnedToCore(
        networkTask,        // task function
        "net",              // name
        12288,              // stack size (bytes) — needs room for JSON + HTTP
        nullptr,            // parameter
        1,                  // priority (lower than NFC)
        &networkTaskHandle, // task handle
        0                   // core 0
    );
    Serial.println("  Net task: started on core 0 (priority 1)");

    // Sensor task on Core 1 — round-robin I2C reads (color, env)
    sensorCache.mutex = xSemaphoreCreateMutex();
    xTaskCreatePinnedToCore(sensorTask, "sensor", 4096, nullptr,
        2, &sensorTaskHandle, 1);
    Serial.println("  Sensor task: started on core 1 (priority 2)");

    // LVGL task on Core 1 — highest priority, UI always responsive
    xTaskCreatePinnedToCore(lvglTask, "lvgl", 8192, nullptr,
        5, &lvglTaskHandle, 1);
    Serial.println("  LVGL task: started on core 1 (priority 5)");

    Wire.setTimeOut(500);  // Restore normal I2C timeout for runtime
    Serial.printf("  Heap: %u free, %u min | PSRAM: %u free\n",
        ESP.getFreeHeap(), ESP.getMinFreeHeap(), ESP.getFreePsram());
    enterState(SCAN_IDLE);

    Serial.println("\nReady. Type 'help' for commands.\n");
}

// ============================================================
// Main Loop (Core 1 -- Arduino default, priority 1)
// ============================================================
// State machine, display updates (with lv_lock), serial commands.
// No direct I2C — sensors handled by dedicated tasks.

static unsigned long lastDisplayUpdate = 0;
static unsigned long lastSerialStatus = 0;

void loop() {
    unsigned long now = millis();

    // LVGL ticking handled by dedicated lvglTask (priority 5)

    // Process deferred menu actions (set by LVGL event callbacks)
    if (menuActionPending != MENU_NONE) {
        MenuAction action = menuActionPending;
        menuActionPending = MENU_NONE;
        // Suspend all background tasks during menu actions for UI responsiveness
        suspendBackgroundTasks();
        scale.pauseTask();  // Weight task must stop to free i2cMutex for touch

        // Helper: request display update and wait for LVGL task to render it
        #define SHOW_MSG(l1, l2) do { display.requestMessage(l1, l2); vTaskDelay(pdMS_TO_TICKS(100)); } while(0)
        #define SHOW_CAL(l1, l2) do { display.requestCalibrate(l1, l2); vTaskDelay(pdMS_TO_TICKS(100)); } while(0)

        switch (action) {
            case MENU_WIFI_SETUP:
                scale.resumeTask();
                resumeBackgroundTasks();
                startProvisioning();
                break;
            case MENU_TARE_SCALE:
                if (scale.isConnected()) {
                    SHOW_MSG("Taring...", "Keep platform empty");
                    vTaskDelay(pdMS_TO_TICKS(200));
                    scale.tare();
                    SHOW_MSG("Tared!", "Scale zeroed");
                    vTaskDelay(pdMS_TO_TICKS(1000));
                }
                break;
            case MENU_RAW_SENSORS:
                // Raw sensors still uses lv_lock since it has its own update loop
                lv_lock(); display.showRawSensors("Loading..."); lv_unlock();
                break;
            case MENU_CALIBRATE: {
                if (!scale.isConnected()) {
                    SHOW_MSG("No Scale", "Scale not detected");
                    vTaskDelay(pdMS_TO_TICKS(1500));
                    break;
                }
                // Step 1: Remove weight
                SHOW_CAL("Remove all weight", "Tap Continue when ready");
                display.touchSubmitRequested = false;
                while (!display.touchSubmitRequested) {
                    vTaskDelay(pdMS_TO_TICKS(50));
                }
                // Step 2: Tare
                SHOW_CAL("Taring...", "Hold still");
                vTaskDelay(pdMS_TO_TICKS(500));
                scale.tare();
                // Step 3: Place known weight
                SHOW_CAL("Place 500g weight", "Tap Continue when ready");
                display.touchSubmitRequested = false;
                while (!display.touchSubmitRequested) {
                    vTaskDelay(pdMS_TO_TICKS(50));
                }
                // Step 4: Calculate
                SHOW_CAL("Measuring...", "Hold still");
                vTaskDelay(pdMS_TO_TICKS(500));
                double raw = 0;
                raw = scale.getValueForCalibration(20);
                float factor = (float)(raw / 500.0);
                scale.setScale(factor);
                saveCalibration(factor);
                char msg[48];
                snprintf(msg, sizeof(msg), "Factor: %.4f", factor);
                SHOW_CAL("Calibrated!", msg);
                Serial.printf("Calibration: %.4f (saved)\n", factor);
                vTaskDelay(pdMS_TO_TICKS(2000));
                SHOW_MSG("Done", "Tap Back to return");
                break;
            }
            case MENU_CHECK_UPDATE:
                if (apiClient.isWiFiConnected() && apiClient.isPaired()) {
                    SHOW_MSG("Checking...", "Looking for updates");
                    scale.resumeTask();
                    resumeBackgroundTasks();
                    NetworkWorkItem item = { NET_CHECK_OTA };
                    xQueueSend(networkQueue, &item, 0);
                    vTaskDelay(pdMS_TO_TICKS(2000));
                } else {
                    SHOW_MSG("No Connection", "WiFi or pairing required");
                    vTaskDelay(pdMS_TO_TICKS(2000));
                }
                break;
            case MENU_BLE_SCAN:
                SHOW_MSG("Scanning BLE...", "Looking for printer");
                scale.resumeTask();
                resumeBackgroundTasks();
                if (labelPrinter.scan(8000)) {
                    char msg2[48];
                    snprintf(msg2, sizeof(msg2), "Found: %s", labelPrinter.getDeviceName());
                    SHOW_MSG(msg2, "Connecting...");
                    labelPrinter.connect();
                    if (labelPrinter.isConnected()) {
                        SHOW_MSG("Printer Ready", labelPrinter.getDeviceName());
                    } else {
                        SHOW_MSG("Connect Failed", labelPrinter.getDeviceName());
                    }
                } else {
                    SHOW_MSG("No Printer", "None found nearby");
                }
                vTaskDelay(pdMS_TO_TICKS(2000));
                break;
            case MENU_REBOOT:
                Serial.println("Rebooting now...");
                Serial.flush();
                esp_restart();
                break;
            default: break;
        }
    }

    // Resume background tasks when menu is exited (Back button pressed)
    if (backgroundTasksPaused && !display.isMenuActive()) {
        scale.resumeTask();
        resumeBackgroundTasks();
    }

    // Weight polling handled by weight task (Core 1, priority 3)
    // Snapshot weight once per loop (avoids repeated mutex acquisitions)
    snapshotWeight();

    // Snapshot NFC state from NFC task (thread-safe read)
    snapshotNfc();
    snapshotSensors();

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
                    lv_lock(); display.showMessage("Paired!", "Ready to scan"); lv_unlock();
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

    // Environmental data reporting (uses cached data from sensor task)
    {
        static unsigned long lastEnvReport = 0;
        if (envSensor.isConnected() && apiClient.isPaired() && apiClient.isWiFiConnected()
            && now - lastEnvReport >= deviceConfig.envReportInterval()) {
            lastEnvReport = now;
            if (cachedEnv.valid) {
                if (xSemaphoreTake(sharedScan.mutex, pdMS_TO_TICKS(5)) == pdTRUE) {
                    sharedScan.envData = cachedEnv;
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

    // Live sensor screens -- continuous update
    if (display.isMenuActive() && now - lastDisplayUpdate >= 200) {
        lastDisplayUpdate = now;

        // Raw sensors screen — uses cached data from sensor task (no I2C here)
        if (display.isRawSensorsScreen()) {
        static char sensorBuf[512];

        // Build display string from cached values (snapshotSensors already called)
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
                            typeName, nfcSnap.uidString,
                            td.sectors_read, TagData::NUM_SECTORS);
                    else if (td.type == TAG_ISO15693)
                        pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos,
                            "NFC: %s %s\n %d blocks\n",
                            typeName, nfcSnap.uidString, td.pages_read);
                    else
                        pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos,
                            "NFC: %s %s\n %d pages\n",
                            typeName, nfcSnap.uidString, td.pages_read);
                } else {
                    pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos, "NFC: no tag\n");
                }
            } else {
                pos += snprintf(sensorBuf + pos, sizeof(sensorBuf) - pos, "NFC: --\n");
            }

            lv_lock(); display.showRawSensors(sensorBuf); lv_unlock();
        }
        } // isRawSensorsScreen
    }

    // Periodic serial status line
    if (now - lastSerialStatus >= deviceConfig.statusInterval()) {
        lastSerialStatus = now;
        float w = weightSnap.stable ? weightSnap.stableWeight : weightSnap.weight;

        // [State] W:123.4g STABLE | NFC:04:A2:.. [PLA] | T:23.1C H:45%
        Serial.printf("[%s] W:%.1fg%s",
            scanStateName(scanState), w, weightSnap.stable ? " STABLE" : "");

        if (nfcSnap.tagPresent) {
            Serial.printf(" | NFC:%s", nfcSnap.uidString);
            if (lastResponse.material[0])
                Serial.printf(" [%s]", lastResponse.material);
        }

        if (lastResponse.identified && lastResponse.itemName[0])
            Serial.printf(" | %s", lastResponse.itemName);

        Serial.println();
    }

    // Serial commands
    handleSerial();
}
