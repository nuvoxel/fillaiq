"use server";

import { db } from "@/db";
import { eq, or, ilike, and, getTableColumns, type SQL } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  brands,
  materials,
  products,
  filamentProfiles,
  skuMappings,
  nfcTagPatterns,
  productAliases,
} from "@/db/schema/central-catalog";
import {
  createCrudActions,
  ok,
  err,
  type ActionResult,
  type PaginationParams,
} from "./utils";
import {
  insertBrandSchema,
  updateBrandSchema,
  insertMaterialSchema,
  updateMaterialSchema,
  insertProductSchema,
  updateProductSchema,
  insertFilamentProfileSchema,
  updateFilamentProfileSchema,
  insertSkuMappingSchema,
  updateSkuMappingSchema,
  insertNfcTagPatternSchema,
  updateNfcTagPatternSchema,
  insertProductAliasSchema,
  updateProductAliasSchema,
} from "./schemas";
import { requireAdmin, requireAuth } from "./auth";
import { emitAuditEvent } from "./audit";
import { auditActorType } from "./audit-helpers";

// ── Types ───────────────────────────────────────────────────────────────────

type Brand = InferSelectModel<typeof brands>;
type Material = InferSelectModel<typeof materials>;
type Product = InferSelectModel<typeof products>;
type FilamentProfile = InferSelectModel<typeof filamentProfiles>;
type SkuMapping = InferSelectModel<typeof skuMappings>;
type NfcTagPattern = InferSelectModel<typeof nfcTagPatterns>;
type ProductAlias = InferSelectModel<typeof productAliases>;

// ── Brands ──────────────────────────────────────────────────────────────────

const brandsCrud = createCrudActions<Brand>({
  table: brands,
  insertSchema: insertBrandSchema,
  updateSchema: updateBrandSchema,
});

export async function createBrand(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await brandsCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "brand", resourceId: result.data.id });
  }
  return result;
}
export async function getBrandById(id: string) {
  return brandsCrud.getById(id);
}
export async function listBrands(
  params?: PaginationParams & { search?: string }
): Promise<ActionResult<Brand[]>> {
  try {
    const conditions: SQL[] = [];
    if (params?.search) {
      conditions.push(ilike(brands.name, `%${params.search}%`));
    }
    const q = db
      .select()
      .from(brands)
      .where(conditions.length ? and(...conditions) : undefined)
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}
export async function updateBrand(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await brandsCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "brand", resourceId: result.data.id });
  }
  return result;
}
export async function removeBrand(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await brandsCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "brand", resourceId: result.data.id });
  }
  return result;
}

export async function getBrandBySlug(
  slug: string
): Promise<ActionResult<Brand>> {
  try {
    const [row] = await db
      .select()
      .from(brands)
      .where(eq(brands.slug, slug));
    if (!row) return err("Not found");
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Materials ───────────────────────────────────────────────────────────────

const materialsCrud = createCrudActions<Material>({
  table: materials,
  insertSchema: insertMaterialSchema,
  updateSchema: updateMaterialSchema,
});

export async function createMaterial(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await materialsCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "material", resourceId: result.data.id });
  }
  return result;
}
export async function getMaterialById(id: string) {
  return materialsCrud.getById(id);
}
export async function listMaterials(
  params?: PaginationParams & { search?: string; materialClass?: string }
): Promise<ActionResult<Material[]>> {
  try {
    const conditions: SQL[] = [];
    if (params?.search) {
      conditions.push(ilike(materials.name, `%${params.search}%`));
    }
    if (params?.materialClass) {
      conditions.push(eq(materials.materialClass, params.materialClass as any));
    }
    const q = db
      .select()
      .from(materials)
      .where(conditions.length ? and(...conditions) : undefined)
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}
export async function updateMaterial(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await materialsCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "material", resourceId: result.data.id });
  }
  return result;
}
export async function removeMaterial(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await materialsCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "material", resourceId: result.data.id });
  }
  return result;
}

// ── Products ────────────────────────────────────────────────────────────────

const productsCrud = createCrudActions<Product>({
  table: products,
  insertSchema: insertProductSchema,
  updateSchema: updateProductSchema,
});

export async function createProduct(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await productsCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "product", resourceId: result.data.id });
  }
  return result;
}
/**
 * Submit a new product as an unverified catalog entry.
 * Any authenticated user can call this — the product is created
 * with validationStatus "submitted" and tagged with the user's ID.
 * An admin can later validate, merge, or reject it.
 */
