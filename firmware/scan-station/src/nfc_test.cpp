// Minimal PN5180 NFC SPI test — nothing else running
#include <Arduino.h>
#include <SPI.h>
#include <PN5180.h>
#include <PN5180ISO14443.h>

// Pin definitions — match scan_config.h
#define NFC_SPI_SCK     14
#define NFC_SPI_MOSI     2
#define NFC_SPI_MISO     3
#define NFC_SPI_NSS     44
#define NFC_BUSY_PIN    43
#define NFC_RST_PIN     21

static SPIClass nfcSPI(HSPI);
static PN5180ISO14443 reader(NFC_SPI_NSS, NFC_BUSY_PIN, NFC_RST_PIN, &nfcSPI);

void setup() {
    Serial.begin(115200);
    delay(2000);  // Wait for USB CDC

    Serial.println("\n========================================");
    Serial.println("  PN5180 NFC SPI Test");
    Serial.println("========================================\n");

    Serial.printf("Pins: SCK=%d MOSI=%d MISO=%d NSS=%d BUSY=%d RST=%d\n",
        NFC_SPI_SCK, NFC_SPI_MOSI, NFC_SPI_MISO, NFC_SPI_NSS, NFC_BUSY_PIN, NFC_RST_PIN);

    // Read all pin states before any configuration
    Serial.println("\n--- Raw pin states (before config) ---");
    Serial.printf("  GPIO %d (SCK):  %d\n", NFC_SPI_SCK, digitalRead(NFC_SPI_SCK));
    Serial.printf("  GPIO %d (MOSI): %d\n", NFC_SPI_MOSI, digitalRead(NFC_SPI_MOSI));
    Serial.printf("  GPIO %d (MISO): %d\n", NFC_SPI_MISO, digitalRead(NFC_SPI_MISO));
    Serial.printf("  GPIO %d (NSS):  %d\n", NFC_SPI_NSS, digitalRead(NFC_SPI_NSS));
    Serial.printf("  GPIO %d (BUSY): %d\n", NFC_BUSY_PIN, digitalRead(NFC_BUSY_PIN));
    Serial.printf("  GPIO %d (RST):  %d\n", NFC_RST_PIN, digitalRead(NFC_RST_PIN));

    // Check voltage on 3.3V/5V if ADC pins available
    // Read battery ADC as proxy for power rail health
    analogReadResolution(12);
    int battRaw = analogRead(9);  // BATTERY_ADC_PIN
    Serial.printf("  Battery ADC (GPIO9): %d (%.2fV)\n", battRaw, battRaw * 3.3 / 4095.0 * 2);

    // Configure pins
    pinMode(NFC_BUSY_PIN, INPUT);
    pinMode(NFC_RST_PIN, OUTPUT);
    pinMode(NFC_SPI_NSS, OUTPUT);
    digitalWrite(NFC_SPI_NSS, HIGH);

    Serial.println("\n--- Pin states (after config, NSS HIGH) ---");
    Serial.printf("  GPIO %d (SCK):  %d\n", NFC_SPI_SCK, digitalRead(NFC_SPI_SCK));
    Serial.printf("  GPIO %d (MOSI): %d\n", NFC_SPI_MOSI, digitalRead(NFC_SPI_MOSI));
    Serial.printf("  GPIO %d (MISO): %d\n", NFC_SPI_MISO, digitalRead(NFC_SPI_MISO));
    Serial.printf("  GPIO %d (NSS):  %d\n", NFC_SPI_NSS, digitalRead(NFC_SPI_NSS));
    Serial.printf("  GPIO %d (BUSY): %d\n", NFC_BUSY_PIN, digitalRead(NFC_BUSY_PIN));
    Serial.printf("  GPIO %d (RST):  %d\n", NFC_RST_PIN, digitalRead(NFC_RST_PIN));

    // Start SPI
    nfcSPI.begin(NFC_SPI_SCK, NFC_SPI_MISO, NFC_SPI_MOSI, -1);

    Serial.println("\n--- Pin states (after SPI begin) ---");
    Serial.printf("  GPIO %d (SCK):  %d\n", NFC_SPI_SCK, digitalRead(NFC_SPI_SCK));
    Serial.printf("  GPIO %d (MOSI): %d\n", NFC_SPI_MOSI, digitalRead(NFC_SPI_MOSI));
    Serial.printf("  GPIO %d (MISO): %d\n", NFC_SPI_MISO, digitalRead(NFC_SPI_MISO));
    Serial.printf("  GPIO %d (NSS):  %d\n", NFC_SPI_NSS, digitalRead(NFC_SPI_NSS));
    Serial.printf("  GPIO %d (BUSY): %d\n", NFC_BUSY_PIN, digitalRead(NFC_BUSY_PIN));
    Serial.printf("  GPIO %d (RST):  %d\n", NFC_RST_PIN, digitalRead(NFC_RST_PIN));

    // PN5180 begin
    reader.begin();
    Serial.printf("PN5180 begin. BUSY=%d\n", digitalRead(NFC_BUSY_PIN));
    delay(100);

    // Hard reset
    Serial.println("\nHard reset...");
    digitalWrite(NFC_RST_PIN, LOW);
    delay(50);
    digitalWrite(NFC_RST_PIN, HIGH);

    // Watch BUSY transitions
    for (int i = 0; i < 30; i++) {
        delay(10);
        Serial.printf("  +%dms BUSY=%d\n", (i + 1) * 10, digitalRead(NFC_BUSY_PIN));
    }

    // Wait for BUSY LOW
    unsigned long start = millis();
    while (digitalRead(NFC_BUSY_PIN) == HIGH && millis() - start < 2000) delay(1);
    Serial.printf("BUSY settled: %s (%lums)\n\n", digitalRead(NFC_BUSY_PIN) ? "HIGH" : "LOW", millis() - start);

    // Try raw SPI — send READ_EEPROM command manually
    Serial.println("=== Raw SPI test ===");

    // Wait BUSY LOW
    if (digitalRead(NFC_BUSY_PIN) != LOW) {
        Serial.println("BUSY not LOW, can't send command");
    } else {
        // Send READ_EEPROM(FIRMWARE_VERSION) = cmd 0x07, addr 0x10, len 2
        uint8_t cmd[] = {0x07, 0x10, 0x02};

        // Try slow SPI first (1MHz instead of 7MHz)
        nfcSPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));

        // Assert NSS
        digitalWrite(NFC_SPI_NSS, LOW);
        delay(2);

        // Send command
        for (int i = 0; i < 3; i++) {
            nfcSPI.transfer(cmd[i]);
        }

        // Wait BUSY HIGH (command acknowledged)
        start = millis();
        while (digitalRead(NFC_BUSY_PIN) != HIGH && millis() - start < 500) {}
        Serial.printf("BUSY after send: %d (%lums)\n", digitalRead(NFC_BUSY_PIN), millis() - start);

        // Deassert NSS
        digitalWrite(NFC_SPI_NSS, HIGH);
        delay(1);

        // Wait BUSY LOW (command done)
        start = millis();
        while (digitalRead(NFC_BUSY_PIN) != LOW && millis() - start < 500) {}
        Serial.printf("BUSY after done: %d (%lums)\n", digitalRead(NFC_BUSY_PIN), millis() - start);

        // Read response
        digitalWrite(NFC_SPI_NSS, LOW);
        delay(2);
        uint8_t b0 = nfcSPI.transfer(0xFF);
        uint8_t b1 = nfcSPI.transfer(0xFF);

        // Wait BUSY HIGH
        start = millis();
        while (digitalRead(NFC_BUSY_PIN) != HIGH && millis() - start < 500) {}

        digitalWrite(NFC_SPI_NSS, HIGH);
        delay(1);

        // Wait BUSY LOW
        start = millis();
        while (digitalRead(NFC_BUSY_PIN) != LOW && millis() - start < 500) {}

        nfcSPI.endTransaction();

        Serial.printf("FW raw: 0x%02X 0x%02X\n", b0, b1);
        if (b0 == 0 && b1 == 0) Serial.println("  -> No response (MISO stuck low?)");
        else if (b0 == 0xFF && b1 == 0xFF) Serial.println("  -> MISO stuck high");
        else Serial.printf("  -> FW version %d.%d\n", b1, b0);
    }

    // Also try via library
    Serial.println("\n=== Library test ===");
    reader.reset();
    delay(100);

    uint8_t fwVersion[2] = {0, 0};
    reader.readEEprom(FIRMWARE_VERSION, fwVersion, 2);
    Serial.printf("Library FW: 0x%02X 0x%02X\n", fwVersion[0], fwVersion[1]);

    uint8_t prodVersion[2] = {0, 0};
    reader.readEEprom(PRODUCT_VERSION, prodVersion, 2);
    Serial.printf("Library Prod: 0x%02X 0x%02X\n", prodVersion[0], prodVersion[1]);

    if (fwVersion[0] != 0 || fwVersion[1] != 0) {
        Serial.printf("\nPN5180 detected! FW=%d.%d Prod=%d.%d\n",
            fwVersion[1], fwVersion[0], prodVersion[1], prodVersion[0]);

        // Try RF
        reader.clearIRQStatus(0xFFFFFFFF);
        reader.setRF_off();
        delay(10);

        if (reader.setupRF()) {
            Serial.println("RF ON — ready! Try scanning a tag.");
        } else {
            Serial.println("RF setup failed");
            uint32_t rfStatus = 0;
            reader.readRegister(RF_STATUS, &rfStatus);
            Serial.printf("RF_STATUS=0x%08X\n", rfStatus);
        }
    } else {
        Serial.println("\nPN5180 not detected on SPI");
    }
}

