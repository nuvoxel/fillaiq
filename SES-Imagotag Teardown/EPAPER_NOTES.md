# E-Paper Display Investigation Notes

## Goal
Drive SES Imagotag shelf label e-paper displays for Filla IQ slot modules.

## Hardware Inventory

| Board | Chip | Status |
|-------|------|--------|
| Waveshare e-Paper ESP32 Driver Board Rev 3 | ESP32 | Working, but FPC pinout doesn't match Imagotag panel |
| ELECROW CrowPanel ESP32 2.13" e-paper | ESP32-S3 + SSD1680 | Untested — self-contained, built-in display |
| SES Imagotag shelf label (multiple) | EFR32FG22 (Silicon Labs ARM Cortex-M33) | Target for reprogramming |
| XIAO ESP32 | ESP32 | Available |
| XIAO nRF52840 | Nordic nRF52840 | Available, not useful for this project |
| XIAO RA4M1 | Renesas RA4M1 | Available, not useful for this project |
| XIAO breakout board | - | Has OLED + Grove connectors |
| Oscilloscope | - | Available for signal tracing |

## On Order / To Order
- **Seeed XIAO MG24 Sense** (~$11) — same Silicon Labs Series 2 family as FG22, for dev/prototyping
- **ST-Link V2 clone** (~$7) — SWD debug probe to flash the Imagotag FG22

## SES Imagotag Board Details

### PCB Markings
- Board: `imagotag ContRD010A ASKPCB 07-02 k-2 94v-0 2923 e23921b`
- MCU: `fg22 c121gg c0210n 2324` → **EFR32FG22C121** (ARM Cortex-M33, Sub-GHz radio)
- Small button next to FG22 (likely reset or test)
- RGB LED on front
- PCB antenna (Sub-GHz radio for shelf rail communication)
- Possibly NFC coil under display area
- **Rail-powered only** — no battery, uses 3 spring-loaded clips for shelf rail connection

### E-Paper Panel
- FPC ribbon label: `e528827 mbht01`
- Glass back markings: `SE2206JS0E1 SFP20U1 U00D881CH3 24116-00780`
- Manufacturer: **Pervasive Displays** (SE prefix = SES Imagotag branding, actual part: E2206JS0E1)
- Size: ~2.2" (the "22" in E2206)
- Type: BWR (black-white-red) — "J" film suffix
- FPC: **24 pins, 0.5mm pitch**
- Controller: iTC (integrated timing controller) with built-in charge pump

### Debug Interface
- **3x3 grid of through-holes** on back of PCB, under the FG22 chip — likely SWD debug header
- Multiple pogo test points on back
- Pins not yet mapped — need continuity test to identify GND, VCC, SWDIO, SWCLK, RST

### Power
- 3 spring-loaded clips for shelf rail connection
- Clips are: GND, VCC, and likely a data/comm line (not yet mapped)
- No visible voltage regulator (SOT-23) — FG22 runs at 1.8V-3.8V natively
- Safe to try 3.3V through the clips once GND is identified

## What We Tried

### Attempt 1: Waveshare Board + Imagotag Panel (FPC direct)
- Plugged Imagotag panel's 24-pin FPC into Waveshare board's 24-pin connector
- Connector fits physically but **pinout doesn't match**
- Tried SW1 positions A and B — same result in both
- BUSY pin stuck at 0, "Busy Timeout" on PowerOn
- Tried driver: GxEPD2_213_flex (UC8151/IL0373) — no response

### Attempt 2: GPIO Pin Scanner
- Wrote firmware to probe all GPIOs on the Waveshare board
- **Result**: Almost all pins read as floating/unconnected
- Only GPIO0 (ESP32 boot pull-up) and GPIO26 driven HIGH
- "Found responses" were just adjacent-GPIO crosstalk (5→4, 15→14, 16→15, 18→17, 32→27)
- **Conclusion**: Panel not getting power — Waveshare provides VCC/GND on different FPC pins than the Pervasive Displays panel expects

### Attempt 3: Initial FPC from shelf rail connector (not display)
- First attempt was actually with the shelf rail FPC, not the display FPC
- That connector is for power/comms from the shelf rail, not display signals
- User then opened the unit and connected the actual display panel FPC

## Key Findings

1. **Pervasive Displays panels have a different 24-pin FPC pinout than Waveshare/Good Display panels** — even though the connector physically fits
2. Pervasive Displays FPC pinout (partial, from documentation):
   - Pin 9: BUSY_N (busy output)
   - Pin 15: VDDIO (power)
   - Pin 16: VDD (power supply)
   - Pin 17: VSS (GND)
   - Pins 20-24: VDH, VGH, VDL, VGL, VCOM (display driving voltages — may be internal on iTC panels)
3. The Imagotag FG22 already knows the correct pinout and drives the display correctly
4. **Reprogramming the FG22 is the best path** — no FPC reverse engineering needed

## Best Path Forward

### Phase 1: Get SWD Access to Imagotag Board
1. Continuity test on 3x3 debug grid to map GND, VCC, SWDIO, SWCLK
2. Identify GND spring clip, power board with 3.3V
3. Use oscilloscope to look for SPI traffic on FPC during boot (maps display pins)
4. Connect ST-Link V2 to SWD pads
5. Dump existing FG22 firmware (backup)
6. Test connection with OpenOCD

### Phase 2: Develop Display Firmware
1. Use XIAO MG24 Sense to learn Silicon Labs toolchain
2. Install Simplicity Studio or use `arm-none-eabi-gcc` + OpenOCD
3. Write simple e-paper test using Gecko SDK
4. Reference `andrei-tatar/imagotag-hack` repo for Imagotag-specific pin mappings

### Phase 3: Filla IQ Integration
- E-paper display: spool info (low power, always visible, no backlight needed)
- NFC: read spool tags (if NFC chip present on board)
- Sub-GHz radio: wireless slot-to-hub communication
- Compact PCB already designed for shelf mounting

## Toolchain Setup
```bash
brew install open-ocd arm-none-eabi-gcc
```
Silicon Labs Simplicity Studio (free): https://www.silabs.com/developer-tools/simplicity-studio

## Reference Links
- Imagotag hack repo: https://github.com/andrei-tatar/imagotag-hack/
- E-Paper Pricetags (atc1441): https://github.com/atc1441/E-Paper_Pricetags
- Hacking SES imagotag blog: https://blog.jirkabalhar.cz/2023/12/hacking-sesimagotag-e-ink-price-tag/
- Pervasive Displays library: https://github.com/PervasiveDisplays/PDLS_Basic
- Silicon Labs Arduino core: https://github.com/SiliconLabs/arduino
- XIAO MG24 getting started: https://wiki.seeedstudio.com/xiao_mg24_getting_started/

## Existing Firmware in This Project
- `platformio.ini` — has `[env:epaper_test]` for Waveshare board (won't work with Imagotag panel)
- `src/epaper_test.cpp` — pin scanner firmware (last version flashed to Waveshare board)
- Main project (`[env:esp32s3]`) is unchanged — original Filla IQ slot module firmware
