#include "environment.h"
#include <Wire.h>

EnvironmentSensor envSensor;

// Common I2C addresses for environmental sensors
#define BME280_ADDR_A  0x76
#define BME280_ADDR_B  0x77
#define SHT31_ADDR     0x44
#define AHT20_ADDR     0x38

void EnvironmentSensor::begin() {
    _connected = false;
    _type = ENV_NONE;

    // Auto-detect by I2C probe
    // BME280/BME680 at 0x76 or 0x77
    if (_i2cProbe(BME280_ADDR_A)) {
        _i2cAddr = BME280_ADDR_A;
        _type = ENV_BME280;  // Could be BME680 too — distinguish by chip ID later
        _connected = true;
    } else if (_i2cProbe(BME280_ADDR_B)) {
        _i2cAddr = BME280_ADDR_B;
        _type = ENV_BME280;
        _connected = true;
    } else if (_i2cProbe(SHT31_ADDR)) {
        _i2cAddr = SHT31_ADDR;
        _type = ENV_SHT31;
        _connected = true;
    } else if (_i2cProbe(AHT20_ADDR)) {
        _i2cAddr = AHT20_ADDR;
        _type = ENV_AHT20;
        _connected = true;
    }

    if (_connected) {
        Serial.printf("  Env: %s at 0x%02X\n", getChipName(), _i2cAddr);
        // TODO: Initialize specific sensor library here
    } else {
        Serial.println("  Env: not detected");
    }
}

bool EnvironmentSensor::read(EnvData& data) {
    if (!_connected) return false;

    // TODO: Read from actual sensor based on _type
    // For now return invalid until sensor library is integrated
    data.valid = false;
    return false;
}

const char* EnvironmentSensor::getChipName() const {
    switch (_type) {
        case ENV_BME280: return "BME280";
        case ENV_BME680: return "BME680";
        case ENV_SHT31:  return "SHT31";
        case ENV_AHT20:  return "AHT20";
        default:         return "None";
    }
}

bool EnvironmentSensor::_i2cProbe(uint8_t addr) {
    Wire.beginTransmission(addr);
    return Wire.endTransmission() == 0;
}

void EnvironmentSensor::printStatus() {
    Serial.printf("  Env sensor: %s", _connected ? getChipName() : "not detected");
    if (_connected) {
        Serial.printf(" (I2C 0x%02X)", _i2cAddr);
        if (_lastReading.valid) {
            Serial.printf(" T=%.1f°C H=%.1f%%", _lastReading.temperatureC, _lastReading.humidity);
            if (_lastReading.pressureHPa > 0) {
                Serial.printf(" P=%.0fhPa", _lastReading.pressureHPa);
            }
        }
    }
    Serial.println();
}
