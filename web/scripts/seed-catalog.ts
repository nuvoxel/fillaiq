/**
 * Seed the catalog with filament brands, 3D printer brands, materials,
 * and common hardware models.
 *
 * Usage: npx tsx scripts/seed-catalog.ts
 */

import { db } from "../src/db";
import { brands } from "../src/db/schema/central-catalog";
import { materials } from "../src/db/schema/central-catalog";
import { hardwareModels } from "../src/db/schema/hardware";
import { eq } from "drizzle-orm";

// ── Filament Brands ─────────────────────────────────────────────────────────

const FILAMENT_BRANDS = [
  { name: "Bambu Lab", slug: "bambu-lab", website: "https://bambulab.com", countryOfOrigin: "CN" },
  { name: "Polymaker", slug: "polymaker", website: "https://polymaker.com", countryOfOrigin: "CN" },
  { name: "SUNLU", slug: "sunlu", website: "https://www.sunlu.com", countryOfOrigin: "CN" },
  { name: "eSUN", slug: "esun", website: "https://www.esun3d.com", countryOfOrigin: "CN" },
  { name: "Hatchbox", slug: "hatchbox", website: "https://www.hatchbox3d.com", countryOfOrigin: "US" },
  { name: "Overture", slug: "overture", website: "https://overture3d.com", countryOfOrigin: "CN" },
  { name: "Prusament", slug: "prusament", website: "https://www.prusa3d.com/category/prusament", countryOfOrigin: "CZ" },
  { name: "Inland", slug: "inland", website: "https://www.microcenter.com", countryOfOrigin: "US" },
  { name: "Eryone", slug: "eryone", website: "https://eryone3d.com", countryOfOrigin: "CN" },
  { name: "Jayo", slug: "jayo", website: "https://www.jayo.com", countryOfOrigin: "CN" },
  { name: "Creality", slug: "creality-filament", website: "https://www.creality.com", countryOfOrigin: "CN" },
  { name: "ELEGOO", slug: "elegoo", website: "https://www.elegoo.com", countryOfOrigin: "CN" },
  { name: "Protopasta", slug: "protopasta", website: "https://www.proto-pasta.com", countryOfOrigin: "US" },
  { name: "ColorFabb", slug: "colorfabb", website: "https://colorfabb.com", countryOfOrigin: "NL" },
  { name: "Fiberlogy", slug: "fiberlogy", website: "https://fiberlogy.com", countryOfOrigin: "PL" },
  { name: "FilamentOne", slug: "filamentone", website: "https://www.filamentone.com", countryOfOrigin: "US" },
  { name: "MatterHackers", slug: "matterhackers", website: "https://www.matterhackers.com", countryOfOrigin: "US" },
  { name: "Atomic Filament", slug: "atomic-filament", website: "https://atomicfilament.com", countryOfOrigin: "US" },
  { name: "3DFuel", slug: "3dfuel", website: "https://www.3dfuel.com", countryOfOrigin: "US" },
  { name: "Fillamentum", slug: "fillamentum", website: "https://fillamentum.com", countryOfOrigin: "CZ" },
  { name: "FormFutura", slug: "formfutura", website: "https://formfutura.com", countryOfOrigin: "NL" },
  { name: "Extrudr", slug: "extrudr", website: "https://www.extrudr.com", countryOfOrigin: "AT" },
  { name: "NinjaTek", slug: "ninjatek", website: "https://ninjatek.com", countryOfOrigin: "US" },
  { name: "3DXTECH", slug: "3dxtech", website: "https://www.3dxtech.com", countryOfOrigin: "US" },
  { name: "Polyalchemy", slug: "polyalchemy", website: "https://polyalchemy.com", countryOfOrigin: "US" },
  { name: "Spectrum", slug: "spectrum", website: "https://spectrumfilaments.com", countryOfOrigin: "PL" },
  { name: "Rosa3D", slug: "rosa3d", website: "https://rosa3d.pl", countryOfOrigin: "PL" },
  { name: "Ziro", slug: "ziro", website: "https://ziro3d.com", countryOfOrigin: "CN" },
  { name: "FlashForge", slug: "flashforge-filament", website: "https://www.flashforge.com", countryOfOrigin: "CN" },
  { name: "Anycubic", slug: "anycubic-filament", website: "https://www.anycubic.com", countryOfOrigin: "CN" },
  { name: "Tinmorry", slug: "tinmorry", website: "https://tinmorry.com", countryOfOrigin: "CN" },
  { name: "Duramic", slug: "duramic", website: "https://duramic3d.com", countryOfOrigin: "CN" },
  { name: "Amazon Basics", slug: "amazon-basics", website: "https://www.amazon.com", countryOfOrigin: "US" },
  { name: "Cookiecad", slug: "cookiecad", website: "https://cookiecad.com", countryOfOrigin: "US" },
  { name: "Amolen", slug: "amolen", website: "https://amolen.com", countryOfOrigin: "CN" },
  { name: "iSanmate", slug: "isanmate", website: "https://isanmate.com", countryOfOrigin: "CN" },
  { name: "Kingroon", slug: "kingroon", website: "https://kingroon.com", countryOfOrigin: "CN" },
  { name: "Voxelab", slug: "voxelab", website: "https://www.voxelab3dp.com", countryOfOrigin: "CN" },
  { name: "Snapmaker", slug: "snapmaker-filament", website: "https://snapmaker.com", countryOfOrigin: "CN" },
  { name: "Qidi", slug: "qidi-filament", website: "https://qidi3d.com", countryOfOrigin: "CN" },
];

