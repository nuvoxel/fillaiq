/**
 * Seed the catalog with workshop products beyond filament:
 * fasteners, sheet goods, resins, CNC stock, laser materials, tools, etc.
 *
 * Usage: npx tsx scripts/seed-workshop-catalog.ts
 */

import { db } from "../src/db";
import { brands, materials, products } from "../src/db/schema/central-catalog";
import { eq } from "drizzle-orm";

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ── Brands to ensure exist ──────────────────────────────────────────────────

const WORKSHOP_BRANDS = [
  // Fastener brands
  { name: "McMaster-Carr", slug: "mcmaster-carr", website: "https://www.mcmaster.com", countryOfOrigin: "US" },
  { name: "Bolt Depot", slug: "bolt-depot", website: "https://www.boltdepot.com", countryOfOrigin: "US" },
  { name: "Albany County Fasteners", slug: "acf", website: "https://www.albanycountyfasteners.com", countryOfOrigin: "US" },
  // Sheet goods / CNC stock
  { name: "Inventables", slug: "inventables", website: "https://www.inventables.com", countryOfOrigin: "US" },
  { name: "Ocooch Hardwoods", slug: "ocooch", website: "https://ocoochhardwoods.com", countryOfOrigin: "US" },
  { name: "Rowmark", slug: "rowmark", website: "https://www.rowmark.com", countryOfOrigin: "US" },
  { name: "Acrylite", slug: "acrylite", website: "https://www.acrylite.co", countryOfOrigin: "DE" },
  // Resin brands
  { name: "Siraya Tech", slug: "siraya-tech", website: "https://siraya.tech", countryOfOrigin: "US" },
  { name: "Phrozen", slug: "phrozen-resin", website: "https://phrozen3d.com", countryOfOrigin: "TW" },
  { name: "Anycubic", slug: "anycubic-resin", website: "https://www.anycubic.com", countryOfOrigin: "CN" },
  // Tool brands
  { name: "Wiha", slug: "wiha", website: "https://www.wiha.com", countryOfOrigin: "DE" },
  { name: "Wera", slug: "wera", website: "https://www.wera.de", countryOfOrigin: "DE" },
  { name: "iGaging", slug: "igaging", website: "https://www.igagingstore.com", countryOfOrigin: "US" },
  { name: "Mitutoyo", slug: "mitutoyo", website: "https://www.mitutoyo.com", countryOfOrigin: "JP" },
  // Electronics
  { name: "Adafruit", slug: "adafruit", website: "https://www.adafruit.com", countryOfOrigin: "US" },
  { name: "SparkFun", slug: "sparkfun", website: "https://www.sparkfun.com", countryOfOrigin: "US" },
  { name: "Digikey", slug: "digikey", website: "https://www.digikey.com", countryOfOrigin: "US" },
  // Adhesives / consumables
  { name: "3M", slug: "3m", website: "https://www.3m.com", countryOfOrigin: "US" },
  { name: "Loctite", slug: "loctite", website: "https://www.loctite.com", countryOfOrigin: "DE" },
  { name: "Gorilla Glue", slug: "gorilla-glue", website: "https://www.gorillatough.com", countryOfOrigin: "US" },
];

// ── Products ────────────────────────────────────────────────────────────────

interface SeedProduct {
  brand: string;
  name: string;
  category: "filament" | "resin" | "cnc_stock" | "laser_stock" | "consumable" | "other";
  colorName?: string;
  colorHex?: string;
  netWeightG?: number;
}

