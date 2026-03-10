"use server";

import { db } from "@/db";
import { eq, and, gte, lte, desc, type SQL } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  weightEvents,
  itemMovements,
  usageSessions,
  dryingSessions,
  environmentalReadings,
} from "@/db/schema/events";
import {
  createAppendOnlyActions,
  createCrudActions,
  ok,
  err,
  type ActionResult,
  type PaginationParams,
} from "./utils";
import {
  insertWeightEventSchema,
  insertItemMovementSchema,
  insertEnvironmentalReadingSchema,
  insertUsageSessionSchema,
  updateUsageSessionSchema,
  insertDryingSessionSchema,
  updateDryingSessionSchema,
} from "./schemas";
import {
  requireAuth,
  requireAdmin,
  requireAuthOrApiKey,
  assertOwnership,
} from "./auth";
import {
  getOwnerByUserItemId,
  getOwnerBySlotId,
  getOwnerByShelfId,
} from "./ownership";

// ── Types ───────────────────────────────────────────────────────────────────

type WeightEvent = InferSelectModel<typeof weightEvents>;
type ItemMovement = InferSelectModel<typeof itemMovements>;
type UsageSession = InferSelectModel<typeof usageSessions>;
type DryingSession = InferSelectModel<typeof dryingSessions>;
type EnvironmentalReading = InferSelectModel<typeof environmentalReadings>;

type TimeRangeParams = PaginationParams & { from?: Date; to?: Date };

// ── Weight Events (append-only) ─────────────────────────────────────────────

const weightEventActions = createAppendOnlyActions<WeightEvent>({
  table: weightEvents,
  insertSchema: insertWeightEventSchema,
});

export async function createWeightEvent(input: unknown) {
  const guard = await requireAuthOrApiKey();
  if (guard.error !== null) return guard;
  return weightEventActions.create(input);
}
export async function listWeightEvents(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return weightEventActions.list(params);
}

