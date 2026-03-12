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
  hardwareCategoryEnum,
  hardwareIdentifierTypeEnum,
  validationStatusEnum,
} from "./enums";
import { brands } from "./central-catalog";

// Re-export storage tables for backwards compatibility
export {
  zones,
  racks,
  shelves,
  bays,
  slots,
  bayModules,
  slotStatus,
} from "./storage";

// ── Hardware Models (catalog of make/model/capabilities) ─────────────────────

export const hardwareModels = pgTable(
  "hardware_models",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id").references(() => brands.id),
    category: hardwareCategoryEnum("category").notNull(),
    manufacturer: varchar("manufacturer", { length: 255 }).notNull(),
    model: varchar("model", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    description: text("description"),
    imageUrl: varchar("image_url", { length: 512 }),
    websiteUrl: varchar("website_url", { length: 512 }),

    // ── Label Printer Specs ──────────────────────────────────────────────
    printWidthMm: real("print_width_mm"),
    printHeightMaxMm: real("print_height_max_mm"),
    printDpi: integer("print_dpi"),
    dotsPerLine: integer("dots_per_line"),
    printTechnology: varchar("print_technology", { length: 50 }), // thermal, thermal_transfer, inkjet
    continuousFeed: boolean("continuous_feed"),
    supportedLabelWidths: jsonb("supported_label_widths"), // [15, 25, 40, 50] mm

    // ── 3D Printer / CNC / Laser Specs ───────────────────────────────────
    buildVolumeX: integer("build_volume_x"),
    buildVolumeY: integer("build_volume_y"),
    buildVolumeZ: integer("build_volume_z"),
    maxNozzleTemp: integer("max_nozzle_temp"),
    maxBedTemp: integer("max_bed_temp"),
    hasEnclosure: boolean("has_enclosure"),
    hasFilamentChanger: boolean("has_filament_changer"),
    filamentChangerSlots: integer("filament_changer_slots"),

    // ── Connectivity ─────────────────────────────────────────────────────
    hasUsb: boolean("has_usb").default(false),
    hasBle: boolean("has_ble").default(false),
    hasWifi: boolean("has_wifi").default(false),
    hasEthernet: boolean("has_ethernet").default(false),
    hasMqtt: boolean("has_mqtt").default(false),

    // ── Protocol / Communication ─────────────────────────────────────────
    protocol: varchar("protocol", { length: 100 }), // esc_pos, gcode, marlin, klipper, bambu_mqtt
    bleServiceUuid: varchar("ble_service_uuid", { length: 50 }),
    bleWriteCharUuid: varchar("ble_write_char_uuid", { length: 50 }),
    bleNotifyCharUuid: varchar("ble_notify_char_uuid", { length: 50 }),

    // ── Extended Capabilities (flexible JSON) ────────────────────────────
    capabilities: jsonb("capabilities"),
    // e.g. { "battery": true, "paperSensor": true, "coverSensor": true,
    //        "labelAutocut": true, "barcodeSupport": ["QR", "Code128"] }

    // ── Status ───────────────────────────────────────────────────────────
    validationStatus: validationStatusEnum("validation_status")
      .default("draft")
      .notNull(),
    discontinued: boolean("discontinued").default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("hardware_models_slug_idx").on(table.slug),
  ]
);

// ── Hardware Identifiers (for auto-discovery matching) ───────────────────────

export const hardwareIdentifiers = pgTable(
  "hardware_identifiers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    hardwareModelId: uuid("hardware_model_id")
      .references(() => hardwareModels.id)
      .notNull(),
    identifierType: hardwareIdentifierTypeEnum("identifier_type").notNull(),
    value: varchar("value", { length: 255 }).notNull(), // e.g. "0493:B002", "M120", "Phomemo"
    priority: integer("priority").default(0), // higher = more specific match
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("hardware_identifiers_type_value_idx").on(
      table.identifierType,
      table.value
    ),
  ]
);
