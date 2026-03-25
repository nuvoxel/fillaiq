CREATE TYPE "public"."machine_protocol" AS ENUM('bambu', 'klipper', 'octoprint', 'prusalink', 'grbl', 'manual');--> statement-breakpoint
CREATE TABLE "product_price_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reseller_link_id" uuid NOT NULL,
	"price" real NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"in_stock" boolean,
	"checked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_price_tiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reseller_link_id" uuid NOT NULL,
	"min_quantity" integer DEFAULT 1 NOT NULL,
	"price" real NOT NULL,
	"currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"discount_label" varchar(100),
	"discount_code" varchar(50),
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_reseller_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"reseller" varchar(50) NOT NULL,
	"url" varchar(1024) NOT NULL,
	"affiliate_url" varchar(1024),
	"price" real,
	"list_price" real,
	"sale_price" real,
	"currency" varchar(3) DEFAULT 'USD',
	"in_stock" boolean,
	"coupon_code" varchar(50),
	"coupon_discount_pct" real,
	"coupon_expires_at" timestamp with time zone,
	"last_checked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passkeys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text,
	"public_key" text NOT NULL,
	"user_id" uuid NOT NULL,
	"credential_id" text NOT NULL,
	"counter" integer DEFAULT 0 NOT NULL,
	"device_type" text,
	"backed_up" boolean DEFAULT false NOT NULL,
	"transports" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "passkeys_credential_id_unique" UNIQUE("credential_id")
);
--> statement-breakpoint
ALTER TABLE "brands" ADD COLUMN "logo_bw_url" varchar(512);--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "protocol" "machine_protocol" DEFAULT 'manual';--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "scan_station_id" uuid;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "connection_config" jsonb;--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "access_code" varchar(64);--> statement-breakpoint
ALTER TABLE "machines" ADD COLUMN "live_status" jsonb;--> statement-breakpoint
ALTER TABLE "product_price_history" ADD CONSTRAINT "product_price_history_reseller_link_id_product_reseller_links_id_fk" FOREIGN KEY ("reseller_link_id") REFERENCES "public"."product_reseller_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_price_tiers" ADD CONSTRAINT "product_price_tiers_reseller_link_id_product_reseller_links_id_fk" FOREIGN KEY ("reseller_link_id") REFERENCES "public"."product_reseller_links"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reseller_links" ADD CONSTRAINT "product_reseller_links_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passkeys" ADD CONSTRAINT "passkeys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;