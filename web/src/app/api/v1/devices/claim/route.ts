import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scanStations } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { getSession } from "@/lib/actions/auth";

/**
 * POST /api/v1/devices/claim
 *
 * Called by the web app (authenticated user) to claim a device.
 * Body: { pairingCode: "X3F7K2" }
 */
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const code = (body.pairingCode ?? "").toString().toUpperCase().trim();
  if (!code || code.length < 4) {
    return NextResponse.json(
      { error: "Invalid pairing code" },
      { status: 400 }
    );
  }

  // Find unpaired station with this code that hasn't expired
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
    return NextResponse.json(
      { error: "Invalid or expired pairing code" },
      { status: 404 }
    );
  }

  // Claim the device
  await db
    .update(scanStations)
    .set({
      userId: session.userId,
      pairingCode: null,
      pairingExpiresAt: null,
      updatedAt: new Date(),
    })
    .where(eq(scanStations.id, station.id));

  // Notify device via MQTT that pairing is confirmed
  const { publishPairStatus } = await import("@/lib/mqtt/publisher");
  publishPairStatus(station.hardwareId, {
    paired: true,
    stationId: station.id,
  });

  return NextResponse.json({
    success: true,
    station: {
      id: station.id,
      name: station.name,
      hardwareId: station.hardwareId,
    },
  });
}