const WORKSHOP_PRODUCTS: SeedProduct[] = [
  // ── Fasteners (metric) ──────────────────────────────────────────────────
  { brand: "McMaster-Carr", name: "M3x8mm Socket Head Cap Screw (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M3x12mm Socket Head Cap Screw (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M3x16mm Socket Head Cap Screw (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M3x20mm Socket Head Cap Screw (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M3 Hex Nut (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M3 Nylon Lock Nut (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M3 Flat Washer (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M4x10mm Socket Head Cap Screw (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M4x16mm Socket Head Cap Screw (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M4x20mm Socket Head Cap Screw (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M4 Hex Nut (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M5x10mm Button Head Cap Screw (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M5x16mm Button Head Cap Screw (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M5 Hex Nut (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M5 T-Nut for 2020 Extrusion (50pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M3 Brass Heat-Set Insert (100pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M4 Brass Heat-Set Insert (50pk)", category: "consumable" },
  { brand: "McMaster-Carr", name: "M5 Brass Heat-Set Insert (50pk)", category: "consumable" },

  // ── Fasteners (imperial) ────────────────────────────────────────────────
  { brand: "Bolt Depot", name: "#6-32 x 1/2\" Socket Head Cap Screw (100pk)", category: "consumable" },
  { brand: "Bolt Depot", name: "#8-32 x 3/4\" Socket Head Cap Screw (100pk)", category: "consumable" },
  { brand: "Bolt Depot", name: "#10-32 x 1\" Socket Head Cap Screw (100pk)", category: "consumable" },
  { brand: "Bolt Depot", name: "1/4-20 x 1\" Socket Head Cap Screw (50pk)", category: "consumable" },
  { brand: "Bolt Depot", name: "1/4-20 Hex Nut (100pk)", category: "consumable" },
  { brand: "Bolt Depot", name: "#6-32 Hex Nut (100pk)", category: "consumable" },
  { brand: "Bolt Depot", name: "#8-32 Nylon Lock Nut (100pk)", category: "consumable" },

  // ── Sheet goods / CNC stock ─────────────────────────────────────────────
  { brand: "Inventables", name: "Baltic Birch Plywood 12x12\" 3mm", category: "cnc_stock", colorName: "Natural", colorHex: "#D4B483" },
  { brand: "Inventables", name: "Baltic Birch Plywood 12x12\" 6mm", category: "cnc_stock", colorName: "Natural", colorHex: "#D4B483" },
  { brand: "Inventables", name: "MDF 12x12\" 3mm", category: "cnc_stock", colorName: "Brown", colorHex: "#8B6914" },
  { brand: "Inventables", name: "MDF 12x12\" 6mm", category: "cnc_stock", colorName: "Brown", colorHex: "#8B6914" },
  { brand: "Inventables", name: "Clear Acrylic 12x12\" 3mm", category: "laser_stock", colorName: "Clear", colorHex: "#E8F4FD" },
  { brand: "Inventables", name: "Black Acrylic 12x12\" 3mm", category: "laser_stock", colorName: "Black", colorHex: "#1A1A1A" },
  { brand: "Inventables", name: "White Acrylic 12x12\" 3mm", category: "laser_stock", colorName: "White", colorHex: "#FFFFFF" },
  { brand: "Inventables", name: "Red Acrylic 12x12\" 3mm", category: "laser_stock", colorName: "Red", colorHex: "#CC0000" },
  { brand: "Ocooch Hardwoods", name: "Walnut Board 12x6\" 3/4\"", category: "cnc_stock", colorName: "Walnut", colorHex: "#5C4033" },
  { brand: "Ocooch Hardwoods", name: "Maple Board 12x6\" 3/4\"", category: "cnc_stock", colorName: "Maple", colorHex: "#F2D2A9" },
  { brand: "Ocooch Hardwoods", name: "Cherry Board 12x6\" 3/4\"", category: "cnc_stock", colorName: "Cherry", colorHex: "#9B4722" },
  { brand: "Rowmark", name: "LaserMax Black/White 12x24\"", category: "laser_stock", colorName: "Black/White", colorHex: "#1A1A1A" },
  { brand: "Rowmark", name: "LaserMax Blue/White 12x24\"", category: "laser_stock", colorName: "Blue/White", colorHex: "#003399" },
  { brand: "Acrylite", name: "Frosted Acrylic 12x12\" 3mm", category: "laser_stock", colorName: "Frosted", colorHex: "#F0F0F0" },

  // ── Resins ──────────────────────────────────────────────────────────────
  { brand: "Siraya Tech", name: "Fast Navy Grey 1kg", category: "resin", colorName: "Navy Grey", colorHex: "#4A5568", netWeightG: 1000 },
  { brand: "Siraya Tech", name: "Tenacious Clear 1kg", category: "resin", colorName: "Clear", colorHex: "#F7FAFC", netWeightG: 1000 },
  { brand: "Siraya Tech", name: "Blu Tough Clear 1kg", category: "resin", colorName: "Clear Blue", colorHex: "#90CDF4", netWeightG: 1000 },
  { brand: "Siraya Tech", name: "Build Clear 1kg", category: "resin", colorName: "Clear", colorHex: "#FEFCBF", netWeightG: 1000 },
  { brand: "Phrozen", name: "Aqua-Gray 4K 1kg", category: "resin", colorName: "Aqua Gray", colorHex: "#718096", netWeightG: 1000 },
  { brand: "Phrozen", name: "Rock-Black Stiff 1kg", category: "resin", colorName: "Black", colorHex: "#1A202C", netWeightG: 1000 },
  { brand: "Anycubic", name: "Standard Resin Grey 1kg", category: "resin", colorName: "Grey", colorHex: "#A0AEC0", netWeightG: 1000 },
  { brand: "Anycubic", name: "Water Washable White 1kg", category: "resin", colorName: "White", colorHex: "#F7FAFC", netWeightG: 1000 },
  { brand: "ELEGOO", name: "Standard Resin Grey 1kg", category: "resin", colorName: "Grey", colorHex: "#A0AEC0", netWeightG: 1000 },
  { brand: "ELEGOO", name: "ABS-Like Resin Black 1kg", category: "resin", colorName: "Black", colorHex: "#2D3748", netWeightG: 1000 },
  { brand: "ELEGOO", name: "Water Washable Ceramic Grey 1kg", category: "resin", colorName: "Ceramic Grey", colorHex: "#CBD5E0", netWeightG: 1000 },

  // ── Adhesives & consumables ─────────────────────────────────────────────
  { brand: "3M", name: "468MP Transfer Tape 12x12\" Sheet", category: "consumable" },
  { brand: "3M", name: "VHB 4910 Clear 1\" x 36yd", category: "consumable" },
  { brand: "3M", name: "Blue Painters Tape 2\" x 60yd", category: "consumable", colorName: "Blue", colorHex: "#2B6CB0" },
  { brand: "Loctite", name: "Super Glue Gel 20g", category: "consumable" },
  { brand: "Loctite", name: "Threadlocker Blue 242 6ml", category: "consumable", colorName: "Blue", colorHex: "#2B6CB0" },
  { brand: "Loctite", name: "Threadlocker Red 263 10ml", category: "consumable", colorName: "Red", colorHex: "#C53030" },
  { brand: "Gorilla Glue", name: "Super Glue Gel 15g", category: "consumable" },
  { brand: "Gorilla Glue", name: "Wood Glue 8oz", category: "consumable" },

  // ── Electronics / components ────────────────────────────────────────────
  { brand: "Adafruit", name: "AS7341 11-Channel Spectral Sensor Breakout", category: "other" },
  { brand: "Adafruit", name: "VL53L1X Time of Flight Sensor Breakout", category: "other" },
  { brand: "Adafruit", name: "NeoPixel Ring 24 LED (WS2812B)", category: "other" },
  { brand: "Adafruit", name: "BME280 Temp/Humidity/Pressure Sensor", category: "other" },
  { brand: "SparkFun", name: "Qwiic NAU7802 Scale Breakout", category: "other" },
  { brand: "SparkFun", name: "Qwiic Cable 100mm (10pk)", category: "other" },

  // ── CNC bits & tooling ──────────────────────────────────────────────────
  { brand: "Inventables", name: "1/8\" Flat End Mill 2-Flute Carbide", category: "other" },
  { brand: "Inventables", name: "1/4\" Flat End Mill 2-Flute Carbide", category: "other" },
  { brand: "Inventables", name: "1/16\" Ball Nose End Mill Carbide", category: "other" },
  { brand: "Inventables", name: "60-Degree V-Bit 1/4\" Shank", category: "other" },
  { brand: "Inventables", name: "90-Degree V-Bit 1/4\" Shank", category: "other" },

  // ── Measurement tools ───────────────────────────────────────────────────
  { brand: "Mitutoyo", name: "Digital Caliper 6\"/150mm", category: "other" },
  { brand: "iGaging", name: "Digital Caliper 6\" EZ-Cal", category: "other" },
];

