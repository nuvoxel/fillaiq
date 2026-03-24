/**
 * Scan processing service — extracted from POST /api/v1/scan.
 * Processes raw sensor data into a scan event, runs NFC parsing,
 * color conversion, session management, and catalog matching.
 */

import { db } from "@/db";
import { scanStations, scanEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { parseNfcRawData, type BambuParsedData } from "./nfc-parser";
import { spectralToColor } from "./color-converter";
import {
  findOrCreateSession,
  updateSessionAggregates,
  matchSession,
} from "./scan-session";

export type ScanInput = {
  weight?: { grams: number; stable: boolean };
  height?: { objectHeightMm: number; distanceMm: number };
  color?: Record<string, any>;
  nfc?: {
    present: boolean;
    uid?: string;
    uidLength?: number;
    tagType?: number;
    rawData?: string;
    sectorsRead?: number;
    sectorOk?: number;
    pagesRead?: number;
  };
  turntableAngle?: number;
  correlationId?: number;
};

export type ScanResult = {
  scanId: string;
  sessionId: string;
  identified: boolean;
  confidence: number;
  matchMethod: string | null;
  matchedProductId: string | null;
  itemType: string | null;
  itemName: string | null;
  suggestion: string | null;
  needsCamera: boolean;
  nfcTagFormat: string | null;
  nfcParsedData: any;
  colorHex: string | null;
  material: string | null;
  colorR: number | null;
  colorG: number | null;
  colorB: number | null;
  nozzleTempMin: number | null;
  nozzleTempMax: number | null;
  bedTemp: number | null;
  correlationId?: number;
};

/**
 * Process scan data from a device. Creates scan event, runs NFC/color processing,
 * manages session, runs catalog matcher, and returns identification result.
 */
export async function processScan(
  stationId: string,
  userId: string | null,
  input: ScanInput
): Promise<ScanResult> {
  // Create scan event from sensor data
  const [scanEvent] = await db
    .insert(scanEvents)
    .values({
      stationId,
      userId,
      weightG: input.weight?.grams ?? null,
      weightStable: input.weight?.stable ?? null,
      heightMm: input.height?.objectHeightMm ?? null,
      distanceMm: input.height?.distanceMm ?? null,
      spectralData: input.color ?? null,
      nfcPresent: input.nfc?.present ?? false,
      nfcUid: input.nfc?.uid ?? null,
      nfcUidLength: input.nfc?.uidLength ?? null,
      nfcTagType: input.nfc?.tagType ?? null,
      nfcRawData: input.nfc?.rawData ?? null,
      nfcSectorsRead: input.nfc?.sectorsRead ?? null,
      nfcPagesRead: input.nfc?.pagesRead ?? null,
      turntableAngle: input.turntableAngle ?? null,
    })
    .returning();

  // Server-side processing
  const updates: Record<string, any> = {};

  // 1. Parse NFC raw data
  if (input.nfc?.rawData) {
    const { format, parsed } = parseNfcRawData(
      input.nfc.rawData,
      input.nfc.tagType ?? null,
      input.nfc.sectorsRead ?? null,
      input.nfc.pagesRead ?? null,
      input.nfc.sectorOk ?? null,
    );
    updates.nfcTagFormat = format;
    if (parsed) updates.nfcParsedData = parsed;
  }

  // 2. Convert spectral data to color
  if (input.color) {
    const color = spectralToColor(input.color);
    if (color) {
      updates.colorHex = color.hex;
      updates.colorLabL = color.labL;
      updates.colorLabA = color.labA;
      updates.colorLabB = color.labB;
    }
  }

  // Apply updates
  if (Object.keys(updates).length > 0) {
    await db
      .update(scanEvents)
      .set(updates)
      .where(eq(scanEvents.id, scanEvent.id));
  }

  // Re-fetch with updates
  const [updatedScanEvent] = await db
    .select()
    .from(scanEvents)
    .where(eq(scanEvents.id, scanEvent.id));

  // Session management
  let session = await findOrCreateSession(
    stationId,
    userId,
    updatedScanEvent,
    true
  );

  await db
    .update(scanEvents)
    .set({ sessionId: session.id })
    .where(eq(scanEvents.id, scanEvent.id));

  session = await updateSessionAggregates(session, updatedScanEvent);
  session = await matchSession(session);

  // Build result
  const parsed = updates.nfcParsedData as BambuParsedData | null | undefined;

  return {
    scanId: scanEvent.id,
    sessionId: session.id,
    identified: !!session.matchedProductId,
    confidence: session.matchConfidence ?? 0,
    matchMethod: session.matchMethod ?? null,
    matchedProductId: session.matchedProductId ?? null,
    itemType: null,
    itemName: parsed?.name ?? null,
    suggestion: null,
    needsCamera: !input.nfc?.rawData,
    nfcTagFormat: updates.nfcTagFormat ?? null,
    nfcParsedData: updates.nfcParsedData ?? null,
    colorHex: updates.colorHex ?? parsed?.colorHex ?? null,
    material: parsed?.material ?? null,
    colorR: parsed?.colorR ?? null,
    colorG: parsed?.colorG ?? null,
    colorB: parsed?.colorB ?? null,
    nozzleTempMin: parsed?.nozzleTempMin ?? null,
    nozzleTempMax: parsed?.nozzleTempMax ?? null,
    bedTemp: parsed?.bedTemp ?? null,
    correlationId: input.correlationId,
  };
}
