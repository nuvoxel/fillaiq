"use server";

import { db } from "@/db";
import { eq, and, desc, type SQL } from "drizzle-orm";
import type { InferSelectModel } from "drizzle-orm";
import { auditLogs } from "@/db/schema/audit";
import { insertAuditLogSchema } from "./schemas";
import { ok, err, type ActionResult, type PaginationParams } from "./utils";
import { requireAdmin, type AuthContext } from "./auth";

type AuditLog = InferSelectModel<typeof auditLogs>;

// ── Helpers ─────────────────────────────────────────────────────────────────

// Note: auditActorType moved to ./audit-helpers.ts (sync functions can't be in "use server" files)

// ── Fire-and-forget emitter (no auth — called from guarded actions) ─────────

export async function emitAuditEvent(params: {
  actorId: string;
  actorType: "session" | "api_key" | "system";
  action: "create" | "update" | "delete" | "review" | "login" | "logout";
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const parsed = insertAuditLogSchema.safeParse(params);
    if (!parsed.success) {
      console.error("[audit] validation error:", parsed.error.message);
      return;
    }
    await db.insert(auditLogs).values(parsed.data as any);
  } catch (e) {
    console.error("[audit] emit error:", (e as Error).message);
  }
}

// ── Admin query actions ─────────────────────────────────────────────────────

export async function listAuditLogs(
  params?: PaginationParams
): Promise<ActionResult<AuditLog[]>> {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  try {
    const q = db
      .select()
      .from(auditLogs)
      .orderBy(desc(auditLogs.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listAuditLogsByResourceId(
  resourceType: string,
  resourceId: string,
  params?: PaginationParams
): Promise<ActionResult<AuditLog[]>> {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  try {
    const conditions: SQL[] = [
      eq(auditLogs.resourceType, resourceType),
      eq(auditLogs.resourceId, resourceId),
    ];
    const q = db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function listAuditLogsByActorId(
  actorId: string,
  params?: PaginationParams
): Promise<ActionResult<AuditLog[]>> {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  try {
    const q = db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.actorId, actorId))
      .orderBy(desc(auditLogs.createdAt))
      .$dynamic();
    if (params?.limit) q.limit(params.limit);
    if (params?.offset) q.offset(params.offset);
    return ok(await q);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Filtered query with actor join (for admin UI) ──────────────────────

export type AuditLogWithActor = AuditLog & {
  actorName: string | null;
  actorEmail: string;
};

export async function listAuditLogsFiltered(params: {
  action?: string[];
  resourceType?: string;
  actorId?: string;
  limit?: number;
  offset?: number;
}): Promise<ActionResult<{ items: AuditLogWithActor[]; total: number }>> {
  const guard = await requireAdmin();
  if (guard.error !== null) return guard;
  try {
    const { users } = await import("@/db/schema/user-library");
    const { count, inArray } = await import("drizzle-orm");

    const conditions: SQL[] = [];
    if (params.action?.length) {
      conditions.push(inArray(auditLogs.action, params.action as any));
    }
    if (params.resourceType) {
      conditions.push(eq(auditLogs.resourceType, params.resourceType));
    }
    if (params.actorId) {
      conditions.push(eq(auditLogs.actorId, params.actorId));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [countResult] = await db
      .select({ count: count() })
      .from(auditLogs)
      .where(where);

    const rows = await db
      .select({
        id: auditLogs.id,
        actorId: auditLogs.actorId,
        actorType: auditLogs.actorType,
        action: auditLogs.action,
        resourceType: auditLogs.resourceType,
        resourceId: auditLogs.resourceId,
        metadata: auditLogs.metadata,
        createdAt: auditLogs.createdAt,
        actorName: users.name,
        actorEmail: users.email,
      })
      .from(auditLogs)
      .leftJoin(users, eq(auditLogs.actorId, users.id))
      .where(where)
      .orderBy(desc(auditLogs.createdAt))
      .limit(params.limit ?? 25)
      .offset(params.offset ?? 0);

    return ok({
      items: rows as AuditLogWithActor[],
      total: countResult?.count ?? 0,
    });
  } catch (e) {
    return err((e as Error).message);
  }
}
