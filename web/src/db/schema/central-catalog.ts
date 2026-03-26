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
  validationStatusEnum,
  productCategoryEnum,
  materialClassEnum,
  finishTypeEnum,
  patternTypeEnum,
  fillTypeEnum,
  multiColorDirectionEnum,
  spoolMaterialTypeEnum,
  packageStyleEnum,
  nfcTagFormatEnum,
  aliasTypeEnum,
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
    logoBwUrl: varchar("logo_bw_url", { length: 512 }),
    countryOfOrigin: varchar("country_of_origin", { length: 2 }),
    parentBrandId: uuid("parent_brand_id"), // for sub-brands / OEM relationships
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

// ── Materials (pure material science) ───────────────────────────────────────

export const materials = pgTable("materials", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  abbreviation: varchar("abbreviation", { length: 20 }),
  category: varchar("category", { length: 50 }),
  isoClassification: varchar("iso_classification", { length: 100 }),
  materialClass: materialClassEnum("material_class"),
  density: real("density"),
  // Hygroscopic / drying
  hygroscopic: boolean("hygroscopic"),
  defaultDryingTemp: integer("default_drying_temp"),
  defaultDryingTimeMin: integer("default_drying_time_min"),
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

// ── Products (generic catalog entry) ────────────────────────────────────────

export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    brandId: uuid("brand_id").references(() => brands.id),
    materialId: uuid("material_id").references(() => materials.id),
    category: productCategoryEnum("category").default("filament").notNull(),
    name: varchar("name", { length: 512 }).notNull(),
    description: text("description"),
    imageUrl: varchar("image_url", { length: 512 }),

    // ── Color ─────────────────────────────────────────────────────────────
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
    // Industry color matches
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

    // ── Weight / packaging ────────────────────────────────────────────────
    netWeightG: real("net_weight_g"),
    actualNetWeightG: real("actual_net_weight_g"),
    packageWeightG: real("package_weight_g"), // spool/bottle/box weight
    packageStyle: packageStyleEnum("package_style"),
    packageBarcode: varchar("package_barcode", { length: 100 }),
    packageBarcodeFormat: varchar("package_barcode_format", { length: 20 }),

    // ── Provenance ────────────────────────────────────────────────────────
    countryOfOrigin: varchar("country_of_origin", { length: 2 }),
    certifications: text("certifications").array(),
    gtin: varchar("gtin", { length: 14 }),

    // ── NFC / Manufacturer IDs ──────────────────────────────────────────
    bambuVariantId: varchar("bambu_variant_id", { length: 50 }),
    bambuMaterialId: varchar("bambu_material_id", { length: 50 }),

    // ── External IDs ──────────────────────────────────────────────────────
    externalSpoolmanDbId: varchar("external_spoolman_db_id", { length: 100 }),
    external3dFpShortCode: varchar("external_3dfp_short_code", {
      length: 100,
    }),
    externalFilamentColorsSlug: varchar("external_filament_colors_slug", {
      length: 255,
    }),

    // ── Commerce ──────────────────────────────────────────────────────────
    websiteUrl: varchar("website_url", { length: 512 }),
    amazonAsin: varchar("amazon_asin", { length: 20 }),

    // ── Status ────────────────────────────────────────────────────────────
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
  },
  (table) => [uniqueIndex("products_gtin_idx").on(table.gtin)]
);

// ── Product Reseller Links ───────────────────────────────────────────────────

