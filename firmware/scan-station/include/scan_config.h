#pragma once

// ============================================================
// Filla IQ — Scan Station Configuration
// ESP32-S3-DevKitC-1 + PN532 + HX711 + AS7341 + VL53L1X + WS2812B
// ============================================================

// --- Pin Assignments (ESP32-S3 DevKitC-1) ---

// PN532 NFC reader (SPI — single reader)
#define NFC_CS_PIN      10
#define NFC_SCK_PIN     12   // SPI Clock (FSPI)
#define NFC_MOSI_PIN    11   // SPI MOSI (FSPI)
#define NFC_MISO_PIN    13   // SPI MISO (FSPI)
#define NFC_RST_PIN      7
#define NFC_IRQ_PIN     -1   // Polling mode

// I2C Expansion Bus (AS7341, VL53L1X, future sensors)
#define I2C_SDA_PIN      1
#define I2C_SCL_PIN      2

// HX711 Load Cell (single channel)
#define HX711_SCK_PIN   17
#define HX711_DT_PIN    18

// WS2812B LED Ring (backlight + status)
#define LED_PIN         48
#define LED_COUNT       24   // 24-LED ring

// Turntable Stepper (A4988/TMC2209 driver)
#define STEPPER_STEP_PIN    38
#define STEPPER_DIR_PIN     39
#define STEPPER_ENABLE_PIN  40   // Active LOW
#define STEPPER_HOME_PIN    41   // Hall sensor / endstop (active LOW)
#define STEPPER_STEPS_REV   200  // 1.8° motor = 200 steps/rev
#define STEPPER_MICROSTEPS  16   // A4988/TMC2209 microstepping
#define STEPPER_RPM         10   // Slow rotation for scanning

// VL53L1X XSHUT pin (for I2C address reprogramming)
// Hold LOW during boot, init TCS34725 first, then release and reprogram VL53L1X
#define VL53L1X_XSHUT_PIN  42

// --- I2C Addresses ---
#define AS7341_ADDR         0x39
#define TCS34725_ADDR       0x29   // Default; shares addr with VL53L1X
#define OPT4048_ADDR        0x44
#define AS7265X_ADDR        0x49
#define VL53L1X_DEFAULT_ADDR 0x29  // Factory default (conflicts with TCS34725)
#define VL53L1X_ADDR        0x52   // Reprogrammed at boot via XSHUT

// --- Weight Settings ---
#define WEIGHT_SAMPLES          10
#define WEIGHT_CALIBRATION      145.724f  // Default, overridden by saved cal
#define WEIGHT_STABLE_THRESHOLD 2.0f      // Grams — reading is "stable" if delta < this
#define WEIGHT_STABLE_COUNT     5         // Consecutive stable readings to confirm
#define WEIGHT_READ_INTERVAL_MS 250
#define WEIGHT_TARE_SAMPLES     20
#define WEIGHT_MIN_VALID        -100.0f
#define WEIGHT_MAX_VALID        10000.0f

// --- Object Detection Thresholds ---
#define OBJECT_PRESENT_THRESHOLD 5.0f    // Grams — anything above = object on platform
#define OBJECT_REMOVED_THRESHOLD 3.0f    // Grams — below this = removed (hysteresis)

// --- NFC Settings ---
#define NFC_POLL_INTERVAL_MS    250
#define NFC_TIMEOUT_MS          3000     // Tag read timeout

// --- Scan Station State Machine ---
#define SCAN_STABILIZE_MS       2000     // Wait for weight + sensors to stabilize
#define SCAN_DEBOUNCE_MS        500      // Debounce between state transitions
#define API_POLL_INTERVAL_MS    1000     // How often to poll server for result

// --- WiFi ---
// Credentials stored in NVS, configured via serial commands
#define WIFI_CONNECT_TIMEOUT_MS 10000
#define WIFI_RETRY_INTERVAL_MS  5000

// --- API ---
#define API_TIMEOUT_MS          5000

// --- TOF Settings ---
#define TOF_ARM_HEIGHT_MM       250.0f   // Distance from TOF sensor to platform surface
#define TOF_TIMING_BUDGET_MS    50       // Measurement timing budget

// --- Color Sensor Settings ---
// Sensor type detected at runtime via I2C scan.
// Supported: AS7341 (11ch), AS7265x (18ch), TCS34725 (RGBC), OPT4048 (XYZ)
// AS7341 settings
#define COLOR_AS7341_ATIME      100      // Integration time (ms)
#define COLOR_AS7341_ASTEP      999      // Step count
#define COLOR_AS7341_GAIN       8        // AS7341_GAIN_8X
// TCS34725 settings
#define COLOR_TCS34725_ITIME    0xEB     // 50ms integration
#define COLOR_TCS34725_GAIN     4        // 16x gain
// AS7265x settings
#define COLOR_AS7265X_ITIME     50       // Integration time (ms)
#define COLOR_AS7265X_GAIN      16       // 16x gain

// --- Serial ---
#define SERIAL_BAUD             115200
