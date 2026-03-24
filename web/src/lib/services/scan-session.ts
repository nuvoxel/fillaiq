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
  // Abandon any existing active session on this station —
  // each scan button press is a new session.
  await db
    .update(scanSessions)
    .set({ status: "abandoned", updatedAt: new Date() })
    .where(
      and(
        eq(scanSessions.stationId, stationId),
        eq(scanSessions.status, "active")
      )
    );

  // Create new session
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
