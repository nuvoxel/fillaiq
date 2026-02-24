import {
  pgTable,
  uuid,
  varchar,
  text,
  real,
  integer,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { weightEventTypeEnum } from "./enums";
import { spools, printers, equipment } from "./user-library";
import { slots, shelves } from "./hardware";

// ── Weight Events ───────────────────────────────────────────────────────────

export const weightEvents = pgTable("weight_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  spoolId: uuid("spool_id").references(() => spools.id),
  slotId: uuid("slot_id").references(() => slots.id),
  eventType: weightEventTypeEnum("event_type").notNull(),
  weightG: real("weight_g"),
  previousWeightG: real("previous_weight_g"),
  deltaG: real("delta_g"),
  percentRemaining: integer("percent_remaining"),
  nfcUid: varchar("nfc_uid", { length: 50 }),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Spool Movements ─────────────────────────────────────────────────────────

export const spoolMovements = pgTable("spool_movements", {
  id: uuid("id").defaultRandom().primaryKey(),
  spoolId: uuid("spool_id")
    .references(() => spools.id)
    .notNull(),
  fromSlotId: uuid("from_slot_id").references(() => slots.id),
  toSlotId: uuid("to_slot_id").references(() => slots.id),
  weightAtMoveG: real("weight_at_move_g"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Usage Sessions ──────────────────────────────────────────────────────────

export const usageSessions = pgTable("usage_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  spoolId: uuid("spool_id")
    .references(() => spools.id)
    .notNull(),
  userId: uuid("user_id"),
  printerId: uuid("printer_id").references(() => printers.id),
  removedFromSlotId: uuid("removed_from_slot_id").references(() => slots.id),
  returnedToSlotId: uuid("returned_to_slot_id").references(() => slots.id),
  weightBeforeG: real("weight_before_g"),
  weightAfterG: real("weight_after_g"),
  filamentUsedG: real("filament_used_g"),
  filamentUsedMm: real("filament_used_mm"),
  costAmount: real("cost_amount"),
  removedAt: timestamp("removed_at", { withTimezone: true }),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  printJobId: varchar("print_job_id", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Drying Sessions ─────────────────────────────────────────────────────────

export const dryingSessions = pgTable("drying_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  spoolId: uuid("spool_id")
    .references(() => spools.id)
    .notNull(),
  userId: uuid("user_id"),
  equipmentId: uuid("equipment_id").references(() => equipment.id),
  temperatureC: integer("temperature_c"),
  durationMinutes: integer("duration_minutes"),
  weightBeforeG: real("weight_before_g"),
  weightAfterG: real("weight_after_g"),
  moistureLostG: real("moisture_lost_g"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Environmental Readings ──────────────────────────────────────────────────

export const environmentalReadings = pgTable("environmental_readings", {
  id: uuid("id").defaultRandom().primaryKey(),
  shelfId: uuid("shelf_id")
    .references(() => shelves.id)
    .notNull(),
  temperatureC: real("temperature_c"),
  humidityPercent: real("humidity_percent"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
