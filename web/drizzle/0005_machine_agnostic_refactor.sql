-- Machine-agnostic schema refactor
-- Renames printer tables/columns to machine equivalents, adds CNC/laser support

-- ── New enums ───────────────────────────────────────────────────────────────

CREATE TYPE "public"."machine_type" AS ENUM('fdm', 'cnc', 'laser', 'resin', 'multi');
CREATE TYPE "public"."changer_type" AS ENUM('ams', 'ams_lite', 'mmu', 'manual');
CREATE TYPE "public"."tool_category" AS ENUM('nozzle', 'spindle_bit', 'laser_module');

-- ── Rename bed_temp_type → work_surface_type and add values ─────────────────

ALTER TYPE "public"."bed_temp_type" RENAME TO "work_surface_type";
ALTER TYPE "public"."work_surface_type" ADD VALUE IF NOT EXISTS 'wasteboard';
ALTER TYPE "public"."work_surface_type" ADD VALUE IF NOT EXISTS 'aluminum_bed';
ALTER TYPE "public"."work_surface_type" ADD VALUE IF NOT EXISTS 'vacuum_table';
ALTER TYPE "public"."work_surface_type" ADD VALUE IF NOT EXISTS 'honeycomb_bed';
ALTER TYPE "public"."work_surface_type" ADD VALUE IF NOT EXISTS 'knife_blade_bed';
ALTER TYPE "public"."work_surface_type" ADD VALUE IF NOT EXISTS 'material_pass_through';

-- ── Expand accessory_type ──────────────────────────────────────────────────

ALTER TYPE "public"."accessory_type" ADD VALUE IF NOT EXISTS 'dust_collector';
ALTER TYPE "public"."accessory_type" ADD VALUE IF NOT EXISTS 'air_assist';
ALTER TYPE "public"."accessory_type" ADD VALUE IF NOT EXISTS 'rotary_module';

-- ── Rename printers → machines ─────────────────────────────────────────────

ALTER TABLE "printers" RENAME TO "machines";
ALTER TABLE "machines" ADD COLUMN "machine_type" "machine_type" DEFAULT 'fdm' NOT NULL;
ALTER TABLE "machines" RENAME COLUMN "has_ams" TO "has_filament_changer";
ALTER TABLE "machines" RENAME COLUMN "ams_slot_count" TO "filament_changer_slot_count";
ALTER TABLE "machines" RENAME COLUMN "ams_model" TO "filament_changer_model";
ALTER TABLE "machines" RENAME COLUMN "ams_unit_count" TO "filament_changer_unit_count";
ALTER TABLE "machines" ADD COLUMN "spindle_max_rpm" integer;
ALTER TABLE "machines" ADD COLUMN "spindle_power_w" integer;
ALTER TABLE "machines" ADD COLUMN "laser_power_w" real;
ALTER TABLE "machines" ADD COLUMN "laser_wavelength_nm" integer;

-- ── Rename printer_nozzles → machine_tool_heads ────────────────────────────

ALTER TABLE "printer_nozzles" RENAME TO "machine_tool_heads";
ALTER TABLE "machine_tool_heads" RENAME COLUMN "printer_id" TO "machine_id";
ALTER TABLE "machine_tool_heads" ADD COLUMN "tool_category" "tool_category" NOT NULL DEFAULT 'nozzle';
ALTER TABLE "machine_tool_heads" ADD COLUMN "name" varchar(255);
ALTER TABLE "machine_tool_heads" RENAME COLUMN "material" TO "nozzle_material";
ALTER TABLE "machine_tool_heads" RENAME COLUMN "type" TO "nozzle_type";
-- Make nozzle-specific fields nullable for non-nozzle tool heads
ALTER TABLE "machine_tool_heads" ALTER COLUMN "diameter_mm" DROP NOT NULL;
ALTER TABLE "machine_tool_heads" ALTER COLUMN "nozzle_material" DROP NOT NULL;
ALTER TABLE "machine_tool_heads" ALTER COLUMN "nozzle_type" DROP NOT NULL;
-- Add spindle/bit fields
ALTER TABLE "machine_tool_heads" ADD COLUMN "bit_diameter_mm" real;
ALTER TABLE "machine_tool_heads" ADD COLUMN "bit_type" varchar(50);
ALTER TABLE "machine_tool_heads" ADD COLUMN "flute_count" integer;
ALTER TABLE "machine_tool_heads" ADD COLUMN "bit_material" varchar(50);
-- Add laser fields
ALTER TABLE "machine_tool_heads" ADD COLUMN "laser_power_w" real;
ALTER TABLE "machine_tool_heads" ADD COLUMN "laser_wavelength_nm" integer;
ALTER TABLE "machine_tool_heads" ADD COLUMN "focal_length_mm" real;

-- ── Rename printer_build_plates → machine_work_surfaces ────────────────────

ALTER TABLE "printer_build_plates" RENAME TO "machine_work_surfaces";
ALTER TABLE "machine_work_surfaces" RENAME COLUMN "printer_id" TO "machine_id";

-- ── Rename printer_ams_slots → machine_material_slots ─────────────────────

ALTER TABLE "printer_ams_slots" RENAME TO "machine_material_slots";
ALTER TABLE "machine_material_slots" RENAME COLUMN "printer_id" TO "machine_id";
ALTER TABLE "machine_material_slots" RENAME COLUMN "ams_unit" TO "unit_number";
ALTER TABLE "machine_material_slots" ADD COLUMN "changer_type" "changer_type" NOT NULL DEFAULT 'ams';

-- ── Rename printer_accessories → machine_accessories ──────────────────────

ALTER TABLE "printer_accessories" RENAME TO "machine_accessories";
ALTER TABLE "machine_accessories" RENAME COLUMN "printer_id" TO "machine_id";

-- ── Update FK references in other tables ──────────────────────────────────

ALTER TABLE "user_print_profiles" RENAME COLUMN "printer_id" TO "machine_id";
ALTER TABLE "usage_sessions" RENAME COLUMN "printer_id" TO "machine_id";