export async function listWeightEventsByUserItemId(
  userItemId: string,
  params?: TimeRangeParams
): Promise<ActionResult<WeightEvent[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByUserItemId(userItemId);
  if (!ownerId) return err("User item not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const conditions: SQL[] = [eq(weightEvents.userItemId, userItemId)];
    if (params?.from) conditions.push(gte(weightEvents.createdAt, params.from));
    if (params?.to) conditions.push(lte(weightEvents.createdAt, params.to));
    const q = db
      .select()
      .from(weightEvents)
      .where(and(...conditions))
      .orderBy(desc(weightEvents.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listWeightEventsBySlotId(
  slotId: string,
  params?: TimeRangeParams
): Promise<ActionResult<WeightEvent[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerBySlotId(slotId);
  if (!ownerId) return err("Slot not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const conditions: SQL[] = [eq(weightEvents.slotId, slotId)];
    if (params?.from) conditions.push(gte(weightEvents.createdAt, params.from));
    if (params?.to) conditions.push(lte(weightEvents.createdAt, params.to));
    const q = db
      .select()
      .from(weightEvents)
      .where(and(...conditions))
      .orderBy(desc(weightEvents.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Item Movements (append-only) ─────────────────────────────────────────────

const itemMovementActions = createAppendOnlyActions<ItemMovement>({
  table: itemMovements,
  insertSchema: insertItemMovementSchema,
});

export async function createItemMovement(input: unknown) {
  const guard = await requireAuthOrApiKey();
  if (guard.error !== null) return guard;
  return itemMovementActions.create(input);
}
export async function listItemMovements(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return itemMovementActions.list(params);
}

export async function listItemMovementsByUserItemId(
  userItemId: string,
  params?: PaginationParams
): Promise<ActionResult<ItemMovement[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByUserItemId(userItemId);
  if (!ownerId) return err("User item not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(itemMovements)
      .where(eq(itemMovements.userItemId, userItemId))
      .orderBy(desc(itemMovements.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Usage Sessions (create + update, no delete) ─────────────────────────────

const usageSessionsCrud = createCrudActions<UsageSession>({
  table: usageSessions,
  insertSchema: insertUsageSessionSchema,
  updateSchema: updateUsageSessionSchema,
  setUpdatedAt: false,
});

export async function createUsageSession(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  return usageSessionsCrud.create({ ...data, userId: guard.data.userId });
}
export async function getUsageSessionById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await usageSessionsCrud.getById(id);
  if (result.error !== null) return result;
  const ownerId = await getOwnerByUserItemId(result.data.userItemId);
  if (!ownerId) return err("User item not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return result;
}
export async function updateUsageSession(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await usageSessionsCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownerId = await getOwnerByUserItemId(existing.data.userItemId);
  if (!ownerId) return err("User item not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return usageSessionsCrud.update(id, input);
}

export async function listUsageSessionsByUserItemId(
  userItemId: string,
  params?: PaginationParams
): Promise<ActionResult<UsageSession[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByUserItemId(userItemId);
  if (!ownerId) return err("User item not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(usageSessions)
      .where(eq(usageSessions.userItemId, userItemId))
      .orderBy(desc(usageSessions.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listUsageSessionsByUser(
  userId: string,
  params?: PaginationParams
): Promise<ActionResult<UsageSession[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(usageSessions)
      .where(eq(usageSessions.userId, userId))
      .orderBy(desc(usageSessions.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Drying Sessions (create + update, no delete) ────────────────────────────

const dryingSessionsCrud = createCrudActions<DryingSession>({
  table: dryingSessions,
  insertSchema: insertDryingSessionSchema,
  updateSchema: updateDryingSessionSchema,
  setUpdatedAt: false,
});

export async function createDryingSession(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  return dryingSessionsCrud.create({ ...data, userId: guard.data.userId });
}
export async function getDryingSessionById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await dryingSessionsCrud.getById(id);
  if (result.error !== null) return result;
  const ownerId = await getOwnerByUserItemId(result.data.userItemId);
  if (!ownerId) return err("User item not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return result;
}
export async function updateDryingSession(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await dryingSessionsCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownerId = await getOwnerByUserItemId(existing.data.userItemId);
  if (!ownerId) return err("User item not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  return dryingSessionsCrud.update(id, input);
}

export async function listDryingSessionsByUserItemId(
  userItemId: string,
  params?: PaginationParams
): Promise<ActionResult<DryingSession[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByUserItemId(userItemId);
  if (!ownerId) return err("User item not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(dryingSessions)
      .where(eq(dryingSessions.userItemId, userItemId))
      .orderBy(desc(dryingSessions.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listDryingSessionsByUser(
  userId: string,
  params?: PaginationParams
): Promise<ActionResult<DryingSession[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(dryingSessions)
      .where(eq(dryingSessions.userId, userId))
      .orderBy(desc(dryingSessions.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Environmental Readings (append-only) ────────────────────────────────────

const envReadingsActions = createAppendOnlyActions<EnvironmentalReading>({
  table: environmentalReadings,
  insertSchema: insertEnvironmentalReadingSchema,
});

export async function createEnvironmentalReading(input: unknown) {
  const guard = await requireAuthOrApiKey();
  if (guard.error !== null) return guard;
  return envReadingsActions.create(input);
}
export async function listEnvironmentalReadings(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return envReadingsActions.list(params);
}

export async function listEnvironmentalReadingsByShelfId(
  shelfId: string,
  params?: TimeRangeParams
): Promise<ActionResult<EnvironmentalReading[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownerId = await getOwnerByShelfId(shelfId);
  if (!ownerId) return err("Shelf not found");
  const ownership = assertOwnership(guard.data, ownerId);
  if (ownership) return ownership;
  try {
    const conditions: SQL[] = [eq(environmentalReadings.shelfId, shelfId)];
    if (params?.from)
      conditions.push(gte(environmentalReadings.createdAt, params.from));
    if (params?.to)
      conditions.push(lte(environmentalReadings.createdAt, params.to));
    const q = db
      .select()
      .from(environmentalReadings)
      .where(and(...conditions))
      .orderBy(desc(environmentalReadings.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}
