#include "display.h"
#include <SPI.h>
#include <lvgl.h>
#include <qrcode.h>
#include <esp_heap_caps.h>
#include "api_client.h"
// Custom Font Awesome 6 icon font (14px)
// Custom FA6 icon font — included directly to avoid linkage issues
#include "fa_icons_14.cpp"

// FA6 icon codepoints (UTF-8 encoded)
#define FA_TOWER_BROADCAST  "\xEF\x94\x99"   // 0xF519 — NFC
#define FA_WEIGHT_SCALE     "\xEF\x89\x8E"   // 0xF24E — Scale
#define FA_PALETTE          "\xEF\x94\xBF"   // 0xF53F — Color
#define FA_THERMOMETER      "\xEF\x8B\x89"   // 0xF2C9 — Environment
#define FA_PRINT            "\xEF\x80\xAF"   // 0xF02F — Printer
#define FA_WIFI             "\xEF\x87\xAB"   // 0xF1EB — WiFi
#define FA_CHECK            "\xEF\x80\x8C"   // 0xF00C — Paired/OK
#define FA_CLOUD            "\xEF\x83\x82"   // 0xF0C2 — MQTT/Cloud
#define FA_GEAR             "\xEF\x80\x93"   // 0xF013 — Settings

// LVGL native display drivers
#include "src/drivers/display/lcd/lv_lcd_generic_mipi.h"
#ifndef BOARD_SCAN_TOUCH
#include "src/drivers/display/st7789/lv_st7789.h"
#endif

Display display;

// SPI settings for display
#define TFT_SPI_FREQ  40000000  // 40 MHz
static SPIClass* tftSPI = nullptr;
static lv_display_t* lvDisp = nullptr;

// Brand colors — Modern Maker palette (matched to web app)
#define MAKER_CYAN_HEX       0x00D2FF   // Primary accent (was Brand Orange)
#define DEEP_WORKSHOP_HEX    0x0F1F23   // Dark background
#define TOOL_GRAY_HEX        0x94A3B8   // Muted text / inactive icons
#define GRAY_LIGHT_HEX       0xA0B0C0   // Light muted text (slightly lightened)
#define LIVE_GREEN_HEX       0x00E676   // Active / connected indicators
#define ALERT_ROSE_HEX       0xFF2A5F   // Error / alert states
#define WHITE_HEX            0xFFFFFF
#define SIGNAL_ORANGE_HEX    0xFF7A00   // Warning states
#define BLUEPRINT_SLATE_HEX  0x1A2530   // Card / surface backgrounds

// Dynamic QR canvas buffer (freed on screen clear)
static uint8_t* qrCanvasBuf = nullptr;

static lv_color_t makerCyan;
static lv_color_t deepWorkshop;
static lv_color_t toolGray;
static lv_color_t grayLight;
static lv_color_t liveGreen;
static lv_color_t white;
static lv_color_t signalOrange;
static lv_color_t blueprintSlate;

// ── SPI Transport for LVGL Native Drivers ────────────────────

static void spiSendCmd(lv_display_t* disp, const uint8_t* cmd, size_t cmd_size,
                       const uint8_t* param, size_t param_size) {
    (void)disp;
    tftSPI->beginTransaction(SPISettings(TFT_SPI_FREQ, MSBFIRST, SPI_MODE0));
    digitalWrite(TFT_CS_PIN, LOW);

    // Command phase: DC low
    digitalWrite(TFT_DC_PIN, LOW);
    for (size_t i = 0; i < cmd_size; i++) tftSPI->transfer(cmd[i]);

    // Parameter phase: DC high
    if (param_size > 0) {
        digitalWrite(TFT_DC_PIN, HIGH);
        for (size_t i = 0; i < param_size; i++) tftSPI->transfer(param[i]);
    }

    digitalWrite(TFT_CS_PIN, HIGH);
    tftSPI->endTransaction();
}

static void spiSendColor(lv_display_t* disp, const uint8_t* cmd, size_t cmd_size,
                         uint8_t* param, size_t param_size) {
    (void)disp;
    tftSPI->beginTransaction(SPISettings(TFT_SPI_FREQ, MSBFIRST, SPI_MODE0));
    digitalWrite(TFT_CS_PIN, LOW);

    // Command byte (0x2C = RAMWR): DC low
    digitalWrite(TFT_DC_PIN, LOW);
    for (size_t i = 0; i < cmd_size; i++) tftSPI->transfer(cmd[i]);

    // Byte-swap RGB565: LVGL outputs little-endian, ILI9341 expects big-endian
    uint16_t* px = (uint16_t*)param;
    size_t count = param_size / 2;
    for (size_t i = 0; i < count; i++) px[i] = __builtin_bswap16(px[i]);

    // Pixel data: DC high — use writeBytes for DMA bulk transfer
    digitalWrite(TFT_DC_PIN, HIGH);
    tftSPI->writeBytes(param, param_size);

    digitalWrite(TFT_CS_PIN, HIGH);
    tftSPI->endTransaction();

    lv_display_flush_ready(disp);
}

// ── ILI9341V IPS init (lcdwiki 2.8" ESP32-S3 board) ──────────
// Complete panel-specific init from vendor SDK.  Sent after the
// generic MIPI create (which handles reset, sleep-out, MADCTL,
// pixel format and display-on).
#ifdef BOARD_SCAN_TOUCH
static const uint8_t ili9341v_init_cmds[] = {
    0xCF, 3, 0x00, 0xC1, 0x30,         // Power Control B
    0xED, 4, 0x64, 0x03, 0x12, 0x81,   // Power On Sequence
    0xE8, 3, 0x85, 0x00, 0x78,         // Driver Timing Control A
    0xCB, 5, 0x39, 0x2C, 0x00,         // Power Control A
              0x34, 0x02,
    0xF7, 1, 0x20,                     // Pump Ratio Control
    0xEA, 2, 0x00, 0x00,               // Driver Timing Control B
    0xC0, 1, 0x13,                     // Power Control 1
    0xC1, 1, 0x13,                     // Power Control 2
    0xC5, 2, 0x22, 0x35,               // VCOM Control 1
    0xC7, 1, 0xBD,                     // VCOM Control 2
    0xB6, 2, 0x0A, 0x82,               // Display Function Control
    0xF6, 2, 0x01, 0x30,               // Interface Control
    0xB1, 2, 0x00, 0x1B,               // Frame Rate (70 Hz)
    0xF2, 1, 0x00,                     // 3-Gamma Function Disable
    0x26, 1, 0x01,                     // Gamma Curve Selected
    0xE0, 15, 0x0F, 0x35, 0x31, 0x0B,  // Positive Gamma
              0x0E, 0x06, 0x49, 0xA7,
              0x33, 0x07, 0x0F, 0x03,
              0x0C, 0x0A, 0x00,
    0xE1, 15, 0x00, 0x0A, 0x0F, 0x04,  // Negative Gamma
              0x11, 0x08, 0x36, 0x58,
              0x4D, 0x07, 0x10, 0x0C,
              0x32, 0x34, 0x0F,
    LV_LCD_CMD_DELAY_MS, LV_LCD_CMD_EOF
};
#endif

// ── Display Init ─────────────────────────────────────────────

void Display::begin() {
    _ready = false;

    // Configure control pins
    pinMode(TFT_CS_PIN, OUTPUT);
    pinMode(TFT_DC_PIN, OUTPUT);
    digitalWrite(TFT_CS_PIN, HIGH);
    digitalWrite(TFT_DC_PIN, HIGH);

    // Hardware reset (if available)
#if TFT_RST_PIN >= 0
    pinMode(TFT_RST_PIN, OUTPUT);
    digitalWrite(TFT_RST_PIN, LOW);
    delay(10);
    digitalWrite(TFT_RST_PIN, HIGH);
    delay(120);
#endif

    // Backlight on
    pinMode(TFT_BLK_PIN, OUTPUT);
    digitalWrite(TFT_BLK_PIN, HIGH);

    // Init SPI bus (FSPI on ESP32-S3)
    tftSPI = &SPI;
    tftSPI->begin(SPI_SCK_PIN, SPI_MISO_PIN, SPI_MOSI_PIN, TFT_CS_PIN);
    Serial.println("  SPI init done"); Serial.flush();

    // Init LVGL
    lv_init();
    lv_tick_set_cb([]() -> uint32_t { return (uint32_t)millis(); });
    lv_delay_set_cb([](uint32_t ms){ delay(ms); });
    Serial.println("  LVGL init done"); Serial.flush();

    // Create display using LVGL generic MIPI driver + board-specific init
#ifdef BOARD_SCAN_TOUCH
    // ILI9341V IPS — 320x240 landscape via MADCTL hardware rotation
    _screenW = 320;
    _screenH = 240;
    Serial.println("  Creating ILI9341V..."); Serial.flush();
    lvDisp = lv_lcd_generic_mipi_create(_screenW, _screenH, LV_LCD_FLAG_BGR, spiSendCmd, spiSendColor);
    lv_lcd_generic_mipi_send_cmd_list(lvDisp, ili9341v_init_cmds);
    // Set landscape: swap XY via MADCTL (MV + BGR = 0x28, matching vendor SDK)
    lv_lcd_generic_mipi_set_address_mode(lvDisp, false, false, true, true);
    // IPS panel requires display inversion ON for correct colors
    lv_lcd_generic_mipi_set_invert(lvDisp, true);
    Serial.println("  ILI9341V init done"); Serial.flush();
#else
    // ST7789 240x280 — portrait
    _screenW = 240;
    _screenH = 280;
    lvDisp = lv_st7789_create(_screenW, _screenH, LV_LCD_FLAG_NONE, spiSendCmd, spiSendColor);
    lv_st7789_set_gap(lvDisp, 0, 20);  // 1.69" display VRAM offset
#endif

    // Allocate draw buffers — partial mode, 40 rows at a time
    // Larger buffers = fewer SPI flush calls per frame = faster rendering
    // 320 = max width (ILI9341 landscape), 2 bytes per pixel (RGB565)
    #define DRAW_BUF_LINES 40
    #define DRAW_BUF_SIZE  (320 * DRAW_BUF_LINES * 2)
#ifdef BOARD_HAS_PSRAM
    // Use PSRAM for draw buffers to keep SRAM free for stack/heap
    static uint8_t* buf1 = (uint8_t*)heap_caps_aligned_alloc(4, DRAW_BUF_SIZE, MALLOC_CAP_SPIRAM);
    static uint8_t* buf2 = (uint8_t*)heap_caps_aligned_alloc(4, DRAW_BUF_SIZE, MALLOC_CAP_SPIRAM);
#else
    static uint8_t __attribute__((aligned(4))) buf1[DRAW_BUF_SIZE];
    static uint8_t __attribute__((aligned(4))) buf2[DRAW_BUF_SIZE];
#endif
    lv_display_set_buffers(lvDisp, buf1, buf2, DRAW_BUF_SIZE, LV_DISPLAY_RENDER_MODE_PARTIAL);
    Serial.printf("  LVGL bufs: %d bytes x2 @ %p, %p%s\n", DRAW_BUF_SIZE, buf1, buf2,
#ifdef BOARD_HAS_PSRAM
        " (PSRAM)"
#else
        ""
#endif
    );
    Serial.flush();

    // Cache colors (Modern Maker palette)
    makerCyan = lv_color_hex(MAKER_CYAN_HEX);
    deepWorkshop = lv_color_hex(DEEP_WORKSHOP_HEX);
    toolGray = lv_color_hex(TOOL_GRAY_HEX);
    grayLight = lv_color_hex(GRAY_LIGHT_HEX);
    liveGreen = lv_color_hex(LIVE_GREEN_HEX);
    white = lv_color_hex(WHITE_HEX);
    signalOrange = lv_color_hex(SIGNAL_ORANGE_HEX);
    blueprintSlate = lv_color_hex(BLUEPRINT_SLATE_HEX);

    // Dark background for all screens
    lv_obj_set_style_bg_color(lv_screen_active(), deepWorkshop, 0);
    lv_obj_set_style_bg_opa(lv_screen_active(), LV_OPA_COVER, 0);

    _ready = true;
    _currentScreen = SCR_NONE;

    showMessage("Filla IQ", "Booting...");

    const char* chipName;
#ifdef BOARD_SCAN_TOUCH
    chipName = "ILI9341";
#else
    chipName = "ST7789";
#endif
    Serial.printf("  TFT: %s %dx%d LVGL native\n", chipName, _screenW, _screenH);
}

