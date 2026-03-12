CREATE TYPE "public"."scan_session_status" AS ENUM('active', 'resolved', 'abandoned');--> statement-breakpoint
CREATE TABLE "scan_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"station_id" uuid NOT NULL,
	"status" "scan_session_status" DEFAULT 'active' NOT NULL,
	"best_weight_g" real,
	"best_height_mm" real,
	"best_color_hex" varchar(7),
	"best_color_lab_l" real,
	"best_color_lab_a" real,
	"best_color_lab_b" real,
	"best_spectral_data" jsonb,
	"nfc_uid" varchar(50),
	"nfc_tag_format" "nfc_tag_format",
	"nfc_parsed_data" jsonb,
	"barcode_value" varchar(255),
	"barcode_format" varchar(50),
	"matched_product_id" uuid,
	"match_confidence" real,
	"match_method" varchar(50),
	"resolved_user_item_id" uuid,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scan_events" ADD COLUMN "session_id" uuid;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_station_id_scan_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."scan_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_sessions" ADD CONSTRAINT "scan_sessions_resolved_user_item_id_user_items_id_fk" FOREIGN KEY ("resolved_user_item_id") REFERENCES "public"."user_items"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scan_events" ADD CONSTRAINT "scan_events_session_id_scan_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."scan_sessions"("id") ON DELETE no action ON UPDATE no action;