/**
 * MQTT message dispatcher.
 * Routes incoming device-to-server messages to handler functions.
 *
 * Topics follow: fiq/d/{hardwareId}/{channel}
 * All handlers receive the parsed hardwareId and JSON payload.
 */

import { db } from "@/db";
import { scanStations, scanSessions, machines, userItems, products, materials, slots, bays, shelves, racks, zones } from "@/db/schema";
import { eq, and, isNull, desc } from "drizzle-orm";
import { normalizeStatus } from "@/lib/machines";
import {
  processHeartbeat,
  processCapabilities,
  updateOnlineStatus,
} from "@/lib/services/device-heartbeat";
import { processScan } from "@/lib/services/scan-processor";
import { insertEnvironmentalReading } from "@/lib/services/environment-service";
import { updatePrintJobStatus } from "@/lib/services/print-job-service";
import { upsertPrinterFromHeartbeat } from "@/lib/services/printer-upsert";
import { getSlotPath } from "@/lib/services/storage-path";
import { publishScanResult, publishNfcLookupResult } from "./publisher";

type Handler = (hardwareId: string, payload: Record<string, any>) => Promise<void>;

const handlers: Record<string, Handler> = {
  telemetry: handleTelemetry,
  capabilities: handleCapabilities,
  scan: handleScan,
  env: handleEnv,
  "print/status": handlePrintStatus,
  calibration: handleCalibration,
  status: handleStatus,
  "nfc/lookup": handleNfcLookup,
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
    console.error(`[MQTT] Invalid JSON on ${topic}: ${raw.toString().slice(0, 200)}`);
    return;
  }

  // Check for exact match first, then pattern matches
  const handler = handlers[channel];
  if (handler) {
    handler(hardwareId, payload).catch((err) => {
      console.error(`[MQTT] Handler error for ${channel}:`, err);
    });
  } else if (channel.startsWith("machine/")) {
    const machineId = channel.split("/")[1];
    handleMachineStatus(hardwareId, machineId, payload).catch((err) => {
      console.error(`[MQTT] Handler error for machine status:`, err);
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

  // Auto-discover and catalog printers from capabilities
  if (payload.printer?.detected && station.userId) {
    try {
      await upsertPrinterFromHeartbeat(payload.printer, station.id, station.userId);
    } catch (e) {
      console.error("[MQTT] Printer upsert error:", e);
    }
  }
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

// ── NFC UID lookup (lightweight pre-scan identification) ─────────────

async function handleNfcLookup(
  hardwareId: string,
  payload: Record<string, any>
): Promise<void> {
  const uid: string | undefined = payload.uid;
  if (!uid) return;

  const station = await resolveStation(hardwareId);
  if (!station || !station.userId) return;

  // Look up user_item by NFC UID for this user, joining product + material
  const selectFields = {
    itemId: userItems.id,
    productName: products.name,
    materialName: materials.name,
    colorName: products.colorName,
    colorHex: products.colorHex,
    currentWeightG: userItems.currentWeightG,
    status: userItems.status,
    currentSlotId: userItems.currentSlotId,
  };

  let rows = await db
    .select(selectFields)
    .from(userItems)
    .leftJoin(products, eq(userItems.productId, products.id))
    .leftJoin(materials, eq(products.materialId, materials.id))
    .where(
      and(
        eq(userItems.nfcUid, uid),
        eq(userItems.userId, station.userId)
      )
    )
    .limit(1);

  // Fallback: match by Bambu trayUid (same spool, different NFC tag)
  if (rows.length === 0) {
    // Check the active session on this station for a trayUid
    const [session] = await db
      .select({ nfcParsedData: scanSessions.nfcParsedData })
      .from(scanSessions)
      .where(
        and(
          eq(scanSessions.stationId, station.id),
          eq(scanSessions.status, "active")
        )
      )
      .orderBy(desc(scanSessions.updatedAt))
      .limit(1);

    const trayUid = (session?.nfcParsedData as any)?.trayUid;
    if (trayUid) {
      rows = await db
        .select(selectFields)
        .from(userItems)
        .leftJoin(products, eq(userItems.productId, products.id))
        .leftJoin(materials, eq(products.materialId, materials.id))
        .where(
          and(
            eq(userItems.bambuTrayUid, trayUid),
            eq(userItems.userId, station.userId)
          )
        )
        .limit(1);
    }
  }

  if (rows.length === 0) {
    publishNfcLookupResult(hardwareId, { known: false });
    return;
  }

  const row = rows[0];

  // Build return location from storage slot path
  let returnLocation: string | null = null;
  if (row.currentSlotId) {
    returnLocation = await getSlotPath(row.currentSlotId);
  }

  // Get empty slots for this user (for return-location cycling on device)
  const emptySlotRows = await db
    .select({
      slotId: slots.id,
    })
    .from(slots)
    .innerJoin(bays, eq(slots.bayId, bays.id))
    .innerJoin(shelves, eq(bays.shelfId, shelves.id))
    .innerJoin(racks, eq(shelves.rackId, racks.id))
    .innerJoin(zones, eq(racks.zoneId, zones.id))
    .leftJoin(userItems, and(
      eq(userItems.currentSlotId, slots.id),
      eq(userItems.status, 'active')
    ))
    .where(and(
      eq(zones.userId, station.userId!),
      isNull(userItems.id)
    ))
    .limit(20);

  const emptySlots: { id: string; path: string }[] = [];
  for (const s of emptySlotRows) {
    const path = await getSlotPath(s.slotId);
    if (path) {
      emptySlots.push({ id: s.slotId, path });
    }
  }

  publishNfcLookupResult(hardwareId, {
    known: true,
    itemId: row.itemId,
    productName: row.productName ?? "Unknown",
    material: row.materialName ?? null,
    colorName: row.colorName ?? null,
    colorHex: row.colorHex ?? null,
    currentWeightG: row.currentWeightG ?? null,
    returnLocation,
    returnSlotId: row.currentSlotId ?? null,
    status: row.status,
    emptySlots,
  });
}

// ── Machine status (relayed from local printer MQTT) ─────────────────

async function handleMachineStatus(
  hardwareId: string,
  machineId: string,
  payload: Record<string, any>
): Promise<void> {
  // Look up the machine's protocol to normalize through the correct plugin
  const [machine] = await db
    .select({ protocol: machines.protocol })
    .from(machines)
    .where(eq(machines.id, machineId))
    .limit(1);

  const protocol = machine?.protocol ?? "bambu"; // default for backward compat
  const normalized = normalizeStatus(protocol, payload);

  await db
    .update(machines)
    .set({
      liveStatus: normalized,
      updatedAt: new Date(),
    })
    .where(eq(machines.id, machineId));
}
