// ============================================================
// Filla IQ — FillaShelf Firmware
// Multi-bay shelf scale: weight + NFC per bay
// Weight reading runs on Core 1 via FreeRTOS task
// Main loop (Core 0) handles UI, serial commands, LED
// ============================================================

#include <Arduino.h>
#include <Adafruit_NeoPixel.h>
#include <Preferences.h>

#include "config.h"
#include "hx711_multi.h"
#include "display.h"
#include "nfc.h"
#include "bambu_tag.h"

// ==================== Hardware Objects ====================

Adafruit_NeoPixel led(RGB_LED_COUNT, RGB_LED_PIN, NEO_GRB + NEO_KHZ800);
Preferences prefs;

// ==================== State ====================

unsigned long lastLedUpdate = 0;
unsigned long lastPrint = 0;

// Calibration state machine (walks through all connected channels)
enum CalState { CAL_NONE, CAL_WAIT_EMPTY, CAL_WAIT_WEIGHT };
CalState calState = CAL_NONE;
uint8_t calChannel = 0;
uint8_t calQueue[HX711_NUM_CHANNELS];  // Channels to calibrate
uint8_t calQueueLen = 0;
uint8_t calQueueIdx = 0;
float   calFactors[HX711_NUM_CHANNELS]; // Store results for summary

// How many channels to actually use (set in setup based on what's detected)
uint8_t activeChannels = 0;

// ==================== Calibration Persistence (NVS) ====================

void saveCalibration() {
    prefs.begin("cal", false);  // read-write
    for (uint8_t ch = 0; ch < activeChannels; ch++) {
        if (scales.isConnected(ch)) {
            char key[8];
            snprintf(key, sizeof(key), "ch%d", ch);
            prefs.putFloat(key, scales.getScaleFactor(ch));
        }
    }
    prefs.end();
    Serial.println("Calibration saved to flash.");
}

void loadCalibration() {
    prefs.begin("cal", true);  // read-only
    int loaded = 0;
    for (uint8_t ch = 0; ch < activeChannels; ch++) {
        if (!scales.isConnected(ch)) continue;
        char key[8];
        snprintf(key, sizeof(key), "ch%d", ch);
        if (prefs.isKey(key)) {
            float factor = prefs.getFloat(key);
            scales.setScale(ch, factor);
            Serial.printf("  CH%d cal loaded: %.4f\n", ch, factor);
            loaded++;
        }
    }
    prefs.end();
    if (loaded == 0) {
        Serial.println("  No saved calibration — using defaults.");
    }
}

void clearCalibration() {
    prefs.begin("cal", false);
    prefs.clear();
    prefs.end();
    // Reset all channels to default
    scales.setScaleAll(WEIGHT_CALIBRATION);
    Serial.println("Calibration cleared. Using defaults.");
}

// ==================== RGB LED ====================

void initLed() {
    led.begin();
    led.setBrightness(30);
    led.show();
    Serial.printf("RGB LED: OK (GPIO%d)\n", RGB_LED_PIN);
}

void updateLed() {
    bool anySpool = false;
    for (uint8_t ch = 0; ch < activeChannels; ch++) {
        if (scales.isConnected(ch) && scales.getWeight(ch) > SPOOL_PRESENT_THRESHOLD) {
            anySpool = true;
            break;
        }
    }
    if (anySpool) {
        led.setPixelColor(0, 0, 30, 0);
    } else {
        led.setPixelColor(0, 0, 0, 0);
    }
    led.show();
}

// ==================== Calibration Helpers ====================

void calPromptEmpty() {
    Serial.printf("\n--- CH%d (%d of %d) ---\n", calChannel, calQueueIdx + 1, calQueueLen);
    Serial.printf("Remove all weight from CH%d.\n", calChannel);
    Serial.println("Send 'ready' when empty (or 'skip' / 'abort'):");
    calState = CAL_WAIT_EMPTY;

    SlotDisplay* disp = getDisplay(calChannel);
    if (disp) disp->showCalWaitEmpty();
}

void calStartNextChannel() {
    calQueueIdx++;
    if (calQueueIdx >= calQueueLen) {
        // All done — print summary
        Serial.println("\n=== CALIBRATION SUMMARY ===");
        for (uint8_t i = 0; i < calQueueLen; i++) {
            uint8_t ch = calQueue[i];
            if (calFactors[ch] > 0) {
                Serial.printf("  CH%d: %.4f\n", ch, calFactors[ch]);
            } else {
                Serial.printf("  CH%d: skipped\n", ch);
            }
        }
        saveCalibration();
        Serial.println();
        // Exit cal mode on all displays
        for (uint8_t i = 0; i < calQueueLen; i++) {
            SlotDisplay* disp = getDisplay(calQueue[i]);
            if (disp) disp->exitCalMode();
        }
        scales.resumeTask();
        calState = CAL_NONE;
        return;
    }
    calChannel = calQueue[calQueueIdx];
    calPromptEmpty();
}