export const productResellerLinks = pgTable("product_reseller_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .references(() => products.id, { onDelete: "cascade" })
    .notNull(),
  reseller: varchar("reseller", { length: 50 }).notNull(), // amazon, aliexpress, mcmaster, 3dfp, etc.
  url: varchar("url", { length: 1024 }).notNull(),
  affiliateUrl: varchar("affiliate_url", { length: 1024 }),
  price: real("price"),              // current/latest price
  listPrice: real("list_price"),     // MSRP / original price
  salePrice: real("sale_price"),     // discounted price (if on sale)
  currency: varchar("currency", { length: 3 }).default("USD"),
  inStock: boolean("in_stock"),
  couponCode: varchar("coupon_code", { length: 50 }),
  couponDiscountPct: real("coupon_discount_pct"),
  couponExpiresAt: timestamp("coupon_expires_at", { withTimezone: true }),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Price History (one row per price check) ──────────────────────────────────

export const productPriceHistory = pgTable("product_price_history", {
  id: uuid("id").defaultRandom().primaryKey(),
  resellerLinkId: uuid("reseller_link_id")
    .references(() => productResellerLinks.id, { onDelete: "cascade" })
    .notNull(),
  price: real("price").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  inStock: boolean("in_stock"),
  checkedAt: timestamp("checked_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Bulk / Tiered Pricing ────────────────────────────────────────────────────

export const productPriceTiers = pgTable("product_price_tiers", {
  id: uuid("id").defaultRandom().primaryKey(),
  resellerLinkId: uuid("reseller_link_id")
    .references(() => productResellerLinks.id, { onDelete: "cascade" })
    .notNull(),
  minQuantity: integer("min_quantity").default(1).notNull(),
  price: real("price").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  discountLabel: varchar("discount_label", { length: 100 }), // e.g. "Buy 10+, save 15%"
  discountCode: varchar("discount_code", { length: 50 }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// ── Filament Profiles (1:1 extension for category='filament') ───────────────

export const filamentProfiles = pgTable("filament_profiles", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .references(() => products.id)
    .notNull()
    .unique(),

  // ── Filament physical ─────────────────────────────────────────────────
  diameter: real("diameter").default(1.75),
  measuredDiameter: real("measured_diameter"),
  diameterTolerance: real("diameter_tolerance"),
  filamentLengthM: integer("filament_length_m"),
  actualFilamentLengthM: integer("actual_filament_length_m"),
  minNozzleDiameter: real("min_nozzle_diameter"),

  // ── Spool physical (for OEM matching / fingerprinting) ────────────────
  spoolOuterDiameterMm: real("spool_outer_diameter_mm"),
  spoolInnerDiameterMm: real("spool_inner_diameter_mm"),
  spoolWidthMm: real("spool_width_mm"),
  spoolHubHoleDiameterMm: real("spool_hub_hole_diameter_mm"),
  spoolRimDepthMm: real("spool_rim_depth_mm"),
  spoolMaterialType: spoolMaterialTypeEnum("spool_material_type"),
  spoolColor: varchar("spool_color", { length: 50 }),
  spoolWeightG: real("spool_weight_g"),
  spoolHasCardboardInsert: boolean("spool_has_cardboard_insert"),
  // Winding
  windingWidthMm: real("winding_width_mm"),
  windingDiameterMm: real("winding_diameter_mm"),

  // ── Print settings ────────────────────────────────────────────────────
  nozzleTempMin: integer("nozzle_temp_min"),
  nozzleTempMax: integer("nozzle_temp_max"),
  bedTempMin: integer("bed_temp_min"),
  bedTempMax: integer("bed_temp_max"),
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

  // ── HueForge / transmission ───────────────────────────────────────────
  transmissionDistance: real("transmission_distance"),
  tdVoteCount: integer("td_vote_count"),

  // ── Vendor metadata (Bambu, Creality, Prusa, etc.) ────────────────────
  vendorMetadata: jsonb("vendor_metadata"),
  // Examples:
  // { "bambu": { "materialId": "GFL99", "variantId": "...", "filamentType": "PLA", "detailedType": "PLA Basic", "xcamInfo": {...}, "nozzleDiameter": 0.4 } }
  // { "creality": { "materialCode": "..." } }

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
    productId: uuid("product_id")
      .references(() => products.id)
      .notNull(),
    sku: varchar("sku", { length: 100 }),
    barcode: varchar("barcode", { length: 100 }),
    barcodeFormat: varchar("barcode_format", { length: 20 }),
    gtin: varchar("gtin", { length: 14 }),
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
  productId: uuid("product_id")
    .references(() => products.id)
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
  // OpenSpool
  openSpoolVendor: varchar("open_spool_vendor", { length: 255 }),
  openSpoolType: varchar("open_spool_type", { length: 255 }),
  openSpoolColor: varchar("open_spool_color", { length: 100 }),
  // Generic pattern matching
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

// ── Product Aliases ─────────────────────────────────────────────────────────

export const productAliases = pgTable("product_aliases", {
  id: uuid("id").defaultRandom().primaryKey(),
  productId: uuid("product_id")
    .references(() => products.id)
    .notNull(),
  relatedProductId: uuid("related_product_id")
    .references(() => products.id)
    .notNull(),
  aliasType: aliasTypeEnum("alias_type").notNull(),
  confidence: real("confidence").default(1.0),
  bidirectional: boolean("bidirectional").default(true),
  source: varchar("source", { length: 50 }), // 'nfc_match', 'user_submitted', 'community_vote', 'admin', 'auto_detected'
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
