#include "color.h"
#include <Wire.h>

// Conditional includes — only the sensor actually present gets used
#include <Adafruit_AS7341.h>
// TCS34725 and OPT4048 use raw I2C (no heavy library needed)
// AS7265x uses SparkFun library if available

ColorSensor colorSensor;

static Adafruit_AS7341 as7341;

// ==================== I2C Probe ====================

bool ColorSensor::_i2cProbe(uint8_t addr) {
    Wire.beginTransmission(addr);
    return Wire.endTransmission() == 0;
}

// ==================== Init ====================

void ColorSensor::begin() {
    _type = COLOR_NONE;
    _connected = false;

    // Auto-detect: try each sensor address
    // Priority: AS7265x > AS7341 > OPT4048 > TCS34725
    if (_i2cProbe(AS7265X_ADDR)) {
        if (_initAS7265x()) return;
    }
    if (_i2cProbe(AS7341_ADDR)) {
        if (_initAS7341()) return;
    }
    if (_i2cProbe(OPT4048_ADDR)) {
        if (_initOPT4048()) return;
    }
    if (_i2cProbe(TCS34725_ADDR)) {
        if (_initTCS34725()) return;
    }

    Serial.println("  Color: no sensor detected");
}

bool ColorSensor::_initAS7341() {
    if (as7341.begin()) {
        as7341.setATIME(COLOR_AS7341_ATIME);
        as7341.setASTEP(COLOR_AS7341_ASTEP);
        as7341.setGain((as7341_gain_t)COLOR_AS7341_GAIN);
        _type = COLOR_AS7341;
        _connected = true;
        Serial.println("  Color: AS7341 (11-channel spectral)");
        return true;
    }
    return false;
}

bool ColorSensor::_initAS7265x() {
    // AS7265x init via raw I2C
    // The SparkFun AS7265x library uses a virtual register interface over I2C
    // For now, basic presence check — full init requires SparkFun_AS7265X library
    Wire.beginTransmission(AS7265X_ADDR);
    Wire.write(0x00);  // HW_VERSION register (virtual)
    if (Wire.endTransmission() == 0) {
        Wire.requestFrom((uint8_t)AS7265X_ADDR, (uint8_t)1);
        if (Wire.available()) {
            uint8_t hw = Wire.read();
            if (hw == 0x40 || hw == 0x41) {  // AS72651 or AS72652
                _type = COLOR_AS7265X;
                _connected = true;
                Serial.printf("  Color: AS7265x (18-channel spectral, HW=0x%02X)\n", hw);
                return true;
            }
        }
    }
    return false;
}

bool ColorSensor::_initTCS34725() {
    // TCS34725 check: read ID register (0x12 | 0x80 for command bit)
    Wire.beginTransmission(TCS34725_ADDR);
    Wire.write(0x80 | 0x12);  // Command + ID register
    if (Wire.endTransmission() == 0) {
        Wire.requestFrom((uint8_t)TCS34725_ADDR, (uint8_t)1);
        if (Wire.available()) {
            uint8_t id = Wire.read();
            if (id == 0x44 || id == 0x4D) {  // TCS34725 or TCS34727
                // Enable: PON + AEN
                Wire.beginTransmission(TCS34725_ADDR);
                Wire.write(0x80 | 0x00);  // ENABLE register
                Wire.write(0x03);         // PON + AEN
                Wire.endTransmission();
                // Set integration time
                Wire.beginTransmission(TCS34725_ADDR);
                Wire.write(0x80 | 0x01);  // ATIME register
                Wire.write(COLOR_TCS34725_ITIME);
                Wire.endTransmission();

                _type = COLOR_TCS34725;
                _connected = true;
                Serial.printf("  Color: TCS34725 (RGBC, ID=0x%02X)\n", id);
                return true;
            }
        }
    }
    return false;
}

bool ColorSensor::_initOPT4048() {
    // OPT4048 check: read device ID register (0x11)
    Wire.beginTransmission(OPT4048_ADDR);
    Wire.write(0x11);  // Device ID register
    if (Wire.endTransmission() == 0) {
        Wire.requestFrom((uint8_t)OPT4048_ADDR, (uint8_t)2);
        if (Wire.available() >= 2) {
            uint16_t devId = (Wire.read() << 8) | Wire.read();
            if (devId == 0x2048 || devId == 0x2084) {
                _type = COLOR_OPT4048;
                _connected = true;
                Serial.printf("  Color: OPT4048 (CIE XYZ, ID=0x%04X)\n", devId);
                return true;
            }
        }
    }
    return false;
}

