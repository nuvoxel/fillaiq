#include "display.h"
#include <SPI.h>
#include <TFT_eSPI.h>
#include <qrcode.h>
#include "icons.h"
#include "api_client.h"

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
    _lastIcons = 0xFF;  // Force first draw

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

// ── Status Icons (top-right corner) ────────────────────────

void Display::drawStatusIcons(uint8_t icons) {
    // Icons drawn right-to-left, inset to clear rounded display corners
    int x = 204;
    int y = 14;
    int gap = 4;

    // Clear icon area
    tft->fillRect(x - 3 * (ICON_W + gap), y, 3 * (ICON_W + gap) + ICON_W, ICON_H, DARK_BG);

    // WiFi
    if (icons & ICON_WIFI) {
        tft->drawXBitmap(x, y, icon_wifi, ICON_W, ICON_H, GREEN);
    } else {
        tft->drawXBitmap(x, y, icon_wifi_off, ICON_W, ICON_H, GRAY);
    }

    x -= (ICON_W + gap);

    // Paired/linked
    if (icons & ICON_PAIRED) {
        tft->drawXBitmap(x, y, icon_linked, ICON_W, ICON_H, GREEN);
    } else {
        tft->drawXBitmap(x, y, icon_unlinked, ICON_W, ICON_H, GRAY);
    }

    x -= (ICON_W + gap);

    // Printer
    if (icons & ICON_PRINTER) {
        tft->drawXBitmap(x, y, icon_printer, ICON_W, ICON_H, GREEN);
    }
}

// ── Shared Header ───────────────────────────────────────────

void Display::drawHeader(const char* title, uint16_t titleColor, uint8_t icons) {
    // "F" logo box
    tft->fillRoundRect(10, 8, 32, 32, 6, BRAND_ORANGE);
    tft->setTextColor(TFT_WHITE, BRAND_ORANGE);
    tft->setTextDatum(MC_DATUM);
    tft->setTextSize(1);
    tft->drawString("F", 26, 24, 4);

    // Title (leave room for icons on right)
    tft->setTextColor(titleColor, DARK_BG);
    tft->setTextDatum(ML_DATUM);
    tft->drawString(title, 50, 24, 4);

    // Status icons
    drawStatusIcons(icons);

    // Divider
    tft->drawFastHLine(10, 46, 220, GRAY);
}

// ── Spool Icon ──────────────────────────────────────────────

void Display::drawSpoolIcon(int cx, int cy, int w, int h, uint16_t fillColor) {
    int hubW = w * 4 / 10;
    int hubH = h * 7 / 10;
    int flangeH = h / 8;

    tft->fillRect(cx - hubW/2, cy - hubH/2, hubW, hubH, fillColor);

    int ty = cy - hubH/2 - flangeH/2;
    tft->fillRect(cx - w/2, ty, w, flangeH, FLANGE_GRAY);

    int by = cy + hubH/2 - flangeH/2;
    tft->fillRect(cx - w/2, by, w, flangeH, FLANGE_GRAY);

    int holeR = hubW * 15 / 100;
    if (holeR < 3) holeR = 3;
    tft->fillCircle(cx, cy, holeR, DARK_BG);
    tft->drawCircle(cx, cy, holeR, FLANGE_GRAY);

    tft->drawRect(cx - hubW/2, cy - hubH/2, hubW, hubH, GRAY);
}

// ── Idle Screen ─────────────────────────────────────────────

void Display::drawIdle(uint8_t icons) {
    // Status icons in top-right even on idle screen
    drawStatusIcons(icons);

    // Large centered "F" logo
    tft->fillRoundRect(88, 70, 64, 64, 12, BRAND_ORANGE);
    tft->setTextColor(TFT_WHITE, BRAND_ORANGE);
    tft->setTextDatum(MC_DATUM);
    tft->drawString("F", 120, 102, 7);

    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->setTextDatum(TC_DATUM);
    tft->drawString("Filla IQ", 120, 150, 4);

    tft->setTextColor(GRAY, DARK_BG);
    tft->drawString("Place item on platform", 120, 190, 2);
}

