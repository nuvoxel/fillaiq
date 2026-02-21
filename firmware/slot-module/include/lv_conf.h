#ifndef LV_CONF_H
#define LV_CONF_H

#include <stdint.h>

// ============================================================
// LVGL v8 Configuration — Filla IQ Dual Display
// ============================================================

// --- Color ---
#define LV_COLOR_DEPTH     16
#define LV_COLOR_16_SWAP   0    // TFT_eSPI pushColors handles byte swap

// --- Memory ---
#define LV_MEM_CUSTOM      0
#define LV_MEM_SIZE        (48U * 1024U)

// --- Tick ---
#define LV_TICK_CUSTOM     1
#define LV_TICK_CUSTOM_INCLUDE  "Arduino.h"
#define LV_TICK_CUSTOM_SYS_TIME_EXPR  (millis())

// --- Display ---
#define LV_DPI_DEF         130

// --- Logging ---
#define LV_USE_LOG         0

// --- Fonts ---
#define LV_FONT_MONTSERRAT_14  1
#define LV_FONT_MONTSERRAT_20  1
#define LV_FONT_MONTSERRAT_28  1
#define LV_FONT_DEFAULT        &lv_font_montserrat_14

// --- Widgets ---
#define LV_USE_ARC         1
#define LV_USE_BAR         1
#define LV_USE_BTN         0
#define LV_USE_BTNMATRIX   0
#define LV_USE_CANVAS      0
#define LV_USE_CHECKBOX    0
#define LV_USE_DROPDOWN    0
#define LV_USE_IMG         0
#define LV_USE_LABEL       1
#define LV_USE_LINE        0
#define LV_USE_ROLLER      0
#define LV_USE_SLIDER      0
#define LV_USE_SWITCH      0
#define LV_USE_TEXTAREA    0
#define LV_USE_TABLE       0

// --- Extra widgets ---
#define LV_USE_ANIMIMG     0
#define LV_USE_CALENDAR    0
#define LV_USE_CHART       0
#define LV_USE_COLORWHEEL  0
#define LV_USE_IMGBTN      0
#define LV_USE_KEYBOARD    0
#define LV_USE_LED         0
#define LV_USE_LIST        0
#define LV_USE_MENU        0
#define LV_USE_METER       0
#define LV_USE_MSGBOX      0
#define LV_USE_SPAN        0
#define LV_USE_SPINBOX     0
#define LV_USE_SPINNER     0
#define LV_USE_TABVIEW     0
#define LV_USE_TILEVIEW    0
#define LV_USE_WIN         0

// --- Themes ---
#define LV_USE_THEME_DEFAULT    1
#define LV_USE_THEME_BASIC      0
#define LV_THEME_DEFAULT_DARK   1

// --- Layouts ---
#define LV_USE_FLEX        1
#define LV_USE_GRID        0

// --- Demos (all off) ---
#define LV_USE_DEMO_WIDGETS        0
#define LV_USE_DEMO_KEYPAD_AND_ENCODER 0
#define LV_USE_DEMO_BENCHMARK      0
#define LV_USE_DEMO_STRESS         0
#define LV_USE_DEMO_MUSIC          0

#endif // LV_CONF_H
