#include "display.h"
#include <SPI.h>
#include <TFT_eSPI.h>
#include <qrcode.h>

Display display;

static TFT_eSPI* tft = nullptr;

// Brand color (#FF5C2E)
#define BRAND_ORANGE  0xFAE3
#define DARK_BG       0x0861
#define GRAY          0x8410
#define LIGHT_GRAY    0xC618
#define GREEN         0x4F60
#define FLANGE_GRAY   0x4208

static uint16_t rgb888to565(uint8_t r, uint8_t g, uint8_t b) {
    return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}

void Display::begin() {
    _ready = false;
    _lastState = SCAN_IDLE;
    _lastUpdate = 0;
    _forceRedraw = true;

    tft = new TFT_eSPI();
    tft->init();
    tft->setRotation(0);  // Portrait 240x280
    tft->fillScreen(DARK_BG);
    tft->setTextColor(TFT_WHITE, DARK_BG);

    // Backlight on
    pinMode(TFT_BLK_PIN, OUTPUT);
    digitalWrite(TFT_BLK_PIN, HIGH);

    _ready = true;

    showMessage("Filla IQ", "Scan Station v0.2");
    Serial.println("  TFT: ST7789 240x280 ready");
}

// ── Shared Header ───────────────────────────────────────────

void Display::drawHeader(const char* title, uint16_t titleColor) {
    // "F" logo box
    tft->fillRoundRect(10, 8, 32, 32, 6, BRAND_ORANGE);
    tft->setTextColor(TFT_WHITE, BRAND_ORANGE);
    tft->setTextDatum(MC_DATUM);
    tft->setTextSize(1);
    tft->drawString("F", 26, 24, 4);

    // Title
    tft->setTextColor(titleColor, DARK_BG);
    tft->setTextDatum(ML_DATUM);
    tft->drawString(title, 50, 24, 4);

    // Divider
    tft->drawFastHLine(10, 46, 220, GRAY);
}

// ── Spool Icon ──────────────────────────────────────────────

void Display::drawSpoolIcon(int cx, int cy, int w, int h, uint16_t fillColor) {
    int hubW = w * 4 / 10;     // 40% width
    int hubH = h * 7 / 10;     // 70% height
    int flangeH = h / 8;

    // Hub (filament color)
    tft->fillRect(cx - hubW/2, cy - hubH/2, hubW, hubH, fillColor);

    // Top flange
    int ty = cy - hubH/2 - flangeH/2;
    tft->fillRect(cx - w/2, ty, w, flangeH, FLANGE_GRAY);

    // Bottom flange
    int by = cy + hubH/2 - flangeH/2;
    tft->fillRect(cx - w/2, by, w, flangeH, FLANGE_GRAY);

    // Center hole
    int holeR = hubW * 15 / 100;
    if (holeR < 3) holeR = 3;
    tft->fillCircle(cx, cy, holeR, DARK_BG);
    tft->drawCircle(cx, cy, holeR, FLANGE_GRAY);

    // Hub outline
    tft->drawRect(cx - hubW/2, cy - hubH/2, hubW, hubH, GRAY);
}

// ── Idle Screen ─────────────────────────────────────────────

void Display::drawIdle() {
    // Large centered "F" logo
    tft->fillRoundRect(88, 70, 64, 64, 12, BRAND_ORANGE);
    tft->setTextColor(TFT_WHITE, BRAND_ORANGE);
    tft->setTextDatum(MC_DATUM);
    tft->drawString("F", 120, 102, 7);

    // App name
    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->setTextDatum(TC_DATUM);
    tft->drawString("Filla IQ", 120, 150, 4);

    // Prompt
    tft->setTextColor(GRAY, DARK_BG);
    tft->drawString("Place item on platform", 120, 190, 2);
}

// ── Unknown Object Screen ───────────────────────────────────

