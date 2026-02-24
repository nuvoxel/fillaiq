import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { users } from "./user-library";

// ── Sessions ─────────────────────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  token: text("token").notNull().unique(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ipAddress: varchar("ip_address", { length: 45 }),
  userAgent: text("user_agent"),
  activeOrganizationId: uuid("active_organization_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Accounts ─────────────────────────────────────────────────────────────────

export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
    withTimezone: true,
  }),
  scope: text("scope"),
  idToken: text("id_token"),
  password: text("password"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Verifications ────────────────────────────────────────────────────────────

export const verifications = pgTable("verifications", {
  id: uuid("id").defaultRandom().primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Organizations ────────────────────────────────────────────────────────────

export const organizations = pgTable(
  "organizations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    logo: text("logo"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("organizations_slug_idx").on(table.slug)]
);

// ── Members ──────────────────────────────────────────────────────────────────

export const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  role: varchar("role", { length: 50 }).default("member").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Invitations ──────────────────────────────────────────────────────────────

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  email: varchar("email", { length: 255 }).notNull(),
  organizationId: uuid("organization_id")
    .references(() => organizations.id)
    .notNull(),
  role: varchar("role", { length: 50 }).default("member"),
  status: varchar("status", { length: 50 }).default("pending").notNull(),
  inviterId: uuid("inviter_id")
    .references(() => users.id)
    .notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── API Keys ─────────────────────────────────────────────────────────────────

export const apikeys = pgTable("apikeys", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name"),
  start: text("start"),
  prefix: text("prefix"),
  key: text("key").notNull(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  refillInterval: integer("refill_interval"),
  refillAmount: integer("refill_amount"),
  lastRefillAt: timestamp("last_refill_at", { withTimezone: true }),
  enabled: boolean("enabled").default(true).notNull(),
  rateLimitEnabled: boolean("rate_limit_enabled").default(false).notNull(),
  rateLimitTimeWindow: integer("rate_limit_time_window"),
  rateLimitMax: integer("rate_limit_max"),
  requestCount: integer("request_count").default(0).notNull(),
  remaining: integer("remaining"),
  lastRequest: timestamp("last_request", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  permissions: text("permissions"),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
