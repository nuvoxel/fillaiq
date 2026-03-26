#include "weight.h"
#include <Wire.h>
#include <Preferences.h>

// I2C bus mutex — shared with sensor/NFC/touch tasks
extern SemaphoreHandle_t i2cMutex;

ScaleDriver scale;

const char* ScaleDriver::getChipName() const {
    switch (_driverType) {
        case WEIGHT_NAU7802: return "NAU7802";
        case WEIGHT_HX711:   return "HX711";
        default:             return "None";
    }
}

void ScaleDriver::begin() {
    _weightRaw = 0;
    _weightStable = 0;
    _prevAvg = 0;
    _isStable = false;
    _connected = false;
    _driverType = WEIGHT_NONE;
    _scaleFactor = WEIGHT_CALIBRATION;
    memset(_buf, 0, sizeof(_buf));
    _bufIdx = 0;
    _bufFull = false;
    _stableCount = 0;
    _lastAutoTare = 0;
    _pauseDepth = 0;
    _running = false;
    _nauOffset = 0;

    _mutex = xSemaphoreCreateMutex();

    // Try NAU7802 on I2C first (preferred — no GPIO bit-banging)
    if (_nau.begin(Wire, true)) {
        // Keep default LDO setting from begin() — 3.0V LDO needs >3.3V DVDD
        // which isn't guaranteed on all ESP32-S3 boards
        _nau.setGain(NAU7802_GAIN_128);
        _nau.setSampleRate(NAU7802_SPS_80);
        delay(500);  // NAU7802 needs settling time after reset + config
        // Verify the sensor actually works by reading a few samples
        int goodReadings = 0;
        for (int i = 0; i < 10; i++) {
            unsigned long t = millis();
            while (!_nau.available() && millis() - t < 500) delay(1);
            if (_nau.available()) {
                _nau.getReading();
                goodReadings++;
            }
        }
        if (goodReadings >= 3) {
            _driverType = WEIGHT_NAU7802;
            _connected = true;
            // Restore tare offset from NVS (survives reboot)
            Preferences prefs;
            prefs.begin("weight", true);
            _nauOffset = prefs.getLong("nauOffset", 0);
            prefs.end();
            Serial.printf("  Weight: NAU7802 (I2C 0x%02X, %d/10 reads OK, offset=%ld)\n", NAU7802_ADDR, goodReadings, _nauOffset);
            return;
        } else {
            Serial.printf("  Weight: NAU7802 detected but not responding (%d/10 reads)\n", goodReadings);
        }
    }

    // Fall back to HX711 on GPIO (not available on touch board)
    if (HX711_SCK_PIN >= 0 && HX711_DT_PIN >= 0) {
        Serial.printf("  Weight: trying HX711 SCK=GPIO%d DT=GPIO%d\n", HX711_SCK_PIN, HX711_DT_PIN);
        _hx.begin(HX711_DT_PIN, HX711_SCK_PIN);

        if (_hx.wait_ready_timeout(1000)) {
            _driverType = WEIGHT_HX711;
            _connected = true;
            _hx.set_scale(_scaleFactor);
            Serial.println("  Weight: HX711 OK");
            return;
        }
    }

    if (!_connected) {
        Serial.println("  Weight: no ADC detected");
    }
}

void ScaleDriver::startTask(int core, int priority) {
    if (!_connected) return;
    _running = true;
    xTaskCreatePinnedToCore(taskFunc, "weight", 4096, this, priority, &_task, core);
    Serial.printf("  Weight task on Core %d (%s)\n", core, getChipName());
}

void ScaleDriver::pollOnce() {
    if (!_connected || _pauseDepth > 0) return;

    // NAU7802: periodic AFE recalibration (compensates internal drift + temperature)
    if (_driverType == WEIGHT_NAU7802) {
        unsigned long now = millis();
        if (_afeCalInProgress) {
            NAU7802_Cal_Status status = _nau.calAFEStatus();
            if (status != NAU7802_CAL_IN_PROGRESS) {
                _afeCalInProgress = false;
                Serial.printf("[Weight] AFE recal %s\n",
                    status == NAU7802_CAL_SUCCESS ? "OK" : "FAILED");
            }
            return;  // Skip readings during calibration
        }
        if (now - _lastAfeCal >= NAU7802_AFE_CAL_INTERVAL_MS) {
            _lastAfeCal = now;
            _nau.beginCalibrateAFE(NAU7802_CALMOD_INTERNAL);
            _afeCalInProgress = true;
            return;
        }
    }

    long raw = 0;
    bool gotReading = false;

    if (_driverType == WEIGHT_NAU7802) {
        if (_nau.available()) {
            raw = _nau.getReading();
            gotReading = true;
        }
    } else if (_driverType == WEIGHT_HX711 && _hx.is_ready()) {
        raw = _hx.read();
        gotReading = true;
    }
    if (gotReading) processReading(raw);
}

