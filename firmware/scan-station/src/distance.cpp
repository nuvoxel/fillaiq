#include "distance.h"
#include <Wire.h>
#include <VL53L1X.h>

DistanceSensor distanceSensor;

static VL53L1X tof;

void DistanceSensor::begin() {
    _connected = false;

    // Hold VL53L1X in reset via XSHUT while other 0x29 devices init
    pinMode(VL53L1X_XSHUT_PIN, OUTPUT);
    digitalWrite(VL53L1X_XSHUT_PIN, LOW);
    delay(10);

    // Release XSHUT — VL53L1X boots at default 0x29
    digitalWrite(VL53L1X_XSHUT_PIN, HIGH);
    delay(10);

    // Reprogram to non-conflicting address
    tof.setBus(&Wire);
    tof.setAddress(VL53L1X_DEFAULT_ADDR);

    if (tof.init()) {
        tof.setAddress(VL53L1X_ADDR);  // Move to 0x52
        tof.setDistanceMode(VL53L1X::Long);
        tof.setMeasurementTimingBudget(TOF_TIMING_BUDGET_MS * 1000);  // us
        tof.startContinuous(100);  // 100ms between readings
        _connected = true;
        Serial.printf("  TOF: VL53L1X at 0x%02X (reprogrammed from 0x%02X, XSHUT=GPIO%d)\n",
            VL53L1X_ADDR, VL53L1X_DEFAULT_ADDR, VL53L1X_XSHUT_PIN);
    } else {
        Serial.printf("  TOF: VL53L1X not detected (XSHUT=GPIO%d)\n", VL53L1X_XSHUT_PIN);
    }
}

bool DistanceSensor::read(DistanceData& data) {
    data.clear_data();
    if (!_connected) return false;

    if (tof.dataReady()) {
        float distMm = tof.read();

        if (tof.ranging_data.range_status == VL53L1X::RangeValid) {
            data.distanceMm = distMm;
            data.objectHeightMm = TOF_ARM_HEIGHT_MM - distMm;
            data.valid = true;
            return true;
        }
    }

    return false;
}

bool DistanceSensor::isConnected() { return _connected; }

void DistanceSensor::printStatus() {
    Serial.println("=== TOF Distance ===");
    Serial.printf("  Connected: %s\n", _connected ? "YES" : "no");
    if (_connected) {
        DistanceData data;
        if (read(data)) {
            Serial.printf("  Distance: %.1fmm, Object height: %.1fmm\n",
                data.distanceMm, data.objectHeightMm);
        } else {
            Serial.println("  No valid reading");
        }
    }
}
