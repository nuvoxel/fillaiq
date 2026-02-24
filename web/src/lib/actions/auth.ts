import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { ok, err, type ActionResult } from "./utils";

// ── Types ──────────────────────────────────────────────────────────────────

export type SessionContext = {
  type: "session";
  userId: string;
  role: string;
};

export type ApiKeyContext = {
  type: "apiKey";
  userId: string;
};

export type AuthContext = SessionContext | ApiKeyContext;

// ── Low-level helpers ──────────────────────────────────────────────────────

export async function getSession(): Promise<SessionContext | null> {
  try {
    const session = await auth.api.getSession({
      headers: await headers(),
    });
    if (!session?.user) return null;
    return {
      type: "session",
      userId: session.user.id,
      role: (session.user as any).role ?? "user",
    };
  } catch {
    return null;
  }
}

export async function getApiKeyAuth(): Promise<ApiKeyContext | null> {
  try {
    const h = await headers();
    const apiKeyHeader =
      h.get("x-api-key") ?? h.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!apiKeyHeader) return null;
    const result = await auth.api.verifyApiKey({
      body: { key: apiKeyHeader },
    });
    if (!result?.valid || !result?.key?.userId) return null;
    return { type: "apiKey", userId: result.key.userId };
  } catch {
    return null;
  }
}

export async function getAuthContext(): Promise<AuthContext | null> {
  const session = await getSession();
  if (session) return session;
  return getApiKeyAuth();
}

// ── Guard helpers ──────────────────────────────────────────────────────────

export async function requireAuth(): Promise<ActionResult<AuthContext>> {
  const ctx = await getSession();
  if (!ctx) return err("Unauthorized");
  return ok(ctx);
}

export async function requireAdmin(): Promise<ActionResult<SessionContext>> {
  const ctx = await getSession();
  if (!ctx) return err("Unauthorized");
  if (ctx.role !== "admin") return err("Forbidden");
  return ok(ctx);
}

export async function requireAuthOrApiKey(): Promise<
  ActionResult<AuthContext>
> {
  const ctx = await getAuthContext();
  if (!ctx) return err("Unauthorized");
  return ok(ctx);
}

// ── Ownership check ────────────────────────────────────────────────────────

export function assertOwnership(
  ctx: AuthContext,
  resourceUserId: string
): ActionResult<never> | null {
  if (ctx.type === "session" && ctx.role === "admin") return null;
  if (ctx.userId === resourceUserId) return null;
  return err("Forbidden");
}
