#include "bambu_mqtt.h"
#include <ArduinoJson.h>

BambuMqtt bambuMqtt;

#define BAMBU_MSG_BUF_SIZE 8192  // Bambu status messages can be large

// ── Event handler ───────────────────────────────────────────────────────

void BambuMqtt::eventHandler(void* args, esp_event_base_t base, int32_t id, void* data) {
    auto* self = static_cast<BambuMqtt*>(args);
    self->handleEvent(static_cast<esp_mqtt_event_handle_t>(data));
}

void BambuMqtt::handleEvent(esp_mqtt_event_handle_t event) {
    switch (event->event_id) {
        case MQTT_EVENT_CONNECTED:
            Serial.println("[Bambu] Connected to printer MQTT");
            _connected = true;
            // Subscribe to all report topics
            {
                char topic[64];
                snprintf(topic, sizeof(topic), "device/%s/report", _serialNumber);
                esp_mqtt_client_subscribe(_client, topic, 0);
                Serial.printf("[Bambu] Subscribed: %s\n", topic);
            }
            // Request full status dump
            requestPushAll();
            break;

        case MQTT_EVENT_DISCONNECTED:
            Serial.println("[Bambu] Disconnected from printer");
            _connected = false;
            break;

        case MQTT_EVENT_DATA: {
            // Bambu messages can be fragmented across multiple DATA events.
            // total_data_len > data_len means this is a chunked message.
            if (event->total_data_len > event->data_len) {
                // First chunk — allocate buffer
                if (event->current_data_offset == 0) {
                    if (_msgBuf) free(_msgBuf);
                    _msgBufLen = event->total_data_len;
                    _msgBuf = (char*)ps_malloc(_msgBufLen + 1);
                    _msgBufPos = 0;
                    if (!_msgBuf) {
                        Serial.println("[Bambu] OOM for message buffer");
                        break;
                    }
                }
                // Copy chunk
                if (_msgBuf && _msgBufPos + event->data_len <= _msgBufLen) {
                    memcpy(_msgBuf + _msgBufPos, event->data, event->data_len);
                    _msgBufPos += event->data_len;
                }
                // Last chunk — parse complete message
                if (_msgBuf && _msgBufPos >= _msgBufLen) {
                    _msgBuf[_msgBufLen] = '\0';
                    parseReport(_msgBuf, _msgBufLen);
                    free(_msgBuf);
                    _msgBuf = nullptr;
                }
            } else if (event->data && event->data_len > 0) {
                // Single message, no fragmentation
                parseReport(event->data, event->data_len);
            }
            break;
        }

        case MQTT_EVENT_ERROR:
            Serial.println("[Bambu] MQTT error");
            if (event->error_handle &&
                event->error_handle->error_type == MQTT_ERROR_TYPE_TCP_TRANSPORT) {
                Serial.printf("[Bambu] Transport errno: %d\n",
                              event->error_handle->esp_transport_sock_errno);
            }
            break;

        default:
            break;
    }
}

// ── Parse Bambu report JSON ─────────────────────────────────────────────

