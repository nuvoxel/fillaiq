#include "distance.h"
#include <Wire.h>
#include <VL53L1X.h>

DistanceSensor distanceSensor;

static VL53L1X tof;

void DistanceSensor::begin() {
    _connected = false;

    tof.setBus(&Wire);
    tof.setTimeout(500);
    tof.setAddress(VL53L1X_DEFAULT_ADDR);

    delay(50);  // Give sensor time to boot

    if (tof.init()) {
        tof.setDistanceMode(VL53L1X::Long);
        tof.setMeasurementTimingBudget(TOF_TIMING_BUDGET_MS * 1000);  // us
        tof.startContinuous(100);  // 100ms between readings
        _connected = true;
        Serial.printf("  TOF: VL53L1X at 0x%02X\n", VL53L1X_DEFAULT_ADDR);
    } else {
        // Debug: read model ID register to see what's at 0x29
        Wire.beginTransmission(VL53L1X_DEFAULT_ADDR);
        Wire.write(0x01);  // Model ID MSB register (0x010F)
        Wire.write(0x0F);
        Wire.endTransmission(false);
        Wire.requestFrom((uint8_t)VL53L1X_DEFAULT_ADDR, (uint8_t)1);
        if (Wire.available()) {
            uint8_t id = Wire.read();
            Serial.printf("  TOF: init failed, device at 0x29 ID=0x%02X\n", id);
        } else {
            Serial.println("  TOF: VL53L1X not detected (no response at 0x29)");
        }
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
