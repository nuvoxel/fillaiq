# Filla IQ — System Architecture

## Vision
A modular smart filament rack that transforms passive spool storage into an intelligent inventory and workflow management system. Each rack slot identifies, weighs, and displays filament status in real-time, connected to a centrally hosted web service that integrates with 3D printer slicers.

## Design Philosophy
- **Zero-friction UX** — place a spool, everything updates automatically. No scanning, no buttons, no workflows.
- **Modular** — add or remove shelves and bays without reconfiguration
- **Affordable** — never at the expense of UX. ESP32-S3 everywhere for simplicity and consistency.
- **Spool-centric** — slots are just locations. Spools are the objects you manage. Put them anywhere.

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                    FILLA IQ CENTRAL SERVICE (cloud-hosted)          │
│                                                                     │
│   ┌───────────────┐   ┌───────────────┐   ┌──────────────────┐    │
│   │  Web App       │   │  REST API     │   │  Slicer          │    │
│   │  (React/TS)    │◄─►│  Server       │◄─►│  Integration     │    │
│   │  Mobile-ready  │   │               │   │  (Bambu/Orca)    │    │
│   └───────────────┘   └───────┬───────┘   └──────────────────┘    │
│                               │                                     │
│   ┌───────────────────────────┴───────────────────────────┐        │
│   │  Database: Filaments → Variants → SKUs → Spools       │        │
│   └───────────────────────────────────────────────────────┘        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │ HTTPS / WebSocket
                                │
┌───────────────────────────────┼─────────────────────────────────────┐
│                        BRIDGE CONTROLLER                            │
│                  ESP32-S3 + W5500 Ethernet (or WiFi)                │
│                                                                     │
│   • Single network config point — only device user joins to WiFi   │
│   • HTTPS client to central service                                │
│   • CAN bus master for shelf communication                         │
│   • mDNS: fillaiq.local for local discovery                        │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
                    CAN Bus Backplane (2 wires + power)
                    ┌───────────┼───────────┬─────────── ─ ─
                    │           │           │
              ┌─────▼─────┐ ┌──▼──────┐ ┌──▼──────┐
              │  SHELF 0  │ │ SHELF 1 │ │ SHELF 2 │  ...
              │  ESP32-S3 │ │ ESP32-S3│ │ ESP32-S3│
              │  8 bays   │ │ 8 bays  │ │ 8 bays  │
              │  16 slots │ │ 16 slots│ │ 16 slots│
              └───────────┘ └─────────┘ └─────────┘