void ScaleDriver::taskFunc(void* param) {
    ScaleDriver* self = (ScaleDriver*)param;
    bool needI2C = (self->_driverType == WEIGHT_NAU7802);

    while (true) {
        if (self->_pauseDepth > 0) {
            vTaskDelay(pdMS_TO_TICKS(50));
            continue;
        }

        // Acquire I2C mutex for NAU7802 (HX711 uses GPIO, no mutex needed)
        // Wait up to 150ms — sensor task can hold mutex during slow color reads
        if (needI2C && (!i2cMutex || xSemaphoreTake(i2cMutex, pdMS_TO_TICKS(150)) != pdTRUE)) {
            vTaskDelay(pdMS_TO_TICKS(10));  // Short retry, don't sleep full interval
            continue;
        }

        // NAU7802: periodic AFE recalibration
        if (self->_driverType == WEIGHT_NAU7802) {
            unsigned long now = millis();
            if (self->_afeCalInProgress) {
                NAU7802_Cal_Status status = self->_nau.calAFEStatus();
                if (status != NAU7802_CAL_IN_PROGRESS) {
                    self->_afeCalInProgress = false;
                    Serial.printf("[Weight] AFE recal %s\n",
                        status == NAU7802_CAL_SUCCESS ? "OK" : "FAILED");
                }
                if (needI2C) xSemaphoreGive(i2cMutex);
                vTaskDelay(pdMS_TO_TICKS(50));
                continue;
            }
            if (now - self->_lastAfeCal >= NAU7802_AFE_CAL_INTERVAL_MS) {
                self->_lastAfeCal = now;
                self->_nau.beginCalibrateAFE(NAU7802_CALMOD_INTERNAL);
                self->_afeCalInProgress = true;
                if (needI2C) xSemaphoreGive(i2cMutex);
                vTaskDelay(pdMS_TO_TICKS(50));
                continue;
            }
        }

        long raw = 0;
        bool gotReading = false;

        if (self->_driverType == WEIGHT_NAU7802) {
            if (self->_nau.available()) {
                raw = self->_nau.getReading();
                gotReading = true;
            }
        } else if (self->_driverType == WEIGHT_HX711) {
            if (self->_hx.is_ready()) {
                raw = self->_hx.read();
                gotReading = true;
            }
        }

        if (needI2C) xSemaphoreGive(i2cMutex);

        if (gotReading) {
            self->processReading(raw);
        }
        vTaskDelay(pdMS_TO_TICKS(WEIGHT_READ_INTERVAL_MS));
    }
}

void ScaleDriver::processReading(long raw) {
    _lastRawAdc = raw;

    float weight;
    if (_driverType == WEIGHT_NAU7802) {
        weight = (float)(raw - _nauOffset) / _scaleFactor;
    } else {
        float offset = (float)_hx.get_offset();
        weight = (float)(raw - offset) / _scaleFactor;
    }

    // Validate
    if (weight < WEIGHT_MIN_VALID || weight > WEIGHT_MAX_VALID) return;

    // Moving average
    _buf[_bufIdx] = weight;
    _bufIdx = (_bufIdx + 1) % WEIGHT_SAMPLES;
    if (!_bufFull && _bufIdx == 0) _bufFull = true;

    int count = _bufFull ? WEIGHT_SAMPLES : _bufIdx;
    if (count == 0) return;

    float sum = 0;
    for (int i = 0; i < count; i++) sum += _buf[i];
    float avg = sum / count;

    // Stability check
    float delta = fabs(avg - _prevAvg);
    if (delta < WEIGHT_STABLE_THRESHOLD) {
        _stableCount++;
    } else {
        _stableCount = 0;
    }
    _prevAvg = avg;

    bool stable = (_stableCount >= WEIGHT_STABLE_COUNT);

    if (xSemaphoreTake(_mutex, pdMS_TO_TICKS(10))) {
        _weightRaw = avg;
        _isStable = stable;
        if (stable) _weightStable = avg;
        xSemaphoreGive(_mutex);
    }

    checkAutoTare();
}

