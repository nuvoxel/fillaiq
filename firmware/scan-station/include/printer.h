#pragma once

#include <Arduino.h>

// ============================================================
// Filla IQ — BLE Label Printer Driver (Phomemo M120 / ESC/POS)
// Connects via BLE GATT to print raster labels.
// ============================================================

// BLE UUIDs (Phomemo family)
#define PRINTER_SERVICE_UUID        "0000ff00-0000-1000-8000-00805f9b34fb"
#define PRINTER_WRITE_CHAR_UUID     "0000ff02-0000-1000-8000-00805f9b34fb"
#define PRINTER_NOTIFY_CHAR_UUID    "0000ff03-0000-1000-8000-00805f9b34fb"

// Protocol constants
#define PRINTER_BYTES_PER_LINE      43      // 344 dots = 43 bytes
#define PRINTER_DOTS_PER_LINE       344     // 43 * 8
#define PRINTER_MAX_LINES_PER_BLOCK 240
#define PRINTER_BLE_CHUNK_SIZE      20      // Default BLE MTU payload
#define PRINTER_CHUNK_DELAY_MS      20      // Delay between BLE chunks

// Media types
#define PRINTER_MEDIA_LABEL_GAP     0x0A
#define PRINTER_MEDIA_CONTINUOUS    0x0B
#define PRINTER_MEDIA_LABEL_MARK    0x26

// Print speed (1-5)
#define PRINTER_SPEED_SLOW          0x01
#define PRINTER_SPEED_NORMAL        0x03
#define PRINTER_SPEED_FAST          0x05

// Print density (1-15)
#define PRINTER_DENSITY_LIGHT       0x05
#define PRINTER_DENSITY_NORMAL      0x0A
#define PRINTER_DENSITY_DARK        0x0F

enum PrinterStatus : uint8_t {
    PRINTER_DISCONNECTED = 0,
    PRINTER_SCANNING,
    PRINTER_CONNECTING,
    PRINTER_READY,
    PRINTER_PRINTING,
    PRINTER_ERROR,
};

struct PrinterState {
    PrinterStatus status = PRINTER_DISCONNECTED;
    char deviceName[32] = {0};
    char bleAddr[18] = {0};
    bool paperLoaded = true;
    bool coverClosed = true;
    bool overheating = false;
    bool printComplete = false;
};

class LabelPrinter {
public:
    void begin();

    // Connection
    bool scan(uint32_t timeoutMs = 5000);
    bool connect();
    void disconnect();
    bool isConnected() const;

    // Printing
    bool printRaster(const uint8_t* bitmap, int widthBytes, int heightLines,
                     uint8_t speed = PRINTER_SPEED_NORMAL,
                     uint8_t density = PRINTER_DENSITY_NORMAL,
                     uint8_t media = PRINTER_MEDIA_LABEL_GAP);

    // Status
    PrinterStatus getStatus() const { return _state.status; }
    const PrinterState& getState() const { return _state; }
    const char* getDeviceName() const { return _state.deviceName; }
    const char* getBleAddr() const { return _state.bleAddr; }

    // Serial status output
    void printStatusInfo();

    // Called by BLE notify callback
    void onNotify(const uint8_t* data, size_t len);

private:
    PrinterState _state;
    bool _initialized = false;

    bool sendCommand(const uint8_t* data, size_t len);
    bool sendChunked(const uint8_t* data, size_t len);
};

extern LabelPrinter labelPrinter;
