CREATE TYPE "public"."accessory_type" AS ENUM('smoke_extractor', 'enclosure', 'camera', 'light', 'exhaust_fan', 'filament_buffer', 'purge_tray', 'dust_collector', 'air_assist', 'rotary_module', 'other');--> statement-breakpoint
CREATE TYPE "public"."changer_type" AS ENUM('ams', 'ams_lite', 'mmu', 'manual');--> statement-breakpoint
CREATE TYPE "public"."machine_type" AS ENUM('fdm', 'cnc', 'laser', 'resin', 'multi');--> statement-breakpoint
CREATE TYPE "public"."nozzle_material" AS ENUM('brass', 'hardened_steel', 'stainless_steel', 'copper_alloy', 'ruby');--> statement-breakpoint
CREATE TYPE "public"."nozzle_type" AS ENUM('standard', 'high_flow', 'chc', 'revo');--> statement-breakpoint
CREATE TYPE "public"."tool_category" AS ENUM('nozzle', 'spindle_bit', 'laser_module');--> statement-breakpoint
CREATE TYPE "public"."wear_level" AS ENUM('new', 'good', 'worn', 'replace');--> statement-breakpoint
CREATE TYPE "public"."work_surface_type" AS ENUM('cool_plate', 'textured_pei', 'engineering_plate', 'high_temp_plate', 'wasteboard', 'aluminum_bed', 'vacuum_table', 'honeycomb_bed', 'knife_blade_bed', 'material_pass_through');--> statement-breakpoint
CREATE TABLE "machine_accessories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" uuid NOT NULL,
	"type" "accessory_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"manufacturer" varchar(255),
	"model" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_material_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" uuid NOT NULL,
	"changer_type" "changer_type" NOT NULL,
	"unit_number" integer NOT NULL,
	"slot_position" integer NOT NULL,
	"spool_id" uuid,
	"loaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_tool_heads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" uuid NOT NULL,
	"tool_category" "tool_category" NOT NULL,
	"name" varchar(255),
	"diameter_mm" real,
	"nozzle_material" "nozzle_material",
	"nozzle_type" "nozzle_type",
	"is_installed" boolean DEFAULT false NOT NULL,
	"wear_level" "wear_level" DEFAULT 'new' NOT NULL,
	"install_count" integer DEFAULT 0 NOT NULL,
	"last_installed_at" timestamp with time zone,
	"bit_diameter_mm" real,
	"bit_type" varchar(50),
	"flute_count" integer,
	"bit_material" varchar(50),
	"laser_power_w" real,
	"laser_wavelength_nm" integer,
	"focal_length_mm" real,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machine_work_surfaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"machine_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "work_surface_type" NOT NULL,
	"is_installed" boolean DEFAULT false NOT NULL,
	"surface_condition" "wear_level" DEFAULT 'new' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "machines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"machine_type" "machine_type" DEFAULT 'fdm' NOT NULL,
	"manufacturer" varchar(255),
	"model" varchar(255),
	"firmware_version" varchar(50),
	"serial_number" varchar(255),
	"has_filament_changer" boolean DEFAULT false,
	"filament_changer_slot_count" integer,
	"filament_changer_model" varchar(50),
	"nozzle_diameter_mm" real,
	"build_volume_x" integer,
	"build_volume_y" integer,
	"build_volume_z" integer,
	"ip_address" varchar(45),
	"mqtt_topic" varchar(255),
	"tool_head_type" varchar(50),
	"nozzle_swap_system" varchar(50),
	"filament_changer_unit_count" integer,
	"enclosure_type" varchar(50),
	"spindle_max_rpm" integer,
	"spindle_power_w" integer,
	"laser_power_w" real,
	"laser_wavelength_nm" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_notifications" boolean DEFAULT true NOT NULL,
	"weight_warnings" boolean DEFAULT true NOT NULL,
	"auto_archive_empty" boolean DEFAULT false NOT NULL,
	"dark_mode" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" varchar(100) NOT NULL,
	"subcategory" varchar(100),
	"name" varchar(255) NOT NULL,
	"description" text,
	"weight_g" real,
	"height_mm" real,
	"width_mm" real,
	"length_mm" real,
	"diameter_mm" real,
	"color_hex" varchar(7),
	"color_lab_l" real,
	"color_lab_a" real,
	"color_lab_b" real,
	"thread_pitch" varchar(20),
	"head_type" varchar(50),
	"drive_type" varchar(50),
	"fastener_material" varchar(50),
	"part_number" varchar(100),
	"package_type" varchar(50),
	"quantity" integer DEFAULT 0,
	"storage_location" varchar(255),
	"bin_label" varchar(50),
	"supplier" varchar(255),
	"supplier_part_number" varchar(100),
	"unit_price" real,
	"currency" varchar(3),
	"purchase_url" varchar(1024),
	"photo_url" varchar(1024),
	"nfc_uid" varchar(50),
	"barcode_value" varchar(255),
	"last_scan_event_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"station_id" uuid NOT NULL,
	"user_id" uuid,
	"weight_g" real,
	"weight_stable" boolean,
	"height_mm" real,
	"distance_mm" real,
	"spectral_data" jsonb,
	"color_hex" varchar(7),
	"color_lab_l" real,
	"color_lab_a" real,
	"color_lab_b" real,
	"nfc_present" boolean DEFAULT false,
	"nfc_uid" varchar(50),
	"nfc_uid_length" integer,
	"nfc_tag_type" integer,
	"nfc_raw_data" text,
	"nfc_sectors_read" integer,
	"nfc_pages_read" integer,
	"photo_url" varchar(1024),
	"barcode_value" varchar(255),
	"barcode_format" varchar(50),
	"turntable_angle" real,
	"identified" boolean DEFAULT false,
	"confidence" real,
	"identified_type" varchar(50),
	"identified_item_id" uuid,
	"identified_spool_id" uuid,
	"ai_suggestions" jsonb,
	"user_confirmed" boolean,
	"user_override_data" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scan_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"hardware_id" varchar(50) NOT NULL,
	"firmware_version" varchar(50),
	"ip_address" varchar(45),
	"platform_height_mm" real,
	"weight_calibration_factor" real,
	"has_turntable" boolean DEFAULT false,
	"has_color_sensor" boolean DEFAULT false,
	"has_tof_sensor" boolean DEFAULT false,
	"has_camera" boolean DEFAULT false,
	"last_seen_at" timestamp with time zone,
	"is_online" boolean DEFAULT false,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "printers" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "printers" CASCADE;--> statement-breakpoint
