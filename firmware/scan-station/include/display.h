#pragma once

#include <Arduino.h>
#include "scan_config.h"
#include "sensors.h"
#include "api_client.h"
#include <lvgl.h>

// Status icon flags (bitmask)
#define ICON_WIFI       0x01
#define ICON_PAIRED     0x02
#define ICON_PRINTER    0x04

class Display {
public:
    void begin();
    void tick();  // Call from loop() — runs lv_timer_handler()
    void update(ScanState state, float weight, bool stable,
                const char* nfcUid,
                const ScanResponse* serverData,
                const DistanceData* distance,
                const ColorData* color,
                uint8_t statusIcons = 0);
    void showMessage(const char* line1, const char* line2 = nullptr);
    void showPairingCode(const char* code);
    void showQrCode(const char* data, const char* label = nullptr);

    int screenWidth() const { return _screenW; }
    int screenHeight() const { return _screenH; }

private:
    bool _ready = false;
    int _screenW = 0;
    int _screenH = 0;
    ScanState _lastState = SCAN_IDLE;
    uint8_t _lastIcons = 0xFF;
    unsigned long _lastUpdate = 0;
    bool _forceRedraw = true;

    // Current screen type (for knowing when to rebuild)
    enum ScreenMode { SCR_NONE, SCR_IDLE, SCR_UNKNOWN, SCR_IDENTIFIED, SCR_MESSAGE, SCR_PAIRING, SCR_QR };
    ScreenMode _currentScreen = SCR_NONE;

    // LVGL objects — persistent across updates
    lv_obj_t* _screen = nullptr;

    // Status bar
    lv_obj_t* _iconWifi = nullptr;
    lv_obj_t* _iconPaired = nullptr;
    lv_obj_t* _iconPrinter = nullptr;

    // Idle screen
    lv_obj_t* _idleTitle = nullptr;
    lv_obj_t* _idleSubtitle = nullptr;

    // Scanning/unknown screen
    lv_obj_t* _weightLabel = nullptr;
    lv_obj_t* _heightLabel = nullptr;
    lv_obj_t* _colorSwatch = nullptr;

    // Identified screen
    lv_obj_t* _itemName = nullptr;
    lv_obj_t* _materialLabel = nullptr;
    lv_obj_t* _tempLabel = nullptr;

    // Message screen
    lv_obj_t* _msgLine1 = nullptr;
    lv_obj_t* _msgLine2 = nullptr;

    // Pairing screen
    lv_obj_t* _pairCode = nullptr;

    void buildIdleScreen(uint8_t icons);
    void buildUnknownScreen(float weight, bool stable, const DistanceData* dist, const ColorData* color, uint8_t icons);
    void buildIdentifiedScreen(float weight, bool stable, const ScanResponse& resp, const DistanceData* dist, uint8_t icons);
    void updateStatusIcons(uint8_t icons);

    void clearScreen();
    lv_obj_t* createStatusBar(lv_obj_t* parent, uint8_t icons);
};

extern Display display;
