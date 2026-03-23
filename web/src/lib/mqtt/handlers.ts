/**
 * MQTT message dispatcher.
 * Routes incoming device-to-server messages to handler functions.
 *
 * Topics follow: fiq/d/{hardwareId}/{channel}
 * All handlers receive the parsed hardwareId and JSON payload.
 */

import { db } from "@/db";
import { scanStations } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  processHeartbeat,
  processCapabilities,
  updateOnlineStatus,
} from "@/lib/services/device-heartbeat";
import { processScan } from "@/lib/services/scan-processor";
import { insertEnvironmentalReading } from "@/lib/services/environment-service";
import { updatePrintJobStatus } from "@/lib/services/print-job-service";
import { publishScanResult } from "./publisher";

type Handler = (hardwareId: string, payload: Record<string, any>) => Promise<void>;

const handlers: Record<string, Handler> = {
  telemetry: handleTelemetry,
  capabilities: handleCapabilities,
  scan: handleScan,
  env: handleEnv,
  "print/status": handlePrintStatus,
  calibration: handleCalibration,
  status: handleStatus,
};

export function handleMqttMessage(topic: string, raw: Buffer): void {
  const parts = topic.split("/");
  if (parts.length < 4 || parts[0] !== "fiq" || parts[1] !== "d") return;

  const hardwareId = parts[2];
  const channel = parts.slice(3).join("/");

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(raw.toString());
  } catch {
    console.error(`[MQTT] Invalid JSON on ${topic}`);
    return;
  }

  const handler = handlers[channel];
  if (handler) {
    handler(hardwareId, payload).catch((err) => {
      console.error(`[MQTT] Handler error for ${channel}:`, err);
    });
  } else {
    console.warn(`[MQTT] No handler for channel: ${channel}`);
  }
}

// ── Helper: resolve hardwareId → station record ──────────────────────────

async function resolveStation(hardwareId: string) {
  const [station] = await db
    .select()
    .from(scanStations)
    .where(eq(scanStations.hardwareId, hardwareId));
  return station ?? null;
}

// ── Handlers ─────────────────────────────────────────────────────────────

async function handleTelemetry(
  hardwareId: string,
  payload: Record<string, any>
): Promise<void> {
  const station = await resolveStation(hardwareId);
  if (!station) return;

  await processHeartbeat(station.id, {
    version: payload.version,
    sku: payload.sku,
    uptime: payload.uptime,
    freeHeap: payload.freeHeap,
    wifiRssi: payload.wifiRssi,
    weightCalibration: payload.weightCalibration,
  });
}

async function handleCapabilities(
  hardwareId: string,
  payload: Record<string, any>
): Promise<void> {
  const station = await resolveStation(hardwareId);
  if (!station) return;

  await processCapabilities(station.id, payload);

  // TODO: printer upsert from capabilities (extract from firmware/check route)
}

async function handleScan(
  hardwareId: string,
  payload: Record<string, any>
): Promise<void> {
  const station = await resolveStation(hardwareId);
  if (!station) return;

  const result = await processScan(station.id, station.userId, payload);

  // Publish result back to device
  publishScanResult(hardwareId, result);
}

async function handleEnv(
  hardwareId: string,
  payload: Record<string, any>
): Promise<void> {
  const station = await resolveStation(hardwareId);
  if (!station) return;

  await insertEnvironmentalReading(station.id, {
    temperatureC: payload.temperatureC,
    humidity: payload.humidity,
    pressureHPa: payload.pressureHPa,
  });
}

async function handlePrintStatus(
  hardwareId: string,
  payload: Record<string, any>
): Promise<void> {
  if (!payload.jobId || !payload.status) return;

  await updatePrintJobStatus(
    payload.jobId,
    payload.status,
    payload.errorMessage
  );
}

async function handleCalibration(
  hardwareId: string,
  payload: Record<string, any>
): Promise<void> {
  const station = await resolveStation(hardwareId);
  if (!station) return;

  if (
    typeof payload.weightCalibration === "number" &&
    payload.weightCalibration > 0
  ) {
    const existingConfig = (station.config as any) ?? {};
    await db
      .update(scanStations)
      .set({
        config: {
          ...existingConfig,
          deviceSettings: {
            ...(existingConfig.deviceSettings ?? {}),
            weightCalibration: payload.weightCalibration,
          },
        },
        updatedAt: new Date(),
      })
      .where(eq(scanStations.id, station.id));
  }
}

async function handleStatus(
  hardwareId: string,
  payload: Record<string, any>
): Promise<void> {
  const station = await resolveStation(hardwareId);
  if (!station) return;

  await updateOnlineStatus(station.id, !!payload.online);
}
