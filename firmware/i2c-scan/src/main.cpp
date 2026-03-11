#include <Arduino.h>
#include <Wire.h>

void setup() {
    Serial.begin(115200);
    delay(2000);
    Wire.begin();
}

void loop() {
    Serial.println("Scanning I2C (SDA=8, SCL=9)...");
    int found = 0;
    for (uint8_t addr = 1; addr < 127; addr++) {
        Wire.beginTransmission(addr);
        if (Wire.endTransmission() == 0) {
            Serial.printf("  0x%02X — ACK\n", addr);
            found++;
        }
    }
    if (found == 0) Serial.println("  No devices found.");
    Serial.println();
    delay(3000);
}
