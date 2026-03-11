#pragma once

#include <Arduino.h>
#include "scan_config.h"
#include "sensors.h"
#include "filament_data.h"

// ============================================================
// Filla IQ — Scan Station TFT Display (ST7789V3 240x280 SPI)
// ============================================================

// Status icon flags (bitmask)
#define ICON_WIFI       0x01
#define ICON_PAIRED     0x02
#define ICON_PRINTER    0x04

class Display {
public:
    void begin();
    void update(ScanState state, float weight, bool stable,
                const char* nfcUid,
                const FilamentInfo* filament,
                const DistanceData* distance,
                const ColorData* color,
                uint8_t statusIcons = 0);
    void showMessage(const char* line1, const char* line2 = nullptr);
    void showPairingCode(const char* code);
    void showQrCode(const char* data, const char* label = nullptr);

private:
    bool _ready;
    ScanState _lastState;
    unsigned long _lastUpdate;
    bool _forceRedraw;
    uint8_t _lastIcons;

    void drawHeader(const char* title, uint16_t titleColor, uint8_t icons);
    void drawStatusIcons(uint8_t icons);
    void drawIdle(uint8_t icons);
    void drawUnknown(float weight, bool stable, const DistanceData* dist, const ColorData* color, uint8_t icons);
    void drawSpool(float weight, bool stable, const FilamentInfo& fi, const DistanceData* dist, uint8_t icons);
    void drawSpoolIcon(int cx, int cy, int w, int h, uint16_t fillColor);
};

extern Display display;
