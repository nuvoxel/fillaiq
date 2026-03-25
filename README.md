# Filla IQ

Smart workshop inventory system — automatically identify, weigh, and track filament spools, hardware bins, and workshop supplies using NFC, weight sensors, color detection, and a centralized web dashboard.

**https://www.fillaiq.com**

## What It Does

Place an item on the scan station. It reads the NFC tag (Bambu, Creality, NTAG, etc.), weighs it, measures the color with a spectral sensor, and identifies it against a growing catalog — filaments, fasteners, sheet goods, resins, and more. The item appears in your web dashboard with all its details. Print a label. Assign it to a storage slot. Manage your 3D printers, CNC routers, and laser cutters from the same dashboard. Track usage over time.

## Products

| Product | Description |
|---------|-------------|
| **FillaScan** | Scan station — NFC reader + load cell + spectral color sensor + TOF distance + touch display. Identifies filaments, hardware, and supplies via MQTT. |
| **FillaShelf** | Multi-bay shelf module with per-slot weight monitoring, NFC identification, and environmental sensors. Tracks filament spools, hardware bins, tools, and components. |
| **FillaLabel** | E-ink shelf labels — repurposes electronic shelf labels (ESL / e-ink price tags) as smart per-slot displays that update wirelessly when inventory changes. |
| **Paper Labels** | BLE thermal label printer integration — prints filament labels with brand logo, material, temps, QR code via Phomemo, NIIMBOT, Brother. |
| **FillaSense** | Environmental monitoring module — temperature, humidity, pressure per shelf/zone. |

## Web Dashboard

Built with Next.js 16, Tailwind CSS, shadcn/ui, Drizzle ORM, PostgreSQL.

### Inventory & Catalog
- **7,000+ filament products** pre-loaded from SpoolmanDB, plus standard imperial/metric fasteners, sheet goods, resins, CNC stock, and laser materials
- User-owned inventory with full lifecycle tracking (active, empty, archived) — spools, bins, tools, components
- Catalog product linking — each item references a catalog entry for specs, temps, and identification
- Admin catalog management with community submissions
- Brand logo uploads (color + B&W for label printing)

### Scanning & Identification
- Scan sessions with NFC tag parsing (Bambu MIFARE, Creality, OpenSpool, TigerTag, OpenPrintTag, NTAG, FillaIQ)
- HKDF-SHA256 key derivation for Bambu encrypted tags
- Spectral color measurement (AS7341/AS7343 11-14 channel) with LAB color space conversion
- Barcode/QR scanning from phone camera with catalog lookup
- OCR label reading for manual identification
- Fuzzy catalog matching by NFC data, barcode, or search

### Storage & Rack Visualization
- Zone → Rack → Shelf → Bay → Slot hierarchy
- Interactive rack visualizer with drag-and-drop spool placement
- Slot drawer with full item editing (all 40+ fields)
- Per-slot environmental data (temperature, humidity from bay modules)
- Visual spool/box/tool/bolt/electronic component renderings

### Label Printing
- Thermal label printing via BLE (Phomemo, NIIMBOT, Brother P-Touch)
- Label designer with configurable templates (Classic 40x30, Expanded 50x30, Compact, Slim, Vertical)
- Label layout: brand logo, material on inverted strip, color name, hex code, nozzle/bed temps, drying info, flow ratio, TD, QR code
- Print from slot drawer, rack view, or scan intake

### Multi-Machine Control
- FDM printers, resin printers, CNC routers, and laser cutters from one dashboard:
  - **Bambu Lab** (P1S, X1C, A1, H2D — via MQTT bridge through scan station)
  - **Klipper** (Moonraker API — Voron, RatRig, etc.)
  - **OctoPrint** (REST API)
  - **PrusaLink** (MK4S, XL, Core One)
  - **GRBL** (CNC routers, laser cutters)
- Normalized status reporting across all protocols
- Print job queue with per-station job management
- Machine accessories tracking (nozzles, build plates, tool heads, filament changers)

### Real-Time Communication
- MQTT backbone (Mosquitto on AKS) for all device ↔ server messaging
- Scan submission via MQTT (eliminates HTTP overhead on ESP32)
- Live device heartbeat and online/offline status
- Printer status relay (scan station bridges local printer protocols to cloud MQTT)
- OTA firmware update coordination

### Home Automation & Integrations (Planned)
- **Home Assistant** — MQTT discovery for inventory levels, spool weights, printer status, and environmental data as sensors; automations on low filament, print completion, temperature/humidity thresholds
- **Control4** — MQTT driver for whole-workshop monitoring and automation scenes
- **MQTT topics** already expose all device state, inventory, and printer status — compatible with any MQTT-aware platform today
- **REST API** — full CRUD API with API key auth for third-party integrations
- **Webhooks** — push notifications on scan events, print completion, low inventory

### Dashboard & Analytics
- Overview with stat cards, material weight chart, recent activity feed
- Audit log with full action history
- Environmental monitoring charts (temp/humidity over time per station)

## Hardware

### FillaScan (Scan Station)

