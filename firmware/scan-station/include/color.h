#pragma once

#include <Arduino.h>
#include "scan_config.h"
#include "sensors.h"

// ============================================================
// Filla IQ — Scan Station Color Sensor Driver
// Auto-detects which sensor is connected via I2C scan:
//   AS7341  (0x39) — 11-channel spectral, best balance
//   AS7265x (0x49) — 18-channel spectral, near-lab quality
//   TCS34725 (0x29) — 4-channel RGBC, basic
//   OPT4048 (0x44) — 4-channel CIE XYZ, good accuracy
// ============================================================

class ColorSensor {
public:
    void begin();           // Auto-detect and init
    bool read(ColorData& data);  // Read into unified struct

    ColorSensorType getType();
    bool isConnected();
    void printStatus();

private:
    ColorSensorType _type;
    bool _connected;

    bool _initAS7341();
    bool _initAS7265x();
    bool _initTCS34725();
    bool _initOPT4048();

    bool _readAS7341(ColorData& data);
    bool _readAS7265x(ColorData& data);
    bool _readTCS34725(ColorData& data);
    bool _readOPT4048(ColorData& data);

    bool _i2cProbe(uint8_t addr);
};

extern ColorSensor colorSensor;