// ── Unknown Object Screen ───────────────────────────────────

void Display::drawUnknown(float weight, bool stable, const DistanceData* dist, const ColorData* color, uint8_t icons) {
    drawHeader("Scanning", BRAND_ORANGE, icons);

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
            // CIE XYZ to approximate RGB
            float sum = color->cie_x + color->cie_y + color->cie_z;
            if (sum > 0) {
                r8 = (uint8_t)min(255.0f, color->cie_x / sum * 255.0f * 2.0f);
                g8 = (uint8_t)min(255.0f, color->cie_y / sum * 255.0f * 2.0f);
                b8 = (uint8_t)min(255.0f, color->cie_z / sum * 255.0f * 2.0f);
            }
        }
        uint16_t swCol = rgb888to565(r8, g8, b8);
        tft->fillRoundRect(100, 110, 24, 24, 4, swCol);
        tft->drawRoundRect(100, 110, 24, 24, 4, GRAY);

        tft->setTextColor(GRAY, DARK_BG);
        tft->setTextDatum(ML_DATUM);
        tft->drawString("Color", 130, 122, 2);
    }

    tft->drawFastHLine(10, 145, 220, GRAY);

    tft->setTextColor(BRAND_ORANGE, DARK_BG);
    tft->setTextDatum(TC_DATUM);
    tft->drawString("Unidentified object", 120, 155, 2);

    tft->setTextColor(GRAY, DARK_BG);
    tft->drawString("Tap NFC tag or use app", 120, 180, 2);
}

// ── Identified Item Screen (data from server response) ──────

void Display::drawIdentified(float weight, bool stable, const ScanResponse& resp, const DistanceData* dist, uint8_t icons) {
    const char* title = resp.material[0] ? resp.material : resp.itemType;
    drawHeader(title, GREEN, icons);

    // Spool icon with filament color (from server-parsed NFC or spectral)
    uint16_t filColor = rgb888to565(resp.colorR, resp.colorG, resp.colorB);
    bool hasColor = (resp.colorR || resp.colorG || resp.colorB);
    drawSpoolIcon(65, 105, 90, 90, hasColor ? filColor : FLANGE_GRAY);

    // Item name (right side)
    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->setTextDatum(TL_DATUM);
    // Truncate long names for display
    char nameBuf[22];
    strncpy(nameBuf, resp.itemName, sizeof(nameBuf) - 1);
    nameBuf[sizeof(nameBuf) - 1] = '\0';
    tft->drawString(nameBuf, 120, 65, 4);

    // Weight
    char wStr[16];
    snprintf(wStr, sizeof(wStr), "%.0f g", weight);
    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->drawString(wStr, 120, 115, 4);

    // Height from TOF
    if (dist && dist->valid) {
        float spoolW = TOF_ARM_HEIGHT_MM - dist->distanceMm;
        if (spoolW > 0) {
            char sStr[24];
            snprintf(sStr, sizeof(sStr), "W: %.0f mm", spoolW);
            tft->setTextColor(GRAY, DARK_BG);
            tft->drawString(sStr, 120, 145, 2);
        }
    }

    tft->drawFastHLine(10, 170, 220, GRAY);

    // Temperature info (from server-parsed NFC data)
    if (resp.nozzleTempMin > 0) {
        char tempStr[32];
        snprintf(tempStr, sizeof(tempStr), "Nozzle %d-%dC", resp.nozzleTempMin, resp.nozzleTempMax);
        tft->setTextColor(GRAY, DARK_BG);
        tft->setTextDatum(TL_DATUM);
        tft->drawString(tempStr, 10, 178, 2);
    }
    if (resp.bedTemp > 0) {
        char bedStr[16];
        snprintf(bedStr, sizeof(bedStr), "Bed %dC", resp.bedTemp);
        tft->setTextColor(GRAY, DARK_BG);
        tft->setTextDatum(TR_DATUM);
        tft->drawString(bedStr, 230, 178, 2);
    }

    // Color swatch + hex
    if (hasColor) {
        tft->fillRoundRect(10, 215, 20, 20, 4, filColor);
        tft->drawRoundRect(10, 215, 20, 20, 4, GRAY);
        if (resp.colorHex[0]) {
            tft->setTextColor(GRAY, DARK_BG);
            tft->setTextDatum(ML_DATUM);
            tft->drawString(resp.colorHex, 35, 225, 2);
        }
    }

    // NFC tag format indicator
    if (resp.nfcTagFormat[0]) {
        tft->setTextColor(GRAY, DARK_BG);
        tft->setTextDatum(TC_DATUM);
        tft->drawString(resp.nfcTagFormat, 120, 198, 1);
    }
}

