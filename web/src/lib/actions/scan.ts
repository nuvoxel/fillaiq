"use server";

import { db } from "@/db";
import { eq, ne, desc, and, or, ilike, gt, gte, isNull } from "drizzle-orm";
import { scanStations, scanEvents, scanSessions } from "@/db/schema/scan-stations";
import { environmentalReadings } from "@/db/schema/events";
import { products, brands, materials, skuMappings, nfcTagPatterns } from "@/db/schema/central-catalog";
import { userItems, userPrinters, printJobs } from "@/db/schema/user-library";
import { zones, racks, shelves, bays, slots, slotStatus } from "@/db/schema/storage";
import { requireAuth } from "./auth";
import { ok, err, type ActionResult } from "./utils";

// ── Device Pairing ───────────────────────────────────────────────────────────

export async function claimDevice(pairingCode: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const code = pairingCode.toUpperCase().trim();
  if (!code || code.length < 4) {
    return err("Invalid pairing code");
  }

  // Find unpaired station with valid code
  const [station] = await db
    .select()
    .from(scanStations)
    .where(
      and(
        eq(scanStations.pairingCode, code),
        isNull(scanStations.userId),
        gt(scanStations.pairingExpiresAt, new Date())
      )
    );

  if (!station) {
    return err("Invalid or expired pairing code");
  }

  // Claim the device
  await db
    .update(scanStations)
    .set({
      userId: guard.data.userId,
      pairingCode: null,
      pairingExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(scanStations.id, station.id));

  return ok({
    id: station.id,
    name: station.name,
    hardwareId: station.hardwareId,
  });
}

// ── Scan Stations ─────────────────────────────────────────────────────────────

export async function listMyStations() {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const rows = await db
    .select({
      id: scanStations.id,
      name: scanStations.name,
      hardwareId: scanStations.hardwareId,
      firmwareVersion: scanStations.firmwareVersion,
      firmwareChannel: scanStations.firmwareChannel,
      ipAddress: scanStations.ipAddress,
      isOnline: scanStations.isOnline,
      lastSeenAt: scanStations.lastSeenAt,
      hasTurntable: scanStations.hasTurntable,
      hasColorSensor: scanStations.hasColorSensor,
      hasCamera: scanStations.hasCamera,
      deviceSku: scanStations.deviceSku,
      config: scanStations.config,
      createdAt: scanStations.createdAt,
    })
    .from(scanStations)
    .where(eq(scanStations.userId, guard.data.userId))
    .orderBy(desc(scanStations.lastSeenAt));

  return ok(rows);
}

export async function revokeDevice(stationId: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  // Verify ownership
  const [station] = await db
    .select()
    .from(scanStations)
    .where(
      and(
        eq(scanStations.id, stationId),
        eq(scanStations.userId, guard.data.userId)
      )
    );

  if (!station) return err("Station not found");

  // Delete print jobs linked to this station
  await db.delete(printJobs).where(eq(printJobs.stationId, stationId));

  // Delete label printers linked to this station
  await db.delete(userPrinters).where(eq(userPrinters.scanStationId, stationId));

  // Abandon active scan sessions
  await db
    .update(scanSessions)
    .set({ status: "abandoned", updatedAt: new Date() })
    .where(and(eq(scanSessions.stationId, stationId), eq(scanSessions.status, "active")));

  // Clear the device token and unlink from user
  await db
    .update(scanStations)
    .set({
      userId: null,
      deviceToken: null,
      pairingCode: null,
      pairingExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(scanStations.id, stationId));

  return ok({ revoked: true });
}

const VALID_CHANNELS = ["stable", "beta", "dev"] as const;

export async function updateStationChannel(stationId: string, channel: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  if (!VALID_CHANNELS.includes(channel as typeof VALID_CHANNELS[number])) {
    return err("Invalid channel. Must be stable, beta, or dev.");
  }

  // Verify ownership
  const [station] = await db
    .select()
    .from(scanStations)
    .where(
      and(
        eq(scanStations.id, stationId),
        eq(scanStations.userId, guard.data.userId)
      )
    );

  if (!station) return err("Station not found");

  await db
    .update(scanStations)
    .set({
      firmwareChannel: channel,
      updatedAt: new Date(),
    })
    .where(eq(scanStations.id, stationId));

  return ok({ updated: true });
}

export async function updateDeviceConfig(stationId: string, settings: Record<string, any>) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const [station] = await db
    .select()
    .from(scanStations)
    .where(
      and(
        eq(scanStations.id, stationId),
        eq(scanStations.userId, guard.data.userId)
      )
    );

  if (!station) return err("Station not found");

  const existingConfig = (station.config as any) ?? {};
  const updatedConfig = {
    ...existingConfig,
    deviceSettings: {
      ...(existingConfig.deviceSettings ?? {}),
      ...settings,
    },
  };

  await db
    .update(scanStations)
    .set({ config: updatedConfig, updatedAt: new Date() })
    .where(eq(scanStations.id, stationId));

  // Push config to device via MQTT (retained — device gets it on reconnect)
  const { publishConfig } = await import("@/lib/mqtt/publisher");
  publishConfig(station.hardwareId, updatedConfig.deviceSettings);

  return ok({ updated: true });
}

export async function getStationById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const [row] = await db
    .select()
    .from(scanStations)
    .where(
      and(eq(scanStations.id, id), eq(scanStations.userId, guard.data.userId))
    );

  if (!row) return err("Station not found");
  return ok(row);
}

