import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scanStations, scanEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApiKeyAuth } from "@/lib/actions/auth";

/**
 * POST /api/v1/scan
 *
 * Receives sensor data from a scan station (ESP32) and creates a scan event.
 * Authenticates via X-API-Key header.
 *
 * Returns identification result (or scanId for polling).
 */
export async function POST(request: NextRequest) {
  // Auth
  const auth = await getApiKeyAuth();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  // Find or register scan station
  let [station] = await db
    .select()
    .from(scanStations)
    .where(eq(scanStations.hardwareId, hardwareId));

  if (!station) {
    // Auto-register new station
    [station] = await db
      .insert(scanStations)
      .values({
        userId: auth.userId,
        name: `Scan Station ${hardwareId}`,
        hardwareId,
      })
      .returning();
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
      userId: auth.userId,
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

  // TODO: Run identification pipeline
  // 1. NFC tag present? → Parse format → Lookup in catalog
  // 2. Weight + height + color → Query filaments/inventory
  // 3. No match → Return needsCamera or unidentified

  // For now: return the scan event with identification pending
  const response = {
    scanId: scanEvent.id,
    identified: false,
    confidence: 0,
    itemType: null,
    itemName: null,
    suggestion: null,
    needsCamera: true,
  };

  // Quick check: if NFC tag data present, try to identify
  if (body.nfc?.present && body.nfc?.rawData) {
    // TODO: Parse NFC tag server-side (port Bambu parser to TypeScript)
    // For now just mark as needing further processing
    response.needsCamera = false;
  }

  return NextResponse.json(response, { status: 201 });
}
