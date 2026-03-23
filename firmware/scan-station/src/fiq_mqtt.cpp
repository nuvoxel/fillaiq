#include "fiq_mqtt.h"
#include <ArduinoJson.h>
#include "scan_config.h"
#include "tls_certs.h"

FillaiqMqtt fillaiqMqtt;

// ── Topic building ──────────────────────────────────────────────────────

const char* FillaiqMqtt::buildTopic(const char* direction, const char* channel) {
    snprintf(_topicBuf, sizeof(_topicBuf), "%s/%s/%s/%s",
             MQTT_TOPIC_PREFIX, direction, _hardwareId, channel);
    return _topicBuf;
}

// ── Publish helper ──────────────────────────────────────────────────────

int FillaiqMqtt::pub(const char* direction, const char* channel,
                     const char* data, int qos, bool retain) {
    if (!_client || !_connected) return -1;

    const char* topic = buildTopic(direction, channel);
    int msgId = esp_mqtt_client_publish(_client, topic, data,
                                        strlen(data), qos, retain ? 1 : 0);
    return msgId;
}

// ── Public publish methods ──────────────────────────────────────────────

void FillaiqMqtt::publishTelemetry(const char* json) {
    pub("d", "telemetry", json, 0, false);
}

void FillaiqMqtt::publishCapabilities(const char* json) {
    pub("d", "capabilities", json, 1, false);
}

void FillaiqMqtt::publishScan(const char* json) {
    pub("d", "scan", json, 1, false);
}

void FillaiqMqtt::publishEnv(const char* json) {
    pub("d", "env", json, 0, false);
}

void FillaiqMqtt::publishPrintStatus(const char* jobId, const char* status,
                                      const char* error) {
    JsonDocument doc;
    doc["jobId"] = jobId;
    doc["status"] = status;
    if (error && error[0]) doc["errorMessage"] = error;

    String payload;
    serializeJson(doc, payload);
    pub("d", "print/status", payload.c_str(), 1, false);
}

void FillaiqMqtt::publishCalibration(float factor) {
    JsonDocument doc;
    doc["weightCalibration"] = factor;

    String payload;
    serializeJson(doc, payload);
    pub("d", "calibration", payload.c_str(), 1, false);
}

void FillaiqMqtt::publishMachineStatus(const char* machineId, const char* json) {
    if (!_client || !_connected) return;
    char topic[128];
    snprintf(topic, sizeof(topic), "%s/d/%s/machine/%s",
             MQTT_TOPIC_PREFIX, _hardwareId, machineId);
    esp_mqtt_client_publish(_client, topic, json, strlen(json), 0, 0);
}

void FillaiqMqtt::publishOnline(bool online) {
    JsonDocument doc;
    doc["online"] = online;

    String payload;
    serializeJson(doc, payload);
    pub("d", "status", payload.c_str(), 1, true);  // retained
}

// ── Subscribe to all server-to-device topics ────────────────────────────

void FillaiqMqtt::subscribeAll() {
    char subTopic[128];
    snprintf(subTopic, sizeof(subTopic), "%s/s/%s/#",
             MQTT_TOPIC_PREFIX, _hardwareId);

    esp_mqtt_client_subscribe(_client, subTopic, 1);
    Serial.printf("[MQTT] Subscribed: %s\n", subTopic);
}

// ── Event handler ───────────────────────────────────────────────────────

void FillaiqMqtt::eventHandler(void* handlerArgs, esp_event_base_t base,
                                int32_t eventId, void* eventData) {
    auto* self = static_cast<FillaiqMqtt*>(handlerArgs);
    self->handleEvent(static_cast<esp_mqtt_event_handle_t>(eventData));
}