void Display::drawUnknown(float weight, bool stable, const DistanceData* dist, const ColorData* color) {
    drawHeader("Scanning", BRAND_ORANGE);

    if (stable) {
        tft->setTextDatum(TR_DATUM);
        tft->setTextColor(GREEN, DARK_BG);
        tft->drawString("STABLE", 230, 12, 2);
    }

    // Question mark icon (left side)
    tft->fillRoundRect(15, 55, 70, 70, 8, FLANGE_GRAY);
    tft->setTextColor(TFT_WHITE, FLANGE_GRAY);
    tft->setTextDatum(MC_DATUM);
    tft->drawString("?", 50, 90, 7);

    // Weight (right side, large)
    char wStr[16];
    snprintf(wStr, sizeof(wStr), "%.1f g", weight);
    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->setTextDatum(TL_DATUM);
    tft->drawString(wStr, 100, 60, 4);

    // Height from TOF
    if (dist && dist->valid) {
        float heightMm = TOF_ARM_HEIGHT_MM - dist->distanceMm;
        if (heightMm < 0) heightMm = 0;
        char hStr[24];
        snprintf(hStr, sizeof(hStr), "H: %.0f mm", heightMm);
        tft->setTextColor(GRAY, DARK_BG);
        tft->drawString(hStr, 100, 90, 2);
    }

    // Color swatch from spectral sensor
    if (color && color->valid) {
        uint8_t r8 = 0, g8 = 0, b8 = 0;
        if (color->sensorType == COLOR_AS7341) {
            // Rough RGB from spectral channels (normalize to 8-bit)
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
        }
        uint16_t swCol = rgb888to565(r8, g8, b8);
        tft->fillRoundRect(100, 110, 24, 24, 4, swCol);
        tft->drawRoundRect(100, 110, 24, 24, 4, GRAY);

        tft->setTextColor(GRAY, DARK_BG);
        tft->setTextDatum(ML_DATUM);
        tft->drawString("Color", 130, 122, 2);
    }

    // Divider
    tft->drawFastHLine(10, 145, 220, GRAY);

    // Status prompt
    tft->setTextColor(BRAND_ORANGE, DARK_BG);
    tft->setTextDatum(TC_DATUM);
    tft->drawString("Unidentified object", 120, 155, 2);

    tft->setTextColor(GRAY, DARK_BG);
    tft->drawString("Tap NFC tag or use app", 120, 180, 2);
}

// ── Identified Spool Screen ─────────────────────────────────

void Display::drawSpool(float weight, bool stable, const FilamentInfo& fi, const DistanceData* dist) {
    drawHeader(fi.material, GREEN);

    if (stable) {
        tft->setTextDatum(TR_DATUM);
        tft->setTextColor(GREEN, DARK_BG);
        tft->drawString("STABLE", 230, 12, 2);
    }

    // Spool icon with filament color
    uint16_t filColor = rgb888to565(fi.color_r, fi.color_g, fi.color_b);
    drawSpoolIcon(65, 105, 90, 90, filColor);

    // Brand + name (right side)
    tft->setTextColor(BRAND_ORANGE, DARK_BG);
    tft->setTextDatum(TL_DATUM);
    if (fi.brand[0]) {
        tft->drawString(fi.brand, 120, 60, 2);
    }

    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->drawString(fi.name, 120, 80, 4);

    // Weight
    char wStr[16];
    snprintf(wStr, sizeof(wStr), "%.0f g", weight);
    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->drawString(wStr, 120, 115, 4);

    // Spool width from TOF (height of object on platform)
    if (dist && dist->valid) {
        float spoolW = TOF_ARM_HEIGHT_MM - dist->distanceMm;
        if (spoolW > 0) {
            char sStr[24];
            snprintf(sStr, sizeof(sStr), "W: %.0f mm", spoolW);
            tft->setTextColor(GRAY, DARK_BG);
            tft->drawString(sStr, 120, 145, 2);
        }
    }

    // Divider
    tft->drawFastHLine(10, 170, 220, GRAY);

    // Temperature info
    if (fi.nozzle_temp_min > 0) {
        char tempStr[32];
        snprintf(tempStr, sizeof(tempStr), "Nozzle %d-%dC", fi.nozzle_temp_min, fi.nozzle_temp_max);
        tft->setTextColor(GRAY, DARK_BG);
        tft->setTextDatum(TL_DATUM);
        tft->drawString(tempStr, 10, 178, 2);
    }
    if (fi.bed_temp > 0) {
        char bedStr[16];
        snprintf(bedStr, sizeof(bedStr), "Bed %dC", fi.bed_temp);
        tft->setTextColor(GRAY, DARK_BG);
        tft->setTextDatum(TR_DATUM);
        tft->drawString(bedStr, 230, 178, 2);
    }

    // Filament specs
    if (fi.filament_diameter > 0) {
        char specStr[40];
        snprintf(specStr, sizeof(specStr), "%.2fmm  %dm  %dg spool",
                 fi.filament_diameter, fi.filament_length_m, (int)fi.spool_net_weight);
        tft->setTextColor(GRAY, DARK_BG);
        tft->setTextDatum(TC_DATUM);
        tft->drawString(specStr, 120, 198, 1);
    }

    // Color swatch + hex
    uint16_t swCol = rgb888to565(fi.color_r, fi.color_g, fi.color_b);
    tft->fillRoundRect(10, 215, 20, 20, 4, swCol);
    tft->drawRoundRect(10, 215, 20, 20, 4, GRAY);
    char hexStr[10];
    snprintf(hexStr, sizeof(hexStr), "#%02X%02X%02X", fi.color_r, fi.color_g, fi.color_b);
    tft->setTextColor(GRAY, DARK_BG);
    tft->setTextDatum(ML_DATUM);
    tft->drawString(hexStr, 35, 225, 2);
}

