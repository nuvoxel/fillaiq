# Filla IQ — Scan Station Pinout

**MCU:** ESP32-S3-DevKitC-1-N8R2 (8MB Flash, 2MB PSRAM)

## Pin Map

| GPIO | Function         | Device            | Notes                        |
|------|------------------|-------------------|------------------------------|
| 4    | TFT Backlight    | ST7789V3 TFT      | Active HIGH                  |
| 6    | NFC RST          | PN532              | Hardware reset, active LOW   |
| 7    | NFC IRQ          | PN532              | Wired, interrupt-driven      |
| 8    | I2C SDA          | VL53L1X, AS7341   | Shared bus                   |
| 9    | I2C SCL          | VL53L1X, AS7341   | Shared bus                   |
| 11   | SPI MOSI         | PN532, ST7789V3    | FSPI bus, shared             |
| 12   | SPI SCK          | PN532, ST7789V3    | FSPI bus, shared             |
| 13   | SPI MISO         | PN532, ST7789V3    | FSPI bus, shared             |
| 14   | NFC CS           | PN532              | SPI chip select              |
| 15   | TFT DC           | ST7789V3 TFT      | Data/Command                 |
| 16   | TFT RST          | ST7789V3 TFT      | Reset                        |
| 17   | HX711 SCK        | HX711 Load Cell    | Clock                        |
| 18   | HX711 DT         | HX711 Load Cell    | Data                         |
| 21   | TFT CS           | ST7789V3 TFT      | SPI chip select              |
| 42   | TOF XSHUT        | VL53L1X            | Not currently wired          |
| 48   | LED Data         | WS2812B Ring       | 24 LEDs                      |

## Bus Summary

### SPI (FSPI / SPI2)
Shared between TFT display and NFC reader. Only one device active at a time — NFC CS is deasserted before display operations.

| Signal | GPIO |
|--------|------|
| SCK    | 12   |
| MOSI   | 11   |
| MISO   | 13   |

**Devices:**
- ST7789V3 TFT (CS=21, DC=15, RST=16, BLK=4) — 240x280 1.69" display, 40MHz SPI
- PN532 NFC (CS=14, IRQ=7, RST=6) — Elechouse NFC Module V3, SPI mode (DIP: SW1=OFF, SW2=ON)

### I2C
| Signal | GPIO |
|--------|------|
| SDA    | 8    |
| SCL    | 9    |

**Devices:**
- VL53L1X TOF distance sensor — address 0x29
- AS7341 11-channel spectral color sensor — address 0x39

### Other
| Signal    | GPIO | Description                          |
|-----------|------|--------------------------------------|
| HX711 SCK | 17   | Load cell amplifier clock            |
| HX711 DT  | 18   | Load cell amplifier data             |
| WS2812B   | 48   | 24-LED RGB ring (NeoPixel protocol)  |

## Unused / Reserved
- GPIO 42: VL53L1X XSHUT — defined but not wired

## Power
- ESP32-S3 powered via USB-C (5V)
- TFT, NFC, HX711 powered from 3.3V regulator
- WS2812B ring powered from 5V USB rail
- VL53L1X and AS7341 powered from 3.3V via I2C breakout boards
