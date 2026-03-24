# Filla IQ

Smart workshop inventory system — automatically identify, weigh, and track filament spools, hardware bins, and workshop supplies using NFC, weight sensors, and color detection.

**https://www.fillaiq.com**

## Products

- **FillaScan** — NFC tag reader + weight sensor + color detection. Identifies filament spools (Bambu Lab, Creality, etc.) and reports to the web dashboard.
- **FillaShelf** — Multi-bay shelf with per-slot weight monitoring and NFC identification.
- **FillaLabel** — BLE thermal label printer integration for tag printing.
- **FillaSense** — Environmental monitoring (temperature, humidity, pressure).

## Hardware

- **MCU:** ESP32-S3 (DevKitC or 2.8" ILI9341 touch board)
- **NFC:** PN5180 via RP2040 Pico I2C coprocessor — see **[nuvoxel/pn5180-nfc](https://github.com/nuvoxel/pn5180-nfc)**
- **Weight:** NAU7802 (I2C) or HX711 (GPIO)
- **Color:** AS7341/AS7343 spectral sensor, TCS34725, OPT4048
- **Distance:** VL53L1X time-of-flight
- **Display:** ILI9341 2.8" TFT with FT6336G capacitive touch (LVGL)
- **Audio:** ES8311 codec + I2S speaker
- **Printer:** Phomemo M120 via BLE

## Firmware

Built with PlatformIO + Arduino framework.

```bash
cd firmware/scan-station
pio run -e scan_station_pico_nfc    # Touch board + Pico NFC coprocessor
pio run -e scan_station_touch       # Touch board + direct PN5180 SPI
pio run -e scan_station             # DevKitC + PN532
```

## Related Projects

- **[nuvoxel/pn5180-nfc](https://github.com/nuvoxel/pn5180-nfc)** — PN5180 NFC Arduino library + RP2040 Pico I2C coprocessor. Open source (LGPL-2.1+ / MIT).

## Acknowledgments

- **Filament label design** inspired by [3D Filament Profiles](https://3dfilamentprofiles.com/). The label layout — brand logo, material on inverted strip, color name, temperature ranges, drying info, flow ratio, QR code — follows the format established by their label generator.

## License

Proprietary. Copyright (c) 2025-2026 Filla IQ / Nuvoxel.