// ── Splash / Message Screen ─────────────────────────────────

void Display::showMessage(const char* line1, const char* line2) {
    if (!_ready) return;

    tft->fillScreen(DARK_BG);

    // "F" logo box
    tft->fillRoundRect(96, 60, 48, 48, 10, BRAND_ORANGE);
    tft->setTextColor(TFT_WHITE, BRAND_ORANGE);
    tft->setTextDatum(MC_DATUM);
    tft->setTextSize(1);
    tft->drawString("F", 120, 84, 4);

    // Line 1
    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->setTextDatum(TC_DATUM);
    tft->drawString(line1, 120, 125, 4);

    // Line 2
    if (line2) {
        tft->setTextColor(GRAY, DARK_BG);
        tft->drawString(line2, 120, 160, 2);
    }
}

// ── QR Code Screen ──────────────────────────────────────────

void Display::showQrCode(const char* data, const char* label) {
    if (!_ready) return;

    QRCode qrcode;
    uint8_t qrcodeData[256];
    int8_t result = -1;

    for (uint8_t ver = 3; ver <= 6; ver++) {
        result = qrcode_initText(&qrcode, qrcodeData, ver, ECC_LOW, data);
        if (result == 0) {
            Serial.printf("[Display] QR OK: v%d size=%d\n", ver, qrcode.size);
            break;
        }
    }

    if (result != 0) {
        showMessage("QR Error", data);
        return;
    }

    tft->fillScreen(DARK_BG);

    // Header
    tft->fillRoundRect(20, 12, 32, 32, 6, BRAND_ORANGE);
    tft->setTextColor(TFT_WHITE, BRAND_ORANGE);
    tft->setTextDatum(MC_DATUM);
    tft->drawString("F", 36, 28, 4);

    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->setTextDatum(ML_DATUM);
    tft->drawString("FillaIQ", 60, 28, 4);

    tft->drawFastHLine(20, 50, 200, GRAY);

    // QR Code
    int scale = 200 / (qrcode.size + 4);
    if (scale < 1) scale = 1;
    int qrPx = qrcode.size * scale;
    int ox = (240 - qrPx) / 2;
    int oy = 65;
    int margin = scale * 2;

    tft->fillRect(ox - margin, oy - margin, qrPx + margin * 2, qrPx + margin * 2, TFT_WHITE);

    for (uint8_t y = 0; y < qrcode.size; y++) {
        for (uint8_t x = 0; x < qrcode.size; x++) {
            if (qrcode_getModule(&qrcode, x, y)) {
                tft->fillRect(ox + x * scale, oy + y * scale, scale, scale, TFT_BLACK);
            }
        }
    }

    int textY = oy + qrPx + margin + 15;
    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->setTextDatum(TC_DATUM);
    tft->drawString("Scan QR to connect", 120, textY, 2);

    if (label) {
        tft->setTextColor(GRAY, DARK_BG);
        tft->drawString(label, 120, textY + 22, 2);
    }

    tft->setTextColor(GRAY, DARK_BG);
    tft->drawString("Password: fillaiq1", 120, textY + 44, 1);
}

// ── Main Update (dispatcher) ────────────────────────────────