export async function submitProduct(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data = typeof input === "object" && input !== null ? input : {};
  const result = await productsCrud.create({
    ...data,
    validationStatus: "submitted",
    submittedByUserId: guard.data.userId,
  });
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "product", resourceId: result.data.id });
  }
  return result;
}

export async function getProductById(id: string) {
  return productsCrud.getById(id);
}
export async function listProducts(
  params?: PaginationParams & {
    brandId?: string;
    materialId?: string;
    search?: string;
  }
): Promise<ActionResult<Product[]>> {
  try {
    const conditions: SQL[] = [];
    if (params?.brandId) conditions.push(eq(products.brandId, params.brandId));
    if (params?.materialId)
      conditions.push(eq(products.materialId, params.materialId));
    if (params?.search)
      conditions.push(ilike(products.name, `%${params.search}%`));
    const q = db
      .select({
        ...getTableColumns(products),
        brandName: brands.name,
      })
      .from(products)
      .leftJoin(brands, eq(products.brandId, brands.id))
      .where(conditions.length ? and(...conditions) : undefined)
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}
export async function updateProduct(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await productsCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "product", resourceId: result.data.id });
  }
  return result;
}
export async function removeProduct(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await productsCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "product", resourceId: result.data.id });
  }
  return result;
}

export async function getProductWithRelations(id: string) {
  try {
    const row = await db.query.products.findFirst({
      where: eq(products.id, id),
      with: {
        brand: true,
        material: true,
        filamentProfile: true,
        skuMappings: true,
        nfcTagPatterns: true,
        aliases: { with: { relatedProduct: { with: { brand: true, resellerLinks: true } } } },
        aliasedBy: { with: { product: { with: { brand: true, resellerLinks: true } } } },
        resellerLinks: { with: { priceTiers: true } },
      },
    });
    if (!row) return err("Not found");
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Filament Profiles ────────────────────────────────────────────────────────

const filamentProfilesCrud = createCrudActions<FilamentProfile>({
  table: filamentProfiles,
  insertSchema: insertFilamentProfileSchema,
  updateSchema: updateFilamentProfileSchema,
});

export async function createFilamentProfile(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await filamentProfilesCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "filament_profile", resourceId: result.data.id });
  }
  return result;
}
export async function getFilamentProfileById(id: string) {
  return filamentProfilesCrud.getById(id);
}
export async function listFilamentProfiles(params?: PaginationParams) {
  return filamentProfilesCrud.list(params);
}
export async function updateFilamentProfile(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await filamentProfilesCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "filament_profile", resourceId: result.data.id });
  }
  return result;
}
export async function removeFilamentProfile(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await filamentProfilesCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "filament_profile", resourceId: result.data.id });
  }
  return result;
}

export async function getFilamentProfileByProductId(
  productId: string
): Promise<ActionResult<FilamentProfile>> {
  try {
    const [row] = await db
      .select()
      .from(filamentProfiles)
      .where(eq(filamentProfiles.productId, productId));
    if (!row) return err("Not found");
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── SKU Mappings ────────────────────────────────────────────────────────────

const skuMappingsCrud = createCrudActions<SkuMapping>({
  table: skuMappings,
  insertSchema: insertSkuMappingSchema,
  updateSchema: updateSkuMappingSchema,
});

export async function createSkuMapping(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await skuMappingsCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "sku_mapping", resourceId: result.data.id });
  }
  return result;
}
export async function getSkuMappingById(id: string) {
  return skuMappingsCrud.getById(id);
}
export async function listSkuMappings(params?: PaginationParams) {
  return skuMappingsCrud.list(params);
}
export async function updateSkuMapping(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await skuMappingsCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "sku_mapping", resourceId: result.data.id });
  }
  return result;
}
export async function removeSkuMapping(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await skuMappingsCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "sku_mapping", resourceId: result.data.id });
  }
  return result;
}

