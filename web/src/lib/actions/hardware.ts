"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  zones,
  racks,
  shelves,
  bays,
  slots,
  bayModules,
  slotStatus,
} from "@/db/schema/storage";
import {
  createCrudActions,
  createUpsertActions,
  ok,
  err,
  type ActionResult,
  type PaginationParams,
} from "./utils";
import {
  insertZoneSchema,
  updateZoneSchema,
  insertRackSchema,
  updateRackSchema,
  insertShelfSchema,
  updateShelfSchema,
  insertBaySchema,
  updateBaySchema,
  insertSlotSchema,
  updateSlotSchema,
  insertBayModuleSchema,
  updateBayModuleSchema,
  insertSlotStatusSchema,
} from "./schemas";
import {
  requireAuth,
  requireAdmin,
  requireAuthOrApiKey,
  assertOwnership,
} from "./auth";
import {
  getOwnerByZoneId,
  getOwnerByRackId,
  getOwnerByShelfId,
  getOwnerByBayId,
  getOwnerBySlotId,
} from "./ownership";
import { emitAuditEvent } from "./audit";
import { auditActorType } from "./audit-helpers";

// ── Types ───────────────────────────────────────────────────────────────────

type Zone = InferSelectModel<typeof zones>;
type Rack = InferSelectModel<typeof racks>;
type Shelf = InferSelectModel<typeof shelves>;
type Bay = InferSelectModel<typeof bays>;
type Slot = InferSelectModel<typeof slots>;
type BayModule = InferSelectModel<typeof bayModules>;
type SlotStatus = InferSelectModel<typeof slotStatus>;

// ── Zones ───────────────────────────────────────────────────────────────────

const zonesCrud = createCrudActions<Zone>({
  table: zones,
  insertSchema: insertZoneSchema,
  updateSchema: updateZoneSchema,
});

export async function createZone(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const result = await zonesCrud.create({ ...data, userId: guard.data.userId });
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "zone", resourceId: result.data.id });
  }
  return result;
}
export async function getZoneById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await zonesCrud.getById(id);
  if (result.error !== null) return result;
  const ownership = assertOwnership(guard.data, result.data.userId);
  if (ownership) return ownership;
  return result;
}
export async function listZones(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return zonesCrud.list(params);
}
export async function updateZone(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await zonesCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await zonesCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "zone", resourceId: result.data.id });
  }
  return result;
}
export async function removeZone(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await zonesCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await zonesCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "zone", resourceId: result.data.id });
  }
  return result;
}

