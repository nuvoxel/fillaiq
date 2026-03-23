#pragma once

#include <Arduino.h>
#include <mqtt_client.h>

// ============================================================
// Bambu Printer MQTT Client
// Connects to a Bambu printer's local MQTT broker (port 8883)
// to read print status, temperatures, AMS tray data, etc.
// Relayed to the Filla IQ server via the main MQTT connection.
// ============================================================

class BambuMqtt {
public:
    struct Tray {
        bool present = false;
        char type[16] = {};       // PLA, PETG, ABS, etc.
        uint32_t color = 0;       // RRGGBBAA
        uint8_t remain = 0;       // 0-100%
        int humidity = -1;        // -1 if unavailable
        float nozzleTempMin = 0;
        float nozzleTempMax = 0;
        char tagUid[32] = {};
    };

    struct PrinterStatus {
        // Print state
        char gcodeState[16] = {};  // IDLE, RUNNING, PAUSE, FINISH, FAILED
        uint8_t printPercent = 0;
        uint32_t remainingTime = 0;  // minutes
        uint16_t currentLayer = 0;
        uint16_t totalLayers = 0;
        char subtaskName[64] = {};

        // Temperatures
        float nozzleTemp = 0;
        float nozzleTarget = 0;
        float bedTemp = 0;
        float bedTarget = 0;
        float chamberTemp = 0;

        // Fans (percent 0-100)
        uint8_t partFanSpeed = 0;
        uint8_t auxFanSpeed = 0;
        uint8_t chamberFanSpeed = 0;

        // AMS
        Tray trays[16];
        uint8_t amsCount = 0;
        uint8_t trayCount = 0;

        // Metadata
        char nozzleType[16] = {};
        float nozzleDiameter = 0;
        int wifiSignal = 0;
        uint32_t printError = 0;

        bool valid = false;        // Has received at least one update
        unsigned long lastUpdateMs = 0;
    };

    void begin(const char* printerIp, const char* accessCode, const char* serialNumber, const char* machineId);
    void stop();
    bool isConnected() const { return _connected; }
    void requestPushAll();

    const PrinterStatus& getStatus() const { return _status; }
    const char* getMachineId() const { return _machineId; }

    // Serialize current status to JSON for relay
    String toJson() const;

private:
    esp_mqtt_client_handle_t _client = nullptr;
    PrinterStatus _status = {};
    char _serialNumber[32] = {};
    char _machineId[48] = {};
    bool _connected = false;

    // Large message reassembly buffer (Bambu status can be 4-8KB)
    char* _msgBuf = nullptr;
    int _msgBufLen = 0;
    int _msgBufPos = 0;

    static void eventHandler(void* args, esp_event_base_t base, int32_t id, void* data);
    void handleEvent(esp_mqtt_event_handle_t event);
    void parseReport(const char* json, int len);
};

extern BambuMqtt bambuMqtt;
