#pragma once

#include <Arduino.h>
#include "scan_config.h"
#include "sensors.h"
#include "api_client.h"
#include <lvgl.h>

// Status icon flags (bitmask) — connectivity
#define ICON_WIFI       0x01
#define ICON_PAIRED     0x02
#define ICON_PRINTER    0x04

// Sensor icon flags (bitmask) — set once at boot
#define SENSOR_NFC      0x01
#define SENSOR_SCALE    0x02
#define SENSOR_TOF      0x04
#define SENSOR_COLOR    0x08
#define SENSOR_ENV      0x10
#define SENSOR_SD       0x20
#define SENSOR_AUDIO    0x40

class Display {
public:
    void begin();
    void tick();  // Call from loop() — runs lv_timer_handler()
    void update(ScanState state, float weight, bool stable,
                const char* nfcUid,
                const ScanResponse* serverData,
                const DistanceData* distance,
                const ColorData* color,
                uint8_t statusIcons = 0,
                const char* sessionUrl = nullptr,
                bool hasPrinter = false);
    void showMessage(const char* line1, const char* line2 = nullptr);
    void showBootScreen(const char* version);
    void addBootItem(const char* name, bool found);
    void setBootStatus(const char* msg);
    void showPairingCode(const char* code);
    void showQrCode(const char* data, const char* label = nullptr);
    void setSensorFlags(uint8_t flags);
    void showMenu();
    bool isMenuActive() const { return _currentScreen == SCR_MENU || _currentScreen == SCR_RAW_SENSORS || _currentScreen == SCR_CALIBRATE; }
    bool isRawSensorsScreen() const { return _currentScreen == SCR_RAW_SENSORS; }
    bool isDashboardScreen() const { return _currentScreen == SCR_IDLE; }

    // Pending display command — set by main loop, executed by LVGL task
    enum PendingCmd : uint8_t { CMD_NONE = 0, CMD_MESSAGE, CMD_CALIBRATE, CMD_RAW_SENSORS };
    volatile PendingCmd pendingCmd = CMD_NONE;
    char pendingLine1[64] = {0};
    char pendingLine2[64] = {0};
    void requestMessage(const char* line1, const char* line2 = nullptr);
    void requestCalibrate(const char* step, const char* detail = nullptr);
    void processPendingCmd();  // Called from LVGL task

    // Touch-to-submit flag — set by LVGL event, consumed by main loop
    volatile bool touchSubmitRequested = false;

    // Scan button pressed — set by LVGL event, consumed by main loop
    volatile bool scanButtonPressed = false;

    // Done button pressed — set by LVGL event on result screen
    volatile bool doneButtonPressed = false;

    // Print button pressed — set by LVGL event on result screen
    volatile bool printButtonPressed = false;

    // Menu action callbacks (set by main.cpp)
    void (*onMenuFormatSd)() = nullptr;
    void (*onMenuWifiSetup)() = nullptr;
    void (*onMenuTareScale)() = nullptr;
    void (*onMenuRawSensors)() = nullptr;
    void (*onMenuCalibrate)() = nullptr;
    void (*onMenuReboot)() = nullptr;
    void (*onMenuCheckUpdate)() = nullptr;
    void (*onMenuBleScan)() = nullptr;

    // Scan button callback (set by main.cpp)
    void (*onScanButtonPressed)() = nullptr;

    // Raw sensors screen — updated by main loop
    void showRawSensors(const char* text);  // Pre-formatted multi-line sensor dump
    void showCalibrate(const char* step, const char* detail = nullptr);

    // Live dashboard — update sensor values in-place without rebuilding screen
    void updateDashboard(float weight, bool stable,
                         const char* nfcInfo,
                         const char* colorInfo, uint8_t colorR, uint8_t colorG, uint8_t colorB,
                         float distMm,
                         float tempC, float humidity, float pressureHPa,
                         bool scanEnabled);

    // Result screen — show after scan submission
    void showResult(const ScanResponse* resp, float weight, const char* sessionUrl);

    // Enable/disable the scan button
    void setScanButtonEnabled(bool enabled);

    int screenWidth() const { return _screenW; }
    int screenHeight() const { return _screenH; }

private:
    bool _ready = false;
    int _screenW = 0;
    int _screenH = 0;
    ScanState _lastState = SCAN_IDLE;
    uint8_t _lastIcons = 0xFF;
    uint8_t _sensorFlags = 0;
    unsigned long _lastUpdate = 0;
    bool _forceRedraw = true;

    // Current screen type (for knowing when to rebuild)
    enum ScreenMode { SCR_NONE, SCR_IDLE, SCR_UNKNOWN, SCR_IDENTIFIED, SCR_MESSAGE, SCR_BOOT, SCR_PAIRING, SCR_QR, SCR_MENU, SCR_RAW_SENSORS, SCR_CALIBRATE, SCR_RESULT, SCR_SUBMITTING };
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

    // Boot screen
    lv_obj_t* _bootList = nullptr;
    lv_obj_t* _bootStatus = nullptr;
    uint8_t   _bootCount = 0;

    // Raw sensors screen
    lv_obj_t* _rawSensorsLabel = nullptr;

    // Calibrate screen
    lv_obj_t* _calStepLabel = nullptr;
    lv_obj_t* _calDetailLabel = nullptr;

    // Dashboard (idle) screen — live sensor labels
    lv_obj_t* _dashWeightLabel = nullptr;
    lv_obj_t* _dashWeightStatus = nullptr;
    lv_obj_t* _dashNfcLabel = nullptr;
    lv_obj_t* _dashColorLabel = nullptr;
    lv_obj_t* _dashColorSwatch = nullptr;
    lv_obj_t* _dashTofLabel = nullptr;
    lv_obj_t* _dashEnvLabel = nullptr;
    lv_obj_t* _dashScanBtn = nullptr;
    lv_obj_t* _dashScanBtnLabel = nullptr;

    // Result screen
    lv_obj_t* _resultTitle = nullptr;
    lv_obj_t* _resultName = nullptr;
    lv_obj_t* _resultWeight = nullptr;
    lv_obj_t* _resultDetail = nullptr;
    lv_obj_t* _resultDoneBtn = nullptr;
    lv_obj_t* _resultPrintBtn = nullptr;

    void buildDashboardScreen(uint8_t icons);
    void buildResultScreen(const ScanResponse* resp, float weight, const char* sessionUrl, uint8_t icons);
    void buildIdleScreen(uint8_t icons);
    void buildUnknownScreen(float weight, bool stable, const DistanceData* dist, const ColorData* color, uint8_t icons);
    void buildIdentifiedScreen(float weight, bool stable, const ScanResponse& resp, const DistanceData* dist, uint8_t icons);
    void buildMenuScreen();
    void updateStatusIcons(uint8_t icons);

    void clearScreen();
    lv_obj_t* createStatusBar(lv_obj_t* parent, uint8_t icons);

    // LVGL event callbacks (static, forwarded to Display instance)
    static void onSettingsBtnClick(lv_event_t* e);
    static void onMenuItemClick(lv_event_t* e);
    static void onBackBtnClick(lv_event_t* e);
    static void onSubmitTap(lv_event_t* e);
    static void onScanBtnClick(lv_event_t* e);
    static void onDoneBtnClick(lv_event_t* e);
    static void onPrintBtnClick(lv_event_t* e);
};

extern Display display;
