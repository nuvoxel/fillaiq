#pragma once

// ============================================================
// Filla IQ — Scan Station Configuration
// ESP32-S3-DevKitC-1 + PN532(SPI) + HX711 + ST7789(SPI)
// + WS2812B + VL53L1X(I2C) + AS7341(I2C)
// ============================================================

// --- Pin Assignments (ESP32-S3 DevKitC-1) ---

// FSPI Bus (shared: NFC + TFT display)
#define SPI_SCK_PIN     12
#define SPI_MOSI_PIN    11
#define SPI_MISO_PIN    13

// PN532 NFC reader (SPI mode)
#define NFC_CS_PIN      14
#define NFC_IRQ_PIN      7
#define NFC_RST_PIN     -1

// ST7789V3 TFT Display (240x280, 1.69" SPI)
#define TFT_CS_PIN      21
#define TFT_DC_PIN      15
#define TFT_RST_PIN     16
#define TFT_BLK_PIN      4

// I2C bus (TOF + Color sensors)
#define I2C_SDA          8
#define I2C_SCL          9

// HX711 Load Cell (single channel)
#define HX711_SCK_PIN   17
#define HX711_DT_PIN    18

// WS2812B LED Ring
#define LED_PIN         48
#define LED_SKIP         1   // Skip onboard RGB LED (pixel 0 on DevKitC-1)
#define LED_COUNT       25   // 1 onboard + 24 ring

// --- Weight Settings ---
#define WEIGHT_SAMPLES          10
#define WEIGHT_CALIBRATION      145.724f
#define WEIGHT_STABLE_THRESHOLD 2.0f
#define WEIGHT_STABLE_COUNT     5
#define WEIGHT_READ_INTERVAL_MS 250
#define WEIGHT_TARE_SAMPLES     20
#define WEIGHT_MIN_VALID        -100.0f
#define WEIGHT_MAX_VALID        10000.0f

// --- Object Detection Thresholds ---
#define OBJECT_PRESENT_THRESHOLD 5.0f
#define OBJECT_REMOVED_THRESHOLD 3.0f

// --- NFC Settings ---
#define NFC_POLL_INTERVAL_MS    250
#define NFC_TIMEOUT_MS          3000

// --- Scan State Machine ---
#define SCAN_STABILIZE_MS       2000
#define SCAN_DEBOUNCE_MS        500
#define API_POST_DEBOUNCE_MS    1000
#define API_POLL_INTERVAL_MS    3000

// --- WiFi ---
#define WIFI_CONNECT_TIMEOUT_MS 10000
#define WIFI_RETRY_INTERVAL_MS  30000

// --- Provisioning ---
#define BLE_DEVICE_NAME_PREFIX  "FillaIQ-"

// --- API ---
#define API_TIMEOUT_MS          5000
#define DEFAULT_API_URL         "https://www.fillaiq.com"

// --- Color Sensor I2C Addresses ---
#define AS7341_ADDR             0x39
#define AS7265X_ADDR            0x49
#define TCS34725_ADDR           0x29
#define OPT4048_ADDR            0x44

// --- AS7341 Settings ---
#define COLOR_AS7341_ATIME      100
#define COLOR_AS7341_ASTEP      999
#define COLOR_AS7341_GAIN       10  // AS7341_GAIN_256X

// --- TCS34725 Settings ---
#define COLOR_TCS34725_ITIME    0xEB  // 50ms integration

// --- TOF Sensor ---
#define VL53L1X_DEFAULT_ADDR    0x29
#define VL53L1X_ADDR            0x52
#define VL53L1X_XSHUT_PIN      42
#define TOF_TIMING_BUDGET_MS    50
#define TOF_ARM_HEIGHT_MM       250.0f

// --- Serial ---
#define SERIAL_BAUD             115200
