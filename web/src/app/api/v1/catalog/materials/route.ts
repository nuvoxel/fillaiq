import { NextResponse } from "next/server";
import { db } from "@/db";
import { materials } from "@/db/schema/central-catalog";

/**
 * GET /api/v1/catalog/materials
 *
 * Public endpoint — returns all materials for dropdowns.
 */
export async function GET() {
  const rows = await db
    .select({
      id: materials.id,
      name: materials.name,
      abbreviation: materials.abbreviation,
    })
    .from(materials);

  return NextResponse.json(rows);
}
