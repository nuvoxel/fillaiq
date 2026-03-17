import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Cache the postgres client on globalThis to prevent connection leaks during
// Next.js hot reloads in dev mode. Each HMR cycle re-evaluates this module,
// and without caching, a new pool is created while the old one stays open.
const globalForDb = globalThis as unknown as { pgClient?: ReturnType<typeof postgres> };
const client = globalForDb.pgClient ?? postgres(connectionString);
if (process.env.NODE_ENV !== "production") globalForDb.pgClient = client;

export const db = drizzle(client, { schema });
