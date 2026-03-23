import mqtt, { type MqttClient } from "mqtt";
import { handleMqttMessage } from "./handlers";

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";

// Singleton pattern — same approach as database client (globalThis caching)
const globalForMqtt = globalThis as unknown as {
  mqttClient?: MqttClient;
  mqttConnecting?: boolean;
};

/**
 * Get or create the singleton MQTT client.
 * Connects to the broker, subscribes to all device-to-server topics,
 * and dispatches incoming messages to handlers.
 */
export function getMqttClient(): MqttClient | null {
  if (globalForMqtt.mqttClient?.connected) {
    return globalForMqtt.mqttClient;
  }
  return globalForMqtt.mqttClient ?? null;
}

export function ensureMqttConnected(): void {
  if (globalForMqtt.mqttClient || globalForMqtt.mqttConnecting) {
    return;
  }

  globalForMqtt.mqttConnecting = true;

  console.log(`[MQTT] Connecting to ${MQTT_BROKER_URL}...`);

  const client = mqtt.connect(MQTT_BROKER_URL, {
    clientId: `fillaiq-server-${process.pid}`,
    clean: true,
    keepalive: 60,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
  });

  client.on("connect", () => {
    console.log("[MQTT] Connected to broker");
    globalForMqtt.mqttConnecting = false;

    // Subscribe to all device-to-server messages
    client.subscribe("fiq/d/+/#", { qos: 1 }, (err) => {
      if (err) {
        console.error("[MQTT] Subscribe error:", err);
      } else {
        console.log("[MQTT] Subscribed to fiq/d/+/#");
      }
    });
  });

  client.on("message", (topic, payload) => {
    try {
      handleMqttMessage(topic, payload);
    } catch (e) {
      console.error("[MQTT] Handler error:", topic, e);
    }
  });

  client.on("error", (err) => {
    console.error("[MQTT] Error:", err.message);
  });

  client.on("reconnect", () => {
    console.log("[MQTT] Reconnecting...");
  });

  client.on("close", () => {
    console.log("[MQTT] Connection closed");
    globalForMqtt.mqttConnecting = false;
  });

  globalForMqtt.mqttClient = client;
  if (process.env.NODE_ENV !== "production") {
    // Prevent stale connections during HMR
    globalForMqtt.mqttClient = client;
  }
}