// ── Station Polling ───────────────────────────────────────────────────────────

/**
 * Get the latest unprocessed scan event from a station.
 * "Unprocessed" = userConfirmed is null (phone hasn't acted on it yet).
 * Optionally pass `afterId` to only get scans newer than a known event.
 */
export async function pollStationScan(stationId: string, afterId?: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  // Verify station ownership
  const [station] = await db
    .select()
    .from(scanStations)
    .where(
      and(
        eq(scanStations.id, stationId),
        eq(scanStations.userId, guard.data.userId)
      )
    );
  if (!station) return err("Station not found");

  // Build query: latest unconfirmed scan from this station
  const conditions = [
    eq(scanEvents.stationId, stationId),
    isNull(scanEvents.userConfirmed),
  ];

  // If afterId provided, get the timestamp of that event and only return newer
  if (afterId) {
    const [afterEvent] = await db
      .select({ createdAt: scanEvents.createdAt })
      .from(scanEvents)
      .where(eq(scanEvents.id, afterId));
    if (afterEvent) {
      conditions.push(gt(scanEvents.createdAt, afterEvent.createdAt));
    }
  }

  const [latest] = await db
    .select()
    .from(scanEvents)
    .where(and(...conditions))
    .orderBy(desc(scanEvents.createdAt))
    .limit(1);

  if (!latest) return ok(null);

  // Try to auto-identify from NFC data
  let autoProduct: { product: any; brand: any } | null = null;
  if (latest.nfcPresent && latest.nfcUid) {
    autoProduct = await tryIdentifyByNfc(latest);
  }

  // Fetch session data if scan is linked to one
  let session = null;
  if (latest.sessionId) {
    const [s] = await db
      .select()
      .from(scanSessions)
      .where(eq(scanSessions.id, latest.sessionId));
    if (s) {
      session = s;
      // If session has a match but we didn't get autoProduct from scanEvent,
      // try fetching the matched product from the session
      if (!autoProduct && s.matchedProductId) {
        const [match] = await db
          .select({ product: products, brand: brands })
          .from(products)
          .leftJoin(brands, eq(products.brandId, brands.id))
          .where(eq(products.id, s.matchedProductId));
        if (match) autoProduct = match;
      }
    }
  }

  return ok({
    scanEvent: latest,
    station: {
      id: station.id,
      name: station.name,
      isOnline: station.isOnline,
    },
    autoIdentified: autoProduct,
    session,
  });
}

/**
 * Try to identify a product from NFC parsed data.
 */
