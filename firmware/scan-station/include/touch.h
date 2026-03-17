#pragma once

#include <Arduino.h>
#include "scan_config.h"

#ifdef BOARD_SCAN_TOUCH

#include <lvgl.h>

// FT6336G I2C address
#define FT6336_ADDR  0x38

class TouchDriver {
public:
    void begin();
    bool isConnected() const { return _connected; }
    void registerLvglInput();   // Register with LVGL as input device

    // Raw read (for diagnostics)
    bool read(uint16_t& x, uint16_t& y, bool& pressed);

private:
    bool _connected = false;
    lv_indev_t* _indev = nullptr;

    static void lvglReadCb(lv_indev_t* indev, lv_indev_data_t* data);
};

extern TouchDriver touchInput;

#endif // BOARD_SCAN_TOUCH