// ── Splash / Message Screen ─────────────────────────────────

void Display::showMessage(const char* line1, const char* line2) {
    if (!_ready) return;

    tft->fillScreen(DARK_BG);

    tft->fillRoundRect(96, 60, 48, 48, 10, BRAND_ORANGE);
    tft->setTextColor(TFT_WHITE, BRAND_ORANGE);
    tft->setTextDatum(MC_DATUM);
    tft->setTextSize(1);
    tft->drawString("F", 120, 84, 4);

    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->setTextDatum(TC_DATUM);
    tft->drawString(line1, 120, 125, 4);

    if (line2) {
        tft->setTextColor(GRAY, DARK_BG);
        tft->drawString(line2, 120, 160, 2);
    }
}

// ── Pairing Code Screen ────────────────────────────────────

void Display::showPairingCode(const char* code) {
    if (!_ready) return;

    tft->fillScreen(DARK_BG);

    // Header
    tft->fillRoundRect(88, 20, 64, 64, 12, BRAND_ORANGE);
    tft->setTextColor(TFT_WHITE, BRAND_ORANGE);
    tft->setTextDatum(MC_DATUM);
    tft->drawString("F", 120, 52, 7);

    // Title
    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->setTextDatum(TC_DATUM);
    tft->drawString("Pair Device", 120, 100, 4);

    // Divider
    tft->drawFastHLine(30, 128, 180, GRAY);

    // Large pairing code — font 4 at 2x size (supports letters + digits)
    tft->setTextColor(BRAND_ORANGE, DARK_BG);
    tft->setTextDatum(MC_DATUM);
    tft->setTextSize(2);
    tft->drawString(code, 120, 170, 4);

    // Instructions
    tft->setTextColor(GRAY, DARK_BG);
    tft->setTextDatum(TC_DATUM);
    tft->drawString("Enter code on dashboard", 120, 215, 2);
    tft->drawString("fillaiq.com/hardware", 120, 240, 2);
}

// ── QR Code Screen ──────────────────────────────────────────