// ── 3D Printer / Hardware Brands ────────────────────────────────────────────

const PRINTER_BRANDS = [
  { name: "Bambu Lab", slug: "bambu-lab" }, // Already in filament list
  { name: "Prusa Research", slug: "prusa", website: "https://www.prusa3d.com", countryOfOrigin: "CZ" },
  { name: "Creality", slug: "creality", website: "https://www.creality.com", countryOfOrigin: "CN" },
  { name: "Anycubic", slug: "anycubic", website: "https://www.anycubic.com", countryOfOrigin: "CN" },
  { name: "FlashForge", slug: "flashforge", website: "https://www.flashforge.com", countryOfOrigin: "CN" },
  { name: "ELEGOO", slug: "elegoo" }, // Already in filament list
  { name: "Qidi Tech", slug: "qidi", website: "https://qidi3d.com", countryOfOrigin: "CN" },
  { name: "Snapmaker", slug: "snapmaker", website: "https://snapmaker.com", countryOfOrigin: "CN" },
  { name: "Voron Design", slug: "voron", website: "https://vorondesign.com", countryOfOrigin: "US" },
  { name: "Sovol", slug: "sovol", website: "https://sovol3d.com", countryOfOrigin: "CN" },
  { name: "Ultimaker", slug: "ultimaker", website: "https://ultimaker.com", countryOfOrigin: "NL" },
  { name: "Raise3D", slug: "raise3d", website: "https://www.raise3d.com", countryOfOrigin: "CN" },
  { name: "Voxelab", slug: "voxelab", website: "https://www.voxelab3dp.com", countryOfOrigin: "CN" },
  { name: "Phrozen", slug: "phrozen", website: "https://phrozen3d.com", countryOfOrigin: "TW" },
  { name: "Formlabs", slug: "formlabs", website: "https://formlabs.com", countryOfOrigin: "US" },
  { name: "LDO Motors", slug: "ldo-motors", website: "https://ldomotors.com", countryOfOrigin: "CN" },
  { name: "Kingroon", slug: "kingroon" }, // Already in filament list
  { name: "Artillery", slug: "artillery", website: "https://artillery3d.com", countryOfOrigin: "CN" },
  { name: "Lulzbot", slug: "lulzbot", website: "https://www.lulzbot.com", countryOfOrigin: "US" },
  { name: "MakerBot", slug: "makerbot", website: "https://www.makerbot.com", countryOfOrigin: "US" },
];

