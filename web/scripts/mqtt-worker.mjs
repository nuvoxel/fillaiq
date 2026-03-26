#!/usr/bin/env node
/**
 * Standalone MQTT subscriber worker.
 * Runs as a separate process (not inside Next.js) to avoid
 * Next.js worker lifecycle issues killing the MQTT connection.
 *
 * Usage: node scripts/mqtt-worker.mjs
 */

import mqtt from "mqtt";

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL || "mqtt://localhost:1883";
const API_BASE = process.env.MQTT_WORKER_API_BASE || "http://localhost:3000";
const API_SECRET = process.env.MQTT_WORKER_SECRET || "";

console.log(`[MQTT Worker] Connecting to ${MQTT_BROKER_URL}...`);
console.log(`[MQTT Worker] API base: ${API_BASE}`);

const client = mqtt.connect(MQTT_BROKER_URL, {
  clientId: `fillaiq-mqtt-worker-${Date.now()}`,
  clean: true,
  keepalive: 30,
  reconnectPeriod: 3000,
  connectTimeout: 10000,
});

client.on("connect", () => {
  console.log("[MQTT Worker] Connected");
  client.subscribe("fiq/d/+/#", { qos: 1 }, (err) => {
    if (err) {
      console.error("[MQTT Worker] Subscribe error:", err);
    } else {
      console.log("[MQTT Worker] Subscribed to fiq/d/+/#");
    }
  });
});

client.on("message", async (topic, payload) => {
  const parts = topic.split("/");
  if (parts.length < 4 || parts[0] !== "fiq" || parts[1] !== "d") return;

  const hardwareId = parts[2];
  const channel = parts.slice(3).join("/");

  let data;
  try {
    data = JSON.parse(payload.toString());
  } catch {
    return; // Skip non-JSON
  }

  // Forward to the Next.js API for processing
  try {
    const res = await fetch(`${API_BASE}/api/v1/mqtt/message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(API_SECRET ? { "X-MQTT-Worker-Secret": API_SECRET } : {}),
      },
      body: JSON.stringify({ hardwareId, channel, payload: data }),
    });
    if (!res.ok) {
      console.error(`[MQTT Worker] API error ${res.status} for ${channel}:`, await res.text().catch(() => ""));
    }
  } catch (e) {
    console.error(`[MQTT Worker] Fetch error for ${channel}:`, e.message);
  }
});

client.on("error", (err) => {
  console.error("[MQTT Worker] Error:", err.message);
});

client.on("reconnect", () => {
  console.log("[MQTT Worker] Reconnecting...");
});

client.on("close", () => {
  console.log("[MQTT Worker] Connection closed");
});

// Keep process alive
process.on("SIGTERM", () => {
  console.log("[MQTT Worker] Shutting down...");
  client.end(() => process.exit(0));
});
process.on("SIGINT", () => {
  client.end(() => process.exit(0));
});
