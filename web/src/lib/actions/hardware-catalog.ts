"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { hardwareModels, hardwareIdentifiers } from "@/db/schema/hardware";
import {
  createCrudActions,
  ok,
  err,
  type ActionResult,
  type PaginationParams,
} from "./utils";
import {
  insertHardwareModelSchema,
  updateHardwareModelSchema,
  insertHardwareIdentifierSchema,
  updateHardwareIdentifierSchema,
} from "./schemas";
import { requireAdmin } from "./auth";
import { emitAuditEvent } from "./audit";
import { auditActorType } from "./audit-helpers";

// ── Types ───────────────────────────────────────────────────────────────────

type HardwareModel = InferSelectModel<typeof hardwareModels>;
type HardwareIdentifier = InferSelectModel<typeof hardwareIdentifiers>;

// ── Hardware Models ─────────────────────────────────────────────────────────

const modelsCrud = createCrudActions<HardwareModel>({
  table: hardwareModels,
  insertSchema: insertHardwareModelSchema,
  updateSchema: updateHardwareModelSchema,
});

export async function createHardwareModel(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await modelsCrud.create(input);
  if (result.error === null) {
    emitAuditEvent({
      actorId: guard.data.userId,
      actorType: auditActorType(guard.data),
      action: "create",
      resourceType: "hardware_model",
      resourceId: result.data.id,
    });
  }
  return result;
}

export async function updateHardwareModel(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await modelsCrud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({
      actorId: guard.data.userId,
      actorType: auditActorType(guard.data),
      action: "update",
      resourceType: "hardware_model",
      resourceId: result.data.id,
    });
  }
  return result;
}

export async function removeHardwareModel(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  // Delete identifiers first
  await db
    .delete(hardwareIdentifiers)
    .where(eq(hardwareIdentifiers.hardwareModelId, id));
  const result = await modelsCrud.remove(id);
  if (result.error === null) {
    emitAuditEvent({
      actorId: guard.data.userId,
      actorType: auditActorType(guard.data),
      action: "delete",
      resourceType: "hardware_model",
      resourceId: result.data.id,
    });
  }
  return result;
}

export async function listHardwareModels(
  params?: PaginationParams
): Promise<ActionResult<HardwareModel[]>> {
  return modelsCrud.list(params);
}

export async function getHardwareModel(
  id: string
): Promise<ActionResult<HardwareModel>> {
  return modelsCrud.getById(id);
}

// ── Hardware Identifiers ────────────────────────────────────────────────────

const identifiersCrud = createCrudActions<HardwareIdentifier>({
  table: hardwareIdentifiers,
  insertSchema: insertHardwareIdentifierSchema,
  updateSchema: updateHardwareIdentifierSchema,
});

export async function listIdentifiersForModel(
  hardwareModelId: string
): Promise<ActionResult<HardwareIdentifier[]>> {
  try {
    const rows = await db
      .select()
      .from(hardwareIdentifiers)
      .where(eq(hardwareIdentifiers.hardwareModelId, hardwareModelId));
    return ok(rows);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function createHardwareIdentifier(input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return identifiersCrud.create(input);
}

export async function removeHardwareIdentifier(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return identifiersCrud.remove(id);
}
