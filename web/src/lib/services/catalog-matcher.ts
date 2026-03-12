/**
 * Catalog matcher — tries to identify a product from session data.
 *
 * Priority:
 *   1. NFC parsed data (Bambu materialId/variantId via nfcTagPatterns)
 *   2. Barcode (skuMappings / products)
 *   3. null (no match)
 */

import { db } from "@/db";
import {
  products,
  brands,
  nfcTagPatterns,
  skuMappings,
} from "@/db/schema/central-catalog";
import { eq, or } from "drizzle-orm";

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

  // Bambu: match by materialId and/or variantId
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
      // Both materialId AND variantId match = high confidence
      // Just materialId = medium confidence
      const confidence =
        parsed.variantId && parsed.materialId ? 0.95 : 0.8;

      return {
        productId: match.product.id,
        confidence,
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
