import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { db } from "@/db";
import { scanStations } from "@/db/schema";
import { eq, and, gt, isNull } from "drizzle-orm";
import { getSession } from "@/lib/actions/auth";

const PAIRING_CODE_LENGTH = 6;
const PAIRING_EXPIRY_MINUTES = 15;

function generatePairingCode(): string {
  // 6-char uppercase alphanumeric, no ambiguous chars (0/O, 1/I/L)
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(PAIRING_CODE_LENGTH);
  return Array.from(bytes)
    .map((b) => chars[b % chars.length])
    .join("");
}

/**
 * POST /api/v1/devices/pair
 *
 * Called by the scan station after WiFi connect.
 * Body: { hardwareId: "scan-A2B3C4" }
 * Returns: { pairingCode: "X3F7K2", deviceToken: "..." }
 *
 * No auth required — this is the device's first contact.
 */
export async function POST(request: NextRequest) {
  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { hardwareId, sku, firmwareVersion, firmwareChannel, capabilities } = body;
  if (!hardwareId || typeof hardwareId !== "string") {
    return NextResponse.json(
      { error: "hardwareId is required" },
      { status: 400 }
    );
  }

  const deviceToken = randomBytes(32).toString("hex");
  const pairingCode = generatePairingCode();
  const expiresAt = new Date(Date.now() + PAIRING_EXPIRY_MINUTES * 60 * 1000);

  // Check if station already exists
  const [existing] = await db
    .select()
    .from(scanStations)
    .where(eq(scanStations.hardwareId, hardwareId));

  // Extract boolean flags from rich capabilities manifest
  const capFlags = {
    hasTofSensor: !!capabilities?.tof?.detected,
    hasColorSensor: !!capabilities?.colorSensor?.detected,
    hasTurntable: !!capabilities?.turntable,
    hasCamera: !!capabilities?.camera,
  };

  if (existing) {
    // Device exists — issue new token + pairing code regardless of
    // current pairing state. If the device already has a userId, this
    // is a re-pair (e.g. token lost). The user must approve the new
    // code on the dashboard before the device is considered paired.
    await db
      .update(scanStations)
      .set({
        deviceToken,
        pairingCode,
        pairingExpiresAt: expiresAt,
        userId: null, // Clear ownership until user re-approves
        deviceSku: sku || existing.deviceSku,
        firmwareVersion: firmwareVersion || existing.firmwareVersion,
        firmwareChannel: firmwareChannel || existing.firmwareChannel,
        ...capFlags,
        config: capabilities ? { capabilities } : existing.config,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scanStations.id, existing.id));
  } else {
    // New station — create unpaired record
    const deviceName = sku
      ? `${sku.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())} ${hardwareId}`
      : `Scan Station ${hardwareId}`;
    await db.insert(scanStations).values({
      name: deviceName,
      hardwareId,
      deviceSku: sku || "scan-station",
      firmwareVersion: firmwareVersion || null,
      firmwareChannel: firmwareChannel || "stable",
      ...capFlags,
      config: capabilities ? { capabilities } : null,
      deviceToken,
      pairingCode,
      pairingExpiresAt: expiresAt,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
      lastSeenAt: new Date(),
    });
  }

  return NextResponse.json({
    paired: false,
    pairingCode,
    deviceToken,
    expiresInSeconds: PAIRING_EXPIRY_MINUTES * 60,
  });
}

/**
 * GET /api/v1/devices/pair?token=<deviceToken>
 *
 * Called by the scan station to poll pairing status.
 * Returns: { paired: true/false }
 */
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (!token) {
    return NextResponse.json(
      { error: "token parameter required" },
      { status: 400 }
    );
  }

  const [station] = await db
    .select()
    .from(scanStations)
    .where(eq(scanStations.deviceToken, token));

  if (!station) {
    return NextResponse.json({ error: "Invalid token" }, { status: 404 });
  }

  // Update last seen
  await db
    .update(scanStations)
    .set({ lastSeenAt: new Date(), isOnline: true, updatedAt: new Date() })
    .where(eq(scanStations.id, station.id));

  if (station.userId) {
    return NextResponse.json({ paired: true, stationId: station.id });
  }

  // Check if pairing code expired
  if (
    station.pairingExpiresAt &&
    new Date() > new Date(station.pairingExpiresAt)
  ) {
    return NextResponse.json({ paired: false, expired: true });
  }

  return NextResponse.json({ paired: false });
}
