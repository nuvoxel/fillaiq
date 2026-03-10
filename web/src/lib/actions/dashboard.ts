"use server";

import { db } from "@/db";
import { eq, sql } from "drizzle-orm";
import { userItems, users, userPreferences } from "@/db/schema/user-library";
import { products, materials } from "@/db/schema/central-catalog";
import { apikeys } from "@/db/schema/auth";
import { ok, err, type ActionResult } from "./utils";

// ── User item weight by material (for dashboard chart) ───────────────────────

export type MaterialWeight = {
  material: string;
  totalWeightG: number;
};

export async function getUserItemWeightsByMaterial(): Promise<
  ActionResult<MaterialWeight[]>
> {
  try {
    const rows = await db
      .select({
        material: sql<string>`coalesce(${materials.abbreviation}, ${materials.name}, 'Unknown')`,
        totalWeightG: sql<number>`coalesce(sum(${userItems.currentWeightG}), 0)`,
      })
      .from(userItems)
      .leftJoin(products, eq(userItems.productId, products.id))
      .leftJoin(materials, eq(products.materialId, materials.id))
      .where(eq(userItems.status, "active"))
      .groupBy(materials.id, materials.abbreviation, materials.name)
      .orderBy(sql`coalesce(sum(${userItems.currentWeightG}), 0) desc`)
      .limit(8);
    return ok(
      rows.map((r) => ({
        material: String(r.material),
        totalWeightG: Number(r.totalWeightG),
      }))
    );
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── User item status breakdown (for dashboard chart fallback) ────────────────

export type UserItemStatusCount = {
  status: string;
  count: number;
};

export async function getUserItemStatusCounts(): Promise<
  ActionResult<UserItemStatusCount[]>
> {
  try {
    const rows = await db
      .select({
        status: userItems.status,
        count: sql<number>`count(*)`,
      })
      .from(userItems)
      .groupBy(userItems.status);
    return ok(
      rows.map((r) => ({
        status: String(r.status),
        count: Number(r.count),
      }))
    );
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── API keys for settings page ──────────────────────────────────────────────

export type ApiKeyInfo = {
  id: string;
  name: string | null;
  prefix: string | null;
  enabled: boolean;
  createdAt: Date;
  lastRequest: Date | null;
};

export async function listApiKeys(): Promise<ActionResult<ApiKeyInfo[]>> {
  try {
    const rows = await db
      .select({
        id: apikeys.id,
        name: apikeys.name,
        prefix: apikeys.prefix,
        enabled: apikeys.enabled,
        createdAt: apikeys.createdAt,
        lastRequest: apikeys.lastRequest,
      })
      .from(apikeys);
    return ok(rows);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── Current user profile (for settings) ─────────────────────────────────────

export type UserProfile = {
  id: string;
  name: string | null;
  email: string;
  username: string | null;
  image: string | null;
  role: string | null;
  createdAt: Date;
};

export async function getUserProfile(
  userId: string
): Promise<ActionResult<UserProfile>> {
  try {
    const [row] = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        username: users.username,
        image: users.image,
        role: users.role,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(eq(users.id, userId));
    if (!row) return err("User not found");
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

// ── User Preferences ────────────────────────────────────────────────────────

export type UserPrefs = {
  id: string;
  userId: string;
  emailNotifications: boolean;
  weightWarnings: boolean;
  autoArchiveEmpty: boolean;
  darkMode: boolean;
};

export async function getUserPreferences(
  userId: string
): Promise<ActionResult<UserPrefs>> {
  try {
    const [row] = await db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));
    if (!row) {
      // Return defaults if no row exists yet
      return ok({
        id: "",
        userId,
        emailNotifications: true,
        weightWarnings: true,
        autoArchiveEmpty: false,
        darkMode: false,
      });
    }
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}

export async function upsertUserPreferences(
  userId: string,
  prefs: {
    emailNotifications?: boolean;
    weightWarnings?: boolean;
    autoArchiveEmpty?: boolean;
    darkMode?: boolean;
  }
): Promise<ActionResult<UserPrefs>> {
  try {
    const values = {
      userId,
      ...prefs,
      updatedAt: new Date(),
    };
    const [row] = await db
      .insert(userPreferences)
      .values(values)
      .onConflictDoUpdate({
        target: userPreferences.userId,
        set: { ...prefs, updatedAt: new Date() },
      })
      .returning();
    return ok(row);
  } catch (e) {
    return err((e as Error).message);
  }
}
