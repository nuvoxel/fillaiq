"use server";

import { db } from "@/db";
import { eq, and, desc, type SQL } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  users,
  userItems,
  machines,
  machineToolHeads,
  machineWorkSurfaces,
  machineMaterialSlots,
  machineAccessories,
  userPrintProfiles,
  equipment,
  labelTemplates,
  printJobs,
  userPrinters,
} from "@/db/schema/user-library";
import { scanStations } from "@/db/schema/scan-stations";
import {
  createCrudActions,
  ok,
  err,
  type ActionResult,
  type PaginationParams,
} from "./utils";
import {
  insertUserSchema,
  updateUserSchema,
  insertUserItemSchema,
  updateUserItemSchema,
  insertMachineSchema,
  updateMachineSchema,
  insertMachineToolHeadSchema,
  updateMachineToolHeadSchema,
  insertMachineWorkSurfaceSchema,
  updateMachineWorkSurfaceSchema,
  insertMachineMaterialSlotSchema,
  updateMachineMaterialSlotSchema,
  insertMachineAccessorySchema,
  updateMachineAccessorySchema,
  insertUserPrintProfileSchema,
  updateUserPrintProfileSchema,
  insertEquipmentSchema,
  updateEquipmentSchema,
  insertLabelTemplateSchema,
  updateLabelTemplateSchema,
} from "./schemas";
import { requireAuth, requireAdmin, assertOwnership } from "./auth";
import { emitAuditEvent } from "./audit";
import { auditActorType } from "./audit-helpers";

// ── Types ───────────────────────────────────────────────────────────────────

type User = InferSelectModel<typeof users>;
type UserItem = InferSelectModel<typeof userItems>;
type Machine = InferSelectModel<typeof machines>;
type MachineToolHead = InferSelectModel<typeof machineToolHeads>;
type MachineWorkSurface = InferSelectModel<typeof machineWorkSurfaces>;
type MachineMaterialSlot = InferSelectModel<typeof machineMaterialSlots>;
type MachineAccessory = InferSelectModel<typeof machineAccessories>;
type UserPrintProfile = InferSelectModel<typeof userPrintProfiles>;
type Equipment = InferSelectModel<typeof equipment>;
type LabelTemplate = InferSelectModel<typeof labelTemplates>;

// ── Users ───────────────────────────────────────────────────────────────────

const usersCrud = createCrudActions<User>({
  table: users,
  insertSchema: insertUserSchema,
  updateSchema: updateUserSchema,
});

export async function createUser(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await usersCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "user", resourceId: result.data.id });
  }
  return result;
}
export async function getUserById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, id);
  if (ownership) return ownership;
  return usersCrud.getById(id);
}
export async function listUsers(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return usersCrud.list(params);
}
export async function updateUser(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, id);
  if (ownership) return ownership;
  const result = await usersCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "user", resourceId: result.data.id });
  }
  return result;
}
export async function removeUser(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await usersCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "user", resourceId: result.data.id });
  }
  return result;
}

export async function getUserByEmail(
  email: string
): Promise<ActionResult<User>> {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  try {
    const [row] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));
    if (!row) return err("Not found");
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── User Items ──────────────────────────────────────────────────────────────

const userItemsCrud = createCrudActions<UserItem>({
  table: userItems,
  insertSchema: insertUserItemSchema,
  updateSchema: updateUserItemSchema,
});

export async function createUserItem(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const result = await userItemsCrud.create({ ...data, userId: guard.data.userId });
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "user_item", resourceId: result.data.id });
  }
  return result;
}
export async function getUserItemById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await userItemsCrud.getById(id);
  if (result.error !== null) return result;
  const ownership = assertOwnership(guard.data, result.data.userId);
  if (ownership) return ownership;
  return result;
}
export async function listUserItems(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return userItemsCrud.list(params);
}
export async function updateUserItem(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await userItemsCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await userItemsCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "user_item", resourceId: result.data.id });
  }
  return result;
}
export async function removeUserItem(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await userItemsCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await userItemsCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "user_item", resourceId: result.data.id });
  }
  return result;
}

