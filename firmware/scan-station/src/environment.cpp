#include "environment.h"
#include "color.h"
#include <Wire.h>
#include <DHT.h>

EnvironmentSensor envSensor;

// Common I2C addresses for environmental sensors
#define BME280_ADDR_A  0x76
#define BME280_ADDR_B  0x77
#define SHT31_ADDR     0x44
#define AHT20_ADDR     0x38

// DHT sensor instance (created on demand)
static DHT* dhtSensor = nullptr;

void EnvironmentSensor::begin() {
    _connected = false;
    _type = ENV_NONE;

    // Auto-detect I2C sensors first
    if (_i2cProbe(BME280_ADDR_A)) {
        _i2cAddr = BME280_ADDR_A;
        _type = ENV_BME280;
        _connected = true;
    } else if (_i2cProbe(BME280_ADDR_B)) {
        _i2cAddr = BME280_ADDR_B;
        _type = ENV_BME280;
        _connected = true;
    } else if (_i2cProbe(SHT31_ADDR)) {
        // SHT31 shares 0x44 with OPT4048 — skip if color sensor already claimed it
        if (!colorSensor.isConnected() || colorSensor.getType() != COLOR_OPT4048) {
            // Verify it's actually an SHT31 by reading the status register
            Wire.beginTransmission(SHT31_ADDR);
            Wire.write(0xF3);
            Wire.write(0x2D);
            if (Wire.endTransmission() == 0) {
                delay(10);
                Wire.requestFrom((uint8_t)SHT31_ADDR, (uint8_t)3);
                if (Wire.available() >= 3) {
                    Wire.read(); Wire.read(); Wire.read();  // status + CRC
                    _i2cAddr = SHT31_ADDR;
                    _type = ENV_SHT31;
                    _connected = true;
                }
            }
        }
    }
#ifndef BOARD_SCAN_TOUCH
    // AHT20 at 0x38 conflicts with FT6336G touch controller on the touch board
    else if (_i2cProbe(AHT20_ADDR)) {
        _i2cAddr = AHT20_ADDR;
        _type = ENV_AHT20;
        _connected = true;
    }
#endif

    // Fall back to DHT on GPIO if no I2C sensor found
#ifdef DHT_PIN
    if (!_connected && DHT_PIN >= 0) {
        dhtSensor = new DHT(DHT_PIN, DHT_TYPE);
        dhtSensor->begin();
        delay(1000);  // DHT needs time to stabilize

        float t = dhtSensor->readTemperature();
        float h = dhtSensor->readHumidity();
        if (!isnan(t) && !isnan(h)) {
            _type = (DHT_TYPE == 22) ? ENV_DHT22 : ENV_DHT11;
            _connected = true;
        } else {
            delete dhtSensor;
            dhtSensor = nullptr;
        }
    }
#endif

    if (_connected) {
        if (_type == ENV_DHT11 || _type == ENV_DHT22) {
#ifdef DHT_PIN
            Serial.printf("  Env: %s on GPIO%d\n", getChipName(), DHT_PIN);
#endif
        } else {
            Serial.printf("  Env: %s at 0x%02X\n", getChipName(), _i2cAddr);
        }
    } else {
        Serial.println("  Env: not detected");
    }
}

bool EnvironmentSensor::read(EnvData& data) {
    if (!_connected) return false;

    if ((_type == ENV_DHT11 || _type == ENV_DHT22) && dhtSensor) {
        float t = dhtSensor->readTemperature();
        float h = dhtSensor->readHumidity();
        if (isnan(t) || isnan(h)) return false;

        data.valid = true;
        data.temperatureC = t;
        data.humidity = h;
        data.pressureHPa = 0;  // DHT doesn't measure pressure
        data.timestamp = millis();
        _lastReading = data;
        return true;
    }

    // TODO: Read from I2C sensors based on _type
    data.valid = false;
    return false;
}

const char* EnvironmentSensor::getChipName() const {
    switch (_type) {
        case ENV_BME280: return "BME280";
        case ENV_BME680: return "BME680";
        case ENV_SHT31:  return "SHT31";
        case ENV_AHT20:  return "AHT20";
        case ENV_DHT11:  return "DHT11";
        case ENV_DHT22:  return "DHT22";
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
        if (_type == ENV_DHT11 || _type == ENV_DHT22) {
#ifdef DHT_PIN
            Serial.printf(" (GPIO%d)", DHT_PIN);
#endif
        } else {
            Serial.printf(" (I2C 0x%02X)", _i2cAddr);
        }
        if (_lastReading.valid) {
            Serial.printf(" T=%.1f°C H=%.1f%%", _lastReading.temperatureC, _lastReading.humidity);
            if (_lastReading.pressureHPa > 0) {
                Serial.printf(" P=%.0fhPa", _lastReading.pressureHPa);
            }
        }
    }
    Serial.println();
}
