import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { environmentalReadings } from "@/db/schema/events";
import { eq, and, gte } from "drizzle-orm";

/**
 * GET /api/v1/environment?stationId=xxx&hours=24
 *
 * Returns environmental readings for strip charting.
 * POST removed — env data now arrives via MQTT.
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