export async function listMyItems(
  params?: PaginationParams & { status?: string }
): Promise<ActionResult<UserItem[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const conditions: SQL[] = [eq(userItems.userId, guard.data.userId)];
    if (params?.status) {
      conditions.push(eq(userItems.status, params.status as any));
    }
    const q = db
      .select()
      .from(userItems)
      .where(and(...conditions))
      .orderBy(desc(userItems.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listUserItemsByUser(
  userId: string,
  params?: PaginationParams & { status?: string }
): Promise<ActionResult<UserItem[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const conditions: SQL[] = [eq(userItems.userId, userId)];
    if (params?.status) {
      conditions.push(eq(userItems.status, params.status as any));
    }
    const q = db
      .select()
      .from(userItems)
      .where(and(...conditions))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function getUserItemWithRelations(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const row = await db.query.userItems.findFirst({
      where: eq(userItems.id, id),
      with: { product: true, currentSlot: true },
    });
    if (!row) return err("Not found");
    const ownership = assertOwnership(guard.data, row.userId);
    if (ownership) return ownership;
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Machines ────────────────────────────────────────────────────────────────

const machinesCrud = createCrudActions<Machine>({
  table: machines,
  insertSchema: insertMachineSchema,
  updateSchema: updateMachineSchema,
});

export async function createMachine(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const result = await machinesCrud.create({ ...data, userId: guard.data.userId });
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "machine", resourceId: result.data.id });
  }
  return result;
}
export async function getMachineById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await machinesCrud.getById(id);
  if (result.error !== null) return result;
  const ownership = assertOwnership(guard.data, result.data.userId);
  if (ownership) return ownership;
  return result;
}
export async function listMachines(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return machinesCrud.list(params);
}
export async function updateMachine(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await machinesCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await machinesCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "machine", resourceId: result.data.id });
  }
  return result;
}
export async function removeMachine(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await machinesCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await machinesCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "machine", resourceId: result.data.id });
  }
  return result;
}