// Clear a rectangular region before redrawing dynamic text
static void clearRegion(int x, int y, int w, int h) {
    tft->fillRect(x, y, w, h, DARK_BG);
}

void Display::update(ScanState state, float weight, bool stable,
                     const char* nfcUid,
                     const FilamentInfo* filament,
                     const DistanceData* distance,
                     const ColorData* color) {
    if (!_ready) return;

    unsigned long now = millis();

    bool hasSpool = filament && filament->valid && filament->name[0];
    // Determine which screen mode we're in
    enum { MODE_IDLE, MODE_UNKNOWN, MODE_SPOOL } mode;
    if (state == SCAN_IDLE && !hasSpool) mode = MODE_IDLE;
    else if (hasSpool) mode = MODE_SPOOL;
    else mode = MODE_UNKNOWN;

    static int lastMode = -1;
    bool modeChanged = ((int)mode != lastMode);

    if (!modeChanged && !_forceRedraw && now - _lastUpdate < 300) return;
    _lastUpdate = now;
    _lastState = state;
    _forceRedraw = false;

    // Deassert NFC CS before SPI display ops
    digitalWrite(NFC_CS_PIN, HIGH);

    if (isnan(weight) || isinf(weight)) weight = 0.0f;

    tft->setTextSize(1);

    if (modeChanged) {
        // Full redraw on mode change
        tft->fillScreen(DARK_BG);
        lastMode = (int)mode;
    }

    switch (mode) {
    case MODE_IDLE:
        if (modeChanged) drawIdle();
        break;

    case MODE_SPOOL:
        if (modeChanged) {
            // Draw static elements: header, spool icon, brand, labels, temps, specs, color swatch
            drawSpool(weight, stable, *filament, distance);
            if (nfcUid && nfcUid[0]) {
                tft->setTextColor(GRAY, DARK_BG);
                tft->setTextDatum(BC_DATUM);
                tft->drawString(nfcUid, 120, 275, 1);
            }
        } else {
            // Only update dynamic values: weight + stable indicator
            // Clear weight area and redraw
            clearRegion(120, 115, 120, 28);
            char wStr[16];
            snprintf(wStr, sizeof(wStr), "%.0f g", weight);
            tft->setTextColor(TFT_WHITE, DARK_BG);
            tft->setTextDatum(TL_DATUM);
            tft->drawString(wStr, 120, 115, 4);

            // Stable indicator
            clearRegion(180, 8, 55, 20);
            if (stable) {
                tft->setTextDatum(TR_DATUM);
                tft->setTextColor(GREEN, DARK_BG);
                tft->drawString("STABLE", 230, 12, 2);
            }
        }
        break;

    case MODE_UNKNOWN:
        if (modeChanged) {
            // Draw static elements: header, ? icon, labels, divider, prompts
            drawUnknown(weight, stable, distance, color);
            if (nfcUid && nfcUid[0]) {
                tft->setTextColor(GRAY, DARK_BG);
                tft->setTextDatum(BC_DATUM);
                tft->drawString(nfcUid, 120, 275, 1);
            }
        } else {
            // Only update dynamic values: weight, stable, height, color swatch
            // Weight
            clearRegion(100, 55, 135, 28);
            char wStr[16];
            snprintf(wStr, sizeof(wStr), "%.1f g", weight);
            tft->setTextColor(TFT_WHITE, DARK_BG);
            tft->setTextDatum(TL_DATUM);
            tft->drawString(wStr, 100, 60, 4);

            // Stable indicator
            clearRegion(180, 8, 55, 20);
            if (stable) {
                tft->setTextDatum(TR_DATUM);
                tft->setTextColor(GREEN, DARK_BG);
                tft->drawString("STABLE", 230, 12, 2);
            }

            // Height from TOF
            clearRegion(100, 86, 135, 18);
            if (distance && distance->valid) {
                float heightMm = TOF_ARM_HEIGHT_MM - distance->distanceMm;
                if (heightMm < 0) heightMm = 0;
                char hStr[24];
                snprintf(hStr, sizeof(hStr), "H: %.0f mm", heightMm);
                tft->setTextColor(GRAY, DARK_BG);
                tft->setTextDatum(TL_DATUM);
                tft->drawString(hStr, 100, 90, 2);
            }
        }
        break;
    }
}
