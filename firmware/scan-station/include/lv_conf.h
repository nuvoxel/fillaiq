/**
 * LVGL configuration for FillaScan
 * LVGL v9.x — native display drivers (no TFT_eSPI)
 */

#ifndef LV_CONF_H
#define LV_CONF_H

#include <stdint.h>

// Color depth: 16-bit RGB565
#define LV_COLOR_DEPTH 16

// Memory: use malloc/free (ESP32 heap)
#define LV_USE_STDLIB_MALLOC    LV_STDLIB_CLIB
#define LV_USE_STDLIB_STRING    LV_STDLIB_CLIB
#define LV_USE_STDLIB_SPRINTF   LV_STDLIB_CLIB
#define LV_MEM_SIZE             (48 * 1024)

// Display refresh
#define LV_DEF_REFR_PERIOD     33   // ~30 FPS
#define LV_DPI_DEF             130

// Tick — provided via lv_tick_set_cb(millis) in display.cpp

// OS — none (bare metal, single-thread LVGL)
#define LV_USE_OS   LV_OS_NONE

// Drawing
#define LV_DRAW_BUF_STRIDE_ALIGN    1
#define LV_DRAW_BUF_ALIGN           4
#define LV_USE_DRAW_SW              1

// Fonts — Montserrat built-in
#define LV_FONT_MONTSERRAT_12  1
#define LV_FONT_MONTSERRAT_14  1
#define LV_FONT_MONTSERRAT_16  1
#define LV_FONT_MONTSERRAT_20  1
#define LV_FONT_MONTSERRAT_24  1
#define LV_FONT_MONTSERRAT_28  1
#define LV_FONT_MONTSERRAT_32  1
#define LV_FONT_MONTSERRAT_36  1
#define LV_FONT_DEFAULT         &lv_font_montserrat_14

// Widgets
#define LV_USE_LABEL    1
#define LV_USE_IMAGE    1
#define LV_USE_ARC      1
#define LV_USE_BAR      1
#define LV_USE_BTN      1
#define LV_USE_CANVAS   1
#define LV_USE_LINE     1
#define LV_USE_ROLLER   0
#define LV_USE_SLIDER   0
#define LV_USE_SWITCH   0
#define LV_USE_TEXTAREA 0
#define LV_USE_TABLE    0
#define LV_USE_CHECKBOX 0
#define LV_USE_DROPDOWN 1
#define LV_USE_KEYBOARD 0
#define LV_USE_LIST     0
#define LV_USE_MENU     0
#define LV_USE_MSGBOX   0
#define LV_USE_SPAN     0
#define LV_USE_SPINBOX  0
#define LV_USE_TABVIEW  0
#define LV_USE_TILEVIEW 0
#define LV_USE_WIN      0

// Layouts
#define LV_USE_FLEX     1
#define LV_USE_GRID     0

// Theme
#define LV_USE_THEME_DEFAULT    1
#define LV_THEME_DEFAULT_DARK   1

// Logging (disabled in production, enable for debug)
#define LV_USE_LOG      0

// QR code (we use ricmoo/QRCode separately, not LVGL's)
#define LV_USE_QRCODE  0

// Native display drivers (replaces TFT_eSPI)
#define LV_USE_ST7789        1
#define LV_USE_ILI9341       1

#endif // LV_CONF_H