// ── Materials ───────────────────────────────────────────────────────────────

const MATERIALS = [
  { name: "PLA", abbreviation: "PLA", category: "thermoplastic", density: 1.24, hygroscopic: false, defaultDryingTemp: 55, defaultDryingTimeMin: 240 },
  { name: "PLA+", abbreviation: "PLA+", category: "thermoplastic", density: 1.24, hygroscopic: false, defaultDryingTemp: 55, defaultDryingTimeMin: 240 },
  { name: "PETG", abbreviation: "PETG", category: "thermoplastic", density: 1.27, hygroscopic: true, defaultDryingTemp: 65, defaultDryingTimeMin: 480 },
  { name: "ABS", abbreviation: "ABS", category: "thermoplastic", density: 1.04, hygroscopic: true, defaultDryingTemp: 80, defaultDryingTimeMin: 240 },
  { name: "ASA", abbreviation: "ASA", category: "thermoplastic", density: 1.07, hygroscopic: true, defaultDryingTemp: 80, defaultDryingTimeMin: 240 },
  { name: "TPU", abbreviation: "TPU", category: "thermoplastic", density: 1.21, hygroscopic: true, defaultDryingTemp: 50, defaultDryingTimeMin: 480 },
  { name: "Nylon (PA6)", abbreviation: "PA6", category: "thermoplastic", density: 1.14, hygroscopic: true, defaultDryingTemp: 80, defaultDryingTimeMin: 720 },
  { name: "Nylon (PA12)", abbreviation: "PA12", category: "thermoplastic", density: 1.02, hygroscopic: true, defaultDryingTemp: 80, defaultDryingTimeMin: 720 },
  { name: "Polycarbonate", abbreviation: "PC", category: "thermoplastic", density: 1.20, hygroscopic: true, defaultDryingTemp: 80, defaultDryingTimeMin: 480 },
  { name: "PC-ABS", abbreviation: "PC-ABS", category: "thermoplastic", density: 1.10, hygroscopic: true, defaultDryingTemp: 80, defaultDryingTimeMin: 480 },
  { name: "PCTG", abbreviation: "PCTG", category: "thermoplastic", density: 1.23, hygroscopic: true, defaultDryingTemp: 65, defaultDryingTimeMin: 480 },
  { name: "PVA", abbreviation: "PVA", category: "thermoplastic", density: 1.23, hygroscopic: true, defaultDryingTemp: 50, defaultDryingTimeMin: 480 },
  { name: "BVOH", abbreviation: "BVOH", category: "thermoplastic", density: 1.14, hygroscopic: true, defaultDryingTemp: 50, defaultDryingTimeMin: 480 },
  { name: "HIPS", abbreviation: "HIPS", category: "thermoplastic", density: 1.04, hygroscopic: false, defaultDryingTemp: 70, defaultDryingTimeMin: 240 },
  { name: "PET", abbreviation: "PET", category: "thermoplastic", density: 1.38, hygroscopic: true, defaultDryingTemp: 65, defaultDryingTimeMin: 480 },
  { name: "PEEK", abbreviation: "PEEK", category: "thermoplastic", density: 1.30, hygroscopic: true, defaultDryingTemp: 150, defaultDryingTimeMin: 480 },
  { name: "PEI (ULTEM)", abbreviation: "PEI", category: "thermoplastic", density: 1.27, hygroscopic: true, defaultDryingTemp: 150, defaultDryingTimeMin: 480 },
  { name: "PP", abbreviation: "PP", category: "thermoplastic", density: 0.90, hygroscopic: false, defaultDryingTemp: 55, defaultDryingTimeMin: 240 },
  { name: "PLA Carbon Fiber", abbreviation: "PLA-CF", category: "composite", density: 1.29, hygroscopic: false, defaultDryingTemp: 55, defaultDryingTimeMin: 240, fillType: "carbon_fiber" as const },
  { name: "PETG Carbon Fiber", abbreviation: "PETG-CF", category: "composite", density: 1.33, hygroscopic: true, defaultDryingTemp: 65, defaultDryingTimeMin: 480, fillType: "carbon_fiber" as const },
  { name: "PA6 Carbon Fiber", abbreviation: "PA6-CF", category: "composite", density: 1.20, hygroscopic: true, defaultDryingTemp: 80, defaultDryingTimeMin: 720, fillType: "carbon_fiber" as const },
  { name: "ABS Glass Fiber", abbreviation: "ABS-GF", category: "composite", density: 1.20, hygroscopic: true, defaultDryingTemp: 80, defaultDryingTimeMin: 240, fillType: "glass_fiber" as const },
  { name: "PLA Silk", abbreviation: "PLA-Silk", category: "thermoplastic", density: 1.24, hygroscopic: false, defaultDryingTemp: 55, defaultDryingTimeMin: 240 },
  { name: "PLA Matte", abbreviation: "PLA-Matte", category: "thermoplastic", density: 1.24, hygroscopic: false, defaultDryingTemp: 55, defaultDryingTimeMin: 240 },
  { name: "Wood Fill PLA", abbreviation: "PLA-Wood", category: "composite", density: 1.15, hygroscopic: true, defaultDryingTemp: 55, defaultDryingTimeMin: 240, fillType: "wood" as const },
  { name: "Standard Resin", abbreviation: "Resin", category: "photopolymer", density: 1.10 },
  { name: "ABS-Like Resin", abbreviation: "ABS-Resin", category: "photopolymer", density: 1.12 },
  { name: "Water Washable Resin", abbreviation: "WW-Resin", category: "photopolymer", density: 1.10 },
];

