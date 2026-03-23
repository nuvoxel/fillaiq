#pragma once

#include <Arduino.h>
#include <functional>
#include <mqtt_client.h>  // ESP-IDF esp_mqtt

// ============================================================
// Filla IQ — MQTT Client
// Persistent connection to Filla IQ MQTT broker.
// Replaces HTTP polling for all device↔server communication.
// ============================================================

// Topic prefix
#define MQTT_TOPIC_PREFIX "fiq"

// Default broker URL (overridden by NVS config)
#define DEFAULT_MQTT_URL "mqtts://mqtt.fillaiq.com:8883"

class FillaiqMqtt {
public:
    void begin(const char* brokerUrl, const char* deviceToken, const char* hardwareId);
    void stop();
    bool isConnected() const { return _connected; }

    // ── Publish methods (non-blocking, esp_mqtt queues internally) ──

    // Periodic heartbeat: version, uptime, heap, RSSI
    void publishTelemetry(const char* json);

    // Sensor capabilities (on connect + change)
    void publishCapabilities(const char* json);

    // Scan sensor data (includes correlationId for matching response)
    void publishScan(const char* json);

    // Environmental reading
    void publishEnv(const char* json);

    // Print job status update
    void publishPrintStatus(const char* jobId, const char* status, const char* error = nullptr);

    // Weight calibration factor sync
    void publishCalibration(float factor);

    // Online status (also set as last will)
    void publishOnline(bool online);

    // Relay 3D printer status (from local Bambu MQTT)
    void publishMachineStatus(const char* machineId, const char* json);

    // ── Incoming message callbacks ──
    // Set these before calling begin(). They fire on the esp_mqtt task context.
    // Handlers should copy data and signal the main loop (e.g., via queue or flag).

    std::function<void(const char* json, int len)> onScanResult;
    std::function<void(const char* json, int len)> onConfig;
    std::function<void(const char* json, int len)> onOta;
    std::function<void(const char* json, int len)> onPrintJob;
    std::function<void(const char* json, int len)> onPairStatus;

    // Access hardware ID for topic building
    const char* getHardwareId() const { return _hardwareId; }

private:
    esp_mqtt_client_handle_t _client = nullptr;
    char _hardwareId[32] = {0};
    char _topicBuf[128] = {0};
    bool _connected = false;

    // Build a topic string: fiq/{direction}/{hardwareId}/{channel}
    const char* buildTopic(const char* direction, const char* channel);

    // Publish helper
    int pub(const char* direction, const char* channel, const char* data,
            int qos = 0, bool retain = false);

    // Subscribe to all server-to-device topics
    void subscribeAll();

    // ESP-IDF MQTT event handler (static → routes to instance)
    static void eventHandler(void* handlerArgs, esp_event_base_t base,
                             int32_t eventId, void* eventData);
    void handleEvent(esp_mqtt_event_handle_t event);
};

extern FillaiqMqtt fillaiqMqtt;