// ==================== Serial Commands ====================

void handleSerialCommands() {
    if (!Serial.available()) return;

    String cmd = Serial.readStringUntil('\n');
    cmd.trim();
    if (cmd.length() == 0) return;

    // --- Handle calibration state machine first ---
    if (calState == CAL_WAIT_EMPTY) {
        if (cmd == "abort" || cmd == "a") {
            Serial.println("Calibration aborted.");
            for (uint8_t i = 0; i < calQueueLen; i++) {
                SlotDisplay* disp = getDisplay(calQueue[i]);
                if (disp) disp->exitCalMode();
            }
            scales.resumeTask();
            calState = CAL_NONE;
            return;
        }
        if (cmd == "skip" || cmd == "s") {
            Serial.printf("Skipping CH%d.\n", calChannel);
            calFactors[calChannel] = 0;
            calStartNextChannel();
            return;
        }
        if (cmd == "ready" || cmd == "r") {
            Serial.printf("Taring CH%d...\n", calChannel);
            scales.tare(calChannel);
            Serial.printf("  Offset: %ld\n", scales.getOffset(calChannel));
            Serial.println();
            Serial.println("Place a known weight on the scale.");
            Serial.println("Enter the weight in grams (e.g. '500'):");
            calState = CAL_WAIT_WEIGHT;
            {
                SlotDisplay* disp = getDisplay(calChannel);
                if (disp) disp->showCalWaitWeight();
            }
            return;
        }
        Serial.println("Send 'ready', 'skip', or 'abort'.");
        return;
    }

    if (calState == CAL_WAIT_WEIGHT) {
        if (cmd == "abort" || cmd == "a") {
            Serial.println("Calibration aborted.");
            for (uint8_t i = 0; i < calQueueLen; i++) {
                SlotDisplay* disp = getDisplay(calQueue[i]);
                if (disp) disp->exitCalMode();
            }
            scales.resumeTask();
            calState = CAL_NONE;
            return;
        }
        if (cmd == "skip" || cmd == "s") {
            Serial.printf("Skipping CH%d.\n", calChannel);
            calFactors[calChannel] = 0;
            calStartNextChannel();
            return;
        }
        float knownWeight = cmd.toFloat();
        if (knownWeight <= 0) {
            Serial.println("Enter weight in grams (e.g. '500'), 'skip', or 'abort'.");
            return;
        }
        Serial.printf("Reading CH%d with %.1fg known weight...\n", calChannel, knownWeight);
        double rawValue = scales.getValueForCalibration(calChannel, 20);
        if (rawValue == 0) {
            Serial.println("ERROR: Could not read sensor. Check wiring.");
            Serial.println("Try again, 'skip', or 'abort'.");
            return;
        }
        float newCal = (float)(rawValue / knownWeight);
        scales.setScale(calChannel, newCal);
        calFactors[calChannel] = newCal;

        // Quick verify (pause is still held, resume briefly)
        Serial.println("Verifying...");
        scales.resumeTask();
        delay(2000);
        float verify = scales.getWeight(calChannel);
        scales.pauseTask();

        Serial.printf("CH%d done! Factor: %.4f — reads %.1fg (expected %.1fg)\n",
            calChannel, newCal, verify, knownWeight);

        {
            SlotDisplay* disp = getDisplay(calChannel);
            if (disp) disp->showCalResult(newCal, verify, knownWeight);
        }
        delay(1500);

        calStartNextChannel();
        return;
    }

    // --- Normal command parsing ---
    // Parse optional channel prefix: "2:tare" means tare channel 2
    uint8_t targetCh = 0;
    if (cmd.length() > 2 && cmd[1] == ':' && cmd[0] >= '0' && cmd[0] <= '1') {
        targetCh = cmd[0] - '0';
        cmd = cmd.substring(2);
    }

    if (cmd == "tare" || cmd == "t") {
        if (targetCh < activeChannels && scales.isConnected(targetCh)) {
            Serial.printf("Taring CH%d...\n", targetCh);
            scales.tare(targetCh);
            Serial.printf("Done. CH%d offset: %ld\n", targetCh, scales.getOffset(targetCh));
        } else {
            Serial.printf("CH%d not available\n", targetCh);
        }
    }
    else if (cmd == "tareall" || cmd == "ta") {
        Serial.println("Taring all channels...");
        scales.tareAll();
        Serial.println("Done.");
        for (uint8_t ch = 0; ch < activeChannels; ch++) {
            if (scales.isConnected(ch)) {
                Serial.printf("  CH%d offset: %ld\n", ch, scales.getOffset(ch));
            }
        }
    }
    else if (cmd == "cal" || cmd == "c") {
        // Build queue of connected channels
        calQueueLen = 0;
        for (uint8_t ch = 0; ch < activeChannels; ch++) {
            if (scales.isConnected(ch)) {
                calQueue[calQueueLen++] = ch;
                calFactors[ch] = 0;
            }
        }
        if (calQueueLen == 0) {
            Serial.println("No connected channels to calibrate.");
            return;
        }
        Serial.printf("=== CALIBRATION: %d channel%s ===\n",
            calQueueLen, calQueueLen > 1 ? "s" : "");
        Serial.println("Pausing weight readings...");
        scales.pauseTask();

        calQueueIdx = 0;
        calChannel = calQueue[0];
        calPromptEmpty();
    }
    else if (cmd == "calreset" || cmd == "cr") {
        clearCalibration();
    }
    else if (cmd == "raw" || cmd == "r") {
        scales.printRawDiag(targetCh);
    }
    else if (cmd == "status" || cmd == "s") {
        if (cmd == "s" && targetCh == 0) {
            scales.printStatusAll();
        } else {
            scales.printStatus(targetCh);
        }
    }
    else if (cmd == "nfc" || cmd == "n") {
        nfcReader.printStatus();
        for (uint8_t i = 0; i < NFC_NUM_READERS; i++) {
            if (nfcReader.hasFilamentInfo(i)) {
                Serial.printf("--- Bay %d Filament ---\n", i);
                bambuPrintInfo(nfcReader.getFilamentInfo(i));
            }
        }
    }
    else if (cmd == "help" || cmd == "h") {
        Serial.println("=== COMMANDS ===");
        Serial.println("  tare (t)      — Tare CH0 (or N:tare for channel N)");
        Serial.println("  tareall (ta)  — Tare all channels");
        Serial.println("  cal  (c)      — Calibrate all connected channels");
        Serial.println("  calreset (cr) — Clear saved calibration");
        Serial.println("  raw  (r)      — Raw diagnostics (or N:raw for channel N)");
        Serial.println("  status (s)    — Status for all channels (or N:s for one)");
        Serial.println("  nfc  (n)      — NFC reader status");
        Serial.println("  help (h)      — Show this help");
        Serial.println();
        Serial.println("  Prefix commands with channel: 1:tare, 0:raw");
    }
}

