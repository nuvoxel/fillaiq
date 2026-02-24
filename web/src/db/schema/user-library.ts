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
import {
  spoolStatusEnum,
  nfcTagFormatEnum,
  equipmentTypeEnum,
  labelFormatEnum,
} from "./enums";
import { variants, filaments } from "./central-catalog";

// ── Users ───────────────────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }),
    image: varchar("image", { length: 512 }),
    emailVerified: boolean("email_verified").default(false).notNull(),
    username: varchar("username", { length: 255 }),
    role: varchar("role", { length: 50 }).default("user"),
    banned: boolean("banned").default(false),
    banReason: text("ban_reason"),
    banExpires: timestamp("ban_expires", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("users_email_idx").on(table.email),
    uniqueIndex("users_username_idx").on(table.username),
  ]
);

// ── Spools ──────────────────────────────────────────────────────────────────

export const spools = pgTable("spools", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  variantId: uuid("variant_id").references(() => variants.id),
  filamentId: uuid("filament_id").references(() => filaments.id),

  // NFC identification
  nfcUid: varchar("nfc_uid", { length: 50 }),
  nfcTagFormat: nfcTagFormatEnum("nfc_tag_format"),
  bambuTrayUid: varchar("bambu_tray_uid", { length: 50 }),

  // Weight tracking
  initialWeightG: real("initial_weight_g"),
  currentWeightG: real("current_weight_g"),
  netFilamentWeightG: real("net_filament_weight_g"),
  spoolWeightG: real("spool_weight_g"),
  percentRemaining: integer("percent_remaining"),

  // Cost
  purchasePrice: real("purchase_price"),
  purchaseCurrency: varchar("purchase_currency", { length: 3 }),

  // Quality
  rating: integer("rating"),

  // Lifecycle
  status: spoolStatusEnum("status").default("active").notNull(),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }),
  productionDate: varchar("production_date", { length: 20 }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  emptiedAt: timestamp("emptied_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  // Drying state
  lastDriedAt: timestamp("last_dried_at", { withTimezone: true }),
  dryingCycleCount: integer("drying_cycle_count").default(0),

  // Location
  currentSlotId: uuid("current_slot_id"),
  storageLocation: varchar("storage_location", { length: 255 }),

  // Provenance
  lotNumber: varchar("lot_number", { length: 100 }),
  serialNumber: varchar("serial_number", { length: 255 }),

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Printers ────────────────────────────────────────────────────────────────

export const printers = pgTable("printers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  firmwareVersion: varchar("firmware_version", { length: 50 }),
  serialNumber: varchar("serial_number", { length: 255 }),
  hasAms: boolean("has_ams").default(false),
  amsSlotCount: integer("ams_slot_count"),
  amsModel: varchar("ams_model", { length: 50 }),
  nozzleDiameterMm: real("nozzle_diameter_mm"),
  buildVolumeX: integer("build_volume_x"),
  buildVolumeY: integer("build_volume_y"),
  buildVolumeZ: integer("build_volume_z"),
  ipAddress: varchar("ip_address", { length: 45 }),
  mqttTopic: varchar("mqtt_topic", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── User Print Profiles ─────────────────────────────────────────────────────

export const userPrintProfiles = pgTable("user_print_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  variantId: uuid("variant_id").references(() => variants.id),
  filamentId: uuid("filament_id").references(() => filaments.id),
  printerId: uuid("printer_id").references(() => printers.id),
  name: varchar("name", { length: 255 }),
  // Temps
  nozzleTemp: integer("nozzle_temp"),
  bedTemp: integer("bed_temp"),
  chamberTemp: integer("chamber_temp"),
  // Speed/flow
  printSpeed: real("print_speed"),
  flowRate: real("flow_rate"),
  // Retraction
  retractionDistance: real("retraction_distance"),
  retractionSpeed: real("retraction_speed"),
  // Advanced
  pressureAdvance: real("pressure_advance"),
  fanSpeed: integer("fan_speed"),
  volumetricSpeed: real("volumetric_speed"),
  settings: jsonb("settings"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Equipment ───────────────────────────────────────────────────────────────

export const equipment = pgTable("equipment", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  type: equipmentTypeEnum("type").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  capacity: integer("capacity"),
  // Dryer-specific
  maxTemp: integer("max_temp"),
  hasHumidityControl: boolean("has_humidity_control"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Label Templates ─────────────────────────────────────────────────────────

export const labelTemplates = pgTable("label_templates", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  // Format
  labelFormat: labelFormatEnum("label_format").notNull(),
  widthMm: integer("width_mm"),
  heightMm: integer("height_mm"),
  // Content flags
  showBrand: boolean("show_brand").default(true),
  showMaterial: boolean("show_material").default(true),
  showColor: boolean("show_color").default(true),
  showColorSwatch: boolean("show_color_swatch").default(true),
  showTemps: boolean("show_temps").default(true),
  showQrCode: boolean("show_qr_code").default(true),
  showWeight: boolean("show_weight").default(true),
  showLocation: boolean("show_location").default(false),
  showPrice: boolean("show_price").default(false),
  showPurchaseDate: boolean("show_purchase_date").default(false),
  showLotNumber: boolean("show_lot_number").default(false),
  // QR code
  qrCodeBaseUrl: varchar("qr_code_base_url", { length: 512 }).default(
    "app.fillaiq.com/spool/"
  ),
  // Style
  customCss: text("custom_css"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── User Preferences ───────────────────────────────────────────────────────

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id)
      .notNull(),
    emailNotifications: boolean("email_notifications").default(true).notNull(),
    weightWarnings: boolean("weight_warnings").default(true).notNull(),
    autoArchiveEmpty: boolean("auto_archive_empty").default(false).notNull(),
    darkMode: boolean("dark_mode").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("user_preferences_user_id_idx").on(table.userId)]
);