async function tryIdentifyByNfc(
  scan: typeof scanEvents.$inferSelect
): Promise<{ product: any; brand: any } | null> {
  const parsed = scan.nfcParsedData as Record<string, any> | null;
  if (!parsed) return null;

  // Try Bambu material ID match
  if (parsed.materialId || parsed.variantId) {
    const [match] = await db
      .select({ product: products, brand: brands })
      .from(nfcTagPatterns)
      .innerJoin(products, eq(nfcTagPatterns.productId, products.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(
        or(
          parsed.materialId
            ? eq(nfcTagPatterns.bambuMaterialId, parsed.materialId)
            : undefined,
          parsed.variantId
            ? eq(nfcTagPatterns.bambuVariantId, parsed.variantId)
            : undefined
        )
      )
      .limit(1);
    if (match) return match;
  }

  return null;
}

// ── Scan Sessions ─────────────────────────────────────────────────────────────

export async function listMyScanSessions(params?: {
  stationId?: string;
  status?: string;
  limit?: number;
  includeRecent?: boolean;
}) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const baseConditions: any[] = [eq(scanSessions.userId, guard.data.userId)];
  if (params?.stationId) {
    baseConditions.push(eq(scanSessions.stationId, params.stationId));
  }

  if (params?.status) {
    baseConditions.push(eq(scanSessions.status, params.status as any));
  } else if (params?.includeRecent) {
    // Show all sessions with data from the last 24h (active, abandoned, resolved)
    // Abandoned sessions still have valid NFC/sensor data worth using
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    baseConditions.push(gte(scanSessions.updatedAt, twentyFourHoursAgo));
  } else {
    // Default: exclude abandoned
    baseConditions.push(ne(scanSessions.status, "abandoned" as any));
  }

  const rows = await db
    .select({
      session: scanSessions,
      productName: products.name,
      brandName: brands.name,
      catalogColorHex: products.colorHex,
    })
    .from(scanSessions)
    .leftJoin(products, eq(scanSessions.matchedProductId, products.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(and(...baseConditions))
    .orderBy(desc(scanSessions.updatedAt))
    .limit(params?.limit ?? 20);

  return ok(
    rows.map((r) => ({
      ...r.session,
      productName: r.productName,
      brandName: r.brandName,
      catalogColorHex: r.catalogColorHex,
    }))
  );
}

export async function getScanSession(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const [row] = await db
    .select({
      session: scanSessions,
      productName: products.name,
      brandName: brands.name,
    })
    .from(scanSessions)
    .leftJoin(products, eq(scanSessions.matchedProductId, products.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(
      and(eq(scanSessions.id, id), eq(scanSessions.userId, guard.data.userId))
    );

  if (!row) return err("Session not found");
  return ok({ ...row.session, productName: row.productName, brandName: row.brandName });
}

/**
 * Create a web-initiated scan session (no station).
 * Used when the user starts an add-item flow from the web UI
 * and wants to use their phone for barcode scanning or photos.
 */
export async function createWebSession() {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const [session] = await db
    .insert(scanSessions)
    .values({
      userId: guard.data.userId,
      status: "active",
    })
    .returning();

  return ok(session);
}

export async function abandonSession(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const [session] = await db
    .select()
    .from(scanSessions)
    .where(
      and(
        eq(scanSessions.id, id),
        eq(scanSessions.userId, guard.data.userId),
        eq(scanSessions.status, "active")
      )
    );

  if (!session) return err("Active session not found");

  await db
    .update(scanSessions)
    .set({ status: "abandoned", updatedAt: new Date() })
    .where(eq(scanSessions.id, id));

  return ok({ abandoned: true });
}

export async function deleteSession(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const [session] = await db
    .select()
    .from(scanSessions)
    .where(
      and(
        eq(scanSessions.id, id),
        eq(scanSessions.userId, guard.data.userId)
      )
    );

  if (!session) return err("Session not found");

  // Clean up scan events first (FK constraint)
  await db.delete(scanEvents).where(eq(scanEvents.sessionId, id));
  await db.delete(scanSessions).where(eq(scanSessions.id, id));

  return ok({ deleted: true });
}

// ── Recent Scans ──────────────────────────────────────────────────────────────

export async function listMyRecentScans(limit = 20) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const rows = await db
    .select()
    .from(scanEvents)
    .where(eq(scanEvents.userId, guard.data.userId))
    .orderBy(desc(scanEvents.createdAt))
    .limit(limit);

  return ok(rows);
}

export async function getScanEvent(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const [row] = await db
    .select()
    .from(scanEvents)
    .where(
      and(eq(scanEvents.id, id), eq(scanEvents.userId, guard.data.userId))
    );

  if (!row) return err("Scan event not found");
  return ok(row);
}

// ── Product Lookup ────────────────────────────────────────────────────────────

export async function lookupProductByBarcode(barcode: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  // Check SKU mappings first
  const [skuMatch] = await db
    .select({
      product: products,
      brand: brands,
    })
    .from(skuMappings)
    .innerJoin(products, eq(skuMappings.productId, products.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(
      or(
        eq(skuMappings.barcode, barcode),
        eq(skuMappings.gtin, barcode),
        eq(skuMappings.sku, barcode)
      )
    );

  if (skuMatch) {
    return ok({ match: "sku_mapping" as const, ...skuMatch });
  }

  // Check product-level barcodes
  const [productMatch] = await db
    .select({
      product: products,
      brand: brands,
    })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(
      or(
        eq(products.packageBarcode, barcode),
        eq(products.gtin, barcode)
      )
    );

  if (productMatch) {
    return ok({ match: "product" as const, ...productMatch });
  }

  return ok(null);
}

export async function searchProducts(query: string, limit = 10) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const rows = await db
    .select({
      product: products,
      brand: brands,
    })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(materials, eq(products.materialId, materials.id))
    .where(
      or(
        ilike(products.name, `%${query}%`),
        ilike(products.colorName, `%${query}%`),
        ilike(products.colorHex, `%${query}%`),
        ilike(brands.name, `%${query}%`),
        ilike(materials.name, `%${query}%`),
        ilike(materials.abbreviation, `%${query}%`),
        ilike(products.bambuVariantId, `%${query}%`),
        ilike(products.bambuMaterialId, `%${query}%`),
        ilike(products.description, `%${query}%`),
      )
    )
    .orderBy(products.name)
    .limit(limit);

  return ok(rows);
}

// ── Intake (create user item from scan) ───────────────────────────────────────

export async function createIntakeItem(input: {
  productId?: string;
  packageType?: string;
  scanEventId?: string;
  sessionId?: string;
  slotId?: string;
  barcodeValue?: string;
  barcodeFormat?: string;
  nfcUid?: string;
  nfcTagFormat?: string;
  nfcTagWritten?: boolean;
  bambuTrayUid?: string;
  initialWeightG?: number;
  netFilamentWeightG?: number;
  spoolWeightG?: number;
  // Station sensor measurements
  measuredColorHex?: string;
  measuredColorLabL?: number;
  measuredColorLabA?: number;
  measuredColorLabB?: number;
  measuredSpectralData?: any;
  measuredSpoolOuterDiameterMm?: number;
  measuredSpoolInnerDiameterMm?: number;
  measuredSpoolWidthMm?: number;
  measuredSpoolHubHoleDiameterMm?: number;
  measuredSpoolWeightG?: number;
  // Purchase info
  purchasePrice?: number;
  purchaseCurrency?: string;
  purchasedAt?: string;
  productionDate?: string;
  lotNumber?: string;
  serialNumber?: string;
  rating?: number;
  notes?: string;
  storageLocation?: string;
}) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  try {
    const [item] = await db
      .insert(userItems)
      .values({
        userId: guard.data.userId,
        productId: input.productId ?? null,
        packageType: (input.packageType as any) ?? null,
        intakeScanEventId: input.scanEventId ?? null,
        currentSlotId: input.slotId ?? null,
        barcodeValue: input.barcodeValue ?? null,
        barcodeFormat: input.barcodeFormat ?? null,
        nfcUid: input.nfcUid ?? null,
        nfcTagFormat: input.nfcTagFormat as any ?? null,
        nfcTagWritten: input.nfcTagWritten ?? false,
        bambuTrayUid: input.bambuTrayUid ?? null,
        initialWeightG: input.initialWeightG ?? null,
        currentWeightG: input.initialWeightG ?? null,
        netFilamentWeightG: input.netFilamentWeightG ?? null,
        spoolWeightG: input.spoolWeightG ?? null,
        // Station sensor data
        measuredColorHex: input.measuredColorHex ?? null,
        measuredColorLabL: input.measuredColorLabL ?? null,
        measuredColorLabA: input.measuredColorLabA ?? null,
        measuredColorLabB: input.measuredColorLabB ?? null,
        measuredSpectralData: input.measuredSpectralData ?? null,
        measuredSpoolOuterDiameterMm: input.measuredSpoolOuterDiameterMm ?? null,
        measuredSpoolInnerDiameterMm: input.measuredSpoolInnerDiameterMm ?? null,
        measuredSpoolWidthMm: input.measuredSpoolWidthMm ?? null,
        measuredSpoolHubHoleDiameterMm: input.measuredSpoolHubHoleDiameterMm ?? null,
        measuredSpoolWeightG: input.measuredSpoolWeightG ?? null,
        storageLocation: input.storageLocation ?? null,
        // Purchase info
        purchasePrice: input.purchasePrice ?? null,
        purchaseCurrency: input.purchaseCurrency ?? null,
        purchasedAt: input.purchasedAt ? new Date(input.purchasedAt) : null,
        productionDate: input.productionDate ?? null,
        lotNumber: input.lotNumber ?? null,
        serialNumber: input.serialNumber ?? null,
        rating: input.rating ?? null,
        notes: input.notes ?? null,
        status: "active",
      })
      .returning();

    // If scan event exists, link it and mark as user-confirmed
    if (input.scanEventId) {
      await db
        .update(scanEvents)
        .set({
          identifiedUserItemId: item.id,
          identified: true,
          identifiedType: "user_item",
          identifiedProductId: input.productId ?? null,
          userConfirmed: true,
          // Also store barcode if phone scanned one
          barcodeValue: input.barcodeValue ?? undefined,
          barcodeFormat: input.barcodeFormat ?? undefined,
        })
        .where(eq(scanEvents.id, input.scanEventId));
    }

    // Resolve the session if one was provided
    if (input.sessionId) {
      await db
        .update(scanSessions)
        .set({
          status: "resolved",
          resolvedUserItemId: item.id,
          resolvedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(scanSessions.id, input.sessionId));
    }

    return ok(item);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Move item to a different slot ────────────────────────────────────────────

export async function moveItemToSlot(itemId: string, newSlotId: string | null) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const [item] = await db.select().from(userItems)
    .where(and(eq(userItems.id, itemId), eq(userItems.userId, guard.data.userId)));
  if (!item) return err("Item not found");

  await db.update(userItems)
    .set({ currentSlotId: newSlotId, updatedAt: new Date() })
    .where(eq(userItems.id, itemId));

  return ok({ moved: true });
}

export async function removeItemFromSlot(slotId: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  await db.update(userItems)
    .set({ currentSlotId: null, updatedAt: new Date() })
    .where(and(eq(userItems.currentSlotId, slotId), eq(userItems.userId, guard.data.userId)));

  return ok({ removed: true });
}

// ── Storage Location Tree ─────────────────────────────────────────────────────

export async function getStorageTree() {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const zoneRows = await db
    .select()
    .from(zones)
    .where(eq(zones.userId, guard.data.userId))
    .orderBy(zones.name);

  const tree = await Promise.all(
    zoneRows.map(async (zone) => {
      const rackRows = await db
        .select()
        .from(racks)
        .where(eq(racks.zoneId, zone.id))
        .orderBy(racks.position);

      const racksWithShelves = await Promise.all(
        rackRows.map(async (rack) => {
          const shelfRows = await db
            .select()
            .from(shelves)
            .where(eq(shelves.rackId, rack.id))
            .orderBy(shelves.position);

          const shelvesWithBays = await Promise.all(
            shelfRows.map(async (shelf) => {
              const bayRows = await db
                .select()
                .from(bays)
                .where(eq(bays.shelfId, shelf.id))
                .orderBy(bays.position);

              const baysWithSlots = await Promise.all(
                bayRows.map(async (bay) => {
                  const slotRows = await db
                    .select({
                      slot: slots,
                      status: slotStatus,
                      itemId: userItems.id,
                      itemColorHex: userItems.measuredColorHex,
                      itemNfcUid: userItems.nfcUid,
                      itemWeightG: userItems.currentWeightG,
                      itemInitialWeightG: userItems.initialWeightG,
                      itemPercentRemaining: userItems.percentRemaining,
                      itemPackageType: userItems.packageType,
                      productName: products.name,
                      brandName: brands.name,
                    })
                    .from(slots)
                    .leftJoin(slotStatus, eq(slotStatus.slotId, slots.id))
                    .leftJoin(userItems, and(
                      eq(userItems.currentSlotId, slots.id),
                      eq(userItems.status, "active")
                    ))
                    .leftJoin(products, eq(userItems.productId, products.id))
                    .leftJoin(brands, eq(products.brandId, brands.id))
                    .where(eq(slots.bayId, bay.id))
                    .orderBy(slots.position);

                  const slotsWithStatus = slotRows.map((r) => ({
                    ...r.slot,
                    status: r.status ? {
                      state: r.itemId ? "active" : (r.status.state ?? "empty"),
                      nfcUid: r.status.nfcUid ?? r.itemNfcUid ?? null,
                      weightStableG: r.status.weightStableG ?? r.itemWeightG,
                      percentRemaining: r.status.percentRemaining ?? r.itemPercentRemaining,
                      colorHex: r.itemColorHex,
                      productName: r.productName,
                      brandName: r.brandName,
                      packageType: r.itemPackageType,
                      initialWeightG: r.itemInitialWeightG,
                    } : r.itemId ? {
                      state: "active",
                      nfcUid: r.itemNfcUid,
                      colorHex: r.itemColorHex,
                      weightStableG: r.itemWeightG,
                      percentRemaining: r.itemPercentRemaining,
                      productName: r.productName,
                      brandName: r.brandName,
                      packageType: r.itemPackageType,
                      initialWeightG: r.itemInitialWeightG,
                    } : null,
                  }));

                  return { ...bay, slots: slotsWithStatus };
                })
              );

              return { ...shelf, bays: baysWithSlots };
            })
          );

          return { ...rack, shelves: shelvesWithBays };
        })
      );

      return { ...zone, racks: racksWithShelves };
    })
  );

  return ok(tree);
}

// ── Available Slots (flat list for quick picker) ──────────────────────────────

// ── Environmental Data ───────────────────────────────────────────────────────

export async function getStationEnvironment(stationId: string, hours = 24) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  // Verify ownership
  const [station] = await db
    .select({ id: scanStations.id })
    .from(scanStations)
    .where(
      and(
        eq(scanStations.id, stationId),
        eq(scanStations.userId, guard.data.userId)
      )
    );

  if (!station) return err("Station not found");

  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const readings = await db
    .select({
      temperatureC: environmentalReadings.temperatureC,
      humidity: environmentalReadings.humidity,
      pressureHPa: environmentalReadings.pressureHPa,
      createdAt: environmentalReadings.createdAt,
    })
    .from(environmentalReadings)
    .where(
      and(
        eq(environmentalReadings.stationId, stationId),
        gte(environmentalReadings.createdAt, since)
      )
    )
    .orderBy(environmentalReadings.createdAt)
    .limit(1000);

  return ok(readings);
}

export async function getAvailableSlots() {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;

  const rows = await db
    .select({
      slot: slots,
      bay: bays,
      shelf: shelves,
      rack: racks,
      zone: zones,
      // Check occupancy: left join user_items on currentSlotId
      itemId: userItems.id,
      itemColorHex: userItems.measuredColorHex,
    })
    .from(slots)
    .innerJoin(bays, eq(slots.bayId, bays.id))
    .innerJoin(shelves, eq(bays.shelfId, shelves.id))
    .innerJoin(racks, eq(shelves.rackId, racks.id))
    .innerJoin(zones, eq(racks.zoneId, zones.id))
    .leftJoin(userItems, and(eq(userItems.currentSlotId, slots.id), eq(userItems.status, "active")))
    .where(eq(zones.userId, guard.data.userId))
    .orderBy(zones.name, racks.position, shelves.position, bays.position, slots.position);

  return ok(
    rows.map((r) => ({
      id: r.slot.id,
      address: r.slot.address ?? `${r.zone.name}-${r.rack.name}-S${r.shelf.position}-B${r.bay.position}-${r.slot.position}`,
      label: r.slot.label,
      zoneName: r.zone.name,
      rackName: r.rack.name,
      shelfPosition: r.shelf.position,
      bayPosition: r.bay.position,
      slotPosition: r.slot.position,
      occupied: !!r.itemId,
      itemColorHex: r.itemColorHex,
    }))
  );
}
