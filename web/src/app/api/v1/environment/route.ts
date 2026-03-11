import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scanStations } from "@/db/schema/scan-stations";
import { environmentalReadings } from "@/db/schema/events";
import { eq, and, isNotNull, gte } from "drizzle-orm";

/**
 * POST /api/v1/environment
 * Body: { temperatureC, humidity, pressureHPa }
 * Headers: X-Device-Token
 *
 * Called periodically by devices to report environmental readings.
 */
export async function POST(request: NextRequest) {
  const deviceToken = request.headers.get("x-device-token");
  if (!deviceToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [station] = await db
    .select({ id: scanStations.id })
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

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { temperatureC, humidity, pressureHPa } = body;

  await db.insert(environmentalReadings).values({
    stationId: station.id,
    temperatureC: temperatureC ?? null,
    humidity: humidity ?? null,
    pressureHPa: pressureHPa ?? null,
  });

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/v1/environment?stationId=xxx&hours=24
 *
 * Returns environmental readings for strip charting.
 * Requires authenticated user session.
 */
export async function GET(request: NextRequest) {
  const stationId = request.nextUrl.searchParams.get("stationId");
  const hours = parseInt(request.nextUrl.searchParams.get("hours") ?? "24");

  if (!stationId) {
    return NextResponse.json({ error: "stationId required" }, { status: 400 });
  }

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

  return NextResponse.json({ readings });
}