ALTER TABLE "user_print_profiles" DROP CONSTRAINT "user_print_profiles_printer_id_printers_id_fk";
--> statement-breakpoint
ALTER TABLE "usage_sessions" DROP CONSTRAINT "usage_sessions_printer_id_printers_id_fk";
--> statement-breakpoint
ALTER TABLE "filaments" ALTER COLUMN "bed_temp_type" SET DATA TYPE "public"."work_surface_type" USING "bed_temp_type"::text::"public"."work_surface_type";--> statement-breakpoint
ALTER TABLE "user_print_profiles" ADD COLUMN "machine_id" uuid;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD COLUMN "machine_id" uuid;--> statement-breakpoint
ALTER TABLE "machine_accessories" ADD CONSTRAINT "machine_accessories_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_material_slots" ADD CONSTRAINT "machine_material_slots_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_material_slots" ADD CONSTRAINT "machine_material_slots_spool_id_spools_id_fk" FOREIGN KEY ("spool_id") REFERENCES "public"."spools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_tool_heads" ADD CONSTRAINT "machine_tool_heads_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_work_surfaces" ADD CONSTRAINT "machine_work_surfaces_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_last_scan_event_id_scan_events_id_fk" FOREIGN KEY ("last_scan_event_id") REFERENCES "public"."scan_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_station_id_scan_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."scan_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_identified_spool_id_spools_id_fk" FOREIGN KEY ("identified_spool_id") REFERENCES "public"."spools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_stations" ADD CONSTRAINT "scan_stations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_user_id_idx" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scan_stations_hardware_id_idx" ON "scan_stations" USING btree ("hardware_id");--> statement-breakpoint
ALTER TABLE "user_print_profiles" ADD CONSTRAINT "user_print_profiles_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_print_profiles" DROP COLUMN "printer_id";--> statement-breakpoint
ALTER TABLE "usage_sessions" DROP COLUMN "printer_id";--> statement-breakpoint
DROP TYPE "public"."bed_temp_type";