// ==================== Read ====================

bool ColorSensor::read(ColorData& data) {
    data.clear_data();
    if (!_connected) return false;

    data.sensorType = _type;

    switch (_type) {
        case COLOR_AS7341:    return _readAS7341(data);
        case COLOR_AS7265X:   return _readAS7265x(data);
        case COLOR_TCS34725:  return _readTCS34725(data);
        case COLOR_OPT4048:   return _readOPT4048(data);
        default: return false;
    }
}

bool ColorSensor::_readAS7341(ColorData& data) {
    if (!as7341.readAllChannels()) return false;

    data.f1_415nm = as7341.getChannel(AS7341_CHANNEL_415nm_F1);
    data.f2_445nm = as7341.getChannel(AS7341_CHANNEL_445nm_F2);
    data.f3_480nm = as7341.getChannel(AS7341_CHANNEL_480nm_F3);
    data.f4_515nm = as7341.getChannel(AS7341_CHANNEL_515nm_F4);
    data.f5_555nm = as7341.getChannel(AS7341_CHANNEL_555nm_F5);
    data.f6_590nm = as7341.getChannel(AS7341_CHANNEL_590nm_F6);
    data.f7_630nm = as7341.getChannel(AS7341_CHANNEL_630nm_F7);
    data.f8_680nm = as7341.getChannel(AS7341_CHANNEL_680nm_F8);
    data.clear    = as7341.getChannel(AS7341_CHANNEL_CLEAR);
    data.nir      = as7341.getChannel(AS7341_CHANNEL_NIR);

    // Also populate channels[] array for unified access
    data.channels[0] = data.f1_415nm;
    data.channels[1] = data.f2_445nm;
    data.channels[2] = data.f3_480nm;
    data.channels[3] = data.f4_515nm;
    data.channels[4] = data.f5_555nm;
    data.channels[5] = data.f6_590nm;
    data.channels[6] = data.f7_630nm;
    data.channels[7] = data.f8_680nm;
    data.channels[8] = data.clear;
    data.channels[9] = data.nir;
    data.channelCount = 10;

    data.valid = true;
    return true;
}

bool ColorSensor::_readAS7265x(ColorData& data) {
    // AS7265x uses virtual register interface
    // Read all 18 calibrated channels (6 per sensor x 3 sensors)
    // Registers: 0x08-0x13 (sensor 1), 0x14-0x1F (sensor 2), 0x20-0x2B (sensor 3)
    // Each channel is 2 bytes (float32 calibrated, but raw uint16 for now)

    // Trigger one-shot measurement
    // Write to CONTROL_SETUP (virtual reg 0x04): DATA_RDY=0, BANK=3 (all), GAIN, ITIME
    // This is simplified — full implementation should use SparkFun library

    // For now, read raw calibrated values
    uint8_t regStart = 0x08;
    data.channelCount = 18;

    for (int i = 0; i < 18; i++) {
        Wire.beginTransmission(AS7265X_ADDR);
        Wire.write(regStart + (i * 2));
        if (Wire.endTransmission() != 0) return false;

        Wire.requestFrom((uint8_t)AS7265X_ADDR, (uint8_t)2);
        if (Wire.available() >= 2) {
            data.channels[i] = (Wire.read() << 8) | Wire.read();
        }
    }

    // Map first 8 visible channels to the named fields for compatibility
    if (data.channelCount >= 10) {
        data.f1_415nm = data.channels[0];
        data.f2_445nm = data.channels[1];
        data.f3_480nm = data.channels[2];
        data.f4_515nm = data.channels[3];
        data.f5_555nm = data.channels[4];
        data.f6_590nm = data.channels[5];
        data.f7_630nm = data.channels[6];
        data.f8_680nm = data.channels[7];
    }

    data.valid = true;
    return true;
}

