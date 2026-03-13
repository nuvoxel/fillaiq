#pragma once

// --- Firmware Identity ---
#define FW_VERSION "1.1.0"
#define FW_SKU     "filla-scan"      // Device type for OTA routing
#ifndef FW_CHANNEL
#define FW_CHANNEL "stable"
#endif

// ============================================================
// Filla IQ — FillaScan Configuration
// ESP32-S3-DevKitC-1 + PN532(SPI) + HX711 + ST7789(SPI)
// + WS2812B + VL53L1X(I2C) + AS7341(I2C)
// ============================================================

// --- Pin Assignments ---

#ifdef BOARD_SCAN_TOUCH
// ── ESP32-S3 2.8" ILI9341 Touch Board (lcdwiki 2.8inch ESP32-S3) ──
// Display is built-in; 4 expansion GPIOs on 1.25mm connector: IO2, IO3, IO14, IO21

// SPI bus (shared display + future peripherals)
#define SPI_SCK_PIN     12
#define SPI_MOSI_PIN    11
#define SPI_MISO_PIN    13

// Display SPI (directly connected on-board)
#define TFT_CS_PIN      10
#define TFT_DC_PIN      46
#define TFT_RST_PIN     -1   // No reset pin on this board
#define TFT_BLK_PIN     45

// Capacitive touch (FT6336G, separate I2C bus on-board)
#define TOUCH_SDA       16
#define TOUCH_SCL       15
#define TOUCH_INT       17
#define TOUCH_RST       18

// I2C bus — dedicated header (NFC in I2C mode, NAU7802, TOF, color)
#define I2C_SDA          6
#define I2C_SCL          5

// PN532 NFC reader (I2C mode on sensor bus, no dedicated CS/IRQ/RST)
#define NFC_CS_PIN      -1   // Not used in I2C mode
#define NFC_IRQ_PIN     14   // Expansion pin
#define NFC_RST_PIN     -1   // No reset pin available

// WS2812B LED Ring
#define LED_PIN         21   // Expansion pin
#define LED_SKIP         0
#define LED_COUNT       24

// No HX711 GPIOs — use NAU7802 (I2C) only
#define HX711_SCK_PIN   -1
#define HX711_DT_PIN    -1

// No DHT pin available — use I2C environmental sensors (SHT31, BME280, etc.)
#undef DHT_PIN

#else
// ── ESP32-S3 DevKitC-1 + separate ST7789 SPI display ──

// FSPI Bus (shared: NFC + TFT display)
#define SPI_SCK_PIN     12
#define SPI_MOSI_PIN    11
#define SPI_MISO_PIN    13

// PN532 NFC reader (SPI mode)
#define NFC_CS_PIN      14
#define NFC_IRQ_PIN      7
#define NFC_RST_PIN      6

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
#define LED_SKIP         0   // Onboard LED mirrors pixel 0 (parallel wiring)
#define LED_COUNT       24   // 24 ring LEDs

#endif

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
#define API_TIMEOUT_MS          10000
#define DEFAULT_API_URL         "https://www.fillaiq.com"

// --- Weight ADC (NAU7802 preferred, HX711 fallback) ---
#define NAU7802_ADDR            0x2A

// --- Color Sensor I2C Addresses ---
#define AS7341_ADDR             0x39    // Also AS7343 — differentiated by ID register
#define AS7265X_ADDR            0x49
#define TCS34725_ADDR           0x29
#define OPT4048_ADDR            0x44
#define AS7331_ADDR             0x74    // UV spectral sensor

// --- AS7341/AS7343 Settings ---
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

// --- OTA Updates ---
#define OTA_CHECK_INTERVAL_MS   (5 * 60 * 1000UL)  // 5 minutes
#define OTA_FIRST_CHECK_DELAY   30000               // 30s after boot

// --- Environmental Reporting ---
#define ENV_REPORT_INTERVAL_MS  (5 * 60 * 1000UL)  // 5 minutes

// --- Device Config Defaults (overridden by server) ---
#define DEFAULT_ENV_REPORT_INTERVAL_MS  (5 * 60 * 1000UL)
#define DEFAULT_STATUS_INTERVAL_MS      2000

// --- Label Printer (Phomemo M120) ---
#define PRINTER_USB_VID         0x0493  // Nuvoton
#define PRINTER_USB_PID         0xB002
#define PRINTER_MAX_WIDTH_MM    50
#define PRINTER_MAX_HEIGHT_MM   200     // Continuous feed
#define PRINTER_DPI             203
#define PRINTER_DOTS_PER_LINE   384     // 48mm * 8 dots/mm

// --- DHT Temperature/Humidity Sensor ---
#ifndef BOARD_SCAN_TOUCH
#define DHT_PIN                 5
#define DHT_TYPE                11      // 11 = DHT11, 22 = DHT22
#endif

// --- Serial ---
#define SERIAL_BAUD             115200