export async function listMyZones(
  params?: PaginationParams
): Promise<ActionResult<Zone[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const userId = guard.data.userId;
  try {
    const q = db
      .select()
      .from(zones)
      .where(eq(zones.userId, userId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listZonesByUser(
  userId: string,
  params?: PaginationParams
): Promise<ActionResult<Zone[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(zones)
      .where(eq(zones.userId, userId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Racks ───────────────────────────────────────────────────────────────────

const racksCrud = createCrudActions<Rack>({
  table: racks,
  insertSchema: insertRackSchema,
  updateSchema: updateRackSchema,
});

export async function createRack(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const zoneId = (data as any).zoneId;
  if (!zoneId) return err("zoneId is required");
  const ownerId = await getOwnerByZoneId(zoneId);
  if (!ownerId) return err("Zone not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  const result = await racksCrud.create(data);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "rack", resourceId: result.data.id });
  }
  return result;
}
export async function getRackById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await racksCrud.getById(id);
  if (result.error !== null) return result;
  const ownerId = await getOwnerByZoneId(result.data.zoneId);
  if (!ownerId) return err("Zone not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return result;
}
export async function listRacks(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return racksCrud.list(params);
}
export async function updateRack(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByRackId(id);
  if (!ownerId) return err("Not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  const result = await racksCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "rack", resourceId: result.data.id });
  }
  return result;
}
export async function removeRack(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByRackId(id);
  if (!ownerId) return err("Not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  const result = await racksCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "rack", resourceId: result.data.id });
  }
  return result;
}

export async function listRacksByZone(
  zoneId: string,
  params?: PaginationParams
): Promise<ActionResult<Rack[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByZoneId(zoneId);
  if (!ownerId) return err("Zone not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(racks)
      .where(eq(racks.zoneId, zoneId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function getRackTopology(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const row = await db.query.racks.findFirst({
      where: eq(racks.id, id),
      with: {
        shelves: {
          with: {
            bays: {
              with: {
                slots: {
                  with: { status: true },
                },
              },
            },
          },
        },
      },
    });
    if (!row) return err("Not found");
    const ownerId = await getOwnerByRackId(id);
    if (!ownerId) return err("Not found");
    const ownership = assertOwnership(guard.data, ownerId);
    if (ownership) return ownership;
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Shelves ─────────────────────────────────────────────────────────────────

const shelvesCrud = createCrudActions<Shelf>({
  table: shelves,
  insertSchema: insertShelfSchema,
  updateSchema: updateShelfSchema,
});

export async function createShelf(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const rackId = (data as any).rackId;
  if (!rackId) return err("rackId is required");
  const ownerId = await getOwnerByRackId(rackId);
  if (!ownerId) return err("Rack not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return shelvesCrud.create(data);
}
export async function getShelfById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await shelvesCrud.getById(id);
  if (result.error !== null) return result;
  const ownerId = await getOwnerByShelfId(id);
  if (!ownerId) return err("Not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return result;
}
export async function listShelves(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return shelvesCrud.list(params);
}
export async function updateShelf(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByShelfId(id);
  if (!ownerId) return err("Not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return shelvesCrud.update(id, input);
}
export async function removeShelf(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByShelfId(id);
  if (!ownerId) return err("Not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return shelvesCrud.remove(id);
}

export async function listShelvesByRack(
  rackId: string,
  params?: PaginationParams
): Promise<ActionResult<Shelf[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByRackId(rackId);
  if (!ownerId) return err("Rack not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(shelves)
      .where(eq(shelves.rackId, rackId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Bays ────────────────────────────────────────────────────────────────────

const baysCrud = createCrudActions<Bay>({
  table: bays,
  insertSchema: insertBaySchema,
  updateSchema: updateBaySchema,
});

export async function createBay(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const shelfId = (data as any).shelfId;
  if (!shelfId) return err("shelfId is required");
  const ownerId = await getOwnerByShelfId(shelfId);
  if (!ownerId) return err("Shelf not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return baysCrud.create(data);
}
export async function getBayById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await baysCrud.getById(id);
  if (result.error !== null) return result;
  const ownerId = await getOwnerByBayId(id);
  if (!ownerId) return err("Not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return result;
}
export async function listBays(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return baysCrud.list(params);
}
export async function updateBay(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByBayId(id);
  if (!ownerId) return err("Not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return baysCrud.update(id, input);
}
export async function removeBay(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByBayId(id);
  if (!ownerId) return err("Not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return baysCrud.remove(id);
}

export async function listBaysByShelf(
  shelfId: string,
  params?: PaginationParams
): Promise<ActionResult<Bay[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByShelfId(shelfId);
  if (!ownerId) return err("Shelf not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(bays)
      .where(eq(bays.shelfId, shelfId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Slots ───────────────────────────────────────────────────────────────────

const slotsCrud = createCrudActions<Slot>({
  table: slots,
  insertSchema: insertSlotSchema,
  updateSchema: updateSlotSchema,
});

export async function createSlot(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const bayId = (data as any).bayId;
  if (!bayId) return err("bayId is required");
  const ownerId = await getOwnerByBayId(bayId);
  if (!ownerId) return err("Bay not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return slotsCrud.create(data);
}
export async function getSlotById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await slotsCrud.getById(id);
  if (result.error !== null) return result;
  const ownerId = await getOwnerBySlotId(id);
  if (!ownerId) return err("Not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return result;
}
export async function listSlots(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return slotsCrud.list(params);
}
export async function updateSlot(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerBySlotId(id);
  if (!ownerId) return err("Not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return slotsCrud.update(id, input);
}
export async function removeSlot(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerBySlotId(id);
  if (!ownerId) return err("Not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return slotsCrud.remove(id);
}

export async function listSlotsByBay(
  bayId: string,
  params?: PaginationParams
): Promise<ActionResult<Slot[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByBayId(bayId);
  if (!ownerId) return err("Bay not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(slots)
      .where(eq(slots.bayId, bayId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Bay Modules ─────────────────────────────────────────────────────────────

const bayModulesCrud = createCrudActions<BayModule>({
  table: bayModules,
  insertSchema: insertBayModuleSchema,
  updateSchema: updateBayModuleSchema,
});

export async function createBayModule(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const bayId = (data as any).bayId;
  if (!bayId) return err("bayId is required");
  const ownerId = await getOwnerByBayId(bayId);
  if (!ownerId) return err("Bay not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return bayModulesCrud.create(data);
}
export async function getBayModuleById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return bayModulesCrud.getById(id);
}
export async function listBayModules(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return bayModulesCrud.list(params);
}
export async function updateBayModule(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return bayModulesCrud.update(id, input);
}
export async function removeBayModule(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return bayModulesCrud.remove(id);
}

export async function getBayModuleByHardwareId(
  hardwareId: string
): Promise<ActionResult<BayModule>> {
  const guard = await requireAuthOrApiKey();
  if (guard.error !== null) return guard;
  try {
    const [row] = await db
      .select()
      .from(bayModules)
      .where(eq(bayModules.hardwareId, hardwareId));
    if (!row) return err("Not found");
    const ownerId = await getOwnerByBayId(row.bayId);
    if (!ownerId) return err("Bay not found");
    const ownership = assertOwnership(guard.data, ownerId);
    if (ownership) return ownership;
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listBayModulesByBay(
  bayId: string,
  params?: PaginationParams
): Promise<ActionResult<BayModule[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByBayId(bayId);
  if (!ownerId) return err("Bay not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(bayModules)
      .where(eq(bayModules.bayId, bayId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Slot Status (upsert) ───────────────────────────────────────────────────

const slotStatusActions = createUpsertActions<SlotStatus>({
  table: slotStatus,
  insertSchema: insertSlotStatusSchema,
  conflictTarget: slotStatus.slotId,
});

export async function upsertSlotStatus(input: unknown) {
  const guard = await requireAuthOrApiKey();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const slotId = (data as any).slotId;
  if (!slotId) return err("slotId is required");
  const ownerId = await getOwnerBySlotId(slotId);
  if (!ownerId) return err("Slot not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return slotStatusActions.upsert(input);
}

export async function getSlotStatusBySlotId(
  slotId: string
): Promise<ActionResult<SlotStatus>> {
  const guard = await requireAuthOrApiKey();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerBySlotId(slotId);
  if (!ownerId) return err("Slot not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const [row] = await db
      .select()
      .from(slotStatus)
      .where(eq(slotStatus.slotId, slotId));
    if (!row) return err("Not found");
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}
