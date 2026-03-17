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

// ── BME280 registers and calibration ──────────────────────────────────────────
#define BME280_REG_ID          0xD0
#define BME280_REG_CTRL_HUM    0xF2
#define BME280_REG_STATUS      0xF3
#define BME280_REG_CTRL_MEAS   0xF4
#define BME280_REG_CONFIG      0xF5
#define BME280_REG_DATA        0xF7  // 8 bytes: press[3] temp[3] hum[2]
#define BME280_REG_CALIB00     0x88  // 26 bytes
#define BME280_REG_CALIB26     0xE1  // 7 bytes

struct BME280Calib {
    uint16_t dig_T1; int16_t dig_T2, dig_T3;
    uint16_t dig_P1; int16_t dig_P2, dig_P3, dig_P4, dig_P5, dig_P6, dig_P7, dig_P8, dig_P9;
    uint8_t  dig_H1; int16_t dig_H2; uint8_t dig_H3; int16_t dig_H4, dig_H5; int8_t dig_H6;
};
static BME280Calib bmeCalib;
static int32_t bme_t_fine;  // shared between temp and pressure compensation

static uint8_t bmeRead8(uint8_t addr, uint8_t reg) {
    Wire.beginTransmission(addr);
    Wire.write(reg);
    Wire.endTransmission(false);
    Wire.requestFrom(addr, (uint8_t)1);
    return Wire.available() ? Wire.read() : 0;
}

static void bmeReadBytes(uint8_t addr, uint8_t reg, uint8_t *buf, uint8_t len) {
    Wire.beginTransmission(addr);
    Wire.write(reg);
    Wire.endTransmission(false);
    Wire.requestFrom(addr, len);
    for (uint8_t i = 0; i < len && Wire.available(); i++) {
        buf[i] = Wire.read();
    }
}

static void bmeWrite8(uint8_t addr, uint8_t reg, uint8_t val) {
    Wire.beginTransmission(addr);
    Wire.write(reg);
    Wire.write(val);
    Wire.endTransmission();
}

static void bmeLoadCalibration(uint8_t addr) {
    uint8_t buf[26];
    bmeReadBytes(addr, BME280_REG_CALIB00, buf, 26);
    bmeCalib.dig_T1 = buf[0]  | (buf[1] << 8);
    bmeCalib.dig_T2 = buf[2]  | (buf[3] << 8);
    bmeCalib.dig_T3 = buf[4]  | (buf[5] << 8);
    bmeCalib.dig_P1 = buf[6]  | (buf[7] << 8);
    bmeCalib.dig_P2 = buf[8]  | (buf[9] << 8);
    bmeCalib.dig_P3 = buf[10] | (buf[11] << 8);
    bmeCalib.dig_P4 = buf[12] | (buf[13] << 8);
    bmeCalib.dig_P5 = buf[14] | (buf[15] << 8);
    bmeCalib.dig_P6 = buf[16] | (buf[17] << 8);
    bmeCalib.dig_P7 = buf[18] | (buf[19] << 8);
    bmeCalib.dig_P8 = buf[20] | (buf[21] << 8);
    bmeCalib.dig_P9 = buf[22] | (buf[23] << 8);
    bmeCalib.dig_H1 = buf[25];

    uint8_t buf2[7];
    bmeReadBytes(addr, BME280_REG_CALIB26, buf2, 7);
    bmeCalib.dig_H2 = buf2[0] | (buf2[1] << 8);
    bmeCalib.dig_H3 = buf2[2];
    bmeCalib.dig_H4 = (buf2[3] << 4) | (buf2[4] & 0x0F);
    bmeCalib.dig_H5 = (buf2[5] << 4) | (buf2[4] >> 4);
    bmeCalib.dig_H6 = buf2[6];
}

static void bmeInit(uint8_t addr) {
    bmeLoadCalibration(addr);
    // Config: standby 1000ms, filter x4
    bmeWrite8(addr, BME280_REG_CONFIG, (0x05 << 5) | (0x02 << 2));
    // Humidity oversampling x1
    bmeWrite8(addr, BME280_REG_CTRL_HUM, 0x01);
    // Temp x2, Pressure x2, Normal mode
    bmeWrite8(addr, BME280_REG_CTRL_MEAS, (0x02 << 5) | (0x02 << 2) | 0x03);
}

// BME280 compensation formulas (from Bosch datasheet)
static float bmeCompensateTemp(int32_t adc_T) {
    int32_t var1 = ((((adc_T >> 3) - ((int32_t)bmeCalib.dig_T1 << 1))) * (int32_t)bmeCalib.dig_T2) >> 11;
    int32_t var2 = (((((adc_T >> 4) - (int32_t)bmeCalib.dig_T1) * ((adc_T >> 4) - (int32_t)bmeCalib.dig_T1)) >> 12) * (int32_t)bmeCalib.dig_T3) >> 14;
    bme_t_fine = var1 + var2;
    return (float)((bme_t_fine * 5 + 128) >> 8) / 100.0f;
}

