# Filla IQ — FillaScan Parts Reference

## MCU: ESP32-S3-DevKitC-1-N8R2

- **Chip:** ESP32-S3 (dual-core Xtensa LX7, 240 MHz)
- **Board:** rymcu-esp32-s3-devkitc-1 (PlatformIO)
- **Memory:** 8MB Flash, 2MB PSRAM
- **USB:** USB-C, native USB CDC for serial
- **On-board RGB LED:** WS2812B on GPIO48 (parallel with external ring)

### GPIO Usage

| GPIO | Function       | Device            | Notes                        |
|------|----------------|-------------------|------------------------------|
| 4    | TFT Backlight  | ST7789V3 TFT      | Active HIGH                  |
| 7    | NFC IRQ        | PN532              | Not currently wired          |
| 8    | I2C SDA        | VL53L1X, AS7341   | Shared bus                   |
| 9    | I2C SCL        | VL53L1X, AS7341   | Shared bus                   |
| 11   | SPI MOSI       | PN532, ST7789V3   | FSPI bus, shared             |
| 12   | SPI SCK        | PN532, ST7789V3   | FSPI bus, shared             |
| 13   | SPI MISO       | PN532, ST7789V3   | FSPI bus, shared             |
| 14   | NFC CS         | PN532              | SPI chip select              |
| 15   | TFT DC         | ST7789V3 TFT      | Data/Command                 |
| 16   | TFT RST        | ST7789V3 TFT      | Reset                        |
| 17   | HX711 SCK      | HX711 Load Cell   | Clock                        |
| 18   | HX711 DT       | HX711 Load Cell   | Data                         |
| 21   | TFT CS         | ST7789V3 TFT      | SPI chip select              |
| 42   | TOF XSHUT      | VL53L1X            | Not currently wired          |
| 48   | LED Data       | WS2812B Ring       | 24 LEDs + onboard in parallel|

**Known GPIO issues:** GPIO 5/6 don't work reliably for HX711 on this board.

---

## NFC Reader: Elechouse PN532 Module V3 (x1)

- **Chip:** NXP PN532
- **Interfaces:** SPI / I2C / HSU (selected by DIP switch)
- **Operating voltage:** 3.3V (on-board 3.3V LDO from 5V input)
- **Board dimensions:** 42.70 x 40.40 mm

### DIP Switch — Interface Selection

| Mode | SW1 | SW2 |
|------|-----|-----|
| HSU  | OFF | OFF |
| I2C  | ON  | OFF |
| SPI  | OFF | ON  |

### SPI Pin Header (top, 8-pin row)

| Pin | Name  | Description                    |
|-----|-------|--------------------------------|
| 1   | SCK   | SPI Clock                      |
| 2   | MISO  | SPI Master In                  |
| 3   | MOSI  | SPI Master Out                 |
| 4   | SS    | SPI Chip Select (active low)   |
| 5   | VCC   | 5V power input                 |
| 6   | GND   | Ground                         |
| 7   | IRQ   | Interrupt output               |
| 8   | RSTO  | Reset output                   |

### FillaScan Usage

Using **SPI mode** (DIP: SW1=OFF, SW2=ON). Shares FSPI bus with TFT display — NFC CS is deasserted before display operations.

- SCK → GPIO12, MOSI → GPIO11, MISO → GPIO13, CS → GPIO14
- IRQ (GPIO7) defined but using polling mode
- **Library:** `adafruit/Adafruit PN532`

---

## Display: ST7789V3 240x280 1.69" TFT (x1)

- **Controller:** ST7789V3
- **Size:** 1.69 inches (rounded corners)
- **Resolution:** 240x280 pixels, 16-bit color (RGB565)
- **Interface:** SPI (4-wire), 40MHz
- **Backlight:** Active HIGH on GPIO4
- **Library:** `bodmer/TFT_eSPI@^2.5.43`

### Wiring

