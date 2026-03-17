#pragma once

// ============================================================
// Filla IQ — Material Design Status Bar Icons
// Format: LVGL v9 lv_image_dsc_t, LV_COLOR_FORMAT_A1
//
// Each icon: 16x16 pixels, 1-bit alpha (opaque=1, transparent=0)
// Storage:   2 bytes per row x 16 rows = 32 bytes per icon
// Bit order: MSB first — byte0 bit7 = column 0, byte1 bit0 = column 15
//
// Rendering with tint color:
//   lv_obj_t* img = lv_image_create(parent);
//   lv_image_set_src(img, &icon_nfc);
//   lv_obj_set_style_image_recolor(img, green, 0);
//   lv_obj_set_style_image_recolor_opa(img, LV_OPA_COVER, 0);
// ============================================================

#include <lvgl.h>

// ── NFC / Contactless ────────────────────────────────────────
// Radiating concentric arcs from a center point, symmetric.
// Two arcs each side + center dot — classic NFC tap symbol.
//
// col mapping: byte0 bit7=col0, ..., byte0 bit0=col7
//              byte1 bit7=col8, ..., byte1 bit0=col15
static const uint8_t icon_nfc_data[] = {
    0x00, 0x00,  // ................
    0x01, 0x80,  // .......##.......
    0x06, 0x60,  // .....##..##.....
    0x08, 0x10,  // ....#......#....
    0x10, 0x08,  // ...#........#...
    0x21, 0x84,  // ..#....##....#..
    0x22, 0x44,  // ..#...#..#...#..
    0x24, 0x24,  // ..#..#....#..#..
    0x24, 0x24,  // ..#..#....#..#..
    0x22, 0x44,  // ..#...#..#...#..
    0x21, 0x84,  // ..#....##....#..
    0x10, 0x08,  // ...#........#...
    0x08, 0x10,  // ....#......#....
    0x06, 0x60,  // .....##..##.....
    0x01, 0x80,  // .......##.......
    0x00, 0x00,  // ................
};

static const lv_image_dsc_t icon_nfc = {
    .header = {
        .magic  = LV_IMAGE_HEADER_MAGIC,
        .cf     = LV_COLOR_FORMAT_A1,
        .flags  = 0,
        .w      = 16,
        .h      = 16,
        .stride = 2,
    },
    .data_size = 32,
    .data      = icon_nfc_data,
};

// ── Scale / Weight ───────────────────────────────────────────
// Balance scale: horizontal beam on a center post, two U-shaped
// pans hanging by vertical lines, spreading base at bottom.
static const uint8_t icon_scale_data[] = {
    0x01, 0x00,  // .......#........  post top
    0x01, 0x00,  // .......#........
    0x7F, 0xFE,  // .###############  beam
    0x41, 0x02,  // .#.....#......#.  pan lines
    0x41, 0x02,  // .#.....#......#.
    0xFD, 0x7F,  // ######.#.#######  pan rims
    0x83, 0x82,  // #.....##.#....#.  pan sides
    0xFE, 0xFE,  // #######.#######.  pan floors
    0x01, 0x00,  // .......#........  post continues
    0x01, 0x00,  // .......#........
    0x01, 0x00,  // .......#........
    0x01, 0x00,  // .......#........
    0x0F, 0xF0,  // ....########....  base spread
    0x1F, 0xF8,  // ...##########...
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
};

static const lv_image_dsc_t icon_scale = {
    .header = {
        .magic  = LV_IMAGE_HEADER_MAGIC,
        .cf     = LV_COLOR_FORMAT_A1,
        .flags  = 0,
        .w      = 16,
        .h      = 16,
        .stride = 2,
    },
    .data_size = 32,
    .data      = icon_scale_data,
};

