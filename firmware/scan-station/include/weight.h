#pragma once

#include <Arduino.h>
#include <HX711.h>
#include "scan_config.h"

// ============================================================
// Filla IQ — Scan Station Single-Channel Weight Driver
// Adapted from slot-module hx711_multi for single load cell.
// Weight reading on Core 1 via FreeRTOS task.
// ============================================================

class ScaleDriver {
public:
    void begin();
    void startTask(int core = 1, int priority = 2);

    void tare(uint8_t samples = WEIGHT_TARE_SAMPLES);
    void setScale(float factor);

    // Thread-safe reads (called from core 0)
    float getWeight();
    float getStableWeight();
    bool  isStable();
    bool  isConnected();
    long  getOffset();
    float getScaleFactor();

    // Calibration
    double getValueForCalibration(uint8_t samples = 20);
    void pauseTask();
    void resumeTask();

    void printStatus();

private:
    HX711 _hx;
    SemaphoreHandle_t _mutex;
    TaskHandle_t _task;
    volatile bool _running;
    volatile int _pauseDepth;

    // Filtered weight
    float _weightRaw;
    float _weightStable;
    float _prevAvg;
    bool  _isStable;
    bool  _connected;
    float _scaleFactor;

    // Moving average
    float _buf[WEIGHT_SAMPLES];
    int   _bufIdx;
    bool  _bufFull;
    int   _stableCount;

    // Auto-tare
    unsigned long _lastAutoTare;

    void processReading(long raw);
    void checkAutoTare();

    static void taskFunc(void* param);
};

extern ScaleDriver scale;
