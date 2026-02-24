"use server";

import { db } from "@/db";
import { eq, and, type SQL } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import {
  users,
  spools,
  printers,
  userPrintProfiles,
  equipment,
  labelTemplates,
} from "@/db/schema/user-library";
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
  insertSpoolSchema,
  updateSpoolSchema,
  insertPrinterSchema,
  updatePrinterSchema,
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
type Spool = InferSelectModel<typeof spools>;
type Printer = InferSelectModel<typeof printers>;
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

// ── Spools ──────────────────────────────────────────────────────────────────

const spoolsCrud = createCrudActions<Spool>({
  table: spools,
  insertSchema: insertSpoolSchema,
  updateSchema: updateSpoolSchema,
});

export async function createSpool(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const result = await spoolsCrud.create({ ...data, userId: guard.data.userId });
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "spool", resourceId: result.data.id });
  }
  return result;
}
export async function getSpoolById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await spoolsCrud.getById(id);
  if (result.error !== null) return result;
  const ownership = assertOwnership(guard.data, result.data.userId);
  if (ownership) return ownership;
  return result;
}
export async function listSpools(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return spoolsCrud.list(params);
}
export async function updateSpool(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await spoolsCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await spoolsCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "spool", resourceId: result.data.id });
  }
  return result;
}
export async function removeSpool(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await spoolsCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await spoolsCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "spool", resourceId: result.data.id });
  }
  return result;
}

export async function listSpoolsByUser(
  userId: string,
  params?: PaginationParams & { status?: string }
): Promise<ActionResult<Spool[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const conditions: SQL[] = [eq(spools.userId, userId)];
    if (params?.status) {
      conditions.push(eq(spools.status, params.status as any));
    }
    const q = db
      .select()
      .from(spools)
      .where(and(...conditions))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function getSpoolWithRelations(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const row = await db.query.spools.findFirst({
      where: eq(spools.id, id),
      with: { variant: true, filament: true, currentSlot: true },
    });
    if (!row) return err("Not found");
    const ownership = assertOwnership(guard.data, row.userId);
    if (ownership) return ownership;
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Printers ────────────────────────────────────────────────────────────────

const printersCrud = createCrudActions<Printer>({
  table: printers,
  insertSchema: insertPrinterSchema,
  updateSchema: updatePrinterSchema,
});

export async function createPrinter(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const result = await printersCrud.create({ ...data, userId: guard.data.userId });
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "printer", resourceId: result.data.id });
  }
  return result;
}
export async function getPrinterById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await printersCrud.getById(id);
  if (result.error !== null) return result;
  const ownership = assertOwnership(guard.data, result.data.userId);
  if (ownership) return ownership;
  return result;
}
export async function listPrinters(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return printersCrud.list(params);
}
export async function updatePrinter(id: string, input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await printersCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await printersCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "printer", resourceId: result.data.id });
  }
  return result;
}
export async function removePrinter(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const existing = await printersCrud.getById(id);
  if (existing.error !== null) return existing;
  const ownership = assertOwnership(guard.data, existing.data.userId);
  if (ownership) return ownership;
  const result = await printersCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "printer", resourceId: result.data.id });
  }
  return result;
}

export async function listPrintersByUser(
  userId: string,
  params?: PaginationParams
): Promise<ActionResult<Printer[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(printers)
      .where(eq(printers.userId, userId))
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

export async function listProfilesByFilament(
  filamentId: string,
  params?: PaginationParams
): Promise<ActionResult<UserPrintProfile[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  try {
    const q = db
      .select()
      .from(userPrintProfiles)
      .where(eq(userPrintProfiles.filamentId, filamentId))
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
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return labelTemplatesCrud.list(params);
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
