#include "printer.h"
#include "scan_config.h"
#include <BLEDevice.h>
#include <BLEUtils.h>
#include <BLEScan.h>
#include <BLEAdvertisedDevice.h>

LabelPrinter labelPrinter;

// BLE handles
static BLEClient* pClient = nullptr;
static BLERemoteCharacteristic* pWriteChar = nullptr;
static BLERemoteCharacteristic* pNotifyChar = nullptr;
static BLEAdvertisedDevice* pTargetDevice = nullptr;
static bool deviceFound = false;
static int bestRSSI = -999;

// ── BLE Scan Callback ───────────────────────────────────────────────────────

static BLEUUID printerServiceUUID(PRINTER_SERVICE_UUID);

class PrinterScanCallback : public BLEAdvertisedDeviceCallbacks {
    void onResult(BLEAdvertisedDevice advertisedDevice) override {
        String name = advertisedDevice.getName().c_str();
        // Match by name prefix OR by Phomemo BLE service UUID (0xFF00)
        bool nameMatch = name.startsWith("Mr.in") || name.startsWith("M120") ||
                         name.startsWith("Phomemo") || name.startsWith("Q244");
        bool uuidMatch = advertisedDevice.haveServiceUUID() &&
                         advertisedDevice.isAdvertisingService(printerServiceUUID);

        if (nameMatch || uuidMatch) {
            int rssi = advertisedDevice.getRSSI();
            Serial.printf("[Printer] Found: %s  %s  RSSI:%d%s\n",
                name.c_str(),
                advertisedDevice.getAddress().toString().c_str(),
                rssi,
                uuidMatch ? "  [UUID]" : "");

            // Keep the strongest signal (closest printer)
            if (rssi > bestRSSI) {
                bestRSSI = rssi;
                if (pTargetDevice) delete pTargetDevice;
                pTargetDevice = new BLEAdvertisedDevice(advertisedDevice);
                deviceFound = true;
            }
        }
    }
};

// ── BLE Client Callback ─────────────────────────────────────────────────────

class PrinterClientCallback : public BLEClientCallbacks {
    LabelPrinter* _printer;
public:
    PrinterClientCallback(LabelPrinter* p) : _printer(p) {}

    void onConnect(BLEClient* client) override {
        Serial.println("[Printer] BLE connected");
    }

    void onDisconnect(BLEClient* client) override {
        Serial.println("[Printer] BLE disconnected");
        pWriteChar = nullptr;
        pNotifyChar = nullptr;
    }
};

// ── Notify callback (static) ────────────────────────────────────────────────

static LabelPrinter* notifyPrinterRef = nullptr;

static void staticNotifyCallback(
    BLERemoteCharacteristic* pChar,
    uint8_t* data,
    size_t length,
    bool isNotify)
{
    if (notifyPrinterRef) {
        notifyPrinterRef->onNotify(data, length);
    }
}

// ── LabelPrinter Implementation ─────────────────────────────────────────────

void LabelPrinter::begin() {
    if (_initialized) return;

    // BLEDevice::init() may already be called elsewhere; safe to call again
    if (!BLEDevice::getInitialized()) {
        BLEDevice::init("FillaIQ");
    }

    notifyPrinterRef = this;
    _initialized = true;
    _state.status = PRINTER_DISCONNECTED;
    Serial.println("[Printer] BLE printer driver initialized");
}

bool LabelPrinter::scan(uint32_t timeoutMs) {
    if (!_initialized) begin();

    _state.status = PRINTER_SCANNING;
    deviceFound = false;
    bestRSSI = -999;

    if (pTargetDevice) {
        delete pTargetDevice;
        pTargetDevice = nullptr;
    }

    Serial.println("[Printer] Scanning for label printer...");
    BLEScan* pScan = BLEDevice::getScan();
    pScan->setAdvertisedDeviceCallbacks(new PrinterScanCallback(), false);
    pScan->setActiveScan(true);
    pScan->setInterval(100);
    pScan->setWindow(99);
    pScan->start(timeoutMs / 1000, false);
    pScan->clearResults();

    if (deviceFound && pTargetDevice) {
        String name = pTargetDevice->getName().c_str();
        strncpy(_state.deviceName, name.c_str(), sizeof(_state.deviceName) - 1);
        strncpy(_state.bleAddr,
                pTargetDevice->getAddress().toString().c_str(),
                sizeof(_state.bleAddr) - 1);
        _state.status = PRINTER_DISCONNECTED;
        Serial.printf("[Printer] Selected: %s  %s  RSSI:%d\n",
            _state.deviceName, _state.bleAddr, bestRSSI);
        return true;
    }

    _state.status = PRINTER_DISCONNECTED;
    Serial.println("[Printer] No printer found");
    return false;
}

