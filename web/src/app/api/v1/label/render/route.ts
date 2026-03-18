import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/db";
import { labelTemplates, printJobs } from "@/db/schema/user-library";
import { products } from "@/db/schema/central-catalog";
import { scanStations, scanSessions } from "@/db/schema/scan-stations";
import { eq, and, isNotNull } from "drizzle-orm";
import { renderLabelBitmap } from "@/lib/services/label-renderer";
import sharp from "sharp";
import { getSession } from "@/lib/actions/auth";

/**
 * GET /api/v1/label/render
 *
 * Renders a label as a bitmap. Supports two output formats:
 *   - `raw` (default): 1-bit packed bitmap for direct streaming to thermal printers
 *   - `bmp`: Windows BMP image for browser preview (`<img>` tag)
 *
 * Data source (one of):
 *   - `sessionId` query param: fetches product data from a scan session
 *   - Direct query params: `brand`, `material`, `colorHex`, `colorName`,
 *     `nozzleTempMin`, `nozzleTempMax`, `bedTemp`, `weight`, `location`
 *
 * Other query parameters:
 *   templateId - label template ID (optional; uses user default if omitted)
 *   width      - printer width in dots (default: 384)
 *   dpi        - printer DPI (default: 203)
 *   jobId      - optional print job ID (marks it as "printing")
 *   format     - output format: "raw" (default) or "png"
 *
 * Auth: X-Device-Token header (device pairing) OR browser session cookie
 *
 * Response (format=raw): application/octet-stream with raw 1-bit bitmap
 *   Headers: X-Label-Width, X-Label-Height, X-Bytes-Per-Row
 * Response (format=png): image/png
 */
