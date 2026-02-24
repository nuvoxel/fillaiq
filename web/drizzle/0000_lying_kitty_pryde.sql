CREATE TYPE "public"."bed_temp_type" AS ENUM('cool_plate', 'textured_pei', 'engineering_plate', 'high_temp_plate');--> statement-breakpoint
CREATE TYPE "public"."connection_type" AS ENUM('wifi', 'ethernet');--> statement-breakpoint
CREATE TYPE "public"."equipment_type" AS ENUM('drybox', 'enclosure', 'storage_bin', 'other');--> statement-breakpoint
CREATE TYPE "public"."fill_type" AS ENUM('none', 'carbon_fiber', 'glass_fiber', 'wood', 'ceramic', 'kevlar', 'metal', 'glow');--> statement-breakpoint
CREATE TYPE "public"."finish_type" AS ENUM('matte', 'glossy', 'satin', 'silk');--> statement-breakpoint
CREATE TYPE "public"."label_format" AS ENUM('labelife_image', 'labelife_native', 'png', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."material_class" AS ENUM('fff', 'sla');--> statement-breakpoint
CREATE TYPE "public"."multi_color_direction" AS ENUM('coaxial', 'longitudinal');--> statement-breakpoint
CREATE TYPE "public"."nfc_tag_format" AS ENUM('bambu_mifare', 'creality', 'open_print_tag', 'open_spool', 'open_tag_3d', 'tiger_tag', 'ntag', 'filla_iq', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."pattern_type" AS ENUM('solid', 'marble', 'sparkle', 'galaxy', 'wood_grain', 'gradient');--> statement-breakpoint
CREATE TYPE "public"."slot_state" AS ENUM('empty', 'detecting', 'active', 'unknown_spool', 'removed', 'error');--> statement-breakpoint
CREATE TYPE "public"."spool_material_type" AS ENUM('plastic', 'cardboard', 'metal', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."spool_status" AS ENUM('active', 'empty', 'archived');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."submission_type" AS ENUM('new_filament', 'new_variant', 'correction', 'equivalence');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('draft', 'submitted', 'validated', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."weight_event_type" AS ENUM('placed', 'removed', 'reading', 'usage', 'drying');--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"website" varchar(512),
	"logo_url" varchar(512),
	"validation_status" "validation_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equivalence_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"validation_status" "validation_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filament_equivalences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"equivalence_group_id" uuid NOT NULL,
	"filament_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT false,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filaments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"material_id" uuid,
	"name" varchar(512) NOT NULL,
	"description" text,
	"image_url" varchar(512),
	"color_name" varchar(255),
	"color_hex" varchar(9),
	"color_r" integer,
	"color_g" integer,
	"color_b" integer,
	"color_a" integer,
	"color_lab_l" real,
	"color_lab_a" real,
	"color_lab_b" real,
	"closest_pantone" varchar(50),
	"closest_ral" varchar(50),
	"closest_pms" varchar(50),
	"color_parent" varchar(50),
	"multi_color_hexes" text[],
	"multi_color_direction" "multi_color_direction",
	"finish" "finish_type",
	"translucent" boolean,
	"glow" boolean,
	"pattern" "pattern_type",
	"transmission_distance" real,
	"td_vote_count" integer,
	"diameter" real DEFAULT 1.75,
	"net_weight_g" real,
	"actual_net_weight_g" real,
	"filament_length_m" integer,
	"actual_filament_length_m" integer,
	"min_nozzle_diameter" real,
	"spool_weight_g" real,
	"spool_outer_diameter_mm" integer,
	"spool_width_mm" integer,
	"spool_inner_diameter_mm" integer,
	"spool_hole_diameter_mm" integer,
	"spool_material_type" "spool_material_type",
	"nozzle_temp_min" integer,
	"nozzle_temp_max" integer,
	"bed_temp_min" integer,
	"bed_temp_max" integer,
	"bed_temp_type" "bed_temp_type",
	"chamber_temp_min" integer,
	"chamber_temp_max" integer,
	"chamber_temp" integer,
	"preheat_temp" integer,
	"drying_temp" integer,
	"drying_time_min" integer,
	"default_flow_ratio" real,
	"default_pressure_advance" real,
	"fan_speed_min" integer,
	"min_volumetric_speed" real,
	"max_volumetric_speed" real,
	"target_volumetric_speed" real,
	"bambu_material_id" varchar(50),
	"bambu_variant_id" varchar(50),
	"bambu_filament_type" varchar(50),
	"bambu_detailed_type" varchar(100),
	"bambu_xcam_info" jsonb,
	"bambu_nozzle_diameter" real,
	"country_of_origin" varchar(2),
	"certifications" text[],
	"gtin" bigint,
	"external_spoolman_db_id" varchar(100),
	"external_3dfp_short_code" varchar(100),
	"external_filament_colors_slug" varchar(255),
	"website_url" varchar(512),
	"amazon_asin" varchar(20),
	"validation_status" "validation_status" DEFAULT 'draft' NOT NULL,
	"submitted_by_user_id" uuid,
	"discontinued" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"abbreviation" varchar(7),
	"category" varchar(50),
	"iso_classification" varchar(100),
	"material_class" "material_class",
	"density" real,
	"default_nozzle_temp_min" integer,
	"default_nozzle_temp_max" integer,
	"default_bed_temp_min" integer,
	"default_bed_temp_max" integer,
	"default_chamber_temp" integer,
	"default_preheat_temp" integer,
	"default_drying_temp" integer,
	"default_drying_time_min" integer,
	"hygroscopic" boolean,
	"fill_type" "fill_type",
	"fill_percentage" real,
	"fiber_length_mm" real,
	"shore_hardness_a" integer,
	"shore_hardness_d" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nfc_tag_patterns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"tag_format" "nfc_tag_format" NOT NULL,
	"bambu_variant_id" varchar(50),
	"bambu_material_id" varchar(50),
	"tiger_tag_product_id" integer,
	"tiger_tag_material_id" integer,
	"tiger_tag_brand_id" integer,
	"opt_package_uuid" uuid,
	"opt_material_uuid" uuid,
	"opt_brand_uuid" uuid,
	"pattern_field" varchar(100),
	"pattern_value" varchar(255),
	"validation_status" "validation_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sku_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid NOT NULL,
	"sku" varchar(100),
	"barcode" varchar(100),
	"barcode_format" varchar(20),
	"gtin" bigint,
	"pack_quantity" integer DEFAULT 1,
	"retailer" varchar(255),
	"product_url" varchar(512),
	"price_amount" real,
	"price_currency" varchar(3),
	"validation_status" "validation_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filament_id" uuid NOT NULL,
	"name" varchar(255),
	"oem_supplier" varchar(255),
	"batch_code" varchar(100),
	"nozzle_temp_min" integer,
	"nozzle_temp_max" integer,
	"bed_temp" integer,
	"net_weight_g" real,
	"spool_weight_g" real,
	"density" real,
	"notes" text,
	"validation_status" "validation_status" DEFAULT 'draft' NOT NULL,
	"submitted_by_user_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "catalog_submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "submission_type" NOT NULL,
	"status" "submission_status" DEFAULT 'pending' NOT NULL,
	"target_table" varchar(100),
	"target_id" uuid,
	"payload" jsonb NOT NULL,
	"original_payload" jsonb,
	"reviewer_id" uuid,
	"review_notes" text,
	"reviewed_at" timestamp with time zone,
	"source_nfc_uid" varchar(50),
	"source_spool_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "equipment" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "equipment_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"manufacturer" varchar(255),
	"model" varchar(255),
	"capacity" integer,
	"max_temp" integer,
	"has_humidity_control" boolean,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "label_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"label_format" "label_format" NOT NULL,
	"width_mm" integer,
	"height_mm" integer,
	"show_brand" boolean DEFAULT true,
	"show_material" boolean DEFAULT true,
	"show_color" boolean DEFAULT true,
	"show_color_swatch" boolean DEFAULT true,
	"show_temps" boolean DEFAULT true,
	"show_qr_code" boolean DEFAULT true,
	"show_weight" boolean DEFAULT true,
	"show_location" boolean DEFAULT false,
	"show_price" boolean DEFAULT false,
	"show_purchase_date" boolean DEFAULT false,
	"show_lot_number" boolean DEFAULT false,
	"qr_code_base_url" varchar(512) DEFAULT 'app.fillaiq.com/spool/',
	"custom_css" text,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"manufacturer" varchar(255),
	"model" varchar(255),
	"firmware_version" varchar(50),
	"serial_number" varchar(255),
	"has_ams" boolean DEFAULT false,
	"ams_slot_count" integer,
	"ams_model" varchar(50),
	"nozzle_diameter_mm" real,
	"build_volume_x" integer,
	"build_volume_y" integer,
	"build_volume_z" integer,
	"ip_address" varchar(45),
	"mqtt_topic" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"variant_id" uuid,
	"filament_id" uuid,
	"nfc_uid" varchar(50),
	"nfc_tag_format" "nfc_tag_format",
	"bambu_tray_uid" varchar(50),
	"initial_weight_g" real,
	"current_weight_g" real,
	"net_filament_weight_g" real,
	"spool_weight_g" real,
	"percent_remaining" integer,
	"purchase_price" real,
	"purchase_currency" varchar(3),
	"rating" integer,
	"status" "spool_status" DEFAULT 'active' NOT NULL,
	"purchased_at" timestamp with time zone,
	"production_date" varchar(20),
	"opened_at" timestamp with time zone,
	"emptied_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"last_dried_at" timestamp with time zone,
	"drying_cycle_count" integer DEFAULT 0,
	"current_slot_id" uuid,
	"storage_location" varchar(255),
	"lot_number" varchar(100),
	"serial_number" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_print_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"variant_id" uuid,
	"filament_id" uuid,
	"printer_id" uuid,
	"name" varchar(255),
	"nozzle_temp" integer,
	"bed_temp" integer,
	"chamber_temp" integer,
	"print_speed" real,
	"flow_rate" real,
	"retraction_distance" real,
	"retraction_speed" real,
	"pressure_advance" real,
	"fan_speed" integer,
	"volumetric_speed" real,
	"settings" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"email" varchar(255) NOT NULL,
	"display_name" varchar(255),
	"avatar_url" varchar(512),
	"is_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shelf_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bridges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rack_id" uuid NOT NULL,
	"hardware_id" varchar(50) NOT NULL,
	"firmware_version" varchar(50),
	"ip_address" varchar(45),
	"hostname" varchar(255),
	"connection_type" "connection_type",
	"last_seen_at" timestamp with time zone,
	"is_online" boolean DEFAULT false,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "racks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"location" varchar(255),
	"shelf_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shelves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rack_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"hardware_id" varchar(50),
	"can_address" integer,
	"firmware_version" varchar(50),
	"bay_count" integer DEFAULT 8,
	"has_temp_humidity_sensor" boolean DEFAULT false,
	"last_seen_at" timestamp with time zone,
	"is_online" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_id" uuid NOT NULL,
	"state" "slot_state" DEFAULT 'empty' NOT NULL,
	"spool_id" uuid,
	"nfc_uid" varchar(50),
	"nfc_present" boolean DEFAULT false,
	"weight_raw_g" real,
	"weight_stable_g" real,
	"weight_is_stable" boolean DEFAULT false,
	"percent_remaining" integer,
	"temperature_c" real,
	"humidity_percent" real,
	"state_entered_at" timestamp with time zone,
	"last_report_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bay_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"hx711_channel" integer,
	"nfc_reader_index" integer,
	"display_index" integer,
	"led_index" integer,
	"phone_nfc_url" varchar(512),
	"calibration_factor" real,
	"last_calibrated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drying_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spool_id" uuid NOT NULL,
	"user_id" uuid,
	"equipment_id" uuid,
	"temperature_c" integer,
	"duration_minutes" integer,
	"weight_before_g" real,
	"weight_after_g" real,
	"moisture_lost_g" real,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "environmental_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shelf_id" uuid NOT NULL,
	"temperature_c" real,
	"humidity_percent" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "spool_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spool_id" uuid NOT NULL,
	"from_slot_id" uuid,
	"to_slot_id" uuid,
	"weight_at_move_g" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spool_id" uuid NOT NULL,
	"user_id" uuid,
	"printer_id" uuid,
	"removed_from_slot_id" uuid,
	"returned_to_slot_id" uuid,
	"weight_before_g" real,
	"weight_after_g" real,
	"filament_used_g" real,
	"filament_used_mm" real,
	"cost_amount" real,
	"removed_at" timestamp with time zone,
	"returned_at" timestamp with time zone,
	"print_job_id" varchar(255),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weight_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spool_id" uuid,
	"slot_id" uuid,
	"event_type" "weight_event_type" NOT NULL,
	"weight_g" real,
	"previous_weight_g" real,
	"delta_g" real,
	"percent_remaining" integer,
	"nfc_uid" varchar(50),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "filament_equivalences" ADD CONSTRAINT "filament_equivalences_equivalence_group_id_equivalence_groups_id_fk" FOREIGN KEY ("equivalence_group_id") REFERENCES "public"."equivalence_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filament_equivalences" ADD CONSTRAINT "filament_equivalences_filament_id_filaments_id_fk" FOREIGN KEY ("filament_id") REFERENCES "public"."filaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filaments" ADD CONSTRAINT "filaments_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "filaments" ADD CONSTRAINT "filaments_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nfc_tag_patterns" ADD CONSTRAINT "nfc_tag_patterns_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku_mappings" ADD CONSTRAINT "sku_mappings_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_filament_id_filaments_id_fk" FOREIGN KEY ("filament_id") REFERENCES "public"."filaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_submissions" ADD CONSTRAINT "catalog_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_submissions" ADD CONSTRAINT "catalog_submissions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_templates" ADD CONSTRAINT "label_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printers" ADD CONSTRAINT "printers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spools" ADD CONSTRAINT "spools_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spools" ADD CONSTRAINT "spools_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spools" ADD CONSTRAINT "spools_filament_id_filaments_id_fk" FOREIGN KEY ("filament_id") REFERENCES "public"."filaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_print_profiles" ADD CONSTRAINT "user_print_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_print_profiles" ADD CONSTRAINT "user_print_profiles_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_print_profiles" ADD CONSTRAINT "user_print_profiles_filament_id_filaments_id_fk" FOREIGN KEY ("filament_id") REFERENCES "public"."filaments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_print_profiles" ADD CONSTRAINT "user_print_profiles_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bays" ADD CONSTRAINT "bays_shelf_id_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "public"."shelves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bridges" ADD CONSTRAINT "bridges_rack_id_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."racks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "racks" ADD CONSTRAINT "racks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelves" ADD CONSTRAINT "shelves_rack_id_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."racks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_status" ADD CONSTRAINT "slot_status_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_bay_id_bays_id_fk" FOREIGN KEY ("bay_id") REFERENCES "public"."bays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drying_sessions" ADD CONSTRAINT "drying_sessions_spool_id_spools_id_fk" FOREIGN KEY ("spool_id") REFERENCES "public"."spools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drying_sessions" ADD CONSTRAINT "drying_sessions_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environmental_readings" ADD CONSTRAINT "environmental_readings_shelf_id_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "public"."shelves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spool_movements" ADD CONSTRAINT "spool_movements_spool_id_spools_id_fk" FOREIGN KEY ("spool_id") REFERENCES "public"."spools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spool_movements" ADD CONSTRAINT "spool_movements_from_slot_id_slots_id_fk" FOREIGN KEY ("from_slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "spool_movements" ADD CONSTRAINT "spool_movements_to_slot_id_slots_id_fk" FOREIGN KEY ("to_slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_spool_id_spools_id_fk" FOREIGN KEY ("spool_id") REFERENCES "public"."spools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_removed_from_slot_id_slots_id_fk" FOREIGN KEY ("removed_from_slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_returned_to_slot_id_slots_id_fk" FOREIGN KEY ("returned_to_slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_events" ADD CONSTRAINT "weight_events_spool_id_spools_id_fk" FOREIGN KEY ("spool_id") REFERENCES "public"."spools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_events" ADD CONSTRAINT "weight_events_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_idx" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "sku_mappings_sku_idx" ON "sku_mappings" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "bridges_hardware_id_idx" ON "bridges" USING btree ("hardware_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slot_status_slot_id_idx" ON "slot_status" USING btree ("slot_id");