void Display::tick() {
    if (!_ready) return;
    lv_timer_handler();
}

// ── Helpers ──────────────────────────────────────────────────

void Display::clearScreen() {
    // Free dynamically allocated QR canvas buffer before destroying objects
    if (qrCanvasBuf) {
        free(qrCanvasBuf);
        qrCanvasBuf = nullptr;
    }

    lv_obj_t* scr = lv_screen_active();
    lv_obj_clean(scr);
    lv_obj_set_style_bg_color(scr, deepWorkshop, 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);

    _screen = scr;
    _iconWifi = _iconMqtt = _iconPrinter = nullptr;
    _idleTitle = _idleSubtitle = nullptr;
    _weightLabel = _colorSwatch = nullptr;
    _itemName = _materialLabel = _tempLabel = nullptr;
    _msgLine1 = _msgLine2 = nullptr;
    _pairCode = nullptr;
    _dashWeightLabel = _dashWeightBadge = _dashWeightBadgeLbl = nullptr;
    _dashNfcLabel = _dashNfcDetail = _dashNfcUid = nullptr;
    _dashLocPrevBtn = _dashLocNextBtn = _dashLocCounter = nullptr;
    _dashScanBtn = _dashScanBtnLabel = nullptr;
    _resultTitle = _resultName = _resultWeight = _resultDetail = nullptr;
    _resultDoneBtn = _resultPrintBtn = nullptr;
}

static lv_obj_t* makeLabel(lv_obj_t* parent, const lv_font_t* font, lv_color_t color,
                           lv_align_t align, int x, int y, const char* text) {
    lv_obj_t* lbl = lv_label_create(parent);
    lv_label_set_text(lbl, text);
    lv_obj_set_style_text_font(lbl, font, 0);
    lv_obj_set_style_text_color(lbl, color, 0);
    lv_obj_align(lbl, align, x, y);
    return lbl;
}

// ── Status Bar ───────────────────────────────────────────────

// Helper: create a Font Awesome symbol label in a flex container.
static lv_obj_t* makeSymbol(lv_obj_t* parent, const char* symbol, lv_color_t color) {
    lv_obj_t* lbl = lv_label_create(parent);
    lv_label_set_text(lbl, symbol);
    lv_obj_set_style_text_font(lbl, &fa_icons_14, 0);
    lv_obj_set_style_text_color(lbl, color, 0);
    return lbl;
}

