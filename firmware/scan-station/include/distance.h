#pragma once

#include <Arduino.h>
#include "scan_config.h"
#include "sensors.h"

// ============================================================
// Filla IQ — Scan Station VL53L1X TOF Distance Sensor
// Mounted on arm above platform, measures object height.
// Uses XSHUT pin to reprogram I2C address (avoids TCS34725 conflict).
// ============================================================

class DistanceSensor {
public:
    void begin();           // Init sensor
    void calibrateBaseline(uint8_t samples = 10);  // Measure empty-platform distance
    bool read(DistanceData& data);

    bool isConnected();
    float getArmHeight() const { return _armHeightMm; }
    void printStatus();

private:
    bool _connected = false;
    float _armHeightMm = TOF_ARM_HEIGHT_MM;  // Auto-measured on boot, fallback to config
};

extern DistanceSensor distanceSensor;