```

---

## Physical Layout

### Rack Structure
- **Rack** = the full furniture piece (shelving unit)
- **Shelf** = one horizontal level, controlled by one ESP32-S3
- **Bay** = one printed "slot" unit on a shelf, holds 2 spools side-by-side
- **Spool Position** = one individual spool spot (left or right within a bay)

```
Shelf (1x ESP32-S3, CAN transceiver)
├── Bay 0: [Spool Pos 0 | Spool Pos 1]
├── Bay 1: [Spool Pos 2 | Spool Pos 3]
├── Bay 2: [Spool Pos 4 | Spool Pos 5]
├── Bay 3: [Spool Pos 6 | Spool Pos 7]
├── Bay 4: [Spool Pos 8 | Spool Pos 9]
├── Bay 5: [Spool Pos 10 | Spool Pos 11]
├── Bay 6: [Spool Pos 12 | Spool Pos 13]
└── Bay 7: [Spool Pos 14 | Spool Pos 15]
```

Each spool position has: 1x PN532, 1x load cell + HX711, 1x color LCD, 1x RGB LED, 1x static NFC sticker (for phone tap).

Two ESP32-S3 per shelf (one per row of 8 spool positions) if GPIO is tight. Both on CAN bus.

---

## Per-Slot Hardware

| Component | Part | Interface | Purpose |
|-----------|------|-----------|---------|
| **NFC Reader** | PN532 | SPI | Read any NFC tag format (Bambu, Creality, OpenPrintTag, OpenSpoolTag, NTAG, future standards) |
| **Weight Sensor** | TAL221 micro load cell (2kg) | — | Measure spool weight |
| **ADC** | HX711 | 2-wire GPIO | 24-bit weight measurement |
| **Display** | 1.69" IPS LCD (ST7789, 240x280) | SPI | Color filament swatch, weight bar, status |
| **LED** | WS2812B (addressable RGB) | 1-wire chain | Filament color indicator, locator flash |
| **Phone NFC** | NTAG215 sticker (static) | Passive | Programmed with slot URL, user taps phone to see full details in browser |

### NFC Reader Choice: PN532 over RC522
The PN532 supports ISO 14443A, 14443B, FeliCa, and ISO 18092. This future-proofs against the fragmented tag landscape — Bambu, Creality, OpenPrintTag, OpenSpoolTag all use different tag types. The PN532 also supports tag writing, needed for the new-spool onboarding flow. Cost is ~$2-3 more per position than RC522.

### NFC Reader Placement
Readers mount on the **outward-facing side** of each spool position, aimed at the spool core. Tags on filament spools are typically on the side of the core (Bambu: both sides; OpenPrintTag: one side). Reading from below would require penetrating filament wraps. Side-reading gives best reliability for side-mounted tags.

If a tag is on the far side, the system detects weight + no tag and prompts: "Try flipping the spool." After timeout, falls back to "No tag — register via app."

### Phone NFC Sticker
Each spool position has a cheap NTAG215 sticker ($0.15) programmed once with a URL like `app.fillaiq.com/slot/shelf-2/pos-5`. User taps phone → browser opens → full filament details, print profiles, history, etc. The tag is static — the web service resolves the current spool for that position.

---

## Backplane: CAN Bus

All shelf controllers communicate with the bridge via CAN bus over a physical backplane.

**Why CAN over wireless (ESP-NOW):**
- Power wires run to every shelf anyway — adding 2 data wires costs nothing
- No interference issues in a workshop with stepper motors and PSUs
- No pairing, no channel conflicts, deterministic latency
- ESP32-S3 has a built-in CAN controller (TWAI) — just add a transceiver chip ($0.50)

**Backplane wiring:** 4 conductors total
- CAN High
- CAN Low
- 5V Power
- GND

Each shelf plugs in via a connector (JST or Molex). Bridge sits at one end.

---

## Bridge Controller

| Component | Part | Purpose |
|-----------|------|---------|
| ESP32-S3 | WROOM-1 | CAN bus master + WiFi/network gateway |
| W5500 | Ethernet SPI module ($3-4) | Wired network option (user's choice: ethernet or WiFi) |
| CAN transceiver | SN65HVD230 | Backplane interface |

**Only the bridge needs network credentials.** User configures WiFi or plugs in ethernet once. All shelf controllers are plug-and-play on the CAN backplane.

---

## Data Model

```
Filament (product line)
│   "Bambu PLA Basic, White, 1.75mm"
│   └── base recommended settings (nozzle, bed, retraction, etc.)
│
├── Variant A (SKU: BL-PLA-001, OEM: Supplier X, batch range)
│   ├── tested print profiles (from user data)
│   ├── equivalency notes ("runs 3°C hotter than base")
│   └── linked SKUs:
│       ├── BL-PLA-001        (single roll)
│       ├── BL-PLA-001-4PK    (4-pack)
│       └── BL-PLA-001-AMZ    (Amazon listing)
│
├── Variant B (SKU: BL-PLA-002, OEM: Supplier Y)
│   ├── tested print profiles
│   └── linked SKUs: [...]
│
Spool (physical roll)
    ├── NFC tag UID: 04:A3:2B:...
    ├── variant: A
    ├── current_location: shelf 2, position 12
    ├── weight: 640g
    ├── purchased: 2026-01-15
    └── usage_history: [{removed: 640g, returned: 480g, date: ...}, ...]
