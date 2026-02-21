#pragma once

#include <Arduino.h>
#include <HX711.h>
#include "config.h"

// ============================================================
// Filla IQ — 2-Channel HX711 Driver (bogde/HX711 wrapper)
// Each channel has independent SCK + DT pins.
// Runs on ESP32-S3 Core 1 via FreeRTOS task.
// ============================================================

struct ScaleChannel {
    HX711 hx;

    // Filtered weight
    float weight_raw;          // Moving average
    float weight_stable;       // Last confirmed stable reading
    float weight_prev_avg;     // Previous average (for stability comparison)
    bool  weight_is_stable;

    // Moving average buffer
    float buffer[WEIGHT_SAMPLES];
    int   buffer_idx;
    bool  buffer_full;
    int   stable_count;

    // Channel state
    bool  connected;
    float scale_factor;

    // Auto-tare
    unsigned long last_auto_tare;

    void clear() {
        weight_raw = 0;
        weight_stable = 0;
        weight_prev_avg = 0;
        weight_is_stable = false;
        memset(buffer, 0, sizeof(buffer));
        buffer_idx = 0;
        buffer_full = false;
        stable_count = 0;
        connected = false;
        scale_factor = WEIGHT_CALIBRATION;
        last_auto_tare = 0;
    }
};

class HX711Multi {
public:
    void begin();
    void startTask(int core = 1, int priority = 2);

    // Per-channel operations
    void tare(uint8_t ch, uint8_t samples = WEIGHT_TARE_SAMPLES);
    void tareAll(uint8_t samples = WEIGHT_TARE_SAMPLES);
    void setScale(uint8_t ch, float factor);
    void setScaleAll(float factor);

    // Thread-safe reads (called from core 0 / main loop)
    float    getWeight(uint8_t ch);
    float    getStableWeight(uint8_t ch);
    bool     isStable(uint8_t ch);
    bool     isConnected(uint8_t ch);
    long     getRawValue(uint8_t ch);
    long     getOffset(uint8_t ch);
    float    getScaleFactor(uint8_t ch);
    uint8_t  getNumChannels() { return HX711_NUM_CHANNELS; }

    // Diagnostics
    void printStatus(uint8_t ch);
    void printStatusAll();
    void printRawDiag(uint8_t ch, int count = 10);

    // Calibration helper: returns raw - offset averaged over N samples
    double getValueForCalibration(uint8_t ch, uint8_t samples = 20);

    // Task control (pause for tare/calibration, nest-safe)
    void pauseTask();
    void resumeTask();

private:
    ScaleChannel _channels[HX711_NUM_CHANNELS];
    SemaphoreHandle_t _data_mutex;

    TaskHandle_t _task_handle;
    volatile bool _task_running;
    volatile int _pause_depth;

    void processReading(uint8_t ch, long raw);
    void checkAutoTare(uint8_t ch);

    static void taskFunc(void* param);
};

extern HX711Multi scales;
