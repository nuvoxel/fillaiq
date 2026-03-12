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
  itemStatusEnum,
  packageTypeEnum,
  nfcTagFormatEnum,
  equipmentTypeEnum,
  labelFormatEnum,
  nozzleMaterialEnum,
  nozzleTypeEnum,
  wearLevelEnum,
  accessoryTypeEnum,
  workSurfaceTypeEnum,
  machineTypeEnum,
  changerTypeEnum,
  toolCategoryEnum,
  printJobStatusEnum,
} from "./enums";
import { products, filamentProfiles } from "./central-catalog";
import { hardwareModels } from "./hardware";
import { slots } from "./storage";

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

// ── User Items (owned inventory — spools, resin bottles, etc.) ──────────────

export const userItems = pgTable("user_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  productId: uuid("product_id").references(() => products.id),

  // ── Package type ──────────────────────────────────────────────────────
  packageType: packageTypeEnum("package_type"),

  // ── NFC identification ──────────────────────────────────────────────────
  nfcUid: varchar("nfc_uid", { length: 50 }),
  nfcTagFormat: nfcTagFormatEnum("nfc_tag_format"),
  nfcTagWritten: boolean("nfc_tag_written").default(false), // did we write the tag?
  bambuTrayUid: varchar("bambu_tray_uid", { length: 50 }),

  // ── Weight tracking ─────────────────────────────────────────────────────
  initialWeightG: real("initial_weight_g"),
  currentWeightG: real("current_weight_g"),
  netFilamentWeightG: real("net_filament_weight_g"),
  spoolWeightG: real("spool_weight_g"),
  percentRemaining: integer("percent_remaining"),

  // ── Measured spool dimensions (from scan station, for OEM fingerprinting)
  measuredSpoolOuterDiameterMm: real("measured_spool_outer_diameter_mm"),
  measuredSpoolInnerDiameterMm: real("measured_spool_inner_diameter_mm"),
  measuredSpoolWidthMm: real("measured_spool_width_mm"),
  measuredSpoolHubHoleDiameterMm: real("measured_spool_hub_hole_diameter_mm"),
  measuredSpoolWeightG: real("measured_spool_weight_g"),
  measuredHeightMm: real("measured_height_mm"),
  // Color from scan station sensor
  measuredColorHex: varchar("measured_color_hex", { length: 9 }),
  measuredColorLabL: real("measured_color_lab_l"),
  measuredColorLabA: real("measured_color_lab_a"),
  measuredColorLabB: real("measured_color_lab_b"),
  measuredSpectralData: jsonb("measured_spectral_data"), // AS7341 raw channels

  // ── Cost ────────────────────────────────────────────────────────────────
  purchasePrice: real("purchase_price"),
  purchaseCurrency: varchar("purchase_currency", { length: 3 }),

  // ── Quality ─────────────────────────────────────────────────────────────
  rating: integer("rating"),

  // ── Lifecycle ───────────────────────────────────────────────────────────
  status: itemStatusEnum("status").default("active").notNull(),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }),
  productionDate: varchar("production_date", { length: 20 }),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  emptiedAt: timestamp("emptied_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  // ── Drying state ────────────────────────────────────────────────────────
  lastDriedAt: timestamp("last_dried_at", { withTimezone: true }),
  dryingCycleCount: integer("drying_cycle_count").default(0),

  // ── Location ────────────────────────────────────────────────────────────
  currentSlotId: uuid("current_slot_id").references(() => slots.id),
  storageLocation: varchar("storage_location", { length: 255 }), // freetext fallback

  // ── Provenance ──────────────────────────────────────────────────────────
  lotNumber: varchar("lot_number", { length: 100 }),
  serialNumber: varchar("serial_number", { length: 255 }),
  barcodeValue: varchar("barcode_value", { length: 255 }),
  barcodeFormat: varchar("barcode_format", { length: 50 }),

  // ── Scan reference ──────────────────────────────────────────────────────
  intakeScanEventId: uuid("intake_scan_event_id"), // FK to scan_events, the scan that created this item

  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Machines ────────────────────────────────────────────────────────────────

export const machines = pgTable("machines", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  machineType: machineTypeEnum("machine_type").default("fdm").notNull(),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  firmwareVersion: varchar("firmware_version", { length: 50 }),
  serialNumber: varchar("serial_number", { length: 255 }),
  hasFilamentChanger: boolean("has_filament_changer").default(false),
  filamentChangerSlotCount: integer("filament_changer_slot_count"),
  filamentChangerModel: varchar("filament_changer_model", { length: 50 }),
  nozzleDiameterMm: real("nozzle_diameter_mm"),
  buildVolumeX: integer("build_volume_x"),
  buildVolumeY: integer("build_volume_y"),
  buildVolumeZ: integer("build_volume_z"),
  ipAddress: varchar("ip_address", { length: 45 }),
  mqttTopic: varchar("mqtt_topic", { length: 255 }),
  toolHeadType: varchar("tool_head_type", { length: 50 }),
  nozzleSwapSystem: varchar("nozzle_swap_system", { length: 50 }),
  filamentChangerUnitCount: integer("filament_changer_unit_count"),
  enclosureType: varchar("enclosure_type", { length: 50 }),
  // CNC-specific
  spindleMaxRpm: integer("spindle_max_rpm"),
  spindlePowerW: integer("spindle_power_w"),
  // Laser-specific
  laserPowerW: real("laser_power_w"),
  laserWavelengthNm: integer("laser_wavelength_nm"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Machine Tool Heads ────────────────────────────────────────────────────

export const machineToolHeads = pgTable("machine_tool_heads", {
  id: uuid("id").defaultRandom().primaryKey(),
  machineId: uuid("machine_id")
    .references(() => machines.id)
    .notNull(),
  toolCategory: toolCategoryEnum("tool_category").notNull(),
  name: varchar("name", { length: 255 }),
  // Nozzle fields
  diameterMm: real("diameter_mm"),
  nozzleMaterial: nozzleMaterialEnum("nozzle_material"),
  nozzleType: nozzleTypeEnum("nozzle_type"),
  isInstalled: boolean("is_installed").default(false).notNull(),
  wearLevel: wearLevelEnum("wear_level").default("new").notNull(),
  installCount: integer("install_count").default(0).notNull(),
  lastInstalledAt: timestamp("last_installed_at", { withTimezone: true }),
  // Spindle/bit fields
  bitDiameterMm: real("bit_diameter_mm"),
  bitType: varchar("bit_type", { length: 50 }),
  fluteCount: integer("flute_count"),
  bitMaterial: varchar("bit_material", { length: 50 }),
  // Laser fields
  laserPowerW: real("laser_power_w"),
  laserWavelengthNm: integer("laser_wavelength_nm"),
  focalLengthMm: real("focal_length_mm"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Machine Work Surfaces ────────────────────────────────────────────────

export const machineWorkSurfaces = pgTable("machine_work_surfaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  machineId: uuid("machine_id")
    .references(() => machines.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  type: workSurfaceTypeEnum("type").notNull(),
  isInstalled: boolean("is_installed").default(false).notNull(),
  surfaceCondition: wearLevelEnum("surface_condition").default("new").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Machine Material Slots ──────────────────────────────────────────────

export const machineMaterialSlots = pgTable("machine_material_slots", {
  id: uuid("id").defaultRandom().primaryKey(),
  machineId: uuid("machine_id")
    .references(() => machines.id)
    .notNull(),
  changerType: changerTypeEnum("changer_type").notNull(),
  unitNumber: integer("unit_number").notNull(),
  slotPosition: integer("slot_position").notNull(),
  userItemId: uuid("user_item_id").references(() => userItems.id),
  loadedAt: timestamp("loaded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Machine Accessories ──────────────────────────────────────────────────

export const machineAccessories = pgTable("machine_accessories", {
  id: uuid("id").defaultRandom().primaryKey(),
  machineId: uuid("machine_id")
    .references(() => machines.id)
    .notNull(),
  type: accessoryTypeEnum("type").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  manufacturer: varchar("manufacturer", { length: 255 }),
  model: varchar("model", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── User Printers (physical label printer instances) ─────────────────────────

export const userPrinters = pgTable("user_printers", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  hardwareModelId: uuid("hardware_model_id").references(
    () => hardwareModels.id
  ),
  name: varchar("name", { length: 255 }).notNull(),
  // ── Instance identity ──────────────────────────────────────────────────
  serialNumber: varchar("serial_number", { length: 255 }),
  firmwareVersion: varchar("firmware_version", { length: 50 }),
  bleAddress: varchar("ble_address", { length: 20 }),
  bleName: varchar("ble_name", { length: 100 }),
  // ── USB identity (from USB Host discovery) ─────────────────────────────
  usbVid: varchar("usb_vid", { length: 6 }),
  usbPid: varchar("usb_pid", { length: 6 }),
  usbManufacturer: varchar("usb_manufacturer", { length: 255 }),
  usbProduct: varchar("usb_product", { length: 255 }),
  usbSerial: varchar("usb_serial", { length: 255 }),
  // ── Live state ─────────────────────────────────────────────────────────
  batteryPercent: integer("battery_percent"),
  paperLoaded: boolean("paper_loaded"),
  coverClosed: boolean("cover_closed"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastConnectedVia: varchar("last_connected_via", { length: 10 }), // ble, usb
  // ── Association ────────────────────────────────────────────────────────
  scanStationId: uuid("scan_station_id"), // FK added below to avoid circular
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
  productId: uuid("product_id").references(() => products.id),
  filamentProfileId: uuid("filament_profile_id").references(
    () => filamentProfiles.id
  ),
  machineId: uuid("machine_id").references(() => machines.id),
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
    "app.fillaiq.com/item/"
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

// ── Print Jobs ──────────────────────────────────────────────────────────────

export const printJobs = pgTable("print_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .references(() => users.id)
    .notNull(),
  templateId: uuid("template_id").references(() => labelTemplates.id),
  stationId: uuid("station_id"), // scan station to print on (FK added in relations)
  status: printJobStatusEnum("status").default("pending").notNull(),
  // Label content — JSON with the data fields to render
  labelData: jsonb("label_data").notNull(), // { brand, material, color, nozzleTemp, ... }
  // Batch support: number of copies
  copies: integer("copies").default(1).notNull(),
  // Optional: pre-rendered 1-bit raster (base64) for direct printing
  rasterData: text("raster_data"),
  rasterWidthPx: integer("raster_width_px"),
  rasterHeightPx: integer("raster_height_px"),
  // Error tracking
  errorMessage: text("error_message"),
  printedAt: timestamp("printed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
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
