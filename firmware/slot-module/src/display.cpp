#include "display.h"
#include "hx711_multi.h"
#include <TFT_eSPI.h>

// ==================== Hardware ====================

static TFT_eSPI tft = TFT_eSPI();
static SlotDisplay displays[TFT_NUM_DISPLAYS];
static const uint8_t cs_pins[] = { TFT_CS_PIN_0, TFT_CS_PIN_1 };
static uint8_t numDisplays = 0;

// ==================== LVGL Draw Buffers ====================

static lv_disp_draw_buf_t draw_buf_dsc_0;
static lv_disp_draw_buf_t draw_buf_dsc_1;
static lv_color_t draw_buf_0[TFT_DISPLAY_WIDTH * 40];
static lv_color_t draw_buf_1[TFT_DISPLAY_WIDTH * 40];

// ==================== LVGL Flush Callbacks ====================

static void flush_cb_0(lv_disp_drv_t* drv, const lv_area_t* area, lv_color_t* color_p) {
    uint32_t w = (area->x2 - area->x1 + 1);
    uint32_t h = (area->y2 - area->y1 + 1);

    digitalWrite(TFT_CS_PIN_0, LOW);
    tft.startWrite();
    tft.setAddrWindow(area->x1, area->y1, w, h);
    tft.pushColors((uint16_t*)&color_p->full, w * h, true);
    tft.endWrite();
    digitalWrite(TFT_CS_PIN_0, HIGH);

    lv_disp_flush_ready(drv);
}

static void flush_cb_1(lv_disp_drv_t* drv, const lv_area_t* area, lv_color_t* color_p) {
    uint32_t w = (area->x2 - area->x1 + 1);
    uint32_t h = (area->y2 - area->y1 + 1);

    digitalWrite(TFT_CS_PIN_1, LOW);
    tft.startWrite();
    tft.setAddrWindow(area->x1, area->y1, w, h);
    tft.pushColors((uint16_t*)&color_p->full, w * h, true);
    tft.endWrite();
    digitalWrite(TFT_CS_PIN_1, HIGH);

    lv_disp_flush_ready(drv);
}

// ==================== Layout Constants ====================

#define SPOOL_CX        120
#define SPOOL_CY        110
#define SPOOL_R_OUTER   60
#define SPOOL_R_RING    52
#define SPOOL_R_INNER   50
#define SPOOL_R_HUB     18

#define Y_BRAND         4
#define Y_NAME          24
#define Y_MATERIAL      178
#define Y_BAR           210
#define BAR_HEIGHT      20
#define BAR_MARGIN      20
#define Y_PERCENT       236
#define Y_WEIGHT        258

// ==================== SlotDisplay Implementation ====================

void SlotDisplay::begin(uint8_t cs_pin, uint8_t channel, lv_disp_t* disp) {
    _cs_pin = cs_pin;
    _channel = channel;
    _lv_disp = disp;
    _calMode = false;
    _lastPresent = false;

    buildUI();

    // Start on empty screen
    lv_disp_set_default(_lv_disp);
    lv_scr_load(_scr_empty);
}

void SlotDisplay::buildUI() {
    lv_disp_set_default(_lv_disp);
    buildSpoolScreen();
    buildEmptyScreen();
    buildCalScreen();
}

// --- Spool Screen ---

static lv_style_t style_circle;
static bool style_circle_init = false;

static void ensure_circle_style() {
    if (!style_circle_init) {
        lv_style_init(&style_circle);
        lv_style_set_radius(&style_circle, LV_RADIUS_CIRCLE);
        lv_style_set_border_width(&style_circle, 0);
        style_circle_init = true;
    }
}

