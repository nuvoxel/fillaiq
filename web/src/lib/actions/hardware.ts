"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  racks,
  bridges,
  shelves,
  bays,
  slots,
  slotStatus,
} from "@/db/schema/hardware";
import {
  createCrudActions,
  createUpsertActions,
  ok,
  err,
  type ActionResult,
  type PaginationParams,
} from "./utils";
import {
  insertRackSchema,
  updateRackSchema,
  insertBridgeSchema,
  updateBridgeSchema,
  insertShelfSchema,
  updateShelfSchema,
  insertBaySchema,
  updateBaySchema,
  insertSlotSchema,
  updateSlotSchema,
  insertSlotStatusSchema,
} from "./schemas";
import {
  requireAuth,
  requireAdmin,
  requireAuthOrApiKey,
  assertOwnership,
} from "./auth";
import {
  getOwnerByRackId,
  getOwnerByShelfId,
  getOwnerByBayId,
  getOwnerBySlotId,
} from "./ownership";
import { emitAuditEvent } from "./audit";
import { auditActorType } from "./audit-helpers";

// ── Types ───────────────────────────────────────────────────────────────────

type Rack = InferSelectModel<typeof racks>;
type Bridge = InferSelectModel<typeof bridges>;
type Shelf = InferSelectModel<typeof shelves>;
type Bay = InferSelectModel<typeof bays>;
type Slot = InferSelectModel<typeof slots>;
type SlotStatus = InferSelectModel<typeof slotStatus>;

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
  const result = await racksCrud.create({ ...data, userId: guard.data.userId });
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
  const ownership = assertOwnership(guard.data, result.data.userId);
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
  const existing = await racksCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
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
  const existing = await racksCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await racksCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "rack", resourceId: result.data.id });
  }
  return result;
}

export async function listRacksByUser(
  userId: string,
  params?: PaginationParams
): Promise<ActionResult<Rack[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(racks)
      .where(eq(racks.userId, userId))
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
    const ownership = assertOwnership(guard.data, row.userId);
    if (ownership) return ownership;
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Bridges ─────────────────────────────────────────────────────────────────

const bridgesCrud = createCrudActions<Bridge>({
  table: bridges,
  insertSchema: insertBridgeSchema,
  updateSchema: updateBridgeSchema,
});

export async function createBridge(input: unknown) {
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
  return bridgesCrud.create(data);
}
export async function getBridgeById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await bridgesCrud.getById(id);
  if (result.error !== null) return result;
  const ownerId = await getOwnerByRackId(result.data.rackId);
  if (!ownerId) return err("Rack not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return result;
}
export async function listBridges(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return bridgesCrud.list(params);
}
export async function updateBridge(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await bridgesCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownerId = await getOwnerByRackId(existing.data.rackId);
  if (!ownerId) return err("Rack not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return bridgesCrud.update(id, input);
}
export async function removeBridge(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await bridgesCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownerId = await getOwnerByRackId(existing.data.rackId);
  if (!ownerId) return err("Rack not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return bridgesCrud.remove(id);
}

export async function listBridgesByRack(
  rackId: string,
  params?: PaginationParams
): Promise<ActionResult<Bridge[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByRackId(rackId);
  if (!ownerId) return err("Rack not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(bridges)
      .where(eq(bridges.rackId, rackId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function getBridgeByHardwareId(
  hardwareId: string
): Promise<ActionResult<Bridge>> {
  const guard = await requireAuthOrApiKey();
  if (guard.error !== null) return guard;
  try {
    const [row] = await db
      .select()
      .from(bridges)
      .where(eq(bridges.hardwareId, hardwareId));
    if (!row) return err("Not found");
    const ownerId = await getOwnerByRackId(row.rackId);
    if (!ownerId) return err("Rack not found");
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