```

**Key concepts:**
- **Filament** = product definition (brand + material + color). Shared across spools.
- **Variant** = actual manufacturing run. Same product name may have different OEMs with different optimal settings. Identified by SKU, barcode, batch code, or NFC data patterns.
- **SKU mapping** = multiple SKUs (single, 4-pack, Amazon bundle, etc.) can point to the same variant.
- **Spool** = one physical roll. Unique NFC tag. References one variant. Tracks weight, location, history.
- **Slot** = just a location sensor. Reports "spool X is here and weighs Y grams."

**Accuracy approach:** Central service is curated (not community wiki). User print results feed back into variant profiles over time across all users, building the most accurate filament database available.

---

## UX Flows

### Place a known spool
1. User places spool on rack position
2. Load cell detects weight → display shows "Detecting..."
3. PN532 reads NFC tag → looks up spool in database
4. Display shows: color swatch, brand/material/name, weight, percentage, temps
5. RGB LED glows filament color
6. Web service updated with new location and current weight

### Place an unknown spool (no tag or unrecognized)
1. Load cell detects weight
2. PN532 tries to read → no recognized tag
3. Display: "Try flipping spool"
4. After timeout: "No tag — tap phone to register"
5. User taps phone on slot NFC sticker → browser opens registration page
6. Phone camera scans barcode/QR from spool packaging → auto-lookup
7. User confirms details → web service writes spool record
8. PN532 writes Filla IQ data to blank NFC tag (if present on spool)
9. Slot display updates with full info

### Remove a spool
1. Load cell drops to zero
2. Display shows last known info briefly, then "Empty"
3. Web service logs: spool removed from this position at this weight

### Return a spool (different slot)
1. User puts spool in any available position
2. System reads NFC → recognizes spool → shows current info
3. Weight updated (may be less than when removed → filament was used)
4. Web service logs weight delta as usage

### "Find my filament" (slicer integration)
1. Slicer or web UI requests: "I need Hatchbox Orange PLA"
2. API finds all spools of that filament, ranked by remaining weight
3. Recommends best candidate: "Shelf 2, Position 12 — 640g remaining"
4. RGB LED on that position flashes to guide user to it

---

## Slicer Integration

### Phase 1: OrcaSlicer (open source, plugin-friendly)
- Export/sync filament profiles as JSON
- Plugin queries API: "where is this filament? how much is left?"
- AMS slot recommendation based on rack position

### Phase 2: Bambu Studio
- Custom filament profile import (JSON)
- MQTT bridge: listen for print job → identify required filament → push notification
- "Load [filament] from Shelf 2 into AMS 2"

### Phase 3: Usage tracking from printer
- Pull estimated filament usage from slicer/printer
- Update spool weight while it's off the rack
- "You'll run out of this filament in 2 prints — order more?"

---

## Optional Sensors (future add-ons)

- **Temp/humidity sensor per shelf or drybox:** For drybox users, monitor conditions. Reports through shelf ESP32 on existing CAN bus. SHT30 or DHT22.
- **Ultrasonic sensor:** Potential drybox spool presence detection if NFC can't read through enclosure walls.

---

## Project Phases

### Phase 1: Single Slot PoC ← CURRENT
- [x] Architecture design
- [ ] Breadboard prototype: ESP32-S3 + RC522 + HX711 + OLED + RGB LED
- [ ] State machine: detect spool, read tag, display info, detect removal
- [ ] Serial commands: tare, calibrate, status
- [ ] Validate NFC read range and tag compatibility

### Phase 2: Shelf Prototype
- [ ] 2-bay (4 spool positions) on one ESP32-S3
- [ ] Multiplexing or direct GPIO for multiple PN532s + HX711s
- [ ] Color LCD (ST7789) per position instead of OLED
- [ ] WS2812B LED strip for all positions

### Phase 3: Multi-Shelf + Bridge
- [ ] CAN bus backplane between shelf controller and bridge
- [ ] Bridge: ESP32-S3 + W5500 ethernet
- [ ] Bridge firmware: CAN master, WiFi/ethernet, API client
- [ ] Shelf auto-discovery on CAN bus

### Phase 4: Web Service
- [ ] Database: filaments, variants, SKUs, spools
- [ ] REST API for rack status, spool CRUD, filament catalog
- [ ] Real-time WebSocket for live status
- [ ] Barcode/QR lookup for new spool registration
- [ ] NFC tag write flow

### Phase 5: Slicer Integration
- [ ] OrcaSlicer profile export
- [ ] "Find my filament" API
- [ ] Bambu Studio MQTT bridge
- [ ] AMS recommendation engine

### Phase 6: Polish
- [ ] Predictive usage ("you'll run out in X prints")
- [ ] Drying reminders by material + age
- [ ] Community variant contributions (curated)
- [ ] Multi-rack support
- [ ] Custom PCB design for bay module
