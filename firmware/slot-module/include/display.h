#pragma once

#include <Arduino.h>
#include <U8g2lib.h>
#include "config.h"

// ============================================================
// Filla IQ — Single SSD1322 256x64 OLED Display Driver (U8g2)
// One display shows both bays side-by-side (128px each)
// ============================================================

struct SpoolInfo {
    String brand;         // e.g. "BAMBU"
    String name;          // e.g. "PLA Basic"
    String material;      // e.g. "PLA"
    float  diameter;      // mm (1.75 or 2.85)
    float  fullWeight;    // grams of filament when full
    uint8_t color_r;      // filament color (stored for web reporting)
    uint8_t color_g;
    uint8_t color_b;

    SpoolInfo() : brand(""), name(""), material(""), diameter(1.75f),
                  fullWeight(SPOOL_FULL_WEIGHT_G),
                  color_r(0), color_g(255), color_b(0) {}
};

// Per-bay state (logical slot on the shared display)
class SlotDisplay {
public:
    void begin(uint8_t channel);
    void setSpoolInfo(const SpoolInfo& info);
    void update(float weight, float stableWeight, bool isStable, bool spoolPresent);

    // Calibration mode
    void showCalWaitEmpty();
    void showCalWaitWeight();
    void showCalResult(float factor, float verify, float expected);
    void showCalDone();
    void exitCalMode();

    // Draw this bay's content at the given X offset (called by renderDisplay)
    void draw(int16_t xOff);

private:
    uint8_t _channel;
    SpoolInfo _spool;
    bool _calMode;
    bool _lastPresent;
    float _lastWeight;
    int   _lastPercent;

    enum Screen { SCR_EMPTY, SCR_SPOOL, SCR_CAL };
    Screen _currentScreen;

    // Cal state text
    String _calLine1;
    String _calLine2;
    String _calTitle;

};

// Global interface (same API as before — main.cpp unchanged)
void initDisplays();
void updateDisplays();
void setDisplaySpoolInfo(uint8_t channel, const SpoolInfo& info);
SlotDisplay* getDisplay(uint8_t channel);