// ==================== Setup ====================

void setup() {
    Serial.begin(SERIAL_BAUD);
    delay(1000);

    Serial.println();
    Serial.println();
    Serial.println("========================================");
    Serial.printf("  Filla IQ — FillaShelf v%s (%s)\n", FW_VERSION, FW_CHANNEL);
    Serial.println("========================================");
    Serial.println();

    Serial.println("--- Initializing ---");
    initLed();

    activeChannels = HX711_NUM_CHANNELS;

    // Initialize and detect connected HX711s
    scales.begin();

    // Tare all connected channels
    Serial.println("Taring all connected channels...");
    scales.tareAll();
    for (uint8_t ch = 0; ch < activeChannels; ch++) {
        if (scales.isConnected(ch)) {
            Serial.printf("  CH%d tare offset: %ld\n", ch, scales.getOffset(ch));
        }
    }

    // Load saved calibration from flash
    Serial.println("Loading calibration...");
    loadCalibration();

    // Initialize OLED display
    Serial.println("Initializing display...");
    initDisplays();

    // Initialize NFC readers
    initNfc();

    // Start the weight-reading task on Core 1
    scales.startTask(1, 2);

    Serial.println();
    Serial.println("--- Ready! ---");
    Serial.println("Type 'help' for commands");
    Serial.println();
}

// ==================== Main Loop (Core 0) ====================

void loop() {
    unsigned long now = millis();

    // Poll NFC readers first (round-robin, one per call)
    // so tag data is available before display rendering
    pollNfc();

    // Update LED and display
    if (now - lastLedUpdate >= UI_REFRESH_INTERVAL_MS) {
        lastLedUpdate = now;
        updateLed();
        updateDisplays();
    }

    // Print weight periodically — skip during calibration
    if (calState == CAL_NONE && now - lastPrint >= 1000) {
        lastPrint = now;
        for (uint8_t ch = 0; ch < activeChannels; ch++) {
            if (!scales.isConnected(ch)) continue;

            float w = scales.getWeight(ch);
            float ws = scales.getStableWeight(ch);
            bool stable = scales.isStable(ch);

            Serial.printf("CH%d: %.1fg (stable: %.1fg) %s\n",
                ch, w, ws, stable ? "[STABLE]" : "");
        }
    }

    handleSerialCommands();
}
