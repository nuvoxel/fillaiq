"use server";

import { db } from "@/db";
import { eq, ilike, and, type SQL } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  brands,
  materials,
  filaments,
  variants,
  skuMappings,
  nfcTagPatterns,
  equivalenceGroups,
  filamentEquivalences,
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
  insertFilamentSchema,
  updateFilamentSchema,
  insertVariantSchema,
  updateVariantSchema,
  insertSkuMappingSchema,
  updateSkuMappingSchema,
  insertNfcTagPatternSchema,
  updateNfcTagPatternSchema,
  insertEquivalenceGroupSchema,
  updateEquivalenceGroupSchema,
  insertFilamentEquivalenceSchema,
  updateFilamentEquivalenceSchema,
} from "./schemas";
import { requireAdmin } from "./auth";
import { emitAuditEvent } from "./audit";
import { auditActorType } from "./audit-helpers";

// ── Types ───────────────────────────────────────────────────────────────────

type Brand = InferSelectModel<typeof brands>;
type Material = InferSelectModel<typeof materials>;
type Filament = InferSelectModel<typeof filaments>;
type Variant = InferSelectModel<typeof variants>;
type SkuMapping = InferSelectModel<typeof skuMappings>;
type NfcTagPattern = InferSelectModel<typeof nfcTagPatterns>;
type EquivalenceGroup = InferSelectModel<typeof equivalenceGroups>;
type FilamentEquivalence = InferSelectModel<typeof filamentEquivalences>;

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

// ── Filaments ───────────────────────────────────────────────────────────────

const filamentsCrud = createCrudActions<Filament>({
  table: filaments,
  insertSchema: insertFilamentSchema,
  updateSchema: updateFilamentSchema,
});

export async function createFilament(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await filamentsCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "filament", resourceId: result.data.id });
  }
  return result;
}
export async function getFilamentById(id: string) {
  return filamentsCrud.getById(id);
}
export async function listFilaments(
  params?: PaginationParams & {
    brandId?: string;
    materialId?: string;
    search?: string;
  }
): Promise<ActionResult<Filament[]>> {
  try {
    const conditions: SQL[] = [];
    if (params?.brandId) conditions.push(eq(filaments.brandId, params.brandId));
    if (params?.materialId)
      conditions.push(eq(filaments.materialId, params.materialId));
    if (params?.search)
      conditions.push(ilike(filaments.name, `%${params.search}%`));
    const q = db
      .select()
      .from(filaments)
      .where(conditions.length ? and(...conditions) : undefined)
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}
export async function updateFilament(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await filamentsCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "filament", resourceId: result.data.id });
  }
  return result;
}
export async function removeFilament(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await filamentsCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "filament", resourceId: result.data.id });
  }
  return result;
}

export async function getFilamentWithRelations(id: string) {
  try {
    const row = await db.query.filaments.findFirst({
      where: eq(filaments.id, id),
      with: { brand: true, material: true, variants: true },
    });
    if (!row) return err("Not found");
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Variants ────────────────────────────────────────────────────────────────

const variantsCrud = createCrudActions<Variant>({
  table: variants,
  insertSchema: insertVariantSchema,
  updateSchema: updateVariantSchema,
});

export async function createVariant(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await variantsCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "variant", resourceId: result.data.id });
  }
  return result;
}
export async function getVariantById(id: string) {
  return variantsCrud.getById(id);
}
export async function listVariants(params?: PaginationParams) {
  return variantsCrud.list(params);
}
export async function updateVariant(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await variantsCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "variant", resourceId: result.data.id });
  }
  return result;
}
export async function removeVariant(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await variantsCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "variant", resourceId: result.data.id });
  }
  return result;
}

export async function listVariantsByFilament(
  filamentId: string,
  params?: PaginationParams
): Promise<ActionResult<Variant[]>> {
  try {
    const q = db
      .select()
      .from(variants)
      .where(eq(variants.filamentId, filamentId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function getVariantWithRelations(id: string) {
  try {
    const row = await db.query.variants.findFirst({
      where: eq(variants.id, id),
      with: { filament: true, skuMappings: true, nfcTagPatterns: true },
    });
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

export async function listSkusByVariant(
  variantId: string,
  params?: PaginationParams
): Promise<ActionResult<SkuMapping[]>> {
  try {
    const q = db
      .select()
      .from(skuMappings)
      .where(eq(skuMappings.variantId, variantId))
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

export async function listPatternsByVariant(
  variantId: string,
  params?: PaginationParams
): Promise<ActionResult<NfcTagPattern[]>> {
  try {
    const q = db
      .select()
      .from(nfcTagPatterns)
      .where(eq(nfcTagPatterns.variantId, variantId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Equivalence Groups ──────────────────────────────────────────────────────

const equivalenceGroupsCrud = createCrudActions<EquivalenceGroup>({
  table: equivalenceGroups,
  insertSchema: insertEquivalenceGroupSchema,
  updateSchema: updateEquivalenceGroupSchema,
});

export async function createEquivalenceGroup(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await equivalenceGroupsCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "equivalence_group", resourceId: result.data.id });
  }
  return result;
}
export async function getEquivalenceGroupById(id: string) {
  return equivalenceGroupsCrud.getById(id);
}
export async function listEquivalenceGroups(params?: PaginationParams) {
  return equivalenceGroupsCrud.list(params);
}
export async function updateEquivalenceGroup(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await equivalenceGroupsCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "equivalence_group", resourceId: result.data.id });
  }
  return result;
}
export async function removeEquivalenceGroup(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await equivalenceGroupsCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "equivalence_group", resourceId: result.data.id });
  }
  return result;
}

export async function getGroupWithFilaments(id: string) {
  try {
    const row = await db.query.equivalenceGroups.findFirst({
      where: eq(equivalenceGroups.id, id),
      with: { filamentEquivalences: { with: { filament: true } } },
    });
    if (!row) return err("Not found");
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Filament Equivalences ───────────────────────────────────────────────────

const filamentEquivalencesCrud = createCrudActions<FilamentEquivalence>({
  table: filamentEquivalences,
  insertSchema: insertFilamentEquivalenceSchema,
  updateSchema: updateFilamentEquivalenceSchema,
});

export async function createFilamentEquivalence(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await filamentEquivalencesCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "filament_equivalence", resourceId: result.data.id });
  }
  return result;
}
export async function getFilamentEquivalenceById(id: string) {
  return filamentEquivalencesCrud.getById(id);
}
export async function listFilamentEquivalences(params?: PaginationParams) {
  return filamentEquivalencesCrud.list(params);
}
export async function updateFilamentEquivalence(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await filamentEquivalencesCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "filament_equivalence", resourceId: result.data.id });
  }
  return result;
}
export async function removeFilamentEquivalence(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await filamentEquivalencesCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "filament_equivalence", resourceId: result.data.id });
  }
  return result;
}

export async function listEquivalencesByGroup(
  groupId: string
): Promise<ActionResult<FilamentEquivalence[]>> {
  try {
    const rows = await db
      .select()
      .from(filamentEquivalences)
      .where(eq(filamentEquivalences.equivalenceGroupId, groupId));
    return ok(rows);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listEquivalencesByFilament(
  filamentId: string
): Promise<ActionResult<FilamentEquivalence[]>> {
  try {
    const rows = await db
      .select()
      .from(filamentEquivalences)
      .where(eq(filamentEquivalences.filamentId, filamentId));
    return ok(rows);
  } catch (e) {
    return err((e as Error).message);
  }
}
