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
import { nfcTagFormatEnum } from "./enums";
import { users, userItems } from "./user-library";

// ── Scan Stations ───────────────────────────────────────────────────────────

export const scanStations = pgTable(
  "scan_stations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => users.id),
    name: varchar("name", { length: 255 }).notNull(),
    hardwareId: varchar("hardware_id", { length: 50 }).notNull(),
    firmwareVersion: varchar("firmware_version", { length: 50 }),
    ipAddress: varchar("ip_address", { length: 45 }),
    // Calibration
    platformHeightMm: real("platform_height_mm"),
    weightCalibrationFactor: real("weight_calibration_factor"),
    hasTurntable: boolean("has_turntable").default(false),
    hasColorSensor: boolean("has_color_sensor").default(false),
    hasTofSensor: boolean("has_tof_sensor").default(false),
    hasCamera: boolean("has_camera").default(false),
    // Pairing
    deviceToken: varchar("device_token", { length: 128 }),
    pairingCode: varchar("pairing_code", { length: 10 }),
    pairingExpiresAt: timestamp("pairing_expires_at", { withTimezone: true }),
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
  (table) => [
    uniqueIndex("scan_stations_hardware_id_idx").on(table.hardwareId),
  ]
);

// ── Scan Events ─────────────────────────────────────────────────────────────

export const scanEvents = pgTable("scan_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  stationId: uuid("station_id")
    .references(() => scanStations.id)
    .notNull(),
  userId: uuid("user_id").references(() => users.id),

  // ── Weight ────────────────────────────────────────────────────────────
  weightG: real("weight_g"),
  weightStable: boolean("weight_stable"),

  // ── Height (TOF) ──────────────────────────────────────────────────────
  heightMm: real("height_mm"),
  distanceMm: real("distance_mm"),

  // ── Spectral color (AS7341 raw channels) ──────────────────────────────
  spectralData: jsonb("spectral_data"),
  // Derived color
  colorHex: varchar("color_hex", { length: 7 }),
  colorLabL: real("color_lab_l"),
  colorLabA: real("color_lab_a"),
  colorLabB: real("color_lab_b"),

  // ── NFC ───────────────────────────────────────────────────────────────
  nfcPresent: boolean("nfc_present").default(false),
  nfcUid: varchar("nfc_uid", { length: 50 }),
  nfcUidLength: integer("nfc_uid_length"),
  // Tag identification
  nfcTagType: integer("nfc_tag_type"), // MIFARE Classic, NTAG21x, etc.
  nfcAtqa: varchar("nfc_atqa", { length: 10 }), // Answer To Request Type A
  nfcSak: integer("nfc_sak"), // Select Acknowledge
  nfcTagFormat: nfcTagFormatEnum("nfc_tag_format"), // parsed protocol
  // Raw data
  nfcRawData: text("nfc_raw_data"), // hex dump of all sectors/pages
  nfcSectorsRead: integer("nfc_sectors_read"),
  nfcPagesRead: integer("nfc_pages_read"),
  // Parsed fields (from whatever tag format was detected)
  nfcParsedData: jsonb("nfc_parsed_data"),
  // e.g. { "materialId": "GFL99", "variantId": "...", "color": "#FFFFFF", "weight": 1000, ... }

  // ── Camera / barcode ──────────────────────────────────────────────────
  photoUrl: varchar("photo_url", { length: 1024 }),
  barcodeValue: varchar("barcode_value", { length: 255 }),
  barcodeFormat: varchar("barcode_format", { length: 50 }),

  // ── Turntable ─────────────────────────────────────────────────────────
  turntableAngle: real("turntable_angle"),

  // ── Identification result ─────────────────────────────────────────────
  identified: boolean("identified").default(false),
  confidence: real("confidence"),
  identifiedType: varchar("identified_type", { length: 50 }), // 'product', 'user_item', 'inventory_item'
  identifiedProductId: uuid("identified_product_id"),
  identifiedUserItemId: uuid("identified_user_item_id").references(
    () => userItems.id
  ),
  aiSuggestions: jsonb("ai_suggestions"),

  // ── User confirmation ─────────────────────────────────────────────────
  userConfirmed: boolean("user_confirmed"),
  userOverrideData: jsonb("user_override_data"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Inventory Items (non-filament: fasteners, electronics, etc.) ────────────

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),

  // Classification
  category: varchar("category", { length: 100 }).notNull(),
  subcategory: varchar("subcategory", { length: 100 }),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),

  // Measurements
  weightG: real("weight_g"),
  heightMm: real("height_mm"),
  widthMm: real("width_mm"),
  lengthMm: real("length_mm"),
  diameterMm: real("diameter_mm"),

  // Color
  colorHex: varchar("color_hex", { length: 7 }),
  colorLabL: real("color_lab_l"),
  colorLabA: real("color_lab_a"),
  colorLabB: real("color_lab_b"),

  // Fastener-specific
  threadPitch: varchar("thread_pitch", { length: 20 }),
  headType: varchar("head_type", { length: 50 }),
  driveType: varchar("drive_type", { length: 50 }),
  fastenerMaterial: varchar("fastener_material", { length: 50 }),

  // Electronic-specific
  partNumber: varchar("part_number", { length: 100 }),
  packageType: varchar("package_type", { length: 50 }),

  // Inventory
  quantity: integer("quantity").default(0),
  storageLocation: varchar("storage_location", { length: 255 }),
  binLabel: varchar("bin_label", { length: 50 }),

  // Commerce
  supplier: varchar("supplier", { length: 255 }),
  supplierPartNumber: varchar("supplier_part_number", { length: 100 }),
  unitPrice: real("unit_price"),
  currency: varchar("currency", { length: 3 }),
  purchaseUrl: varchar("purchase_url", { length: 1024 }),

  // Photos
  photoUrl: varchar("photo_url", { length: 1024 }),

  // NFC / barcode
  nfcUid: varchar("nfc_uid", { length: 50 }),
  barcodeValue: varchar("barcode_value", { length: 255 }),

  // Scan reference
  lastScanEventId: uuid("last_scan_event_id").references(() => scanEvents.id),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
