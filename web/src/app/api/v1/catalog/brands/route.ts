import { NextResponse } from "next/server";
import { db } from "@/db";
import { brands } from "@/db/schema/central-catalog";

/**
 * GET /api/v1/catalog/brands
 *
 * Public endpoint — returns all brands for dropdowns.
 */
export async function GET() {
  const rows = await db
    .select({
      id: brands.id,
      name: brands.name,
      slug: brands.slug,
    })
    .from(brands);

  return NextResponse.json(rows);
}
