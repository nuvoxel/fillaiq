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
import { slotStateEnum, connectionTypeEnum } from "./enums";
import { users } from "./user-library";

// ── Racks ───────────────────────────────────────────────────────────────────

export const racks = pgTable("racks", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  location: varchar("location", { length: 255 }),
  shelfCount: integer("shelf_count"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Bridges ─────────────────────────────────────────────────────────────────

export const bridges = pgTable(
  "bridges",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    rackId: uuid("rack_id")
      .references(() => racks.id)
      .notNull(),
    hardwareId: varchar("hardware_id", { length: 50 }).notNull(),
    firmwareVersion: varchar("firmware_version", { length: 50 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    hostname: varchar("hostname", { length: 255 }),
    connectionType: connectionTypeEnum("connection_type"),
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
  (table) => [uniqueIndex("bridges_hardware_id_idx").on(table.hardwareId)]
);

// ── Shelves ─────────────────────────────────────────────────────────────────

export const shelves = pgTable("shelves", {
  id: uuid("id").defaultRandom().primaryKey(),
  rackId: uuid("rack_id")
    .references(() => racks.id)
    .notNull(),
  position: integer("position").notNull(),
  hardwareId: varchar("hardware_id", { length: 50 }),
  canAddress: integer("can_address"),
  firmwareVersion: varchar("firmware_version", { length: 50 }),
  bayCount: integer("bay_count").default(8),
  hasTempHumiditySensor: boolean("has_temp_humidity_sensor").default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  isOnline: boolean("is_online").default(false),
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
  position: integer("position").notNull(),
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
  position: integer("position").notNull(),
  // Hardware
  hx711Channel: integer("hx711_channel"),
  nfcReaderIndex: integer("nfc_reader_index"),
  displayIndex: integer("display_index"),
  ledIndex: integer("led_index"),
  phoneNfcUrl: varchar("phone_nfc_url", { length: 512 }),
  calibrationFactor: real("calibration_factor"),
  lastCalibratedAt: timestamp("last_calibrated_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Slot Status ─────────────────────────────────────────────────────────────

export const slotStatus = pgTable(
  "slot_status",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slotId: uuid("slot_id")
      .references(() => slots.id)
      .notNull(),
    state: slotStateEnum("state").default("empty").notNull(),
    spoolId: uuid("spool_id"),
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