// ── Hardware Models (3D Printers) ───────────────────────────────────────────

const PRINTER_MODELS = [
  // Bambu Lab
  { manufacturer: "Bambu Lab", model: "A1 Mini", slug: "bambu-a1-mini", category: "fdm_printer" as const, buildX: 180, buildY: 180, buildZ: 180 },
  { manufacturer: "Bambu Lab", model: "A1", slug: "bambu-a1", category: "fdm_printer" as const, buildX: 256, buildY: 256, buildZ: 256 },
  { manufacturer: "Bambu Lab", model: "P1S", slug: "bambu-p1s", category: "fdm_printer" as const, buildX: 256, buildY: 256, buildZ: 256 },
  { manufacturer: "Bambu Lab", model: "P1P", slug: "bambu-p1p", category: "fdm_printer" as const, buildX: 256, buildY: 256, buildZ: 256 },
  { manufacturer: "Bambu Lab", model: "X1 Carbon", slug: "bambu-x1c", category: "fdm_printer" as const, buildX: 256, buildY: 256, buildZ: 256 },
  { manufacturer: "Bambu Lab", model: "X1E", slug: "bambu-x1e", category: "fdm_printer" as const, buildX: 256, buildY: 256, buildZ: 256 },
  { manufacturer: "Bambu Lab", model: "H2D", slug: "bambu-h2d", category: "fdm_printer" as const, buildX: 350, buildY: 320, buildZ: 325 },
  // Prusa
  { manufacturer: "Prusa Research", model: "MK4S", slug: "prusa-mk4s", category: "fdm_printer" as const, buildX: 250, buildY: 210, buildZ: 220 },
  { manufacturer: "Prusa Research", model: "MK3S+", slug: "prusa-mk3s-plus", category: "fdm_printer" as const, buildX: 250, buildY: 210, buildZ: 210 },
  { manufacturer: "Prusa Research", model: "Mini+", slug: "prusa-mini-plus", category: "fdm_printer" as const, buildX: 180, buildY: 180, buildZ: 180 },
  { manufacturer: "Prusa Research", model: "XL", slug: "prusa-xl", category: "fdm_printer" as const, buildX: 360, buildY: 360, buildZ: 360 },
  { manufacturer: "Prusa Research", model: "Core One", slug: "prusa-core-one", category: "fdm_printer" as const, buildX: 250, buildY: 220, buildZ: 270 },
  // Creality
  { manufacturer: "Creality", model: "Ender 3 V3", slug: "creality-ender3-v3", category: "fdm_printer" as const, buildX: 220, buildY: 220, buildZ: 250 },
  { manufacturer: "Creality", model: "Ender 3 V3 KE", slug: "creality-ender3-v3-ke", category: "fdm_printer" as const, buildX: 220, buildY: 220, buildZ: 240 },
  { manufacturer: "Creality", model: "K1", slug: "creality-k1", category: "fdm_printer" as const, buildX: 220, buildY: 220, buildZ: 250 },
  { manufacturer: "Creality", model: "K1 Max", slug: "creality-k1-max", category: "fdm_printer" as const, buildX: 300, buildY: 300, buildZ: 300 },
  { manufacturer: "Creality", model: "K2 Plus", slug: "creality-k2-plus", category: "fdm_printer" as const, buildX: 350, buildY: 350, buildZ: 350 },
  // ELEGOO
  { manufacturer: "ELEGOO", model: "Neptune 4 Pro", slug: "elegoo-neptune4-pro", category: "fdm_printer" as const, buildX: 225, buildY: 225, buildZ: 265 },
  { manufacturer: "ELEGOO", model: "Neptune 4 Max", slug: "elegoo-neptune4-max", category: "fdm_printer" as const, buildX: 420, buildY: 420, buildZ: 480 },
  { manufacturer: "ELEGOO", model: "Mars 5 Ultra", slug: "elegoo-mars5-ultra", category: "resin_printer" as const, buildX: 153, buildY: 77, buildZ: 200 },
  { manufacturer: "ELEGOO", model: "Saturn 4 Ultra", slug: "elegoo-saturn4-ultra", category: "resin_printer" as const, buildX: 218, buildY: 123, buildZ: 260 },
  // Anycubic
  { manufacturer: "Anycubic", model: "Kobra 3", slug: "anycubic-kobra3", category: "fdm_printer" as const, buildX: 250, buildY: 250, buildZ: 260 },
  { manufacturer: "Anycubic", model: "Photon Mono M7 Pro", slug: "anycubic-photon-m7-pro", category: "resin_printer" as const, buildX: 223, buildY: 126, buildZ: 245 },
  // Qidi
  { manufacturer: "Qidi Tech", model: "X-Max 3", slug: "qidi-xmax3", category: "fdm_printer" as const, buildX: 325, buildY: 325, buildZ: 315 },
  { manufacturer: "Qidi Tech", model: "X-Plus 3", slug: "qidi-xplus3", category: "fdm_printer" as const, buildX: 280, buildY: 280, buildZ: 270 },
  // Sovol
  { manufacturer: "Sovol", model: "SV08", slug: "sovol-sv08", category: "fdm_printer" as const, buildX: 350, buildY: 350, buildZ: 400 },
  // Label printers
  { manufacturer: "Phomemo", model: "M02", slug: "phomemo-m02", category: "label_printer" as const },
  { manufacturer: "Phomemo", model: "M110", slug: "phomemo-m110", category: "label_printer" as const },
  { manufacturer: "Phomemo", model: "M220", slug: "phomemo-m220", category: "label_printer" as const },
  { manufacturer: "NIIMBOT", model: "D110", slug: "niimbot-d110", category: "label_printer" as const },
  { manufacturer: "NIIMBOT", model: "B21", slug: "niimbot-b21", category: "label_printer" as const },
  { manufacturer: "Brother", model: "P-Touch Cube", slug: "brother-pt-cube", category: "label_printer" as const },
  // Dryboxes
  { manufacturer: "SUNLU", model: "FilaDryer S4", slug: "sunlu-filadryer-s4", category: "drybox" as const },
  { manufacturer: "eSUN", model: "eBOX Lite", slug: "esun-ebox-lite", category: "drybox" as const },
  { manufacturer: "Creality", model: "Space Pi Filament Dryer", slug: "creality-space-pi", category: "drybox" as const },
  { manufacturer: "Bambu Lab", model: "AMS", slug: "bambu-ams", category: "filament_changer" as const },
  { manufacturer: "Bambu Lab", model: "AMS Lite", slug: "bambu-ams-lite", category: "filament_changer" as const },
  { manufacturer: "Prusa Research", model: "MMU3", slug: "prusa-mmu3", category: "filament_changer" as const },
];

