ALTER TABLE "user_items" DROP COLUMN "measured_height_mm";--> statement-breakpoint
ALTER TABLE "scan_events" DROP COLUMN "height_mm";--> statement-breakpoint
ALTER TABLE "scan_events" DROP COLUMN "distance_mm";--> statement-breakpoint
ALTER TABLE "scan_sessions" DROP COLUMN "best_height_mm";--> statement-breakpoint
ALTER TABLE "scan_stations" DROP COLUMN "platform_height_mm";--> statement-breakpoint
ALTER TABLE "scan_stations" DROP COLUMN "has_tof_sensor";