#pragma once

#include <Arduino.h>
#include "scan_config.h"

#ifdef BOARD_SCAN_TOUCH

class AudioDriver {
public:
    void begin();
    bool isConnected() const { return _connected; }

    void playTone(uint16_t freqHz, uint16_t durationMs);
    void playSubmitBeep();    // Short rising beep — scan submitted
    void playSuccessBeep();   // Two-tone success — item identified
    void playErrorBeep();     // Low tone — error/attention

    void setVolume(uint8_t vol);  // 0-100

private:
    bool _connected = false;
    uint8_t _volume = 70;

    bool _es8311Init();
    void _es8311WriteReg(uint8_t reg, uint8_t val);
    uint8_t _es8311ReadReg(uint8_t reg);
    void _i2sInit();
    void _ampEnable(bool on);
    void _sendTone(uint16_t freqHz, uint16_t durationMs);
};

extern AudioDriver audio;

#endif // BOARD_SCAN_TOUCH
