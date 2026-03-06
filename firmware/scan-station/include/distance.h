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
    void begin();           // Init with address reprogramming
    bool read(DistanceData& data);

    bool isConnected();
    void printStatus();

private:
    bool _connected;
};

extern DistanceSensor distanceSensor;