lv_obj_t* Display::createStatusBar(lv_obj_t* parent, uint8_t icons) {
    // ── Sensor icons (left side) ─────────────────────────────
    // One icon per detected sensor, displayed in fixed order.
    if (_sensorFlags) {
        lv_obj_t* sensorBar = lv_obj_create(parent);
        lv_obj_remove_style_all(sensorBar);
        lv_obj_set_size(sensorBar, LV_SIZE_CONTENT, 16);
        lv_obj_align(sensorBar, LV_ALIGN_TOP_LEFT, 8, 10);
        lv_obj_set_flex_flow(sensorBar, LV_FLEX_FLOW_ROW);
        lv_obj_set_flex_align(sensorBar, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
        lv_obj_set_style_pad_column(sensorBar, 4, 0);

        struct { uint8_t flag; const char* symbol; } sensors[] = {
            { SENSOR_NFC,   FA_TOWER_BROADCAST },
            { SENSOR_SCALE, FA_WEIGHT_SCALE    },
            { SENSOR_COLOR, FA_PALETTE         },
            { SENSOR_ENV,   FA_THERMOMETER     },
        };
        for (auto& s : sensors) {
            if (_sensorFlags & s.flag) {
                makeSymbol(sensorBar, s.symbol, liveGreen);
            }
        }
    }

    // ── Connectivity icons (right side) ──────────────────────
    // Displayed right-to-left via ROW_REVERSE: printer, paired, wifi.
    lv_obj_t* bar = lv_obj_create(parent);
    lv_obj_remove_style_all(bar);
    lv_obj_set_size(bar, LV_SIZE_CONTENT, 16);
    lv_obj_align(bar, LV_ALIGN_TOP_RIGHT, -8, 10);
    lv_obj_set_flex_flow(bar, LV_FLEX_FLOW_ROW_REVERSE);
    lv_obj_set_flex_align(bar, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_column(bar, 4, 0);

    _iconWifi = makeSymbol(bar, FA_WIFI, (icons & ICON_WIFI) ? liveGreen : grayLight);

    _iconMqtt = makeSymbol(bar, FA_CLOUD, (icons & ICON_MQTT) ? liveGreen : grayLight);

    _iconPrinter = makeSymbol(bar, FA_PRINT, (icons & ICON_PRINTER) ? liveGreen : grayLight);
    if (!(icons & ICON_PRINTER)) lv_obj_add_flag(_iconPrinter, LV_OBJ_FLAG_HIDDEN);

    return bar;
}

void Display::setSensorFlags(uint8_t flags) {
    _sensorFlags = flags;
}

void Display::updateStatusIcons(uint8_t icons) {
    if (_iconWifi)
        lv_obj_set_style_text_color(_iconWifi, (icons & ICON_WIFI) ? liveGreen : grayLight, 0);
    if (_iconMqtt)
        lv_obj_set_style_text_color(_iconMqtt, (icons & ICON_MQTT) ? liveGreen : grayLight, 0);
    if (_iconPrinter) {
        lv_obj_set_style_text_color(_iconPrinter, (icons & ICON_PRINTER) ? liveGreen : grayLight, 0);
        if (icons & ICON_PRINTER) lv_obj_clear_flag(_iconPrinter, LV_OBJ_FLAG_HIDDEN);
        else lv_obj_add_flag(_iconPrinter, LV_OBJ_FLAG_HIDDEN);
    }
    _lastIcons = icons;
}

// ── LVGL Event Callbacks ────────────────────────────────────

void Display::onSettingsBtnClick(lv_event_t* e) {
    (void)e;
    display.showMenu();
}

void Display::onBackBtnClick(lv_event_t* e) {
    (void)e;
    display._forceRedraw = true;
    display._currentScreen = SCR_NONE;  // Force rebuild on next update()
}

void Display::onMenuItemClick(lv_event_t* e) {
    int idx = (int)(intptr_t)lv_event_get_user_data(e);
    switch (idx) {
        case 1: if (display.onMenuWifiSetup) display.onMenuWifiSetup(); break;
        case 2: if (display.onMenuTareScale) display.onMenuTareScale(); break;
        case 3: if (display.onMenuRawSensors) display.onMenuRawSensors(); break;
        case 4: if (display.onMenuCalibrate) display.onMenuCalibrate(); break;
        case 5: if (display.onMenuReboot)      display.onMenuReboot();      break;
        case 6: if (display.onMenuCheckUpdate) display.onMenuCheckUpdate(); break;
        case 7: if (display.onMenuBleScan)     display.onMenuBleScan();     break;
    }
}

void Display::onSubmitTap(lv_event_t* e) {
    (void)e;
    display.touchSubmitRequested = true;
}

void Display::onScanBtnClick(lv_event_t* e) {
    (void)e;
    display.scanButtonPressed = true;
    if (display.onScanButtonPressed) display.onScanButtonPressed();
}

void Display::onDoneBtnClick(lv_event_t* e) {
    (void)e;
    display.doneButtonPressed = true;
}

void Display::onPrintBtnClick(lv_event_t* e) {
    (void)e;
    display.printButtonPressed = true;
}

void Display::onLocPrevClick(lv_event_t* e) {
    (void)e;
    display.locationCycleDelta = -1;
}

void Display::onLocNextClick(lv_event_t* e) {
    (void)e;
    display.locationCycleDelta = 1;
}

// ── Idle Screen ──────────────────────────────────────────────

void Display::buildIdleScreen(uint8_t icons) {
    clearScreen();
    _currentScreen = SCR_IDLE;

    createStatusBar(_screen, icons);

    // Settings gear button (bottom-right)
#ifdef BOARD_SCAN_TOUCH
    lv_obj_t* gearBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(gearBtn);
    lv_obj_set_size(gearBtn, 48, 48);
    lv_obj_align(gearBtn, LV_ALIGN_BOTTOM_RIGHT, -4, -4);
    lv_obj_set_style_bg_color(gearBtn, blueprintSlate, 0);
    lv_obj_set_style_bg_opa(gearBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(gearBtn, 10, 0);
    lv_obj_add_event_cb(gearBtn, onSettingsBtnClick, LV_EVENT_CLICKED, NULL);

    lv_obj_t* gearIcon = lv_label_create(gearBtn);
    lv_label_set_text(gearIcon, FA_GEAR);
    lv_obj_set_style_text_font(gearIcon, &fa_icons_14, 0);
    lv_obj_set_style_text_color(gearIcon, grayLight, 0);
    lv_obj_center(gearIcon);
#endif

    // Two-pill FillaIQ logo — two vertical cyan capsules side by side
    lv_obj_t* pillLeft = lv_obj_create(_screen);
    lv_obj_remove_style_all(pillLeft);
    lv_obj_set_size(pillLeft, 14, 40);
    lv_obj_set_style_bg_color(pillLeft, makerCyan, 0);
    lv_obj_set_style_bg_opa(pillLeft, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(pillLeft, 7, 0);
    lv_obj_align(pillLeft, LV_ALIGN_CENTER, -12, -40);

    lv_obj_t* pillRight = lv_obj_create(_screen);
    lv_obj_remove_style_all(pillRight);
    lv_obj_set_size(pillRight, 14, 40);
    lv_obj_set_style_bg_color(pillRight, makerCyan, 0);
    lv_obj_set_style_bg_opa(pillRight, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(pillRight, 7, 0);
    lv_obj_align(pillRight, LV_ALIGN_CENTER, 12, -40);

    _idleTitle = makeLabel(_screen, &lv_font_montserrat_24, white,
                           LV_ALIGN_CENTER, 0, 10, "FillaIQ");

    _idleSubtitle = makeLabel(_screen, &lv_font_montserrat_14, toolGray,
                              LV_ALIGN_CENTER, 0, 42, "Place item on platform");
}

// ── Dashboard Screen (Live Sensor Display + Scan Button) ─────

void Display::buildDashboardScreen(uint8_t icons) {
    clearScreen();
    _currentScreen = SCR_IDLE;

    createStatusBar(_screen, icons);

    // Settings gear button (top-right area, below status bar)
#ifdef BOARD_SCAN_TOUCH
    lv_obj_t* gearBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(gearBtn);
    lv_obj_set_size(gearBtn, 48, 48);
    lv_obj_align(gearBtn, LV_ALIGN_TOP_RIGHT, -2, 26);
    lv_obj_set_style_bg_color(gearBtn, blueprintSlate, 0);
    lv_obj_set_style_bg_opa(gearBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(gearBtn, 10, 0);
    lv_obj_add_event_cb(gearBtn, onSettingsBtnClick, LV_EVENT_CLICKED, NULL);

    lv_obj_t* gearIcon = lv_label_create(gearBtn);
    lv_label_set_text(gearIcon, LV_SYMBOL_SETTINGS);
    lv_obj_set_style_text_font(gearIcon, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(gearIcon, grayLight, 0);
    lv_obj_center(gearIcon);
#endif

    // Weight — large centered display at top
    _dashWeightLabel = makeLabel(_screen, &lv_font_montserrat_28, white,
                                 LV_ALIGN_TOP_MID, 0, 30, "--");

    // STABLE/READING badge — pill-shaped indicator below weight
    _dashWeightBadge = lv_obj_create(_screen);
    lv_obj_remove_style_all(_dashWeightBadge);
    lv_obj_set_size(_dashWeightBadge, LV_SIZE_CONTENT, 18);
    lv_obj_set_style_bg_color(_dashWeightBadge, toolGray, 0);
    lv_obj_set_style_bg_opa(_dashWeightBadge, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(_dashWeightBadge, 9, 0);
    lv_obj_set_style_pad_hor(_dashWeightBadge, 10, 0);
    lv_obj_set_style_pad_ver(_dashWeightBadge, 2, 0);
    lv_obj_align(_dashWeightBadge, LV_ALIGN_TOP_MID, 0, 62);

    _dashWeightBadgeLbl = lv_label_create(_dashWeightBadge);
    lv_label_set_text(_dashWeightBadgeLbl, "READING");
    lv_obj_set_style_text_font(_dashWeightBadgeLbl, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(_dashWeightBadgeLbl, deepWorkshop, 0);
    lv_obj_center(_dashWeightBadgeLbl);

    // --- NFC info panel — full width, taller, shows more tag detail ---
    int panelW = _screenW - 16;
    int panelTop = 84;
    int panelH = 118;

    lv_obj_t* nfcPanel = lv_obj_create(_screen);
    lv_obj_remove_style_all(nfcPanel);
    lv_obj_set_size(nfcPanel, panelW, panelH);
    lv_obj_set_style_bg_color(nfcPanel, blueprintSlate, 0);
    lv_obj_set_style_bg_opa(nfcPanel, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(nfcPanel, 8, 0);
    lv_obj_set_style_pad_all(nfcPanel, 10, 0);
    lv_obj_set_pos(nfcPanel, 8, panelTop);

    makeLabel(nfcPanel, &lv_font_montserrat_12, toolGray,
              LV_ALIGN_TOP_LEFT, 0, 0, "NFC TAG");

    // Tag format line (e.g. "Bambu Mifare Classic")
    _dashNfcLabel = lv_label_create(nfcPanel);
    lv_obj_set_style_text_font(_dashNfcLabel, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(_dashNfcLabel, makerCyan, 0);
    lv_obj_set_width(_dashNfcLabel, panelW - 20);
    lv_label_set_long_mode(_dashNfcLabel, LV_LABEL_LONG_DOT);
    lv_obj_align(_dashNfcLabel, LV_ALIGN_TOP_LEFT, 0, 16);
    lv_label_set_text(_dashNfcLabel, "Waiting for tag...");

    // Tag detail line (e.g. UID, sector info, data pages)
    _dashNfcDetail = lv_label_create(nfcPanel);
    lv_obj_set_style_text_font(_dashNfcDetail, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(_dashNfcDetail, grayLight, 0);
    lv_obj_set_width(_dashNfcDetail, panelW - 20);
    lv_label_set_long_mode(_dashNfcDetail, LV_LABEL_LONG_DOT);
    lv_obj_align(_dashNfcDetail, LV_ALIGN_TOP_LEFT, 0, 36);
    lv_label_set_text(_dashNfcDetail, "Place spool NFC tag near reader");

    // Tag UID line (monospace-style)
    _dashNfcUid = lv_label_create(nfcPanel);
    lv_obj_set_style_text_font(_dashNfcUid, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(_dashNfcUid, toolGray, 0);
    lv_obj_set_width(_dashNfcUid, panelW - 20);
    lv_label_set_long_mode(_dashNfcUid, LV_LABEL_LONG_DOT);
    lv_obj_align(_dashNfcUid, LV_ALIGN_TOP_LEFT, 0, 54);
    lv_label_set_text(_dashNfcUid, "");

    // Location cycling row — hidden until a known spool has empty slots
    // Layout: [<] location path  [1/5] [>]
    int locRowY = 74;
    int btnSize = 24;

    _dashLocPrevBtn = lv_btn_create(nfcPanel);
    lv_obj_remove_style_all(_dashLocPrevBtn);
    lv_obj_set_size(_dashLocPrevBtn, btnSize, btnSize);
    lv_obj_set_style_bg_color(_dashLocPrevBtn, toolGray, 0);
    lv_obj_set_style_bg_opa(_dashLocPrevBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(_dashLocPrevBtn, 4, 0);
    lv_obj_align(_dashLocPrevBtn, LV_ALIGN_TOP_LEFT, 0, locRowY);
    lv_obj_t* prevLbl = lv_label_create(_dashLocPrevBtn);
    lv_label_set_text(prevLbl, LV_SYMBOL_LEFT);
    lv_obj_set_style_text_color(prevLbl, white, 0);
    lv_obj_center(prevLbl);
    lv_obj_add_event_cb(_dashLocPrevBtn, onLocPrevClick, LV_EVENT_CLICKED, NULL);
    lv_obj_add_flag(_dashLocPrevBtn, LV_OBJ_FLAG_HIDDEN);

    _dashLocNextBtn = lv_btn_create(nfcPanel);
    lv_obj_remove_style_all(_dashLocNextBtn);
    lv_obj_set_size(_dashLocNextBtn, btnSize, btnSize);
    lv_obj_set_style_bg_color(_dashLocNextBtn, toolGray, 0);
    lv_obj_set_style_bg_opa(_dashLocNextBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(_dashLocNextBtn, 4, 0);
    lv_obj_align(_dashLocNextBtn, LV_ALIGN_TOP_RIGHT, 0, locRowY);
    lv_obj_t* nextLbl = lv_label_create(_dashLocNextBtn);
    lv_label_set_text(nextLbl, LV_SYMBOL_RIGHT);
    lv_obj_set_style_text_color(nextLbl, white, 0);
    lv_obj_center(nextLbl);
    lv_obj_add_event_cb(_dashLocNextBtn, onLocNextClick, LV_EVENT_CLICKED, NULL);
    lv_obj_add_flag(_dashLocNextBtn, LV_OBJ_FLAG_HIDDEN);

    _dashLocCounter = lv_label_create(nfcPanel);
    lv_obj_set_style_text_font(_dashLocCounter, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(_dashLocCounter, grayLight, 0);
    lv_obj_align(_dashLocCounter, LV_ALIGN_TOP_RIGHT, -(btnSize + 4), locRowY + 5);
    lv_label_set_text(_dashLocCounter, "");
    lv_obj_add_flag(_dashLocCounter, LV_OBJ_FLAG_HIDDEN);

    // SCAN button — full-width, prominent, at bottom
#ifdef BOARD_SCAN_TOUCH
    _dashScanBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(_dashScanBtn);
    lv_obj_set_size(_dashScanBtn, _screenW - 16, 44);
    lv_obj_align(_dashScanBtn, LV_ALIGN_BOTTOM_MID, 0, -6);
    lv_obj_set_style_bg_color(_dashScanBtn, makerCyan, 0);
    lv_obj_set_style_bg_opa(_dashScanBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(_dashScanBtn, 10, 0);
    lv_obj_set_style_bg_color(_dashScanBtn, lv_color_hex(0x00A0CC), LV_PART_MAIN | LV_STATE_PRESSED);
    // Disabled style
    lv_obj_set_style_bg_color(_dashScanBtn, lv_color_hex(0x253540), LV_PART_MAIN | LV_STATE_DISABLED);
    lv_obj_set_style_bg_opa(_dashScanBtn, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DISABLED);
    lv_obj_add_event_cb(_dashScanBtn, onScanBtnClick, LV_EVENT_CLICKED, NULL);

    _dashScanBtnLabel = lv_label_create(_dashScanBtn);
    lv_label_set_text(_dashScanBtnLabel, "SCAN");
    lv_obj_set_style_text_font(_dashScanBtnLabel, &lv_font_montserrat_24, 0);
    lv_obj_set_style_text_color(_dashScanBtnLabel, white, 0);
    lv_obj_center(_dashScanBtnLabel);

    // Start disabled
    lv_obj_add_state(_dashScanBtn, LV_STATE_DISABLED);
#endif
}

void Display::updateDashboard(float weight, bool stable,
                               const char* nfcInfo,
                               const char* colorInfo, uint8_t colorR, uint8_t colorG, uint8_t colorB,
                               float tempC, float humidity, float pressureHPa,
                               bool scanEnabled) {
    if (!_ready || _currentScreen != SCR_IDLE) return;

    // Weight
    if (_dashWeightLabel) {
        char wStr[24];
        if (isnan(weight) || weight < 0.5f)
            snprintf(wStr, sizeof(wStr), "0.0 g");
        else
            snprintf(wStr, sizeof(wStr), "%.1f g", weight);
        lv_label_set_text(_dashWeightLabel, wStr);
    }
    // STABLE/READING badge
    if (_dashWeightBadge) {
        lv_obj_set_style_bg_color(_dashWeightBadge, stable ? liveGreen : signalOrange, 0);
        if (_dashWeightBadgeLbl) {
            lv_label_set_text(_dashWeightBadgeLbl, stable ? "STABLE" : "READING");
        }
    }

    // NFC — show tag format, detail, and UID
    if (_dashNfcLabel) {
        if (nfcInfo)
            lv_label_set_text(_dashNfcLabel, nfcInfo);
        else
            lv_label_set_text(_dashNfcLabel, "Waiting for tag...");
    }

    // Scan button enable/disable
#ifdef BOARD_SCAN_TOUCH
    setScanButtonEnabled(scanEnabled);
#endif
}

void Display::updateNfcLookup(const char* productName, const char* material,
                              const char* returnLocation, bool isKnown,
                              int emptySlotCount) {
    if (!_ready || _currentScreen != SCR_IDLE) return;

    if (_dashNfcLabel) {
        if (isKnown && productName) {
            lv_label_set_text(_dashNfcLabel, productName);
            lv_obj_set_style_text_color(_dashNfcLabel, makerCyan, 0);
        } else {
            lv_label_set_text(_dashNfcLabel, "Unknown tag");
            lv_obj_set_style_text_color(_dashNfcLabel, white, 0);
        }
    }

    if (_dashNfcDetail) {
        if (isKnown) {
            char detailBuf[128];
            if (material && material[0])
                snprintf(detailBuf, sizeof(detailBuf), "%s", material);
            else
                detailBuf[0] = '\0';
            lv_label_set_text(_dashNfcDetail, detailBuf);
        } else {
            lv_label_set_text(_dashNfcDetail, "Tag not linked to a spool");
        }
    }

    // Show return location on UID line, and show/hide cycle buttons
    if (_dashNfcUid) {
        if (isKnown && returnLocation && returnLocation[0]) {
            lv_label_set_text(_dashNfcUid, returnLocation);
        } else if (isKnown) {
            lv_label_set_text(_dashNfcUid, "No storage location");
        }
    }

    // Show/hide location cycling buttons when there are empty slots
    bool showCycle = isKnown && emptySlotCount > 0;
    if (_dashLocPrevBtn) {
        if (showCycle) lv_obj_clear_flag(_dashLocPrevBtn, LV_OBJ_FLAG_HIDDEN);
        else lv_obj_add_flag(_dashLocPrevBtn, LV_OBJ_FLAG_HIDDEN);
    }
    if (_dashLocNextBtn) {
        if (showCycle) lv_obj_clear_flag(_dashLocNextBtn, LV_OBJ_FLAG_HIDDEN);
        else lv_obj_add_flag(_dashLocNextBtn, LV_OBJ_FLAG_HIDDEN);
    }
    if (_dashLocCounter) {
        if (showCycle) {
            // Total = original slot + empty slots (but original might not exist)
            int total = emptySlotCount + (returnLocation && returnLocation[0] ? 1 : 0);
            char counterBuf[16];
            snprintf(counterBuf, sizeof(counterBuf), "1/%d", total);
            lv_label_set_text(_dashLocCounter, counterBuf);
            lv_obj_clear_flag(_dashLocCounter, LV_OBJ_FLAG_HIDDEN);
        } else {
            lv_obj_add_flag(_dashLocCounter, LV_OBJ_FLAG_HIDDEN);
        }
    }
}

void Display::updateReturnLocation(const char* location, int currentIndex, int totalCount) {
    if (!_ready || _currentScreen != SCR_IDLE) return;

    if (_dashNfcUid) {
        if (location && location[0]) {
            lv_label_set_text(_dashNfcUid, location);
        } else {
            lv_label_set_text(_dashNfcUid, "No storage location");
        }
    }

    if (_dashLocCounter && totalCount > 0) {
        char counterBuf[16];
        snprintf(counterBuf, sizeof(counterBuf), "%d/%d", currentIndex + 1, totalCount);
        lv_label_set_text(_dashLocCounter, counterBuf);
    }
}

void Display::setScanButtonLabel(const char* label) {
    if (!_dashScanBtnLabel) return;
    lv_label_set_text(_dashScanBtnLabel, label);
}

void Display::setScanButtonEnabled(bool enabled) {
    if (!_dashScanBtn) return;
    if (enabled) {
        lv_obj_clear_state(_dashScanBtn, LV_STATE_DISABLED);
    } else {
        lv_obj_add_state(_dashScanBtn, LV_STATE_DISABLED);
    }
}

// ── Result Screen ────────────────────────────────────────────

void Display::buildResultScreen(const ScanResponse* resp, float weight, const char* sessionUrl, uint8_t icons) {
    clearScreen();
    _currentScreen = SCR_RESULT;

    createStatusBar(_screen, icons);

    if (resp && resp->identified && resp->itemName[0]) {
        // Identified — determine item type
        bool isFilament = (resp->material[0] != '\0') ||
                          (resp->nozzleTempMin > 0) || (resp->bedTemp > 0) ||
                          (strcmp(resp->itemType, "filament") == 0);
        bool hasColor = (resp->colorR || resp->colorG || resp->colorB);

        // Color swatch (circle) or category icon
        lv_obj_t* swatch = lv_obj_create(_screen);
        lv_obj_remove_style_all(swatch);
        lv_obj_set_size(swatch, 56, 56);
        lv_obj_set_style_bg_color(swatch, hasColor ? lv_color_make(resp->colorR, resp->colorG, resp->colorB)
                                                   : blueprintSlate, 0);
        lv_obj_set_style_bg_opa(swatch, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(swatch, 28, 0);  // Circle
        lv_obj_set_style_border_color(swatch, toolGray, 0);
        lv_obj_set_style_border_width(swatch, hasColor ? 0 : 1, 0);
        lv_obj_align(swatch, LV_ALIGN_TOP_LEFT, 12, 12);

        if (!hasColor) {
            lv_obj_t* iconLbl = lv_label_create(swatch);
            lv_label_set_text(iconLbl, LV_SYMBOL_OK);
            lv_obj_set_style_text_font(iconLbl, &lv_font_montserrat_20, 0);
            lv_obj_set_style_text_color(iconLbl, liveGreen, 0);
            lv_obj_center(iconLbl);
        }

        // Product name
        int infoX = 80;
        int infoW = _screenW - infoX - 8;

        char nameBuf[32];
        strncpy(nameBuf, resp->itemName, sizeof(nameBuf) - 1);
        nameBuf[sizeof(nameBuf) - 1] = '\0';
        _resultName = lv_label_create(_screen);
        lv_label_set_text(_resultName, nameBuf);
        lv_obj_set_style_text_font(_resultName, &lv_font_montserrat_20, 0);
        lv_obj_set_style_text_color(_resultName, white, 0);
        lv_obj_set_width(_resultName, infoW);
        lv_label_set_long_mode(_resultName, LV_LABEL_LONG_DOT);
        lv_obj_align(_resultName, LV_ALIGN_TOP_LEFT, infoX, 12);

        // Weight
        char wStr[16];
        snprintf(wStr, sizeof(wStr), "%.0f g", weight);
        _resultWeight = makeLabel(_screen, &lv_font_montserrat_16, makerCyan,
                                   LV_ALIGN_TOP_LEFT, infoX, 36, wStr);

        // Detail line — depends on item type
        if (isFilament && (resp->nozzleTempMin > 0 || resp->bedTemp > 0)) {
            char tempStr[48];
            int pos = 0;
            if (resp->material[0])
                pos += snprintf(tempStr + pos, sizeof(tempStr) - pos, "%s  ", resp->material);
            if (resp->nozzleTempMin > 0)
                pos += snprintf(tempStr + pos, sizeof(tempStr) - pos,
                                "%d-%d\xC2\xB0" "C", resp->nozzleTempMin, resp->nozzleTempMax);
            if (resp->bedTemp > 0)
                pos += snprintf(tempStr + pos, sizeof(tempStr) - pos,
                                "  Bed %d\xC2\xB0" "C", resp->bedTemp);
            _resultDetail = makeLabel(_screen, &lv_font_montserrat_12, toolGray,
                                       LV_ALIGN_TOP_LEFT, infoX, 56, tempStr);
        } else if (resp->itemType[0]) {
            // Non-filament: show item type
            _resultDetail = makeLabel(_screen, &lv_font_montserrat_12, toolGray,
                                       LV_ALIGN_TOP_LEFT, infoX, 56, resp->itemType);
        }

        // QR code for session URL (right side, below info)
        if (sessionUrl && sessionUrl[0]) {
            QRCode qrcode;
            uint8_t qrcodeData[512];
            int8_t qrResult = -1;
            for (uint8_t ver = 4; ver <= 8; ver++) {
                qrResult = qrcode_initText(&qrcode, qrcodeData, ver, ECC_LOW, sessionUrl);
                if (qrResult == 0) break;
            }
            if (qrResult == 0) {
                int availH = _screenH - 80 - 58 - 16;
                int maxSize = min(availH, _screenW / 2);
                int scale = maxSize / (qrcode.size + 4);
                if (scale < 2) scale = 2;
                int qrPx = qrcode.size * scale;
                int margin = scale * 2;
                int totalSize = qrPx + margin * 2;

                lv_obj_t* qrBg = lv_obj_create(_screen);
                lv_obj_remove_style_all(qrBg);
                lv_obj_set_size(qrBg, totalSize, totalSize);
                lv_obj_set_style_bg_color(qrBg, white, 0);
                lv_obj_set_style_bg_opa(qrBg, LV_OPA_COVER, 0);
                lv_obj_set_style_radius(qrBg, 4, 0);
                lv_obj_align(qrBg, LV_ALIGN_TOP_RIGHT, -8, 76);

                lv_obj_t* canvasObj = lv_canvas_create(qrBg);
                size_t canvasBufSize = totalSize * totalSize;
                if (qrCanvasBuf) { free(qrCanvasBuf); qrCanvasBuf = nullptr; }
                qrCanvasBuf = (uint8_t*)heap_caps_malloc(canvasBufSize, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
                if (!qrCanvasBuf) qrCanvasBuf = (uint8_t*)malloc(canvasBufSize);
                if (qrCanvasBuf) {
                    memset(qrCanvasBuf, 0xFF, canvasBufSize);
                    lv_canvas_set_buffer(canvasObj, qrCanvasBuf, totalSize, totalSize, LV_COLOR_FORMAT_L8);
                    lv_obj_align(canvasObj, LV_ALIGN_CENTER, 0, 0);

                    for (uint8_t y = 0; y < qrcode.size; y++) {
                        for (uint8_t x = 0; x < qrcode.size; x++) {
                            if (qrcode_getModule(&qrcode, x, y)) {
                                for (int sy = 0; sy < scale; sy++) {
                                    for (int sx = 0; sx < scale; sx++) {
                                        lv_canvas_set_px(canvasObj, margin + x * scale + sx,
                                                         margin + y * scale + sy,
                                                         lv_color_black(), LV_OPA_COVER);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    } else {
        // Unknown — needs enrichment
        // Question mark circle
        lv_obj_t* qBox = lv_obj_create(_screen);
        lv_obj_remove_style_all(qBox);
        lv_obj_set_size(qBox, 56, 56);
        lv_obj_set_style_bg_color(qBox, blueprintSlate, 0);
        lv_obj_set_style_bg_opa(qBox, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(qBox, 28, 0);
        lv_obj_align(qBox, LV_ALIGN_TOP_LEFT, 12, 12);

        lv_obj_t* qMark = lv_label_create(qBox);
        lv_label_set_text(qMark, "?");
        lv_obj_set_style_text_font(qMark, &lv_font_montserrat_28, 0);
        lv_obj_set_style_text_color(qMark, white, 0);
        lv_obj_center(qMark);

        int infoX = 80;

        _resultTitle = makeLabel(_screen, &lv_font_montserrat_20, makerCyan,
                                  LV_ALIGN_TOP_LEFT, infoX, 12, "Unknown Item");

        char wStr[16];
        snprintf(wStr, sizeof(wStr), "%.1f g", weight);
        _resultWeight = makeLabel(_screen, &lv_font_montserrat_16, white,
                                   LV_ALIGN_TOP_LEFT, infoX, 36, wStr);

        _resultDetail = makeLabel(_screen, &lv_font_montserrat_12, toolGray,
                                   LV_ALIGN_TOP_LEFT, infoX, 56, "Scan QR to add details");

        // QR code for session URL
        if (sessionUrl && sessionUrl[0]) {
            QRCode qrcode;
            uint8_t qrcodeData[512];
            int8_t qrResult = -1;
            for (uint8_t ver = 4; ver <= 8; ver++) {
                qrResult = qrcode_initText(&qrcode, qrcodeData, ver, ECC_LOW, sessionUrl);
                if (qrResult == 0) break;
            }
            if (qrResult == 0) {
                int availH = _screenH - 80 - 58 - 16;
                int maxSize = min(availH, _screenW / 2);
                int scale = maxSize / (qrcode.size + 4);
                if (scale < 2) scale = 2;
                int qrPx = qrcode.size * scale;
                int margin = scale * 2;
                int totalSize = qrPx + margin * 2;

                lv_obj_t* qrBg = lv_obj_create(_screen);
                lv_obj_remove_style_all(qrBg);
                lv_obj_set_size(qrBg, totalSize, totalSize);
                lv_obj_set_style_bg_color(qrBg, white, 0);
                lv_obj_set_style_bg_opa(qrBg, LV_OPA_COVER, 0);
                lv_obj_set_style_radius(qrBg, 4, 0);
                lv_obj_align(qrBg, LV_ALIGN_TOP_MID, 0, 76);

                lv_obj_t* canvasObj = lv_canvas_create(qrBg);
                size_t canvasBufSize = totalSize * totalSize;
                if (qrCanvasBuf) { free(qrCanvasBuf); qrCanvasBuf = nullptr; }
                qrCanvasBuf = (uint8_t*)heap_caps_malloc(canvasBufSize, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
                if (!qrCanvasBuf) qrCanvasBuf = (uint8_t*)malloc(canvasBufSize);
                if (qrCanvasBuf) {
                    memset(qrCanvasBuf, 0xFF, canvasBufSize);
                    lv_canvas_set_buffer(canvasObj, qrCanvasBuf, totalSize, totalSize, LV_COLOR_FORMAT_L8);
                    lv_obj_align(canvasObj, LV_ALIGN_CENTER, 0, 0);

                    for (uint8_t y = 0; y < qrcode.size; y++) {
                        for (uint8_t x = 0; x < qrcode.size; x++) {
                            if (qrcode_getModule(&qrcode, x, y)) {
                                for (int sy = 0; sy < scale; sy++) {
                                    for (int sx = 0; sx < scale; sx++) {
                                        lv_canvas_set_px(canvasObj, margin + x * scale + sx,
                                                         margin + y * scale + sy,
                                                         lv_color_black(), LV_OPA_COVER);
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Bottom buttons — Done (left) + Print (right)
#ifdef BOARD_SCAN_TOUCH
    int btnGap = 8;
    int btnH = 44;
    int btnW = (_screenW - 24 - btnGap) / 2;

    // Done button (left)
    _resultDoneBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(_resultDoneBtn);
    lv_obj_set_size(_resultDoneBtn, btnW, btnH);
    lv_obj_align(_resultDoneBtn, LV_ALIGN_BOTTOM_LEFT, 12, -8);
    lv_obj_set_style_bg_color(_resultDoneBtn, blueprintSlate, 0);
    lv_obj_set_style_bg_opa(_resultDoneBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(_resultDoneBtn, 10, 0);
    lv_obj_set_style_border_color(_resultDoneBtn, toolGray, 0);
    lv_obj_set_style_border_width(_resultDoneBtn, 1, 0);
    lv_obj_add_event_cb(_resultDoneBtn, onDoneBtnClick, LV_EVENT_CLICKED, NULL);

    lv_obj_t* doneLbl = lv_label_create(_resultDoneBtn);
    lv_label_set_text(doneLbl, "DONE");
    lv_obj_set_style_text_font(doneLbl, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(doneLbl, white, 0);
    lv_obj_center(doneLbl);

    // Print button (right)
    _resultPrintBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(_resultPrintBtn);
    lv_obj_set_size(_resultPrintBtn, btnW, btnH);
    lv_obj_align(_resultPrintBtn, LV_ALIGN_BOTTOM_RIGHT, -12, -8);
    lv_obj_set_style_bg_color(_resultPrintBtn, makerCyan, 0);
    lv_obj_set_style_bg_opa(_resultPrintBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(_resultPrintBtn, 10, 0);
    lv_obj_add_event_cb(_resultPrintBtn, onPrintBtnClick, LV_EVENT_CLICKED, NULL);

    lv_obj_t* printLbl = lv_label_create(_resultPrintBtn);
    lv_label_set_text(printLbl, LV_SYMBOL_DOWNLOAD " PRINT");
    lv_obj_set_style_text_font(printLbl, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(printLbl, white, 0);
    lv_obj_center(printLbl);
#endif

    // No lv_refr_now — let lv_timer_handler() handle it on next tick
}

void Display::showResult(const ScanResponse* resp, float weight, const char* sessionUrl) {
    if (!_ready) return;

    uint8_t icons = 0;
    // Icons will be updated by the next update() call
    buildResultScreen(resp, weight, sessionUrl, _lastIcons);
}

// ── Unknown / Scanning Screen ────────────────────────────────

void Display::buildUnknownScreen(float weight, bool stable,
                                  const ColorData* color,
                                  uint8_t icons) {
    clearScreen();
    _currentScreen = SCR_UNKNOWN;

    createStatusBar(_screen, icons);

    // Large weight reading top center
    char wStr[16];
    snprintf(wStr, sizeof(wStr), "%.1f g", weight);
    _weightLabel = makeLabel(_screen, &lv_font_montserrat_28, white,
                             LV_ALIGN_TOP_MID, 0, 14, wStr);

    // STABLE/READING badge
    lv_obj_t* badge = lv_obj_create(_screen);
    lv_obj_remove_style_all(badge);
    lv_obj_set_size(badge, LV_SIZE_CONTENT, 18);
    lv_obj_set_style_bg_color(badge, stable ? liveGreen : signalOrange, 0);
    lv_obj_set_style_bg_opa(badge, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(badge, 9, 0);
    lv_obj_set_style_pad_hor(badge, 10, 0);
    lv_obj_set_style_pad_ver(badge, 2, 0);
    lv_obj_align(badge, LV_ALIGN_TOP_MID, 0, 46);

    lv_obj_t* badgeLbl = lv_label_create(badge);
    lv_label_set_text(badgeLbl, stable ? "STABLE" : "READING");
    lv_obj_set_style_text_font(badgeLbl, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(badgeLbl, deepWorkshop, 0);
    lv_obj_center(badgeLbl);

    // 2x2 sensor grid with detected data
    int panelW = (_screenW / 2) - 12;
    int panelH = 52;
    int gridTop = 70;
    int gridGap = 6;
    int gridLeft = 8;
    int gridMidX = gridLeft + panelW + gridGap;

    // --- NFC panel (top-left) ---
    lv_obj_t* nfcPanel = lv_obj_create(_screen);
    lv_obj_remove_style_all(nfcPanel);
    lv_obj_set_size(nfcPanel, panelW, panelH);
    lv_obj_set_style_bg_color(nfcPanel, blueprintSlate, 0);
    lv_obj_set_style_bg_opa(nfcPanel, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(nfcPanel, 6, 0);
    lv_obj_set_style_pad_all(nfcPanel, 6, 0);
    lv_obj_set_pos(nfcPanel, gridLeft, gridTop);

    makeLabel(nfcPanel, &lv_font_montserrat_12, toolGray,
              LV_ALIGN_TOP_LEFT, 0, 0, "NFC");
    makeLabel(nfcPanel, &lv_font_montserrat_14, white,
              LV_ALIGN_BOTTOM_LEFT, 0, 0, "No tag");

    // --- Color panel (top-right) ---
    lv_obj_t* colorPanel = lv_obj_create(_screen);
    lv_obj_remove_style_all(colorPanel);
    lv_obj_set_size(colorPanel, panelW, panelH);
    lv_obj_set_style_bg_color(colorPanel, blueprintSlate, 0);
    lv_obj_set_style_bg_opa(colorPanel, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(colorPanel, 6, 0);
    lv_obj_set_style_pad_all(colorPanel, 6, 0);
    lv_obj_set_pos(colorPanel, gridMidX, gridTop);

    makeLabel(colorPanel, &lv_font_montserrat_12, toolGray,
              LV_ALIGN_TOP_LEFT, 0, 0, "Color");

    // Color swatch + hex if color detected
    if (color && color->valid) {
        uint8_t r8 = 0, g8 = 0, b8 = 0;
        if (color->sensorType == COLOR_AS7341 || color->sensorType == COLOR_AS7343) {
            uint16_t maxVal = max(max(color->f8_680nm, color->f5_555nm), color->f3_480nm);
            if (maxVal > 0) {
                r8 = (uint8_t)min(255, (int)(color->f8_680nm * 255L / maxVal));
                g8 = (uint8_t)min(255, (int)(color->f5_555nm * 255L / maxVal));
                b8 = (uint8_t)min(255, (int)(color->f3_480nm * 255L / maxVal));
            }
        } else if (color->sensorType == COLOR_TCS34725) {
            r8 = color->rgbc_r >> 8;
            g8 = color->rgbc_g >> 8;
            b8 = color->rgbc_b >> 8;
        } else if (color->sensorType == COLOR_OPT4048) {
            float sum = color->cie_x + color->cie_y + color->cie_z;
            if (sum > 0) {
                r8 = (uint8_t)min(255.0f, color->cie_x / sum * 255.0f * 2.0f);
                g8 = (uint8_t)min(255.0f, color->cie_y / sum * 255.0f * 2.0f);
                b8 = (uint8_t)min(255.0f, color->cie_z / sum * 255.0f * 2.0f);
            }
        }
        _colorSwatch = lv_obj_create(colorPanel);
        lv_obj_remove_style_all(_colorSwatch);
        lv_obj_set_size(_colorSwatch, 18, 18);
        lv_obj_set_style_bg_color(_colorSwatch, lv_color_make(r8, g8, b8), 0);
        lv_obj_set_style_bg_opa(_colorSwatch, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(_colorSwatch, 9, 0);
        lv_obj_set_style_border_color(_colorSwatch, grayLight, 0);
        lv_obj_set_style_border_width(_colorSwatch, 1, 0);
        lv_obj_align(_colorSwatch, LV_ALIGN_BOTTOM_LEFT, 0, 0);

        char hexStr[10];
        snprintf(hexStr, sizeof(hexStr), "#%02X%02X%02X", r8, g8, b8);
        makeLabel(colorPanel, &lv_font_montserrat_12, white,
                  LV_ALIGN_BOTTOM_LEFT, 22, 0, hexStr);
    } else {
        makeLabel(colorPanel, &lv_font_montserrat_14, white,
                  LV_ALIGN_BOTTOM_LEFT, 0, 0, "--");
    }

    // --- Environment panel (bottom-left) ---
    lv_obj_t* envPanel = lv_obj_create(_screen);
    lv_obj_remove_style_all(envPanel);
    lv_obj_set_size(envPanel, panelW, panelH);
    lv_obj_set_style_bg_color(envPanel, blueprintSlate, 0);
    lv_obj_set_style_bg_opa(envPanel, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(envPanel, 6, 0);
    lv_obj_set_style_pad_all(envPanel, 6, 0);
    lv_obj_set_pos(envPanel, gridLeft, gridTop + panelH + gridGap);

    makeLabel(envPanel, &lv_font_montserrat_12, toolGray,
              LV_ALIGN_TOP_LEFT, 0, 0, "Environment");
    makeLabel(envPanel, &lv_font_montserrat_14, white,
              LV_ALIGN_BOTTOM_LEFT, 0, 0, "--");

    // Bottom message area
    makeLabel(_screen, &lv_font_montserrat_16, makerCyan,
              LV_ALIGN_BOTTOM_MID, 0, -32, "Unidentified Item");

    makeLabel(_screen, &lv_font_montserrat_12, toolGray,
              LV_ALIGN_BOTTOM_MID, 0, -12, "Tap screen or scan QR to add details");

    // Touch-to-submit: make the screen tappable
#ifdef BOARD_SCAN_TOUCH
    lv_obj_add_flag(_screen, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(_screen, onSubmitTap, LV_EVENT_CLICKED, NULL);
#endif
}

// ── Identified Screen ────────────────────────────────────────

void Display::buildIdentifiedScreen(float weight, bool stable,
                                     const ScanResponse& resp,
                                     uint8_t icons) {
    clearScreen();
    _currentScreen = SCR_IDENTIFIED;

    createStatusBar(_screen, icons);

    // Determine if this is a filament/spool item (has material or temp data)
    bool isFilament = (resp.material[0] != '\0') ||
                      (resp.nozzleTempMin > 0) || (resp.bedTemp > 0) ||
                      (strcmp(resp.itemType, "filament") == 0);
    bool hasColor = (resp.colorR || resp.colorG || resp.colorB);

    // Left side: color swatch (circle) + weight
    lv_obj_t* swatch = lv_obj_create(_screen);
    lv_obj_remove_style_all(swatch);
    lv_obj_set_size(swatch, 56, 56);
    lv_obj_set_style_bg_color(swatch, hasColor ? lv_color_make(resp.colorR, resp.colorG, resp.colorB)
                                               : blueprintSlate, 0);
    lv_obj_set_style_bg_opa(swatch, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(swatch, 28, 0);  // Circle
    lv_obj_set_style_border_color(swatch, toolGray, 0);
    lv_obj_set_style_border_width(swatch, hasColor ? 0 : 1, 0);
    lv_obj_align(swatch, LV_ALIGN_TOP_LEFT, 12, 14);

    // If no color, show "?" in the swatch
    if (!hasColor) {
        lv_obj_t* qMark = lv_label_create(swatch);
        lv_label_set_text(qMark, "?");
        lv_obj_set_style_text_font(qMark, &lv_font_montserrat_24, 0);
        lv_obj_set_style_text_color(qMark, toolGray, 0);
        lv_obj_center(qMark);
    }

    // Weight below swatch in cyan
    char wStr[16];
    snprintf(wStr, sizeof(wStr), "%.0f g", weight);
    _weightLabel = makeLabel(_screen, &lv_font_montserrat_16, makerCyan,
                             LV_ALIGN_TOP_LEFT, 16, 74, wStr);

    // Right side: product info
    int infoX = 80;
    int infoW = _screenW - infoX - 8;

    // Product name (bold/large)
    char nameBuf[32];
    strncpy(nameBuf, resp.itemName, sizeof(nameBuf) - 1);
    nameBuf[sizeof(nameBuf) - 1] = '\0';
    _itemName = lv_label_create(_screen);
    lv_label_set_text(_itemName, nameBuf);
    lv_obj_set_style_text_font(_itemName, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(_itemName, white, 0);
    lv_obj_set_width(_itemName, infoW);
    lv_label_set_long_mode(_itemName, LV_LABEL_LONG_DOT);
    lv_obj_align(_itemName, LV_ALIGN_TOP_LEFT, infoX, 14);

    if (isFilament) {
        // Material + type label (e.g. "PLA - Filament")
        char matLine[48];
        if (resp.material[0])
            snprintf(matLine, sizeof(matLine), "%s - %s", resp.material, resp.itemType[0] ? resp.itemType : "Filament");
        else
            snprintf(matLine, sizeof(matLine), "%s", resp.itemType[0] ? resp.itemType : "Filament");
        _materialLabel = makeLabel(_screen, &lv_font_montserrat_14, toolGray,
                                    LV_ALIGN_TOP_LEFT, infoX, 38, matLine);

        // Temperature info
        if (resp.nozzleTempMin > 0 || resp.bedTemp > 0) {
            char tempStr[48];
            int pos = 0;
            if (resp.nozzleTempMin > 0)
                pos += snprintf(tempStr + pos, sizeof(tempStr) - pos,
                                "%d-%d\xC2\xB0" "C", resp.nozzleTempMin, resp.nozzleTempMax);
            if (resp.bedTemp > 0)
                pos += snprintf(tempStr + pos, sizeof(tempStr) - pos,
                                "%sBed %d\xC2\xB0" "C", pos > 0 ? "  " : "", resp.bedTemp);
            _tempLabel = makeLabel(_screen, &lv_font_montserrat_14, grayLight,
                                    LV_ALIGN_TOP_LEFT, infoX, 56, tempStr);
        }
    } else {
        // Non-filament items: show category/type + weight info
        if (resp.itemType[0]) {
            char typeLine[48];
            snprintf(typeLine, sizeof(typeLine), "%s", resp.itemType);
            // Capitalize first letter
            if (typeLine[0] >= 'a' && typeLine[0] <= 'z') typeLine[0] -= 32;
            _materialLabel = makeLabel(_screen, &lv_font_montserrat_14, toolGray,
                                        LV_ALIGN_TOP_LEFT, infoX, 38, typeLine);
        }

    }

    // Return location banner — shown when this spool is already in inventory
    if (resp.isExisting && resp.returnLocation[0]) {
        // Full-width banner with location icon + path
        lv_obj_t* returnBanner = lv_obj_create(_screen);
        lv_obj_remove_style_all(returnBanner);
        lv_obj_set_size(returnBanner, _screenW - 16, 36);
        lv_obj_set_style_bg_color(returnBanner, lv_color_hex(0x002A36), 0); // darker cyan tint
        lv_obj_set_style_bg_opa(returnBanner, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(returnBanner, 8, 0);
        lv_obj_set_style_border_color(returnBanner, makerCyan, 0);
        lv_obj_set_style_border_width(returnBanner, 1, 0);
        lv_obj_align(returnBanner, LV_ALIGN_TOP_LEFT, 8, 96);

        makeLabel(returnBanner, &lv_font_montserrat_12, makerCyan,
                  LV_ALIGN_LEFT_MID, 10, 0, "RETURN TO:");

        lv_obj_t* locLbl = lv_label_create(returnBanner);
        lv_label_set_text(locLbl, resp.returnLocation);
        lv_obj_set_style_text_font(locLbl, &lv_font_montserrat_14, 0);
        lv_obj_set_style_text_color(locLbl, white, 0);
        lv_obj_set_width(locLbl, _screenW - 130);
        lv_label_set_long_mode(locLbl, LV_LABEL_LONG_DOT);
        lv_obj_align(locLbl, LV_ALIGN_LEFT_MID, 95, 0);
    } else if (resp.nfcTagFormat[0]) {
        // NFC format badge (pill) — only when not showing return location
        lv_obj_t* nfcBadge = lv_obj_create(_screen);
        lv_obj_remove_style_all(nfcBadge);
        lv_obj_set_size(nfcBadge, LV_SIZE_CONTENT, 18);
        lv_obj_set_style_bg_color(nfcBadge, blueprintSlate, 0);
        lv_obj_set_style_bg_opa(nfcBadge, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(nfcBadge, 9, 0);
        lv_obj_set_style_pad_hor(nfcBadge, 8, 0);
        lv_obj_set_style_pad_ver(nfcBadge, 2, 0);
        lv_obj_align(nfcBadge, LV_ALIGN_TOP_LEFT, 80, 96);

        lv_obj_t* nfcLbl = lv_label_create(nfcBadge);
        lv_label_set_text(nfcLbl, resp.nfcTagFormat);
        lv_obj_set_style_text_font(nfcLbl, &lv_font_montserrat_12, 0);
        lv_obj_set_style_text_color(nfcLbl, grayLight, 0);
        lv_obj_center(nfcLbl);
    }

    // Done + Print buttons (touch boards)
#ifdef BOARD_SCAN_TOUCH
    int btnGap = 8;
    int btnH = 42;
    int btnW = (_screenW - 24 - btnGap) / 2;
    int btnY = -30;

    // Done button (left)
    _resultDoneBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(_resultDoneBtn);
    lv_obj_set_size(_resultDoneBtn, btnW, btnH);
    lv_obj_align(_resultDoneBtn, LV_ALIGN_BOTTOM_LEFT, 12, btnY);
    lv_obj_set_style_bg_color(_resultDoneBtn, blueprintSlate, 0);
    lv_obj_set_style_bg_opa(_resultDoneBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(_resultDoneBtn, 10, 0);
    lv_obj_set_style_border_color(_resultDoneBtn, toolGray, 0);
    lv_obj_set_style_border_width(_resultDoneBtn, 1, 0);
    lv_obj_add_event_cb(_resultDoneBtn, onDoneBtnClick, LV_EVENT_CLICKED, NULL);

    lv_obj_t* doneLbl = lv_label_create(_resultDoneBtn);
    lv_label_set_text(doneLbl, "DONE");
    lv_obj_set_style_text_font(doneLbl, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(doneLbl, white, 0);
    lv_obj_center(doneLbl);

    // Print button (right)
    _resultPrintBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(_resultPrintBtn);
    lv_obj_set_size(_resultPrintBtn, btnW, btnH);
    lv_obj_align(_resultPrintBtn, LV_ALIGN_BOTTOM_RIGHT, -12, btnY);
    lv_obj_set_style_bg_color(_resultPrintBtn, makerCyan, 0);
    lv_obj_set_style_bg_opa(_resultPrintBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(_resultPrintBtn, 10, 0);
    lv_obj_add_event_cb(_resultPrintBtn, onPrintBtnClick, LV_EVENT_CLICKED, NULL);

    lv_obj_t* printLbl = lv_label_create(_resultPrintBtn);
    lv_label_set_text(printLbl, LV_SYMBOL_DOWNLOAD " PRINT");
    lv_obj_set_style_text_font(printLbl, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(printLbl, white, 0);
    lv_obj_center(printLbl);
#endif
}

// ── Pending Command System (thread-safe main loop → LVGL task) ───

void Display::requestMessage(const char* line1, const char* line2) {
    strncpy(pendingLine1, line1 ? line1 : "", sizeof(pendingLine1) - 1);
    strncpy(pendingLine2, line2 ? line2 : "", sizeof(pendingLine2) - 1);
    pendingCmd = CMD_MESSAGE;
}

void Display::requestCalibrate(const char* step, const char* detail) {
    strncpy(pendingLine1, step ? step : "", sizeof(pendingLine1) - 1);
    strncpy(pendingLine2, detail ? detail : "", sizeof(pendingLine2) - 1);
    pendingCmd = CMD_CALIBRATE;
}

void Display::processPendingCmd() {
    if (pendingCmd == CMD_NONE) return;
    PendingCmd cmd = pendingCmd;
    pendingCmd = CMD_NONE;
    switch (cmd) {
        case CMD_MESSAGE:
            showMessage(pendingLine1, pendingLine2[0] ? pendingLine2 : nullptr);
            break;
        case CMD_CALIBRATE:
            showCalibrate(pendingLine1, pendingLine2[0] ? pendingLine2 : nullptr);
            break;
        default:
            break;
    }
}

// ── Message Screen ───────────────────────────────────────────

void Display::showMessage(const char* line1, const char* line2) {
    if (!_ready) return;

    clearScreen();
    _currentScreen = SCR_MESSAGE;

    // Two-pill logo
    lv_obj_t* pillL = lv_obj_create(_screen);
    lv_obj_remove_style_all(pillL);
    lv_obj_set_size(pillL, 10, 30);
    lv_obj_set_style_bg_color(pillL, makerCyan, 0);
    lv_obj_set_style_bg_opa(pillL, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(pillL, 5, 0);
    lv_obj_align(pillL, LV_ALIGN_CENTER, -9, -40);

    lv_obj_t* pillR = lv_obj_create(_screen);
    lv_obj_remove_style_all(pillR);
    lv_obj_set_size(pillR, 10, 30);
    lv_obj_set_style_bg_color(pillR, makerCyan, 0);
    lv_obj_set_style_bg_opa(pillR, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(pillR, 5, 0);
    lv_obj_align(pillR, LV_ALIGN_CENTER, 9, -40);

    _msgLine1 = makeLabel(_screen, &lv_font_montserrat_24, white,
                          LV_ALIGN_CENTER, 0, 5, line1);

    if (line2) {
        _msgLine2 = makeLabel(_screen, &lv_font_montserrat_14, toolGray,
                              LV_ALIGN_CENTER, 0, 40, line2);
    }

    lv_refr_now(NULL);
}

// ── Boot Screen ──────────────────────────────────────────────

void Display::showBootScreen(const char* version) {
    if (!_ready) return;

    clearScreen();
    _currentScreen = SCR_BOOT;
    _bootCount = 0;

    // Two-pill logo + title row
    lv_obj_t* pillL = lv_obj_create(_screen);
    lv_obj_remove_style_all(pillL);
    lv_obj_set_size(pillL, 8, 24);
    lv_obj_set_style_bg_color(pillL, makerCyan, 0);
    lv_obj_set_style_bg_opa(pillL, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(pillL, 4, 0);
    lv_obj_align(pillL, LV_ALIGN_TOP_LEFT, 10, 14);

    lv_obj_t* pillR = lv_obj_create(_screen);
    lv_obj_remove_style_all(pillR);
    lv_obj_set_size(pillR, 8, 24);
    lv_obj_set_style_bg_color(pillR, makerCyan, 0);
    lv_obj_set_style_bg_opa(pillR, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(pillR, 4, 0);
    lv_obj_align(pillR, LV_ALIGN_TOP_LEFT, 22, 14);

    char titleBuf[48];
    snprintf(titleBuf, sizeof(titleBuf), "FillaIQ  v%s", version);
    makeLabel(_screen, &lv_font_montserrat_16, white,
              LV_ALIGN_TOP_LEFT, 38, 16, titleBuf);

    // Divider
    lv_obj_t* div = lv_obj_create(_screen);
    lv_obj_remove_style_all(div);
    lv_obj_set_size(div, _screenW - 20, 1);
    lv_obj_set_style_bg_color(div, toolGray, 0);
    lv_obj_set_style_bg_opa(div, LV_OPA_50, 0);
    lv_obj_align(div, LV_ALIGN_TOP_LEFT, 10, 50);

    // Sensor list container — 2-column flex layout
    _bootList = lv_obj_create(_screen);
    lv_obj_remove_style_all(_bootList);
    lv_obj_set_size(_bootList, _screenW - 20, _screenH - 90);
    lv_obj_align(_bootList, LV_ALIGN_TOP_LEFT, 10, 56);
    lv_obj_set_flex_flow(_bootList, LV_FLEX_FLOW_ROW_WRAP);
    lv_obj_set_flex_align(_bootList, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_START);
    lv_obj_set_style_pad_column(_bootList, 4, 0);
    lv_obj_set_style_pad_row(_bootList, 4, 0);

    // Status line at bottom
    _bootStatus = makeLabel(_screen, &lv_font_montserrat_12, toolGray,
                             LV_ALIGN_BOTTOM_MID, 0, -6, "Initializing...");

    lv_refr_now(NULL);
}

void Display::addBootItem(const char* name, bool found) {
    if (!_ready || !_bootList) return;

    // Each item is a small row: icon + name, sized to fit ~2 columns
    lv_obj_t* item = lv_obj_create(_bootList);
    lv_obj_remove_style_all(item);
    lv_obj_set_size(item, (_screenW - 28) / 2, 20);
    lv_obj_set_flex_flow(item, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(item, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_column(item, 4, 0);

    lv_obj_t* icon = lv_label_create(item);
    lv_obj_remove_style_all(icon);
    lv_label_set_text(icon, found ? LV_SYMBOL_OK : LV_SYMBOL_CLOSE);
    lv_obj_set_style_text_font(icon, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(icon, found ? liveGreen : lv_color_hex(ALERT_ROSE_HEX), 0);

    lv_obj_t* lbl = lv_label_create(item);
    lv_obj_remove_style_all(lbl);
    lv_label_set_text(lbl, name);
    lv_obj_set_style_text_font(lbl, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(lbl, found ? white : grayLight, 0);

    _bootCount++;

    // Update status to show what was just detected
    if (_bootStatus) {
        char buf[48];
        snprintf(buf, sizeof(buf), "%s %s", found ? "Found" : "No", name);
        lv_label_set_text(_bootStatus, buf);
    }

    lv_refr_now(NULL);
}

void Display::setBootStatus(const char* msg) {
    if (!_ready || !_bootStatus) return;
    lv_label_set_text(_bootStatus, msg);
    lv_refr_now(NULL);
}

// ── Menu Screen ──────────────────────────────────────────────

static lv_obj_t* makeMenuBtn(lv_obj_t* parent, const char* icon, const char* text,
                              lv_event_cb_t cb, void* userData) {
    lv_obj_t* btn = lv_btn_create(parent);
    lv_obj_remove_style_all(btn);
    lv_obj_set_size(btn, lv_pct(100), 44);
    lv_obj_set_style_bg_color(btn, blueprintSlate, 0);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(btn, 8, 0);
    lv_obj_set_style_bg_color(btn, lv_color_hex(0x253540), LV_PART_MAIN | LV_STATE_PRESSED);
    lv_obj_set_flex_flow(btn, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(btn, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_left(btn, 12, 0);
    lv_obj_set_style_pad_column(btn, 10, 0);

    lv_obj_t* iconLbl = lv_label_create(btn);
    lv_label_set_text(iconLbl, icon);
    lv_obj_set_style_text_font(iconLbl, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(iconLbl, lv_color_hex(MAKER_CYAN_HEX), 0);

    lv_obj_t* textLbl = lv_label_create(btn);
    lv_label_set_text(textLbl, text);
    lv_obj_set_style_text_font(textLbl, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(textLbl, lv_color_hex(WHITE_HEX), 0);

    if (cb) lv_obj_add_event_cb(btn, cb, LV_EVENT_CLICKED, userData);
    return btn;
}

void Display::showMenu() {
    if (!_ready) return;
    buildMenuScreen();
}

void Display::buildMenuScreen() {
    clearScreen();
    _currentScreen = SCR_MENU;

    // Title bar
    makeLabel(_screen, &lv_font_montserrat_20, makerCyan,
              LV_ALIGN_TOP_LEFT, 12, 12, "Settings");

    // Divider
    lv_obj_t* div = lv_obj_create(_screen);
    lv_obj_remove_style_all(div);
    lv_obj_set_size(div, _screenW - 24, 1);
    lv_obj_set_style_bg_color(div, toolGray, 0);
    lv_obj_set_style_bg_opa(div, LV_OPA_50, 0);
    lv_obj_align(div, LV_ALIGN_TOP_LEFT, 12, 40);

    // Menu list container
    lv_obj_t* list = lv_obj_create(_screen);
    lv_obj_remove_style_all(list);
    lv_obj_set_size(list, _screenW - 24, _screenH - 90);
    lv_obj_align(list, LV_ALIGN_TOP_LEFT, 12, 48);
    lv_obj_set_flex_flow(list, LV_FLEX_FLOW_COLUMN);
    lv_obj_set_flex_align(list, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_row(list, 6, 0);

    makeMenuBtn(list, LV_SYMBOL_REFRESH, "Tare Scale",
                onMenuItemClick, (void*)(intptr_t)2);
    makeMenuBtn(list, LV_SYMBOL_EYE_OPEN, "Raw Sensors",
                onMenuItemClick, (void*)(intptr_t)3);
    makeMenuBtn(list, LV_SYMBOL_WIFI, "WiFi Setup",
                onMenuItemClick, (void*)(intptr_t)1);
    makeMenuBtn(list, LV_SYMBOL_BLUETOOTH, "Scan BLE Devices",
                onMenuItemClick, (void*)(intptr_t)7);
    makeMenuBtn(list, LV_SYMBOL_EDIT, "Calibrate Scale",
                onMenuItemClick, (void*)(intptr_t)4);
    makeMenuBtn(list, LV_SYMBOL_DOWNLOAD, "Check for Update",
                onMenuItemClick, (void*)(intptr_t)6);
    makeMenuBtn(list, LV_SYMBOL_POWER, "Reboot",
                onMenuItemClick, (void*)(intptr_t)5);

    // Device info line
    char info[64];
    snprintf(info, sizeof(info), "FillaScan v%s", FW_VERSION);
    makeLabel(_screen, &lv_font_montserrat_12, toolGray,
              LV_ALIGN_BOTTOM_LEFT, 12, -8, info);

    // Back button
    lv_obj_t* backBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(backBtn);
    lv_obj_set_size(backBtn, 60, 36);
    lv_obj_align(backBtn, LV_ALIGN_BOTTOM_RIGHT, -8, -4);
    lv_obj_set_style_bg_color(backBtn, blueprintSlate, 0);
    lv_obj_set_style_bg_opa(backBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(backBtn, 6, 0);
    lv_obj_add_event_cb(backBtn, onBackBtnClick, LV_EVENT_CLICKED, NULL);

    lv_obj_t* backLbl = lv_label_create(backBtn);
    lv_label_set_text(backLbl, LV_SYMBOL_LEFT " Back");
    lv_obj_set_style_text_font(backLbl, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(backLbl, lv_color_hex(WHITE_HEX), 0);
    lv_obj_center(backLbl);
}

// ── Raw Sensors Screen ───────────────────────────────────────

void Display::showRawSensors(const char* text) {
    if (!_ready) return;

    if (_currentScreen != SCR_RAW_SENSORS) {
        clearScreen();
        _currentScreen = SCR_RAW_SENSORS;

        makeLabel(_screen, &lv_font_montserrat_16, makerCyan,
                  LV_ALIGN_TOP_LEFT, 12, 6, "Raw Sensors");

        lv_obj_t* div = lv_obj_create(_screen);
        lv_obj_remove_style_all(div);
        lv_obj_set_size(div, _screenW - 24, 1);
        lv_obj_set_style_bg_color(div, toolGray, 0);
        lv_obj_set_style_bg_opa(div, LV_OPA_50, 0);
        lv_obj_align(div, LV_ALIGN_TOP_LEFT, 12, 28);

        _rawSensorsLabel = lv_label_create(_screen);
        lv_obj_set_style_text_font(_rawSensorsLabel, &lv_font_montserrat_12, 0);
        lv_obj_set_style_text_color(_rawSensorsLabel, lv_color_hex(WHITE_HEX), 0);
        lv_obj_set_width(_rawSensorsLabel, _screenW - 16);
        lv_label_set_long_mode(_rawSensorsLabel, LV_LABEL_LONG_WRAP);
        lv_obj_align(_rawSensorsLabel, LV_ALIGN_TOP_LEFT, 8, 34);

        // Back button
        lv_obj_t* backBtn = lv_btn_create(_screen);
        lv_obj_remove_style_all(backBtn);
        lv_obj_set_size(backBtn, 60, 30);
        lv_obj_align(backBtn, LV_ALIGN_BOTTOM_RIGHT, -8, -2);
        lv_obj_set_style_bg_color(backBtn, blueprintSlate, 0);
        lv_obj_set_style_bg_opa(backBtn, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(backBtn, 6, 0);
        lv_obj_add_event_cb(backBtn, onBackBtnClick, LV_EVENT_CLICKED, NULL);
        lv_obj_t* backLbl = lv_label_create(backBtn);
        lv_label_set_text(backLbl, LV_SYMBOL_LEFT " Back");
        lv_obj_set_style_text_font(backLbl, &lv_font_montserrat_14, 0);
        lv_obj_set_style_text_color(backLbl, lv_color_hex(WHITE_HEX), 0);
        lv_obj_center(backLbl);
    }

    lv_label_set_text(_rawSensorsLabel, text);
}

// ── Calibrate Screen ─────────────────────────────────────────

void Display::showCalibrate(const char* step, const char* detail) {
    if (!_ready) return;

    if (_currentScreen != SCR_CALIBRATE) {
        clearScreen();
        _currentScreen = SCR_CALIBRATE;

        makeLabel(_screen, &lv_font_montserrat_20, makerCyan,
                  LV_ALIGN_TOP_LEFT, 12, 12, "Calibrate");

        lv_obj_t* div = lv_obj_create(_screen);
        lv_obj_remove_style_all(div);
        lv_obj_set_size(div, _screenW - 24, 1);
        lv_obj_set_style_bg_color(div, toolGray, 0);
        lv_obj_set_style_bg_opa(div, LV_OPA_50, 0);
        lv_obj_align(div, LV_ALIGN_TOP_LEFT, 12, 40);

        _calStepLabel = lv_label_create(_screen);
        lv_obj_set_style_text_font(_calStepLabel, &lv_font_montserrat_20, 0);
        lv_obj_set_style_text_color(_calStepLabel, lv_color_hex(WHITE_HEX), 0);
        lv_obj_set_width(_calStepLabel, _screenW - 32);
        lv_label_set_long_mode(_calStepLabel, LV_LABEL_LONG_WRAP);
        lv_obj_align(_calStepLabel, LV_ALIGN_TOP_LEFT, 16, 56);

        _calDetailLabel = lv_label_create(_screen);
        lv_obj_set_style_text_font(_calDetailLabel, &lv_font_montserrat_16, 0);
        lv_obj_set_style_text_color(_calDetailLabel, grayLight, 0);
        lv_obj_set_width(_calDetailLabel, _screenW - 32);
        lv_label_set_long_mode(_calDetailLabel, LV_LABEL_LONG_WRAP);
        lv_obj_align(_calDetailLabel, LV_ALIGN_TOP_LEFT, 16, 100);

        // Continue button (proceeds to next calibration step)
        lv_obj_t* continueBtn = lv_btn_create(_screen);
        lv_obj_remove_style_all(continueBtn);
        lv_obj_set_size(continueBtn, _screenW - 24, 44);
        lv_obj_align(continueBtn, LV_ALIGN_BOTTOM_MID, 0, -48);
        lv_obj_set_style_bg_color(continueBtn, makerCyan, 0);
        lv_obj_set_style_bg_opa(continueBtn, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(continueBtn, 8, 0);
        lv_obj_add_event_cb(continueBtn, onSubmitTap, LV_EVENT_CLICKED, NULL);
        lv_obj_t* contLbl = lv_label_create(continueBtn);
        lv_label_set_text(contLbl, "Continue");
        lv_obj_set_style_text_font(contLbl, &lv_font_montserrat_16, 0);
        lv_obj_set_style_text_color(contLbl, lv_color_hex(WHITE_HEX), 0);
        lv_obj_center(contLbl);

        // Back button (exits calibration)
        lv_obj_t* backBtn = lv_btn_create(_screen);
        lv_obj_remove_style_all(backBtn);
        lv_obj_set_size(backBtn, 60, 36);
        lv_obj_align(backBtn, LV_ALIGN_BOTTOM_RIGHT, -8, -4);
        lv_obj_set_style_bg_color(backBtn, blueprintSlate, 0);
        lv_obj_set_style_bg_opa(backBtn, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(backBtn, 6, 0);
        lv_obj_add_event_cb(backBtn, onBackBtnClick, LV_EVENT_CLICKED, NULL);
        lv_obj_t* backLbl = lv_label_create(backBtn);
        lv_label_set_text(backLbl, LV_SYMBOL_LEFT " Back");
        lv_obj_set_style_text_font(backLbl, &lv_font_montserrat_14, 0);
        lv_obj_set_style_text_color(backLbl, lv_color_hex(WHITE_HEX), 0);
        lv_obj_center(backLbl);
    }

    lv_label_set_text(_calStepLabel, step);
    lv_label_set_text(_calDetailLabel, detail ? detail : "");
    lv_refr_now(NULL);
}

// ── Pairing Code Screen ──────────────────────────────────────

void Display::showPairingCode(const char* code) {
    if (!_ready) return;

    clearScreen();
    _currentScreen = SCR_PAIRING;

    // Title
    makeLabel(_screen, &lv_font_montserrat_16, white,
              LV_ALIGN_TOP_MID, 0, 10, "Pair Device");

    // Generate QR code with pairing URL
    char qrData[128];
    snprintf(qrData, sizeof(qrData), "https://fillaiq.com/hardware?pair=%s", code);

    QRCode qrcode;
    uint8_t qrcodeData[512];
    int8_t result = -1;
    for (uint8_t ver = 5; ver <= 8; ver++) {
        result = qrcode_initText(&qrcode, qrcodeData, ver, ECC_LOW, qrData);
        if (result == 0) break;
    }

    if (result == 0) {
        int availH = _screenH - 120;
        int availW = _screenW - 40;
        int maxPx = min(availH, availW);
        int scale = maxPx / (qrcode.size + 4);
        if (scale < 1) scale = 1;
        int qrPx = qrcode.size * scale;
        int margin = scale * 2;
        int totalSize = qrPx + margin * 2;

        lv_obj_t* qrBg = lv_obj_create(_screen);
        lv_obj_remove_style_all(qrBg);
        lv_obj_set_size(qrBg, totalSize, totalSize);
        lv_obj_set_style_bg_color(qrBg, white, 0);
        lv_obj_set_style_bg_opa(qrBg, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(qrBg, 4, 0);
        lv_obj_align(qrBg, LV_ALIGN_TOP_MID, 0, 34);

        for (uint8_t y = 0; y < qrcode.size; y++) {
            for (uint8_t x = 0; x < qrcode.size; x++) {
                if (qrcode_getModule(&qrcode, x, y)) {
                    lv_obj_t* px = lv_obj_create(qrBg);
                    lv_obj_remove_style_all(px);
                    lv_obj_set_size(px, scale, scale);
                    lv_obj_set_pos(px, margin + x * scale, margin + y * scale);
                    lv_obj_set_style_bg_color(px, lv_color_black(), 0);
                    lv_obj_set_style_bg_opa(px, LV_OPA_COVER, 0);
                }
            }
        }
    }

    // Pairing code below QR
    _pairCode = makeLabel(_screen, &lv_font_montserrat_28, makerCyan,
                          LV_ALIGN_BOTTOM_MID, 0, -40, code);

    makeLabel(_screen, &lv_font_montserrat_12, toolGray,
              LV_ALIGN_BOTTOM_MID, 0, -12, "Scan QR or enter code at fillaiq.com/hardware");

    lv_refr_now(NULL);
}

// ── QR Code Screen ───────────────────────────────────────────

void Display::showQrCode(const char* data, const char* label) {
    if (!_ready) return;

    clearScreen();
    _currentScreen = SCR_QR;

    // Two-pill logo
    lv_obj_t* pillL = lv_obj_create(_screen);
    lv_obj_remove_style_all(pillL);
    lv_obj_set_size(pillL, 7, 22);
    lv_obj_set_style_bg_color(pillL, makerCyan, 0);
    lv_obj_set_style_bg_opa(pillL, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(pillL, 3, 0);
    lv_obj_align(pillL, LV_ALIGN_TOP_LEFT, 12, 12);

    lv_obj_t* pillR = lv_obj_create(_screen);
    lv_obj_remove_style_all(pillR);
    lv_obj_set_size(pillR, 7, 22);
    lv_obj_set_style_bg_color(pillR, makerCyan, 0);
    lv_obj_set_style_bg_opa(pillR, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(pillR, 3, 0);
    lv_obj_align(pillR, LV_ALIGN_TOP_LEFT, 23, 12);

    makeLabel(_screen, &lv_font_montserrat_20, white,
              LV_ALIGN_TOP_LEFT, 38, 13, "FillaIQ");

    // Generate QR code
    size_t dataLen = strlen(data);
    uint8_t minVer = 3;
    if (dataLen > 50) minVer = 6;
    else if (dataLen > 32) minVer = 5;

    QRCode qrcode;
    uint8_t qrcodeData[512];
    int8_t result = -1;

    for (uint8_t ver = minVer; ver <= 8; ver++) {
        result = qrcode_initText(&qrcode, qrcodeData, ver, ECC_LOW, data);
        if (result == 0) break;
    }

    if (result != 0) {
        makeLabel(_screen, &lv_font_montserrat_14, lv_color_hex(ALERT_ROSE_HEX),
                  LV_ALIGN_CENTER, 0, 0, "QR Error");
        lv_refr_now(NULL);
        return;
    }

    int availH = _screenH - 100;
    int availW = _screenW - 40;
    int maxPx = min(availH, availW);
    int scale = maxPx / (qrcode.size + 4);
    if (scale < 1) scale = 1;
    int qrPx = qrcode.size * scale;
    int margin = scale * 2;

    int totalSize = qrPx + margin * 2;
    lv_obj_t* qrBg = lv_obj_create(_screen);
    lv_obj_remove_style_all(qrBg);
    lv_obj_set_size(qrBg, totalSize, totalSize);
    lv_obj_set_style_bg_color(qrBg, white, 0);
    lv_obj_set_style_bg_opa(qrBg, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(qrBg, 4, 0);
    lv_obj_align(qrBg, LV_ALIGN_TOP_MID, 0, 48);

    for (uint8_t y = 0; y < qrcode.size; y++) {
        for (uint8_t x = 0; x < qrcode.size; x++) {
            if (qrcode_getModule(&qrcode, x, y)) {
                lv_obj_t* px = lv_obj_create(qrBg);
                lv_obj_remove_style_all(px);
                lv_obj_set_size(px, scale, scale);
                lv_obj_set_pos(px, margin + x * scale, margin + y * scale);
                lv_obj_set_style_bg_color(px, lv_color_black(), 0);
                lv_obj_set_style_bg_opa(px, LV_OPA_COVER, 0);
            }
        }
    }

    int textY = 48 + totalSize + 8;
    makeLabel(_screen, &lv_font_montserrat_14, white,
              LV_ALIGN_TOP_MID, 0, textY, "Scan QR to connect");

    if (label) {
        makeLabel(_screen, &lv_font_montserrat_12, toolGray,
                  LV_ALIGN_TOP_MID, 0, textY + 20, label);
    }

    makeLabel(_screen, &lv_font_montserrat_12, toolGray,
              LV_ALIGN_BOTTOM_MID, 0, -5, "Password: fillaiq1");

    lv_refr_now(NULL);
}

// ── Main Update (dispatcher) ─────────────────────────────────

void Display::update(ScanState state, float weight, bool stable,
                     const char* nfcUid,
                     const ScanResponse* serverData,
                     const ColorData* color,
                     uint8_t statusIcons,
                     const char* sessionUrl,
                     bool hasPrinter) {
    if (!_ready) return;

    if (isnan(weight) || isinf(weight)) weight = 0.0f;

    // Determine target screen from state
    ScreenMode targetScreen;
    switch (state) {
    case SCAN_IDLE:
        targetScreen = SCR_IDLE;
        break;
    case SCAN_SUBMITTING:
        targetScreen = SCR_SUBMITTING;
        break;
    case SCAN_RESULT:
        targetScreen = SCR_RESULT;
        break;
    default:
        targetScreen = SCR_IDLE;
        break;
    }

    bool screenChanged = (targetScreen != _currentScreen);
    bool iconsChanged = (statusIcons != _lastIcons);

    if (screenChanged) {
        switch (state) {
        case SCAN_IDLE:
            buildDashboardScreen(statusIcons);
            break;
        case SCAN_SUBMITTING:
            clearScreen();
            _currentScreen = SCR_SUBMITTING;
            createStatusBar(_screen, statusIcons);
            makeLabel(_screen, &lv_font_montserrat_24, makerCyan,
                      LV_ALIGN_CENTER, 0, -20, "Submitting...");
            makeLabel(_screen, &lv_font_montserrat_14, toolGray,
                      LV_ALIGN_CENTER, 0, 15, "Sending scan data");
            break;
        case SCAN_RESULT:
            buildResultScreen(serverData, weight, sessionUrl, statusIcons);
            // Hide print button if no printer connected
            if (_resultPrintBtn && !hasPrinter) {
                lv_obj_add_flag(_resultPrintBtn, LV_OBJ_FLAG_HIDDEN);
                // Make Done button full width when Print is hidden
                if (_resultDoneBtn) {
                    lv_obj_set_width(_resultDoneBtn, _screenW - 24);
                    lv_obj_align(_resultDoneBtn, LV_ALIGN_BOTTOM_MID, 0, -8);
                }
            }
            break;
        default:
            break;
        }
    } else {
        if (iconsChanged) updateStatusIcons(statusIcons);
        // Dashboard is updated separately via updateDashboard()
    }
}