// ── Main ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Seeding workshop catalog...\n");

  // Ensure brands exist
  let brandCount = 0;
  const brandIdCache = new Map<string, string>();

  // Cache existing brands
  const existingBrands = await db.select({ id: brands.id, name: brands.name, slug: brands.slug }).from(brands);
  for (const b of existingBrands) brandIdCache.set(b.name, b.id);

  for (const b of WORKSHOP_BRANDS) {
    if (brandIdCache.has(b.name)) continue;
    const [existing] = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, b.slug));
    if (existing) { brandIdCache.set(b.name, existing.id); continue; }

    const [row] = await db.insert(brands).values({
      name: b.name,
      slug: b.slug,
      website: b.website,
      countryOfOrigin: b.countryOfOrigin,
      validationStatus: "validated",
    }).returning({ id: brands.id });
    brandIdCache.set(b.name, row.id);
    brandCount++;
    console.log(`  Brand: ${b.name} ✓`);
  }
  console.log(`  → ${brandCount} brands created\n`);

  // Insert products
  let prodCount = 0;
  let skipped = 0;
  for (const p of WORKSHOP_PRODUCTS) {
    const brandId = brandIdCache.get(p.brand);
    // Skip if product with same name+brand exists
    const [existing] = await db.select({ id: products.id }).from(products)
      .where(eq(products.name, p.name));
    if (existing) { skipped++; continue; }

    await db.insert(products).values({
      brandId: brandId ?? null,
      name: p.name,
      category: p.category,
      colorName: p.colorName ?? null,
      colorHex: p.colorHex ?? null,
      netWeightG: p.netWeightG ?? null,
      validationStatus: "validated",
    });
    prodCount++;
  }

  console.log(`  Products: ${prodCount} created, ${skipped} skipped\n`);
  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
