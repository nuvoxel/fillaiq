ALTER TABLE "scan_stations" ALTER COLUMN "user_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "scan_stations" ADD COLUMN "device_token" varchar(128);--> statement-breakpoint
ALTER TABLE "scan_stations" ADD COLUMN "pairing_code" varchar(10);--> statement-breakpoint
ALTER TABLE "scan_stations" ADD COLUMN "pairing_expires_at" timestamp with time zone;