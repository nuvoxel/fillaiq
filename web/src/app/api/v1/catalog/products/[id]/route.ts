import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { products } from "@/db/schema/central-catalog";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/actions/auth";

/**
 * PATCH /api/v1/catalog/products/[id]
 *
 * Authenticated endpoint — updates a product.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.category !== undefined) updates.category = body.category;
    if (body.description !== undefined) updates.description = body.description;
    if (body.imageUrl !== undefined) updates.imageUrl = body.imageUrl;
    if (body.brandId !== undefined) updates.brandId = body.brandId;
    if (body.materialId !== undefined) updates.materialId = body.materialId;
    if (body.colorName !== undefined) updates.colorName = body.colorName;
    if (body.colorHex !== undefined) updates.colorHex = body.colorHex;
    if (body.netWeightG !== undefined)
      updates.netWeightG = body.netWeightG != null ? Number(body.netWeightG) : null;
    if (body.validationStatus !== undefined) updates.validationStatus = body.validationStatus;
    if (body.gtin !== undefined) updates.gtin = body.gtin;

    const [row] = await db
      .update(products)
      .set(updates)
      .where(eq(products.id, id))
      .returning();

    if (!row) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json(row);
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/catalog/products/[id]
 *
 * Authenticated endpoint — deletes a product.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getSession();
  if (!ctx) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const [row] = await db
      .delete(products)
      .where(eq(products.id, id))
      .returning({ id: products.id });

    if (!row) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    return NextResponse.json({ deleted: true, id: row.id });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message },
      { status: 500 }
    );
  }
}
