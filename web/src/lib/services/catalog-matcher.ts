/**
 * Catalog matcher — tries to identify a product from session data.
 *
 * Priority:
 *   1. NFC parsed data (match products by name, material, color, weight)
 *   2. NFC tag patterns table (legacy variantId/materialId mappings)
 *   3. Barcode (skuMappings / products)
 *   4. null (no match)
 */

import { db } from "@/db";
import {
  products,
  brands,
  materials,
  nfcTagPatterns,
  skuMappings,
} from "@/db/schema/central-catalog";
import { eq, or, and, ilike } from "drizzle-orm";

interface MatchResult {
  productId: string;
  confidence: number;
  method: string; // 'nfc' | 'barcode'
  product?: any;
  brand?: any;
}

interface SessionLike {
  nfcParsedData: any;
  nfcTagFormat: string | null;
  barcodeValue: string | null;
}

/**
 * Try to match a session's data against the product catalog.
 */
export async function matchToCatalog(
  session: SessionLike
): Promise<MatchResult | null> {
  // 1. NFC-based matching (highest priority)
  const nfcMatch = await matchByNfc(session);
  if (nfcMatch) return nfcMatch;

  // 2. Barcode-based matching
  const barcodeMatch = await matchByBarcode(session);
  if (barcodeMatch) return barcodeMatch;

  return null;
}

async function matchByNfc(session: SessionLike): Promise<MatchResult | null> {
  const parsed = session.nfcParsedData as Record<string, any> | null;
  if (!parsed) return null;

  // ── Strategy 0: Exact match by variantId on products table ──────────
  if (parsed.variantId) {
    const [match] = await db
      .select({ product: products, brand: brands })
      .from(products)
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(eq(products.bambuVariantId, parsed.variantId))
      .limit(1);

    if (match) {
      return {
        productId: match.product.id,
        confidence: 0.99,
        method: "nfc",
        product: match.product,
        brand: match.brand,
      };
    }
  }

  // ── Strategy 1: Match by product name + material + color + brand ────
  // Bambu MIFARE tags give us: name ("PLA Basic"), material ("PLA"),
  // color (#D1D3D5), net weight (1000), and we know brand = Bambu Lab.
  if (parsed.name && parsed.format === "bambu_mifare") {
    const conditions: any[] = [ilike(products.name, parsed.name)];

    // Match material by name/abbreviation
    if (parsed.material) {
      const [mat] = await db
        .select({ id: materials.id })
        .from(materials)
        .where(or(
          ilike(materials.name, parsed.material),
          ilike(materials.abbreviation, parsed.material)
        ))
        .limit(1);
      if (mat) conditions.push(eq(products.materialId, mat.id));
    }

    // Match color by hex (normalize to lowercase)
    if (parsed.colorHex) {
      conditions.push(ilike(products.colorHex, parsed.colorHex));
    }

    // Match brand = "Bambu Lab" or similar
    const [bambuBrand] = await db
      .select({ id: brands.id })
      .from(brands)
      .where(or(
        ilike(brands.name, "Bambu Lab"),
        ilike(brands.name, "Bambu%"),
        ilike(brands.name, "BambuLab"),
      ))
      .limit(1);
    if (bambuBrand) conditions.push(eq(products.brandId, bambuBrand.id));

    if (conditions.length >= 2) {
      const [match] = await db
        .select({ product: products, brand: brands })
        .from(products)
        .leftJoin(brands, eq(products.brandId, brands.id))
        .where(and(...conditions))
        .limit(1);

      if (match) {
        return {
          productId: match.product.id,
          confidence: conditions.length >= 4 ? 0.95 : conditions.length >= 3 ? 0.9 : 0.8,
          method: "nfc",
          product: match.product,
          brand: match.brand,
        };
      }
    }

    // Relax: try just name + brand (without color/material)
    if (bambuBrand) {
      const [match] = await db
        .select({ product: products, brand: brands })
        .from(products)
        .leftJoin(brands, eq(products.brandId, brands.id))
        .where(and(
          ilike(products.name, parsed.name),
          eq(products.brandId, bambuBrand.id)
        ))
        .limit(1);

      if (match) {
        return {
          productId: match.product.id,
          confidence: 0.7,
          method: "nfc",
          product: match.product,
          brand: match.brand,
        };
      }
    }
  }

  // ── Strategy 2: Legacy nfcTagPatterns table (variantId/materialId) ──
  if (parsed.materialId || parsed.variantId) {
    const conditions = [];
    if (parsed.materialId) {
      conditions.push(eq(nfcTagPatterns.bambuMaterialId, parsed.materialId));
    }
    if (parsed.variantId) {
      conditions.push(eq(nfcTagPatterns.bambuVariantId, parsed.variantId));
    }

    const [match] = await db
      .select({ product: products, brand: brands })
      .from(nfcTagPatterns)
      .innerJoin(products, eq(nfcTagPatterns.productId, products.id))
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(or(...conditions))
      .limit(1);

    if (match) {
      return {
        productId: match.product.id,
        confidence: parsed.variantId && parsed.materialId ? 0.95 : 0.8,
        method: "nfc",
        product: match.product,
        brand: match.brand,
      };
    }
  }

  return null;
}

async function matchByBarcode(
  session: SessionLike
): Promise<MatchResult | null> {
  if (!session.barcodeValue) return null;

  const barcode = session.barcodeValue;

  // Check SKU mappings
  const [skuMatch] = await db
    .select({ product: products, brand: brands })
    .from(skuMappings)
    .innerJoin(products, eq(skuMappings.productId, products.id))
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(
      or(
        eq(skuMappings.barcode, barcode),
        eq(skuMappings.gtin, barcode),
        eq(skuMappings.sku, barcode)
      )
    )
    .limit(1);

  if (skuMatch) {
    return {
      productId: skuMatch.product.id,
      confidence: 0.9,
      method: "barcode",
      product: skuMatch.product,
      brand: skuMatch.brand,
    };
  }

  // Check product-level barcodes
  const [productMatch] = await db
    .select({ product: products, brand: brands })
    .from(products)
    .leftJoin(brands, eq(products.brandId, brands.id))
    .where(
      or(eq(products.packageBarcode, barcode), eq(products.gtin, barcode))
    )
    .limit(1);

  if (productMatch) {
    return {
      productId: productMatch.product.id,
      confidence: 0.85,
      method: "barcode",
      product: productMatch.product,
      brand: productMatch.brand,
    };
  }

  return null;
}