bool LabelPrinter::connect() {
    if (!pTargetDevice) {
        Serial.println("[Printer] No device to connect to — scan first");
        return false;
    }

    _state.status = PRINTER_CONNECTING;
    Serial.printf("[Printer] Connecting to %s...\n", _state.deviceName);

    if (pClient) {
        if (pClient->isConnected()) pClient->disconnect();
        delete pClient;
    }

    pClient = BLEDevice::createClient();
    pClient->setClientCallbacks(new PrinterClientCallback(this));

    if (!pClient->connect(pTargetDevice)) {
        Serial.println("[Printer] Connection failed");
        _state.status = PRINTER_ERROR;
        return false;
    }

    // Discover service
    BLERemoteService* pService = pClient->getService(BLEUUID(PRINTER_SERVICE_UUID));
    if (!pService) {
        Serial.println("[Printer] Service 0xFF00 not found");
        pClient->disconnect();
        _state.status = PRINTER_ERROR;
        return false;
    }

    // Get write characteristic
    pWriteChar = pService->getCharacteristic(BLEUUID(PRINTER_WRITE_CHAR_UUID));
    if (!pWriteChar) {
        Serial.println("[Printer] Write characteristic 0xFF02 not found");
        pClient->disconnect();
        _state.status = PRINTER_ERROR;
        return false;
    }

    // Get notify characteristic
    pNotifyChar = pService->getCharacteristic(BLEUUID(PRINTER_NOTIFY_CHAR_UUID));
    if (pNotifyChar && pNotifyChar->canNotify()) {
        pNotifyChar->registerForNotify(staticNotifyCallback);
        Serial.println("[Printer] Notifications enabled on 0xFF03");
    }

    _state.status = PRINTER_READY;
    Serial.printf("[Printer] Connected to %s\n", _state.deviceName);
    return true;
}

void LabelPrinter::disconnect() {
    if (pClient && pClient->isConnected()) {
        pClient->disconnect();
    }
    pWriteChar = nullptr;
    pNotifyChar = nullptr;
    _state.status = PRINTER_DISCONNECTED;
}

bool LabelPrinter::isConnected() const {
    return pClient && pClient->isConnected() && pWriteChar;
}

bool LabelPrinter::printRaster(const uint8_t* bitmap, int widthBytes, int heightLines,
                                uint8_t speed, uint8_t density, uint8_t media) {
    if (!isConnected()) {
        Serial.println("[Printer] Not connected");
        return false;
    }

    _state.status = PRINTER_PRINTING;
    _state.printComplete = false;
    Serial.printf("[Printer] Printing %dx%d (%d bytes/line, %d lines)\n",
                  widthBytes * 8, heightLines, widthBytes, heightLines);

    // Set speed
    uint8_t cmdSpeed[] = { 0x1B, 0x4E, 0x0D, speed };
    if (!sendCommand(cmdSpeed, sizeof(cmdSpeed))) return false;

    // Set density
    uint8_t cmdDensity[] = { 0x1B, 0x4E, 0x04, density };
    if (!sendCommand(cmdDensity, sizeof(cmdDensity))) return false;

    // Set media type
    uint8_t cmdMedia[] = { 0x1F, 0x11, media };
    if (!sendCommand(cmdMedia, sizeof(cmdMedia))) return false;

    delay(50);

    // Send raster data in blocks of up to 240 lines
    int linesRemaining = heightLines;
    const uint8_t* ptr = bitmap;

    while (linesRemaining > 0) {
        int blockLines = min(linesRemaining, PRINTER_MAX_LINES_PER_BLOCK);

        // GS v 0 raster header
        uint8_t rasterHeader[] = {
            0x1D, 0x76, 0x30, 0x00,
            (uint8_t)(widthBytes & 0xFF), (uint8_t)((widthBytes >> 8) & 0xFF),
            (uint8_t)(blockLines & 0xFF), (uint8_t)((blockLines >> 8) & 0xFF),
        };
        if (!sendCommand(rasterHeader, sizeof(rasterHeader))) return false;

        // Send bitmap data, replacing 0x0A with 0x14 to avoid line feed interpretation
        int blockSize = widthBytes * blockLines;
        uint8_t* escaped = (uint8_t*)malloc(blockSize);
        if (!escaped) {
            Serial.println("[Printer] Out of memory for raster block");
            _state.status = PRINTER_ERROR;
            return false;
        }
        memcpy(escaped, ptr, blockSize);
        for (int i = 0; i < blockSize; i++) {
            if (escaped[i] == 0x0A) escaped[i] = 0x14;
        }

        if (!sendChunked(escaped, blockSize)) {
            free(escaped);
            return false;
        }
        free(escaped);

        ptr += blockSize;
        linesRemaining -= blockLines;
    }

    // End of print job
    uint8_t cmdEnd[] = { 0x1F, 0xF0, 0x05, 0x00 };
    sendCommand(cmdEnd, sizeof(cmdEnd));

    uint8_t cmdFinalize[] = { 0x1F, 0xF0, 0x03, 0x00 };
    sendCommand(cmdFinalize, sizeof(cmdFinalize));

    // Wait for print complete notification (up to 10s)
    uint32_t start = millis();
    while (!_state.printComplete && (millis() - start) < 10000) {
        delay(100);
    }

    if (_state.printComplete) {
        Serial.println("[Printer] Print complete");
        _state.status = PRINTER_READY;
        return true;
    }

    // Timeout — assume success if no error
    Serial.println("[Printer] Print sent (no completion notification)");
    _state.status = PRINTER_READY;
    return true;
}

