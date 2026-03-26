/**
 * Scan session management.
 *
 * Multiple scans from the same station within a time window accumulate into
 * a single session. Sessions track the best values from each sensor and
 * attempt to match against the product catalog.
 */

import { db } from "@/db";
import {
  scanSessions,
  scanEvents,
} from "@/db/schema/scan-stations";
import { products } from "@/db/schema/central-catalog";
import { eq, and, desc, gte } from "drizzle-orm";
import { matchToCatalog } from "./catalog-matcher";

const SESSION_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

type ScanEvent = typeof scanEvents.$inferSelect;
type ScanSession = typeof scanSessions.$inferSelect;

/**
 * Find an active session on the same station, or create a new one.
 * If the NFC UID changed, the old session is abandoned.
 */
export async function findOrCreateSession(
  stationId: string,
  userId: string | null,
  scanEvent: ScanEvent,
  forceNew = false
): Promise<ScanSession> {
  // Create a new session for each scan — previous sessions stay active
  // until the user adds them to inventory (resolved) or deletes them.
  const [session] = await db
    .insert(scanSessions)
    .values({
      stationId,
      userId,
      status: "active",
    })
    .returning();

  return session;
}

/**
 * Merge scan event data into the session's accumulated best values.
 */
export async function updateSessionAggregates(
  session: ScanSession,
  scanEvent: ScanEvent
): Promise<ScanSession> {
  const updates: Record<string, any> = { updatedAt: new Date() };

  // Weight: prefer latest stable reading
  if (scanEvent.weightG != null && scanEvent.weightStable) {
    updates.bestWeightG = scanEvent.weightG;
  }

  // Height: prefer latest
  if (scanEvent.heightMm != null) {
    updates.bestHeightMm = scanEvent.heightMm;
  }

  // Color: prefer latest with hex
  if (scanEvent.colorHex) {
    updates.bestColorHex = scanEvent.colorHex;
    updates.bestColorLabL = scanEvent.colorLabL;
    updates.bestColorLabA = scanEvent.colorLabA;
    updates.bestColorLabB = scanEvent.colorLabB;
  }

  // Spectral: prefer latest valid
  if (scanEvent.spectralData) {
    updates.bestSpectralData = scanEvent.spectralData;
  }

  // NFC: adopt if session doesn't have one yet
  if (scanEvent.nfcUid && !session.nfcUid) {
    updates.nfcUid = scanEvent.nfcUid;
    updates.nfcTagFormat = scanEvent.nfcTagFormat;
    updates.nfcParsedData = scanEvent.nfcParsedData;
  }

  const [updated] = await db
    .update(scanSessions)
    .set(updates)
    .where(eq(scanSessions.id, session.id))
    .returning();

  return updated;
}

/**
 * Run catalog matching and update the session.
 * If matched, backfill any missing fields on the product from NFC data.
 */
export async function matchSession(session: ScanSession): Promise<ScanSession> {
  const match = await matchToCatalog(session);
  if (!match) return session;

  const [updated] = await db
    .update(scanSessions)
    .set({
      matchedProductId: match.productId,
      matchConfidence: match.confidence,
      matchMethod: match.method,
      updatedAt: new Date(),
    })
    .where(eq(scanSessions.id, session.id))
    .returning();

  // Backfill missing product fields from NFC parsed data
  const parsed = session.nfcParsedData as Record<string, any> | null;
  if (parsed && match.product) {
    const enrichment: Record<string, any> = {};
    const p = match.product;

    if (!p.bambuVariantId && parsed.variantId) enrichment.bambuVariantId = parsed.variantId;
    if (!p.bambuMaterialId && parsed.materialId) enrichment.bambuMaterialId = parsed.materialId;
    if (!p.colorHex && parsed.colorHex) enrichment.colorHex = parsed.colorHex;
    if (!p.colorR && parsed.colorR != null) enrichment.colorR = parsed.colorR;
    if (!p.colorG && parsed.colorG != null) enrichment.colorG = parsed.colorG;
    if (!p.colorB && parsed.colorB != null) enrichment.colorB = parsed.colorB;
    if (!p.colorA && parsed.colorA != null) enrichment.colorA = parsed.colorA;
    if (!p.netWeightG && parsed.spoolNetWeight) enrichment.netWeightG = parsed.spoolNetWeight;

    if (Object.keys(enrichment).length > 0) {
      enrichment.updatedAt = new Date();
      await db
        .update(products)
        .set(enrichment)
        .where(eq(products.id, match.productId));
    }
  }

  return updated;
}

/**
 * Resolve a session by linking it to a user item.
 */
export async function resolveSession(
  sessionId: string,
  userItemId: string
): Promise<void> {
  await db
    .update(scanSessions)
    .set({
      status: "resolved",
      resolvedUserItemId: userItemId,
      resolvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(scanSessions.id, sessionId));
}

/**
 * Link a barcode to an existing session and re-run matching.
 */
export async function addBarcodeToSession(
  sessionId: string,
  barcodeValue: string,
  barcodeFormat: string
): Promise<ScanSession> {
  const [session] = await db
    .update(scanSessions)
    .set({
      barcodeValue,
      barcodeFormat,
      updatedAt: new Date(),
    })
    .where(eq(scanSessions.id, sessionId))
    .returning();

  return matchSession(session);
}
