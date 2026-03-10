import {
  pgTable,
  uuid,
  varchar,
  text,
  real,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { zoneTypeEnum, slotStateEnum } from "./enums";
import { users } from "./user-library";

// ── Zones ───────────────────────────────────────────────────────────────────

export const zones = pgTable("zones", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: zoneTypeEnum("type").default("workshop"),
  description: text("description"),
  nfcTagId: varchar("nfc_tag_id", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Racks ───────────────────────────────────────────────────────────────────

export const racks = pgTable("racks", {
  id: uuid("id").defaultRandom().primaryKey(),
  zoneId: uuid("zone_id")
    .references(() => zones.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  position: integer("position"), // ordering within zone
  shelfCount: integer("shelf_count"),
  nfcTagId: varchar("nfc_tag_id", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Shelves ─────────────────────────────────────────────────────────────────

export const shelves = pgTable("shelves", {
  id: uuid("id").defaultRandom().primaryKey(),
  rackId: uuid("rack_id")
    .references(() => racks.id)
    .notNull(),
  position: integer("position").notNull(), // numbered bottom-up or top-down
  label: varchar("label", { length: 50 }),
  bayCount: integer("bay_count"),
  nfcTagId: varchar("nfc_tag_id", { length: 50 }),
  hasTempHumiditySensor: boolean("has_temp_humidity_sensor").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Bays ────────────────────────────────────────────────────────────────────

export const bays = pgTable("bays", {
  id: uuid("id").defaultRandom().primaryKey(),
  shelfId: uuid("shelf_id")
    .references(() => shelves.id)
    .notNull(),
  position: integer("position").notNull(), // left-to-right on shelf
  label: varchar("label", { length: 50 }),
  slotCount: integer("slot_count"),
  nfcTagId: varchar("nfc_tag_id", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Slots ───────────────────────────────────────────────────────────────────

export const slots = pgTable("slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  bayId: uuid("bay_id")
    .references(() => bays.id)
    .notNull(),
  position: integer("position").notNull(), // position within bay
  label: varchar("label", { length: 50 }),
  nfcTagId: varchar("nfc_tag_id", { length: 50 }),
  // Address shorthand (denormalized for display, e.g. "WS-A-2-1-3")
  address: varchar("address", { length: 50 }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Bay Modules (optional IoT hardware at a bay) ────────────────────────────

export const bayModules = pgTable(
  "bay_modules",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bayId: uuid("bay_id")
      .references(() => bays.id)
      .notNull(),
    hardwareId: varchar("hardware_id", { length: 50 }).notNull(),
    firmwareVersion: varchar("firmware_version", { length: 50 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    // Per-slot hardware mapping
    hx711Channels: integer("hx711_channels"), // how many weight channels
    nfcReaderCount: integer("nfc_reader_count"),
    displayCount: integer("display_count"),
    ledCount: integer("led_count"),
    calibrationFactors: jsonb("calibration_factors"), // per-slot cal factors
    lastCalibratedAt: timestamp("last_calibrated_at", { withTimezone: true }),
    // Status
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    isOnline: boolean("is_online").default(false),
    config: jsonb("config"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("bay_modules_hardware_id_idx").on(table.hardwareId)]
);

// ── Slot Status (live state for slots with bay modules) ─────────────────────

export const slotStatus = pgTable(
  "slot_status",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slotId: uuid("slot_id")
      .references(() => slots.id)
      .notNull(),
    state: slotStateEnum("state").default("empty").notNull(),
    userItemId: uuid("user_item_id"), // FK added in user-library to avoid circular
    // NFC
    nfcUid: varchar("nfc_uid", { length: 50 }),
    nfcPresent: boolean("nfc_present").default(false),
    // Weight
    weightRawG: real("weight_raw_g"),
    weightStableG: real("weight_stable_g"),
    weightIsStable: boolean("weight_is_stable").default(false),
    percentRemaining: integer("percent_remaining"),
    // Environmental
    temperatureC: real("temperature_c"),
    humidityPercent: real("humidity_percent"),
    stateEnteredAt: timestamp("state_entered_at", { withTimezone: true }),
    lastReportAt: timestamp("last_report_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("slot_status_slot_id_idx").on(table.slotId)]
);
