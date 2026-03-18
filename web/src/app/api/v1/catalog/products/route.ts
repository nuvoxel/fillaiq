import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products, brands, materials } from "@/db/schema/central-catalog";
import { eq, ilike, and, type SQL } from "drizzle-orm";
import { getSession } from "@/lib/actions/auth";

/**
 * GET /api/v1/catalog/products
 *
 * Public endpoint — returns products with optional search filtering.
 */
export async function GET(request: NextRequest) {
  const search = request.nextUrl.searchParams.get("search");
  const brandId = request.nextUrl.searchParams.get("brandId");
  const materialId = request.nextUrl.searchParams.get("materialId");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "100", 10);

  const conditions: SQL[] = [];
  if (search) conditions.push(ilike(products.name, `%${search}%`));
  if (brandId) conditions.push(eq(products.brandId, brandId));
  if (materialId) conditions.push(eq(products.materialId, materialId));

  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      category: products.category,
      colorName: products.colorName,
      colorHex: products.colorHex,
      netWeightG: products.netWeightG,
      imageUrl: products.imageUrl,
      validationStatus: products.validationStatus,
      brandId: products.brandId,
      materialId: products.materialId,
      brandName: brands.name,
      materialName: materials.name,
      materialAbbreviation: materials.abbreviation,
    })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .leftJoin(materials, eq(products.materialId, materials.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .limit(limit);

  return NextResponse.json(rows);
}

/**
 * POST /api/v1/catalog/products
 *
 * Authenticated endpoint — creates a new product.
 */
export async function POST(request: NextRequest) {
  const ctx = await getSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const [row] = await db
      .insert(products)
      .values({
        name: body.name as string,
        category: (body.category as any) ?? "filament",
        description: (body.description as string) ?? null,
        imageUrl: (body.imageUrl as string) ?? null,
        brandId: (body.brandId as string) ?? null,
        materialId: (body.materialId as string) ?? null,
        colorName: (body.colorName as string) ?? null,
        colorHex: (body.colorHex as string) ?? null,
        netWeightG: body.netWeightG != null ? Number(body.netWeightG) : null,
        validationStatus: (body.validationStatus as any) ?? "draft",
        gtin: (body.gtin as string) ?? null,
        submittedByUserId: ctx.userId,
      })
      .returning();

    return NextResponse.json(row, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
