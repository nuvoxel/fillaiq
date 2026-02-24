"use server";

import { db } from "@/db";
import { eq } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { catalogSubmissions } from "@/db/schema/submissions";
import {
  createCrudActions,
  ok,
  err,
  type ActionResult,
  type PaginationParams,
} from "./utils";
import {
  insertCatalogSubmissionSchema,
  updateCatalogSubmissionSchema,
} from "./schemas";
import { requireAuth, requireAdmin, assertOwnership } from "./auth";
import { emitAuditEvent } from "./audit";
import { auditActorType } from "./audit-helpers";

type CatalogSubmission = InferSelectModel<typeof catalogSubmissions>;

const crud = createCrudActions<CatalogSubmission>({
  table: catalogSubmissions,
  insertSchema: insertCatalogSubmissionSchema,
  updateSchema: updateCatalogSubmissionSchema,
});

export async function createCatalogSubmission(input: unknown) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const data =
    typeof input === "object" && input !== null ? input : {};
  const result = await crud.create({ ...data, userId: guard.data.userId });
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "create", resourceType: "catalog_submission", resourceId: result.data.id });
  }
  return result;
}
export async function getCatalogSubmissionById(id: string) {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const result = await crud.getById(id);
  if (result.error !== null) return result;
  const ownership = assertOwnership(guard.data, result.data.userId);
  if (ownership) return ownership;
  return result;
}
export async function listCatalogSubmissions(params?: PaginationParams) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  return crud.list(params);
}
export async function updateCatalogSubmission(id: string, input: unknown) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await crud.update(id, input);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "update", resourceType: "catalog_submission", resourceId: result.data.id });
  }
  return result;
}
export async function removeCatalogSubmission(id: string) {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  const result = await crud.remove(id);
  if (result.error === null) {
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "delete", resourceType: "catalog_submission", resourceId: result.data.id });
  }
  return result;
}

export async function listSubmissionsByUser(
  userId: string,
  params?: PaginationParams
): Promise<ActionResult<CatalogSubmission[]>> {
  const guard = await requireAuth();
  if (guard.error !== null) return guard;
  const ownership = assertOwnership(guard.data, userId);
  if (ownership) return ownership;
  try {
    const q = db
      .select()
      .from(catalogSubmissions)
      .where(eq(catalogSubmissions.userId, userId))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listPendingSubmissions(
  params?: PaginationParams
): Promise<ActionResult<CatalogSubmission[]>> {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  try {
    const q = db
      .select()
      .from(catalogSubmissions)
      .where(eq(catalogSubmissions.status, "pending"))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function reviewSubmission(
  id: string,
  status: "approved" | "rejected" | "duplicate",
  reviewNotes?: string
): Promise<ActionResult<CatalogSubmission>> {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  try {
    const [row] = await db
      .update(catalogSubmissions)
      .set({
        reviewerId: guard.data.userId,
        status,
        reviewNotes: reviewNotes ?? null,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(catalogSubmissions.id, id))
      .returning();
    if (!row) return err("Not found");
    emitAuditEvent({ actorId: guard.data.userId, actorType: auditActorType(guard.data), action: "review", resourceType: "catalog_submission", resourceId: id, metadata: { status, reviewNotes } });
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}
