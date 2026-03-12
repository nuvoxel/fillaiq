CREATE TYPE "public"."package_type" AS ENUM('spool', 'box', 'bottle', 'bag', 'cartridge', 'other');--> statement-breakpoint
ALTER TABLE "user_items" ADD COLUMN "package_type" "package_type";