#include "display.h"
#include "hx711_multi.h"
#include <SPI.h>

// ==================== Hardware ====================

static U8G2_SSD1322_NHD_256X64_F_4W_HW_SPI u8g2(U8G2_R0, OLED_CS_PIN, OLED_DC_PIN, OLED_RST_PIN);

static SlotDisplay displays[HX711_NUM_CHANNELS];
static uint8_t numDisplays = 0;
static bool needsRedraw = true;

// ==================== Layout Constants ====================

// Each bay gets half the screen width
#define BAY_WIDTH       128
#define BAY_0_X         0
#define BAY_1_X         128

// Vertical positions within each bay
#define ROW_NAME_Y      10     // Name/brand line baseline
#define ROW_BAR_Y       20     // Fill bar top
#define ROW_BAR_H       12     // Fill bar height
#define ROW_BAR_W       90     // Fill bar width
#define ROW_BAR_X       4      // Fill bar left offset within bay
#define ROW_PCT_X       98     // Percentage text X offset within bay
#define ROW_PCT_Y       30     // Percentage text baseline
#define ROW_WEIGHT_Y    55     // Weight line baseline
#define ROW_STABLE_Y    55     // Stability indicator baseline

// ==================== Rendering ====================

void SlotDisplay::draw(int16_t xOff) {
    if (_calMode) {
        // --- Calibration Screen ---
        u8g2.setFont(u8g2_font_helvB10_tr);
        u8g2.drawStr(xOff + 4, 12, _calTitle.c_str());

        u8g2.setFont(u8g2_font_helvR08_tr);
        char chBuf[8];
        snprintf(chBuf, sizeof(chBuf), "CH%d", _channel);
        int chW = u8g2.getStrWidth(chBuf);
        u8g2.drawStr(xOff + BAY_WIDTH - chW - 4, 12, chBuf);

        u8g2.setFont(u8g2_font_helvR10_tr);
        u8g2.drawStr(xOff + 4, 36, _calLine1.c_str());

        u8g2.setFont(u8g2_font_helvR08_tr);
        u8g2.drawStr(xOff + 4, 52, _calLine2.c_str());
        return;
    }

    if (_currentScreen == SCR_EMPTY) {
        // --- Empty Screen ---
        u8g2.setFont(u8g2_font_helvR12_tr);
        char buf[20];
        snprintf(buf, sizeof(buf), "[%d] Place spool", _channel + 1);
        int w = u8g2.getStrWidth(buf);
        u8g2.drawStr(xOff + (BAY_WIDTH - w) / 2, 38, buf);
        return;
    }

    // --- Spool Screen ---
    // Row 1: Brand + Name
    u8g2.setFont(u8g2_font_helvR08_tr);
    if (_spool.brand.length() > 0) {
        u8g2.drawStr(xOff + 2, ROW_NAME_Y, _spool.brand.c_str());
    }

    if (_spool.name.length() > 0) {
        int nameW = u8g2.getStrWidth(_spool.name.c_str());
        u8g2.drawStr(xOff + BAY_WIDTH - nameW - 2, ROW_NAME_Y, _spool.name.c_str());
    }

    // Row 2: Fill bar + percentage
    float percent = 0;
    if (_spool.fullWeight > 0) {
        percent = (_lastWeight / _spool.fullWeight) * 100.0f;
        if (percent < 0) percent = 0;
        if (percent > 100) percent = 100;
    }

    int barX = xOff + ROW_BAR_X;
    u8g2.drawFrame(barX, ROW_BAR_Y, ROW_BAR_W, ROW_BAR_H);
    int fillW = (int)((percent / 100.0f) * (ROW_BAR_W - 2));
    if (fillW > 0) {
        u8g2.drawBox(barX + 1, ROW_BAR_Y + 1, fillW, ROW_BAR_H - 2);
    }

    char pctBuf[8];
    snprintf(pctBuf, sizeof(pctBuf), "%d%%", (int)percent);
    u8g2.drawStr(xOff + ROW_PCT_X, ROW_PCT_Y, pctBuf);

    // Row 3: Weight (large) + material + stability
    u8g2.setFont(u8g2_font_helvB14_tr);
    char wBuf[16];
    if (_lastWeight < 10000) {
        snprintf(wBuf, sizeof(wBuf), "%.1fg", _lastWeight);
    } else {
        snprintf(wBuf, sizeof(wBuf), "%.0fg", _lastWeight);
    }
    u8g2.drawStr(xOff + 4, ROW_WEIGHT_Y, wBuf);

    // Material label on far right
    u8g2.setFont(u8g2_font_helvR08_tr);
    if (_spool.material.length() > 0) {
        int matW = u8g2.getStrWidth(_spool.material.c_str());
        u8g2.drawStr(xOff + BAY_WIDTH - matW - 2, ROW_STABLE_Y, _spool.material.c_str());
    }
}

