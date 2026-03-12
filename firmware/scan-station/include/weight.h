#pragma once

#include <Arduino.h>
#include <HX711.h>
#include <SparkFun_Qwiic_Scale_NAU7802_Arduino_Library.h>
#include "scan_config.h"

// ============================================================
// Filla IQ — Weight Driver (NAU7802 I2C or HX711 GPIO)
// Auto-detects NAU7802 on I2C, falls back to HX711 on GPIO.
// Weight reading on dedicated core via FreeRTOS task.
// ============================================================

enum WeightDriverType : uint8_t {
    WEIGHT_NONE = 0,
    WEIGHT_NAU7802,     // I2C 24-bit ADC (preferred)
    WEIGHT_HX711,       // GPIO bit-bang 24-bit ADC
};

class ScaleDriver {
public:
    void begin();
    void startTask(int core = 1, int priority = 2);

    void tare(uint8_t samples = WEIGHT_TARE_SAMPLES);
    void setScale(float factor);

    // Thread-safe reads (called from main loop)
    float getWeight();
    float getStableWeight();
    bool  isStable();
    bool  isConnected();
    float getScaleFactor();

    WeightDriverType getDriverType() const { return _driverType; }
    const char* getChipName() const;

    // Calibration
    double getValueForCalibration(uint8_t samples = 20);
    void pauseTask();
    void resumeTask();

    void printStatus();

private:
    WeightDriverType _driverType = WEIGHT_NONE;
    HX711 _hx;
    NAU7802 _nau;
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

    // NAU7802 offset (stored separately since library doesn't have get_offset)
    int32_t _nauOffset;

    void processReading(long raw);
    void checkAutoTare();

    static void taskFunc(void* param);
};

extern ScaleDriver scale;