// ── TOF / Distance ───────────────────────────────────────────
// Ruler silhouette: solid top and bottom rails, tick marks of
// varying height along the top edge. Instantly reads as "measure".
static const uint8_t icon_tof_data[] = {
    0xFF, 0xFF,  // ################  top rail
    0x80, 0x00,  // #...............
    0xF8, 0x00,  // #####...........  long tick
    0x80, 0x00,  // #...............
    0xE0, 0x00,  // ###.............  mid tick
    0x80, 0x00,  // #...............
    0xF8, 0x00,  // #####...........  long tick
    0x80, 0x00,  // #...............
    0xE0, 0x00,  // ###.............
    0x80, 0x00,  // #...............
    0xF8, 0x00,  // #####...........
    0x80, 0x00,  // #...............
    0xE0, 0x00,  // ###.............
    0x80, 0x00,  // #...............
    0x80, 0x00,  // #...............
    0xFF, 0xFF,  // ################  bottom rail
};

static const lv_image_dsc_t icon_tof = {
    .header = {
        .magic  = LV_IMAGE_HEADER_MAGIC,
        .cf     = LV_COLOR_FORMAT_A1,
        .flags  = 0,
        .w      = 16,
        .h      = 16,
        .stride = 2,
    },
    .data_size = 32,
    .data      = icon_tof_data,
};

// ── Color / Palette ──────────────────────────────────────────
// Filled circle (color wheel) with a triangular notch cut from
// the bottom-right quadrant — the universal "color palette" shape.
//
// Circle radius ~6.5px centered at (7.5, 7.5).
// Notch: rows 9-13, cols 9-15 cleared.
static const uint8_t icon_color_data[] = {
    0x00, 0x00,  // ................
    0x01, 0x00,  // .......#........
    0x0F, 0xE0,  // ....#######.....
    0x1F, 0xF8,  // ...##########...
    0x3F, 0xFC,  // ..############..
    0x7F, 0xFE,  // .##############.
    0x7F, 0xFE,  // .##############.
    0x7F, 0xFE,  // .##############.
    0x7F, 0xFE,  // .##############.
    0x7F, 0x80,  // .########.......  notch begins
    0x7F, 0x80,  // .########.......
    0x3F, 0x80,  // ..#######.......
    0x1F, 0x80,  // ...######.......
    0x0F, 0x80,  // ....#####.......
    0x01, 0x00,  // .......#........
    0x00, 0x00,  // ................
};

static const lv_image_dsc_t icon_color = {
    .header = {
        .magic  = LV_IMAGE_HEADER_MAGIC,
        .cf     = LV_COLOR_FORMAT_A1,
        .flags  = 0,
        .w      = 16,
        .h      = 16,
        .stride = 2,
    },
    .data_size = 32,
    .data      = icon_color_data,
};

// ── Environment / Thermostat ─────────────────────────────────
// Thermometer: 4px-wide tube (cols 6-9) with three temperature
// tick marks on the right side (col 11), expanding into a
// filled bulb at the bottom. Immediate "temperature" read.
static const uint8_t icon_env_data[] = {
    0x03, 0xC0,  // ......####......  tube top
    0x03, 0xC0,  // ......####......
    0x03, 0xC0,  // ......####......
    0x03, 0xD0,  // ......####.#....  tick (col11)
    0x03, 0xC0,  // ......####......
    0x03, 0xD0,  // ......####.#....  tick
    0x03, 0xC0,  // ......####......
    0x03, 0xD0,  // ......####.#....  tick
    0x03, 0xC0,  // ......####......
    0x07, 0xE0,  // .....######.....  bulb begins
    0x0F, 0xF0,  // ....########....
    0x1F, 0xF8,  // ...##########...
    0x1F, 0xF8,  // ...##########...
    0x0F, 0xF0,  // ....########....
    0x07, 0xE0,  // .....######.....
    0x00, 0x00,  // ................
};

static const lv_image_dsc_t icon_env = {
    .header = {
        .magic  = LV_IMAGE_HEADER_MAGIC,
        .cf     = LV_COLOR_FORMAT_A1,
        .flags  = 0,
        .w      = 16,
        .h      = 16,
        .stride = 2,
    },
    .data_size = 32,
    .data      = icon_env_data,
};

