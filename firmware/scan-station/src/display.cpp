#include "display.h"
#include <SPI.h>
#include <lvgl.h>
#include <qrcode.h>
#include <esp_heap_caps.h>
#include "api_client.h"
#include "distance.h"

// Custom Font Awesome 6 icon font (14px)
// Custom FA6 icon font — included directly to avoid linkage issues
#include "fa_icons_14.cpp"

// FA6 icon codepoints (UTF-8 encoded)
#define FA_TOWER_BROADCAST  "\xEF\x94\x99"   // 0xF519 — NFC
#define FA_WEIGHT_SCALE     "\xEF\x89\x8E"   // 0xF24E — Scale
#define FA_RULER            "\xEF\x95\x85"   // 0xF545 — TOF
#define FA_PALETTE          "\xEF\x94\xBF"   // 0xF53F — Color
#define FA_THERMOMETER      "\xEF\x8B\x89"   // 0xF2C9 — Environment
#define FA_PRINT            "\xEF\x80\xAF"   // 0xF02F — Printer
#define FA_WIFI             "\xEF\x87\xAB"   // 0xF1EB — WiFi
#define FA_SD_CARD          "\xEF\x9F\x82"   // 0xF7C2 — SD card
#define FA_CHECK            "\xEF\x80\x8C"   // 0xF00C — Paired/OK
#define FA_GEAR             "\xEF\x80\x93"   // 0xF013 — Settings
#define FA_VOLUME_MUTE      "\xEF\x9A\xA9"   // 0xF6A9 — Audio/Mute

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

// Brand colors — matched to web app (web/src/lib/theme.ts)
#define BRAND_ORANGE_HEX  0xFF5C2E
#define DARK_BG_HEX       0x171717
#define GRAY_HEX          0x6B6B6B
#define GRAY_LIGHT_HEX    0x9B9B9B
#define GREEN_HEX         0x16A34A
#define RED_HEX           0xDC2626
#define WHITE_HEX         0xFFFFFF

// Dynamic QR canvas buffer (freed on screen clear)
static uint8_t* qrCanvasBuf = nullptr;