void BambuMqtt::parseReport(const char* json, int len) {
    // Use PSRAM for the JSON document since Bambu messages are large
    JsonDocument doc;
    DeserializationError err = deserializeJson(doc, json, len);
    if (err) {
        Serial.printf("[Bambu] JSON parse error: %s\n", err.c_str());
        return;
    }

    // Bambu wraps status in a "print" object
    JsonObject print = doc["print"];
    if (print.isNull()) return;

    // Print state
    if (print.containsKey("gcode_state")) {
        strncpy(_status.gcodeState, print["gcode_state"] | "", sizeof(_status.gcodeState) - 1);
    }
    if (print.containsKey("mc_percent")) {
        _status.printPercent = print["mc_percent"] | 0;
    }
    if (print.containsKey("mc_remaining_time")) {
        _status.remainingTime = print["mc_remaining_time"] | 0;
    }
    if (print.containsKey("layer_num")) {
        _status.currentLayer = print["layer_num"] | 0;
    }
    if (print.containsKey("total_layer_num")) {
        _status.totalLayers = print["total_layer_num"] | 0;
    }
    if (print.containsKey("subtask_name")) {
        strncpy(_status.subtaskName, print["subtask_name"] | "", sizeof(_status.subtaskName) - 1);
    }

    // Temperatures
    if (print.containsKey("nozzle_temper")) {
        _status.nozzleTemp = print["nozzle_temper"] | 0.0f;
    }
    if (print.containsKey("nozzle_target_temper")) {
        _status.nozzleTarget = print["nozzle_target_temper"] | 0.0f;
    }
    if (print.containsKey("bed_temper")) {
        _status.bedTemp = print["bed_temper"] | 0.0f;
    }
    if (print.containsKey("bed_target_temper")) {
        _status.bedTarget = print["bed_target_temper"] | 0.0f;
    }
    if (print.containsKey("chamber_temper")) {
        _status.chamberTemp = print["chamber_temper"] | 0.0f;
    }

    // Fans (reported as speed values, convert to percent)
    if (print.containsKey("cooling_fan_speed")) {
        _status.partFanSpeed = print["cooling_fan_speed"] | 0;
    }
    if (print.containsKey("big_fan1_speed")) {
        _status.auxFanSpeed = print["big_fan1_speed"] | 0;
    }
    if (print.containsKey("big_fan2_speed")) {
        _status.chamberFanSpeed = print["big_fan2_speed"] | 0;
    }

    // Nozzle info
    if (print.containsKey("nozzle_type")) {
        strncpy(_status.nozzleType, print["nozzle_type"] | "", sizeof(_status.nozzleType) - 1);
    }
    if (print.containsKey("nozzle_diameter")) {
        const char* nd = print["nozzle_diameter"] | "0.4";
        _status.nozzleDiameter = atof(nd);
    }

    // WiFi
    if (print.containsKey("wifi_signal")) {
        const char* ws = print["wifi_signal"] | "0";
        _status.wifiSignal = atoi(ws);
    }

    // Error
    if (print.containsKey("print_error")) {
        _status.printError = print["print_error"] | 0;
    }

    // AMS data
    JsonArray amsArr = print["ams"]["ams"];
    if (!amsArr.isNull()) {
        _status.amsCount = amsArr.size();
        _status.trayCount = 0;

        for (int unit = 0; unit < amsArr.size() && unit < 4; unit++) {
            JsonArray trays = amsArr[unit]["tray"];
            if (trays.isNull()) continue;

            for (int slot = 0; slot < trays.size() && slot < 4; slot++) {
                int idx = unit * 4 + slot;
                if (idx >= 16) break;

                JsonObject tray = trays[slot];
                Tray& t = _status.trays[idx];

                t.present = !tray["tray_type"].isNull();
                if (t.present) {
                    strncpy(t.type, tray["tray_type"] | "", sizeof(t.type) - 1);

                    // Color is hex string "RRGGBBAA"
                    const char* colorStr = tray["tray_color"] | "";
                    if (colorStr[0]) {
                        t.color = strtoul(colorStr, nullptr, 16);
                    }

                    t.remain = tray["remain"] | 0;
                    t.humidity = tray.containsKey("humidity") ? (int)(tray["humidity"] | -1) : -1;
                    t.nozzleTempMin = tray["nozzle_temp_min"] | 0.0f;
                    t.nozzleTempMax = tray["nozzle_temp_max"] | 0.0f;

                    const char* uid = tray["tag_uid"] | "";
                    strncpy(t.tagUid, uid, sizeof(t.tagUid) - 1);

                    _status.trayCount = idx + 1;
                }
            }
        }
    }

    _status.valid = true;
    _status.lastUpdateMs = millis();
}

// ── Serialize to JSON for relay ─────────────────────────────────────────