bool ColorSensor::_readTCS34725(ColorData& data) {
    // Read RGBC data (registers 0x14-0x1B, auto-increment with command bit 0xA0)
    Wire.beginTransmission(TCS34725_ADDR);
    Wire.write(0xA0 | 0x14);  // Command + auto-increment + CDATAL
    if (Wire.endTransmission() != 0) return false;

    Wire.requestFrom((uint8_t)TCS34725_ADDR, (uint8_t)8);
    if (Wire.available() < 8) return false;

    data.rgbc_c = Wire.read() | (Wire.read() << 8);
    data.rgbc_r = Wire.read() | (Wire.read() << 8);
    data.rgbc_g = Wire.read() | (Wire.read() << 8);
    data.rgbc_b = Wire.read() | (Wire.read() << 8);

    // Simple CCT approximation (McCamy's formula)
    if (data.rgbc_r > 0 && data.rgbc_g > 0 && data.rgbc_b > 0) {
        float x = (-0.14282f * data.rgbc_r + 1.54924f * data.rgbc_g + -0.95641f * data.rgbc_b) /
                  (float)(data.rgbc_r + data.rgbc_g + data.rgbc_b);
        float y = (-0.32466f * data.rgbc_r + 1.57837f * data.rgbc_g + -0.73191f * data.rgbc_b) /
                  (float)(data.rgbc_r + data.rgbc_g + data.rgbc_b);
        float n = (x - 0.3320f) / (0.1858f - y);
        float cct = 449.0f * n * n * n + 3525.0f * n * n + 6823.3f * n + 5520.33f;
        data.colorTemp = (uint16_t)cct;
    }

    // Populate channels[] for unified access
    data.channels[0] = data.rgbc_r;
    data.channels[1] = data.rgbc_g;
    data.channels[2] = data.rgbc_b;
    data.channels[3] = data.rgbc_c;
    data.channelCount = 4;

    data.valid = true;
    return true;
}

bool ColorSensor::_readOPT4048(ColorData& data) {
    // OPT4048: 4 result channels at registers 0x00-0x07 (2 regs per channel)
    // Channel 0 = X, Channel 1 = Y, Channel 2 = Z, Channel 3 = W (infrared-corrected)
    // Each result: [mantissa:20][exponent:4] across two 16-bit registers

    for (int ch = 0; ch < 4; ch++) {
        uint8_t reg = ch * 2;

        Wire.beginTransmission(OPT4048_ADDR);
        Wire.write(reg);
        if (Wire.endTransmission() != 0) return false;

        Wire.requestFrom((uint8_t)OPT4048_ADDR, (uint8_t)4);
        if (Wire.available() < 4) return false;

        uint16_t msb = (Wire.read() << 8) | Wire.read();
        uint16_t lsb = (Wire.read() << 8) | Wire.read();

        // Extract mantissa (20 bits) and exponent (4 bits)
        uint8_t exponent = (msb >> 12) & 0x0F;
        uint32_t mantissa = ((uint32_t)(msb & 0x0FFF) << 8) | (lsb >> 8);

        float value = (float)mantissa * (1 << exponent) / 65536.0f;

        switch (ch) {
            case 0: data.cie_x = value; break;
            case 1: data.cie_y = value; break;
            case 2: data.cie_z = value; break;
            case 3: data.opt_lux = value; break;
        }
    }

    data.channelCount = 4;
    data.valid = true;
    return true;
}

// ==================== Getters ====================

ColorSensorType ColorSensor::getType() { return _type; }
bool ColorSensor::isConnected() { return _connected; }

void ColorSensor::printStatus() {
    Serial.println("=== Color Sensor ===");
    const char* names[] = {"NONE", "AS7341", "AS7265x", "TCS34725", "OPT4048"};
    Serial.printf("  Type: %s\n", names[_type]);
    Serial.printf("  Connected: %s\n", _connected ? "YES" : "no");

    if (_connected) {
        ColorData data;
        if (read(data)) {
            switch (_type) {
                case COLOR_AS7341:
                    Serial.printf("  415nm=%d 445=%d 480=%d 515=%d 555=%d 590=%d 630=%d 680=%d\n",
                        data.f1_415nm, data.f2_445nm, data.f3_480nm, data.f4_515nm,
                        data.f5_555nm, data.f6_590nm, data.f7_630nm, data.f8_680nm);
                    Serial.printf("  Clear=%d NIR=%d\n", data.clear, data.nir);
                    break;
                case COLOR_AS7265X:
                    Serial.printf("  18 channels:");
                    for (int i = 0; i < data.channelCount; i++) {
                        Serial.printf(" %d", data.channels[i]);
                    }
                    Serial.println();
                    break;
                case COLOR_TCS34725:
                    Serial.printf("  R=%d G=%d B=%d C=%d CCT=%dK\n",
                        data.rgbc_r, data.rgbc_g, data.rgbc_b, data.rgbc_c, data.colorTemp);
                    break;
                case COLOR_OPT4048:
                    Serial.printf("  X=%.3f Y=%.3f Z=%.3f Lux=%.1f\n",
                        data.cie_x, data.cie_y, data.cie_z, data.opt_lux);
                    break;
                default: break;
            }
        }
    }
}
