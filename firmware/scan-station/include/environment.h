#pragma once

#include <Arduino.h>
#include "scan_config.h"

// Environmental sensor data
struct EnvData {
    bool valid = false;
    float temperatureC = 0;
    float humidity = 0;       // %RH
    float pressureHPa = 0;    // hPa (0 if sensor doesn't support)
    unsigned long timestamp = 0;
};

// Sensor types we might support
enum EnvSensorType : uint8_t {
    ENV_NONE = 0,
    ENV_BME280,
    ENV_BME680,
    ENV_SHT31,
    ENV_AHT20,
    ENV_DHT11,
    ENV_DHT22,
};

class EnvironmentSensor {
public:
    void begin();              // Auto-detect and init
    bool read(EnvData& data);  // Read latest values

    EnvSensorType getType() const { return _type; }
    bool isConnected() const { return _connected; }
    const char* getChipName() const;
    uint8_t getI2CAddr() const { return _i2cAddr; }
    void printStatus();

private:
    EnvSensorType _type = ENV_NONE;
    bool _connected = false;
    uint8_t _i2cAddr = 0;
    EnvData _lastReading;

    bool _i2cProbe(uint8_t addr);
};

extern EnvironmentSensor envSensor;
