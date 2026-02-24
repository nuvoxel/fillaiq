import {
  pgTable,
  uuid,
  varchar,
  timestamp,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { auditActorTypeEnum, auditActionEnum } from "./enums";
import { users } from "./user-library";

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorId: uuid("actor_id")
      .references(() => users.id)
      .notNull(),
    actorType: auditActorTypeEnum("actor_type").notNull(),
    action: auditActionEnum("action").notNull(),
    resourceType: varchar("resource_type", { length: 50 }).notNull(),
    resourceId: uuid("resource_id"),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("audit_logs_actor_id_idx").on(t.actorId),
    index("audit_logs_resource_idx").on(t.resourceType, t.resourceId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ]
);