void SlotDisplay::buildSpoolScreen() {
    ensure_circle_style();

    _scr_spool = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(_scr_spool, lv_color_black(), 0);

    // Brand label at top (small, green for Bambu branding)
    _lbl_brand = lv_label_create(_scr_spool);
    lv_obj_set_style_text_font(_lbl_brand, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(_lbl_brand, lv_color_make(0x7B, 0x7B, 0x7B), 0);
    lv_label_set_text_fmt(_lbl_brand, "CH%d", _channel);
    lv_obj_align(_lbl_brand, LV_ALIGN_TOP_MID, 0, Y_BRAND);

    // Filament name label (e.g. "PLA Basic")
    _lbl_name = lv_label_create(_scr_spool);
    lv_obj_set_style_text_font(_lbl_name, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(_lbl_name, lv_color_white(), 0);
    lv_label_set_text(_lbl_name, "");
    lv_obj_align(_lbl_name, LV_ALIGN_TOP_MID, 0, Y_NAME);

    // Spool graphic — layered circles
    // Outer disk (filament color)
    _obj_spool_outer = lv_obj_create(_scr_spool);
    lv_obj_remove_style_all(_obj_spool_outer);
    lv_obj_add_style(_obj_spool_outer, &style_circle, 0);
    lv_obj_set_size(_obj_spool_outer, SPOOL_R_OUTER * 2, SPOOL_R_OUTER * 2);
    lv_obj_set_style_bg_opa(_obj_spool_outer, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(_obj_spool_outer, _spool.color, 0);
    lv_obj_set_style_border_width(_obj_spool_outer, 2, 0);
    lv_obj_set_style_border_color(_obj_spool_outer, lv_color_make(0x9C, 0x9C, 0x9C), 0);
    lv_obj_set_pos(_obj_spool_outer, SPOOL_CX - SPOOL_R_OUTER, SPOOL_CY - SPOOL_R_OUTER);
    lv_obj_clear_flag(_obj_spool_outer, LV_OBJ_FLAG_SCROLLABLE);

    // Dark ring
    _obj_spool_ring = lv_obj_create(_scr_spool);
    lv_obj_remove_style_all(_obj_spool_ring);
    lv_obj_add_style(_obj_spool_ring, &style_circle, 0);
    lv_obj_set_size(_obj_spool_ring, SPOOL_R_RING * 2, SPOOL_R_RING * 2);
    lv_obj_set_style_bg_opa(_obj_spool_ring, LV_OPA_COVER, 0);
    // Darken by halving RGB components
    lv_color_t dark = lv_color_make(
        lv_color_brightness(_spool.color) / 3,
        lv_color_brightness(_spool.color) / 3,
        lv_color_brightness(_spool.color) / 3
    );
    lv_obj_set_style_bg_color(_obj_spool_ring, dark, 0);
    lv_obj_set_pos(_obj_spool_ring, SPOOL_CX - SPOOL_R_RING, SPOOL_CY - SPOOL_R_RING);
    lv_obj_clear_flag(_obj_spool_ring, LV_OBJ_FLAG_SCROLLABLE);

    // Inner disk (filament color again)
    _obj_spool_inner = lv_obj_create(_scr_spool);
    lv_obj_remove_style_all(_obj_spool_inner);
    lv_obj_add_style(_obj_spool_inner, &style_circle, 0);
    lv_obj_set_size(_obj_spool_inner, SPOOL_R_INNER * 2, SPOOL_R_INNER * 2);
    lv_obj_set_style_bg_opa(_obj_spool_inner, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(_obj_spool_inner, _spool.color, 0);
    lv_obj_set_pos(_obj_spool_inner, SPOOL_CX - SPOOL_R_INNER, SPOOL_CY - SPOOL_R_INNER);
    lv_obj_clear_flag(_obj_spool_inner, LV_OBJ_FLAG_SCROLLABLE);

    // Hub hole (center)
    _obj_spool_hub = lv_obj_create(_scr_spool);
    lv_obj_remove_style_all(_obj_spool_hub);
    lv_obj_add_style(_obj_spool_hub, &style_circle, 0);
    lv_obj_set_size(_obj_spool_hub, SPOOL_R_HUB * 2, SPOOL_R_HUB * 2);
    lv_obj_set_style_bg_opa(_obj_spool_hub, LV_OPA_COVER, 0);
    lv_obj_set_style_bg_color(_obj_spool_hub, lv_color_make(0x42, 0x42, 0x42), 0);
    lv_obj_set_style_border_width(_obj_spool_hub, 1, 0);
    lv_obj_set_style_border_color(_obj_spool_hub, lv_color_make(0x9C, 0x9C, 0x9C), 0);
    lv_obj_set_pos(_obj_spool_hub, SPOOL_CX - SPOOL_R_HUB, SPOOL_CY - SPOOL_R_HUB);
    lv_obj_clear_flag(_obj_spool_hub, LV_OBJ_FLAG_SCROLLABLE);

    // Material label
    _lbl_material = lv_label_create(_scr_spool);
    lv_obj_set_style_text_font(_lbl_material, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(_lbl_material, lv_color_white(), 0);
    lv_label_set_text(_lbl_material, "");
    lv_obj_align(_lbl_material, LV_ALIGN_TOP_MID, 0, Y_MATERIAL);

    // Fill bar
    _bar_fill = lv_bar_create(_scr_spool);
    lv_obj_set_size(_bar_fill, TFT_DISPLAY_WIDTH - BAR_MARGIN * 2, BAR_HEIGHT);
    lv_obj_set_pos(_bar_fill, BAR_MARGIN, Y_BAR);
    lv_bar_set_range(_bar_fill, 0, 100);
    lv_bar_set_value(_bar_fill, 0, LV_ANIM_OFF);
    lv_obj_set_style_bg_color(_bar_fill, lv_color_make(0x21, 0x21, 0x21), LV_PART_MAIN);
    lv_obj_set_style_bg_color(_bar_fill, _spool.color, LV_PART_INDICATOR);
    lv_obj_set_style_radius(_bar_fill, 2, LV_PART_MAIN);
    lv_obj_set_style_radius(_bar_fill, 2, LV_PART_INDICATOR);

    // Percent label
    _lbl_percent = lv_label_create(_scr_spool);
    lv_obj_set_style_text_font(_lbl_percent, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(_lbl_percent, lv_color_make(0x7B, 0x7B, 0x7B), 0);
    lv_label_set_text(_lbl_percent, "0%");
    lv_obj_align(_lbl_percent, LV_ALIGN_TOP_MID, 0, Y_PERCENT);

    // Weight label
    _lbl_weight = lv_label_create(_scr_spool);
    lv_obj_set_style_text_font(_lbl_weight, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(_lbl_weight, lv_color_make(0xFF, 0xFF, 0x00), 0);
    lv_label_set_text(_lbl_weight, "0.0 g");
    lv_obj_align(_lbl_weight, LV_ALIGN_TOP_MID, 0, Y_WEIGHT);
}

void SlotDisplay::buildEmptyScreen() {
    ensure_circle_style();

    _scr_empty = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(_scr_empty, lv_color_black(), 0);

    // Ghost spool — faded outline ring
    _obj_ghost_outer = lv_obj_create(_scr_empty);
    lv_obj_remove_style_all(_obj_ghost_outer);
    lv_obj_add_style(_obj_ghost_outer, &style_circle, 0);
    lv_obj_set_size(_obj_ghost_outer, SPOOL_R_OUTER * 2, SPOOL_R_OUTER * 2);
    lv_obj_set_style_bg_opa(_obj_ghost_outer, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(_obj_ghost_outer, 2, 0);
    lv_obj_set_style_border_color(_obj_ghost_outer, lv_color_make(0x28, 0x28, 0x28), 0);
    lv_obj_set_pos(_obj_ghost_outer, SPOOL_CX - SPOOL_R_OUTER, SPOOL_CY - SPOOL_R_OUTER);
    lv_obj_clear_flag(_obj_ghost_outer, LV_OBJ_FLAG_SCROLLABLE);

    // Ghost hub — small faded circle in center
    _obj_ghost_hub = lv_obj_create(_scr_empty);
    lv_obj_remove_style_all(_obj_ghost_hub);
    lv_obj_add_style(_obj_ghost_hub, &style_circle, 0);
    lv_obj_set_size(_obj_ghost_hub, SPOOL_R_HUB * 2, SPOOL_R_HUB * 2);
    lv_obj_set_style_bg_opa(_obj_ghost_hub, LV_OPA_TRANSP, 0);
    lv_obj_set_style_border_width(_obj_ghost_hub, 1, 0);
    lv_obj_set_style_border_color(_obj_ghost_hub, lv_color_make(0x28, 0x28, 0x28), 0);
    lv_obj_set_pos(_obj_ghost_hub, SPOOL_CX - SPOOL_R_HUB, SPOOL_CY - SPOOL_R_HUB);
    lv_obj_clear_flag(_obj_ghost_hub, LV_OBJ_FLAG_SCROLLABLE);

    // Slot label inside ghost hub
    _lbl_empty_ch = lv_label_create(_scr_empty);
    lv_obj_set_style_text_font(_lbl_empty_ch, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(_lbl_empty_ch, lv_color_make(0x40, 0x40, 0x40), 0);
    lv_label_set_text_fmt(_lbl_empty_ch, "%d", _channel + 1);
    lv_obj_set_pos(_lbl_empty_ch,
        SPOOL_CX - lv_obj_get_self_width(_lbl_empty_ch) / 2,
        SPOOL_CY - lv_obj_get_self_height(_lbl_empty_ch) / 2);

    // "Place spool" text below the ghost
    _lbl_empty_msg = lv_label_create(_scr_empty);
    lv_obj_set_style_text_font(_lbl_empty_msg, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(_lbl_empty_msg, lv_color_make(0x40, 0x40, 0x40), 0);
    lv_label_set_text(_lbl_empty_msg, "Place spool");
    lv_obj_align(_lbl_empty_msg, LV_ALIGN_TOP_MID, 0, Y_MATERIAL);
}

void SlotDisplay::buildCalScreen() {
    _scr_cal = lv_obj_create(NULL);
    lv_obj_set_style_bg_color(_scr_cal, lv_color_black(), 0);

    _lbl_cal_title = lv_label_create(_scr_cal);
    lv_obj_set_style_text_font(_lbl_cal_title, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(_lbl_cal_title, lv_color_make(0x00, 0xFF, 0xFF), 0);
    lv_label_set_text(_lbl_cal_title, "CALIBRATE");
    lv_obj_align(_lbl_cal_title, LV_ALIGN_TOP_MID, 0, 20);

    _lbl_cal_ch = lv_label_create(_scr_cal);
    lv_obj_set_style_text_font(_lbl_cal_ch, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(_lbl_cal_ch, lv_color_make(0x7B, 0x7B, 0x7B), 0);
    lv_label_set_text_fmt(_lbl_cal_ch, "CH%d", _channel);
    lv_obj_align(_lbl_cal_ch, LV_ALIGN_TOP_MID, 0, 55);

    _lbl_cal_line1 = lv_label_create(_scr_cal);
    lv_obj_set_style_text_font(_lbl_cal_line1, &lv_font_montserrat_20, 0);
    lv_obj_set_style_text_color(_lbl_cal_line1, lv_color_white(), 0);
    lv_label_set_text(_lbl_cal_line1, "");
    lv_obj_align(_lbl_cal_line1, LV_ALIGN_CENTER, 0, -10);

    _lbl_cal_line2 = lv_label_create(_scr_cal);
    lv_obj_set_style_text_font(_lbl_cal_line2, &lv_font_montserrat_14, 0);
    lv_obj_set_style_text_color(_lbl_cal_line2, lv_color_make(0x7B, 0x7B, 0x7B), 0);
    lv_label_set_text(_lbl_cal_line2, "");
    lv_obj_align(_lbl_cal_line2, LV_ALIGN_CENTER, 0, 25);
}

// ==================== Spool Color Update ====================

void SlotDisplay::updateSpoolColors() {
    lv_obj_set_style_bg_color(_obj_spool_outer, _spool.color, 0);
    lv_obj_set_style_bg_color(_obj_spool_inner, _spool.color, 0);

    uint8_t r = LV_COLOR_GET_R(_spool.color);
    uint8_t g = LV_COLOR_GET_G(_spool.color);
    uint8_t b = LV_COLOR_GET_B(_spool.color);

    // For the fill bar, ensure dark colors are still visible
    // Brighten very dark colors to a minimum visible level
    uint8_t brightness = (r > g) ? (r > b ? r : b) : (g > b ? g : b);
    if (brightness < 0x50) {
        // Dark filament — use a lighter tint for the bar
        lv_color_t barColor = lv_color_make(
            r + 0x50 > 0xFF ? 0xFF : r + 0x50,
            g + 0x50 > 0xFF ? 0xFF : g + 0x50,
            b + 0x50 > 0xFF ? 0xFF : b + 0x50);
        lv_obj_set_style_bg_color(_bar_fill, barColor, LV_PART_INDICATOR);
        lv_obj_set_style_border_width(_bar_fill, 1, LV_PART_INDICATOR);
        lv_obj_set_style_border_color(_bar_fill, lv_color_make(0x60, 0x60, 0x60), LV_PART_INDICATOR);
    } else {
        lv_obj_set_style_bg_color(_bar_fill, _spool.color, LV_PART_INDICATOR);
        lv_obj_set_style_border_width(_bar_fill, 0, LV_PART_INDICATOR);
    }

    // Darken for ring
    lv_color_t dark = lv_color_make(r / 2, g / 2, b / 2);
    lv_obj_set_style_bg_color(_obj_spool_ring, dark, 0);
}

void SlotDisplay::setSpoolInfo(const SpoolInfo& info) {
    _spool = info;

    lv_disp_set_default(_lv_disp);

    // Brand label — show brand name or fall back to "CHn"
    if (_spool.brand.length() > 0) {
        lv_label_set_text(_lbl_brand, _spool.brand.c_str());
        // Bambu green for Bambu brand, white for others
        if (_spool.brand == "BAMBU") {
            lv_obj_set_style_text_color(_lbl_brand, lv_color_make(0x00, 0xAE, 0x42), 0);
        } else {
            lv_obj_set_style_text_color(_lbl_brand, lv_color_make(0x7B, 0x7B, 0x7B), 0);
        }
    } else {
        lv_label_set_text_fmt(_lbl_brand, "CH%d", _channel);
        lv_obj_set_style_text_color(_lbl_brand, lv_color_make(0x7B, 0x7B, 0x7B), 0);
    }
    lv_obj_align(_lbl_brand, LV_ALIGN_TOP_MID, 0, Y_BRAND);

    // Filament name label
    lv_label_set_text(_lbl_name, _spool.name.length() > 0 ? _spool.name.c_str() : "");
    lv_obj_align(_lbl_name, LV_ALIGN_TOP_MID, 0, Y_NAME);

    // Material + diameter line
    String matLine = _spool.material;
    if (_spool.diameter > 0) {
        matLine += "  " + String(_spool.diameter, 2) + "mm";
    }
    lv_label_set_text(_lbl_material, matLine.c_str());
    lv_obj_align(_lbl_material, LV_ALIGN_TOP_MID, 0, Y_MATERIAL);

    updateSpoolColors();

    // Force LVGL to redraw spool screen with new data
    lv_obj_invalidate(_scr_spool);

    Serial.printf("Display %d: setSpoolInfo brand='%s' name='%s' mat='%s' color=(%d,%d,%d)\n",
        _channel, _spool.brand.c_str(), _spool.name.c_str(), _spool.material.c_str(),
        LV_COLOR_GET_R(_spool.color), LV_COLOR_GET_G(_spool.color), LV_COLOR_GET_B(_spool.color));
}

// ==================== Update ====================

void SlotDisplay::update(float weight, float stableWeight, bool isStable, bool spoolPresent) {
    if (_calMode) return;

    lv_disp_set_default(_lv_disp);

    // Screen transitions
    if (spoolPresent != _lastPresent) {
        _lastPresent = spoolPresent;
        if (spoolPresent) {
            lv_scr_load(_scr_spool);
            lv_obj_invalidate(_scr_spool);  // Force full redraw
        } else {
            lv_scr_load(_scr_empty);
        }
    }

    if (!spoolPresent) return;

    // Force top labels to redraw (LVGL dirty tracking misses these)
    lv_obj_invalidate(_lbl_brand);
    lv_obj_invalidate(_lbl_name);

    // Update weight text
    char buf[16];
    if (stableWeight < 10000) {
        snprintf(buf, sizeof(buf), "%.1f g", stableWeight);
    } else {
        snprintf(buf, sizeof(buf), "%.0f g", stableWeight);
    }
    lv_label_set_text(_lbl_weight, buf);
    lv_obj_align(_lbl_weight, LV_ALIGN_TOP_MID, 0, Y_WEIGHT);
    lv_obj_set_style_text_color(_lbl_weight,
        isStable ? lv_color_make(0x00, 0xFF, 0x00) : lv_color_make(0xFF, 0xFF, 0x00), 0);

    // Update bar
    float percent = 0;
    if (_spool.fullWeight > 0) {
        percent = (stableWeight / _spool.fullWeight) * 100.0f;
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;
    }
    lv_bar_set_value(_bar_fill, (int)percent, LV_ANIM_OFF);

    snprintf(buf, sizeof(buf), "%d%%", (int)percent);
    lv_label_set_text(_lbl_percent, buf);
    lv_obj_align(_lbl_percent, LV_ALIGN_TOP_MID, 0, Y_PERCENT);
}

// ==================== Calibration Mode ====================

void SlotDisplay::showCalWaitEmpty() {
    _calMode = true;
    lv_disp_set_default(_lv_disp);

    lv_label_set_text(_lbl_cal_title, "CALIBRATE");
    lv_obj_set_style_text_color(_lbl_cal_title, lv_color_make(0x00, 0xFF, 0xFF), 0);
    lv_label_set_text(_lbl_cal_line1, "Remove weight");
    lv_label_set_text(_lbl_cal_line2, "Send 'ready' when empty");
    lv_obj_align(_lbl_cal_line1, LV_ALIGN_CENTER, 0, -10);
    lv_obj_align(_lbl_cal_line2, LV_ALIGN_CENTER, 0, 25);

    lv_scr_load(_scr_cal);
}

void SlotDisplay::showCalWaitWeight() {
    lv_disp_set_default(_lv_disp);

    lv_label_set_text(_lbl_cal_line1, "Place known weight");
    lv_label_set_text(_lbl_cal_line2, "Enter weight in grams");
    lv_obj_align(_lbl_cal_line1, LV_ALIGN_CENTER, 0, -10);
    lv_obj_align(_lbl_cal_line2, LV_ALIGN_CENTER, 0, 25);
}

void SlotDisplay::showCalResult(float factor, float verify, float expected) {
    lv_disp_set_default(_lv_disp);

    lv_label_set_text(_lbl_cal_title, "DONE");
    lv_obj_set_style_text_color(_lbl_cal_title, lv_color_make(0x00, 0xFF, 0x00), 0);

    char buf[32];
    snprintf(buf, sizeof(buf), "%.1fg", verify);
    lv_label_set_text(_lbl_cal_line1, buf);
    lv_obj_set_style_text_font(_lbl_cal_line1, &lv_font_montserrat_20, 0);
    lv_obj_align(_lbl_cal_line1, LV_ALIGN_CENTER, 0, -10);

    snprintf(buf, sizeof(buf), "expected %.1fg  Factor: %.4f", expected, factor);
    lv_label_set_text(_lbl_cal_line2, buf);
    lv_obj_align(_lbl_cal_line2, LV_ALIGN_CENTER, 0, 25);
}

void SlotDisplay::showCalDone() {
    lv_disp_set_default(_lv_disp);

    lv_label_set_text(_lbl_cal_title, "SAVED");
    lv_obj_set_style_text_color(_lbl_cal_title, lv_color_make(0x00, 0xFF, 0xFF), 0);
    lv_label_set_text(_lbl_cal_line1, "Calibration saved");
    lv_label_set_text(_lbl_cal_line2, "");
    lv_obj_align(_lbl_cal_line1, LV_ALIGN_CENTER, 0, -10);
}

void SlotDisplay::exitCalMode() {
    _calMode = false;
    lv_disp_set_default(_lv_disp);
    lv_scr_load(_scr_empty);
    _lastPresent = false;  // Force re-evaluation on next update
}

// ==================== Global Interface ====================

void initDisplays() {
    // Setup CS pins
    for (uint8_t i = 0; i < TFT_NUM_DISPLAYS; i++) {
        pinMode(cs_pins[i], OUTPUT);
        digitalWrite(cs_pins[i], HIGH);
    }

    // Select ALL displays during init so they all receive the
    // ST7789 startup sequence (sleep out, display on, etc.)
    for (uint8_t i = 0; i < TFT_NUM_DISPLAYS; i++) {
        digitalWrite(cs_pins[i], LOW);
    }
    tft.init();
    tft.setRotation(2);  // Portrait 240x280 flipped 180
    for (uint8_t i = 0; i < TFT_NUM_DISPLAYS; i++) {
        digitalWrite(cs_pins[i], HIGH);
    }

    // Initialize LVGL
    lv_init();

    // --- Display 0 ---
    lv_disp_draw_buf_init(&draw_buf_dsc_0, draw_buf_0, NULL, TFT_DISPLAY_WIDTH * 40);

    static lv_disp_drv_t disp_drv_0;
    lv_disp_drv_init(&disp_drv_0);
    disp_drv_0.hor_res = TFT_DISPLAY_WIDTH;
    disp_drv_0.ver_res = TFT_DISPLAY_HEIGHT;
    disp_drv_0.flush_cb = flush_cb_0;
    disp_drv_0.draw_buf = &draw_buf_dsc_0;
    lv_disp_t* disp0 = lv_disp_drv_register(&disp_drv_0);

    // --- Display 1 ---
    lv_disp_draw_buf_init(&draw_buf_dsc_1, draw_buf_1, NULL, TFT_DISPLAY_WIDTH * 40);

    static lv_disp_drv_t disp_drv_1;
    lv_disp_drv_init(&disp_drv_1);
    disp_drv_1.hor_res = TFT_DISPLAY_WIDTH;
    disp_drv_1.ver_res = TFT_DISPLAY_HEIGHT;
    disp_drv_1.flush_cb = flush_cb_1;
    disp_drv_1.draw_buf = &draw_buf_dsc_1;
    lv_disp_t* disp1 = lv_disp_drv_register(&disp_drv_1);

    // Initialize SlotDisplays
    lv_disp_t* lv_disps[] = { disp0, disp1 };
    numDisplays = 0;
    for (uint8_t i = 0; i < TFT_NUM_DISPLAYS; i++) {
        displays[i].begin(cs_pins[i], i, lv_disps[i]);
        numDisplays++;
        Serial.printf("Display %d: OK (CS=GPIO%d)\n", i, cs_pins[i]);
    }

    // Initial flush
    lv_timer_handler();
}

void updateDisplays() {
    // Update widget state FIRST, then render
    for (uint8_t i = 0; i < numDisplays; i++) {
        if (!scales.isConnected(i)) continue;

        float w = scales.getWeight(i);
        float ws = scales.getStableWeight(i);
        bool stable = scales.isStable(i);
        bool present = ws > SPOOL_PRESENT_THRESHOLD;

        displays[i].update(w, ws, stable, present);
    }

    // LVGL tick — render all pending changes across both displays
    lv_timer_handler();
}

void setDisplaySpoolInfo(uint8_t channel, const SpoolInfo& info) {
    if (channel < numDisplays) {
        displays[channel].setSpoolInfo(info);
    }
}

SlotDisplay* getDisplay(uint8_t channel) {
    if (channel < numDisplays) {
        return &displays[channel];
    }
    return nullptr;
}
