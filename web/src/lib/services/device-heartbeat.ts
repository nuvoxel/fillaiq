/**
 * Device heartbeat service — extracted from POST /api/v1/firmware/check.
 * Processes telemetry and capabilities from a device heartbeat.
 */

import { db } from "@/db";
import { scanStations } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Process a device telemetry heartbeat.
 * Updates lastSeenAt, isOnline, firmwareVersion, and optionally weightCalibration.
 */
export async function processHeartbeat(
  stationId: string,
  telemetry: {
    version?: string;
    sku?: string;
    uptime?: number;
    freeHeap?: number;
    wifiRssi?: number;
    ipAddress?: string;
    weightCalibration?: number;
    printer?: {
      connected?: boolean;
      battery?: number;
      paperLoaded?: boolean;
      coverClosed?: boolean;
    };
  }
) {
  const [station] = await db
    .select()
    .from(scanStations)
    .where(eq(scanStations.id, stationId));

  if (!station) return;

  const updateData: Record<string, any> = {
    lastSeenAt: new Date(),
    isOnline: true,
    updatedAt: new Date(),
  };

  if (telemetry.version) {
    updateData.firmwareVersion = telemetry.version;
  }

  if (telemetry.sku) {
    updateData.deviceSku = telemetry.sku;
  }

  if (telemetry.ipAddress) {
    updateData.ipAddress = telemetry.ipAddress;
  }

  // Store runtime telemetry and weight calibration in config
  const existingConfig = (station.config as any) ?? {};
  const existingSettings = existingConfig.deviceSettings ?? {};
  const telemetryData: Record<string, any> = {};

  if (typeof telemetry.uptime === "number") telemetryData.uptime = telemetry.uptime;
  if (typeof telemetry.freeHeap === "number") telemetryData.freeHeap = telemetry.freeHeap;
  if (typeof telemetry.wifiRssi === "number") telemetryData.wifiRssi = telemetry.wifiRssi;
  if (telemetry.printer) telemetryData.printer = telemetry.printer;

  const newSettings = { ...existingSettings };
  if (
    typeof telemetry.weightCalibration === "number" &&
    telemetry.weightCalibration > 0
  ) {
    newSettings.weightCalibration = telemetry.weightCalibration;
  }

  if (Object.keys(telemetryData).length > 0 || newSettings !== existingSettings) {
    updateData.config = {
      ...existingConfig,
      deviceSettings: newSettings,
      telemetry: telemetryData,
    };
  }

  await db
    .update(scanStations)
    .set(updateData)
    .where(eq(scanStations.id, stationId));
}

/**
 * Process device capability report.
 * Updates station capability flags and config.capabilities JSON.
 */
export async function processCapabilities(
  stationId: string,
  caps: Record<string, any>
) {
  const [station] = await db
    .select()
    .from(scanStations)
    .where(eq(scanStations.id, stationId));

  if (!station) return;

  const updateData: Record<string, any> = {
    hasColorSensor: !!caps.colorSensor?.detected,
    hasTurntable: !!caps.turntable,
    hasCamera: !!caps.camera,
    updatedAt: new Date(),
  };

  // Merge capabilities into config, preserving deviceSettings
  const existingConfig = (station.config as any) ?? {};
  updateData.config = { ...existingConfig, capabilities: caps };

  await db
    .update(scanStations)
    .set(updateData)
    .where(eq(scanStations.id, stationId));

  return { stationId, caps };
}

/**
 * Update device online status (used for MQTT last will / connect).
 */
export async function updateOnlineStatus(
  stationId: string,
  online: boolean
) {
  const updateData: Record<string, any> = {
    isOnline: online,
    updatedAt: new Date(),
  };

  if (online) {
    updateData.lastSeenAt = new Date();
    updateData.mqttConnectedAt = new Date();
  }

  await db
    .update(scanStations)
    .set(updateData)
    .where(eq(scanStations.id, stationId));
}
