CREATE TYPE "public"."hardware_category" AS ENUM('label_printer', 'scan_station', 'shelf_station', 'fdm_printer', 'resin_printer', 'cnc', 'laser_cutter', 'laser_engraver', 'drybox', 'filament_changer', 'enclosure', 'other');--> statement-breakpoint
CREATE TYPE "public"."hardware_identifier_type" AS ENUM('usb_vid_pid', 'ble_name_prefix', 'ble_service_uuid', 'mdns_service', 'mqtt_topic_prefix', 'serial_pattern');--> statement-breakpoint
CREATE TABLE "hardware_identifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hardware_model_id" uuid NOT NULL,
	"identifier_type" "hardware_identifier_type" NOT NULL,
	"value" varchar(255) NOT NULL,
	"priority" integer DEFAULT 0,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hardware_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"brand_id" uuid,
	"category" "hardware_category" NOT NULL,
	"manufacturer" varchar(255) NOT NULL,
	"model" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"image_url" varchar(512),
	"website_url" varchar(512),
	"print_width_mm" real,
	"print_height_max_mm" real,
	"print_dpi" integer,
	"dots_per_line" integer,
	"print_technology" varchar(50),
	"continuous_feed" boolean,
	"supported_label_widths" jsonb,
	"build_volume_x" integer,
	"build_volume_y" integer,
	"build_volume_z" integer,
	"max_nozzle_temp" integer,
	"max_bed_temp" integer,
	"has_enclosure" boolean,
	"has_filament_changer" boolean,
	"filament_changer_slots" integer,
	"has_usb" boolean DEFAULT false,
	"has_ble" boolean DEFAULT false,
	"has_wifi" boolean DEFAULT false,
	"has_ethernet" boolean DEFAULT false,
	"has_mqtt" boolean DEFAULT false,
	"protocol" varchar(100),
	"ble_service_uuid" varchar(50),
	"ble_write_char_uuid" varchar(50),
	"ble_notify_char_uuid" varchar(50),
	"capabilities" jsonb,
	"validation_status" "validation_status" DEFAULT 'draft' NOT NULL,
	"discontinued" boolean DEFAULT false,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hardware_identifiers" ADD CONSTRAINT "hardware_identifiers_hardware_model_id_hardware_models_id_fk" FOREIGN KEY ("hardware_model_id") REFERENCES "public"."hardware_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hardware_models" ADD CONSTRAINT "hardware_models_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_identifiers_type_value_idx" ON "hardware_identifiers" USING btree ("identifier_type","value");--> statement-breakpoint
CREATE UNIQUE INDEX "hardware_models_slug_idx" ON "hardware_models" USING btree ("slug");