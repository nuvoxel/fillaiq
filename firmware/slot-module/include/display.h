#pragma once

#include <Arduino.h>
#include <lvgl.h>
#include "config.h"

// ============================================================
// Filla IQ — Dual TFT Display Driver (LVGL)
// ST7789V3 240x280, shared SPI bus, manual CS toggling
// LVGL handles dirty-region rendering, one lv_disp_t per display
// ============================================================

struct SpoolInfo {
    String brand;         // e.g. "BAMBU"
    String name;          // e.g. "PLA Basic"
    String material;      // e.g. "PLA"
    float  diameter;      // mm (1.75 or 2.85)
    float  fullWeight;    // grams of filament when full
    lv_color_t color;     // filament color

    SpoolInfo() : brand(""), name(""), material(""), diameter(1.75f),
                  fullWeight(SPOOL_FULL_WEIGHT_G), color(lv_color_make(0, 255, 0)) {}
};

class SlotDisplay {
public:
    void begin(uint8_t cs_pin, uint8_t channel, lv_disp_t* disp);
    void setSpoolInfo(const SpoolInfo& info);
    void update(float weight, float stableWeight, bool isStable, bool spoolPresent);

    // Calibration mode
    void showCalWaitEmpty();
    void showCalWaitWeight();
    void showCalResult(float factor, float verify, float expected);
    void showCalDone();
    void exitCalMode();

private:
    lv_disp_t* _lv_disp;
    uint8_t _cs_pin;
    uint8_t _channel;
    SpoolInfo _spool;
    bool _calMode;
    bool _lastPresent;

    // --- Spool screen widgets ---
    lv_obj_t* _scr_spool;
    lv_obj_t* _lbl_brand;
    lv_obj_t* _lbl_name;
    lv_obj_t* _obj_spool_outer;
    lv_obj_t* _obj_spool_ring;
    lv_obj_t* _obj_spool_inner;
    lv_obj_t* _obj_spool_hub;
    lv_obj_t* _lbl_material;
    lv_obj_t* _bar_fill;
    lv_obj_t* _lbl_percent;
    lv_obj_t* _lbl_weight;

    // --- Empty screen widgets ---
    lv_obj_t* _scr_empty;
    lv_obj_t* _obj_ghost_outer;
    lv_obj_t* _obj_ghost_hub;
    lv_obj_t* _lbl_empty_ch;
    lv_obj_t* _lbl_empty_msg;

    // --- Cal screen widgets ---
    lv_obj_t* _scr_cal;
    lv_obj_t* _lbl_cal_title;
    lv_obj_t* _lbl_cal_ch;
    lv_obj_t* _lbl_cal_line1;
    lv_obj_t* _lbl_cal_line2;

    void buildUI();
    void buildSpoolScreen();
    void buildEmptyScreen();
    void buildCalScreen();
    void updateSpoolColors();
};

// Global interface (same API as before — main.cpp unchanged)
void initDisplays();
void updateDisplays();
void setDisplaySpoolInfo(uint8_t channel, const SpoolInfo& info);
SlotDisplay* getDisplay(uint8_t channel);
