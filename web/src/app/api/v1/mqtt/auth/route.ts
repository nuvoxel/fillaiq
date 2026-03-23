import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scanStations } from "@/db/schema";
import { eq, isNotNull } from "drizzle-orm";
import { createHash } from "crypto";

/**
 * POST /api/v1/mqtt/auth
 *
 * Mosquitto go-auth HTTP backend: validate device credentials on MQTT connect.
 * Username = deviceToken, Password = deviceSecret (optional).
 * Returns 200 (allow) or 403 (deny).
 */
export async function POST(request: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 403 });
  }

  const { username, password } = body;

  if (!username) {
    return new Response(null, { status: 403 });
  }

  // Look up station by device token
  const [station] = await db
    .select({
      id: scanStations.id,
      hardwareId: scanStations.hardwareId,
      deviceSecret: scanStations.deviceSecret,
      userId: scanStations.userId,
    })
    .from(scanStations)
    .where(eq(scanStations.deviceToken, username));

  if (!station) {
    return new Response(null, { status: 403 });
  }

  // Validate device secret if both sides have one
  if (station.deviceSecret && password) {
    const secretHash = createHash("sha256").update(password).digest("hex");
    if (station.deviceSecret !== secretHash) {
      return new Response(null, { status: 403 });
    }
  }

  return new Response(null, { status: 200 });
}
