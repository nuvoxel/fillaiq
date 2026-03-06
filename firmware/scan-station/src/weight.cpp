#include "weight.h"

ScaleDriver scale;

void ScaleDriver::begin() {
    _weightRaw = 0;
    _weightStable = 0;
    _prevAvg = 0;
    _isStable = false;
    _connected = false;
    _scaleFactor = WEIGHT_CALIBRATION;
    memset(_buf, 0, sizeof(_buf));
    _bufIdx = 0;
    _bufFull = false;
    _stableCount = 0;
    _lastAutoTare = 0;
    _pauseDepth = 0;
    _running = false;

    _mutex = xSemaphoreCreateMutex();

    Serial.printf("HX711: SCK=GPIO%d, DT=GPIO%d\n", HX711_SCK_PIN, HX711_DT_PIN);
    _hx.begin(HX711_DT_PIN, HX711_SCK_PIN);

    if (_hx.wait_ready_timeout(1000)) {
        _connected = true;
        _hx.set_scale(_scaleFactor);
        Serial.println("  HX711: OK");
    } else {
        Serial.println("  HX711: NOT DETECTED");
    }
}

void ScaleDriver::startTask(int core, int priority) {
    if (!_connected) return;
    _running = true;
    xTaskCreatePinnedToCore(taskFunc, "weight", 4096, this, priority, &_task, core);
    Serial.printf("  Weight task started on Core %d\n", core);
}

void ScaleDriver::taskFunc(void* param) {
    ScaleDriver* self = (ScaleDriver*)param;
    while (true) {
        if (self->_pauseDepth > 0) {
            vTaskDelay(pdMS_TO_TICKS(50));
            continue;
        }
        if (self->_connected && self->_hx.is_ready()) {
            long raw = self->_hx.read();
            self->processReading(raw);
        }
        vTaskDelay(pdMS_TO_TICKS(WEIGHT_READ_INTERVAL_MS));
    }
}

void ScaleDriver::processReading(long raw) {
    float offset = (float)_hx.get_offset();
    float weight = (float)(raw - offset) / _scaleFactor;

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
    unsigned long now = millis();
    float w = _weightRaw;

    if (_isStable && fabs(w) > 3.0f && fabs(w) < 50.0f &&
        now - _lastAutoTare > 30000) {
        _hx.tare(WEIGHT_TARE_SAMPLES);
        _lastAutoTare = now;
    }
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

bool ScaleDriver::isConnected() { return _connected; }
long ScaleDriver::getOffset() { return _hx.get_offset(); }
float ScaleDriver::getScaleFactor() { return _scaleFactor; }

void ScaleDriver::tare(uint8_t samples) {
    if (!_connected) return;
    _hx.tare(samples);
}

void ScaleDriver::setScale(float factor) {
    _scaleFactor = factor;
    _hx.set_scale(factor);
}

void ScaleDriver::pauseTask() { _pauseDepth++; }
void ScaleDriver::resumeTask() { if (_pauseDepth > 0) _pauseDepth--; }

double ScaleDriver::getValueForCalibration(uint8_t samples) {
    if (!_connected) return 0;
    return _hx.get_value(samples);
}

void ScaleDriver::printStatus() {
    Serial.printf("=== Weight ===\n");
    Serial.printf("  Connected: %s\n", _connected ? "YES" : "no");
    if (_connected) {
        Serial.printf("  Weight: %.1fg (stable: %.1fg) %s\n",
            getWeight(), getStableWeight(), isStable() ? "[STABLE]" : "");
        Serial.printf("  Scale factor: %.4f\n", _scaleFactor);
    }
}
