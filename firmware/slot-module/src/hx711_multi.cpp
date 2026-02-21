#include "hx711_multi.h"

// Global instance
HX711Multi scales;

// Pin tables
static const uint8_t sck_pins[] = { HX711_SCK_PIN_0, HX711_SCK_PIN_1 };
static const uint8_t dt_pins[]  = { HX711_DT_PIN_0,  HX711_DT_PIN_1  };

// ==================== Initialization ====================

void HX711Multi::begin() {
    _task_handle = NULL;
    _task_running = false;
    _pause_depth = 0;
    _data_mutex = xSemaphoreCreateMutex();

    Serial.printf("HX711Multi: %d independent channels\n", HX711_NUM_CHANNELS);

    for (uint8_t ch = 0; ch < HX711_NUM_CHANNELS; ch++) {
        _channels[ch].clear();
        _channels[ch].hx.begin(dt_pins[ch], sck_pins[ch]);

        Serial.printf("  CH%d: DT=GPIO%d SCK=GPIO%d ", ch, dt_pins[ch], sck_pins[ch]);

        // Detect: wait up to 1s for HX711 to be ready
        unsigned long start = millis();
        while (!_channels[ch].hx.is_ready() && millis() - start < 1000) {
            delay(10);
        }

        if (_channels[ch].hx.is_ready()) {
            _channels[ch].connected = true;
            // Flush a few reads to stabilize gain
            for (int i = 0; i < 5; i++) {
                _channels[ch].hx.read();
                delay(100);
            }
            Serial.println("OK");
        } else {
            _channels[ch].connected = false;
            Serial.println("not detected");
        }
    }
}

// ==================== FreeRTOS Task ====================

void HX711Multi::startTask(int core, int priority) {
    xTaskCreatePinnedToCore(
        taskFunc,
        "hx711",
        4096,
        this,
        priority,
        &_task_handle,
        core
    );
    _task_running = true;
    Serial.printf("HX711Multi: task started on core %d\n", core);
}

void HX711Multi::taskFunc(void* param) {
    HX711Multi* self = (HX711Multi*)param;

    while (true) {
        for (uint8_t ch = 0; ch < HX711_NUM_CHANNELS; ch++) {
            if (!self->_channels[ch].connected) continue;

            if (self->_channels[ch].hx.is_ready()) {
                long raw = self->_channels[ch].hx.read();

                xSemaphoreTake(self->_data_mutex, portMAX_DELAY);
                self->processReading(ch, raw);
                xSemaphoreGive(self->_data_mutex);

                self->checkAutoTare(ch);
            }
        }

        vTaskDelay(pdMS_TO_TICKS(80));
    }
}

// ==================== Signal Processing ====================

void HX711Multi::processReading(uint8_t ch, long raw) {
    ScaleChannel& s = _channels[ch];

    float units = (float)(raw - s.hx.get_offset()) / s.scale_factor;

    if (units < WEIGHT_MIN_VALID || units > WEIGHT_MAX_VALID) {
        return;
    }

    // Moving average
    s.buffer[s.buffer_idx] = units;
    s.buffer_idx = (s.buffer_idx + 1) % WEIGHT_SAMPLES;
    if (s.buffer_idx == 0) s.buffer_full = true;

    int count = s.buffer_full ? WEIGHT_SAMPLES : s.buffer_idx;
    float sum = 0;
    for (int i = 0; i < count; i++) sum += s.buffer[i];
    float avg = (count > 0) ? sum / count : 0;

    // Stability detection
    float delta = abs(avg - s.weight_prev_avg);
    s.weight_prev_avg = avg;

    if (delta < WEIGHT_STABLE_THRESHOLD) {
        s.stable_count++;
        if (s.stable_count >= WEIGHT_STABLE_COUNT) {
            s.weight_is_stable = true;
            s.weight_stable = avg;
        }
    } else {
        s.stable_count = 0;
        s.weight_is_stable = false;
    }

    s.weight_raw = avg;
}