| Component | Part | Interface |
|-----------|------|-----------|
| MCU | ESP32-S3 (dual-core 240MHz, 16MB flash, 8MB PSRAM) | — |
| NFC | PN5180 via RP2040 Pico I2C coprocessor | SPI (Pico) + I2C (ESP32) |
| Weight | NAU7802 24-bit ADC + load cell | I2C |
| Color | AS7341/AS7343 spectral (11-14 channel) | I2C (Stemma QT) |
| Distance | VL53L1X time-of-flight | I2C (Stemma QT) |
| Display | ILI9341 2.8" TFT + FT6336G capacitive touch | SPI + I2C |
| Audio | ES8311 codec + I2S speaker | I2C + I2S |
| LED | WS2812B 24-LED ring | GPIO |
| Storage | Micro SD (SDMMC 4-bit) | SDMMC |
| Printer | Phomemo M120 BLE thermal | BLE |
| Environment | BME280 / SHT31 | I2C |

### NFC Tag Support

| Format | Tag Type | Encryption | Fields Parsed |
|--------|----------|------------|---------------|
| Bambu Lab | MIFARE Classic 1K | HKDF-SHA256 per-UID keys | Material, name, color RGBA, net weight, diameter, temps, drying, xcam, tray UID, production date |
| Creality | MIFARE Classic | Sector keys | Material, color, temps |
| OpenSpool | NTAG 213/215/216 | None (NDEF) | Material, brand, color, weight |
| TigerTag | NTAG | None (NDEF) | Material, color, temps |
| OpenPrintTag | NTAG | None (NDEF) | Material, brand, color |
| FillaIQ | NTAG / MIFARE | Optional | Full catalog reference |

### Supported Color Sensors (auto-detected)

| Sensor | Channels | Notes |
|--------|----------|-------|
| AS7343 | 14-channel spectral | Best — extended wavelength range |
| AS7341 | 11-channel spectral | Good balance of accuracy and cost |
| OPT4048 | 4-channel CIE XYZ | Best absolute color accuracy |
| AS7265X | 18-channel tri-sensor | Near-lab quality UV/VIS/NIR |
| TCS34725 | 4-channel RGBC | Basic fallback |

## Local Development

Prerequisites: Node.js, Yarn, Docker.

```bash
./scripts/dev.sh
```

This will:
1. Create `web/.env` from `.env.example` with a generated auth secret (first run only)
2. Start PostgreSQL 17 and Mosquitto MQTT broker via Docker Compose
3. Install dependencies
4. Run database migrations
5. Start the Next.js dev server at http://localhost:3000

OAuth providers (Google, GitHub, Microsoft) are optional for local dev — email/password works without them. To enable them, add the credentials to `web/.env`.

To stop the Docker services:

```bash
docker compose -f docker-compose.dev.yml down
```

## Firmware

Built with PlatformIO + Arduino framework. Dual-core architecture: Core 0 handles NFC + network + weight, Core 1 handles display + sensors.

```bash
cd firmware/scan-station
pio run -e scan_station_touch       # Touch board + Pico NFC coprocessor
pio run -e scan_station             # DevKitC + PN532
```

### Firmware Projects

| Project | Purpose |
|---------|---------|
| `scan-station/` | FillaScan — full scan station with touch display, NFC, sensors, MQTT |
| `filla-shelf/` | FillaShelf — multi-bay shelf module with NFC + weight per slot |
| `slot-module/` | Individual slot module (single-slot variant of FillaShelf) |

## Tech Stack

| Layer | Technology |
|-------|------------|
| Web | Next.js 16 (App Router, Turbopack), React, TypeScript |
| UI | Tailwind CSS + shadcn/ui, LVGL (firmware displays) |
| Database | PostgreSQL (Azure Flexible Server), Drizzle ORM |
| Auth | better-auth (session + API key) |
| Messaging | MQTT (Mosquitto on AKS) via mqtt.js + ESP-IDF |
| Firmware | ESP32-S3 (PlatformIO + Arduino), RP2040 (arduino-pico) |
| Label rendering | 1-bit thermal bitmap generation (server-side), QR via `qrcode` |
| NFC crypto | HKDF-SHA256 (BearSSL on RP2040, server-side Node.js) |

## PN5180 NFC Library

The `firmware/pn5180-nfc/` directory contains the PN5180 NFC Arduino library and RP2040 Pico I2C coprocessor firmware. See its [README](firmware/pn5180-nfc/README.md) for details. Dual-licensed: LGPL-2.1+ (library), MIT (coprocessor firmware).

## Acknowledgments

- **Filament label design** inspired by [3D Filament Profiles](https://3dfilamentprofiles.com/). The label layout — brand logo, material on inverted strip, color name, temperature ranges, drying info, flow ratio, QR code — follows the format established by their label generator.
- **Filament catalog data** sourced from [SpoolmanDB](https://github.com/Donkie/SpoolmanDB) (MIT license) — a community-maintained database of 3D printing filaments and manufacturers.

## License

MIT License. Copyright (c) 2025-2026 Filla IQ / Nuvoxel. See [LICENSE](LICENSE) for details.

The PN5180 NFC library (`lib/PN5180/`) is LGPL-2.1-or-later. Firmware sensor libraries (Adafruit, Pololu) are BSD-3-Clause. SpoolmanDB catalog data is MIT. See the LICENSE file for full third-party attribution.
