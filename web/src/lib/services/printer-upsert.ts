/**
 * Printer upsert service — extracted from POST /api/v1/firmware/check.
 * Auto-discovers and catalogs printers from device capabilities.
 */

import { db } from "@/db";
import { hardwareModels, hardwareIdentifiers, userPrinters } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";

export async function upsertPrinterFromHeartbeat(
  printer: Record<string, any>,
  stationId: string,
  userId: string
) {
  const model = printer.model || printer.usbProduct || "Unknown";
  const bleAddr = printer.bleAddr || null;
  const usbId = printer.usbId || null;
  const bleName = printer.bleName || printer.deviceName || null;
  const bleServiceUUIDs = printer.bleServiceUUIDs || null;
  const bleNamePrefix = printer.bleNamePrefix || null;

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
  if (bleServiceUUIDs) {
    for (const uuid of bleServiceUUIDs.split(",")) {
      const trimmed = uuid.trim();
      if (trimmed) {
        identifierConditions.push(
          and(
            eq(hardwareIdentifiers.identifierType, "ble_service_uuid"),
            eq(hardwareIdentifiers.value, trimmed)
          )
        );
      }
    }
  }
  if (bleNamePrefix) {
    identifierConditions.push(
      and(
        eq(hardwareIdentifiers.identifierType, "ble_name_prefix"),
        eq(hardwareIdentifiers.value, bleNamePrefix)
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

    const [existingBySlug] = await db
      .select({ id: hardwareModels.id })
      .from(hardwareModels)
      .where(eq(hardwareModels.slug, slug))
      .limit(1);

    if (existingBySlug) {
      hardwareModelId = existingBySlug.id;
    } else {
      const manufacturer = printer.usbManufacturer || "Unknown";

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

  // 4. Update hardware model with any new data
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

  // 5. Upsert user printer instance
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
  const serialStr = printer.serialNumber ? String(printer.serialNumber) : null;

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
