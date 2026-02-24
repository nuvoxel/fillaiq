import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { submissionTypeEnum, submissionStatusEnum } from "./enums";
import { users } from "./user-library";

export const catalogSubmissions = pgTable("catalog_submissions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  type: submissionTypeEnum("type").notNull(),
  status: submissionStatusEnum("status").default("pending").notNull(),
  targetTable: varchar("target_table", { length: 100 }),
  targetId: uuid("target_id"),
  payload: jsonb("payload").notNull(),
  originalPayload: jsonb("original_payload"),
  reviewerId: uuid("reviewer_id").references(() => users.id),
  reviewNotes: text("review_notes"),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  sourceNfcUid: varchar("source_nfc_uid", { length: 50 }),
  sourceSpoolId: uuid("source_spool_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
