import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scanStations, hardwareModels, hardwareIdentifiers, userPrinters } from "@/db/schema";
import { eq, and, or, isNotNull } from "drizzle-orm";
import { readFile } from "fs/promises";
import { join } from "path";

const FIRMWARE_BLOB_BASE = "https://fillaiqfw.blob.core.windows.net/firmware";

type ChannelEntry = {
  version: string;
  file: string;
  md5: string;
  size: number;
  date: string;
  notes?: string;
};

type DeviceEntry = {
  channels: Record<string, ChannelEntry>;
};

type Manifest = {
  devices: Record<string, DeviceEntry>;
};

/**
 * GET /api/v1/firmware/check?version=1.0.0&sku=filla-scan
 *
 * Called periodically by devices to check for firmware updates.
 * Also serves as a heartbeat — updates station last-seen and telemetry.
 *
 * Routes firmware by device SKU (filla-scan, shelf-station, etc.)
 * and firmware channel (stable, beta, dev).
 */
export async function GET(request: NextRequest) {
  const deviceToken = request.headers.get("x-device-token");
  if (!deviceToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate device token
  const [station] = await db
    .select()
    .from(scanStations)
    .where(
      and(
        eq(scanStations.deviceToken, deviceToken),
        isNotNull(scanStations.userId)
      )
    );

  if (!station) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Extract params
  const currentVersion =
    request.nextUrl.searchParams.get("version") ??
    request.headers.get("x-firmware-version") ??
    "0.0.0";
  const sku =
    request.nextUrl.searchParams.get("sku") ??
    request.headers.get("x-device-sku") ??
    "filla-scan";

  // Update station heartbeat + capabilities
  const updateData: Record<string, any> = {
    lastSeenAt: new Date(),
    isOnline: true,
    firmwareVersion: currentVersion,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
    updatedAt: new Date(),
  };

  // Parse full capabilities JSON from heartbeat
  const capsHeader = request.headers.get("x-capabilities");
  if (capsHeader) {
    const caps = JSON.parse(capsHeader);
    updateData.hasTofSensor = !!caps.tof?.detected;
    updateData.hasColorSensor = !!caps.colorSensor?.detected;
    updateData.hasTurntable = !!caps.turntable;
    updateData.hasCamera = !!caps.camera;

    // Merge capabilities into config, preserving deviceSettings
    const existingConfig = (station.config as any) ?? {};
    updateData.config = { ...existingConfig, capabilities: caps };
  }

  await db
    .update(scanStations)
    .set(updateData)
    .where(eq(scanStations.id, station.id));

  // Auto-populate printer catalog + instance from heartbeat
  if (capsHeader) {
    const caps = JSON.parse(capsHeader);
    if (caps.printer?.detected && station.userId) {
      try {
        await upsertPrinterFromHeartbeat(caps.printer, station.id, station.userId);
      } catch (e) {
        console.error("[heartbeat] printer upsert error:", e);
      }
    }
  }

  // Device config from station config column
  const deviceSettings = (station.config as any)?.deviceSettings ?? {};
  const deviceConfigPayload = Object.keys(deviceSettings).length > 0 ? deviceSettings : undefined;

  // Read firmware manifest
  let manifest: Manifest;
  try {
    const manifestPath = join(process.cwd(), "public", "firmware", "manifest.json");
    const raw = await readFile(manifestPath, "utf-8");
    manifest = JSON.parse(raw);
  } catch {
    return NextResponse.json({ updateAvailable: false, deviceConfig: deviceConfigPayload });
  }

  // Look up device by SKU
  const device = manifest.devices[sku];
  if (!device) {
    return NextResponse.json({ updateAvailable: false, deviceConfig: deviceConfigPayload });
  }

  // Look up channel (default: stable)
  const channel = station.firmwareChannel ?? "stable";
  const entry = device.channels[channel] ?? device.channels["stable"];

  if (!entry || !entry.file) {
    return NextResponse.json({ updateAvailable: false, deviceConfig: deviceConfigPayload });
  }

  // Compare versions
  if (!isNewerVersion(entry.version, currentVersion)) {
    return NextResponse.json({ updateAvailable: false, deviceConfig: deviceConfigPayload });
  }

  // Serve from Azure Blob Storage (supports HTTP/1.0 + TLS 1.2+)
  const binUrl = `${FIRMWARE_BLOB_BASE}/${entry.file}`;

  return NextResponse.json({
    updateAvailable: true,
    version: entry.version,
    url: binUrl,
    md5: entry.md5 || "",
    size: entry.size || 0,
    sku,
    channel,
    releaseNotes: entry.notes || "",
    deviceConfig: deviceConfigPayload,
  });
}

/**
 * Auto-populate hardware catalog + user printer instance from heartbeat data.
 */
async function upsertPrinterFromHeartbeat(
  printer: Record<string, any>,
  stationId: string,
  userId: string
) {
  const model = printer.model || printer.usbProduct || "Unknown";
  const bleAddr = printer.bleAddr || null;
  const usbId = printer.usbId || null; // "0493:B002"
  const bleName = printer.bleName || printer.deviceName || null; // BLE advertised name from runtime state

  // 1. Try to find existing hardware model by identifiers
  let hardwareModelId: string | null = null;

  const identifierConditions = [];
  if (usbId) {
    identifierConditions.push(
      and(
        eq(hardwareIdentifiers.identifierType, "usb_vid_pid"),
        eq(hardwareIdentifiers.value, usbId)
      )
    );
  }
  if (bleName) {
    identifierConditions.push(
      and(
        eq(hardwareIdentifiers.identifierType, "ble_name_prefix"),
        eq(hardwareIdentifiers.value, bleName)
      )
    );
  }

  if (identifierConditions.length > 0) {
    const [existing] = await db
      .select({ hardwareModelId: hardwareIdentifiers.hardwareModelId })
      .from(hardwareIdentifiers)
      .where(or(...identifierConditions))
      .limit(1);

    if (existing) {
      hardwareModelId = existing.hardwareModelId;
    }
  }

  // 2. Create hardware model if not found
  if (!hardwareModelId) {
    const slug = `label-printer-${model.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/-+$/, "")}`;

    // Check if slug already exists (model created without identifiers)
    const [existingBySlug] = await db
      .select({ id: hardwareModels.id })
      .from(hardwareModels)
      .where(eq(hardwareModels.slug, slug))
      .limit(1);

    if (existingBySlug) {
      hardwareModelId = existingBySlug.id;
    } else {
      const manufacturer = printer.usbManufacturer || "Unknown";
      const [usbVid, usbPid] = usbId ? usbId.split(":") : [null, null];

      const [newModel] = await db
        .insert(hardwareModels)
        .values({
          category: "label_printer",
          manufacturer,
          model,
          slug,
          hasBle: !!bleAddr,
          hasUsb: !!usbId,
          protocol: "esc_pos",
          printDpi: printer.dpi || null,
          printWidthMm: printer.labelWidthMm || null,
          capabilities: {
            battery: printer.battery != null,
            paperSensor: printer.paperLoaded != null,
            coverSensor: printer.coverClosed != null,
            discoveredVia: printer.transport || "BLE",
          },
        })
        .returning({ id: hardwareModels.id });

      hardwareModelId = newModel.id;
    }

    // 3. Create identifiers for future matching
    const identifiersToInsert = [];
    if (usbId) {
      identifiersToInsert.push({
        hardwareModelId,
        identifierType: "usb_vid_pid" as const,
        value: usbId,
        priority: 10,
        notes: "Auto-discovered from USB Host",
      });
    }
    if (bleName) {
      identifiersToInsert.push({
        hardwareModelId,
        identifierType: "ble_name_prefix" as const,
        value: bleName,
        priority: 5,
        notes: "Auto-discovered from BLE scan",
      });
    }
    if (identifiersToInsert.length > 0) {
      await db
        .insert(hardwareIdentifiers)
        .values(identifiersToInsert)
        .onConflictDoNothing();
    }
  }

  // 4. Update hardware model with any new data from this heartbeat
  const modelUpdate: Record<string, any> = { updatedAt: new Date() };
  if (printer.dpi) modelUpdate.printDpi = printer.dpi;
  if (printer.labelWidthMm) modelUpdate.printWidthMm = printer.labelWidthMm;
  if (printer.usbManufacturer) modelUpdate.manufacturer = printer.usbManufacturer;
  if (usbId) modelUpdate.hasUsb = true;
  if (bleAddr) modelUpdate.hasBle = true;

  await db
    .update(hardwareModels)
    .set(modelUpdate)
    .where(eq(hardwareModels.id, hardwareModelId));

  // 5. Upsert user printer instance (match by BLE address or USB serial)
  const printerConditions = [];
  if (bleAddr) {
    printerConditions.push(
      and(eq(userPrinters.userId, userId), eq(userPrinters.bleAddress, bleAddr))
    );
  }
  if (printer.usbSerialNumber) {
    printerConditions.push(
      and(eq(userPrinters.userId, userId), eq(userPrinters.usbSerial, printer.usbSerialNumber))
    );
  }

  let existingPrinter = null;
  if (printerConditions.length > 0) {
    [existingPrinter] = await db
      .select({ id: userPrinters.id })
      .from(userPrinters)
      .where(or(...printerConditions))
      .limit(1);
  }

  const [usbVid, usbPid] = usbId ? usbId.split(":") : [null, null];
  const now = new Date();

  // Build serial number string from integer or string
  const serialStr = printer.serialNumber
    ? String(printer.serialNumber)
    : null;

  if (existingPrinter) {
    await db
      .update(userPrinters)
      .set({
        hardwareModelId,
        bleName: bleName || undefined,
        serialNumber: serialStr || undefined,
        firmwareVersion: printer.firmware || null,
        batteryPercent: printer.battery ?? null,
        paperLoaded: printer.paperLoaded ?? null,
        coverClosed: printer.coverClosed ?? null,
        lastSeenAt: now,
        lastConnectedVia: printer.transport?.toLowerCase() || "ble",
        scanStationId: stationId,
        usbVid: usbVid || undefined,
        usbPid: usbPid || undefined,
        usbManufacturer: printer.usbManufacturer || undefined,
        usbProduct: printer.usbProduct || undefined,
        usbSerial: printer.usbSerialNumber || undefined,
        updatedAt: now,
      })
      .where(eq(userPrinters.id, existingPrinter.id));
  } else {
    await db.insert(userPrinters).values({
      userId,
      hardwareModelId,
      name: bleName || model,
      bleAddress: bleAddr,
      bleName: bleName,
      serialNumber: serialStr,
      firmwareVersion: printer.firmware || null,
      usbVid: usbVid || null,
      usbPid: usbPid || null,
      usbManufacturer: printer.usbManufacturer || null,
      usbProduct: printer.usbProduct || null,
      usbSerial: printer.usbSerialNumber || null,
      batteryPercent: printer.battery ?? null,
      paperLoaded: printer.paperLoaded ?? null,
      coverClosed: printer.coverClosed ?? null,
      lastSeenAt: now,
      lastConnectedVia: printer.transport?.toLowerCase() || "ble",
      scanStationId: stationId,
    });
  }
}

/**
 * Simple semver comparison: returns true if `latest` is newer than `current`.
 */
function isNewerVersion(latest: string, current: string): boolean {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const lv = l[i] ?? 0;
    const cv = c[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}
