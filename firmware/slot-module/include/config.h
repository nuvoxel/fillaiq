#pragma once

// ============================================================
// Filla IQ — Single Slot Breadboard Prototype Configuration
// ESP32-S3-DevKitC-1 + PN53x + HX711 + SSD1322 OLED + WS2812B
// ============================================================

// --- Slot Identity ---
#ifndef SLOT_ID
#define SLOT_ID 0
#endif

// --- Pin Assignments (ESP32-S3 DevKitC-1) ---

// PN53x NFC readers (one per bay, shared SPI bus, different CS)
#define NFC_CS_PIN_0    10   // Reader 0 CS (PN53x SS pin)
#define NFC_CS_PIN_1    21   // Reader 1 CS
#define NFC_NUM_READERS  2
#define NFC_SCK_PIN     12   // SPI Clock (shared)
#define NFC_MOSI_PIN    11   // SPI MOSI (shared)
#define NFC_MISO_PIN    13   // SPI MISO (shared)
#define NFC_RST_PIN      7   // Reset (shared)
#define NFC_IRQ_PIN     -1   // Not using IRQ (polling mode)

// HX711 Load Cell Amplifiers (independent SCK+DT per channel)
#define HX711_NUM_CHANNELS  2
#define HX711_SCK_PIN_0     17   // CH0 clock
#define HX711_DT_PIN_0      18   // CH0 data
#define HX711_SCK_PIN_1     4    // CH1 clock
#define HX711_DT_PIN_1      3    // CH1 data

// SSD1322 OLED Display (SPI — single display showing both bays)
#define OLED_CS_PIN     14   // Chip Select
#define OLED_DC_PIN     8    // Data/Command
#define OLED_RST_PIN    -1   // No reset pin (tie RES to VCC)
#define OLED_WIDTH      256
#define OLED_HEIGHT     64

// WS2812B RGB LED (on-board)
// Try GPIO48 first (v1.0 boards), fall back to GPIO38 (v1.1 boards)
#define RGB_LED_PIN     48
#define RGB_LED_COUNT   1

// --- Weight Sensor Settings ---
#define WEIGHT_SAMPLES          10      // Moving average window
#define WEIGHT_CALIBRATION      145.724f // Calibrated with 500g known weight (no SPI)
#define WEIGHT_STABLE_THRESHOLD 2.0f    // Grams — reading is "stable" if delta < this
#define WEIGHT_STABLE_COUNT     5       // Consecutive stable readings to confirm
#define WEIGHT_READ_INTERVAL_MS 250     // Read weight every N ms
#define WEIGHT_TARE_SAMPLES     20      // Samples to average when taring
#define SPOOL_PRESENT_THRESHOLD 50.0f   // Grams — anything above this = spool is present
#define SPOOL_REMOVED_THRESHOLD 20.0f   // Grams — below this = spool removed (hysteresis)
#define WEIGHT_MIN_VALID        -100.0f // Reject readings below this (noise/disconnection)
#define WEIGHT_MAX_VALID        10000.0f // Reject readings above this (uncalibrated reads can be large)
#define SPOOL_FULL_WEIGHT_G     1000.0f // Default full spool weight (g), overridden by tag data

// --- Auto-Tare Settings ---
#define AUTO_TARE_DEADBAND      3.0f    // Don't auto-tare unless drift exceeds this (g)
#define AUTO_TARE_INTERVAL      30000   // Min ms between auto-tares per channel

// --- NFC Settings ---
#define NFC_POLL_INTERVAL_MS    250     // Check for NFC tag every N ms
#define NFC_TIMEOUT_MS          3000    // If no tag read for this long after weight detected, prompt user

// --- UI Settings ---
#define UI_REFRESH_INTERVAL_MS  100     // Display refresh rate
#define SERIAL_BAUD             115200  // Serial monitor baud rate

// --- State Machine ---
// Debounce periods to avoid flickering between states
#define STATE_DEBOUNCE_MS       1000    // Min time in a state before transitioning
