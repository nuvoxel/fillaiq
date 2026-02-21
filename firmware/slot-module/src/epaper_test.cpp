// ============================================================
// E-Paper Pin Scanner
// SES Imagotag display (e528827 mbht01) on Waveshare ESP32 board
//
// The FPC fits but the pinout doesn't match Waveshare's mapping.
// This sketch probes the 24-pin connector to find which pins
// are actually RST, BUSY, CS, DC, DIN, CLK.
//
// Strategy:
//   1. Pull each pin LOW one at a time — if one is RST,
//      another pin (BUSY) should change state
//   2. Once we find RST+BUSY, try SPI on remaining pins
// ============================================================

#include <Arduino.h>
#include <SPI.h>

// All GPIOs exposed on the Waveshare e-Paper ESP32 Driver Board Rev 3
// 24-pin FPC connector. These are the GPIOs routed to the connector.
// Ref: Waveshare schematic for Universal e-Paper ESP32 Driver Board
const int PROBE_PINS[] = {
    0, 2, 4, 5, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 32, 33
};
const int NUM_PINS = sizeof(PROBE_PINS) / sizeof(PROBE_PINS[0]);

// Record the idle state of all pins
int idleState[40] = {0};

void readAllPins() {
    for (int i = 0; i < NUM_PINS; i++) {
        idleState[PROBE_PINS[i]] = digitalRead(PROBE_PINS[i]);
    }
}

void printPinStates(const char* label) {
    Serial.printf("  %s: ", label);
    for (int i = 0; i < NUM_PINS; i++) {
        int pin = PROBE_PINS[i];
        int val = digitalRead(pin);
        if (val != idleState[pin]) {
            Serial.printf(" GPIO%d=%d*", pin, val);  // * = changed
        }
    }
    Serial.println();
}

void setup() {
    Serial.begin(115200);
    delay(1000);

    Serial.println();
    Serial.println("========================================");
    Serial.println("  E-Paper FPC Pin Scanner");
    Serial.println("  SES Imagotag e528827 mbht01");
    Serial.println("========================================");

    // Set all probe pins as input first
    for (int i = 0; i < NUM_PINS; i++) {
        pinMode(PROBE_PINS[i], INPUT);
    }
    delay(100);

    // Step 1: Read idle states
    Serial.println("\n=== STEP 1: Idle pin states ===");
    for (int i = 0; i < NUM_PINS; i++) {
        int pin = PROBE_PINS[i];
        int val = digitalRead(pin);
        idleState[pin] = val;
        Serial.printf("  GPIO%-2d = %d\n", pin, val);
    }

    // Step 2: Check which pins have pull-ups/pull-downs (hints at function)
    Serial.println("\n=== STEP 2: Pull-up test (HIGH=floating, LOW=driven) ===");
    for (int i = 0; i < NUM_PINS; i++) {
        int pin = PROBE_PINS[i];
        pinMode(pin, INPUT_PULLUP);
        delay(5);
        int pullup = digitalRead(pin);
        pinMode(pin, INPUT_PULLDOWN);
        delay(5);
        int pulldown = digitalRead(pin);
        pinMode(pin, INPUT);
        delay(1);

        const char* guess = "";
        if (pullup == 1 && pulldown == 0) guess = "floating/unconnected";
        else if (pullup == 0 && pulldown == 0) guess = "driven LOW (could be BUSY active-low)";
        else if (pullup == 1 && pulldown == 1) guess = "driven HIGH (could be BUSY active-high or VCC)";
        else guess = "weak drive";

        Serial.printf("  GPIO%-2d: pullup=%d pulldown=%d  -> %s\n", pin, pullup, pulldown, guess);
    }

    // Step 3: Find RST by toggling each pin LOW and watching for BUSY response
    Serial.println("\n=== STEP 3: RST scan (toggle each pin, watch others) ===");
    Serial.println("Looking for a pin that causes another pin to change state...\n");

    // Restore all as inputs
    for (int i = 0; i < NUM_PINS; i++) {
        pinMode(PROBE_PINS[i], INPUT);
    }
    delay(100);
    readAllPins();

    for (int r = 0; r < NUM_PINS; r++) {
        int rstPin = PROBE_PINS[r];

        // Skip pins that are dangerous to drive (strapping pins on ESP32)
        // GPIO0, 2, 5, 12, 15 are strapping pins but we'll be careful

        // Save states before
        readAllPins();

        // Pulse this pin LOW (reset pulse)
        pinMode(rstPin, OUTPUT);
        digitalWrite(rstPin, LOW);
        delay(50);
        digitalWrite(rstPin, HIGH);
        delay(200);  // Wait for display to come out of reset

        // Check which pins changed
        bool anyChanged = false;
        for (int b = 0; b < NUM_PINS; b++) {
            if (b == r) continue;  // Skip the pin we're driving
            int busyPin = PROBE_PINS[b];
            int cur = digitalRead(busyPin);
            if (cur != idleState[busyPin]) {
                if (!anyChanged) {
                    Serial.printf("  RST=GPIO%-2d -> ", rstPin);
                    anyChanged = true;
                }
                Serial.printf("GPIO%d changed %d->%d  ", busyPin, idleState[busyPin], cur);
            }
        }
        if (anyChanged) {
            Serial.println(" *** FOUND RESPONSE ***");
        }

        // Restore pin as input
        pinMode(rstPin, INPUT);
        delay(100);
    }

    Serial.println("\n=== STEP 4: Power rail check ===");
    // Check if any pin appears to be VCC (3.3V) or GND
    for (int i = 0; i < NUM_PINS; i++) {
        int pin = PROBE_PINS[i];
        // Briefly try to drive it and see if it fights back
        pinMode(pin, INPUT);
        delay(5);
        int natural = digitalRead(pin);

        pinMode(pin, OUTPUT);
        digitalWrite(pin, !natural);  // Try to force opposite
        delayMicroseconds(100);
        int forced = digitalRead(pin);
        pinMode(pin, INPUT);  // Release immediately
        delay(1);

        if (forced == natural) {
            Serial.printf("  GPIO%-2d: STRONGLY driven %s (power rail or hard-wired)\n",
                         pin, natural ? "HIGH" : "LOW");
        }
    }

    Serial.println("\n=== Scan complete ===");
    Serial.println("Look for '*** FOUND RESPONSE ***' above.");
    Serial.println("If nothing found, the display may need power on a");
    Serial.println("specific pin, or the FPC pinout is very different.");
    Serial.println("\nYou can also check if the Waveshare board has a");
    Serial.println("power switch or jumper for the e-paper connector.");
}

void loop() {
    // Nothing
}