export async function getSkuByCode(
  sku: string
): Promise<ActionResult<SkuMapping>> {
  try {
    const [row] = await db
      .select()
      .from(skuMappings)
      .where(eq(skuMappings.sku, sku));
    if (!row) return err("Not found");
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listSkusByProduct(
  productId: string,
  params?: PaginationParams
): Promise<ActionResult<SkuMapping[]>> {
  try {
    const q = db
      .select()
      .from(skuMappings)
      .where(eq(skuMappings.productId, productId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── NFC Tag Patterns ────────────────────────────────────────────────────────

const nfcTagPatternsCrud = createCrudActions<NfcTagPattern>({
  table: nfcTagPatterns,
  insertSchema: insertNfcTagPatternSchema,
  updateSchema: updateNfcTagPatternSchema,
});

export async function createNfcTagPattern(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await nfcTagPatternsCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "nfc_tag_pattern", resourceId: result.data.id });
  }
  return result;
}
export async function getNfcTagPatternById(id: string) {
  return nfcTagPatternsCrud.getById(id);
}
export async function listNfcTagPatterns(params?: PaginationParams) {
  return nfcTagPatternsCrud.list(params);
}
export async function updateNfcTagPattern(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await nfcTagPatternsCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "nfc_tag_pattern", resourceId: result.data.id });
  }
  return result;
}
export async function removeNfcTagPattern(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await nfcTagPatternsCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "nfc_tag_pattern", resourceId: result.data.id });
  }
  return result;
}

export async function lookupByBambu(
  bambuVariantId: string,
  bambuMaterialId: string
): Promise<ActionResult<NfcTagPattern[]>> {
  try {
    const rows = await db
      .select()
      .from(nfcTagPatterns)
      .where(
        and(
          eq(nfcTagPatterns.bambuVariantId, bambuVariantId),
          eq(nfcTagPatterns.bambuMaterialId, bambuMaterialId)
        )
      );
    return ok(rows);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function lookupByTigerTag(
  tigerTagProductId: number
): Promise<ActionResult<NfcTagPattern[]>> {
  try {
    const rows = await db
      .select()
      .from(nfcTagPatterns)
      .where(eq(nfcTagPatterns.tigerTagProductId, tigerTagProductId));
    return ok(rows);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function lookupByOpenPrintTag(
  optPackageUuid: string
): Promise<ActionResult<NfcTagPattern[]>> {
  try {
    const rows = await db
      .select()
      .from(nfcTagPatterns)
      .where(eq(nfcTagPatterns.optPackageUuid, optPackageUuid));
    return ok(rows);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listPatternsByProduct(
  productId: string,
  params?: PaginationParams
): Promise<ActionResult<NfcTagPattern[]>> {
  try {
    const q = db
      .select()
      .from(nfcTagPatterns)
      .where(eq(nfcTagPatterns.productId, productId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Product Aliases ──────────────────────────────────────────────────────────

const productAliasesCrud = createCrudActions<ProductAlias>({
  table: productAliases,
  insertSchema: insertProductAliasSchema,
  updateSchema: updateProductAliasSchema,
});

export async function createProductAlias(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await productAliasesCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "product_alias", resourceId: result.data.id });
  }
  return result;
}
export async function getProductAliasById(id: string) {
  return productAliasesCrud.getById(id);
}
export async function listProductAliases(params?: PaginationParams) {
  return productAliasesCrud.list(params);
}
export async function updateProductAlias(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await productAliasesCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "product_alias", resourceId: result.data.id });
  }
  return result;
}
export async function removeProductAlias(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await productAliasesCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "product_alias", resourceId: result.data.id });
  }
  return result;
}

export async function listAliasesByProduct(
  productId: string
): Promise<ActionResult<ProductAlias[]>> {
  try {
    const rows = await db
      .select()
      .from(productAliases)
      .where(eq(productAliases.productId, productId));
    return ok(rows);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listAliasesByRelatedProduct(
  relatedProductId: string
): Promise<ActionResult<ProductAlias[]>> {
  try {
    const rows = await db
      .select()
      .from(productAliases)
      .where(eq(productAliases.relatedProductId, relatedProductId));
    return ok(rows);
  } catch (e) {
    return err((e as Error).message);
  }
}

/** List all aliases where the product appears as either source or target. */
export async function listAliasesForProduct(
  productId: string
): Promise<ActionResult<ProductAlias[]>> {
  try {
    const rows = await db
      .select()
      .from(productAliases)
      .where(
        or(
          eq(productAliases.productId, productId),
          eq(productAliases.relatedProductId, productId)
        )
      );
    return ok(rows);
  } catch (e) {
    return err((e as Error).message);
  }
}
