# Filla IQ Scan Station — Design & Implementation Plan

## Context

The project is pivoting from a per-slot weight monitoring rack to a **universal maker scan station** — a single device you place objects on (filament spools, bolts, electronics, laser material, etc.) to identify, measure, and catalog them. The core product is a **community-driven material compatibility database** with affiliate revenue. The scan station is the hardware companion for getting items into inventory with minimal effort.

The user has ~35 filament rolls (mixed Bambu/third-party, boxed/bagged/bare), an H2D with 6 AMS slots, and wants to: know what they have, where it is, how much is left, and what's interchangeable.

## Architecture: Tiered Hybrid (ESP32-S3 + Optional Pi)

Three build tiers from the same design — each adds capability:

### Tier 0: Phone Only ($0)
```
  [Phone]  ──WiFi/HTTP──>  [Filla IQ Web App]
   - NFC (built-in, most Android phones)
   - Camera (barcode, QR, photos, color)
   - LiDAR (iPhone Pro models)
   - Web app PWA
```
No hardware needed. Phone NFC reads tags, camera scans barcodes/labels, LiDAR measures dimensions (iPhone Pro). Limited: no weight, no spectral color, manual entry for the rest.

### Tier 1: ESP32-S3 Scan Station (~$75)
```
  [ESP32-S3]  ──WiFi/HTTP──>  [Filla IQ Web App]
   Sensors:                          │
   - HX711 (weight)          [Phone / Desktop Browser]
   - PN532 (NFC)              - Camera (getUserMedia)
   - AS7341 (spectral color)  - Barcode (BarcodeDetector API)
   - VL53L1X (TOF/height)     - Display (responsive web UI)
   - WS2812B (backlight)      - ML/AI (cloud)
```
Uses phone/browser for camera, display, and interaction. **Phone cradle on the arm** positions phone camera looking down at platform — doubles as camera and display. Fully functional, cheap build.

### Tier 2: ESP32-S3 + Raspberry Pi (~$130-150)
```
  [ESP32-S3]  ──USB Serial──>  [Raspberry Pi 4/Zero 2W]
   Sensors:                     - Pi Camera (barcode, QR, photos, ML)
   - HX711 (weight)            - 5-7" HDMI touchscreen
   - PN532 (NFC)               - Local kiosk web UI (Chromium)
   - AS7341 (spectral color)   - OpenCV barcode/silhouette
   - VL53L1X (TOF/height)      - Local or cloud ML/AI
   - WS2812B (backlight)       │
                                ├──WiFi/HTTP──> [Filla IQ Web App]
                                │
                          [Phone / Desktop still works too]
```
Fully self-contained — place object, walk away. Pi adds camera + touchscreen. Phone/browser still works as an alternative interface.

**Key principle:** Same ESP32 firmware for both tiers. The ESP32 either POSTs directly to the web app (Tier 1) or streams sensor data over USB serial to the Pi (Tier 2), which enriches it with camera frames before posting. All brains live in the cloud/web app — the Pi is just a thin bridge for camera capture and local display (Chromium kiosk).

**Why hybrid beats either alone:**
- ESP32 handles real-time sensors (battle-tested code from existing firmware, FreeRTOS tasks, HKDF crypto)
- Pi is a thin camera/display bridge — no heavy local processing needed
- All ML, identification, matching, and inventory logic runs server-side in the web app
- Users choose their build tier based on budget/needs
- No firmware changes to upgrade from Tier 1 → Tier 2

## Hardware Bill of Materials

### MVP (~$75)

| Component | Part | Cost | Interface |
|-----------|------|------|-----------|
| MCU | ESP32-S3-DevKitC-1 | $8 | — |
| Load Cell | 4x5kg bar cells (Wheatstone bridge) + HX711 | $8 | GPIO17(SCK), GPIO18(DT) |
| NFC Reader | Elechouse PN532 V3 | $8 | SPI (FSPI bus, CS=GPIO10) |
| Color Sensor | AS7341 breakout (Adafruit) | $16 | I2C (SDA=GPIO1, SCL=GPIO2) |
| TOF Sensor | VL53L1X breakout | $14 | I2C (same bus, reprogrammed to 0x52) |
| LED Ring | WS2812B 24-LED ring | $5 | GPIO48 |
| Platform | 3mm white translucent acrylic ~150x150mm | $3 | — |
| Enclosure | 3D printed PETG | $5 | — |
| Misc | Wiring, headers, USB-C cable | $8 | — |

