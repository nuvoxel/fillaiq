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
  bigint,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import {
  validationStatusEnum,
  finishTypeEnum,
  patternTypeEnum,
  fillTypeEnum,
  multiColorDirectionEnum,
  spoolMaterialTypeEnum,
  workSurfaceTypeEnum,
  nfcTagFormatEnum,
  materialClassEnum,
} from "./enums";

// ── Brands ──────────────────────────────────────────────────────────────────

export const brands = pgTable(
  "brands",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    website: varchar("website", { length: 512 }),
    logoUrl: varchar("logo_url", { length: 512 }),
    validationStatus: validationStatusEnum("validation_status")
      .default("draft")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("brands_slug_idx").on(table.slug)]
);

// ── Materials ───────────────────────────────────────────────────────────────

export const materials = pgTable("materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  abbreviation: varchar("abbreviation", { length: 7 }),
  category: varchar("category", { length: 50 }),
  isoClassification: varchar("iso_classification", { length: 100 }),
  materialClass: materialClassEnum("material_class"),
  density: real("density"),
  // Default temps
  defaultNozzleTempMin: integer("default_nozzle_temp_min"),
  defaultNozzleTempMax: integer("default_nozzle_temp_max"),
  defaultBedTempMin: integer("default_bed_temp_min"),
  defaultBedTempMax: integer("default_bed_temp_max"),
  defaultChamberTemp: integer("default_chamber_temp"),
  defaultPreheatTemp: integer("default_preheat_temp"),
  // Drying
  defaultDryingTemp: integer("default_drying_temp"),
  defaultDryingTimeMin: integer("default_drying_time_min"),
  hygroscopic: boolean("hygroscopic"),
  // Fill properties
  fillType: fillTypeEnum("fill_type"),
  fillPercentage: real("fill_percentage"),
  fiberLengthMm: real("fiber_length_mm"),
  // Hardness
  shoreHardnessA: integer("shore_hardness_a"),
  shoreHardnessD: integer("shore_hardness_d"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Filaments ───────────────────────────────────────────────────────────────

export const filaments = pgTable("filaments", {
  id: uuid("id").defaultRandom().primaryKey(),
  brandId: uuid("brand_id").references(() => brands.id),
  materialId: uuid("material_id").references(() => materials.id),
  name: varchar("name", { length: 512 }).notNull(),
  description: text("description"),
  imageUrl: varchar("image_url", { length: 512 }),

  // Color
  colorName: varchar("color_name", { length: 255 }),
  colorHex: varchar("color_hex", { length: 9 }),
  colorR: integer("color_r"),
  colorG: integer("color_g"),
  colorB: integer("color_b"),
  colorA: integer("color_a"),
  // LAB color (colorimeter-measured)
  colorLabL: real("color_lab_l"),
  colorLabA: real("color_lab_a"),
  colorLabB: real("color_lab_b"),
  // Industry matches
  closestPantone: varchar("closest_pantone", { length: 50 }),
  closestRal: varchar("closest_ral", { length: 50 }),
  closestPms: varchar("closest_pms", { length: 50 }),
  colorParent: varchar("color_parent", { length: 50 }),

  // Multi-color
  multiColorHexes: text("multi_color_hexes").array(),
  multiColorDirection: multiColorDirectionEnum("multi_color_direction"),

  // Appearance
  finish: finishTypeEnum("finish"),
  translucent: boolean("translucent"),
  glow: boolean("glow"),
  pattern: patternTypeEnum("pattern"),

  // Transmission distance (HueForge)
  transmissionDistance: real("transmission_distance"),
  tdVoteCount: integer("td_vote_count"),

  // Physical — filament
  diameter: real("diameter").default(1.75),
  netWeightG: real("net_weight_g"),
  actualNetWeightG: real("actual_net_weight_g"),
  filamentLengthM: integer("filament_length_m"),
  actualFilamentLengthM: integer("actual_filament_length_m"),
  minNozzleDiameter: real("min_nozzle_diameter"),

  // Physical — spool
  spoolWeightG: real("spool_weight_g"),
  spoolOuterDiameterMm: integer("spool_outer_diameter_mm"),
  spoolWidthMm: integer("spool_width_mm"),
  spoolInnerDiameterMm: integer("spool_inner_diameter_mm"),
  spoolHoleDiameterMm: integer("spool_hole_diameter_mm"),
  spoolMaterialType: spoolMaterialTypeEnum("spool_material_type"),

  // Print settings
  nozzleTempMin: integer("nozzle_temp_min"),
  nozzleTempMax: integer("nozzle_temp_max"),
  bedTempMin: integer("bed_temp_min"),
  bedTempMax: integer("bed_temp_max"),
  bedTempType: workSurfaceTypeEnum("bed_temp_type"),
  chamberTempMin: integer("chamber_temp_min"),
  chamberTempMax: integer("chamber_temp_max"),
  chamberTemp: integer("chamber_temp"),
  preheatTemp: integer("preheat_temp"),
  dryingTemp: integer("drying_temp"),
  dryingTimeMin: integer("drying_time_min"),
  defaultFlowRatio: real("default_flow_ratio"),
  defaultPressureAdvance: real("default_pressure_advance"),
  fanSpeedMin: integer("fan_speed_min"),
  minVolumetricSpeed: real("min_volumetric_speed"),
  maxVolumetricSpeed: real("max_volumetric_speed"),
  targetVolumetricSpeed: real("target_volumetric_speed"),

  // Bambu-specific
  bambuMaterialId: varchar("bambu_material_id", { length: 50 }),
  bambuVariantId: varchar("bambu_variant_id", { length: 50 }),
  bambuFilamentType: varchar("bambu_filament_type", { length: 50 }),
  bambuDetailedType: varchar("bambu_detailed_type", { length: 100 }),
  bambuXcamInfo: jsonb("bambu_xcam_info"),
  bambuNozzleDiameter: real("bambu_nozzle_diameter"),

  // Provenance
  countryOfOrigin: varchar("country_of_origin", { length: 2 }),
  certifications: text("certifications").array(),
  gtin: bigint("gtin", { mode: "bigint" }),

  // External IDs
  externalSpoolmanDbId: varchar("external_spoolman_db_id", { length: 100 }),
  external3dFpShortCode: varchar("external_3dfp_short_code", { length: 100 }),
  externalFilamentColorsSlug: varchar("external_filament_colors_slug", {
    length: 255,
  }),

  // Commerce
  websiteUrl: varchar("website_url", { length: 512 }),
  amazonAsin: varchar("amazon_asin", { length: 20 }),

  // Status
  validationStatus: validationStatusEnum("validation_status")
    .default("draft")
    .notNull(),
  submittedByUserId: uuid("submitted_by_user_id"),
  discontinued: boolean("discontinued").default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Variants ────────────────────────────────────────────────────────────────

export const variants = pgTable("variants", {
  id: uuid("id").defaultRandom().primaryKey(),
  filamentId: uuid("filament_id")
    .references(() => filaments.id)
    .notNull(),
  name: varchar("name", { length: 255 }),
  oemSupplier: varchar("oem_supplier", { length: 255 }),
  batchCode: varchar("batch_code", { length: 100 }),
  // Override settings (null = inherit from filament)
  nozzleTempMin: integer("nozzle_temp_min"),
  nozzleTempMax: integer("nozzle_temp_max"),
  bedTemp: integer("bed_temp"),
  netWeightG: real("net_weight_g"),
  spoolWeightG: real("spool_weight_g"),
  density: real("density"),
  notes: text("notes"),
  validationStatus: validationStatusEnum("validation_status")
    .default("draft")
    .notNull(),
  submittedByUserId: uuid("submitted_by_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── SKU Mappings ────────────────────────────────────────────────────────────

export const skuMappings = pgTable(
  "sku_mappings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    variantId: uuid("variant_id")
      .references(() => variants.id)
      .notNull(),
    sku: varchar("sku", { length: 100 }),
    barcode: varchar("barcode", { length: 100 }),
    barcodeFormat: varchar("barcode_format", { length: 20 }),
    gtin: bigint("gtin", { mode: "bigint" }),
    packQuantity: integer("pack_quantity").default(1),
    retailer: varchar("retailer", { length: 255 }),
    productUrl: varchar("product_url", { length: 512 }),
    priceAmount: real("price_amount"),
    priceCurrency: varchar("price_currency", { length: 3 }),
    validationStatus: validationStatusEnum("validation_status")
      .default("draft")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [uniqueIndex("sku_mappings_sku_idx").on(table.sku)]
);

// ── NFC Tag Patterns ────────────────────────────────────────────────────────

export const nfcTagPatterns = pgTable("nfc_tag_patterns", {
  id: uuid("id").defaultRandom().primaryKey(),
  variantId: uuid("variant_id")
    .references(() => variants.id)
    .notNull(),
  tagFormat: nfcTagFormatEnum("tag_format").notNull(),
  // Bambu
  bambuVariantId: varchar("bambu_variant_id", { length: 50 }),
  bambuMaterialId: varchar("bambu_material_id", { length: 50 }),
  // TigerTag
  tigerTagProductId: integer("tiger_tag_product_id"),
  tigerTagMaterialId: integer("tiger_tag_material_id"),
  tigerTagBrandId: integer("tiger_tag_brand_id"),
  // OpenPrintTag
  optPackageUuid: uuid("opt_package_uuid"),
  optMaterialUuid: uuid("opt_material_uuid"),
  optBrandUuid: uuid("opt_brand_uuid"),
  // Generic
  patternField: varchar("pattern_field", { length: 100 }),
  patternValue: varchar("pattern_value", { length: 255 }),
  validationStatus: validationStatusEnum("validation_status")
    .default("draft")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Equivalence Groups ──────────────────────────────────────────────────────

export const equivalenceGroups = pgTable("equivalence_groups", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  validationStatus: validationStatusEnum("validation_status")
    .default("draft")
    .notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const filamentEquivalences = pgTable("filament_equivalences", {
  id: uuid("id").defaultRandom().primaryKey(),
  equivalenceGroupId: uuid("equivalence_group_id")
    .references(() => equivalenceGroups.id)
    .notNull(),
  filamentId: uuid("filament_id")
    .references(() => filaments.id)
    .notNull(),
  isPrimary: boolean("is_primary").default(false),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