static float bmeCompensatePressure(int32_t adc_P) {
    int64_t var1 = (int64_t)bme_t_fine - 128000;
    int64_t var2 = var1 * var1 * (int64_t)bmeCalib.dig_P6;
    var2 = var2 + ((var1 * (int64_t)bmeCalib.dig_P5) << 17);
    var2 = var2 + (((int64_t)bmeCalib.dig_P4) << 35);
    var1 = ((var1 * var1 * (int64_t)bmeCalib.dig_P3) >> 8) + ((var1 * (int64_t)bmeCalib.dig_P2) << 12);
    var1 = (((((int64_t)1) << 47) + var1)) * ((int64_t)bmeCalib.dig_P1) >> 33;
    if (var1 == 0) return 0;
    int64_t p = 1048576 - adc_P;
    p = (((p << 31) - var2) * 3125) / var1;
    var1 = (((int64_t)bmeCalib.dig_P9) * (p >> 13) * (p >> 13)) >> 25;
    var2 = (((int64_t)bmeCalib.dig_P8) * p) >> 19;
    p = ((p + var1 + var2) >> 8) + (((int64_t)bmeCalib.dig_P7) << 4);
    return (float)p / 25600.0f;
}

static float bmeCompensateHumidity(int32_t adc_H) {
    int32_t v = bme_t_fine - 76800;
    v = (((((adc_H << 14) - ((int32_t)bmeCalib.dig_H4 << 20) - ((int32_t)bmeCalib.dig_H5 * v)) +
          16384) >> 15) * (((((((v * (int32_t)bmeCalib.dig_H6) >> 10) *
          (((v * (int32_t)bmeCalib.dig_H3) >> 11) + 32768)) >> 10) + 2097152) *
          (int32_t)bmeCalib.dig_H2 + 8192) >> 14));
    v = v - (((((v >> 15) * (v >> 15)) >> 7) * (int32_t)bmeCalib.dig_H1) >> 4);
    v = (v < 0) ? 0 : v;
    v = (v > 419430400) ? 419430400 : v;
    return (float)(v >> 12) / 1024.0f;
}

static bool bmeRead(uint8_t addr, EnvData& data) {
    uint8_t buf[8];
    bmeReadBytes(addr, BME280_REG_DATA, buf, 8);

    int32_t adc_P = ((int32_t)buf[0] << 12) | ((int32_t)buf[1] << 4) | (buf[2] >> 4);
    int32_t adc_T = ((int32_t)buf[3] << 12) | ((int32_t)buf[4] << 4) | (buf[5] >> 4);
    int32_t adc_H = ((int32_t)buf[6] << 8)  | buf[7];

    // Check for invalid readings (all 0 or all 0xFFFFF)
    if (adc_T == 0 || adc_T == 0xFFFFF) return false;

    data.temperatureC = bmeCompensateTemp(adc_T);  // must be first (sets t_fine)
    data.pressureHPa = bmeCompensatePressure(adc_P);
    data.humidity = bmeCompensateHumidity(adc_H);
    data.valid = true;
    data.timestamp = millis();
    return true;
}

void EnvironmentSensor::begin() {
    _connected = false;
    _type = ENV_NONE;

    // Auto-detect I2C sensors first
    if (_i2cProbe(BME280_ADDR_A)) {
        _i2cAddr = BME280_ADDR_A;
        _type = ENV_BME280;
        _connected = true;
        bmeInit(_i2cAddr);
    } else if (_i2cProbe(BME280_ADDR_B)) {
        _i2cAddr = BME280_ADDR_B;
        _type = ENV_BME280;
        _connected = true;
        bmeInit(_i2cAddr);
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

    if (_type == ENV_BME280) {
        if (bmeRead(_i2cAddr, data)) {
            _lastReading = data;
            return true;
        }
        return false;
    }

    if (_type == ENV_SHT31) {
        // SHT31: trigger single-shot measurement (high repeatability)
        Wire.beginTransmission(_i2cAddr);
        Wire.write(0x24); Wire.write(0x00);
        if (Wire.endTransmission() != 0) return false;
        delay(15);
        Wire.requestFrom(_i2cAddr, (uint8_t)6);
        if (Wire.available() < 6) return false;
        uint16_t st = (Wire.read() << 8) | Wire.read(); Wire.read(); // temp + CRC
        uint16_t sh = (Wire.read() << 8) | Wire.read(); Wire.read(); // hum + CRC
        data.temperatureC = -45.0f + 175.0f * (float)st / 65535.0f;
        data.humidity = 100.0f * (float)sh / 65535.0f;
        data.pressureHPa = 0;
        data.valid = true;
        data.timestamp = millis();
        _lastReading = data;
        return true;
    }

    if (_type == ENV_AHT20) {
        // AHT20: trigger measurement
        Wire.beginTransmission(_i2cAddr);
        Wire.write(0xAC); Wire.write(0x33); Wire.write(0x00);
        if (Wire.endTransmission() != 0) return false;
        delay(80);
        Wire.requestFrom(_i2cAddr, (uint8_t)6);
        if (Wire.available() < 6) return false;
        uint8_t state = Wire.read();
        if (state & 0x80) return false; // busy
        uint32_t raw = ((uint32_t)Wire.read() << 12) | ((uint32_t)Wire.read() << 4);
        uint8_t shared = Wire.read();
        raw |= (shared >> 4);
        uint32_t rawT = ((uint32_t)(shared & 0x0F) << 16) | ((uint32_t)Wire.read() << 8) | Wire.read();
        data.humidity = (float)raw / 1048576.0f * 100.0f;
        data.temperatureC = (float)rawT / 1048576.0f * 200.0f - 50.0f;
        data.pressureHPa = 0;
        data.valid = true;
        data.timestamp = millis();
        _lastReading = data;
        return true;
    }

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
