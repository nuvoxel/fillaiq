import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scanStations } from "@/db/schema";
import { eq, and, isNotNull } from "drizzle-orm";
import { readFile } from "fs/promises";
import { join } from "path";

type ChannelEntry = {
  version: string;
  file: string;
  md5: string;
  size: number;
  date: string;
  notes?: string;
};

type DeviceEntry = {
  channels: Record<string, ChannelEntry>;
};

type Manifest = {
  devices: Record<string, DeviceEntry>;
};

/**
 * GET /api/v1/firmware/check?version=1.0.0&sku=scan-station
 *
 * Called periodically by devices to check for firmware updates.
 * Also serves as a heartbeat — updates station last-seen and telemetry.
 *
 * Routes firmware by device SKU (scan-station, shelf-station, etc.)
 * and firmware channel (stable, beta, dev).
 */
export async function GET(request: NextRequest) {
  const deviceToken = request.headers.get("x-device-token");
  if (!deviceToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Validate device token
  const [station] = await db
    .select()
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

  // Extract params
  const currentVersion =
    request.nextUrl.searchParams.get("version") ??
    request.headers.get("x-firmware-version") ??
    "0.0.0";
  const sku =
    request.nextUrl.searchParams.get("sku") ??
    request.headers.get("x-device-sku") ??
    "scan-station";

  // Update station heartbeat + capability flags
  await db
    .update(scanStations)
    .set({
      lastSeenAt: new Date(),
      isOnline: true,
      firmwareVersion: currentVersion,
      ipAddress:
        request.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
      hasTofSensor: request.headers.get("x-has-tof") === "1",
      hasColorSensor: request.headers.get("x-has-color") === "1",
      hasTurntable: request.headers.get("x-has-turntable") === "1",
      hasCamera: request.headers.get("x-has-camera") === "1",
      updatedAt: new Date(),
    })
    .where(eq(scanStations.id, station.id));

  // Device config from station config column
  const deviceSettings = (station.config as any)?.deviceSettings ?? {};
  const deviceConfigPayload = Object.keys(deviceSettings).length > 0 ? deviceSettings : undefined;

  // Read firmware manifest
  let manifest: Manifest;
  try {
    const manifestPath = join(process.cwd(), "public", "firmware", "manifest.json");
    const raw = await readFile(manifestPath, "utf-8");
    manifest = JSON.parse(raw);
  } catch {
    return NextResponse.json({ updateAvailable: false, deviceConfig: deviceConfigPayload });
  }

  // Look up device by SKU
  const device = manifest.devices[sku];
  if (!device) {
    return NextResponse.json({ updateAvailable: false, deviceConfig: deviceConfigPayload });
  }

  // Look up channel (default: stable)
  const channel = station.firmwareChannel ?? "stable";
  const entry = device.channels[channel] ?? device.channels["stable"];

  if (!entry || !entry.file) {
    return NextResponse.json({ updateAvailable: false, deviceConfig: deviceConfigPayload });
  }

  // Compare versions
  if (!isNewerVersion(entry.version, currentVersion)) {
    return NextResponse.json({ updateAvailable: false, deviceConfig: deviceConfigPayload });
  }

  // Build absolute URL for the firmware binary
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("host") ?? "www.fillaiq.com";
  const binUrl = `${proto}://${host}/firmware/${entry.file}`;

  return NextResponse.json({
    updateAvailable: true,
    version: entry.version,
    url: binUrl,
    md5: entry.md5 || "",
    size: entry.size || 0,
    sku,
    channel,
    releaseNotes: entry.notes || "",
    deviceConfig: deviceConfigPayload,
  });
}

/**
 * Simple semver comparison: returns true if `latest` is newer than `current`.
 */
function isNewerVersion(latest: string, current: string): boolean {
  const l = latest.split(".").map(Number);
  const c = current.split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const lv = l[i] ?? 0;
    const cv = c[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }
  return false;
}