export async function getMachineWithRelations(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const row = await db.query.machines.findFirst({
      where: eq(machines.id, id),
      with: { toolHeads: true, workSurfaces: true, materialSlots: true, accessories: true },
    });
    if (!row) return err("Not found");
    const ownership = assertOwnership(guard.data, row.userId);
    if (ownership) return ownership;
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listMachinesByUser(
  userId: string,
  params?: PaginationParams
): Promise<ActionResult<Machine[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(machines)
      .where(eq(machines.userId, userId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Machine Tool Heads ──────────────────────────────────────────────────────

const toolHeadsCrud = createCrudActions<MachineToolHead>({
  table: machineToolHeads,
  insertSchema: insertMachineToolHeadSchema,
  updateSchema: updateMachineToolHeadSchema,
});

export async function createMachineToolHead(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return toolHeadsCrud.create(input);
}
export async function updateMachineToolHead(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return toolHeadsCrud.update(id, input);
}
export async function removeMachineToolHead(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return toolHeadsCrud.remove(id);
}
export async function listToolHeadsByMachine(
  machineId: string,
  params?: PaginationParams
): Promise<ActionResult<MachineToolHead[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const q = db
      .select()
      .from(machineToolHeads)
      .where(eq(machineToolHeads.machineId, machineId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Machine Work Surfaces ───────────────────────────────────────────────────

const workSurfacesCrud = createCrudActions<MachineWorkSurface>({
  table: machineWorkSurfaces,
  insertSchema: insertMachineWorkSurfaceSchema,
  updateSchema: updateMachineWorkSurfaceSchema,
});

export async function createMachineWorkSurface(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return workSurfacesCrud.create(input);
}
export async function updateMachineWorkSurface(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return workSurfacesCrud.update(id, input);
}
export async function removeMachineWorkSurface(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return workSurfacesCrud.remove(id);
}
export async function listWorkSurfacesByMachine(
  machineId: string,
  params?: PaginationParams
): Promise<ActionResult<MachineWorkSurface[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const q = db
      .select()
      .from(machineWorkSurfaces)
      .where(eq(machineWorkSurfaces.machineId, machineId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Machine Material Slots ──────────────────────────────────────────────────

const materialSlotsCrud = createCrudActions<MachineMaterialSlot>({
  table: machineMaterialSlots,
  insertSchema: insertMachineMaterialSlotSchema,
  updateSchema: updateMachineMaterialSlotSchema,
});

export async function createMachineMaterialSlot(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return materialSlotsCrud.create(input);
}
export async function updateMachineMaterialSlot(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return materialSlotsCrud.update(id, input);
}
export async function removeMachineMaterialSlot(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return materialSlotsCrud.remove(id);
}
export async function listMaterialSlotsByMachine(
  machineId: string,
  params?: PaginationParams
): Promise<ActionResult<MachineMaterialSlot[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const q = db
      .select()
      .from(machineMaterialSlots)
      .where(eq(machineMaterialSlots.machineId, machineId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Machine Accessories ─────────────────────────────────────────────────────

const accessoriesCrud = createCrudActions<MachineAccessory>({
  table: machineAccessories,
  insertSchema: insertMachineAccessorySchema,
  updateSchema: updateMachineAccessorySchema,
});

export async function createMachineAccessory(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return accessoriesCrud.create(input);
}
export async function updateMachineAccessory(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return accessoriesCrud.update(id, input);
}
export async function removeMachineAccessory(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  return accessoriesCrud.remove(id);
}
export async function listAccessoriesByMachine(
  machineId: string,
  params?: PaginationParams
): Promise<ActionResult<MachineAccessory[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const q = db
      .select()
      .from(machineAccessories)
      .where(eq(machineAccessories.machineId, machineId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── User Print Profiles ─────────────────────────────────────────────────────

const profilesCrud = createCrudActions<UserPrintProfile>({
  table: userPrintProfiles,
  insertSchema: insertUserPrintProfileSchema,
  updateSchema: updateUserPrintProfileSchema,
});

export async function createUserPrintProfile(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  return profilesCrud.create({ ...data, userId: guard.data.userId });
}
export async function getUserPrintProfileById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await profilesCrud.getById(id);
  if (result.error !== null) return result;
  const ownership = assertOwnership(guard.data, result.data.userId);
  if (ownership) return ownership;
  return result;
}
export async function listUserPrintProfiles(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return profilesCrud.list(params);
}
export async function updateUserPrintProfile(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await profilesCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  return profilesCrud.update(id, input);
}
export async function removeUserPrintProfile(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await profilesCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  return profilesCrud.remove(id);
}

export async function listProfilesByUser(
  userId: string,
  params?: PaginationParams
): Promise<ActionResult<UserPrintProfile[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(userPrintProfiles)
      .where(eq(userPrintProfiles.userId, userId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listProfilesByProduct(
  productId: string,
  params?: PaginationParams
): Promise<ActionResult<UserPrintProfile[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const q = db
      .select()
      .from(userPrintProfiles)
      .where(eq(userPrintProfiles.productId, productId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Equipment ───────────────────────────────────────────────────────────────

const equipmentCrud = createCrudActions<Equipment>({
  table: equipment,
  insertSchema: insertEquipmentSchema,
  updateSchema: updateEquipmentSchema,
});

export async function createEquipment(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const result = await equipmentCrud.create({ ...data, userId: guard.data.userId });
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "equipment", resourceId: result.data.id });
  }
  return result;
}
export async function getEquipmentById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await equipmentCrud.getById(id);
  if (result.error !== null) return result;
  const ownership = assertOwnership(guard.data, result.data.userId);
  if (ownership) return ownership;
  return result;
}
export async function listEquipment(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return equipmentCrud.list(params);
}
export async function updateEquipment(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await equipmentCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await equipmentCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "equipment", resourceId: result.data.id });
  }
  return result;
}
export async function removeEquipment(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await equipmentCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await equipmentCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "equipment", resourceId: result.data.id });
  }
  return result;
}

export async function listEquipmentByUser(
  userId: string,
  params?: PaginationParams
): Promise<ActionResult<Equipment[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(equipment)
      .where(eq(equipment.userId, userId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Label Templates ─────────────────────────────────────────────────────────

const labelTemplatesCrud = createCrudActions<LabelTemplate>({
  table: labelTemplates,
  insertSchema: insertLabelTemplateSchema,
  updateSchema: updateLabelTemplateSchema,
});

export async function createLabelTemplate(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  return labelTemplatesCrud.create({ ...data, userId: guard.data.userId });
}
export async function getLabelTemplateById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await labelTemplatesCrud.getById(id);
  if (result.error !== null) return result;
  const ownership = assertOwnership(guard.data, result.data.userId);
  if (ownership) return ownership;
  return result;
}
export async function listLabelTemplates(params?: PaginationParams) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const q = db
      .select()
      .from(labelTemplates)
      .where(eq(labelTemplates.userId, guard.data.userId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}
export async function updateLabelTemplate(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await labelTemplatesCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  return labelTemplatesCrud.update(id, input);
}
export async function removeLabelTemplate(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await labelTemplatesCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  return labelTemplatesCrud.remove(id);
}

export async function listTemplatesByUser(
  userId: string,
  params?: PaginationParams
): Promise<ActionResult<LabelTemplate[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(labelTemplates)
      .where(eq(labelTemplates.userId, userId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function getDefaultTemplate(
  userId: string
): Promise<ActionResult<LabelTemplate>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const [row] = await db
      .select()
      .from(labelTemplates)
      .where(
        and(
          eq(labelTemplates.userId, userId),
          eq(labelTemplates.isDefault, true)
        )
      );
    if (!row) return err("Not found");
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Printers ─────────────────────────────────────────────────────────────────

type UserPrinter = InferSelectModel<typeof userPrinters>;

export async function listMyPrinters(
  params?: PaginationParams
): Promise<ActionResult<UserPrinter[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const q = db
      .select()
      .from(userPrinters)
      .where(eq(userPrinters.userId, guard.data.userId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Scan Stations (for print target selection) ───────────────────────────────

export async function listMyStations(): Promise<ActionResult<any[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const rows = await db
      .select()
      .from(scanStations)
      .where(eq(scanStations.userId, guard.data.userId));
    return ok(rows);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Print Jobs ───────────────────────────────────────────────────────────────

type PrintJob = InferSelectModel<typeof printJobs>;

export async function createPrintJob(input: {
  templateId?: string;
  stationId?: string;
  labelData: Record<string, any>;
  copies?: number;
}): Promise<ActionResult<PrintJob>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const [row] = await db
      .insert(printJobs)
      .values({
        userId: guard.data.userId,
        templateId: input.templateId ?? null,
        stationId: input.stationId ?? null,
        labelData: input.labelData,
        copies: input.copies ?? 1,
      })
      .returning();
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function createBatchPrintJobs(
  jobs: Array<{
    templateId?: string;
    stationId?: string;
    labelData: Record<string, any>;
  }>
): Promise<ActionResult<PrintJob[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const rows = await db
      .insert(printJobs)
      .values(
        jobs.map((j) => ({
          userId: guard.data.userId,
          templateId: j.templateId ?? null,
          stationId: j.stationId ?? null,
          labelData: j.labelData,
          copies: 1,
        }))
      )
      .returning();
    return ok(rows);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listMyPrintJobs(
  params?: PaginationParams
): Promise<ActionResult<PrintJob[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const q = db
      .select()
      .from(printJobs)
      .where(eq(printJobs.userId, guard.data.userId))
      .orderBy(desc(printJobs.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function cancelPrintJob(id: string): Promise<ActionResult<PrintJob>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const [existing] = await db.select().from(printJobs).where(eq(printJobs.id, id));
    if (!existing) return err("Not found");
    const ownership = assertOwnership(guard.data, existing.userId);
    if (ownership) return ownership;
    if (existing.status !== "pending") return err("Can only cancel pending jobs");
    const [row] = await db
      .update(printJobs)
      .set({ status: "cancelled" })
      .where(eq(printJobs.id, id))
      .returning();
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}