void HX711Multi::checkAutoTare(uint8_t ch) {
    ScaleChannel& s = _channels[ch];
    unsigned long now = millis();

    if (s.weight_is_stable
        && abs(s.weight_stable) < SPOOL_PRESENT_THRESHOLD
        && abs(s.weight_stable) > AUTO_TARE_DEADBAND
        && now - s.last_auto_tare >= AUTO_TARE_INTERVAL) {

        float drift = s.weight_stable;

        // Inline tare — we ARE the task, can't call pauseTask()
        if (s.hx.is_ready()) {
            s.hx.tare(WEIGHT_TARE_SAMPLES);

            xSemaphoreTake(_data_mutex, portMAX_DELAY);
            s.buffer_full = false;
            s.buffer_idx = 0;
            s.weight_raw = 0;
            s.weight_stable = 0;
            s.weight_prev_avg = 0;
            s.stable_count = 0;
            s.weight_is_stable = false;
            xSemaphoreGive(_data_mutex);
        }

        s.last_auto_tare = now;
        Serial.printf("CH%d auto-tare (drift was %.1fg)\n", ch, drift);
    }
}

// ==================== Task Control ====================

void HX711Multi::pauseTask() {
    if (_task_handle && _task_running) {
        if (_pause_depth == 0) {
            vTaskSuspend(_task_handle);
        }
        _pause_depth++;
    }
}

void HX711Multi::resumeTask() {
    if (_task_handle && _task_running && _pause_depth > 0) {
        _pause_depth--;
        if (_pause_depth == 0) {
            vTaskResume(_task_handle);
        }
    }
}

// ==================== Tare & Calibration ====================

void HX711Multi::tare(uint8_t ch, uint8_t samples) {
    if (ch >= HX711_NUM_CHANNELS || !_channels[ch].connected) return;

    pauseTask();

    _channels[ch].hx.tare(samples);

    xSemaphoreTake(_data_mutex, portMAX_DELAY);
    ScaleChannel& s = _channels[ch];
    s.buffer_full = false;
    s.buffer_idx = 0;
    s.weight_raw = 0;
    s.weight_stable = 0;
    s.weight_prev_avg = 0;
    s.stable_count = 0;
    s.weight_is_stable = false;
    xSemaphoreGive(_data_mutex);

    resumeTask();
}

void HX711Multi::tareAll(uint8_t samples) {
    pauseTask();

    for (uint8_t ch = 0; ch < HX711_NUM_CHANNELS; ch++) {
        if (!_channels[ch].connected) continue;

        _channels[ch].hx.tare(samples);

        xSemaphoreTake(_data_mutex, portMAX_DELAY);
        ScaleChannel& s = _channels[ch];
        s.buffer_full = false;
        s.buffer_idx = 0;
        s.weight_raw = 0;
        s.weight_stable = 0;
        s.weight_prev_avg = 0;
        s.stable_count = 0;
        s.weight_is_stable = false;
        xSemaphoreGive(_data_mutex);
    }

    resumeTask();
}

void HX711Multi::setScale(uint8_t ch, float factor) {
    if (ch >= HX711_NUM_CHANNELS) return;
    xSemaphoreTake(_data_mutex, portMAX_DELAY);
    _channels[ch].scale_factor = factor;
    xSemaphoreGive(_data_mutex);
}

void HX711Multi::setScaleAll(float factor) {
    xSemaphoreTake(_data_mutex, portMAX_DELAY);
    for (uint8_t ch = 0; ch < HX711_NUM_CHANNELS; ch++) {
        _channels[ch].scale_factor = factor;
    }
    xSemaphoreGive(_data_mutex);
}

// ==================== Thread-Safe Getters ====================

float HX711Multi::getWeight(uint8_t ch) {
    if (ch >= HX711_NUM_CHANNELS) return 0;
    xSemaphoreTake(_data_mutex, portMAX_DELAY);
    float w = _channels[ch].weight_raw;
    xSemaphoreGive(_data_mutex);
    return w;
}

