ALTER TYPE "public"."package_type" ADD VALUE 'tool' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."package_type" ADD VALUE 'bolt' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."package_type" ADD VALUE 'nut' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."package_type" ADD VALUE 'screw' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."package_type" ADD VALUE 'electronic_component' BEFORE 'other';--> statement-breakpoint
ALTER TABLE "scan_stations" ADD COLUMN "mqtt_connected_at" timestamp with time zone;