// ── Main ────────────────────────────────────────────────────────────────────

async function seed() {
  console.log("Seeding catalog...\n");

  // Merge all brand names (dedup by slug)
  const allBrands = new Map<string, typeof FILAMENT_BRANDS[0]>();
  for (const b of FILAMENT_BRANDS) allBrands.set(b.slug, b);
  for (const b of PRINTER_BRANDS) {
    if (!allBrands.has(b.slug)) allBrands.set(b.slug, b as any);
  }

  // Insert brands
  let brandCount = 0;
  for (const b of allBrands.values()) {
    const existing = await db.select({ id: brands.id }).from(brands).where(eq(brands.slug, b.slug));
    if (existing.length > 0) {
      console.log(`  Brand: ${b.name} (exists)`);
      continue;
    }
    await db.insert(brands).values({
      name: b.name,
      slug: b.slug,
      website: b.website ?? null,
      countryOfOrigin: b.countryOfOrigin ?? null,
      validationStatus: "validated",
    });
    brandCount++;
    console.log(`  Brand: ${b.name} ✓`);
  }
  console.log(`\n  → ${brandCount} brands created\n`);

  // Insert materials
  let matCount = 0;
  for (const m of MATERIALS) {
    const existing = await db.select({ id: materials.id }).from(materials).where(eq(materials.abbreviation, m.abbreviation));
    if (existing.length > 0) {
      console.log(`  Material: ${m.name} (exists)`);
      continue;
    }
    await db.insert(materials).values({
      name: m.name,
      abbreviation: m.abbreviation,
      category: m.category,
      density: m.density ?? null,
      hygroscopic: m.hygroscopic ?? null,
      defaultDryingTemp: m.defaultDryingTemp ?? null,
      defaultDryingTimeMin: m.defaultDryingTimeMin ?? null,
      fillType: (m as any).fillType ?? null,
    });
    matCount++;
    console.log(`  Material: ${m.name} ✓`);
  }
  console.log(`\n  → ${matCount} materials created\n`);

  // Insert hardware models
  let hwCount = 0;
  for (const h of PRINTER_MODELS) {
    const existing = await db.select({ id: hardwareModels.id }).from(hardwareModels).where(eq(hardwareModels.slug, h.slug));
    if (existing.length > 0) {
      console.log(`  Hardware: ${h.manufacturer} ${h.model} (exists)`);
      continue;
    }
    await db.insert(hardwareModels).values({
      manufacturer: h.manufacturer,
      model: h.model,
      slug: h.slug,
      category: h.category,
      buildVolumeX: (h as any).buildX ?? null,
      buildVolumeY: (h as any).buildY ?? null,
      buildVolumeZ: (h as any).buildZ ?? null,
    });
    hwCount++;
    console.log(`  Hardware: ${h.manufacturer} ${h.model} ✓`);
  }
  console.log(`\n  → ${hwCount} hardware models created\n`);

  console.log("Done!");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
