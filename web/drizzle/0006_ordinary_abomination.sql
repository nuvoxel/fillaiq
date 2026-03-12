CREATE TABLE "user_printers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"hardware_model_id" uuid,
	"name" varchar(255) NOT NULL,
	"serial_number" varchar(255),
	"firmware_version" varchar(50),
	"ble_address" varchar(20),
	"ble_name" varchar(100),
	"usb_vid" varchar(6),
	"usb_pid" varchar(6),
	"usb_manufacturer" varchar(255),
	"usb_product" varchar(255),
	"usb_serial" varchar(255),
	"battery_percent" integer,
	"paper_loaded" boolean,
	"cover_closed" boolean,
	"last_seen_at" timestamp with time zone,
	"last_connected_via" varchar(10),
	"scan_station_id" uuid,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_printers" ADD CONSTRAINT "user_printers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_printers" ADD CONSTRAINT "user_printers_hardware_model_id_hardware_models_id_fk" FOREIGN KEY ("hardware_model_id") REFERENCES "public"."hardware_models"("id") ON DELETE no action ON UPDATE no action;