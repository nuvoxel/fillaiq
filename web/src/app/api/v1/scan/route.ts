import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/db";
import { scanStations, scanEvents } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { getApiKeyAuth } from "@/lib/actions/auth";
import { parseNfcRawData, type BambuParsedData } from "@/lib/services/nfc-parser";
import { spectralToColor } from "@/lib/services/color-converter";
import {
  findOrCreateSession,
  updateSessionAggregates,
  matchSession,
} from "@/lib/services/scan-session";

/**
 * POST /api/v1/scan
 *
 * Receives sensor data from a scan station (ESP32) and creates a scan event.
 * Authenticates via X-Device-Token header (from pairing) or X-API-Key.
 * Optionally verifies hardware identity via X-Device-Secret header.
 *
 * Returns identification result (or scanId for polling).
 */
export async function POST(request: NextRequest) {
  // Try device token auth first
  const deviceToken = request.headers.get("x-device-token");
  let station: typeof scanStations.$inferSelect | undefined;
  let userId: string | null = null;

  if (deviceToken) {
    const [found] = await db
      .select()
      .from(scanStations)
      .where(
        and(
          eq(scanStations.deviceToken, deviceToken),
          isNotNull(scanStations.userId)
        )
      );
    if (!found) {
      return NextResponse.json(
        { error: "Invalid token or device not paired" },
        { status: 401 }
      );
    }

    // Verify hardware identity if device sends it and server has it stored
    const deviceSecret = request.headers.get("x-device-secret");
    if (found.deviceSecret && deviceSecret) {
      const secretHash = createHash("sha256").update(deviceSecret).digest("hex");
      if (found.deviceSecret !== secretHash) {
        return NextResponse.json(
          { error: "Device identity mismatch" },
          { status: 403 }
        );
      }
    }

    station = found;
    userId = found.userId;
  } else {
    // Fallback to API key auth
    const auth = await getApiKeyAuth();
    if (!auth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = auth.userId;
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { stationId: hardwareId } = body;
  if (!hardwareId) {
    return NextResponse.json(
      { error: "stationId is required" },
      { status: 400 }
    );
  }

  // Find station if not already found via token
  if (!station) {
    const [found] = await db
      .select()
      .from(scanStations)
      .where(eq(scanStations.hardwareId, hardwareId));
    station = found;

    if (!station) {
      // Auto-register (legacy API key flow)
      [station] = await db
        .insert(scanStations)
        .values({
          userId,
          name: `Scan Station ${hardwareId}`,
          hardwareId,
        })
        .returning();
    }
  }

  // Update station last seen
  await db
    .update(scanStations)
    .set({
      lastSeenAt: new Date(),
      isOnline: true,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
      updatedAt: new Date(),
    })
    .where(eq(scanStations.id, station.id));

  // Create scan event from sensor data
  const [scanEvent] = await db
    .insert(scanEvents)
    .values({
      stationId: station.id,
      userId,
      // Weight
      weightG: body.weight?.grams ?? null,
      weightStable: body.weight?.stable ?? null,
      // Height
      heightMm: body.height?.objectHeightMm ?? null,
      distanceMm: body.height?.distanceMm ?? null,
      // Color
      spectralData: body.color ?? null,
      // NFC
      nfcPresent: body.nfc?.present ?? false,
      nfcUid: body.nfc?.uid ?? null,
      nfcUidLength: body.nfc?.uidLength ?? null,
      nfcTagType: body.nfc?.tagType ?? null,
      nfcRawData: body.nfc?.rawData ?? null,
      nfcSectorsRead: body.nfc?.sectorsRead ?? null,
      nfcPagesRead: body.nfc?.pagesRead ?? null,
      // Turntable
      turntableAngle: body.turntableAngle ?? null,
    })
    .returning();

  // ── Server-side processing ─────────────────────────────────────────────

  const updates: Record<string, any> = {};

  // 1. Parse NFC raw data if present
  if (body.nfc?.rawData) {
    const { format, parsed } = parseNfcRawData(
      body.nfc.rawData,
      body.nfc.tagType ?? null,
      body.nfc.sectorsRead ?? null,
      body.nfc.pagesRead ?? null
    );
    updates.nfcTagFormat = format;
    if (parsed) {
      updates.nfcParsedData = parsed;
    }
  }

  // 2. Convert spectral data to color hex + Lab
  if (body.color) {
    const color = spectralToColor(body.color);
    if (color) {
      updates.colorHex = color.hex;
      updates.colorLabL = color.labL;
      updates.colorLabA = color.labA;
      updates.colorLabB = color.labB;
    }
  }

  // Apply updates if any processing produced results
  if (Object.keys(updates).length > 0) {
    await db
      .update(scanEvents)
      .set(updates)
      .where(eq(scanEvents.id, scanEvent.id));
  }

  // Re-fetch scan event with updates applied
  const [updatedScanEvent] = await db
    .select()
    .from(scanEvents)
    .where(eq(scanEvents.id, scanEvent.id));

  // ── Session management ──────────────────────────────────────────────────

  let session = await findOrCreateSession(station.id, userId, updatedScanEvent);

  // Link scan event to session
  await db
    .update(scanEvents)
    .set({ sessionId: session.id })
    .where(eq(scanEvents.id, scanEvent.id));

  // Merge sensor data into session aggregates
  session = await updateSessionAggregates(session, updatedScanEvent);

  // Run catalog matcher
  session = await matchSession(session);

  // Build response — flatten display-relevant fields for firmware TFT
  const parsed = updates.nfcParsedData as BambuParsedData | null | undefined;

  const response = {
    scanId: scanEvent.id,
    sessionId: session.id,
    identified: !!session.matchedProductId,
    confidence: session.matchConfidence ?? 0,
    matchMethod: session.matchMethod ?? null,
    matchedProductId: session.matchedProductId ?? null,
    itemType: null as string | null,
    itemName: parsed?.name ?? null,
    suggestion: null as string | null,
    needsCamera: !body.nfc?.rawData,
    // Include parsed data so firmware can display on TFT
    nfcTagFormat: updates.nfcTagFormat ?? null,
    nfcParsedData: updates.nfcParsedData ?? null,
    colorHex: updates.colorHex ?? parsed?.colorHex ?? null,
    // Flattened display fields from NFC parsed data
    material: parsed?.material ?? null,
    colorR: parsed?.colorR ?? null,
    colorG: parsed?.colorG ?? null,
    colorB: parsed?.colorB ?? null,
    nozzleTempMin: parsed?.nozzleTempMin ?? null,
    nozzleTempMax: parsed?.nozzleTempMax ?? null,
    bedTemp: parsed?.bedTemp ?? null,
  };

  return NextResponse.json(response, { status: 201 });
}