### Tier 2 Additions (~$55-75 on top of MVP)

| Component | Part | Cost | Notes |
|-----------|------|------|-------|
| Pi | Raspberry Pi Zero 2W or Pi 4 | $15-55 | Linux, camera, HDMI |
| Pi Camera | Pi Camera Module 3 | $25 | 12MP, autofocus, mounted on arm above platform |
| Display | 5" 800x480 HDMI touch (user already has) | $0-35 | Kiosk mode Chromium |
| Pi case/mount | 3D printed | $2 | Integrated into enclosure |

### Future Additions

| Component | Part | Cost | Notes |
|-----------|------|------|-------|
| 18-ch Spectral | AS7265x (SparkFun) | $30 | Even better color accuracy |
| Better load cell | 10-20kg | $10 | Heavier objects |
| Turntable | NEMA 17 stepper + A4988 driver | $15 | 360-degree scanning |

## Pin Map (Scan Station)

```
SPI (FSPI) — PN532 only:
  MOSI=GPIO11, SCLK=GPIO12, MISO=GPIO13
  PN532 CS=GPIO10, PN532 RST=GPIO7

I2C — Primary expansion bus (all sensors):
  SDA=GPIO1, SCL=GPIO2
  AS7341 (addr 0x39)    — spectral color
  TCS34725 (addr 0x29)  — RGBC color (alt sensor)
  OPT4048 (addr 0x44)   — CIE XYZ color (alt sensor)
  AS7265x (addr 0x49)   — 18-ch spectral (alt sensor)
  VL53L1X (addr 0x52)   — TOF distance/height (reprogrammed from 0x29 via XSHUT)

HX711 — Weight (dedicated GPIO, not I2C):
  SCK=GPIO17, DT=GPIO18

WS2812B — Backlight:
  DATA=GPIO48

VL53L1X XSHUT — Address reprogramming:
  XSHUT=GPIO42

Turntable Stepper (A4988/TMC2209):
  STEP=GPIO38, DIR=GPIO39, ENABLE=GPIO40, HOME=GPIO41
```

**Design principle: I2C as the expansion bus.** All sensors except PN532 (SPI, legacy) and HX711 (proprietary protocol) connect via I2C. Adding new sensors = plug into the bus, no pin allocation needed.

**I2C address conflict resolution:** VL53L1X and TCS34725 both default to 0x29. Solved via VL53L1X XSHUT pin (GPIO42) — hold VL53L1X in reset during boot, init TCS34725 first at 0x29, then release XSHUT and reprogram VL53L1X to 0x52.

## Physical Form Factor

```
Side View:                    Top View:
  ┌──[Camera+TOF]──┐         ┌─────────────────┐
  │   arm (~250mm)  │         │  Translucent     │
  │      │          │         │  Platform        │
  │      ▼          │         │  150mm x 150mm   │
  │  ┌────────┐     │         │                  │
  │  │Platform│     │         │ [NFC underneath] │
  │  └────────┘     │         │ [AS7341 under]   │
  │  [load cell]    │         │ [LED ring under] │
  │  [LED ring]     │         └──────────────────┘
  ├─────────────────┤
  │ ESP32, PN532    │          Tier 2 adds:
  │ (Pi, optional)  │          [5-7" touch display]
  │ USB-C power     │          mounted beside/behind
  └─────────────────┘
```

- **Base enclosure** (~170x170x40mm): houses ESP32, PN532, HX711, wiring. Pi mounts here too (Tier 2).
- **Platform**: translucent acrylic on 4-cell load cell arrangement, WS2812B ring underneath for backlighting.
- **Arm** (~250mm tall): holds TOF sensor (all tiers) + Pi Camera (Tier 2) OR phone cradle (Tier 1) looking down at platform. Phone cradle is a 3D-printed bracket that holds the phone face-down so its camera sees the platform.
- **PN532**: under platform (reads NFC through 3mm acrylic).
- **AS7341**: under platform edge, shrouded for ambient light control.
- **Display** (Tier 2): 5-7" HDMI touch, mounted beside or behind the base. Runs Chromium kiosk pointing at web app.
- **Pi role** (Tier 2): thin bridge only — captures camera frames, streams to web app. All brains (ML, identification, matching) run in the cloud/web app server.
- **Enclosure design**: Fusion 360 via ClaudeFusion360MCP (MCP server configured in `.mcp.json`).

## Firmware (`firmware/scan-station/`)

