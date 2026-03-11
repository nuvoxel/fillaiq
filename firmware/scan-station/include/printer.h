#pragma once

#include <Arduino.h>

// ============================================================
// Filla IQ — Label Printer Driver (BLE + USB Host)
// Connects to Phomemo printers via BLE GATT or USB Host.
// Same ESC/POS protocol over either transport.
// ============================================================

// BLE UUIDs (Phomemo family)
#define PRINTER_SERVICE_UUID        "0000ff00-0000-1000-8000-00805f9b34fb"
#define PRINTER_WRITE_CHAR_UUID     "0000ff02-0000-1000-8000-00805f9b34fb"
#define PRINTER_NOTIFY_CHAR_UUID    "0000ff03-0000-1000-8000-00805f9b34fb"

// Protocol constants
#define PRINTER_BYTES_PER_LINE      43      // 344 dots = 43 bytes
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

enum PrinterTransport : uint8_t {
    TRANSPORT_NONE = 0,
    TRANSPORT_BLE,
    TRANSPORT_USB,
};

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
    PrinterTransport transport = TRANSPORT_NONE;
    char deviceName[32] = {0};
    char bleAddr[18] = {0};
    bool paperLoaded = true;
    bool coverClosed = true;
    bool overheating = false;
    bool printComplete = false;
    // Queried info (BLE)
    uint8_t batteryPercent = 0;
    char firmwareVersion[16] = {0};
    uint32_t serialNumber = 0;
    bool infoQueried = false;
    // USB descriptor info
    char usbManufacturer[64] = {0};
    char usbProduct[64] = {0};
    char usbSerial[64] = {0};
    uint16_t usbVid = 0;
    uint16_t usbPid = 0;
};

class LabelPrinter {
public:
    void begin();

    // Connection — BLE
    bool scan(uint32_t timeoutMs = 5000);
    bool connect();          // Connect via BLE (after scan)

    // Connection — USB
    bool connectUsb();       // Connect via USB Host (if device present)

    void disconnect();
    bool isConnected() const;

    // Printing (works over either transport)
    bool printRaster(const uint8_t* bitmap, int widthBytes, int heightLines,
                     uint8_t speed = PRINTER_SPEED_NORMAL,
                     uint8_t density = PRINTER_DENSITY_NORMAL,
                     uint8_t media = PRINTER_MEDIA_LABEL_GAP);

    // Query printer info (battery, firmware, serial, paper/cover state) — BLE only
    void queryInfo();

    // Status
    PrinterStatus getStatus() const { return _state.status; }
    PrinterTransport getTransport() const { return _state.transport; }
    const PrinterState& getState() const { return _state; }
    const char* getDeviceName() const { return _state.deviceName; }
    const char* getBleAddr() const { return _state.bleAddr; }
    uint8_t getBattery() const { return _state.batteryPercent; }
    const char* getPrinterFirmware() const { return _state.firmwareVersion; }
    uint32_t getSerialNumber() const { return _state.serialNumber; }

    // Serial status output
    void printStatusInfo();

    // Called by BLE notify callback
    void onNotify(const uint8_t* data, size_t len);

private:
    PrinterState _state;
    bool _initialized = false;

    // Pending query response tracking (BLE)
    volatile uint8_t _pendingQuery = 0;
    volatile bool _queryResponse = false;

    bool sendCommand(const uint8_t* data, size_t len);
    bool sendChunked(const uint8_t* data, size_t len);
    bool sendQuery(uint8_t queryId, uint32_t timeoutMs = 500);
};

extern LabelPrinter labelPrinter;