// ── SD Card ──────────────────────────────────────────────────
// SD card silhouette: rectangle (cols 3-12) with a 2-step bevel
// on the top-left corner, and three horizontal contact-line gaps
// (rows 10, 12, 14) to suggest the gold contacts.
static const uint8_t icon_sd_data[] = {
    0x03, 0xF0,  // ......######....  bevel step 1 (cols 6-11)
    0x0F, 0xF0,  // ....########....  bevel step 2 (cols 4-11)
    0x1F, 0xF8,  // ...##########...  full width (cols 3-12)
    0x1F, 0xF8,  // ...##########...
    0x1F, 0xF8,  // ...##########...
    0x1F, 0xF8,  // ...##########...
    0x1F, 0xF8,  // ...##########...
    0x1F, 0xF8,  // ...##########...
    0x1F, 0xF8,  // ...##########...
    0x1F, 0xF8,  // ...##########...
    0x18, 0x08,  // ...##......#....  contact gap
    0x1F, 0xF8,  // ...##########...
    0x18, 0x08,  // ...##......#....  contact gap
    0x1F, 0xF8,  // ...##########...
    0x18, 0x08,  // ...##......#....  contact gap
    0x1F, 0xF8,  // ...##########...
};

static const lv_image_dsc_t icon_sd = {
    .header = {
        .magic  = LV_IMAGE_HEADER_MAGIC,
        .cf     = LV_COLOR_FORMAT_A1,
        .flags  = 0,
        .w      = 16,
        .h      = 16,
        .stride = 2,
    },
    .data_size = 32,
    .data      = icon_sd_data,
};

// ── Audio / Volume Up ────────────────────────────────────────
// Speaker box (cols 1-3, rows 5-8) + triangular cone flaring
// right (rows 2-11) + three sound-wave arcs (cols 8, 10, 12).
// Vertically symmetric for clean appearance.
//
// col -> byte/bit: col c => byte c/8, bit (7 - c%8)
// col8 =byte1 bit7=0x80, col9=0x40, col10=0x20, col11=0x10, col12=0x08
static const uint8_t icon_audio_data[] = {
    0x00, 0x08,  // ............#...  outer wave (col12)
    0x00, 0x28,  // ..........#.#...  mid + outer
    0x08, 0xA8,  // ....#...#.#.#...  cone tip + waves
    0x14, 0xA8,  // ...#.#..#.#.#...  cone spreading
    0x22, 0x50,  // ..#...#..#.#....  cone + mid waves
    0x71, 0xC0,  // .###...####.....  box + cone + inner wave
    0x71, 0x80,  // .###...##.......  box + cone
    0x71, 0x80,  // .###...##.......
    0x71, 0xC0,  // .###...####.....  box + cone + inner wave
    0x22, 0x50,  // ..#...#..#.#....
    0x14, 0xA8,  // ...#.#..#.#.#...
    0x08, 0xA8,  // ....#...#.#.#...
    0x00, 0x28,  // ..........#.#...
    0x00, 0x08,  // ............#...
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
};

static const lv_image_dsc_t icon_audio = {
    .header = {
        .magic  = LV_IMAGE_HEADER_MAGIC,
        .cf     = LV_COLOR_FORMAT_A1,
        .flags  = 0,
        .w      = 16,
        .h      = 16,
        .stride = 2,
    },
    .data_size = 32,
    .data      = icon_audio_data,
};

// ── WiFi ─────────────────────────────────────────────────────
// Three concentric open arcs (outer full-width, mid, inner) plus
// a 2x2 dot at the center bottom. Classic IEEE 802.11 symbol.
//
// Outer arc: row 1 top + row 2 sides
// Mid arc:   row 4 top + row 5 sides
// Inner arc: row 7 top + row 8 sides
// Dot:       rows 11-12, cols 6-9
static const uint8_t icon_wifi_data[] = {
    0x00, 0x00,  // ................
    0x3F, 0xFC,  // ..############..  outer arc top
    0xC0, 0x03,  // ##............##  outer arc sides
    0x00, 0x00,  // ................
    0x0F, 0xF0,  // ....########....  mid arc top
    0x30, 0x0C,  // ..##........##..  mid arc sides
    0x00, 0x00,  // ................
    0x03, 0xC0,  // ......####......  inner arc top
    0x0C, 0x30,  // ....##....##....  inner arc sides
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
    0x03, 0xC0,  // ......####......  dot
    0x03, 0xC0,  // ......####......
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
};