void loop() {
    // Retry raw SPI read every 2 seconds to show success rate
    static unsigned long lastRetry = 0;
    static int attempts = 0, successes = 0;
    if (millis() - lastRetry < 2000) return;
    lastRetry = millis();
    attempts++;

    // Hard reset before each attempt
    digitalWrite(NFC_RST_PIN, LOW);
    delay(10);
    digitalWrite(NFC_RST_PIN, HIGH);
    delay(50);
    // Wait BUSY LOW
    unsigned long w = millis();
    while (digitalRead(NFC_BUSY_PIN) == HIGH && millis() - w < 500) delay(1);

    // Raw SPI firmware read
    nfcSPI.beginTransaction(SPISettings(1000000, MSBFIRST, SPI_MODE0));

    // Send READ_EEPROM(FIRMWARE_VERSION)
    digitalWrite(NFC_SPI_NSS, LOW);
    delay(2);
    nfcSPI.transfer(0x07);
    nfcSPI.transfer(0x10);
    nfcSPI.transfer(0x02);

    unsigned long start = millis();
    while (digitalRead(NFC_BUSY_PIN) != HIGH && millis() - start < 200) {}
    bool busyOk = (digitalRead(NFC_BUSY_PIN) == HIGH);
    digitalWrite(NFC_SPI_NSS, HIGH);
    delay(1);

    start = millis();
    while (digitalRead(NFC_BUSY_PIN) != LOW && millis() - start < 200) {}

    // Read response
    digitalWrite(NFC_SPI_NSS, LOW);
    delay(2);
    uint8_t b0 = nfcSPI.transfer(0xFF);
    uint8_t b1 = nfcSPI.transfer(0xFF);

    start = millis();
    while (digitalRead(NFC_BUSY_PIN) != HIGH && millis() - start < 200) {}
    digitalWrite(NFC_SPI_NSS, HIGH);
    delay(1);
    start = millis();
    while (digitalRead(NFC_BUSY_PIN) != LOW && millis() - start < 200) {}

    nfcSPI.endTransaction();

    bool ok = (b0 == 0x00 && b1 == 0x04);
    if (ok) successes++;

    Serial.printf("[%d/%d] FW=0x%02X 0x%02X BUSY_ACK=%s %s\n",
        successes, attempts, b0, b1, busyOk ? "Y" : "N",
        ok ? "OK" : (b0 == 0xFF ? "MISO_HIGH" : "FAIL"));
}
