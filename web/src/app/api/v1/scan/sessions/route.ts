import { NextResponse } from "next/server";
import { db } from "@/db";
import { scanSessions, scanStations } from "@/db/schema/scan-stations";
import { eq, ne, desc, and, gte, inArray } from "drizzle-orm";
import { getSession } from "@/lib/actions/auth";

/**
 * GET /api/v1/scan/sessions
 *
 * Authenticated endpoint — returns recent scan sessions for the user's stations.
 * Returns sessions from the last 24h, capped at 50.
 */
export async function GET() {
  const ctx = await getSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Get the user's scan stations
  const stations = await db
    .select({ id: scanStations.id })
    .from(scanStations)
    .where(eq(scanStations.userId, ctx.userId));

  if (stations.length === 0) {
    return NextResponse.json([]);
  }

  const stationIds = stations.map((s) => s.id);
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const sessions = await db
    .select({
      id: scanSessions.id,
      stationId: scanSessions.stationId,
      status: scanSessions.status,
      bestWeightG: scanSessions.bestWeightG,
      bestHeightMm: scanSessions.bestHeightMm,
      bestColorHex: scanSessions.bestColorHex,
      nfcUid: scanSessions.nfcUid,
      nfcTagFormat: scanSessions.nfcTagFormat,
      nfcParsedData: scanSessions.nfcParsedData,
      matchedProductId: scanSessions.matchedProductId,
      matchConfidence: scanSessions.matchConfidence,
      matchMethod: scanSessions.matchMethod,
      createdAt: scanSessions.createdAt,
      updatedAt: scanSessions.updatedAt,
    })
    .from(scanSessions)
    .where(
      and(
        inArray(scanSessions.stationId, stationIds),
        gte(scanSessions.createdAt, twentyFourHoursAgo),
        ne(scanSessions.status, "abandoned")
      )
    )
    .orderBy(desc(scanSessions.createdAt))
    .limit(50);

  return NextResponse.json(sessions);
}