float HX711Multi::getStableWeight(uint8_t ch) {
    if (ch >= HX711_NUM_CHANNELS) return 0;
    xSemaphoreTake(_data_mutex, portMAX_DELAY);
    float w = _channels[ch].weight_stable;
    xSemaphoreGive(_data_mutex);
    return w;
}

bool HX711Multi::isStable(uint8_t ch) {
    if (ch >= HX711_NUM_CHANNELS) return false;
    xSemaphoreTake(_data_mutex, portMAX_DELAY);
    bool s = _channels[ch].weight_is_stable;
    xSemaphoreGive(_data_mutex);
    return s;
}

bool HX711Multi::isConnected(uint8_t ch) {
    if (ch >= HX711_NUM_CHANNELS) return false;
    return _channels[ch].connected;
}

long HX711Multi::getRawValue(uint8_t ch) {
    if (ch >= HX711_NUM_CHANNELS) return 0;
    return _channels[ch].hx.read();
}

long HX711Multi::getOffset(uint8_t ch) {
    if (ch >= HX711_NUM_CHANNELS) return 0;
    return _channels[ch].hx.get_offset();
}

float HX711Multi::getScaleFactor(uint8_t ch) {
    if (ch >= HX711_NUM_CHANNELS) return 0;
    return _channels[ch].scale_factor;
}

double HX711Multi::getValueForCalibration(uint8_t ch, uint8_t samples) {
    if (ch >= HX711_NUM_CHANNELS || !_channels[ch].connected) return 0;

    pauseTask();

    long sum = 0;
    int good_reads = 0;

    for (uint8_t i = 0; i < samples; i++) {
        if (_channels[ch].hx.wait_ready_timeout(200)) {
            sum += _channels[ch].hx.read();
            good_reads++;
        }
        vTaskDelay(pdMS_TO_TICKS(10));
    }

    resumeTask();

    if (good_reads == 0) return 0;
    return (double)(sum / good_reads) - (double)_channels[ch].hx.get_offset();
}

// ==================== Diagnostics ====================

void HX711Multi::printStatus(uint8_t ch) {
    if (ch >= HX711_NUM_CHANNELS) return;

    xSemaphoreTake(_data_mutex, portMAX_DELAY);
    ScaleChannel s = _channels[ch];  // Copy under mutex
    xSemaphoreGive(_data_mutex);

    Serial.printf("=== CH%d Status ===\n", ch);
    Serial.printf("  Connected: %s\n", s.connected ? "YES" : "no");
    Serial.printf("  Weight (avg): %.1fg\n", s.weight_raw);
    Serial.printf("  Weight (stable): %.1fg\n", s.weight_stable);
    Serial.printf("  Stable: %s\n", s.weight_is_stable ? "YES" : "no");
    Serial.printf("  Offset: %ld\n", s.hx.get_offset());
    Serial.printf("  Scale: %.4f\n", s.scale_factor);
}

void HX711Multi::printStatusAll() {
    for (uint8_t ch = 0; ch < HX711_NUM_CHANNELS; ch++) {
        if (_channels[ch].connected) {
            printStatus(ch);
        }
    }
}

void HX711Multi::printRawDiag(uint8_t ch, int count) {
    if (ch >= HX711_NUM_CHANNELS) return;

    pauseTask();

    Serial.printf("=== CH%d Raw Diagnostics ===\n", ch);
    Serial.printf("  DT=GPIO%d SCK=GPIO%d\n", dt_pins[ch], sck_pins[ch]);

    for (int i = 0; i < count; i++) {
        if (_channels[ch].hx.wait_ready_timeout(200)) {
            long raw = _channels[ch].hx.read();
            float units = (float)(raw - _channels[ch].hx.get_offset()) / _channels[ch].scale_factor;
            Serial.printf("  [%d] raw=%ld  units=%.2fg\n", i, raw, units);
        } else {
            Serial.printf("  [%d] not ready\n", i);
        }
        vTaskDelay(pdMS_TO_TICKS(100));
    }

    resumeTask();
}
