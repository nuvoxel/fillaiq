/**
 * Import filament catalog data from SpoolmanDB (MIT licensed).
 * https://github.com/Donkie/SpoolmanDB
 *
 * Fetches the compiled filaments.json and materials.json from GitHub Pages,
 * maps entries to our catalog schema, and upserts brands, materials, and products.
 *
 * Usage: npx tsx scripts/import-spoolmandb.ts
 *   --dry-run    Show what would be imported without writing to DB
 *   --limit N    Only import the first N filaments (for testing)
 */

import { db } from "../src/db";
import { brands, materials, products } from "../src/db/schema/central-catalog";
import { eq, and } from "drizzle-orm";

const FILAMENTS_URL = "https://donkie.github.io/SpoolmanDB/filaments.json";
const MATERIALS_URL = "https://donkie.github.io/SpoolmanDB/materials.json";

const dryRun = process.argv.includes("--dry-run");
const limitArg = process.argv.indexOf("--limit");
const limit = limitArg >= 0 ? parseInt(process.argv[limitArg + 1]) : Infinity;

// ── SpoolmanDB types ────────────────────────────────────────────────────────

interface SpoolmanFilament {
  id: string;
  manufacturer: string;
  name: string;
  material: string;
  density: number;
  weight: number;
  spool_weight: number | null;
  spool_type: string | null;
  diameter: number;
  color_hex: string | null;
  color_hexes: string[] | null;
  extruder_temp: number | null;
  extruder_temp_range: [number, number] | null;
  bed_temp: number | null;
  bed_temp_range: [number, number] | null;
  finish: string | null;
  multi_color_direction: string | null;
  pattern: string | null;
  translucent: boolean | null;
  glow: boolean | null;
}

interface SpoolmanMaterial {
  material: string;
  density: number;
  extruder_temp?: number;
  bed_temp?: number;
}

// ── Mapping helpers ─────────────────────────────────────────────────────────

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// Map SpoolmanDB finish values to our enum
const FINISH_MAP: Record<string, string> = {
  matte: "matte",
  glossy: "glossy",
  satin: "satin",
  silk: "silk",
};

// Map SpoolmanDB pattern values to our enum
const PATTERN_MAP: Record<string, string> = {
  marble: "marble",
  sparkle: "sparkle",
  galaxy: "galaxy",
};

// Map SpoolmanDB multi_color_direction to our enum
const MC_DIR_MAP: Record<string, string> = {
  coaxial: "coaxial",
  longitudinal: "longitudinal",
};

// Map SpoolmanDB material names to our material abbreviations
const MATERIAL_ABBREV_MAP: Record<string, string> = {
  "PLA": "PLA",
  "PLA+": "PLA+",
  "PETG": "PETG",
  "ABS": "ABS",
  "ABS+": "ABS",
  "ASA": "ASA",
  "TPU": "TPU",
  "Nylon": "PA6",
  "PA": "PA6",
  "PA6": "PA6",
  "PA12": "PA12",
  "PC": "PC",
  "PVA": "PVA",
  "HIPS": "HIPS",
  "PP": "PP",
  "PEEK": "PEEK",
  "PEI": "PEI",
  "PCTG": "PCTG",
  "PET": "PET",
  "BVOH": "BVOH",
};

