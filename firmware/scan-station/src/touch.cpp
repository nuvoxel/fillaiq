#include "touch.h"

#include <Wire.h>

TouchDriver touchInput;

// FT6336G registers
#define FT_REG_NUM_TOUCHES  0x02
#define FT_REG_P1_XH        0x03
#define FT_REG_P1_XL        0x04
#define FT_REG_P1_YH        0x05
#define FT_REG_P1_YL        0x06

void TouchDriver::begin() {
    _connected = false;

    // Reset the touch controller
    pinMode(TOUCH_RST, OUTPUT);
    digitalWrite(TOUCH_RST, LOW);
    delay(10);
    digitalWrite(TOUCH_RST, HIGH);
    delay(300);

    // INT pin as input — FT6336G pulls LOW when touch is active
    pinMode(TOUCH_INT, INPUT);

    // Probe I2C
    Wire.beginTransmission(FT6336_ADDR);
    if (Wire.endTransmission() == 0) {
        _connected = true;
        Serial.println("  Touch: FT6336G at 0x38");
    } else {
        Serial.println("  Touch: not detected");
    }
}

bool TouchDriver::read(uint16_t& x, uint16_t& y, bool& pressed) {
    if (!_connected) { pressed = false; return false; }

    Wire.beginTransmission(FT6336_ADDR);
    Wire.write(FT_REG_NUM_TOUCHES);
    if (Wire.endTransmission() != 0) { pressed = false; return false; }

    Wire.requestFrom((uint8_t)FT6336_ADDR, (uint8_t)5);
    if (Wire.available() < 5) { pressed = false; return false; }

    uint8_t touches = Wire.read() & 0x0F;
    uint8_t xh = Wire.read();
    uint8_t xl = Wire.read();
    uint8_t yh = Wire.read();
    uint8_t yl = Wire.read();

    pressed = (touches > 0);
    if (pressed) {
        // FT6336G reports in native 240x320 portrait orientation
        uint16_t rawX = ((xh & 0x0F) << 8) | xl;
        uint16_t rawY = ((yh & 0x0F) << 8) | yl;

        // Map to 320x240 landscape (matching our MADCTL rotation)
        // Portrait (rawX 0-239, rawY 0-319) → Landscape (x 0-319, y 0-239)
        x = rawY;
        y = 239 - rawX;
    }

    return pressed;
}

// I2C bus mutex — shared with sensor/weight/NFC tasks
extern SemaphoreHandle_t i2cMutex;

// Cached touch state — returned on I2C mutex timeout to avoid phantom releases
static lv_indev_data_t cachedTouchData = { .state = LV_INDEV_STATE_RELEASED };

void TouchDriver::lvglReadCb(lv_indev_t* indev, lv_indev_data_t* data) {
    (void)indev;

    // Touch shares I2C bus — try-acquire mutex, return cached state if busy.
    if (i2cMutex && xSemaphoreTake(i2cMutex, pdMS_TO_TICKS(15)) == pdTRUE) {
        uint16_t x, y;
        bool pressed;
        if (touchInput.read(x, y, pressed) && pressed) {
            data->point.x = x;
            data->point.y = y;
            data->state = LV_INDEV_STATE_PRESSED;
        } else {
            data->state = LV_INDEV_STATE_RELEASED;
        }
        xSemaphoreGive(i2cMutex);
        cachedTouchData = *data;
    } else {
        // Mutex busy — return last known state (prevents phantom releases)
        *data = cachedTouchData;
    }
}

void TouchDriver::registerLvglInput() {
    if (!_connected) return;

    _indev = lv_indev_create();
    lv_indev_set_type(_indev, LV_INDEV_TYPE_POINTER);
    lv_indev_set_read_cb(_indev, lvglReadCb);
    Serial.println("  LVGL touch input registered");
}