void Display::showQrCode(const char* data, const char* label) {
    if (!_ready) return;

    // QRCode library doesn't properly detect data overflow (@TODO in source),
    // so we must pick a version large enough for the data length.
    // Byte-mode capacities at ECC_LOW: v3=32, v4=50, v5=64, v6=84
    size_t dataLen = strlen(data);
    uint8_t minVer = 3;
    if (dataLen > 50) minVer = 6;
    else if (dataLen > 32) minVer = 5;

    QRCode qrcode;
    uint8_t qrcodeData[512];  // v6 needs ~211 bytes
    int8_t result = -1;

    for (uint8_t ver = minVer; ver <= 8; ver++) {
        result = qrcode_initText(&qrcode, qrcodeData, ver, ECC_LOW, data);
        if (result == 0) {
            Serial.printf("[Display] QR OK: v%d size=%d len=%d\n", ver, qrcode.size, dataLen);
            break;
        }
    }

    if (result != 0) {
        showMessage("QR Error", data);
        return;
    }

    tft->fillScreen(DARK_BG);

    tft->fillRoundRect(20, 12, 32, 32, 6, BRAND_ORANGE);
    tft->setTextColor(TFT_WHITE, BRAND_ORANGE);
    tft->setTextDatum(MC_DATUM);
    tft->drawString("F", 36, 28, 4);

    tft->setTextColor(TFT_WHITE, DARK_BG);
    tft->setTextDatum(ML_DATUM);
    tft->drawString("FillaIQ", 60, 28, 4);

    tft->drawFastHLine(20, 50, 200, GRAY);

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

static void clearRegion(int x, int y, int w, int h) {
    tft->fillRect(x, y, w, h, DARK_BG);
}

void Display::update(ScanState state, float weight, bool stable,
                     const char* nfcUid,
                     const ScanResponse* serverData,
                     const DistanceData* distance,
                     const ColorData* color,
                     uint8_t statusIcons) {
    if (!_ready) return;

    unsigned long now = millis();

    bool hasIdentified = serverData && serverData->identified && serverData->itemName[0];
    enum { MODE_IDLE, MODE_UNKNOWN, MODE_SPOOL } mode;
    if (state == SCAN_IDLE && !hasIdentified) mode = MODE_IDLE;
    else if (hasIdentified) mode = MODE_SPOOL;
    else mode = MODE_UNKNOWN;

    static int lastMode = -1;
    bool modeChanged = ((int)mode != lastMode);
    bool iconsChanged = (statusIcons != _lastIcons);

    if (!modeChanged && !iconsChanged && !_forceRedraw && now - _lastUpdate < 300) return;
    _lastUpdate = now;
    _lastState = state;
    _forceRedraw = false;
    _lastIcons = statusIcons;

    // Deassert NFC CS before SPI display ops (SPI mode only)
    if (NFC_CS_PIN >= 0) digitalWrite(NFC_CS_PIN, HIGH);

    if (isnan(weight) || isinf(weight)) weight = 0.0f;

    tft->setTextSize(1);

    if (modeChanged) {
        tft->fillScreen(DARK_BG);
        lastMode = (int)mode;
    }

    switch (mode) {
    case MODE_IDLE:
        if (modeChanged) {
            drawIdle(statusIcons);
        } else if (iconsChanged) {
            drawStatusIcons(statusIcons);
        }
        break;

    case MODE_SPOOL:
        if (modeChanged) {
            drawIdentified(weight, stable, *serverData, distance, statusIcons);
            if (nfcUid && nfcUid[0]) {
                tft->setTextColor(GRAY, DARK_BG);
                tft->setTextDatum(BC_DATUM);
                tft->drawString(nfcUid, 120, 275, 1);
            }
        } else {
            // Update dynamic values
            clearRegion(120, 115, 120, 28);
            char wStr[16];
            snprintf(wStr, sizeof(wStr), "%.0f g", weight);
            tft->setTextColor(TFT_WHITE, DARK_BG);
            tft->setTextDatum(TL_DATUM);
            tft->drawString(wStr, 120, 115, 4);

            if (iconsChanged) drawStatusIcons(statusIcons);
        }
        break;

    case MODE_UNKNOWN:
        if (modeChanged) {
            drawUnknown(weight, stable, distance, color, statusIcons);
            if (nfcUid && nfcUid[0]) {
                tft->setTextColor(GRAY, DARK_BG);
                tft->setTextDatum(BC_DATUM);
                tft->drawString(nfcUid, 120, 275, 1);
            }
        } else {
            // Update dynamic values
            clearRegion(100, 55, 135, 28);
            char wStr[16];
            snprintf(wStr, sizeof(wStr), "%.1f g", weight);
            tft->setTextColor(TFT_WHITE, DARK_BG);
            tft->setTextDatum(TL_DATUM);
            tft->drawString(wStr, 100, 60, 4);

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

            if (iconsChanged) drawStatusIcons(statusIcons);
        }
        break;
    }
}
