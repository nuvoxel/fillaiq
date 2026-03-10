CREATE TYPE "public"."accessory_type" AS ENUM('smoke_extractor', 'enclosure', 'camera', 'light', 'exhaust_fan', 'filament_buffer', 'purge_tray', 'dust_collector', 'air_assist', 'rotary_module', 'other');--> statement-breakpoint
CREATE TYPE "public"."alias_type" AS ENUM('oem_rebrand', 'sku_variant', 'substitute', 'color_match');--> statement-breakpoint
CREATE TYPE "public"."audit_action" AS ENUM('create', 'update', 'delete', 'review', 'login', 'logout');--> statement-breakpoint
CREATE TYPE "public"."audit_actor_type" AS ENUM('session', 'api_key', 'system');--> statement-breakpoint
CREATE TYPE "public"."changer_type" AS ENUM('ams', 'ams_lite', 'mmu', 'manual');--> statement-breakpoint
CREATE TYPE "public"."connection_type" AS ENUM('wifi', 'ethernet');--> statement-breakpoint
CREATE TYPE "public"."equipment_type" AS ENUM('drybox', 'enclosure', 'storage_bin', 'other');--> statement-breakpoint
CREATE TYPE "public"."fill_type" AS ENUM('none', 'carbon_fiber', 'glass_fiber', 'wood', 'ceramic', 'kevlar', 'metal', 'glow');--> statement-breakpoint
CREATE TYPE "public"."finish_type" AS ENUM('matte', 'glossy', 'satin', 'silk');--> statement-breakpoint
CREATE TYPE "public"."item_status" AS ENUM('active', 'empty', 'archived');--> statement-breakpoint
CREATE TYPE "public"."label_format" AS ENUM('labelife_image', 'labelife_native', 'png', 'pdf');--> statement-breakpoint
CREATE TYPE "public"."machine_type" AS ENUM('fdm', 'cnc', 'laser', 'resin', 'multi');--> statement-breakpoint
CREATE TYPE "public"."material_class" AS ENUM('fff', 'sla', 'cnc', 'laser');--> statement-breakpoint
CREATE TYPE "public"."multi_color_direction" AS ENUM('coaxial', 'longitudinal');--> statement-breakpoint
CREATE TYPE "public"."nfc_tag_format" AS ENUM('bambu_mifare', 'creality', 'open_print_tag', 'open_spool', 'open_tag_3d', 'tiger_tag', 'ntag', 'filla_iq', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."nozzle_material" AS ENUM('brass', 'hardened_steel', 'stainless_steel', 'copper_alloy', 'ruby');--> statement-breakpoint
CREATE TYPE "public"."nozzle_type" AS ENUM('standard', 'high_flow', 'chc', 'revo');--> statement-breakpoint
CREATE TYPE "public"."package_style" AS ENUM('none', 'shrink_wrap', 'bag', 'vacuum_bag', 'sleeve', 'box', 'box_with_bag', 'other');--> statement-breakpoint
CREATE TYPE "public"."pattern_type" AS ENUM('solid', 'marble', 'sparkle', 'galaxy', 'wood_grain', 'gradient');--> statement-breakpoint
CREATE TYPE "public"."product_category" AS ENUM('filament', 'resin', 'cnc_stock', 'laser_stock', 'consumable', 'other');--> statement-breakpoint
CREATE TYPE "public"."slot_state" AS ENUM('empty', 'detecting', 'active', 'unknown_spool', 'removed', 'error');--> statement-breakpoint
CREATE TYPE "public"."spool_material_type" AS ENUM('plastic', 'cardboard', 'metal', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."submission_status" AS ENUM('pending', 'approved', 'rejected', 'duplicate');--> statement-breakpoint
CREATE TYPE "public"."submission_type" AS ENUM('new_filament', 'new_variant', 'correction', 'equivalence');--> statement-breakpoint
CREATE TYPE "public"."tool_category" AS ENUM('nozzle', 'spindle_bit', 'laser_module');--> statement-breakpoint
CREATE TYPE "public"."validation_status" AS ENUM('draft', 'submitted', 'validated', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."wear_level" AS ENUM('new', 'good', 'worn', 'replace');--> statement-breakpoint
CREATE TYPE "public"."weight_event_type" AS ENUM('placed', 'removed', 'reading', 'usage', 'drying');--> statement-breakpoint
CREATE TYPE "public"."work_surface_type" AS ENUM('cool_plate', 'textured_pei', 'engineering_plate', 'high_temp_plate', 'wasteboard', 'aluminum_bed', 'vacuum_table', 'honeycomb_bed', 'knife_blade_bed', 'material_pass_through');--> statement-breakpoint
CREATE TYPE "public"."zone_type" AS ENUM('workshop', 'storage', 'printer_area', 'drying', 'other');--> statement-breakpoint
CREATE TABLE "brands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"website" varchar(512),
	"logo_url" varchar(512),
	"country_of_origin" varchar(2),
	"parent_brand_id" uuid,
	"validation_status" "validation_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "filament_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"diameter" real DEFAULT 1.75,
	"measured_diameter" real,
	"diameter_tolerance" real,
	"filament_length_m" integer,
	"actual_filament_length_m" integer,
	"min_nozzle_diameter" real,
	"spool_outer_diameter_mm" real,
	"spool_inner_diameter_mm" real,
	"spool_width_mm" real,
	"spool_hub_hole_diameter_mm" real,
	"spool_rim_depth_mm" real,
	"spool_material_type" "spool_material_type",
	"spool_color" varchar(50),
	"spool_weight_g" real,
	"spool_has_cardboard_insert" boolean,
	"winding_width_mm" real,
	"winding_diameter_mm" real,
	"nozzle_temp_min" integer,
	"nozzle_temp_max" integer,
	"bed_temp_min" integer,
	"bed_temp_max" integer,
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
	"transmission_distance" real,
	"td_vote_count" integer,
	"vendor_metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "filament_profiles_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"abbreviation" varchar(20),
	"category" varchar(50),
	"iso_classification" varchar(100),
	"material_class" "material_class",
	"density" real,
	"hygroscopic" boolean,
	"default_drying_temp" integer,
	"default_drying_time_min" integer,
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
	"product_id" uuid NOT NULL,
	"tag_format" "nfc_tag_format" NOT NULL,
	"bambu_variant_id" varchar(50),
	"bambu_material_id" varchar(50),
	"tiger_tag_product_id" integer,
	"tiger_tag_material_id" integer,
	"tiger_tag_brand_id" integer,
	"opt_package_uuid" uuid,
	"opt_material_uuid" uuid,
	"opt_brand_uuid" uuid,
	"open_spool_vendor" varchar(255),
	"open_spool_type" varchar(255),
	"open_spool_color" varchar(100),
	"pattern_field" varchar(100),
	"pattern_value" varchar(255),
	"validation_status" "validation_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_aliases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"related_product_id" uuid NOT NULL,
	"alias_type" "alias_type" NOT NULL,
	"confidence" real DEFAULT 1,
	"bidirectional" boolean DEFAULT true,
	"source" varchar(50),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"material_id" uuid,
	"category" "product_category" DEFAULT 'filament' NOT NULL,
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
	"net_weight_g" real,
	"actual_net_weight_g" real,
	"package_weight_g" real,
	"package_style" "package_style",
	"package_barcode" varchar(100),
	"package_barcode_format" varchar(20),
	"country_of_origin" varchar(2),
	"certifications" text[],
	"gtin" varchar(14),
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
CREATE TABLE "sku_mappings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"sku" varchar(100),
	"barcode" varchar(100),
	"barcode_format" varchar(20),
	"gtin" varchar(14),
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
	"qr_code_base_url" varchar(512) DEFAULT 'app.fillaiq.com/item/',
	"custom_css" text,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
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
	"user_item_id" uuid,
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
CREATE TABLE "user_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid,
	"nfc_uid" varchar(50),
	"nfc_tag_format" "nfc_tag_format",
	"nfc_tag_written" boolean DEFAULT false,
	"bambu_tray_uid" varchar(50),
	"initial_weight_g" real,
	"current_weight_g" real,
	"net_filament_weight_g" real,
	"spool_weight_g" real,
	"percent_remaining" integer,
	"measured_spool_outer_diameter_mm" real,
	"measured_spool_inner_diameter_mm" real,
	"measured_spool_width_mm" real,
	"measured_spool_hub_hole_diameter_mm" real,
	"measured_spool_weight_g" real,
	"measured_height_mm" real,
	"measured_color_hex" varchar(9),
	"measured_color_lab_l" real,
	"measured_color_lab_a" real,
	"measured_color_lab_b" real,
	"measured_spectral_data" jsonb,
	"purchase_price" real,
	"purchase_currency" varchar(3),
	"rating" integer,
	"status" "item_status" DEFAULT 'active' NOT NULL,
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
	"barcode_value" varchar(255),
	"barcode_format" varchar(50),
	"intake_scan_event_id" uuid,
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
CREATE TABLE "user_print_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"product_id" uuid,
	"filament_profile_id" uuid,
	"machine_id" uuid,
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
	"email" varchar(255) NOT NULL,
	"name" varchar(255),
	"image" varchar(512),
	"email_verified" boolean DEFAULT false NOT NULL,
	"username" varchar(255),
	"role" varchar(50) DEFAULT 'user',
	"banned" boolean DEFAULT false,
	"ban_reason" text,
	"ban_expires" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apikeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"start" text,
	"prefix" text,
	"key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"refill_interval" integer,
	"refill_amount" integer,
	"last_refill_at" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"rate_limit_enabled" boolean DEFAULT false NOT NULL,
	"rate_limit_time_window" integer,
	"rate_limit_max" integer,
	"request_count" integer DEFAULT 0 NOT NULL,
	"remaining" integer,
	"last_request" timestamp with time zone,
	"expires_at" timestamp with time zone,
	"permissions" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'member',
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"inviter_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"role" varchar(50) DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"logo" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" varchar(45),
	"user_agent" text,
	"active_organization_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bay_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bay_id" uuid NOT NULL,
	"hardware_id" varchar(50) NOT NULL,
	"firmware_version" varchar(50),
	"ip_address" varchar(45),
	"hx711_channels" integer,
	"nfc_reader_count" integer,
	"display_count" integer,
	"led_count" integer,
	"calibration_factors" jsonb,
	"last_calibrated_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone,
	"is_online" boolean DEFAULT false,
	"config" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shelf_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" varchar(50),
	"slot_count" integer,
	"nfc_tag_id" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "racks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"zone_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"position" integer,
	"shelf_count" integer,
	"nfc_tag_id" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shelves" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rack_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"label" varchar(50),
	"bay_count" integer,
	"nfc_tag_id" varchar(50),
	"has_temp_humidity_sensor" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "slot_status" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slot_id" uuid NOT NULL,
	"state" "slot_state" DEFAULT 'empty' NOT NULL,
	"user_item_id" uuid,
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
	"label" varchar(50),
	"nfc_tag_id" varchar(50),
	"address" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "zones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "zone_type" DEFAULT 'workshop',
	"description" text,
	"nfc_tag_id" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "drying_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_item_id" uuid NOT NULL,
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
CREATE TABLE "item_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_item_id" uuid NOT NULL,
	"from_slot_id" uuid,
	"to_slot_id" uuid,
	"weight_at_move_g" real,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usage_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_item_id" uuid NOT NULL,
	"user_id" uuid,
	"machine_id" uuid,
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
	"user_item_id" uuid,
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
	"nfc_atqa" varchar(10),
	"nfc_sak" integer,
	"nfc_tag_format" "nfc_tag_format",
	"nfc_raw_data" text,
	"nfc_sectors_read" integer,
	"nfc_pages_read" integer,
	"nfc_parsed_data" jsonb,
	"photo_url" varchar(1024),
	"barcode_value" varchar(255),
	"barcode_format" varchar(50),
	"turntable_angle" real,
	"identified" boolean DEFAULT false,
	"confidence" real,
	"identified_type" varchar(50),
	"identified_product_id" uuid,
	"identified_user_item_id" uuid,
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
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid NOT NULL,
	"actor_type" "audit_actor_type" NOT NULL,
	"action" "audit_action" NOT NULL,
	"resource_type" varchar(50) NOT NULL,
	"resource_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "filament_profiles" ADD CONSTRAINT "filament_profiles_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nfc_tag_patterns" ADD CONSTRAINT "nfc_tag_patterns_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_aliases" ADD CONSTRAINT "product_aliases_related_product_id_products_id_fk" FOREIGN KEY ("related_product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_material_id_materials_id_fk" FOREIGN KEY ("material_id") REFERENCES "public"."materials"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sku_mappings" ADD CONSTRAINT "sku_mappings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_submissions" ADD CONSTRAINT "catalog_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_submissions" ADD CONSTRAINT "catalog_submissions_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "label_templates" ADD CONSTRAINT "label_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_accessories" ADD CONSTRAINT "machine_accessories_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_material_slots" ADD CONSTRAINT "machine_material_slots_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_material_slots" ADD CONSTRAINT "machine_material_slots_user_item_id_user_items_id_fk" FOREIGN KEY ("user_item_id") REFERENCES "public"."user_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_tool_heads" ADD CONSTRAINT "machine_tool_heads_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machine_work_surfaces" ADD CONSTRAINT "machine_work_surfaces_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "machines" ADD CONSTRAINT "machines_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_items" ADD CONSTRAINT "user_items_current_slot_id_slots_id_fk" FOREIGN KEY ("current_slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_print_profiles" ADD CONSTRAINT "user_print_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_print_profiles" ADD CONSTRAINT "user_print_profiles_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_print_profiles" ADD CONSTRAINT "user_print_profiles_filament_profile_id_filament_profiles_id_fk" FOREIGN KEY ("filament_profile_id") REFERENCES "public"."filament_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_print_profiles" ADD CONSTRAINT "user_print_profiles_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apikeys" ADD CONSTRAINT "apikeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bay_modules" ADD CONSTRAINT "bay_modules_bay_id_bays_id_fk" FOREIGN KEY ("bay_id") REFERENCES "public"."bays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bays" ADD CONSTRAINT "bays_shelf_id_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "public"."shelves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "racks" ADD CONSTRAINT "racks_zone_id_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shelves" ADD CONSTRAINT "shelves_rack_id_racks_id_fk" FOREIGN KEY ("rack_id") REFERENCES "public"."racks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slot_status" ADD CONSTRAINT "slot_status_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "slots" ADD CONSTRAINT "slots_bay_id_bays_id_fk" FOREIGN KEY ("bay_id") REFERENCES "public"."bays"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "zones" ADD CONSTRAINT "zones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drying_sessions" ADD CONSTRAINT "drying_sessions_user_item_id_user_items_id_fk" FOREIGN KEY ("user_item_id") REFERENCES "public"."user_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drying_sessions" ADD CONSTRAINT "drying_sessions_equipment_id_equipment_id_fk" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environmental_readings" ADD CONSTRAINT "environmental_readings_shelf_id_shelves_id_fk" FOREIGN KEY ("shelf_id") REFERENCES "public"."shelves"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_movements" ADD CONSTRAINT "item_movements_user_item_id_user_items_id_fk" FOREIGN KEY ("user_item_id") REFERENCES "public"."user_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_movements" ADD CONSTRAINT "item_movements_from_slot_id_slots_id_fk" FOREIGN KEY ("from_slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "item_movements" ADD CONSTRAINT "item_movements_to_slot_id_slots_id_fk" FOREIGN KEY ("to_slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_user_item_id_user_items_id_fk" FOREIGN KEY ("user_item_id") REFERENCES "public"."user_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_machine_id_machines_id_fk" FOREIGN KEY ("machine_id") REFERENCES "public"."machines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_removed_from_slot_id_slots_id_fk" FOREIGN KEY ("removed_from_slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_sessions" ADD CONSTRAINT "usage_sessions_returned_to_slot_id_slots_id_fk" FOREIGN KEY ("returned_to_slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_events" ADD CONSTRAINT "weight_events_user_item_id_user_items_id_fk" FOREIGN KEY ("user_item_id") REFERENCES "public"."user_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weight_events" ADD CONSTRAINT "weight_events_slot_id_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_last_scan_event_id_scan_events_id_fk" FOREIGN KEY ("last_scan_event_id") REFERENCES "public"."scan_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_station_id_scan_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."scan_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_identified_user_item_id_user_items_id_fk" FOREIGN KEY ("identified_user_item_id") REFERENCES "public"."user_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_stations" ADD CONSTRAINT "scan_stations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "brands_slug_idx" ON "brands" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "products_gtin_idx" ON "products" USING btree ("gtin");--> statement-breakpoint
CREATE UNIQUE INDEX "sku_mappings_sku_idx" ON "sku_mappings" USING btree ("sku");--> statement-breakpoint
CREATE UNIQUE INDEX "user_preferences_user_id_idx" ON "user_preferences" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_username_idx" ON "users" USING btree ("username");--> statement-breakpoint
CREATE UNIQUE INDEX "organizations_slug_idx" ON "organizations" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "bay_modules_hardware_id_idx" ON "bay_modules" USING btree ("hardware_id");--> statement-breakpoint
CREATE UNIQUE INDEX "slot_status_slot_id_idx" ON "slot_status" USING btree ("slot_id");--> statement-breakpoint
CREATE UNIQUE INDEX "scan_stations_hardware_id_idx" ON "scan_stations" USING btree ("hardware_id");--> statement-breakpoint
CREATE INDEX "audit_logs_actor_id_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "audit_logs_resource_idx" ON "audit_logs" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs" USING btree ("created_at");