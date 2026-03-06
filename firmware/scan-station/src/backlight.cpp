#include "backlight.h"
#include <Adafruit_NeoPixel.h>

Backlight backlight;

static Adafruit_NeoPixel strip(LED_COUNT, LED_PIN, NEO_GRB + NEO_KHZ800);

void Backlight::begin() {
    _mode = LED_OFF;
    _r = _g = _b = 0;
    _brightness = 60;
    _lastUpdate = 0;
    _animStep = 0;

    strip.begin();
    strip.setBrightness(_brightness);
    strip.clear();
    strip.show();

    Serial.printf("  Backlight: %d LEDs on GPIO%d\n", LED_COUNT, LED_PIN);
}

void Backlight::off() {
    _mode = LED_OFF;
    strip.clear();
    strip.show();
}

void Backlight::white(uint8_t brightness) {
    _mode = LED_WHITE;
    strip.setBrightness(brightness);
    for (int i = 0; i < LED_COUNT; i++) {
        strip.setPixelColor(i, strip.Color(255, 255, 255));
    }
    strip.show();
}

void Backlight::color(uint8_t r, uint8_t g, uint8_t b, uint8_t brightness) {
    _mode = LED_COLOR;
    _r = r; _g = g; _b = b;
    strip.setBrightness(brightness);
    for (int i = 0; i < LED_COUNT; i++) {
        strip.setPixelColor(i, strip.Color(r, g, b));
    }
    strip.show();
}

void Backlight::pulse(uint8_t r, uint8_t g, uint8_t b) {
    _mode = LED_PULSE;
    _r = r; _g = g; _b = b;
    _animStep = 0;
}

void Backlight::spin(uint8_t r, uint8_t g, uint8_t b) {
    _mode = LED_SPIN;
    _r = r; _g = g; _b = b;
    _animStep = 0;
}

void Backlight::rainbow() {
    _mode = LED_RAINBOW;
    _animStep = 0;
}

// Status shortcuts
void Backlight::idle()       { color(20, 20, 30, 30); }
void Backlight::scanning()   { pulse(255, 200, 0); }
void Backlight::success()    { color(0, 255, 0, 120); }
void Backlight::needsInput() { color(255, 200, 0, 120); }
void Backlight::error()      { color(255, 0, 0, 120); }

void Backlight::setBrightness(uint8_t b) {
    _brightness = b;
    strip.setBrightness(b);
    strip.show();
}

void Backlight::update() {
    unsigned long now = millis();
    if (now - _lastUpdate < 30) return;  // ~33fps
    _lastUpdate = now;

    switch (_mode) {
        case LED_PULSE: {
            // Sine wave breathing 0-255
            float phase = (float)_animStep / 100.0f * 3.14159f * 2.0f;
            uint8_t bright = (uint8_t)((sin(phase) + 1.0f) * 0.5f * 200.0f + 20.0f);
            strip.setBrightness(bright);
            for (int i = 0; i < LED_COUNT; i++) {
                strip.setPixelColor(i, strip.Color(_r, _g, _b));
            }
            strip.show();
            _animStep = (_animStep + 1) % 100;
            break;
        }
        case LED_SPIN: {
            strip.clear();
            int pos = _animStep % LED_COUNT;
            strip.setPixelColor(pos, strip.Color(_r, _g, _b));
            // Trail
            strip.setPixelColor((pos - 1 + LED_COUNT) % LED_COUNT,
                strip.Color(_r / 3, _g / 3, _b / 3));
            strip.setPixelColor((pos - 2 + LED_COUNT) % LED_COUNT,
                strip.Color(_r / 8, _g / 8, _b / 8));
            strip.show();
            _animStep++;
            break;
        }
        case LED_RAINBOW: {
            for (int i = 0; i < LED_COUNT; i++) {
                uint16_t hue = (_animStep * 256 + i * 65536 / LED_COUNT) & 0xFFFF;
                strip.setPixelColor(i, strip.gamma32(strip.ColorHSV(hue)));
            }
            strip.show();
            _animStep = (_animStep + 1) % 256;
            break;
        }
        default:
            break;
    }
}

void Backlight::printStatus() {
    Serial.println("=== Backlight ===");
    const char* modeNames[] = {"OFF", "WHITE", "COLOR", "PULSE", "SPIN", "RAINBOW"};
    Serial.printf("  Mode: %s\n", modeNames[_mode]);
    Serial.printf("  Brightness: %d\n", _brightness);
}