String BambuMqtt::toJson() const {
    JsonDocument doc;

    doc["gcodeState"] = _status.gcodeState;
    doc["printPercent"] = _status.printPercent;
    doc["remainingTime"] = _status.remainingTime;
    doc["currentLayer"] = _status.currentLayer;
    doc["totalLayers"] = _status.totalLayers;
    doc["subtaskName"] = _status.subtaskName;

    doc["nozzleTemp"] = _status.nozzleTemp;
    doc["nozzleTarget"] = _status.nozzleTarget;
    doc["bedTemp"] = _status.bedTemp;
    doc["bedTarget"] = _status.bedTarget;
    doc["chamberTemp"] = _status.chamberTemp;

    doc["partFanSpeed"] = _status.partFanSpeed;
    doc["auxFanSpeed"] = _status.auxFanSpeed;
    doc["chamberFanSpeed"] = _status.chamberFanSpeed;

    doc["nozzleType"] = _status.nozzleType;
    doc["nozzleDiameter"] = _status.nozzleDiameter;
    doc["wifiSignal"] = _status.wifiSignal;
    doc["printError"] = _status.printError;
    doc["amsCount"] = _status.amsCount;

    JsonArray trays = doc["trays"].to<JsonArray>();
    for (int i = 0; i < _status.trayCount; i++) {
        const Tray& t = _status.trays[i];
        if (!t.present) continue;
        JsonObject tj = trays.add<JsonObject>();
        tj["slot"] = i;
        tj["type"] = t.type;
        tj["color"] = t.color;
        tj["remain"] = t.remain;
        if (t.humidity >= 0) tj["humidity"] = t.humidity;
        tj["nozzleTempMin"] = t.nozzleTempMin;
        tj["nozzleTempMax"] = t.nozzleTempMax;
        if (t.tagUid[0]) tj["tagUid"] = t.tagUid;
    }

    String output;
    serializeJson(doc, output);
    return output;
}

// ── Request full status ─────────────────────────────────────────────────

void BambuMqtt::requestPushAll() {
    if (!_client || !_connected) return;

    char topic[64];
    snprintf(topic, sizeof(topic), "device/%s/request", _serialNumber);

    const char* payload = "{\"pushing\":{\"sequence_id\":\"0\",\"command\":\"pushall\"}}";
    esp_mqtt_client_publish(_client, topic, payload, strlen(payload), 0, 0);
    Serial.println("[Bambu] Sent pushall request");
}

// ── Initialization ──────────────────────────────────────────────────────

void BambuMqtt::begin(const char* printerIp, const char* accessCode,
                       const char* serialNumber, const char* machineId) {
    if (_client) stop();

    strncpy(_serialNumber, serialNumber, sizeof(_serialNumber) - 1);
    strncpy(_machineId, machineId, sizeof(_machineId) - 1);

    char uri[128];
    snprintf(uri, sizeof(uri), "mqtts://%s:8883", printerIp);

    esp_mqtt_client_config_t config = {};
    config.uri = uri;
    config.username = "bblp";
    config.password = accessCode;
    // Bambu printers use self-signed certs — skip verification
    config.skip_cert_common_name_check = true;
    config.cert_pem = nullptr;
    config.keepalive = 60;
    config.reconnect_timeout_ms = 10000;
    config.buffer_size = BAMBU_MSG_BUF_SIZE;
    config.out_buffer_size = 512;  // We only send pushall requests

    _client = esp_mqtt_client_init(&config);
    if (!_client) {
        Serial.println("[Bambu] Failed to init MQTT client");
        return;
    }

    esp_mqtt_client_register_event(_client,
        static_cast<esp_mqtt_event_id_t>(MQTT_EVENT_ANY),
        BambuMqtt::eventHandler, this);

    esp_err_t err = esp_mqtt_client_start(_client);
    if (err != ESP_OK) {
        Serial.printf("[Bambu] Start failed: %s\n", esp_err_to_name(err));
    } else {
        Serial.printf("[Bambu] Connecting to %s (serial: %s)...\n", uri, serialNumber);
    }
}

void BambuMqtt::stop() {
    if (_client) {
        esp_mqtt_client_stop(_client);
        esp_mqtt_client_destroy(_client);
        _client = nullptr;
        _connected = false;
    }
    if (_msgBuf) {
        free(_msgBuf);
        _msgBuf = nullptr;
    }
}
