#include "audio.h"
#include <Wire.h>
#include <driver/i2s.h>
#include <math.h>

#ifdef BOARD_SCAN_TOUCH

AudioDriver audio;

// ES8311 register map (from vendor SDK)
#define REG00_RESET      0x00
#define REG01_CLK_MGR1   0x01
#define REG02_CLK_MGR2   0x02
#define REG03_CLK_MGR3   0x03
#define REG04_CLK_MGR4   0x04
#define REG05_CLK_MGR5   0x05
#define REG06_CLK_MGR6   0x06
#define REG07_CLK_MGR7   0x07
#define REG08_CLK_MGR8   0x08
#define REG09_SDP_IN     0x09
#define REG0A_SDP_OUT    0x0A
#define REG0B_SYSTEM     0x0B
#define REG0C_SYSTEM     0x0C
#define REG0D_SYSTEM     0x0D
#define REG0E_SYSTEM     0x0E
#define REG10_SYSTEM     0x10
#define REG11_SYSTEM     0x11
#define REG12_SYSTEM     0x12
#define REG13_SYSTEM     0x13
#define REG14_SYSTEM     0x14
#define REG15_ADC        0x15
#define REG16_ADC        0x16
#define REG17_ADC        0x17
#define REG1C_ADC        0x1C
#define REG31_DAC        0x31
#define REG32_DAC        0x32
#define REG37_DAC        0x37
#define REG44_GPIO       0x44
#define REG45_GP         0x45
#define REGFD_CHIP_ID1   0xFD
#define REGFE_CHIP_ID2   0xFE

// I2S config
#define SAMPLE_RATE     16000
#define I2S_PORT        I2S_NUM_0

void AudioDriver::_es8311WriteReg(uint8_t reg, uint8_t val) {
    Wire.beginTransmission(ES8311_ADDR);
    Wire.write(reg);
    Wire.write(val);
    Wire.endTransmission();
}

uint8_t AudioDriver::_es8311ReadReg(uint8_t reg) {
    Wire.beginTransmission(ES8311_ADDR);
    Wire.write(reg);
    Wire.endTransmission(false);
    Wire.requestFrom((uint8_t)ES8311_ADDR, (uint8_t)1);
    return Wire.available() ? Wire.read() : 0;
}

bool AudioDriver::_es8311Init() {
    // Check if ES8311 is present
    Wire.beginTransmission(ES8311_ADDR);
    if (Wire.endTransmission() != 0) return false;

    // Verify chip ID
    uint8_t id1 = _es8311ReadReg(REGFD_CHIP_ID1);
    uint8_t id2 = _es8311ReadReg(REGFE_CHIP_ID2);
    Serial.printf("  Audio: ES8311 ID=0x%02X%02X\n", id1, id2);

    // ── Full init sequence from vendor SDK (es8311_codec_init) ──

    // 1. Clock setup
    _es8311WriteReg(REG01_CLK_MGR1, 0x3F);  // Enable all clocks
    _es8311WriteReg(REG02_CLK_MGR2, 0x00);
    _es8311WriteReg(REG03_CLK_MGR3, 0x10);  // ADC FSMode & OSR
    _es8311WriteReg(REG16_ADC,      0x24);  // ADC gain
    _es8311WriteReg(REG04_CLK_MGR4, 0x10);  // DAC OSR
    _es8311WriteReg(REG05_CLK_MGR5, 0x00);  // ADC/DAC divider

    // 2. System registers
    _es8311WriteReg(REG0B_SYSTEM, 0x00);
    _es8311WriteReg(REG0C_SYSTEM, 0x00);
    _es8311WriteReg(REG10_SYSTEM, 0x1F);
    _es8311WriteReg(REG11_SYSTEM, 0x7F);

    // 3. Reset and power on
    _es8311WriteReg(REG00_RESET, 0x80);     // Power-on
    delay(10);

    // 4. Re-apply clock source
    _es8311WriteReg(REG01_CLK_MGR1, 0x3F);

    // 5. Power up analog
    _es8311WriteReg(REG0D_SYSTEM, 0x01);    // Power up analog circuitry
    _es8311WriteReg(REG0E_SYSTEM, 0x02);    // Enable PGA & ADC modulator
    _es8311WriteReg(REG12_SYSTEM, 0x00);    // Power up DAC
    _es8311WriteReg(REG13_SYSTEM, 0x10);    // Enable output to HP drive

    // 6. ADC/DAC settings
    _es8311WriteReg(REG1C_ADC, 0x6A);       // ADC EQ bypass, DC offset cancel
    _es8311WriteReg(REG37_DAC, 0x08);       // DAC EQ bypass

    // 7. I2S format: 16-bit, I2S standard (slave mode — ESP32 is master)
    _es8311WriteReg(REG09_SDP_IN, 0x00);    // 16-bit I2S input
    _es8311WriteReg(REG0A_SDP_OUT, 0x00);   // 16-bit I2S output

    // 8. Playback mode config
    _es8311WriteReg(REG17_ADC, 0xBF);       // ADC volume
    _es8311WriteReg(REG14_SYSTEM, 0x1A);    // Analog MIC, PGA gain
    _es8311WriteReg(REG15_ADC, 0x40);       // ADC ramp rate
    _es8311WriteReg(REG37_DAC, 0x48);       // DAC ramp rate
    _es8311WriteReg(REG45_GP, 0x00);        // GP control

    // 9. DAC volume (0-255, higher = louder)
    // Formula: reg = ((volume_pct) * 256 / 100) - 1
    _es8311WriteReg(REG32_DAC, 0xD8);       // ~85% volume

    return true;
}