void FillaiqMqtt::handleEvent(esp_mqtt_event_handle_t event) {
    switch (event->event_id) {
        case MQTT_EVENT_CONNECTED:
            Serial.println("[MQTT] Connected to broker");
            _connected = true;
            subscribeAll();
            publishOnline(true);
            break;

        case MQTT_EVENT_DISCONNECTED:
            Serial.println("[MQTT] Disconnected");
            _connected = false;
            break;

        case MQTT_EVENT_DATA: {
            // Parse incoming message topic and route to callback
            if (!event->topic || !event->data) break;

            // Null-terminate topic and data (they may not be)
            char topic[128] = {0};
            int topicLen = event->topic_len < 127 ? event->topic_len : 127;
            memcpy(topic, event->topic, topicLen);

            // Parse: fiq/s/{hardwareId}/{channel...}
            // Skip prefix "fiq/s/{hwId}/" to get channel
            char prefix[64];
            snprintf(prefix, sizeof(prefix), "%s/s/%s/", MQTT_TOPIC_PREFIX, _hardwareId);
            int prefixLen = strlen(prefix);

            if (strncmp(topic, prefix, prefixLen) != 0) break;
            const char* channel = topic + prefixLen;

            // Route to callback
            if (strcmp(channel, "scan/result") == 0 && onScanResult) {
                onScanResult(event->data, event->data_len);
            } else if (strcmp(channel, "config") == 0 && onConfig) {
                onConfig(event->data, event->data_len);
            } else if (strcmp(channel, "ota") == 0 && onOta) {
                onOta(event->data, event->data_len);
            } else if (strcmp(channel, "print/job") == 0 && onPrintJob) {
                onPrintJob(event->data, event->data_len);
            } else if (strcmp(channel, "pair/status") == 0 && onPairStatus) {
                onPairStatus(event->data, event->data_len);
            } else {
                Serial.printf("[MQTT] Unhandled channel: %s\n", channel);
            }
            break;
        }

        case MQTT_EVENT_ERROR:
            Serial.println("[MQTT] Error event");
            if (event->error_handle &&
                event->error_handle->error_type == MQTT_ERROR_TYPE_TCP_TRANSPORT) {
                Serial.printf("[MQTT] Transport errno: %d\n",
                              event->error_handle->esp_transport_sock_errno);
            }
            break;

        default:
            break;
    }
}

// ── Initialization ──────────────────────────────────────────────────────

void FillaiqMqtt::begin(const char* brokerUrl, const char* deviceToken,
                         const char* hardwareId) {
    strncpy(_hardwareId, hardwareId, sizeof(_hardwareId) - 1);

    // Build last will topic and payload
    char lwTopic[128];
    snprintf(lwTopic, sizeof(lwTopic), "%s/d/%s/status",
             MQTT_TOPIC_PREFIX, _hardwareId);

    // ESP-IDF v4.x (Arduino ESP32) uses flat config struct
    esp_mqtt_client_config_t config = {};
    config.uri = brokerUrl;
    // ACA uses DigiCert Global Root G2 — same CA as our API
    config.cert_pem = FILLAIQ_ROOT_CA;
    config.username = deviceToken;
    config.keepalive = 60;
    config.lwt_topic = lwTopic;
    config.lwt_msg = "{\"online\":false}";
    config.lwt_msg_len = 17;
    config.lwt_qos = 1;
    config.lwt_retain = 1;
    config.reconnect_timeout_ms = 5000;
    config.buffer_size = 4096;
    config.out_buffer_size = 4096;

    _client = esp_mqtt_client_init(&config);
    if (!_client) {
        Serial.println("[MQTT] Failed to init client");
        return;
    }

    esp_mqtt_client_register_event(_client,
        static_cast<esp_mqtt_event_id_t>(MQTT_EVENT_ANY),
        FillaiqMqtt::eventHandler, this);

    esp_err_t err = esp_mqtt_client_start(_client);
    if (err != ESP_OK) {
        Serial.printf("[MQTT] Start failed: %s\n", esp_err_to_name(err));
    } else {
        Serial.printf("[MQTT] Connecting to %s as %s...\n", brokerUrl, _hardwareId);
    }
}

void FillaiqMqtt::stop() {
    if (_client) {
        publishOnline(false);
        esp_mqtt_client_stop(_client);
        esp_mqtt_client_destroy(_client);
        _client = nullptr;
        _connected = false;
    }
}