### Directory Structure
```
firmware/scan-station/
  include/
    scan_config.h        — pin assignments, I2C addresses, thresholds
    sensors.h            — sensor data structs (WeightData, NfcData, ColorData, DistanceData, etc.)
    nfc.h                — NfcScanner class (single PN532 reader)
    color.h              — ColorSensor class (auto-detect AS7341/AS7265x/TCS34725/OPT4048)
    distance.h           — DistanceSensor class (VL53L1X with XSHUT reprogramming)
    backlight.h          — Backlight class (WS2812B ring, animations)
    turntable.h          — Turntable class (stepper motor, blocking + non-blocking)
    api_client.h         — ApiClient class (WiFi + HTTP POST/GET)
  src/
    main.cpp             — setup/loop, state machine, serial commands
    nfc.cpp              — PN532 single reader (adapted from slot-module dual reader)
    bambu_tag.cpp        — Bambu MIFARE HKDF parsing (copied from slot-module)
    color.cpp            — Auto-detecting multi-sensor color driver
    distance.cpp         — VL53L1X TOF with address reprogramming
    backlight.cpp        — LED ring animations (pulse, spin, rainbow, status)
    turntable.cpp        — Stepper motor control with homing
    api_client.cpp       — WiFi connection, HTTP POST/GET, NVS config persistence
  platformio.ini         — ESP32-S3, all sensor libraries
```

### State Machine
```
IDLE → OBJECT_DETECTED (weight > 5g)
  → SCANNING (NFC + color + height + weight stabilize, ~2s)
  → ROTATING (optional turntable 360° scan)
  → POST_TO_SERVER (send all sensor data)
  → AWAITING_RESULT (LED yellow if needs camera, green if identified)
  → IDLE (object removed)
```