// Extract a color name from the filament name by removing material prefix
function extractColorName(filamentName: string, material: string): string {
  // SpoolmanDB names are usually just the color: "Almond", "Black", "Fire Red"
  return filamentName;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function importSpoolmanDB() {
  console.log("Fetching SpoolmanDB data...\n");

  const [filamentsRes, materialsRes] = await Promise.all([
    fetch(FILAMENTS_URL),
    fetch(MATERIALS_URL),
  ]);

  if (!filamentsRes.ok) throw new Error(`Failed to fetch filaments: ${filamentsRes.status}`);
  if (!materialsRes.ok) throw new Error(`Failed to fetch materials: ${materialsRes.status}`);

  const filaments: SpoolmanFilament[] = await filamentsRes.json();
  const spoolmanMaterials: SpoolmanMaterial[] = await materialsRes.json();

  console.log(`  Fetched ${filaments.length} filaments, ${spoolmanMaterials.length} materials\n`);

  // ── 1. Ensure materials exist ─────────────────────────────────────────

  let matCreated = 0;
  const materialIdCache = new Map<string, string>(); // material name → our DB id

  for (const sm of spoolmanMaterials) {
    const abbrev = MATERIAL_ABBREV_MAP[sm.material] ?? sm.material;
    const [existing] = await db.select({ id: materials.id }).from(materials)
      .where(eq(materials.abbreviation, abbrev));

    if (existing) {
      materialIdCache.set(sm.material, existing.id);
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] Material: ${sm.material} (${abbrev})`);
      continue;
    }

    const [row] = await db.insert(materials).values({
      name: sm.material,
      abbreviation: abbrev,
      category: "thermoplastic",
      density: sm.density,
      defaultDryingTemp: null,
      defaultDryingTimeMin: null,
    }).returning({ id: materials.id });

    materialIdCache.set(sm.material, row.id);
    matCreated++;
  }
  console.log(`  Materials: ${matCreated} created, ${materialIdCache.size} cached\n`);

  // Also cache existing materials from our DB
  const allMaterials = await db.select({ id: materials.id, abbreviation: materials.abbreviation }).from(materials);
  for (const m of allMaterials) {
    if (m.abbreviation && !materialIdCache.has(m.abbreviation)) {
      materialIdCache.set(m.abbreviation, m.id);
    }
  }

  // ── 2. Ensure brands exist ────────────────────────────────────────────

  let brandCreated = 0;
  const brandIdCache = new Map<string, string>(); // manufacturer name → our DB id

  const uniqueBrands = [...new Set(filaments.map(f => f.manufacturer))];
  console.log(`  Processing ${uniqueBrands.length} brands...`);

  for (const name of uniqueBrands) {
    const slug = slugify(name);
    const [existing] = await db.select({ id: brands.id }).from(brands)
      .where(eq(brands.slug, slug));

    if (existing) {
      brandIdCache.set(name, existing.id);
      continue;
    }

    if (dryRun) {
      console.log(`  [dry-run] Brand: ${name}`);
      brandIdCache.set(name, "dry-run");
      continue;
    }

    const [row] = await db.insert(brands).values({
      name,
      slug,
      validationStatus: "validated",
    }).returning({ id: brands.id });

    brandIdCache.set(name, row.id);
    brandCreated++;
  }
  console.log(`  Brands: ${brandCreated} created, ${brandIdCache.size} cached\n`);

  // ── 3. Import filaments as products ───────────────────────────────────

  let prodCreated = 0;
  let prodSkipped = 0;
  let prodErrors = 0;
  const total = Math.min(filaments.length, limit);

  console.log(`  Importing ${total} filaments as products...`);

  for (let i = 0; i < total; i++) {
    const f = filaments[i];

    // Check if already imported (by SpoolmanDB ID)
    const [existing] = await db.select({ id: products.id }).from(products)
      .where(eq(products.externalSpoolmanDbId, f.id));

    if (existing) {
      prodSkipped++;
      continue;
    }

    const brandId = brandIdCache.get(f.manufacturer);
    const materialAbbrev = MATERIAL_ABBREV_MAP[f.material] ?? f.material;
    const materialId = materialIdCache.get(f.material) ?? materialIdCache.get(materialAbbrev);

    const colorHex = f.color_hex ? `#${f.color_hex}` : null;
    const multiColorHexes = f.color_hexes?.map(h => `#${h}`) ?? null;
    const colorName = extractColorName(f.name, f.material);

    // Build product name: "Material Color" or just the SpoolmanDB name
    const productName = `${f.material} ${f.name}`;

    const finish = f.finish ? FINISH_MAP[f.finish] ?? null : null;
    const pattern = f.pattern ? PATTERN_MAP[f.pattern] ?? null : null;
    const mcDir = f.multi_color_direction ? MC_DIR_MAP[f.multi_color_direction] ?? null : null;

    if (dryRun) {
      if (i < 20) console.log(`  [dry-run] ${f.manufacturer} ${productName} ${colorHex ?? ""}`);
      prodCreated++;
      continue;
    }

    try {
      await db.insert(products).values({
        brandId: brandId ?? null,
        materialId: materialId ?? null,
        category: "filament",
        name: productName,
        colorName,
        colorHex,
        multiColorHexes,
        multiColorDirection: mcDir as any,
        finish: finish as any,
        pattern: pattern as any,
        translucent: f.translucent ?? null,
        glow: f.glow ?? null,
        netWeightG: f.weight,
        packageWeightG: f.spool_weight,
        packageStyle: f.spool_type === "plastic" ? "none" as any : null,
        externalSpoolmanDbId: f.id,
        validationStatus: "validated",
      });
      prodCreated++;
    } catch (e) {
      prodErrors++;
      if (prodErrors <= 5) {
        console.error(`  Error importing ${f.id}: ${(e as Error).message.slice(0, 100)}`);
      }
    }

    // Progress
    if ((i + 1) % 500 === 0) {
      console.log(`  ... ${i + 1}/${total} (${prodCreated} created, ${prodSkipped} skipped)`);
    }
  }

  console.log(`\n  Products: ${prodCreated} created, ${prodSkipped} skipped, ${prodErrors} errors`);
  console.log(`\nDone!`);
  process.exit(0);
}

importSpoolmanDB().catch((err) => {
  console.error("Import failed:", err);
  process.exit(1);
});
