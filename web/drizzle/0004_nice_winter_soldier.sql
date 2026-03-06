CREATE TYPE "public"."accessory_type" AS ENUM('smoke_extractor', 'enclosure', 'camera', 'light', 'exhaust_fan', 'filament_buffer', 'purge_tray', 'other');--> statement-breakpoint
CREATE TYPE "public"."nozzle_material" AS ENUM('brass', 'hardened_steel', 'stainless_steel', 'copper_alloy', 'ruby');--> statement-breakpoint
CREATE TYPE "public"."nozzle_type" AS ENUM('standard', 'high_flow', 'chc', 'revo');--> statement-breakpoint
CREATE TYPE "public"."wear_level" AS ENUM('new', 'good', 'worn', 'replace');--> statement-breakpoint
CREATE TABLE "printer_accessories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"printer_id" uuid NOT NULL,
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
CREATE TABLE "printer_ams_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"printer_id" uuid NOT NULL,
	"ams_unit" integer NOT NULL,
	"slot_position" integer NOT NULL,
	"spool_id" uuid,
	"loaded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printer_build_plates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"printer_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"type" "bed_temp_type" NOT NULL,
	"is_installed" boolean DEFAULT false NOT NULL,
	"surface_condition" "wear_level" DEFAULT 'new' NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printer_nozzles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"printer_id" uuid NOT NULL,
	"diameter_mm" real NOT NULL,
	"material" "nozzle_material" NOT NULL,
	"type" "nozzle_type" NOT NULL,
	"is_installed" boolean DEFAULT false NOT NULL,
	"wear_level" "wear_level" DEFAULT 'new' NOT NULL,
	"install_count" integer DEFAULT 0 NOT NULL,
	"last_installed_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "verifications" ALTER COLUMN "id" SET DATA TYPE uuid;--> statement-breakpoint
ALTER TABLE "verifications" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();--> statement-breakpoint
ALTER TABLE "printers" ADD COLUMN "tool_head_type" varchar(50);--> statement-breakpoint
ALTER TABLE "printers" ADD COLUMN "nozzle_swap_system" varchar(50);--> statement-breakpoint
ALTER TABLE "printers" ADD COLUMN "ams_unit_count" integer;--> statement-breakpoint
ALTER TABLE "printers" ADD COLUMN "enclosure_type" varchar(50);--> statement-breakpoint
ALTER TABLE "printer_accessories" ADD CONSTRAINT "printer_accessories_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_ams_slots" ADD CONSTRAINT "printer_ams_slots_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_ams_slots" ADD CONSTRAINT "printer_ams_slots_spool_id_spools_id_fk" FOREIGN KEY ("spool_id") REFERENCES "public"."spools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_build_plates" ADD CONSTRAINT "printer_build_plates_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printer_nozzles" ADD CONSTRAINT "printer_nozzles_printer_id_printers_id_fk" FOREIGN KEY ("printer_id") REFERENCES "public"."printers"("id") ON DELETE no action ON UPDATE no action;