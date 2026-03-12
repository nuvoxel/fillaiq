CREATE TYPE "public"."print_job_status" AS ENUM('pending', 'sent', 'printing', 'done', 'failed', 'cancelled');
--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"template_id" uuid,
	"station_id" uuid,
	"status" "print_job_status" DEFAULT 'pending' NOT NULL,
	"label_data" jsonb NOT NULL,
	"copies" integer DEFAULT 1 NOT NULL,
	"raster_data" text,
	"raster_width_px" integer,
	"raster_height_px" integer,
	"error_message" text,
	"printed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_template_id_label_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."label_templates"("id") ON DELETE no action ON UPDATE no action;
