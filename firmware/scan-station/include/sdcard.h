#pragma once

#include <Arduino.h>
#include "scan_config.h"
#include "sensors.h"
#include "api_client.h"

#ifdef BOARD_SCAN_TOUCH

class SdCardDriver {
public:
    void begin();
    bool isConnected() const { return _connected; }
    const char* getChipName() const;
    uint64_t getCapacityMB() const { return _capacityMB; }
    uint64_t getUsedMB() const { return _usedMB; }

    // Log a completed scan to CSV
    void logScan(const ScanResult& scan, const ScanResponse& resp);

    // Format the card (FAT32)
    bool format();

    void printStatus();

private:
    bool _connected = false;
    uint64_t _capacityMB = 0;
    uint64_t _usedMB = 0;
    bool _ensureDir(const char* path);
};

extern SdCardDriver sdCard;

#endif // BOARD_SCAN_TOUCH