void ScaleDriver::checkAutoTare() {
    // Disabled: auto-tare caused confusing UX where lightweight items on the
    // platform would silently get zeroed. Users should tare manually.
    (void)0;
}

// Thread-safe getters
float ScaleDriver::getWeight() {
    float w = 0;
    if (xSemaphoreTake(_mutex, pdMS_TO_TICKS(10))) {
        w = _weightRaw;
        xSemaphoreGive(_mutex);
    }
    return w;
}

float ScaleDriver::getStableWeight() {
    float w = 0;
    if (xSemaphoreTake(_mutex, pdMS_TO_TICKS(10))) {
        w = _weightStable;
        xSemaphoreGive(_mutex);
    }
    return w;
}

bool ScaleDriver::isStable() {
    bool s = false;
    if (xSemaphoreTake(_mutex, pdMS_TO_TICKS(10))) {
        s = _isStable;
        xSemaphoreGive(_mutex);
    }
    return s;
}

void ScaleDriver::getSnapshot(float& weight, float& stableWeight, bool& stable) {
    if (xSemaphoreTake(_mutex, pdMS_TO_TICKS(10))) {
        weight = _weightRaw;
        stableWeight = _weightStable;
        stable = _isStable;
        xSemaphoreGive(_mutex);
    }
}

bool ScaleDriver::isConnected() { return _connected; }
float ScaleDriver::getScaleFactor() { return _scaleFactor; }
long  ScaleDriver::getLastRawAdc()  { return _lastRawAdc; }

void ScaleDriver::tare(uint8_t samples) {
    if (!_connected) return;
    if (_driverType == WEIGHT_NAU7802) {
        // Average N readings to get offset
        int32_t sum = 0;
        int count = 0;
        for (uint8_t i = 0; i < samples; i++) {
            unsigned long start = millis();
            while (!_nau.available() && millis() - start < 200) delay(1);
            if (_nau.available()) {
                sum += _nau.getReading();
                count++;
            }
        }
        if (count > 0) {
            _nauOffset = sum / count;
            // Persist tare offset to NVS so it survives reboot
            Preferences prefs;
            prefs.begin("weight", false);
            prefs.putLong("nauOffset", _nauOffset);
            prefs.end();
        }
    } else {
        _hx.tare(samples);
    }

    // Reset moving average buffer so old pre-tare readings don't pollute output
    memset(_buf, 0, sizeof(_buf));
    _bufIdx = 0;
    _bufFull = false;
    _stableCount = 0;
    _prevAvg = 0;
    if (xSemaphoreTake(_mutex, pdMS_TO_TICKS(50))) {
        _weightRaw = 0;
        _weightStable = 0;
        _isStable = false;
        xSemaphoreGive(_mutex);
    }
}

void ScaleDriver::setScale(float factor) {
    _scaleFactor = factor;
    if (_driverType == WEIGHT_HX711) {
        _hx.set_scale(factor);
    }
}

void ScaleDriver::pauseTask() { _pauseDepth++; }
void ScaleDriver::resumeTask() { if (_pauseDepth > 0) _pauseDepth--; }

double ScaleDriver::getValueForCalibration(uint8_t samples) {
    if (!_connected) return 0;
    if (_driverType == WEIGHT_NAU7802) {
        double sum = 0;
        int count = 0;
        for (uint8_t i = 0; i < samples; i++) {
            unsigned long start = millis();
            while (!_nau.available() && millis() - start < 200) delay(1);
            if (_nau.available()) {
                sum += _nau.getReading();
                count++;
            }
        }
        return count > 0 ? (sum / count) - _nauOffset : 0;
    }
    return _hx.get_value(samples);
}

void ScaleDriver::printStatus() {
    Serial.printf("=== Weight ===\n");
    Serial.printf("  Driver: %s\n", getChipName());
    Serial.printf("  Connected: %s\n", _connected ? "YES" : "no");
    if (_connected) {
        Serial.printf("  Weight: %.1fg (stable: %.1fg) %s\n",
            getWeight(), getStableWeight(), isStable() ? "[STABLE]" : "");
        Serial.printf("  Scale factor: %.4f\n", _scaleFactor);
    }
}
