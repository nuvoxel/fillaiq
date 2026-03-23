#include "color.h"
#include <Wire.h>

// Sensor libraries
#include <Adafruit_AS7341.h>

ColorSensor colorSensor;

static Adafruit_AS7341 as7341;

// ==================== I2C Helpers ====================

bool ColorSensor::_i2cProbe(uint8_t addr) {
    Wire.beginTransmission(addr);
    return Wire.endTransmission() == 0;
}

uint8_t ColorSensor::_readDeviceId(uint8_t addr, uint8_t reg) {
    Wire.beginTransmission(addr);
    Wire.write(reg);
    if (Wire.endTransmission() != 0) return 0;
    Wire.requestFrom(addr, (uint8_t)1);
    return Wire.available() ? Wire.read() : 0;
}

// ==================== Init ====================

void ColorSensor::begin() {
    _type = COLOR_NONE;
    _connected = false;

    // Auto-detect: try each sensor address
    // Priority: OPT4048 > AS7343/AS7341 > AS7265x > AS7331 > TCS34725

    if (_i2cProbe(OPT4048_ADDR)) {
        if (_initOPT4048()) return;
    }

    // AS7341 and AS7343 share address 0x39 — differentiate by ID register
    if (_i2cProbe(AS7341_ADDR)) {
        // Enable register bank 1 via CFG0 (0xBF) bit 4 to access ID register
        Wire.beginTransmission(AS7341_ADDR);
        Wire.write(0xBF);  // CFG0
        Wire.write(0x10);  // REG_BANK = 1
        Wire.endTransmission();
        delay(5);

        // AS7343 ID is at 0x5A in bank 1, AS7341 ID is at 0x92
        uint8_t id43 = _readDeviceId(AS7341_ADDR, 0x5A);
        uint8_t id41 = _readDeviceId(AS7341_ADDR, 0x92);
        Serial.printf("  Color ID probe: 0x5A=0x%02X 0x92=0x%02X\n", id43, id41);

        // Switch back to bank 0
        Wire.beginTransmission(AS7341_ADDR);
        Wire.write(0xBF);
        Wire.write(0x00);
        Wire.endTransmission();

        // AS7343: ID at 0x5A = 0x81, AS7341: ID at 0x92 = 0x24 or 0x09
        if (id43 == 0x81) {
            if (_initAS7343()) return;
        } else if (id41 == 0x24 || id41 == 0x09) {
            if (_initAS7341()) return;
        }
        // Unknown ID — try AS7341 library (it does its own ID check)
        if (_initAS7341()) return;
    }

    if (_i2cProbe(AS7265X_ADDR)) {
        if (_initAS7265x()) return;
    }
    if (_i2cProbe(AS7331_ADDR)) {
        if (_initAS7331()) return;
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

bool ColorSensor::_initAS7343() {
    // AS7343: 14-channel spectral sensor
    // Register map is NOT compatible with AS7341 — different addresses for
    // ASTEP, GAIN, STATUS2, and uses AutoSMUX instead of manual SMUX.

    // Power on: ENABLE register (0x80) — same as AS7341
    Wire.beginTransmission(AS7341_ADDR);
    Wire.write(0x80);  // ENABLE
    Wire.write(0x01);  // PON
    if (Wire.endTransmission() != 0) return false;
    delay(10);

    // Set ATIME (0x81) — same address as AS7341
    Wire.beginTransmission(AS7341_ADDR);
    Wire.write(0x81);
    Wire.write(COLOR_AS7341_ATIME);
    Wire.endTransmission();

    // Set ASTEP (0xD4/0xD5) — AS7343 specific, NOT 0xCA/0xCB
    Wire.beginTransmission(AS7341_ADDR);
    Wire.write(0xD4);  // ASTEP_L
    Wire.write(COLOR_AS7341_ASTEP & 0xFF);
    Wire.write((COLOR_AS7341_ASTEP >> 8) & 0xFF);
    Wire.endTransmission();

    // Set gain (0xC6) — AS7343 specific, NOT 0xAA
    Wire.beginTransmission(AS7341_ADDR);
    Wire.write(0xC6);  // CFG1 / AGAIN
    Wire.write(COLOR_AS7341_GAIN);
    Wire.endTransmission();

    // Enable AutoSMUX: CFG20 (0xD6) = 0x03 for full 18-channel (3 sub-cycles)
    Wire.beginTransmission(AS7341_ADDR);
    Wire.write(0xD6);  // CFG20
    Wire.write(0x03);  // auto_smux = 3 (all 3 sub-cycles)
    Wire.endTransmission();

    // Enable spectral measurement: PON + SP_EN
    Wire.beginTransmission(AS7341_ADDR);
    Wire.write(0x80);
    Wire.write(0x03);  // PON + SP_EN
    Wire.endTransmission();

    _type = COLOR_AS7343;
    _connected = true;
    Serial.println("  Color: AS7343 (14-channel spectral)");
    return true;
}

bool ColorSensor::_initAS7265x() {
    // AS7265x init via raw I2C — virtual register interface
    Wire.beginTransmission(AS7265X_ADDR);
    Wire.write(0x00);  // HW_VERSION register (virtual)
    if (Wire.endTransmission() == 0) {
        Wire.requestFrom((uint8_t)AS7265X_ADDR, (uint8_t)1);
        if (Wire.available()) {
            uint8_t hw = Wire.read();
            if (hw == 0x40 || hw == 0x41) {
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
    Wire.beginTransmission(TCS34725_ADDR);
    Wire.write(0x80 | 0x12);  // Command + ID register
    if (Wire.endTransmission() == 0) {
        Wire.requestFrom((uint8_t)TCS34725_ADDR, (uint8_t)1);
        if (Wire.available()) {
            uint8_t id = Wire.read();
            if (id == 0x44 || id == 0x4D) {
                Wire.beginTransmission(TCS34725_ADDR);
                Wire.write(0x80 | 0x00);
                Wire.write(0x03);         // PON + AEN
                Wire.endTransmission();
                Wire.beginTransmission(TCS34725_ADDR);
                Wire.write(0x80 | 0x01);
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
    Wire.beginTransmission(OPT4048_ADDR);
    Wire.write(0x11);  // Device ID register
    if (Wire.endTransmission() == 0) {
        Wire.requestFrom((uint8_t)OPT4048_ADDR, (uint8_t)2);
        if (Wire.available() >= 2) {
            uint16_t devId = (Wire.read() << 8) | Wire.read();
            // OPT4048 register 0x11 returns device ID (big-endian on wire)
            // Known values: 0x0821 (OPT4048). Check lower byte for 0x21 or 0x20.
            uint8_t family = devId & 0xFF;
            if (family == 0x20 || family == 0x21) {
                _type = COLOR_OPT4048;
                _connected = true;
                Serial.printf("  Color: OPT4048 (CIE XYZ, ID=0x%04X)\n", devId);
                return true;
            }
            Serial.printf("  Color: unknown device at 0x%02X (ID=0x%04X)\n", OPT4048_ADDR, devId);
        }
    }
    return false;
}

bool ColorSensor::_initAS7331() {
    // AS7331 UV sensor at 0x74
    // Read AGEN register (0xD1) for device identification
    uint8_t agen = _readDeviceId(AS7331_ADDR, 0xD1);
    uint8_t devId = (agen >> 4) & 0x0F;
    if (devId != 0x02) {  // AS7331 device ID
        // Try alternate — some revisions report differently
        if (!_i2cProbe(AS7331_ADDR)) return false;
    }

    // Set measurement mode: CMD mode (configuration state)
    // OSR register (0x00): write 0x00 for configuration mode
    Wire.beginTransmission(AS7331_ADDR);
    Wire.write(0x00);  // OSR register
    Wire.write(0x00);  // Configuration mode
    Wire.endTransmission();
    delay(10);

    // CREG1 (0x06): set gain and integration time
    // Default gain=1, integration time=64ms
    Wire.beginTransmission(AS7331_ADDR);
    Wire.write(0x06);  // CREG1
    Wire.write(0x50);  // GAIN=4, TIME=256ms
    Wire.endTransmission();

    // CREG3 (0x08): measurement mode = CMD (triggered)
    Wire.beginTransmission(AS7331_ADDR);
    Wire.write(0x08);  // CREG3
    Wire.write(0x40);  // MMODE=CMD
    Wire.endTransmission();

    _type = COLOR_AS7331;
    _connected = true;
    Serial.printf("  Color: AS7331 (UV spectral, AGEN=0x%02X)\n", agen);
    return true;
}

// ==================== Ambient Baseline ====================

void ColorSensor::calibrateAmbient() {
    if (!_connected) return;
    _ambient.clear_data();

    // Take a reading with the empty platform to capture ambient light levels.
    // This baseline can be sent to the server alongside scan data so it can
    // subtract ambient contribution from the spectral/color readings.
    Serial.printf("  Color: measuring ambient baseline (%s)...\n",
        _type == COLOR_AS7341 ? "AS7341" :
        _type == COLOR_AS7343 ? "AS7343" :
        _type == COLOR_OPT4048 ? "OPT4048" :
        _type == COLOR_TCS34725 ? "TCS34725" : "sensor");

    if (read(_ambient)) {
        Serial.print("  Color: ambient baseline OK");
        if (_type == COLOR_AS7341 || _type == COLOR_AS7343) {
            Serial.printf(" (415nm=%u 555nm=%u 680nm=%u clear=%u)\n",
                _ambient.f1_415nm, _ambient.f5_555nm, _ambient.f8_680nm, _ambient.clear);
        } else if (_type == COLOR_OPT4048) {
            Serial.printf(" (lux=%.0f)\n", _ambient.opt_lux);
        } else if (_type == COLOR_TCS34725) {
            Serial.printf(" (R=%u G=%u B=%u C=%u)\n",
                _ambient.rgbc_r, _ambient.rgbc_g, _ambient.rgbc_b, _ambient.rgbc_c);
        } else {
            Serial.println();
        }
    } else {
        Serial.println("  Color: ambient baseline failed");
    }
}

// ==================== Read ====================

bool ColorSensor::read(ColorData& data) {
    data.clear_data();
    if (!_connected) return false;

    data.sensorType = _type;

    switch (_type) {
        case COLOR_AS7341:    return _readAS7341(data);
        case COLOR_AS7343:    return _readAS7343(data);
        case COLOR_AS7265X:   return _readAS7265x(data);
        case COLOR_TCS34725:  return _readTCS34725(data);
        case COLOR_OPT4048:   return _readOPT4048(data);
        case COLOR_AS7331:    return _readAS7331(data);
        default: return false;
    }
}

// ==================== Non-blocking Async Read ====================
// Splits the slow measurement cycle (100-500ms) into:
//   startRead()  — trigger hardware integration (~1ms I2C write)
//   isReady()    — poll status register (~1ms I2C read)
//   finishRead() — read channel data (~2-5ms I2C read)
// For fast sensors (OPT4048, TCS34725, BME280-based) the blocking
// read is <5ms anyway, so startRead() does the full read immediately.

void ColorSensor::startRead() {
    if (!_connected) return;
    _asyncActive = false;

    switch (_type) {
        case COLOR_AS7341:
            // Adafruit library async: starts SMUX config + integration
            if (as7341.startReading()) {
                _asyncActive = true;
            }
            break;
        case COLOR_AS7343:
            // Trigger measurement: set SP_EN in ENABLE register
            Wire.beginTransmission(AS7341_ADDR);
            Wire.write(0x80);  // ENABLE
            Wire.write(0x03);  // PON + SP_EN
            Wire.endTransmission();
            _asyncActive = true;
            break;
        case COLOR_AS7331:
            // Trigger one-shot measurement
            Wire.beginTransmission(AS7331_ADDR);
            Wire.write(0x00);  // OSR register
            Wire.write(0x83);  // Start measurement (CMD mode, one-shot)
            Wire.endTransmission();
            _asyncActive = true;
            break;
        default:
            // Fast sensors — no async needed, read completes in <5ms
            break;
    }
}

bool ColorSensor::isReady() {
    if (!_connected) return false;
    if (!_asyncActive) return true;  // Fast sensor or not started — always ready

    switch (_type) {
        case COLOR_AS7341:
            return as7341.checkReadingProgress();
        case COLOR_AS7343: {
            // AS7343 STATUS2 is at 0x90 (not 0xA3 like AS7341), bit 6 = AVALID
            uint8_t status = _readDeviceId(AS7341_ADDR, 0x90);
            return (status & 0x40) != 0;
        }
        case COLOR_AS7331: {
            // Check if measurement complete — read OSR register bit 0
            uint8_t osr = _readDeviceId(AS7331_ADDR, 0x00);
            return (osr & 0x02) == 0;  // BUSY bit clear = done
        }
        default:
            return true;
    }
}

bool ColorSensor::finishRead(ColorData& data) {
    data.clear_data();
    if (!_connected) return false;
    data.sensorType = _type;

    if (!_asyncActive) {
        // Fast sensors — do the full blocking read (it's <5ms)
        return read(data);
    }

    _asyncActive = false;

    switch (_type) {
        case COLOR_AS7341: {
            // Read channels from hardware (data already captured by ADC)
            uint16_t buf[12];
            if (!as7341.getAllChannels(buf)) return false;
            data.f1_415nm = buf[0];
            data.f2_445nm = buf[1];
            data.f3_480nm = buf[2];
            data.f4_515nm = buf[3];
            data.f5_555nm = buf[4];
            data.f6_590nm = buf[5];
            data.f7_630nm = buf[6];
            data.f8_680nm = buf[7];
            data.clear    = buf[8];
            data.nir      = buf[9];
            data.channels[0] = buf[0]; data.channels[1] = buf[1];
            data.channels[2] = buf[2]; data.channels[3] = buf[3];
            data.channels[4] = buf[4]; data.channels[5] = buf[5];
            data.channels[6] = buf[6]; data.channels[7] = buf[7];
            data.channels[8] = buf[8]; data.channels[9] = buf[9];
            data.channelCount = 10;
            data.valid = true;
            return true;
        }
        case COLOR_AS7343: {
            // Read all 36 bytes (18 regs × 2) from 0x95
            uint8_t rawBuf[36];
            Wire.beginTransmission(AS7341_ADDR);
            Wire.write(0x95);
            if (Wire.endTransmission() != 0) return false;
            int bytesRead = 0;
            while (bytesRead < 36) {
                int toRead = min(36 - bytesRead, 32);
                int got = Wire.requestFrom((uint8_t)AS7341_ADDR, (uint8_t)toRead);
                for (int i = 0; i < got && bytesRead < 36; i++) {
                    rawBuf[bytesRead++] = Wire.read();
                }
                if (got == 0) break;
            }
            if (bytesRead < 36) return false;
            // Same mapping as _readAS7343
            uint16_t regs[18];
            for (int i = 0; i < 18; i++) {
                regs[i] = rawBuf[i * 2] | (rawBuf[i * 2 + 1] << 8);
            }
            data.channels[0]  = regs[12]; // F1  405nm
            data.channels[1]  = regs[6];  // F2  425nm
            data.channels[2]  = regs[0];  // FZ  450nm
            data.channels[3]  = regs[7];  // F3  475nm
            data.channels[4]  = regs[8];  // F4  515nm
            data.channels[5]  = regs[15]; // F5  550nm
            data.channels[6]  = regs[1];  // FY  555nm
            data.channels[7]  = regs[2];  // FXL 600nm
            data.channels[8]  = regs[9];  // F6  640nm
            data.channels[9]  = regs[13]; // F7  690nm
            data.channels[10] = regs[14]; // F8  745nm
            data.channels[11] = regs[3];  // NIR 855nm
            data.channels[12] = regs[4];  // Clear
            data.channels[13] = regs[5];  // FD
            data.channelCount = 14;
            data.f1_415nm = data.channels[0];
            data.f2_445nm = data.channels[1];
            data.f3_480nm = data.channels[2];
            data.f4_515nm = data.channels[4];
            data.f5_555nm = data.channels[6];
            data.f6_590nm = data.channels[7];
            data.f7_630nm = data.channels[8];
            data.f8_680nm = data.channels[9];
            data.clear    = data.channels[12];
            data.nir      = data.channels[11];
            data.valid = true;
            return true;
        }
        case COLOR_AS7331: {
            // Read result registers
            Wire.beginTransmission(AS7331_ADDR);
            Wire.write(0x01);
            if (Wire.endTransmission() != 0) return false;
            Wire.requestFrom((uint8_t)AS7331_ADDR, (uint8_t)6);
            if (Wire.available() < 6) return false;
            uint16_t rawA = Wire.read() | (Wire.read() << 8);
            uint16_t rawB = Wire.read() | (Wire.read() << 8);
            uint16_t rawC = Wire.read() | (Wire.read() << 8);
            float sensitivity = 0.035f;
            data.uva = rawA * sensitivity;
            data.uvb = rawB * sensitivity;
            data.uvc = rawC * sensitivity;
            data.channels[0] = rawA;
            data.channels[1] = rawB;
            data.channels[2] = rawC;
            data.channelCount = 3;
            data.valid = true;
            return true;
        }
        default:
            return false;
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

bool ColorSensor::_readAS7343(ColorData& data) {
    // AS7343: 18 data registers (0x95-0xB7) = 36 bytes, covering 3 AutoSMUX sub-cycles
    // Channel order in data registers (NOT sequential by wavelength):
    //   Data0  (0x95) = FZ   450nm    Data6  (0xA1) = F2   425nm    Data12 (0xAD) = F1   405nm
    //   Data1  (0x97) = FY   555nm    Data7  (0xA3) = F3   475nm    Data13 (0xAF) = F7   690nm
    //   Data2  (0x99) = FXL  600nm    Data8  (0xA5) = F4   515nm    Data14 (0xB1) = F8   745nm
    //   Data3  (0x9B) = NIR  855nm    Data9  (0xA7) = F6   640nm    Data15 (0xB3) = F5   550nm
    //   Data4  (0x9D) = Clear1        Data10 (0xA9) = Clear2        Data16 (0xB5) = Clear3
    //   Data5  (0x9F) = FD1           Data11 (0xAB) = FD2           Data17 (0xB7) = FD3

    // Trigger measurement
    Wire.beginTransmission(AS7341_ADDR);
    Wire.write(0x80);  // ENABLE
    Wire.write(0x03);  // PON + SP_EN
    Wire.endTransmission();

    // Wait for AVALID — STATUS2 at 0x90 (AS7343), bit 6
    unsigned long start = millis();
    while (millis() - start < 500) {
        uint8_t status = _readDeviceId(AS7341_ADDR, 0x90);
        if (status & 0x40) break;
        delay(10);
    }

    // Read all 36 bytes (18 channels × 2 bytes) from 0x95
    uint8_t rawBuf[36];
    Wire.beginTransmission(AS7341_ADDR);
    Wire.write(0x95);
    if (Wire.endTransmission() != 0) return false;

    int bytesRead = 0;
    while (bytesRead < 36) {
        int toRead = min(36 - bytesRead, 32);  // Wire buffer limit
        int got = Wire.requestFrom((uint8_t)AS7341_ADDR, (uint8_t)toRead);
        for (int i = 0; i < got && bytesRead < 36; i++) {
            rawBuf[bytesRead++] = Wire.read();
        }
        if (got == 0) break;
    }

    if (bytesRead < 36) return false;

    // Parse all 18 registers as little-endian uint16
    uint16_t regs[18];
    for (int i = 0; i < 18; i++) {
        regs[i] = rawBuf[i * 2] | (rawBuf[i * 2 + 1] << 8);
    }

    // Map to channels[] in wavelength order for the 14 spectral channels:
    // F1(405) F2(425) FZ(450) F3(475) F4(515) F5(550) FY(555) FXL(600) F6(640) F7(690) F8(745) NIR(855) Clear FD
    data.channels[0]  = regs[12]; // F1   405nm (Data12)
    data.channels[1]  = regs[6];  // F2   425nm (Data6)
    data.channels[2]  = regs[0];  // FZ   450nm (Data0)
    data.channels[3]  = regs[7];  // F3   475nm (Data7)
    data.channels[4]  = regs[8];  // F4   515nm (Data8)
    data.channels[5]  = regs[15]; // F5   550nm (Data15)
    data.channels[6]  = regs[1];  // FY   555nm (Data1)
    data.channels[7]  = regs[2];  // FXL  600nm (Data2)
    data.channels[8]  = regs[9];  // F6   640nm (Data9)
    data.channels[9]  = regs[13]; // F7   690nm (Data13)
    data.channels[10] = regs[14]; // F8   745nm (Data14)
    data.channels[11] = regs[3];  // NIR  855nm (Data3)
    data.channels[12] = regs[4];  // Clear (avg of 3: use sub-cycle 1)
    data.channels[13] = regs[5];  // FD (flicker, sub-cycle 1)
    data.channelCount = 14;

    // Map to AS7341-compatible named fields (closest wavelength match)
    data.f1_415nm = data.channels[0];   // F1  405nm
    data.f2_445nm = data.channels[1];   // F2  425nm
    data.f3_480nm = data.channels[2];   // FZ  450nm
    data.f4_515nm = data.channels[4];   // F4  515nm
    data.f5_555nm = data.channels[6];   // FY  555nm
    data.f6_590nm = data.channels[7];   // FXL 600nm
    data.f7_630nm = data.channels[8];   // F6  640nm
    data.f8_680nm = data.channels[9];   // F7  690nm
    data.clear    = data.channels[12];
    data.nir      = data.channels[11];

    data.valid = true;
    return true;
}

bool ColorSensor::_readAS7265x(ColorData& data) {
    // AS7265x uses virtual register interface
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

    // Map first 8 visible channels to named fields for compatibility
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
    Wire.beginTransmission(TCS34725_ADDR);
    Wire.write(0xA0 | 0x14);
    if (Wire.endTransmission() != 0) return false;

    Wire.requestFrom((uint8_t)TCS34725_ADDR, (uint8_t)8);
    if (Wire.available() < 8) return false;

    data.rgbc_c = Wire.read() | (Wire.read() << 8);
    data.rgbc_r = Wire.read() | (Wire.read() << 8);
    data.rgbc_g = Wire.read() | (Wire.read() << 8);
    data.rgbc_b = Wire.read() | (Wire.read() << 8);

    // McCamy's CCT formula
    if (data.rgbc_r > 0 && data.rgbc_g > 0 && data.rgbc_b > 0) {
        float x = (-0.14282f * data.rgbc_r + 1.54924f * data.rgbc_g + -0.95641f * data.rgbc_b) /
                  (float)(data.rgbc_r + data.rgbc_g + data.rgbc_b);
        float y = (-0.32466f * data.rgbc_r + 1.57837f * data.rgbc_g + -0.73191f * data.rgbc_b) /
                  (float)(data.rgbc_r + data.rgbc_g + data.rgbc_b);
        float n = (x - 0.3320f) / (0.1858f - y);
        float cct = 449.0f * n * n * n + 3525.0f * n * n + 6823.3f * n + 5520.33f;
        data.colorTemp = (uint16_t)cct;
    }

    data.channels[0] = data.rgbc_r;
    data.channels[1] = data.rgbc_g;
    data.channels[2] = data.rgbc_b;
    data.channels[3] = data.rgbc_c;
    data.channelCount = 4;

    data.valid = true;
    return true;
}

bool ColorSensor::_readOPT4048(ColorData& data) {
    for (int ch = 0; ch < 4; ch++) {
        uint8_t reg = ch * 2;

        Wire.beginTransmission(OPT4048_ADDR);
        Wire.write(reg);
        if (Wire.endTransmission() != 0) return false;

        Wire.requestFrom((uint8_t)OPT4048_ADDR, (uint8_t)4);
        if (Wire.available() < 4) return false;

        uint16_t msb = (Wire.read() << 8) | Wire.read();
        uint16_t lsb = (Wire.read() << 8) | Wire.read();

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

    // Populate unified channels array for API payload
    data.channels[0] = (uint16_t)data.cie_x;
    data.channels[1] = (uint16_t)data.cie_y;
    data.channels[2] = (uint16_t)data.cie_z;
    data.channels[3] = (uint16_t)data.opt_lux;
    data.channelCount = 4;
    data.valid = true;
    return true;
}

bool ColorSensor::_readAS7331(ColorData& data) {
    // Trigger one-shot measurement: set MMODE to CMD and start
    Wire.beginTransmission(AS7331_ADDR);
    Wire.write(0x00);  // OSR register
    Wire.write(0x83);  // Start measurement (CMD mode, one-shot)
    Wire.endTransmission();

    // Wait for measurement complete (check STATUS register)
    delay(300);  // Wait for integration to complete

    // Read output registers: MRES1 (UVA), MRES2 (UVB), MRES3 (UVC)
    // Result registers at 0x01-0x06 (16-bit each)
    Wire.beginTransmission(AS7331_ADDR);
    Wire.write(0x01);  // MRES1_L
    if (Wire.endTransmission() != 0) return false;

    Wire.requestFrom((uint8_t)AS7331_ADDR, (uint8_t)6);
    if (Wire.available() < 6) return false;

    uint16_t rawA = Wire.read() | (Wire.read() << 8);
    uint16_t rawB = Wire.read() | (Wire.read() << 8);
    uint16_t rawC = Wire.read() | (Wire.read() << 8);

    // Convert raw counts to µW/cm² (approximate — depends on gain/time config)
    // With GAIN=4, TIME=256ms: sensitivity ≈ 0.035 µW/cm²/count (datasheet typical)
    float sensitivity = 0.035f;
    data.uva = rawA * sensitivity;
    data.uvb = rawB * sensitivity;
    data.uvc = rawC * sensitivity;

    data.channels[0] = rawA;
    data.channels[1] = rawB;
    data.channels[2] = rawC;
    data.channelCount = 3;

    data.valid = true;
    return true;
}

// ==================== Getters ====================

ColorSensorType ColorSensor::getType() { return _type; }
bool ColorSensor::isConnected() { return _connected; }

void ColorSensor::ledOn(uint8_t drive) {
    if (!_connected) return;
    if (drive > 127) drive = 127;

    switch (_type) {
        case COLOR_AS7343:
            // AS7343: LED register at 0xCD (bank 0), bit 7 = LED_ACT, bits 0-6 = drive
            Wire.beginTransmission(AS7341_ADDR);
            Wire.write(0xCD);
            Wire.write(0x80 | drive);  // LED_ACT + drive current
            Wire.endTransmission();
            break;
        case COLOR_AS7341: {
            // AS7341: LED register at 0x74 (bank 1)
            // Switch to bank 1
            Wire.beginTransmission(AS7341_ADDR);
            Wire.write(0xBF);  // CFG0
            Wire.write(0x10);  // REG_BANK = 1
            Wire.endTransmission();
            // Write LED register
            Wire.beginTransmission(AS7341_ADDR);
            Wire.write(0x74);
            Wire.write(0x80 | drive);
            Wire.endTransmission();
            // Switch back to bank 0
            Wire.beginTransmission(AS7341_ADDR);
            Wire.write(0xBF);
            Wire.write(0x00);
            Wire.endTransmission();
            break;
        }
        default:
            break;
    }
}

void ColorSensor::ledOff() {
    if (!_connected) return;

    switch (_type) {
        case COLOR_AS7343:
            Wire.beginTransmission(AS7341_ADDR);
            Wire.write(0xCD);
            Wire.write(0x00);
            Wire.endTransmission();
            break;
        case COLOR_AS7341: {
            Wire.beginTransmission(AS7341_ADDR);
            Wire.write(0xBF);
            Wire.write(0x10);
            Wire.endTransmission();
            Wire.beginTransmission(AS7341_ADDR);
            Wire.write(0x74);
            Wire.write(0x00);
            Wire.endTransmission();
            Wire.beginTransmission(AS7341_ADDR);
            Wire.write(0xBF);
            Wire.write(0x00);
            Wire.endTransmission();
            break;
        }
        default:
            break;
    }
}

void ColorSensor::printStatus() {
    Serial.println("=== Color Sensor ===");
    const char* names[] = {"NONE", "AS7341", "AS7265x", "TCS34725", "OPT4048", "AS7343", "AS7331"};
    Serial.printf("  Type: %s\n", names[_type]);
    Serial.printf("  Connected: %s\n", _connected ? "YES" : "no");

    if (_connected) {
        ColorData data;
        if (read(data)) {
            switch (_type) {
                case COLOR_AS7341:
                case COLOR_AS7343:
                    Serial.printf("  415nm=%d 445=%d 480=%d 515=%d 555=%d 590=%d 630=%d 680=%d\n",
                        data.f1_415nm, data.f2_445nm, data.f3_480nm, data.f4_515nm,
                        data.f5_555nm, data.f6_590nm, data.f7_630nm, data.f8_680nm);
                    Serial.printf("  Clear=%d NIR=%d  (%d channels)\n", data.clear, data.nir, data.channelCount);
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
                case COLOR_AS7331:
                    Serial.printf("  UVA=%.2f UVB=%.2f UVC=%.2f µW/cm²\n",
                        data.uva, data.uvb, data.uvc);
                    break;
                default: break;
            }
        }
    }
}
