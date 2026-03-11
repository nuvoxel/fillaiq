ALTER TABLE "environmental_readings" ALTER COLUMN "shelf_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "environmental_readings" ADD COLUMN "station_id" uuid;--> statement-breakpoint
ALTER TABLE "environmental_readings" ADD COLUMN "humidity" real;--> statement-breakpoint
ALTER TABLE "environmental_readings" ADD COLUMN "pressure_hpa" real;--> statement-breakpoint
ALTER TABLE "environmental_readings" ADD CONSTRAINT "environmental_readings_station_id_scan_stations_id_fk" FOREIGN KEY ("station_id") REFERENCES "public"."scan_stations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environmental_readings" DROP COLUMN "humidity_percent";