### Color Sensor Auto-Detection
Runtime I2C probe at boot, priority: AS7265x > AS7341 > OPT4048 > TCS34725. Supports:
- **AS7341**: 11-channel spectral (Adafruit library)
- **AS7265x**: 18-channel spectral (raw I2C virtual registers)
- **TCS34725**: RGBC + CCT (raw I2C, McCamy's formula)
- **OPT4048**: CIE XYZ + Lux (raw I2C, mantissa+exponent decoding)

### Sensor Data Payload (ESP32 → Web App)
```json
{
  "stationId": "scan-001",
  "weight": { "grams": 1247.3, "stable": true },
  "nfc": {
    "present": true,
    "uid": "04:A2:B3:C4:D5:E6:F7",
    "uidLength": 7,
    "tagType": "mifare_classic",
    "rawData": "<base64>"
  },
  "color": {
    "sensorType": "AS7341",
    "f1_415nm": 234, "f2_445nm": 456, "f3_480nm": 789,
    "f4_515nm": 1023, "f5_555nm": 876, "f6_590nm": 654,
    "f7_630nm": 432, "f8_680nm": 321, "clear": 5000, "nir": 210
  },
  "height": { "distanceMm": 87.5, "objectHeightMm": 162.5 }
}
```

### Serial Commands
`tare`, `status`, `home`, `rotate <degrees>`, `wifi <ssid> <pass>`, `apiurl <url>`, `apikey <key>`, `scan`, `led <mode>`

## Web App Changes

### New Schema Tables (`web/src/db/schema/scan-stations.ts`)

**`scanStations`** — Device registry (follows existing `bridges` pattern)
- id, userId, name, hardwareId, firmwareVersion
- capabilities (hasNfc, hasColorSensor, hasTof, hasTurntable, hasCamera)
- calibrationData (JSONB), lastSeenAt, isOnline

**`scanEvents`** — Append-only scan log (follows `weightEvents` pattern)
- Raw sensor data: weightG, heightMm, spectralData (JSONB), nfcUid, nfcRawData
- Derived color: colorLabL/A/B, colorHex, closestPantone, closestRal
- Camera data: photoUrl, barcodeValue, barcodeFormat
- Identification: identifiedType, identifiedItemId, confidence, aiSuggestions
- User action: userConfirmed, userOverrideData

**`inventoryItems`** — Generic non-filament items (bolts, electronics, etc.)
- category, subcategory, name, description
- Measurements: weight, height, width, length, diameter
- Fastener-specific: threadPitch, headType, driveType
- Electronic-specific: partNumber, package
- Color: colorHex, colorLabL/A/B
- Inventory: quantity, storageLocation, binLabel
- Commerce: supplier, partNumber, unitPrice

### New API Routes
- `POST /api/v1/scan` — ESP32 sends sensor data (API key auth)
- `POST /api/v1/scan/[id]/camera` — Phone sends photo/barcode
- `GET /api/v1/scan/[id]/status` — ESP32 polls for identification result

### New Pages
- `/scan-station` — Main scan UI (station status, recent scans, identification results)

### Server-Side Processing (future)
- NFC tag parsing (port Bambu parser to TypeScript, add Creality/NTAG/OpenPrintTag)
- Spectral → LAB conversion (AS7341 channels → CIE XYZ → LAB)
- Pantone/RAL matching (deltaE distance in LAB space)
- Filament matching (weight + height + color → candidates from catalog)
- Vision API integration (Claude/GPT-4o for photo-based identification)

## Identification Pipeline (Server-Side)

```
1. NFC tag present? → Parse format → Lookup in catalog → HIGH confidence
2. Barcode scanned? → Lookup in skuMappings → HIGH confidence
3. Weight + height + color → Query filaments/inventory → MEDIUM confidence
4. Photo taken? → Vision API → "M3x25 socket head cap screw, stainless" → MEDIUM confidence
5. Silhouette (backlit, future) → Edge detection → dimensions → MEDIUM confidence
6. No match → Prompt user to create new item
```

## Implementation Phases

### Phase 1: MVP — NFC + Weight (DONE)
- [x] New `firmware/scan-station/` directory with all sensor drivers
- [x] WiFi + HTTP POST to web app (api_client.cpp)
- [x] `scanStations` + `scanEvents` + `inventoryItems` tables (scan-stations.ts)
- [x] API endpoints (`POST /api/v1/scan`, `GET /api/v1/scan/[id]/status`)
- [x] Basic scan station dashboard page
- [x] State machine in main.cpp
- [ ] Generate Drizzle migration
- [ ] Flash and test with real hardware
- **Result:** Place Bambu spool on platform → auto-identified → spool created in inventory

### Phase 2: Color + Height (DONE — firmware written)
- [x] AS7341/AS7265x/TCS34725/OPT4048 auto-detecting color driver
- [x] VL53L1X TOF with XSHUT address reprogramming
- [ ] Spectral → LAB conversion on server (`color-science.ts`)
- [ ] Height-based spool diameter estimation
- [ ] Color matching against filament catalog
- **Result:** Even untagged spools get identified by weight + color + size

### Phase 3: Camera + Barcode (Tier 2 Pi OR Phone)
- Pi Camera module on arm, captures on object detection
- OR phone camera via `getUserMedia()` + `BarcodeDetector` API
- Photos uploaded to web app for storage and processing
- Barcode/QR decoding — server-side or browser `BarcodeDetector`
- SKU lookup from barcodes via `skuMappings` table
- Pi runs Chromium kiosk pointing at web app's scan-station page
- **Result:** Scan any retail packaging barcode → identified. Pi users: fully hands-free.

### Phase 4: AI/ML Identification (Cloud)
- Vision API integration (Claude/GPT-4o) called from web app server
- Photo sent to vision API: "Identify this object"
- Bolt/screw identification (size, thread, head type, material)
- Electronic component identification (part number, package)
- Label/brand OCR from spool photos
- All processing in cloud — Pi and ESP32 just provide sensor data + photos
- **Result:** Place an M3x25 screw on platform → "M3x25 SHCS, stainless, qty?"

### Phase 5: Backlit Platform + Silhouette
- WS2812B ring under translucent platform activated for controlled lighting
- Camera (Pi or phone) captures silhouette from above
- Server-side edge detection for dimensional measurement
- Controlled lighting also improves AS7341 color accuracy
- **Result:** Precise dimensional measurement from silhouette

## Tooling

### Fusion 360 MCP (Enclosure Design)
- ClaudeFusion360MCP server configured in `.mcp.json`
- Fusion 360 add-in from `tools/ClaudeFusion360MCP/fusion-addin/`
- All dimensions in centimeters
- Skill docs: `tools/ClaudeFusion360MCP/docs/SKILL.md`, `SPATIAL_AWARENESS.md`

## Verification

### Phase 1 Testing
1. Flash scan-station firmware to ESP32-S3
2. Place a known Bambu spool on the platform
3. Verify serial output shows weight + NFC tag data
4. Verify web app receives POST and creates scan event
5. Verify spool is auto-created and linked to correct filament catalog entry
6. Remove spool, verify IDLE state resumes
7. Test with NTAG (non-Bambu) tagged spool
8. Test with untagged spool (weight-only identification)