export async function GET(request: NextRequest) {
  // ── Auth ──────────────────────────────────────────────────────────────
  // Try device token auth first, then fall back to session cookie auth
  const deviceToken = request.headers.get("x-device-token");
  let userId: string | null = null;

  if (deviceToken) {
    // Device auth path
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
      return NextResponse.json(
        { error: "Invalid token or device not paired" },
        { status: 401 }
      );
    }

    // Verify hardware identity
    const deviceSecret = request.headers.get("x-device-secret");
    if (station.deviceSecret && deviceSecret) {
      const secretHash = createHash("sha256")
        .update(deviceSecret)
        .digest("hex");
      if (station.deviceSecret !== secretHash) {
        return NextResponse.json(
          { error: "Device identity mismatch" },
          { status: 403 }
        );
      }
    }

    userId = station.userId;
  } else {
    // Session cookie auth path (browser preview)
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    userId = session.userId;
  }

  // ── Parse params ──────────────────────────────────────────────────────
  const url = new URL(request.url);
  const sessionId = url.searchParams.get("sessionId");
  const templateId = url.searchParams.get("templateId");
  const widthDots = parseInt(url.searchParams.get("width") ?? "384", 10);
  const dpi = parseInt(url.searchParams.get("dpi") ?? "203", 10);
  const jobId = url.searchParams.get("jobId");
  const format = url.searchParams.get("format") ?? "raw";

  // ── Build label data ────────────────────────────────────────────────
  let brandName: string | null = null;
  let materialName: string | null = null;
  let productName: string | null = null;
  let colorHex: string | null = null;
  let colorName: string | null = null;
  let nozzleTempMin: number | null = null;
  let nozzleTempMax: number | null = null;
  let bedTemp: number | null = null;
  let weightStr: string | null = null;
  let location: string | null = null;

  if (sessionId) {
    // ── Fetch session + product data ────────────────────────────────
    const [session] = await db
      .select()
      .from(scanSessions)
      .where(eq(scanSessions.id, sessionId));

    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Get product info if matched
    if (session.matchedProductId) {
      const productRow = await db.query.products.findFirst({
        where: eq(products.id, session.matchedProductId),
        with: { brand: true, material: true },
      });

      if (productRow) {
        const p = productRow as Record<string, any>;
        brandName = productRow.brand?.name ?? null;
        materialName = productRow.material?.name ?? null;
        productName = productRow.name;
        colorHex = productRow.colorHex;
        colorName = productRow.colorName;
        nozzleTempMin = p.nozzleTempMin ?? null;
        nozzleTempMax = p.nozzleTempMax ?? null;
        bedTemp = p.bedTempMin ?? null;
      }
    }

    // Fall back to NFC parsed data
    const nfcParsed = session.nfcParsedData as Record<string, any> | null;
    if (nfcParsed) {
      if (!brandName && nfcParsed.brandName) brandName = nfcParsed.brandName;
      if (!materialName && nfcParsed.material)
        materialName = nfcParsed.material;
      if (!productName && nfcParsed.name) productName = nfcParsed.name;
      if (!colorHex && nfcParsed.colorHex) colorHex = nfcParsed.colorHex;
      if (nozzleTempMin === null && nfcParsed.nozzleTempMin)
        nozzleTempMin = nfcParsed.nozzleTempMin;
      if (nozzleTempMax === null && nfcParsed.nozzleTempMax)
        nozzleTempMax = nfcParsed.nozzleTempMax;
      if (bedTemp === null && nfcParsed.bedTemp) bedTemp = nfcParsed.bedTemp;
    }

    // Color from session best
    if (!colorHex && session.bestColorHex) colorHex = session.bestColorHex;

    // Weight from session
    if (session.bestWeightG) {
      weightStr = `${Math.round(session.bestWeightG)}g`;
    }
  } else {
    // ── Direct query params ─────────────────────────────────────────
    brandName = url.searchParams.get("brand");
    materialName = url.searchParams.get("material");
    colorHex = url.searchParams.get("colorHex");
    colorName = url.searchParams.get("colorName");
    nozzleTempMin = url.searchParams.get("nozzleTempMin")
      ? parseInt(url.searchParams.get("nozzleTempMin")!, 10)
      : null;
    nozzleTempMax = url.searchParams.get("nozzleTempMax")
      ? parseInt(url.searchParams.get("nozzleTempMax")!, 10)
      : null;
    bedTemp = url.searchParams.get("bedTemp")
      ? parseInt(url.searchParams.get("bedTemp")!, 10)
      : null;
    weightStr = url.searchParams.get("weight");
    location = url.searchParams.get("location");

    // If no spool data provided, render a slot/location label
    if (!brandName && !materialName && !weightStr) {
      if (location) {
        brandName = location;
        materialName = "EMPTY";
      } else {
        brandName = "Unassigned";
        materialName = "Scan to assign";
      }
    }
  }

  // ── Fetch template ────────────────────────────────────────────────────
  let template;
  if (templateId) {
    [template] = await db
      .select()
      .from(labelTemplates)
      .where(eq(labelTemplates.id, templateId));
  }

  // Fall back to user's default template
  if (!template && userId) {
    [template] = await db
      .select()
      .from(labelTemplates)
      .where(
        and(
          eq(labelTemplates.userId, userId),
          eq(labelTemplates.isDefault, true)
        )
      );
  }

  // Fall back to first template
  if (!template && userId) {
    [template] = await db
      .select()
      .from(labelTemplates)
      .where(eq(labelTemplates.userId, userId));
  }

  // ── Build label data ──────────────────────────────────────────────────
  // Build QR URL for spool/session page
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://www.fillaiq.com";
  const qrUrl = sessionId
    ? `${baseUrl}/scan/${sessionId}`
    : undefined;

  const labelData = {
    brand: brandName ?? undefined,
    material: materialName ?? undefined,
    productName: productName ?? undefined,
    colorHex: colorHex ?? undefined,
    colorName: colorName ?? undefined,
    nozzleTempMin: nozzleTempMin ?? undefined,
    nozzleTempMax: nozzleTempMax ?? undefined,
    bedTemp: bedTemp ?? undefined,
    weight: weightStr ?? undefined,
    location: location ?? undefined,
    qrUrl,
  };

  const settings = template
    ? {
        widthMm: template.widthMm ?? 40,
        heightMm: template.heightMm ?? 30,
        showBrand: template.showBrand ?? true,
        showMaterial: template.showMaterial ?? true,
        showColor: template.showColor ?? true,
        showColorSwatch: template.showColorSwatch ?? true,
        showTemps: template.showTemps ?? true,
        showQrCode: template.showQrCode ?? true,
        showWeight: template.showWeight ?? true,
        showLocation: template.showLocation ?? false,
        showPrice: template.showPrice ?? false,
      }
    : {
        widthMm: 40,
        heightMm: 30,
        showBrand: true,
        showMaterial: true,
        showColor: false,
        showColorSwatch: true,
        showTemps: true,
        showQrCode: true,
        showWeight: true,
        showLocation: false,
        showPrice: false,
      };

  // ── Render bitmap ─────────────────────────────────────────────────────
  const { bitmap, widthPx, heightPx, bytesPerRow } = renderLabelBitmap(
    labelData,
    settings,
    widthDots,
    dpi
  );

  // ── Optionally mark print job as printing ─────────────────────────────
  if (jobId) {
    await db
      .update(printJobs)
      .set({ status: "printing" })
      .where(eq(printJobs.id, jobId))
      .catch(() => {});
  }

  // ── Return response ───────────────────────────────────────────────────
  if (format === "png") {
    // Convert 1-bit packed bitmap to 8-bit grayscale for sharp
    const pixels = Buffer.alloc(widthPx * heightPx);
    for (let y = 0; y < heightPx; y++) {
      for (let x = 0; x < widthPx; x++) {
        const byteIdx = y * bytesPerRow + Math.floor(x / 8);
        const bitIdx = 7 - (x % 8);
        const isBlack = (bitmap[byteIdx] >> bitIdx) & 1;
        pixels[y * widthPx + x] = isBlack ? 0 : 255;
      }
    }
    const png = await sharp(pixels, {
      raw: { width: widthPx, height: heightPx, channels: 1 },
    }).png().toBuffer();

    return new Response(new Uint8Array(png), {
      status: 200,
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  }

  // Default: raw bitmap
  return new Response(new Uint8Array(bitmap), {
    status: 200,
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Label-Width": String(widthPx),
      "X-Label-Height": String(heightPx),
      "X-Bytes-Per-Row": String(bytesPerRow),
      "Cache-Control": "no-store",
    },
  });
}