// ── Private helpers ─────────────────────────────────────────────────────────

bool LabelPrinter::sendCommand(const uint8_t* data, size_t len) {
    if (!pWriteChar) return false;
    pWriteChar->writeValue((uint8_t*)data, len, false);  // write without response
    delay(10);
    return true;
}

bool LabelPrinter::sendChunked(const uint8_t* data, size_t len) {
    if (!pWriteChar) return false;

    size_t offset = 0;
    while (offset < len) {
        size_t chunk = min((size_t)PRINTER_BLE_CHUNK_SIZE, len - offset);
        pWriteChar->writeValue((uint8_t*)(data + offset), chunk, false);
        offset += chunk;
        if (offset < len) delay(PRINTER_CHUNK_DELAY_MS);
    }
    return true;
}

void LabelPrinter::onNotify(const uint8_t* data, size_t len) {
    if (len < 2) return;

    uint8_t b1 = data[len - 2];
    uint8_t b2 = data[len - 1];

    if (b1 == 0x0F && b2 == 0x0C) {
        _state.printComplete = true;
    } else if (b1 == 0x06 && b2 == 0x88) {
        _state.paperLoaded = false;
        Serial.println("[Printer] No paper!");
    } else if (b1 == 0x06 && b2 == 0x89) {
        _state.paperLoaded = true;
    } else if (b1 == 0x05 && b2 == 0x99) {
        _state.coverClosed = false;
        Serial.println("[Printer] Cover open!");
    } else if (b1 == 0x05 && b2 == 0x98) {
        _state.coverClosed = true;
    } else if (b1 == 0x03 && b2 == 0xA9) {
        _state.overheating = true;
        Serial.println("[Printer] Overheating!");
    } else if (b1 == 0x03 && b2 == 0xA8) {
        _state.overheating = false;
    }
}

void LabelPrinter::printStatusInfo() {
    const char* statusStr = "Unknown";
    switch (_state.status) {
        case PRINTER_DISCONNECTED: statusStr = "Disconnected"; break;
        case PRINTER_SCANNING:     statusStr = "Scanning"; break;
        case PRINTER_CONNECTING:   statusStr = "Connecting"; break;
        case PRINTER_READY:        statusStr = "Ready"; break;
        case PRINTER_PRINTING:     statusStr = "Printing"; break;
        case PRINTER_ERROR:        statusStr = "Error"; break;
    }
    Serial.printf("  Printer:   %s", statusStr);
    if (_state.deviceName[0]) {
        Serial.printf(" — %s (%s)", _state.deviceName, _state.bleAddr);
    }
    Serial.println();
    if (_state.status >= PRINTER_READY) {
        Serial.printf("             Paper: %s | Cover: %s | Temp: %s\n",
            _state.paperLoaded ? "OK" : "EMPTY",
            _state.coverClosed ? "Closed" : "OPEN",
            _state.overheating ? "HOT" : "OK");
    }
}
