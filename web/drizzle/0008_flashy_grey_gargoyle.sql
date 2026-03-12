ALTER TABLE "scan_stations" ADD COLUMN "device_secret" varchar(128);--> statement-breakpoint
ALTER TABLE "scan_stations" ADD COLUMN "efuse_id" varchar(24);