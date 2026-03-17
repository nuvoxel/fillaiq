#include "sdcard.h"

// Include framework libs outside ifdef so PlatformIO LDF can discover them
#include <FS.h>
#include <SD_MMC.h>

#ifdef BOARD_SCAN_TOUCH

SdCardDriver sdCard;

void SdCardDriver::begin() {
    _connected = false;

    // Configure SDMMC pins (ESP32-S3 Arduino SD_MMC supports custom pins)
    SD_MMC.setPins(SD_CLK_PIN, SD_CMD_PIN, SD_D0_PIN, SD_D1_PIN, SD_D2_PIN, SD_D3_PIN);

    if (!SD_MMC.begin("/sdcard", false, false)) {
        Serial.println("  SD: mount failed");
        return;
    }

    uint8_t cardType = SD_MMC.cardType();
    if (cardType == CARD_NONE) {
        Serial.println("  SD: no card");
        SD_MMC.end();
        return;
    }

    _capacityMB = SD_MMC.totalBytes() / (1024 * 1024);
    _usedMB = SD_MMC.usedBytes() / (1024 * 1024);
    _connected = true;

    _ensureDir("/sdcard/scans");

    const char* typeStr = "Unknown";
    switch (cardType) {
        case CARD_MMC:  typeStr = "MMC";    break;
        case CARD_SD:   typeStr = "SD";     break;
        case CARD_SDHC: typeStr = "SDHC";   break;
        default: break;
    }
    Serial.printf("  SD: %s %lluMB (%lluMB used)\n", typeStr, _capacityMB, _usedMB);
}

const char* SdCardDriver::getChipName() const {
    if (!_connected) return "SD";
    uint8_t t = SD_MMC.cardType();
    switch (t) {
        case CARD_MMC:  return "MMC";
        case CARD_SD:   return "SD";
        case CARD_SDHC: return "SDHC";
        default:        return "SD";
    }
}

bool SdCardDriver::_ensureDir(const char* path) {
    if (SD_MMC.exists(path)) return true;
    return SD_MMC.mkdir(path);
}

void SdCardDriver::logScan(const ScanResult& scan, const ScanResponse& resp) {
    if (!_connected) return;

    // CSV header: timestamp,weight_g,stable,nfc_uid,height_mm,identified,item_name,material,color_hex
    const char* csvPath = "/sdcard/scans/log.csv";

    bool needsHeader = !SD_MMC.exists(csvPath);
    File f = SD_MMC.open(csvPath, FILE_APPEND);
    if (!f) return;

    if (needsHeader) {
        f.println("timestamp_ms,weight_g,stable,nfc_uid,height_mm,identified,item_name,material,color_hex");
    }

    float height = 0;
    if (scan.height.valid) height = scan.height.objectHeightMm;

    f.printf("%lu,%.1f,%d,%s,%.0f,%d,%s,%s,%s\n",
        scan.timestamp,
        scan.weight.grams,
        scan.weight.stable ? 1 : 0,
        scan.nfcPresent ? scan.nfcUid : "",
        height,
        resp.identified ? 1 : 0,
        resp.identified ? resp.itemName : "",
        resp.identified ? resp.material : "",
        resp.identified && resp.colorHex[0] ? resp.colorHex : ""
    );
    f.close();

    _usedMB = SD_MMC.usedBytes() / (1024 * 1024);
}

bool SdCardDriver::format() {
    if (!_connected) return false;

    // Remove scan logs
    SD_MMC.remove("/sdcard/scans/log.csv");
    Serial.println("SD: scan log cleared");
    _usedMB = SD_MMC.usedBytes() / (1024 * 1024);
    return true;
}

void SdCardDriver::printStatus() {
    if (_connected) {
        Serial.printf("  SD: %s %lluMB (%lluMB used)\n", getChipName(), _capacityMB, _usedMB);
    } else {
        Serial.println("  SD: not connected");
    }
}

#endif // BOARD_SCAN_TOUCH