| TFT Pin | Function | GPIO |
|---------|----------|------|
| CS      | Chip Select | 21 |
| DC      | Data/Command | 15 |
| RST     | Reset | 16 |
| BLK     | Backlight | 4 |
| SCK     | SPI Clock | 12 (shared FSPI) |
| MOSI    | SPI Data | 11 (shared FSPI) |

### Notes

- Shares FSPI bus with PN532 NFC reader
- No sprite support on ESP32-S3 (8-bit sprites crash) — uses direct draw
- Flicker-free updates via mode-based redraw and targeted region clearing
- Status icons (WiFi, paired, printer) drawn inset from rounded corners

---

## Load Cell Amplifier: HX711 (x1)

- **Interface:** Proprietary serial (SCK + DT, not SPI/I2C)
- **Resolution:** 24-bit ADC
- **Gain:** 128 (Channel A), 64 (Channel A), 32 (Channel B)
- **Operating voltage:** 2.6-5.5V
- **Library:** `bogde/HX711@^0.7.5`

### Wiring

| HX711 Pin | Function | GPIO |
|-----------|----------|------|
| VCC       | 3.3V or 5V | —  |
| GND       | Ground   | —    |
| DT (DOUT) | Data out | 18   |
| SCK       | Clock in | 17   |

### Notes

- Weight reading runs on Core 1 (FreeRTOS task) to avoid jitter
- Calibration persisted in ESP32 NVS flash

---

## TOF Sensor: VL53L1X (x1)

- **Interface:** I2C
- **Default address:** 0x29 (reassigned to 0x52 via XSHUT)
- **Range:** ~40mm to 4000mm
- **Timing budget:** 50ms
- **Library:** `pololu/VL53L1X@^1.3.1`

### Wiring

| Pin | Function | GPIO |
|-----|----------|------|
| SDA | I2C Data | 8    |
| SCL | I2C Clock | 9   |
| XSHUT | Shutdown | 42 (not currently wired) |

### Notes

- Arm height set to 250mm — object height = arm height - measured distance
- Shares I2C bus with AS7341 color sensor

---

## Color Sensor: AS7341 (x1)

- **Chip:** AMS AS7341 11-channel spectral sensor
- **Interface:** I2C, address 0x39
- **Channels:** F1-F8 (415nm-680nm), Clear, NIR
- **Library:** `adafruit/Adafruit AS7341@^1.4.1`

### Settings

- ATIME: 100
- ASTEP: 999
- Gain: AS7341_GAIN_256X

### Notes

- Shares I2C bus with VL53L1X TOF sensor
- Used for filament color identification

---

## LED Ring: WS2812B (x1 ring + 1 on-board)

- **GPIO:** 48
- **Ring LEDs:** 24
- **On-board LED:** 1 (parallel with ring on GPIO48, mirrors pixel 0)
- **Library:** `adafruit/Adafruit NeoPixel@^1.12.0`

### LED Modes

| Mode     | Pattern                          |
|----------|----------------------------------|
| Idle     | Dim blue-white (20, 20, 30)      |
| Scanning | Yellow pulse animation           |
| Success  | Green solid                      |
| Error    | Red solid                        |
| Needs Input | Yellow solid                  |
| Spin     | Comet tail animation             |
| Rainbow  | Full rainbow cycle               |

### Notes

- On-board DevKitC-1 LED is wired in parallel with ring (not daisy-chained)
- Both receive same data — pixel 0 shows on onboard LED and first ring LED
- LED_COUNT=24, LED_SKIP=0

---

## Bus Summary

### SPI (FSPI / SPI2)

Shared between TFT display and NFC reader. Only one device active at a time.

| Signal | GPIO |
|--------|------|
| SCK    | 12   |
| MOSI   | 11   |
| MISO   | 13   |

### I2C

| Signal | GPIO |
|--------|------|
| SDA    | 8    |
| SCL    | 9    |

**Devices:** VL53L1X (0x52), AS7341 (0x39)

## Power

- ESP32-S3 powered via USB-C (5V)
- TFT, NFC, HX711 powered from 3.3V regulator
- WS2812B ring powered from 5V USB rail
- VL53L1X and AS7341 powered from 3.3V via I2C breakout boards
