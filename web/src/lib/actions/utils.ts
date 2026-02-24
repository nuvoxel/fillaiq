import { db } from "@/db";
import { eq, desc } from "drizzle-orm";
import type { z } from "zod";

export type ActionResult<T> =
  | { data: T; error: null }
  | { data: null; error: string };

export type PaginationParams = {
  limit?: number;
  offset?: number;
};

export function ok<T>(data: T): ActionResult<T> {
  return { data, error: null };
}

export function err(error: string): ActionResult<never> {
  return { data: null, error };
}

// ── Full CRUD Factory ───────────────────────────────────────────────────────

export function createCrudActions<TSelect extends { id: string }>(config: {
  table: any;
  insertSchema: z.ZodType;
  updateSchema: z.ZodType;
  setUpdatedAt?: boolean;
}) {
  const { table, insertSchema, updateSchema, setUpdatedAt = true } = config;

  return {
    async create(input: unknown): Promise<ActionResult<TSelect>> {
      try {
        const parsed = insertSchema.safeParse(input);
        if (!parsed.success) return err(parsed.error.message);
        const data = parsed.data as Record<string, unknown>;
        const [row] = await db.insert(table).values(data).returning();
        return ok(row as TSelect);
      } catch (e) {
        return err((e as Error).message);
      }
    },

    async getById(id: string): Promise<ActionResult<TSelect>> {
      try {
        const [row] = await db
          .select()
          .from(table)
          .where(eq(table.id, id));
        if (!row) return err("Not found");
        return ok(row as TSelect);
      } catch (e) {
        return err((e as Error).message);
      }
    },

    async list(params?: PaginationParams): Promise<ActionResult<TSelect[]>> {
      try {
        const q = db
          .select()
          .from(table)
          .orderBy(desc(table.createdAt))
          .$dynamic();
        if (params?.limit) q.limit(params.limit);
        if (params?.offset) q.offset(params.offset);
        const rows = await q;
        return ok(rows as TSelect[]);
      } catch (e) {
        return err((e as Error).message);
      }
    },

    async update(
      id: string,
      input: unknown
    ): Promise<ActionResult<TSelect>> {
      try {
        const parsed = updateSchema.safeParse(input);
        if (!parsed.success) return err(parsed.error.message);
        const data = parsed.data as Record<string, unknown>;
        const values = setUpdatedAt
          ? { ...data, updatedAt: new Date() }
          : data;
        const [row] = await db
          .update(table)
          .set(values)
          .where(eq(table.id, id))
          .returning();
        if (!row) return err("Not found");
        return ok(row as TSelect);
      } catch (e) {
        return err((e as Error).message);
      }
    },

    async remove(id: string): Promise<ActionResult<{ id: string }>> {
      try {
        const [row] = await db
          .delete(table)
          .where(eq(table.id, id))
          .returning({ id: table.id });
        if (!row) return err("Not found");
        return ok(row);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  };
}

// ── Append-Only Factory (events) ────────────────────────────────────────────

export function createAppendOnlyActions<TSelect>(config: {
  table: any;
  insertSchema: z.ZodType;
}) {
  const { table, insertSchema } = config;

  return {
    async create(input: unknown): Promise<ActionResult<TSelect>> {
      try {
        const parsed = insertSchema.safeParse(input);
        if (!parsed.success) return err(parsed.error.message);
        const data = parsed.data as Record<string, unknown>;
        const [row] = await db.insert(table).values(data).returning();
        return ok(row as TSelect);
      } catch (e) {
        return err((e as Error).message);
      }
    },

    async list(params?: PaginationParams): Promise<ActionResult<TSelect[]>> {
      try {
        const q = db
          .select()
          .from(table)
          .orderBy(desc(table.createdAt))
          .$dynamic();
        if (params?.limit) q.limit(params.limit);
        if (params?.offset) q.offset(params.offset);
        const rows = await q;
        return ok(rows as TSelect[]);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  };
}

// ── Upsert Factory (slotStatus) ─────────────────────────────────────────────

export function createUpsertActions<TSelect>(config: {
  table: any;
  insertSchema: z.ZodType;
  conflictTarget: any;
}) {
  const { table, insertSchema, conflictTarget } = config;

  return {
    async upsert(input: unknown): Promise<ActionResult<TSelect>> {
      try {
        const parsed = insertSchema.safeParse(input);
        if (!parsed.success) return err(parsed.error.message);
        const data = parsed.data as Record<string, unknown>;
        const values = { ...data, updatedAt: new Date() };
        const [row] = await db
          .insert(table)
          .values(values)
          .onConflictDoUpdate({ target: conflictTarget, set: values })
          .returning();
        return ok(row as TSelect);
      } catch (e) {
        return err((e as Error).message);
      }
    },

    async getByKey(value: string): Promise<ActionResult<TSelect>> {
      try {
        const [row] = await db
          .select()
          .from(table)
          .where(eq(conflictTarget, value));
        if (!row) return err("Not found");
        return ok(row as TSelect);
      } catch (e) {
        return err((e as Error).message);
      }
    },
  };
}
