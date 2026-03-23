import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scanStations } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * POST /api/v1/mqtt/acl
 *
 * Mosquitto go-auth HTTP backend: check topic-level access control.
 * Each device can only:
 *   - Publish to:   fiq/d/{itsOwnHardwareId}/+
 *   - Subscribe to: fiq/s/{itsOwnHardwareId}/#
 *
 * Body: { username, topic, clientid, acc }
 *   acc: 1 = subscribe, 2 = publish, 3 = subscribe+publish, 4 = publish (retained)
 */
export async function POST(request: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await request.json();
  } catch {
    return new Response(null, { status: 403 });
  }

  const { username, topic, acc } = body;

  if (!username || !topic) {
    return new Response(null, { status: 403 });
  }

  // Look up station by device token to get hardwareId
  const [station] = await db
    .select({
      hardwareId: scanStations.hardwareId,
      userId: scanStations.userId,
    })
    .from(scanStations)
    .where(eq(scanStations.deviceToken, username));

  if (!station) {
    return new Response(null, { status: 403 });
  }

  const hwId = station.hardwareId;
  const accNum = parseInt(acc, 10);

  // Parse topic: fiq/{direction}/{hardwareId}/{channel...}
  const parts = topic.split("/");
  if (parts.length < 4 || parts[0] !== "fiq") {
    return new Response(null, { status: 403 });
  }

  const direction = parts[1]; // "d" or "s"
  const topicHwId = parts[2];

  // Device must only access its own topics
  if (topicHwId !== hwId) {
    return new Response(null, { status: 403 });
  }

  // Publishing (acc=2 or 4): only to device-to-server topics (fiq/d/...)
  if ((accNum === 2 || accNum === 4) && direction !== "d") {
    return new Response(null, { status: 403 });
  }

  // Subscribing (acc=1): only to server-to-device topics (fiq/s/...)
  if (accNum === 1 && direction !== "s") {
    return new Response(null, { status: 403 });
  }

  // Unpaired devices (no userId) can only use pair topics
  if (!station.userId) {
    const channel = parts.slice(3).join("/");
    if (!channel.startsWith("pair")) {
      return new Response(null, { status: 403 });
    }
  }

  return new Response(null, { status: 200 });
}
