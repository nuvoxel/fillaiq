import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scanSessions, scanEvents } from "@/db/schema/scan-stations";
import { brands, materials, products } from "@/db/schema/central-catalog";
import { eq } from "drizzle-orm";

/**
 * GET /api/v1/scan/session/[sessionId]
 *
 * Public endpoint — returns session data with scan events for the phone enrichment page.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const [session] = await db
    .select()
    .from(scanSessions)
    .where(eq(scanSessions.id, sessionId));

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  // Fetch all scan events for this session
  const events = await db
    .select()
    .from(scanEvents)
    .where(eq(scanEvents.sessionId, sessionId));

  // Fetch matched product details if identified
  let matchedProduct: any = null;
  if (session.matchedProductId) {
    const [product] = await db
      .select({
        id: products.id,
        name: products.name,
        colorName: products.colorName,
        colorHex: products.colorHex,
        imageUrl: products.imageUrl,
        netWeightG: products.netWeightG,
        brandId: products.brandId,
        materialId: products.materialId,
        brandName: brands.name,
        materialName: materials.name,
        materialAbbreviation: materials.abbreviation,
      })
      .from(products)
      .leftJoin(brands, eq(products.brandId, brands.id))
      .leftJoin(materials, eq(products.materialId, materials.id))
      .where(eq(products.id, session.matchedProductId));

    matchedProduct = product ?? null;
  }

  return NextResponse.json({
    session,
    events,
    matchedProduct,
  });
}

/**
 * PATCH /api/v1/scan/session/[sessionId]
 *
 * Public endpoint — updates session with enrichment data from the phone.
 * Accepts: photoUrl, brandId, materialId, colorName, notes
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params;

  const [session] = await db
    .select()
    .from(scanSessions)
    .where(eq(scanSessions.id, sessionId));

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { photoUrl, brandId, materialId, colorName, notes } = body;

  // Store enrichment data in nfcParsedData as a merged object
  const existingParsed = (session.nfcParsedData as Record<string, any>) ?? {};
  const enrichment: Record<string, any> = {
    ...existingParsed,
    enrichedAt: new Date().toISOString(),
  };
  if (photoUrl !== undefined) enrichment.photoUrl = photoUrl;
  if (colorName !== undefined) enrichment.userColorName = colorName;
  if (notes !== undefined) enrichment.userNotes = notes;
  if (brandId !== undefined) enrichment.userBrandId = brandId;
  if (materialId !== undefined) enrichment.userMaterialId = materialId;

  const updates: Record<string, any> = {
    nfcParsedData: enrichment,
    updatedAt: new Date(),
  };

  const [updated] = await db
    .update(scanSessions)
    .set(updates)
    .where(eq(scanSessions.id, sessionId))
    .returning();

  return NextResponse.json({ session: updated });
}
