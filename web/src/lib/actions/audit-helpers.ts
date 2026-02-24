import type { AuthContext } from "./auth";

export function auditActorType(
  ctx: AuthContext
): "session" | "api_key" {
  return ctx.type === "apiKey" ? "api_key" : "session";
}
