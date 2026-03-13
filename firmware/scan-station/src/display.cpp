#include "display.h"
#include <SPI.h>
#include <lvgl.h>
#include <qrcode.h>
#include "api_client.h"

// LVGL native display drivers
#ifdef BOARD_SCAN_TOUCH
#include "src/drivers/display/ili9341/lv_ili9341.h"
#else
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

    // Pixel data: DC high — use writeBytes for DMA bulk transfer
    digitalWrite(TFT_DC_PIN, HIGH);
    tftSPI->writeBytes(param, param_size);

    digitalWrite(TFT_CS_PIN, HIGH);
    tftSPI->endTransaction();

    lv_display_flush_ready(disp);
}

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

    // Init LVGL
    lv_init();
    lv_tick_set_cb([]() -> uint32_t { return (uint32_t)millis(); });
    lv_delay_set_cb([](uint32_t ms){ delay(ms); });

    // Create display using LVGL native driver
#ifdef BOARD_SCAN_TOUCH
    // ILI9341 320x240 — landscape
    _screenW = 320;
    _screenH = 240;
    lvDisp = lv_ili9341_create(_screenW, _screenH, LV_LCD_FLAG_NONE, spiSendCmd, spiSendColor);
    lv_display_set_rotation(lvDisp, LV_DISPLAY_ROTATION_90);
#else
    // ST7789 240x280 — portrait
    _screenW = 240;
    _screenH = 280;
    lvDisp = lv_st7789_create(_screenW, _screenH, LV_LCD_FLAG_NONE, spiSendCmd, spiSendColor);
    lv_st7789_set_gap(lvDisp, 0, 20);  // 1.69" display VRAM offset
#endif

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
    lv_obj_t* scr = lv_screen_active();
    lv_obj_clean(scr);
    lv_obj_set_style_bg_color(scr, darkBg, 0);
    lv_obj_set_style_bg_opa(scr, LV_OPA_COVER, 0);
    lv_obj_invalidate(scr);

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

lv_obj_t* Display::createStatusBar(lv_obj_t* parent, uint8_t icons) {
    lv_obj_t* bar = lv_obj_create(parent);
    lv_obj_remove_style_all(bar);
    lv_obj_set_size(bar, 100, 20);
    lv_obj_align(bar, LV_ALIGN_TOP_RIGHT, -8, 8);
    lv_obj_set_flex_flow(bar, LV_FLEX_FLOW_ROW_REVERSE);
    lv_obj_set_flex_align(bar, LV_FLEX_ALIGN_START, LV_FLEX_ALIGN_CENTER, LV_FLEX_ALIGN_CENTER);
    lv_obj_set_style_pad_column(bar, 6, 0);

    _iconWifi = lv_label_create(bar);
    lv_obj_remove_style_all(_iconWifi);
    lv_label_set_text(_iconWifi, LV_SYMBOL_WIFI);
    lv_obj_set_style_text_font(_iconWifi, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(_iconWifi, (icons & ICON_WIFI) ? green : grayLight, 0);

    _iconPaired = lv_label_create(bar);
    lv_obj_remove_style_all(_iconPaired);
    lv_label_set_text(_iconPaired, LV_SYMBOL_LOOP);
    lv_obj_set_style_text_font(_iconPaired, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(_iconPaired, (icons & ICON_PAIRED) ? green : grayLight, 0);

    _iconPrinter = lv_label_create(bar);
    lv_obj_remove_style_all(_iconPrinter);
    lv_label_set_text(_iconPrinter, LV_SYMBOL_COPY);
    lv_obj_set_style_text_font(_iconPrinter, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(_iconPrinter, (icons & ICON_PRINTER) ? green : grayLight, 0);
    if (!(icons & ICON_PRINTER)) lv_obj_add_flag(_iconPrinter, LV_OBJ_FLAG_HIDDEN);

    return bar;
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

// ── Idle Screen ──────────────────────────────────────────────

void Display::buildIdleScreen(uint8_t icons) {
    clearScreen();
    _currentScreen = SCR_IDLE;

    createStatusBar(_screen, icons);

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
        float heightMm = TOF_ARM_HEIGHT_MM - dist->distanceMm;
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
              LV_ALIGN_TOP_MID, 0, 178, "Tap NFC tag or use app");
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
        float spoolW = TOF_ARM_HEIGHT_MM - dist->distanceMm;
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
                     uint8_t statusIcons) {
    if (!_ready) return;

    bool hasIdentified = serverData && serverData->identified && serverData->itemName[0];
    enum { MODE_IDLE, MODE_UNKNOWN, MODE_SPOOL } mode;
    if (state == SCAN_IDLE && !hasIdentified) mode = MODE_IDLE;
    else if (hasIdentified) mode = MODE_SPOOL;
    else mode = MODE_UNKNOWN;

    ScreenMode targetScreen = (mode == MODE_IDLE) ? SCR_IDLE :
                              (mode == MODE_SPOOL) ? SCR_IDENTIFIED : SCR_UNKNOWN;

    bool screenChanged = (targetScreen != _currentScreen);
    bool iconsChanged = (statusIcons != _lastIcons);

    if (isnan(weight) || isinf(weight)) weight = 0.0f;

    if (screenChanged) {
        switch (mode) {
        case MODE_IDLE:
            buildIdleScreen(statusIcons);
            break;
        case MODE_UNKNOWN:
            buildUnknownScreen(weight, stable, distance, color, statusIcons);
            break;
        case MODE_SPOOL:
            buildIdentifiedScreen(weight, stable, *serverData, distance, statusIcons);
            break;
        }
        lv_obj_invalidate(lv_screen_active());
        lv_refr_now(NULL);
    } else {
        if (iconsChanged) updateStatusIcons(statusIcons);

        if (mode == MODE_UNKNOWN && _weightLabel) {
            char wStr[16];
            snprintf(wStr, sizeof(wStr), "%.1f g", weight);
            lv_label_set_text(_weightLabel, wStr);
        }
        if (mode == MODE_SPOOL && _weightLabel) {
            char wStr[16];
            snprintf(wStr, sizeof(wStr), "%.0f g", weight);
            lv_label_set_text(_weightLabel, wStr);
        }
    }
}