static const lv_image_dsc_t icon_wifi = {
    .header = {
        .magic  = LV_IMAGE_HEADER_MAGIC,
        .cf     = LV_COLOR_FORMAT_A1,
        .flags  = 0,
        .w      = 16,
        .h      = 16,
        .stride = 2,
    },
    .data_size = 32,
    .data      = icon_wifi_data,
};

// ── Paired / Cloud Done ──────────────────────────────────────
// Cloud outline with a bold checkmark overlaid inside.
// Two bumps on the top edge, flat sides, flat bottom.
// Check: left leg descends rows 3-5 left-ward; right leg
// ascends rows 3-7 right-ward.
//
// Cloud outline (cols 1-12, rows 1-8):
//   Bumps at cols 2-5 and cols 8-11 (row 1)
//   Sides col 1 and col 12 (rows 2-7)
//   Bottom cols 1-12 (row 8)
// Checkmark overlaid rows 3-7, cols 3-13
static const uint8_t icon_paired_data[] = {
    0x00, 0x00,  // ................
    0x1E, 0x78,  // ...####.####....  cloud bumps (cols 3-6, cols 9-12)
    0x61, 0x86,  // .##....##....##.  cloud sides + inner walls (cols 1,2 / col7,col8 / cols 13,14)
    0x80, 0x04,  // #............#..  cloud outer sides (col0, col13)
    0x80, 0x06,  // #...........##..  cloud side + check start (col14)
    0x81, 0x0C,  // #.......#...##..  check descends left (col7) + right stroke (cols 12-13)
    0xC2, 0x18,  // ##.....#..##....  check valley (col1, col6, cols 11-12)
    0x7C, 0xF0,  // .#####..####....  cloud bottom rail (cols 1-5, cols 8-11)
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
};

static const lv_image_dsc_t icon_paired = {
    .header = {
        .magic  = LV_IMAGE_HEADER_MAGIC,
        .cf     = LV_COLOR_FORMAT_A1,
        .flags  = 0,
        .w      = 16,
        .h      = 16,
        .stride = 2,
    },
    .data_size = 32,
    .data      = icon_paired_data,
};

// ── Printer ──────────────────────────────────────────────────
// Printer silhouette: narrow input paper tray on top (cols 3-12),
// wide printer body (cols 1-14) with a horizontal paper-exit slot,
// narrow output paper emerging from the bottom (cols 3-12).
static const uint8_t icon_printer_data[] = {
    0x1F, 0xF8,  // ...##########...  input paper
    0x1F, 0xF8,  // ...##########...
    0x1F, 0xF8,  // ...##########...
    0x7F, 0xFE,  // .##############.  printer body
    0x7F, 0xFE,  // .##############.
    0x7F, 0xFE,  // .##############.
    0x60, 0x06,  // .##..........##.  paper exit slot (opening)
    0x60, 0x06,  // .##..........##.
    0x7F, 0xFE,  // .##############.
    0x7F, 0xFE,  // .##############.
    0x7F, 0xFE,  // .##############.
    0x1F, 0xF8,  // ...##########...  output paper
    0x1F, 0xF8,  // ...##########...
    0x1F, 0xF8,  // ...##########...
    0x00, 0x00,  // ................
    0x00, 0x00,  // ................
};

static const lv_image_dsc_t icon_printer = {
    .header = {
        .magic  = LV_IMAGE_HEADER_MAGIC,
        .cf     = LV_COLOR_FORMAT_A1,
        .flags  = 0,
        .w      = 16,
        .h      = 16,
        .stride = 2,
    },
    .data_size = 32,
    .data      = icon_printer_data,
};
