#include "turntable.h"

Turntable turntable;

void Turntable::begin() {
    _connected = false;
    _homed = false;
    _enabled = false;
    _currentAngle = 0;
    _currentStep = 0;
    _targetStep = 0;
    _moving = false;
    _stepDir = 1;
    _lastStepUs = 0;

    // Calculate step interval from RPM
    long stepsPerRev = (long)STEPPER_STEPS_REV * STEPPER_MICROSTEPS;
    float revsPerSec = STEPPER_RPM / 60.0f;
    float stepsPerSec = stepsPerRev * revsPerSec;
    _stepIntervalUs = (unsigned long)(1000000.0f / stepsPerSec);

    pinMode(STEPPER_STEP_PIN, OUTPUT);
    pinMode(STEPPER_DIR_PIN, OUTPUT);
    pinMode(STEPPER_ENABLE_PIN, OUTPUT);
    pinMode(STEPPER_HOME_PIN, INPUT_PULLUP);

    digitalWrite(STEPPER_STEP_PIN, LOW);
    digitalWrite(STEPPER_DIR_PIN, LOW);
    digitalWrite(STEPPER_ENABLE_PIN, HIGH);  // HIGH = disabled (active LOW)

    // Check if home sensor is wired (reads LOW when triggered)
    // Just mark as connected — actual homing happens on demand
    _connected = true;
    Serial.printf("  Turntable: STEP=GPIO%d, DIR=GPIO%d, HOME=GPIO%d\n",
        STEPPER_STEP_PIN, STEPPER_DIR_PIN, STEPPER_HOME_PIN);
    Serial.printf("  Step interval: %luus (%d RPM, %ld steps/rev)\n",
        _stepIntervalUs, STEPPER_RPM, stepsPerRev);
}

void Turntable::enable() {
    digitalWrite(STEPPER_ENABLE_PIN, LOW);  // Active LOW
    _enabled = true;
}

void Turntable::disable() {
    digitalWrite(STEPPER_ENABLE_PIN, HIGH);
    _enabled = false;
}

// ==================== Blocking Rotation ====================

void Turntable::home() {
    if (!_connected) return;
    enable();

    // Rotate forward until hall sensor triggers (active LOW)
    digitalWrite(STEPPER_DIR_PIN, HIGH);
    long stepsPerRev = (long)STEPPER_STEPS_REV * STEPPER_MICROSTEPS;
    long maxSteps = stepsPerRev * 2;  // Max 2 full revolutions to find home

    for (long i = 0; i < maxSteps; i++) {
        if (digitalRead(STEPPER_HOME_PIN) == LOW) {
            _homed = true;
            _currentStep = 0;
            _currentAngle = 0;
            Serial.println("  Turntable: homed");
            return;
        }
        doStep();
        delayMicroseconds(_stepIntervalUs);
    }

    Serial.println("  Turntable: home sensor not found (no hall sensor?)");
    // Still usable without homing — just no absolute position reference
    _currentStep = 0;
    _currentAngle = 0;
}

void Turntable::rotateDegrees(float degrees) {
    if (!_connected) return;
    enable();

    long steps = degreesToSteps(fabs(degrees));
    digitalWrite(STEPPER_DIR_PIN, degrees >= 0 ? HIGH : LOW);

    for (long i = 0; i < steps; i++) {
        doStep();
        delayMicroseconds(_stepIntervalUs);
    }

    _currentStep += (degrees >= 0 ? steps : -steps);
    _currentAngle = stepsToDegrees(_currentStep);
    // Normalize to 0-360
    while (_currentAngle < 0) _currentAngle += 360.0f;
    while (_currentAngle >= 360.0f) _currentAngle -= 360.0f;
}

void Turntable::rotateTo(float angleDeg) {
    float delta = angleDeg - _currentAngle;
    // Take shortest path
    if (delta > 180.0f) delta -= 360.0f;
    if (delta < -180.0f) delta += 360.0f;
    rotateDegrees(delta);
}

void Turntable::fullRotation() {
    rotateDegrees(360.0f);
}

// ==================== Non-Blocking Rotation ====================

void Turntable::startRotation(float degrees) {
    if (!_connected) return;
    enable();

    long steps = degreesToSteps(fabs(degrees));
    _stepDir = (degrees >= 0) ? 1 : -1;
    _targetStep = _currentStep + (_stepDir * steps);
    _moving = true;
    _lastStepUs = micros();

    digitalWrite(STEPPER_DIR_PIN, _stepDir > 0 ? HIGH : LOW);
}

bool Turntable::stepIfNeeded() {
    if (!_moving) return false;

    unsigned long now = micros();
    if (now - _lastStepUs >= _stepIntervalUs) {
        _lastStepUs = now;
        doStep();
        _currentStep += _stepDir;

        if ((_stepDir > 0 && _currentStep >= _targetStep) ||
            (_stepDir < 0 && _currentStep <= _targetStep)) {
            _moving = false;
            _currentAngle = stepsToDegrees(_currentStep);
            while (_currentAngle < 0) _currentAngle += 360.0f;
            while (_currentAngle >= 360.0f) _currentAngle -= 360.0f;
            return false;
        }
        return true;
    }
    return true;  // Still moving, just not time to step yet
}

void Turntable::stop() {
    _moving = false;
    _currentAngle = stepsToDegrees(_currentStep);
    while (_currentAngle < 0) _currentAngle += 360.0f;
    while (_currentAngle >= 360.0f) _currentAngle -= 360.0f;
}

// ==================== Getters ====================

float Turntable::getAngle() { return _currentAngle; }
bool  Turntable::isHomed() { return _homed; }
bool  Turntable::isMoving() { return _moving; }
bool  Turntable::isConnected() { return _connected; }

// ==================== Helpers ====================

void Turntable::doStep() {
    digitalWrite(STEPPER_STEP_PIN, HIGH);
    delayMicroseconds(2);  // Minimum pulse width for A4988
    digitalWrite(STEPPER_STEP_PIN, LOW);
}

long Turntable::degreesToSteps(float deg) {
    long stepsPerRev = (long)STEPPER_STEPS_REV * STEPPER_MICROSTEPS;
    return (long)(deg / 360.0f * stepsPerRev);
}

float Turntable::stepsToDegrees(long steps) {
    long stepsPerRev = (long)STEPPER_STEPS_REV * STEPPER_MICROSTEPS;
    return (float)steps / stepsPerRev * 360.0f;
}

void Turntable::printStatus() {
    Serial.println("=== Turntable ===");
    Serial.printf("  Connected: %s\n", _connected ? "YES" : "no");
    if (_connected) {
        Serial.printf("  Homed: %s\n", _homed ? "YES" : "no");
        Serial.printf("  Angle: %.1f°\n", _currentAngle);
        Serial.printf("  Moving: %s\n", _moving ? "YES" : "no");
        Serial.printf("  Enabled: %s\n", _enabled ? "YES" : "no");
    }
}
