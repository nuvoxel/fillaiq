# Filla IQ — Hardware Product Line

Filla IQ's first-party hardware devices for filament and maker workshop management.

---

## FillaScan

**SKU:** `filla-scan`
**Purpose:** Filament spool scanning and identification station

Scans filament spools using NFC, weight, color sensing, and time-of-flight distance measurement. Posts scan data to the Filla IQ API for identification and inventory tracking. Prints labels via BLE label printer.

| Component | Part | Interface |
|-----------|------|-----------|
| MCU | ESP32-S3-DevKitC-1-N8R2 | — |
| NFC | PN532 (Elechouse V3) | SPI |
| Load Cell | HX711 | GPIO |
| Display | ST7789V3 240x280 TFT | SPI |
| LED Ring | WS2812B (24 LEDs) | GPIO |
| TOF | VL53L1X | I2C |
| Color | AS7341 | I2C |
| Environment | BME280/BMP280/SHT4x (auto-detect) | I2C |
| Label Printer | Phomemo M120 (external) | BLE |

**Connectivity:** WiFi + BLE
**Firmware:** `firmware/scan-station/` — PlatformIO + Arduino
**Parts Reference:** [PARTS.md](PARTS.md)

---

## FillaShelf

**SKU:** `filla-shelf`
**Purpose:** Shelf-mounted spool weight monitoring

Monitors filament spool weight on storage shelves. Two-bay prototype with independent NFC readers and displays per bay. Tracks real-time usage and remaining filament.

| Component | Part | Interface |
|-----------|------|-----------|
| MCU | ESP32-S3-DevKitC-1-N8R2 | — |
| Load Cells | 2x HX711 (independent channels) | GPIO |
| NFC | 2x PN532 (Elechouse V3) | SPI (shared bus) |
| Displays | 2x ST7789V3 240x280 TFT | SPI (shared bus) |
| LED Ring | WS2812B | GPIO |

**Connectivity:** WiFi + BLE
**Firmware:** Previously `firmware/slot-module/` — recoverable from git history
**Status:** Prototype hardware exists, firmware needs recovery and rename

---

## FillaLabel

**SKU:** `filla-label`
**Purpose:** E-ink display label for spools or shelf slots

Low-power e-ink display that shows spool information (material, color, weight remaining, QR code). Attaches to spools or shelf positions. Updates wirelessly.

| Component | Part | Interface |
|-----------|------|-----------|
| MCU | TBD (ESP32-C3 or similar low-power) | — |
| Display | E-ink (size TBD) | SPI |

**Connectivity:** BLE or WiFi (TBD)
**Firmware:** Not yet started
**Status:** Concept phase

---

## FillaSense

**SKU:** `filla-sense`
**Purpose:** Wireless temperature and humidity sensor for dryboxes and filament bags

Small wireless sensor that monitors temperature and humidity inside dryboxes, filament storage containers, or vacuum-sealed filament bags. Reports data to the Filla IQ dashboard.

**Preferred approach:** Off-the-shelf BLE temperature/humidity sensor (e.g., Xiaomi LYWSD03MMC, Govee H5075, or similar Tuya-based sensor) with custom firmware or protocol integration. Custom hardware only if no suitable off-the-shelf option exists.

| Component | Part | Interface |
|-----------|------|-----------|
| Sensor | Temp + humidity (e.g., SHT4x, SHTC3) | I2C |
| MCU | BLE SoC (e.g., nRF52832, ESP32-C3) | — |
| Power | Coin cell (CR2032) or AAA | — |

**Connectivity:** BLE
**Firmware:** Off-the-shelf preferred, custom only if needed
**Status:** Research phase — evaluating off-the-shelf options

---

## OTA Firmware Delivery

All Filla IQ devices check for updates via the firmware manifest at:

```
GET /api/v1/firmware/check?version=<current>&sku=<device-sku>
```

Manifest: `web/public/firmware/manifest.json`
Binary hosting: Azure Blob Storage (`fillaiqfw.blob.core.windows.net/firmware/`)

Each device has channels: `stable`, `beta`, `dev`

---

## Hardware Catalog (Database)

The `hardware_models` table in the web app stores make/model/capabilities for all hardware (not just Filla IQ devices — also third-party printers, dryboxes, etc.). The `hardware_identifiers` table maps USB VID:PID, BLE name prefixes, etc. to catalog entries for auto-discovery.

User-owned instances are tracked in `user_printers` (linked to hardware_models and scan stations).
