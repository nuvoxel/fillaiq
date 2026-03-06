#pragma once

#include <Arduino.h>
#include "scan_config.h"

// ============================================================
// Filla IQ — Scan Station Turntable Driver
// A4988/TMC2209 stepper driver for rotating objects during scan.
// Enables: multi-angle color, 360° barcode reading, NFC search.
// ============================================================

class Turntable {
public:
    void begin();

    // Blocking rotation (call from loop, yields via delay)
    void home();                        // Rotate until hall sensor triggers
    void rotateDegrees(float degrees);  // Relative rotation
    void rotateTo(float angleDeg);      // Absolute position (0-360)
    void fullRotation();                // One complete revolution

    // Non-blocking step (call repeatedly from loop)
    void startRotation(float degrees);
    bool stepIfNeeded();    // Returns true if still moving
    void stop();

    float getAngle();
    bool  isHomed();
    bool  isMoving();
    bool  isConnected();

    void enable();
    void disable();         // De-energize motor (saves power, loses position)

    void printStatus();

private:
    bool  _connected;
    bool  _homed;
    bool  _enabled;
    float _currentAngle;    // Degrees (0-360)
    long  _currentStep;     // Absolute step position

    // Non-blocking state
    long  _targetStep;
    bool  _moving;
    int   _stepDir;         // +1 or -1
    unsigned long _lastStepUs;
    unsigned long _stepIntervalUs;

    long degreesToSteps(float deg);
    float stepsToDegrees(long steps);
    void doStep();
};

extern Turntable turntable;
