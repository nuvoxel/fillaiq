import { NextRequest, NextResponse } from "next/server";
import { randomBytes, createHash } from "crypto";
import { db } from "@/db";
import { scanStations } from "@/db/schema";
import { eq } from "drizzle-orm";

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

/** Hash the device secret for storage (we never store the raw secret). */
function hashSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

/**
 * POST /api/v1/devices/pair
 *
 * Called by FillaScan devices after WiFi connect.
 * Body: { hardwareId, sku?, firmwareVersion?, capabilities?, deviceSecret?, efuseId? }
 * Returns: { paired, pairingCode?, deviceToken }
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

  const {
    hardwareId,
    sku,
    firmwareVersion,
    firmwareChannel,
    capabilities,
    deviceSecret,
    efuseId,
  } = body;
  if (!hardwareId || typeof hardwareId !== "string") {
    return NextResponse.json(
      { error: "hardwareId is required" },
      { status: 400 }
    );
  }

  const deviceToken = randomBytes(32).toString("hex");
  const pairingCode = generatePairingCode();
  const expiresAt = new Date(
    Date.now() + PAIRING_EXPIRY_MINUTES * 60 * 1000
  );

  // Hardware identity fields (stored on first contact, verified on subsequent)
  const identityFields: Record<string, any> = {};
  if (deviceSecret && typeof deviceSecret === "string") {
    identityFields.deviceSecret = hashSecret(deviceSecret);
  }
  if (efuseId && typeof efuseId === "string") {
    identityFields.efuseId = efuseId;
  }

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
    // Verify hardware identity if both sides have it
    if (
      existing.deviceSecret &&
      deviceSecret &&
      existing.deviceSecret !== hashSecret(deviceSecret)
    ) {
      // Different physical device claiming the same hardwareId
      return NextResponse.json(
        { error: "Device identity mismatch" },
        { status: 403 }
      );
    }

    const alreadyPaired = !!existing.userId;
    await db
      .update(scanStations)
      .set({
        deviceToken,
        ...(alreadyPaired
          ? {}
          : { pairingCode, pairingExpiresAt: expiresAt }),
        deviceSku: sku || existing.deviceSku,
        firmwareVersion: firmwareVersion || existing.firmwareVersion,
        firmwareChannel: firmwareChannel || existing.firmwareChannel,
        ...capFlags,
        // Store identity on first contact, don't overwrite once set
        ...(existing.deviceSecret ? {} : identityFields),
        config: capabilities ? { capabilities } : existing.config,
        ipAddress:
          request.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
        lastSeenAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(scanStations.id, existing.id));

    if (alreadyPaired) {
      return NextResponse.json({
        paired: true,
        deviceToken,
        stationId: existing.id,
      });
    }
  } else {
    // New station — create unpaired record
    const deviceName = sku
      ? `${sku.replace(/-/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())} ${hardwareId}`
      : `FillaScan ${hardwareId}`;
    await db.insert(scanStations).values({
      name: deviceName,
      hardwareId,
      deviceSku: sku || "filla-scan",
      firmwareVersion: firmwareVersion || null,
      firmwareChannel: firmwareChannel || "stable",
      ...capFlags,
      ...identityFields,
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

// GET removed — pairing status now pushed via MQTT (fiq/s/{hwId}/pair/status)