void AudioDriver::_i2sInit() {
    i2s_config_t i2s_config = {
        .mode = (i2s_mode_t)(I2S_MODE_MASTER | I2S_MODE_TX),
        .sample_rate = SAMPLE_RATE,
        .bits_per_sample = I2S_BITS_PER_SAMPLE_16BIT,
        .channel_format = I2S_CHANNEL_FMT_RIGHT_LEFT,
        .communication_format = I2S_COMM_FORMAT_STAND_I2S,
        .intr_alloc_flags = ESP_INTR_FLAG_LEVEL1,
        .dma_buf_count = 4,
        .dma_buf_len = 256,
        .use_apll = false,
        .tx_desc_auto_clear = true,
    };

    i2s_pin_config_t pin_config = {
        .mck_io_num = I2S_MCK_PIN,
        .bck_io_num = I2S_BCK_PIN,
        .ws_io_num = I2S_WS_PIN,
        .data_out_num = I2S_DOUT_PIN,
        .data_in_num = I2S_PIN_NO_CHANGE,
    };

    i2s_driver_install(I2S_PORT, &i2s_config, 0, NULL);
    i2s_set_pin(I2S_PORT, &pin_config);
    i2s_zero_dma_buffer(I2S_PORT);
}

void AudioDriver::_ampEnable(bool on) {
    // AMP_EN is active LOW on this board
    digitalWrite(AMP_EN_PIN, on ? LOW : HIGH);
}

void AudioDriver::begin() {
    _connected = false;

    // Amp enable pin — start disabled (HIGH = off)
    pinMode(AMP_EN_PIN, OUTPUT);
    _ampEnable(false);

    // Init ES8311 over I2C
    if (!_es8311Init()) {
        Serial.println("  Audio: ES8311 not found");
        return;
    }

    // Init I2S
    _i2sInit();

    _connected = true;
    Serial.println("  Audio: ES8311 ready");
}

void AudioDriver::_sendTone(uint16_t freqHz, uint16_t durationMs) {
    if (!_connected) return;

    uint32_t numSamples = (SAMPLE_RATE * durationMs) / 1000;
    float phase = 0;
    float phaseInc = 2.0f * M_PI * freqHz / SAMPLE_RATE;

    // Volume scaling (0-100 → 0.0-1.0)
    float vol = _volume / 100.0f;

    // Generate and send in chunks
    const int chunkSize = 128;
    int16_t buf[chunkSize * 2];  // stereo

    uint32_t sent = 0;
    while (sent < numSamples) {
        int count = min((uint32_t)chunkSize, numSamples - sent);
        for (int i = 0; i < count; i++) {
            int16_t sample = (int16_t)(sinf(phase) * 16000.0f * vol);
            buf[i * 2] = sample;      // Left
            buf[i * 2 + 1] = sample;  // Right
            phase += phaseInc;
            if (phase >= 2.0f * M_PI) phase -= 2.0f * M_PI;
        }
        size_t written;
        i2s_write(I2S_PORT, buf, count * 4, &written, portMAX_DELAY);
        sent += count;
    }
}

void AudioDriver::playTone(uint16_t freqHz, uint16_t durationMs) {
    _ampEnable(true);
    delay(5);
    _sendTone(freqHz, durationMs);
    i2s_zero_dma_buffer(I2S_PORT);
    delay(10);
    _ampEnable(false);
}

void AudioDriver::playSubmitBeep() {
    _ampEnable(true);
    delay(5);
    _sendTone(800, 60);
    _sendTone(1200, 80);
    i2s_zero_dma_buffer(I2S_PORT);
    delay(10);
    _ampEnable(false);
}

void AudioDriver::playSuccessBeep() {
    _ampEnable(true);
    delay(5);
    _sendTone(800, 50);
    _sendTone(1000, 50);
    _sendTone(1400, 80);
    i2s_zero_dma_buffer(I2S_PORT);
    delay(10);
    _ampEnable(false);
}

void AudioDriver::playErrorBeep() {
    _ampEnable(true);
    delay(5);
    _sendTone(400, 150);
    _sendTone(300, 150);
    i2s_zero_dma_buffer(I2S_PORT);
    delay(10);
    _ampEnable(false);
}

void AudioDriver::setVolume(uint8_t vol) {
    _volume = vol > 100 ? 100 : vol;
    if (_connected) {
        // Map 0-100 to ES8311 DAC volume register (higher = louder)
        uint8_t regVal = (_volume * 256 / 100);
        if (regVal > 0) regVal--;
        _es8311WriteReg(REG32_DAC, regVal);
    }
}

#endif // BOARD_SCAN_TOUCH