void renderDisplay() {
    if (!needsRedraw) return;
    needsRedraw = false;

    u8g2.clearBuffer();

    // Draw vertical separator
    u8g2.drawVLine(BAY_WIDTH, 0, OLED_HEIGHT);

    // Draw each bay
    for (uint8_t i = 0; i < numDisplays; i++) {
        displays[i].draw((i == 0) ? BAY_0_X : BAY_1_X);
    }

    u8g2.sendBuffer();
}

// ==================== SlotDisplay Implementation ====================

void SlotDisplay::begin(uint8_t channel) {
    _channel = channel;
    _calMode = false;
    _lastPresent = false;
    _lastWeight = 0;
    _lastPercent = 0;
    _currentScreen = SCR_EMPTY;
    needsRedraw = true;
}

void SlotDisplay::setSpoolInfo(const SpoolInfo& info) {
    _spool = info;
    needsRedraw = true;

    Serial.printf("Display bay %d: setSpoolInfo brand='%s' name='%s' mat='%s'\n",
        _channel, _spool.brand.c_str(), _spool.name.c_str(), _spool.material.c_str());
}

void SlotDisplay::update(float weight, float stableWeight, bool isStable, bool spoolPresent) {
    if (_calMode) return;

    // Screen transitions
    Screen newScreen = spoolPresent ? SCR_SPOOL : SCR_EMPTY;
    if (newScreen != _currentScreen) {
        _currentScreen = newScreen;
        _lastPresent = spoolPresent;
        needsRedraw = true;
    }

    if (!spoolPresent) return;

    // Update stored values and flag redraw if changed
    int newPercent = 0;
    if (_spool.fullWeight > 0) {
        newPercent = (int)((stableWeight / _spool.fullWeight) * 100.0f);
    }

    // Only redraw if weight changed visually (0.1g precision)
    int newWeightTenths = (int)(stableWeight * 10);
    int oldWeightTenths = (int)(_lastWeight * 10);
    if (newWeightTenths != oldWeightTenths || newPercent != _lastPercent) {
        _lastWeight = stableWeight;
        _lastPercent = newPercent;
        needsRedraw = true;
    }
}

// ==================== Calibration Mode ====================

void SlotDisplay::showCalWaitEmpty() {
    _calMode = true;
    _calTitle = "CALIBRATE";
    _calLine1 = "Remove weight";
    _calLine2 = "Send 'ready'";
    needsRedraw = true;
}

void SlotDisplay::showCalWaitWeight() {
    _calLine1 = "Place known weight";
    _calLine2 = "Enter grams";
    needsRedraw = true;
}

void SlotDisplay::showCalResult(float factor, float verify, float expected) {
    _calTitle = "DONE";
    char buf[32];
    snprintf(buf, sizeof(buf), "%.1fg", verify);
    _calLine1 = buf;
    snprintf(buf, sizeof(buf), "exp %.1fg F:%.4f", expected, factor);
    _calLine2 = buf;
    needsRedraw = true;
}

void SlotDisplay::showCalDone() {
    _calTitle = "SAVED";
    _calLine1 = "Calibration saved";
    _calLine2 = "";
    needsRedraw = true;
}

void SlotDisplay::exitCalMode() {
    _calMode = false;
    _currentScreen = SCR_EMPTY;
    _lastPresent = false;
    needsRedraw = true;
}

// ==================== Global Interface ====================

void initDisplays() {
    // Configure FSPI pins before U8g2 init
    SPI.begin(/*sck=*/12, /*miso=*/13, /*mosi=*/11);

    u8g2.begin();
    u8g2.setContrast(255);

    numDisplays = HX711_NUM_CHANNELS;
    for (uint8_t i = 0; i < numDisplays; i++) {
        displays[i].begin(i);
        Serial.printf("Display bay %d: OK\n", i);
    }

    // Initial render
    needsRedraw = true;
    renderDisplay();
}

void updateDisplays() {
    for (uint8_t i = 0; i < numDisplays; i++) {
        if (!scales.isConnected(i)) continue;

        float w = scales.getWeight(i);
        float ws = scales.getStableWeight(i);
        bool stable = scales.isStable(i);
        bool present = ws > SPOOL_PRESENT_THRESHOLD;

        displays[i].update(w, ws, stable, present);
    }

    renderDisplay();
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