static lv_color_t brandOrange;
static lv_color_t darkBg;
static lv_color_t gray;
static lv_color_t grayLight;
static lv_color_t green;
static lv_color_t white;

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

    // Cache colors (matched to web brand palette)
    brandOrange = lv_color_hex(BRAND_ORANGE_HEX);
    darkBg = lv_color_hex(DARK_BG_HEX);
    gray = lv_color_hex(GRAY_HEX);
    grayLight = lv_color_hex(GRAY_LIGHT_HEX);
    green = lv_color_hex(GREEN_HEX);
    white = lv_color_hex(WHITE_HEX);

    // Dark background for all screens
    lv_obj_set_style_bg_color(lv_screen_active(), darkBg, 0);
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
    lv_obj_set_style_bg_color(scr, darkBg, 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);

    _screen = scr;
    _iconWifi = _iconPaired = _iconPrinter = nullptr;
    _idleTitle = _idleSubtitle = nullptr;
    _weightLabel = _heightLabel = _colorSwatch = nullptr;
    _itemName = _materialLabel = _tempLabel = nullptr;
    _msgLine1 = _msgLine2 = nullptr;
    _pairCode = nullptr;
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
            { SENSOR_TOF,   FA_RULER           },
            { SENSOR_COLOR, FA_PALETTE         },
            { SENSOR_ENV,   FA_THERMOMETER     },
            { SENSOR_SD,    FA_SD_CARD         },
            { SENSOR_AUDIO, FA_VOLUME_MUTE     },
        };
        for (auto& s : sensors) {
            if (_sensorFlags & s.flag) {
                makeSymbol(sensorBar, s.symbol, green);
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

    _iconWifi = makeSymbol(bar, FA_WIFI, (icons & ICON_WIFI) ? green : grayLight);

    _iconPaired = makeSymbol(bar, FA_CHECK, (icons & ICON_PAIRED) ? green : grayLight);

    _iconPrinter = makeSymbol(bar, FA_PRINT, (icons & ICON_PRINTER) ? green : grayLight);
    if (!(icons & ICON_PRINTER)) lv_obj_add_flag(_iconPrinter, LV_OBJ_FLAG_HIDDEN);

    return bar;
}

void Display::setSensorFlags(uint8_t flags) {
    _sensorFlags = flags;
}

void Display::updateStatusIcons(uint8_t icons) {
    if (_iconWifi)
        lv_obj_set_style_text_color(_iconWifi, (icons & ICON_WIFI) ? green : grayLight, 0);
    if (_iconPaired)
        lv_obj_set_style_text_color(_iconPaired, (icons & ICON_PAIRED) ? green : grayLight, 0);
    if (_iconPrinter) {
        lv_obj_set_style_text_color(_iconPrinter, (icons & ICON_PRINTER) ? green : grayLight, 0);
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
        case 0: if (display.onMenuFormatSd)  display.onMenuFormatSd();  break;
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
    lv_obj_set_style_bg_color(gearBtn, lv_color_hex(0x333333), 0);
    lv_obj_set_style_bg_opa(gearBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(gearBtn, 10, 0);
    lv_obj_add_event_cb(gearBtn, onSettingsBtnClick, LV_EVENT_CLICKED, NULL);

    lv_obj_t* gearIcon = lv_label_create(gearBtn);
    lv_label_set_text(gearIcon, FA_GEAR);
    lv_obj_set_style_text_font(gearIcon, &fa_icons_14, 0);
    lv_obj_set_style_text_color(gearIcon, grayLight, 0);
    lv_obj_center(gearIcon);
#endif

    // "F" logo — rounded orange box
    lv_obj_t* logo = lv_obj_create(_screen);
    lv_obj_remove_style_all(logo);
    lv_obj_set_size(logo, 64, 64);
    lv_obj_set_style_bg_color(logo, brandOrange, 0);
    lv_obj_set_style_bg_opa(logo, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(logo, 12, 0);
    lv_obj_align(logo, LV_ALIGN_CENTER, 0, -40);

    lv_obj_t* fLetter = lv_label_create(logo);
    lv_label_set_text(fLetter, "F");
    lv_obj_set_style_text_font(fLetter, &lv_font_montserrat_36, 0);
    lv_obj_set_style_text_color(fLetter, white, 0);
    lv_obj_center(fLetter);

    _idleTitle = makeLabel(_screen, &lv_font_montserrat_24, white,
                           LV_ALIGN_CENTER, 0, 20, "Filla IQ");

    _idleSubtitle = makeLabel(_screen, &lv_font_montserrat_14, gray,
                              LV_ALIGN_CENTER, 0, 50, "Place item on platform");
}

// ── Dashboard Screen (Live Sensor Display + Scan Button) ─────

void Display::buildDashboardScreen(uint8_t icons) {
    clearScreen();
    _currentScreen = SCR_IDLE;

    createStatusBar(_screen, icons);

    // Settings gear button (top-right area, below status bar)
    // 48x48 minimum touch target for reliable tap detection
#ifdef BOARD_SCAN_TOUCH
    lv_obj_t* gearBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(gearBtn);
    lv_obj_set_size(gearBtn, 48, 48);
    lv_obj_align(gearBtn, LV_ALIGN_TOP_RIGHT, -2, 26);
    lv_obj_set_style_bg_color(gearBtn, lv_color_hex(0x2A2A2A), 0);
    lv_obj_set_style_bg_opa(gearBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(gearBtn, 10, 0);
    lv_obj_add_event_cb(gearBtn, onSettingsBtnClick, LV_EVENT_CLICKED, NULL);

    lv_obj_t* gearIcon = lv_label_create(gearBtn);
    lv_label_set_text(gearIcon, LV_SYMBOL_SETTINGS);
    lv_obj_set_style_text_font(gearIcon, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(gearIcon, grayLight, 0);
    lv_obj_center(gearIcon);
#endif

    // Weight — large display at top
    _dashWeightLabel = makeLabel(_screen, &lv_font_montserrat_28, white,
                                 LV_ALIGN_TOP_LEFT, 12, 34, "--");
    _dashWeightStatus = makeLabel(_screen, &lv_font_montserrat_12, gray,
                                  LV_ALIGN_TOP_LEFT, 12, 66, "");

    // Divider after weight
    lv_obj_t* div1 = lv_obj_create(_screen);
    lv_obj_remove_style_all(div1);
    lv_obj_set_size(div1, _screenW - 24, 1);
    lv_obj_set_style_bg_color(div1, gray, 0);
    lv_obj_set_style_bg_opa(div1, LV_OPA_30, 0);
    lv_obj_align(div1, LV_ALIGN_TOP_LEFT, 12, 82);

    // Sensor rows — compact, two columns
    // Left column: NFC, Color
    // Right column: TOF, Env
    _dashNfcLabel = lv_label_create(_screen);
    lv_obj_set_style_text_font(_dashNfcLabel, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(_dashNfcLabel, grayLight, 0);
    lv_obj_set_width(_dashNfcLabel, _screenW / 2 - 16);
    lv_label_set_long_mode(_dashNfcLabel, LV_LABEL_LONG_CLIP);
    lv_obj_align(_dashNfcLabel, LV_ALIGN_TOP_LEFT, 12, 88);
    lv_label_set_text(_dashNfcLabel, "NFC: --");

    // Color swatch (small square)
    _dashColorSwatch = lv_obj_create(_screen);
    lv_obj_remove_style_all(_dashColorSwatch);
    lv_obj_set_size(_dashColorSwatch, 14, 14);
    lv_obj_set_style_bg_color(_dashColorSwatch, lv_color_hex(0x333333), 0);
    lv_obj_set_style_bg_opa(_dashColorSwatch, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(_dashColorSwatch, 3, 0);
    lv_obj_set_style_border_color(_dashColorSwatch, gray, 0);
    lv_obj_set_style_border_width(_dashColorSwatch, 1, 0);
    lv_obj_align(_dashColorSwatch, LV_ALIGN_TOP_LEFT, 12, 107);

    _dashColorLabel = lv_label_create(_screen);
    lv_obj_set_style_text_font(_dashColorLabel, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(_dashColorLabel, grayLight, 0);
    lv_obj_set_width(_dashColorLabel, _screenW / 2 - 34);
    lv_label_set_long_mode(_dashColorLabel, LV_LABEL_LONG_CLIP);
    lv_obj_align(_dashColorLabel, LV_ALIGN_TOP_LEFT, 30, 106);
    lv_label_set_text(_dashColorLabel, "--");

    _dashTofLabel = lv_label_create(_screen);
    lv_obj_set_style_text_font(_dashTofLabel, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(_dashTofLabel, grayLight, 0);
    lv_obj_set_width(_dashTofLabel, _screenW / 2 - 16);
    lv_label_set_long_mode(_dashTofLabel, LV_LABEL_LONG_CLIP);
    lv_obj_align(_dashTofLabel, LV_ALIGN_TOP_LEFT, _screenW / 2 + 4, 88);
    lv_label_set_text(_dashTofLabel, "TOF: --");

    _dashEnvLabel = lv_label_create(_screen);
    lv_obj_set_style_text_font(_dashEnvLabel, &lv_font_montserrat_12, 0);
    lv_obj_set_style_text_color(_dashEnvLabel, grayLight, 0);
    lv_obj_set_width(_dashEnvLabel, _screenW / 2 - 16);
    lv_label_set_long_mode(_dashEnvLabel, LV_LABEL_LONG_CLIP);
    lv_obj_align(_dashEnvLabel, LV_ALIGN_TOP_LEFT, _screenW / 2 + 4, 106);
    lv_label_set_text(_dashEnvLabel, "Env: --");

    // Divider before scan button
    lv_obj_t* div2 = lv_obj_create(_screen);
    lv_obj_remove_style_all(div2);
    lv_obj_set_size(div2, _screenW - 24, 1);
    lv_obj_set_style_bg_color(div2, gray, 0);
    lv_obj_set_style_bg_opa(div2, LV_OPA_30, 0);
    lv_obj_align(div2, LV_ALIGN_TOP_LEFT, 12, 126);

    // SCAN button — large, prominent, at bottom
#ifdef BOARD_SCAN_TOUCH
    _dashScanBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(_dashScanBtn);
    lv_obj_set_size(_dashScanBtn, _screenW - 24, 90);
    lv_obj_align(_dashScanBtn, LV_ALIGN_BOTTOM_MID, 0, -8);
    lv_obj_set_style_bg_color(_dashScanBtn, brandOrange, 0);
    lv_obj_set_style_bg_opa(_dashScanBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(_dashScanBtn, 12, 0);
    lv_obj_set_style_bg_color(_dashScanBtn, lv_color_hex(0xCC4422), LV_PART_MAIN | LV_STATE_PRESSED);
    // Disabled style
    lv_obj_set_style_bg_color(_dashScanBtn, lv_color_hex(0x3A3A3A), LV_PART_MAIN | LV_STATE_DISABLED);
    lv_obj_set_style_bg_opa(_dashScanBtn, LV_OPA_COVER, LV_PART_MAIN | LV_STATE_DISABLED);
    lv_obj_add_event_cb(_dashScanBtn, onScanBtnClick, LV_EVENT_CLICKED, NULL);

    _dashScanBtnLabel = lv_label_create(_dashScanBtn);
    lv_label_set_text(_dashScanBtnLabel, "SCAN");
    lv_obj_set_style_text_font(_dashScanBtnLabel, &lv_font_montserrat_36, 0);
    lv_obj_set_style_text_color(_dashScanBtnLabel, white, 0);
    lv_obj_center(_dashScanBtnLabel);

    // Start disabled
    lv_obj_add_state(_dashScanBtn, LV_STATE_DISABLED);
#endif
}

void Display::updateDashboard(float weight, bool stable,
                               const char* nfcInfo,
                               const char* colorInfo, uint8_t colorR, uint8_t colorG, uint8_t colorB,
                               float distMm,
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
    if (_dashWeightStatus) {
        lv_label_set_text(_dashWeightStatus, stable ? "STABLE" : "");
        lv_obj_set_style_text_color(_dashWeightStatus, stable ? green : gray, 0);
    }

    // NFC
    if (_dashNfcLabel) {
        if (nfcInfo)
            lv_label_set_text(_dashNfcLabel, nfcInfo);
        else
            lv_label_set_text(_dashNfcLabel, "NFC: no tag");
    }

    // Color swatch + label
    if (_dashColorSwatch) {
        if (colorInfo)
            lv_obj_set_style_bg_color(_dashColorSwatch, lv_color_make(colorR, colorG, colorB), 0);
        else
            lv_obj_set_style_bg_color(_dashColorSwatch, lv_color_hex(0x333333), 0);
    }
    if (_dashColorLabel) {
        if (colorInfo)
            lv_label_set_text(_dashColorLabel, colorInfo);
        else
            lv_label_set_text(_dashColorLabel, "--");
    }

    // TOF
    if (_dashTofLabel) {
        if (distMm >= 0) {
            char dStr[24];
            float heightMm = distanceSensor.getArmHeight() - distMm;
            if (heightMm < 0) heightMm = 0;
            snprintf(dStr, sizeof(dStr), "H: %.0f mm", heightMm);
            lv_label_set_text(_dashTofLabel, dStr);
        } else {
            lv_label_set_text(_dashTofLabel, "TOF: --");
        }
    }

    // Env
    if (_dashEnvLabel) {
        if (tempC >= 0) {
            char eStr[32];
            if (pressureHPa > 0)
                snprintf(eStr, sizeof(eStr), "%.0fC %.0f%% %.0fhPa", tempC, humidity, pressureHPa);
            else
                snprintf(eStr, sizeof(eStr), "%.0fC %.0f%%RH", tempC, humidity);
            lv_label_set_text(_dashEnvLabel, eStr);
        } else {
            lv_label_set_text(_dashEnvLabel, "Env: --");
        }
    }

    // Scan button enable/disable
#ifdef BOARD_SCAN_TOUCH
    setScanButtonEnabled(scanEnabled);
#endif
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
        // Identified — show product info
        const char* title = resp->material[0] ? resp->material : resp->itemType;
        _resultTitle = makeLabel(_screen, &lv_font_montserrat_20, green,
                                  LV_ALIGN_TOP_LEFT, 12, 12, title);

        lv_obj_t* divLine = lv_obj_create(_screen);
        lv_obj_remove_style_all(divLine);
        lv_obj_set_size(divLine, _screenW - 24, 1);
        lv_obj_set_style_bg_color(divLine, gray, 0);
        lv_obj_set_style_bg_opa(divLine, LV_OPA_50, 0);
        lv_obj_align(divLine, LV_ALIGN_TOP_LEFT, 12, 38);

        // Color swatch
        bool hasColor = (resp->colorR || resp->colorG || resp->colorB);
        lv_obj_t* swatch = lv_obj_create(_screen);
        lv_obj_remove_style_all(swatch);
        lv_obj_set_size(swatch, 60, 60);
        lv_obj_set_style_bg_color(swatch, hasColor ? lv_color_make(resp->colorR, resp->colorG, resp->colorB)
                                                   : lv_color_hex(0x444444), 0);
        lv_obj_set_style_bg_opa(swatch, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(swatch, 8, 0);
        lv_obj_set_style_border_color(swatch, gray, 0);
        lv_obj_set_style_border_width(swatch, 1, 0);
        lv_obj_align(swatch, LV_ALIGN_TOP_LEFT, 15, 48);

        char nameBuf[28];
        strncpy(nameBuf, resp->itemName, sizeof(nameBuf) - 1);
        nameBuf[sizeof(nameBuf) - 1] = '\0';
        _resultName = makeLabel(_screen, &lv_font_montserrat_20, white,
                                 LV_ALIGN_TOP_LEFT, 90, 48, nameBuf);

        char wStr[16];
        snprintf(wStr, sizeof(wStr), "%.0f g", weight);
        _resultWeight = makeLabel(_screen, &lv_font_montserrat_24, white,
                                   LV_ALIGN_TOP_LEFT, 90, 75, wStr);

        if (resp->nozzleTempMin > 0 || resp->bedTemp > 0) {
            char tempStr[48];
            int pos = 0;
            if (resp->nozzleTempMin > 0)
                pos += snprintf(tempStr + pos, sizeof(tempStr) - pos, "%d-%dC", resp->nozzleTempMin, resp->nozzleTempMax);
            if (resp->bedTemp > 0)
                pos += snprintf(tempStr + pos, sizeof(tempStr) - pos, "  Bed %dC", resp->bedTemp);
            _resultDetail = makeLabel(_screen, &lv_font_montserrat_14, gray,
                                       LV_ALIGN_TOP_LEFT, 90, 105, tempStr);
        }
    } else {
        // Unknown — needs enrichment
        _resultTitle = makeLabel(_screen, &lv_font_montserrat_20, brandOrange,
                                  LV_ALIGN_TOP_LEFT, 12, 12, "Unknown Item");

        lv_obj_t* divLine = lv_obj_create(_screen);
        lv_obj_remove_style_all(divLine);
        lv_obj_set_size(divLine, _screenW - 24, 1);
        lv_obj_set_style_bg_color(divLine, gray, 0);
        lv_obj_set_style_bg_opa(divLine, LV_OPA_50, 0);
        lv_obj_align(divLine, LV_ALIGN_TOP_LEFT, 12, 38);

        // Question mark box
        lv_obj_t* qBox = lv_obj_create(_screen);
        lv_obj_remove_style_all(qBox);
        lv_obj_set_size(qBox, 60, 60);
        lv_obj_set_style_bg_color(qBox, lv_color_hex(0x333355), 0);
        lv_obj_set_style_bg_opa(qBox, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(qBox, 8, 0);
        lv_obj_align(qBox, LV_ALIGN_TOP_LEFT, 15, 48);

        lv_obj_t* qMark = lv_label_create(qBox);
        lv_label_set_text(qMark, "?");
        lv_obj_set_style_text_font(qMark, &lv_font_montserrat_36, 0);
        lv_obj_set_style_text_color(qMark, white, 0);
        lv_obj_center(qMark);

        char wStr[16];
        snprintf(wStr, sizeof(wStr), "%.1f g", weight);
        _resultWeight = makeLabel(_screen, &lv_font_montserrat_24, white,
                                   LV_ALIGN_TOP_LEFT, 90, 55, wStr);

        _resultDetail = makeLabel(_screen, &lv_font_montserrat_14, gray,
                                   LV_ALIGN_TOP_LEFT, 90, 88, "Scan QR to add details");

        // Show QR code for session URL
        if (sessionUrl && sessionUrl[0]) {
            QRCode qrcode;
            uint8_t qrcodeData[512];
            int8_t qrResult = -1;
            for (uint8_t ver = 4; ver <= 8; ver++) {
                qrResult = qrcode_initText(&qrcode, qrcodeData, ver, ECC_LOW, sessionUrl);
                if (qrResult == 0) break;
            }
            if (qrResult == 0) {
                // Size QR to fill available height (below divider, above Done button)
                int availH = _screenH - 48 - 58 - 16; // top content - done btn - padding
                int maxSize = min(availH, _screenW / 2); // don't exceed half width
                int scale = maxSize / (qrcode.size + 4); // +4 for quiet zone
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
                lv_obj_align(qrBg, LV_ALIGN_TOP_RIGHT, -8, 48);

                lv_obj_t* canvasObj = lv_canvas_create(qrBg);
                // Allocate QR canvas dynamically (PSRAM preferred) instead of 22.5KB static buffer
                size_t canvasBufSize = totalSize * totalSize;
                if (qrCanvasBuf) { free(qrCanvasBuf); qrCanvasBuf = nullptr; }
                qrCanvasBuf = (uint8_t*)heap_caps_malloc(canvasBufSize, MALLOC_CAP_SPIRAM | MALLOC_CAP_8BIT);
                if (!qrCanvasBuf) qrCanvasBuf = (uint8_t*)malloc(canvasBufSize);  // Fallback to SRAM
                if (qrCanvasBuf) {
                memset(qrCanvasBuf, 0xFF, canvasBufSize);
                lv_canvas_set_buffer(canvasObj, qrCanvasBuf, totalSize, totalSize, LV_COLOR_FORMAT_L8);
                lv_obj_align(canvasObj, LV_ALIGN_CENTER, 0, 0);

                // Draw QR modules
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
                } // if (qrCanvasBuf)
            }
        }
    }

    // Bottom buttons — Print (left) + Done (right)
#ifdef BOARD_SCAN_TOUCH
    int btnGap = 8;
    int btnH = 50;
    int btnW = (_screenW - 24 - btnGap) / 2;

    // Print button (left)
    _resultPrintBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(_resultPrintBtn);
    lv_obj_set_size(_resultPrintBtn, btnW, btnH);
    lv_obj_align(_resultPrintBtn, LV_ALIGN_BOTTOM_LEFT, 12, -8);
    lv_obj_set_style_bg_color(_resultPrintBtn, brandOrange, 0);
    lv_obj_set_style_bg_opa(_resultPrintBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(_resultPrintBtn, 10, 0);
    lv_obj_add_event_cb(_resultPrintBtn, onPrintBtnClick, LV_EVENT_CLICKED, NULL);

    lv_obj_t* printLbl = lv_label_create(_resultPrintBtn);
    lv_label_set_text(printLbl, LV_SYMBOL_DOWNLOAD " PRINT");
    lv_obj_set_style_text_font(printLbl, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(printLbl, white, 0);
    lv_obj_center(printLbl);

    // Done button (right)
    _resultDoneBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(_resultDoneBtn);
    lv_obj_set_size(_resultDoneBtn, btnW, btnH);
    lv_obj_align(_resultDoneBtn, LV_ALIGN_BOTTOM_RIGHT, -12, -8);
    lv_obj_set_style_bg_color(_resultDoneBtn, lv_color_hex(0x2A2A2A), 0);
    lv_obj_set_style_bg_opa(_resultDoneBtn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(_resultDoneBtn, 10, 0);
    lv_obj_set_style_border_color(_resultDoneBtn, gray, 0);
    lv_obj_set_style_border_width(_resultDoneBtn, 1, 0);
    lv_obj_add_event_cb(_resultDoneBtn, onDoneBtnClick, LV_EVENT_CLICKED, NULL);

    lv_obj_t* doneLbl = lv_label_create(_resultDoneBtn);
    lv_label_set_text(doneLbl, "DONE");
    lv_obj_set_style_text_font(doneLbl, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(doneLbl, white, 0);
    lv_obj_center(doneLbl);
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
                                  const DistanceData* dist, const ColorData* color,
                                  uint8_t icons) {
    clearScreen();
    _currentScreen = SCR_UNKNOWN;

    createStatusBar(_screen, icons);

    makeLabel(_screen, &lv_font_montserrat_20, brandOrange,
              LV_ALIGN_TOP_LEFT, 12, 12, "Scanning...");

    // Divider
    lv_obj_t* line = lv_obj_create(_screen);
    lv_obj_remove_style_all(line);
    lv_obj_set_size(line, _screenW - 24, 1);
    lv_obj_set_style_bg_color(line, gray, 0);
    lv_obj_set_style_bg_opa(line, LV_OPA_50, 0);
    lv_obj_align(line, LV_ALIGN_TOP_LEFT, 12, 38);

    // Question mark box
    lv_obj_t* qBox = lv_obj_create(_screen);
    lv_obj_remove_style_all(qBox);
    lv_obj_set_size(qBox, 70, 70);
    lv_obj_set_style_bg_color(qBox, lv_color_hex(0x333355), 0);
    lv_obj_set_style_bg_opa(qBox, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(qBox, 8, 0);
    lv_obj_align(qBox, LV_ALIGN_TOP_LEFT, 15, 50);

    lv_obj_t* qMark = lv_label_create(qBox);
    lv_label_set_text(qMark, "?");
    lv_obj_set_style_text_font(qMark, &lv_font_montserrat_36, 0);
    lv_obj_set_style_text_color(qMark, white, 0);
    lv_obj_center(qMark);

    char wStr[16];
    snprintf(wStr, sizeof(wStr), "%.1f g", weight);
    _weightLabel = makeLabel(_screen, &lv_font_montserrat_28, white,
                             LV_ALIGN_TOP_LEFT, 100, 55, wStr);

    _heightLabel = makeLabel(_screen, &lv_font_montserrat_14, gray,
                             LV_ALIGN_TOP_LEFT, 100, 90, "");
    if (dist && dist->valid) {
        float heightMm = distanceSensor.getArmHeight() - dist->distanceMm;
        if (heightMm < 0) heightMm = 0;
        char hStr[24];
        snprintf(hStr, sizeof(hStr), "H: %.0f mm", heightMm);
        lv_label_set_text(_heightLabel, hStr);
    }

    // Color swatch
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
        _colorSwatch = lv_obj_create(_screen);
        lv_obj_remove_style_all(_colorSwatch);
        lv_obj_set_size(_colorSwatch, 24, 24);
        lv_obj_set_style_bg_color(_colorSwatch, lv_color_make(r8, g8, b8), 0);
        lv_obj_set_style_bg_opa(_colorSwatch, LV_OPA_COVER, 0);
        lv_obj_set_style_radius(_colorSwatch, 4, 0);
        lv_obj_set_style_border_color(_colorSwatch, gray, 0);
        lv_obj_set_style_border_width(_colorSwatch, 1, 0);
        lv_obj_align(_colorSwatch, LV_ALIGN_TOP_LEFT, 100, 112);

        makeLabel(_screen, &lv_font_montserrat_12, gray,
                  LV_ALIGN_TOP_LEFT, 130, 116, "Color");
    }

    // Bottom divider + message
    lv_obj_t* divider2 = lv_obj_create(_screen);
    lv_obj_remove_style_all(divider2);
    lv_obj_set_size(divider2, _screenW - 24, 1);
    lv_obj_set_style_bg_color(divider2, gray, 0);
    lv_obj_set_style_bg_opa(divider2, LV_OPA_50, 0);
    lv_obj_align(divider2, LV_ALIGN_TOP_LEFT, 12, 145);

    makeLabel(_screen, &lv_font_montserrat_14, brandOrange,
              LV_ALIGN_TOP_MID, 0, 155, "Unidentified object");

    makeLabel(_screen, &lv_font_montserrat_12, gray,
              LV_ALIGN_TOP_MID, 0, 178, "Tap NFC tag, screen, or use app");

    // Touch-to-submit: make the screen tappable
#ifdef BOARD_SCAN_TOUCH
    lv_obj_add_flag(_screen, LV_OBJ_FLAG_CLICKABLE);
    lv_obj_add_event_cb(_screen, onSubmitTap, LV_EVENT_CLICKED, NULL);
#endif
}

// ── Identified Screen ────────────────────────────────────────

void Display::buildIdentifiedScreen(float weight, bool stable,
                                     const ScanResponse& resp, const DistanceData* dist,
                                     uint8_t icons) {
    clearScreen();
    _currentScreen = SCR_IDENTIFIED;

    createStatusBar(_screen, icons);

    const char* title = resp.material[0] ? resp.material : resp.itemType;
    makeLabel(_screen, &lv_font_montserrat_20, green,
              LV_ALIGN_TOP_LEFT, 12, 12, title);

    lv_obj_t* divLine = lv_obj_create(_screen);
    lv_obj_remove_style_all(divLine);
    lv_obj_set_size(divLine, _screenW - 24, 1);
    lv_obj_set_style_bg_color(divLine, gray, 0);
    lv_obj_set_style_bg_opa(divLine, LV_OPA_50, 0);
    lv_obj_align(divLine, LV_ALIGN_TOP_LEFT, 12, 38);

    // Color swatch
    bool hasColor = (resp.colorR || resp.colorG || resp.colorB);
    lv_obj_t* swatch = lv_obj_create(_screen);
    lv_obj_remove_style_all(swatch);
    lv_obj_set_size(swatch, 60, 60);
    lv_obj_set_style_bg_color(swatch, hasColor ? lv_color_make(resp.colorR, resp.colorG, resp.colorB)
                                               : lv_color_hex(0x444444), 0);
    lv_obj_set_style_bg_opa(swatch, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(swatch, 8, 0);
    lv_obj_set_style_border_color(swatch, gray, 0);
    lv_obj_set_style_border_width(swatch, 1, 0);
    lv_obj_align(swatch, LV_ALIGN_TOP_LEFT, 15, 48);

    char nameBuf[28];
    strncpy(nameBuf, resp.itemName, sizeof(nameBuf) - 1);
    nameBuf[sizeof(nameBuf) - 1] = '\0';
    _itemName = makeLabel(_screen, &lv_font_montserrat_20, white,
                          LV_ALIGN_TOP_LEFT, 90, 48, nameBuf);

    char wStr[16];
    snprintf(wStr, sizeof(wStr), "%.0f g", weight);
    _weightLabel = makeLabel(_screen, &lv_font_montserrat_24, white,
                             LV_ALIGN_TOP_LEFT, 90, 75, wStr);

    if (dist && dist->valid) {
        float spoolW = distanceSensor.getArmHeight() - dist->distanceMm;
        if (spoolW > 0) {
            char sStr[24];
            snprintf(sStr, sizeof(sStr), "W: %.0f mm", spoolW);
            makeLabel(_screen, &lv_font_montserrat_14, gray,
                      LV_ALIGN_TOP_LEFT, 90, 105, sStr);
        }
    }

    if (resp.nozzleTempMin > 0 || resp.bedTemp > 0) {
        lv_obj_t* divLine2 = lv_obj_create(_screen);
        lv_obj_remove_style_all(divLine2);
        lv_obj_set_size(divLine2, _screenW - 24, 1);
        lv_obj_set_style_bg_color(divLine2, gray, 0);
        lv_obj_set_style_bg_opa(divLine2, LV_OPA_50, 0);
        lv_obj_align(divLine2, LV_ALIGN_TOP_LEFT, 12, 130);

        if (resp.nozzleTempMin > 0) {
            char tempStr[32];
            snprintf(tempStr, sizeof(tempStr), LV_SYMBOL_WARNING " %d-%dC", resp.nozzleTempMin, resp.nozzleTempMax);
            makeLabel(_screen, &lv_font_montserrat_14, gray,
                      LV_ALIGN_TOP_LEFT, 12, 138, tempStr);
        }
        if (resp.bedTemp > 0) {
            char bedStr[16];
            snprintf(bedStr, sizeof(bedStr), "Bed %dC", resp.bedTemp);
            makeLabel(_screen, &lv_font_montserrat_14, gray,
                      LV_ALIGN_TOP_RIGHT, -12, 138, bedStr);
        }
    }

    if (resp.colorHex[0]) {
        makeLabel(_screen, &lv_font_montserrat_12, gray,
                  LV_ALIGN_BOTTOM_LEFT, 12, -8, resp.colorHex);
    }
    if (resp.nfcTagFormat[0]) {
        makeLabel(_screen, &lv_font_montserrat_12, gray,
                  LV_ALIGN_BOTTOM_RIGHT, -12, -8, resp.nfcTagFormat);
    }
}

// ── Message Screen ───────────────────────────────────────────

void Display::showMessage(const char* line1, const char* line2) {
    if (!_ready) return;

    clearScreen();
    _currentScreen = SCR_MESSAGE;

    lv_obj_t* logo = lv_obj_create(_screen);
    lv_obj_remove_style_all(logo);
    lv_obj_set_size(logo, 48, 48);
    lv_obj_set_style_bg_color(logo, brandOrange, 0);
    lv_obj_set_style_bg_opa(logo, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(logo, 10, 0);
    lv_obj_align(logo, LV_ALIGN_CENTER, 0, -40);

    lv_obj_t* fLetter = lv_label_create(logo);
    lv_label_set_text(fLetter, "F");
    lv_obj_set_style_text_font(fLetter, &lv_font_montserrat_28, 0);
    lv_obj_set_style_text_color(fLetter, white, 0);
    lv_obj_center(fLetter);

    _msgLine1 = makeLabel(_screen, &lv_font_montserrat_24, white,
                          LV_ALIGN_CENTER, 0, 10, line1);

    if (line2) {
        _msgLine2 = makeLabel(_screen, &lv_font_montserrat_14, gray,
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

    // Logo + title row
    lv_obj_t* logo = lv_obj_create(_screen);
    lv_obj_remove_style_all(logo);
    lv_obj_set_size(logo, 36, 36);
    lv_obj_set_style_bg_color(logo, brandOrange, 0);
    lv_obj_set_style_bg_opa(logo, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(logo, 8, 0);
    lv_obj_align(logo, LV_ALIGN_TOP_LEFT, 10, 8);

    lv_obj_t* fLetter = lv_label_create(logo);
    lv_label_set_text(fLetter, "F");
    lv_obj_set_style_text_font(fLetter, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(fLetter, white, 0);
    lv_obj_center(fLetter);

    char titleBuf[48];
    snprintf(titleBuf, sizeof(titleBuf), "Filla IQ  v%s", version);
    makeLabel(_screen, &lv_font_montserrat_16, white,
              LV_ALIGN_TOP_LEFT, 54, 16, titleBuf);

    // Divider
    lv_obj_t* div = lv_obj_create(_screen);
    lv_obj_remove_style_all(div);
    lv_obj_set_size(div, _screenW - 20, 1);
    lv_obj_set_style_bg_color(div, gray, 0);
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
    _bootStatus = makeLabel(_screen, &lv_font_montserrat_12, gray,
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
    lv_obj_set_style_text_color(icon, found ? green : lv_color_hex(RED_HEX), 0);

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
    lv_obj_set_style_bg_color(btn, lv_color_hex(0x2A2A2A), 0);
    lv_obj_set_style_bg_opa(btn, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(btn, 8, 0);
    lv_obj_set_style_bg_color(btn, lv_color_hex(0x3A3A3A), LV_PART_MAIN | LV_STATE_PRESSED);
    lv_obj_set_flex_flow(btn, LV_FLEX_FLOW_ROW);
    lv_obj_set_flex_align(btn, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_left(btn, 12, 0);
    lv_obj_set_style_pad_column(btn, 10, 0);

    lv_obj_t* iconLbl = lv_label_create(btn);
    lv_label_set_text(iconLbl, icon);
    lv_obj_set_style_text_font(iconLbl, &lv_font_montserrat_16, 0);
    lv_obj_set_style_text_color(iconLbl, lv_color_hex(BRAND_ORANGE_HEX), 0);

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
    makeLabel(_screen, &lv_font_montserrat_20, brandOrange,
              LV_ALIGN_TOP_LEFT, 12, 12, "Settings");

    // Divider
    lv_obj_t* div = lv_obj_create(_screen);
    lv_obj_remove_style_all(div);
    lv_obj_set_size(div, _screenW - 24, 1);
    lv_obj_set_style_bg_color(div, gray, 0);
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
    makeMenuBtn(list, LV_SYMBOL_SD_CARD, "Format SD Card",
                onMenuItemClick, (void*)(intptr_t)0);

    // Device info line
    char info[64];
    snprintf(info, sizeof(info), "FillaScan v%s", FW_VERSION);
    makeLabel(_screen, &lv_font_montserrat_12, gray,
              LV_ALIGN_BOTTOM_LEFT, 12, -8, info);

    // Back button
    lv_obj_t* backBtn = lv_btn_create(_screen);
    lv_obj_remove_style_all(backBtn);
    lv_obj_set_size(backBtn, 60, 36);
    lv_obj_align(backBtn, LV_ALIGN_BOTTOM_RIGHT, -8, -4);
    lv_obj_set_style_bg_color(backBtn, lv_color_hex(0x333333), 0);
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

        makeLabel(_screen, &lv_font_montserrat_16, brandOrange,
                  LV_ALIGN_TOP_LEFT, 12, 6, "Raw Sensors");

        lv_obj_t* div = lv_obj_create(_screen);
        lv_obj_remove_style_all(div);
        lv_obj_set_size(div, _screenW - 24, 1);
        lv_obj_set_style_bg_color(div, gray, 0);
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
        lv_obj_set_style_bg_color(backBtn, lv_color_hex(0x333333), 0);
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

        makeLabel(_screen, &lv_font_montserrat_20, brandOrange,
                  LV_ALIGN_TOP_LEFT, 12, 12, "Calibrate");

        lv_obj_t* div = lv_obj_create(_screen);
        lv_obj_remove_style_all(div);
        lv_obj_set_size(div, _screenW - 24, 1);
        lv_obj_set_style_bg_color(div, gray, 0);
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

        // Back button (exits calibration)
        lv_obj_t* backBtn = lv_btn_create(_screen);
        lv_obj_remove_style_all(backBtn);
        lv_obj_set_size(backBtn, 60, 36);
        lv_obj_align(backBtn, LV_ALIGN_BOTTOM_RIGHT, -8, -4);
        lv_obj_set_style_bg_color(backBtn, lv_color_hex(0x333333), 0);
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

    lv_obj_t* logo = lv_obj_create(_screen);
    lv_obj_remove_style_all(logo);
    lv_obj_set_size(logo, 56, 56);
    lv_obj_set_style_bg_color(logo, brandOrange, 0);
    lv_obj_set_style_bg_opa(logo, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(logo, 12, 0);
    lv_obj_align(logo, LV_ALIGN_TOP_MID, 0, 15);

    lv_obj_t* fLetter = lv_label_create(logo);
    lv_label_set_text(fLetter, "F");
    lv_obj_set_style_text_font(fLetter, &lv_font_montserrat_32, 0);
    lv_obj_set_style_text_color(fLetter, white, 0);
    lv_obj_center(fLetter);

    makeLabel(_screen, &lv_font_montserrat_20, white,
              LV_ALIGN_TOP_MID, 0, 80, "Pair Device");

    lv_obj_t* div = lv_obj_create(_screen);
    lv_obj_remove_style_all(div);
    lv_obj_set_size(div, 180, 1);
    lv_obj_set_style_bg_color(div, gray, 0);
    lv_obj_set_style_bg_opa(div, LV_OPA_50, 0);
    lv_obj_align(div, LV_ALIGN_TOP_MID, 0, 108);

    _pairCode = makeLabel(_screen, &lv_font_montserrat_36, brandOrange,
                          LV_ALIGN_CENTER, 0, 0, code);

    makeLabel(_screen, &lv_font_montserrat_12, gray,
              LV_ALIGN_BOTTOM_MID, 0, -30, "Enter code on dashboard");
    makeLabel(_screen, &lv_font_montserrat_12, gray,
              LV_ALIGN_BOTTOM_MID, 0, -12, "fillaiq.com/hardware");

    lv_refr_now(NULL);
}

// ── QR Code Screen ───────────────────────────────────────────

void Display::showQrCode(const char* data, const char* label) {
    if (!_ready) return;

    clearScreen();
    _currentScreen = SCR_QR;

    lv_obj_t* logo = lv_obj_create(_screen);
    lv_obj_remove_style_all(logo);
    lv_obj_set_size(logo, 32, 32);
    lv_obj_set_style_bg_color(logo, brandOrange, 0);
    lv_obj_set_style_bg_opa(logo, LV_OPA_COVER, 0);
    lv_obj_set_style_radius(logo, 6, 0);
    lv_obj_align(logo, LV_ALIGN_TOP_LEFT, 12, 8);

    lv_obj_t* fLetter = lv_label_create(logo);
    lv_label_set_text(fLetter, "F");
    lv_obj_set_style_text_font(fLetter, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(fLetter, white, 0);
    lv_obj_center(fLetter);

    makeLabel(_screen, &lv_font_montserrat_20, white,
              LV_ALIGN_TOP_LEFT, 52, 13, "FillaIQ");

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
        makeLabel(_screen, &lv_font_montserrat_14, lv_color_hex(RED_HEX),
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
        makeLabel(_screen, &lv_font_montserrat_12, gray,
                  LV_ALIGN_TOP_MID, 0, textY + 20, label);
    }

    makeLabel(_screen, &lv_font_montserrat_12, gray,
              LV_ALIGN_BOTTOM_MID, 0, -5, "Password: fillaiq1");

    lv_refr_now(NULL);
}

// ── Main Update (dispatcher) ─────────────────────────────────

void Display::update(ScanState state, float weight, bool stable,
                     const char* nfcUid,
                     const ScanResponse* serverData,
                     const DistanceData* distance,
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
            makeLabel(_screen, &lv_font_montserrat_24, brandOrange,
                      LV_ALIGN_CENTER, 0, -20, "Submitting...");
            makeLabel(_screen, &lv_font_montserrat_14, gray,
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
