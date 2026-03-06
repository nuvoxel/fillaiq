#pragma once

#include <Arduino.h>
#include "scan_config.h"

// ============================================================
// Filla IQ — Scan Station WS2812B LED Ring
// Under-platform backlight for color sensing and status indication.
// ============================================================

enum LedMode : uint8_t {
    LED_OFF = 0,
    LED_WHITE,          // Uniform white backlight (for color sensing)
    LED_COLOR,          // Solid color (status indication)
    LED_PULSE,          // Breathing pulse (scanning)
    LED_SPIN,           // Rotating animation (processing)
    LED_RAINBOW,        // Rainbow cycle (idle/attract)
};

class Backlight {
public:
    void begin();

    void off();
    void white(uint8_t brightness = 255);   // Uniform white for color sensor
    void color(uint8_t r, uint8_t g, uint8_t b, uint8_t brightness = 255);
    void pulse(uint8_t r, uint8_t g, uint8_t b);   // Breathing effect
    void spin(uint8_t r, uint8_t g, uint8_t b);    // Rotating dot
    void rainbow();

    // Status shortcuts
    void idle();        // Dim white or rainbow
    void scanning();    // Yellow pulse
    void success();     // Green solid
    void needsInput();  // Yellow solid
    void error();       // Red solid

    void update();      // Call from loop for animations
    void setBrightness(uint8_t b);

    void printStatus();

private:
    LedMode _mode;
    uint8_t _r, _g, _b;
    uint8_t _brightness;
    unsigned long _lastUpdate;
    uint16_t _animStep;
};

extern Backlight backlight;
