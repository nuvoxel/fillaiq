import { pgEnum } from "drizzle-orm/pg-core";

// ── Catalog ──────────────────────────────────────────────────────────────────

export const validationStatusEnum = pgEnum("validation_status", [
  "draft",
  "submitted",
  "validated",
  "deprecated",
]);

export const productCategoryEnum = pgEnum("product_category", [
  "filament",
  "resin",
  "cnc_stock",
  "laser_stock",
  "consumable",
  "other",
]);

export const materialClassEnum = pgEnum("material_class", [
  "fff",
  "sla",
  "cnc",
  "laser",
]);

export const finishTypeEnum = pgEnum("finish_type", [
  "matte",
  "glossy",
  "satin",
  "silk",
]);

export const patternTypeEnum = pgEnum("pattern_type", [
  "solid",
  "marble",
  "sparkle",
  "galaxy",
  "wood_grain",
  "gradient",
]);

export const fillTypeEnum = pgEnum("fill_type", [
  "none",
  "carbon_fiber",
  "glass_fiber",
  "wood",
  "ceramic",
  "kevlar",
  "metal",
  "glow",
]);

export const multiColorDirectionEnum = pgEnum("multi_color_direction", [
  "coaxial",
  "longitudinal",
]);

export const spoolMaterialTypeEnum = pgEnum("spool_material_type", [
  "plastic",
  "cardboard",
  "metal",
  "unknown",
]);

export const packageStyleEnum = pgEnum("package_style", [
  "none",
  "shrink_wrap",
  "bag",
  "vacuum_bag",
  "sleeve",
  "box",
  "box_with_bag",
  "other",
]);

export const aliasTypeEnum = pgEnum("alias_type", [
  "oem_rebrand",
  "sku_variant",
  "substitute",
  "color_match",
]);

// ── NFC ──────────────────────────────────────────────────────────────────────

export const nfcTagFormatEnum = pgEnum("nfc_tag_format", [
  "bambu_mifare",
  "creality",
  "open_print_tag",
  "open_spool",
  "open_tag_3d",
  "tiger_tag",
  "ntag",
  "filla_iq",
  "unknown",
]);

// ── Scan Sessions ────────────────────────────────────────────────────────────

export const scanSessionStatusEnum = pgEnum("scan_session_status", [
  "active",
  "resolved",
  "abandoned",
]);

// ── User Items ───────────────────────────────────────────────────────────────

export const packageTypeEnum = pgEnum("package_type", [
  "spool",
  "box",
  "bottle",
  "bag",
  "cartridge",
  "tool",
  "bolt",
  "nut",
  "screw",
  "electronic_component",
  "other",
]);

export const itemStatusEnum = pgEnum("item_status", [
  "active",
  "empty",
  "archived",
]);

// ── Storage ──────────────────────────────────────────────────────────────────

export const zoneTypeEnum = pgEnum("zone_type", [
  "workshop",
  "storage",
  "printer_area",
  "drying",
  "other",
]);

export const slotStateEnum = pgEnum("slot_state", [
  "empty",
  "detecting",
  "active",
  "unknown_spool",
  "removed",
  "error",
]);

// ── Events ───────────────────────────────────────────────────────────────────

export const weightEventTypeEnum = pgEnum("weight_event_type", [
  "placed",
  "removed",
  "reading",
  "usage",
  "drying",
]);

// ── Equipment ────────────────────────────────────────────────────────────────

export const equipmentTypeEnum = pgEnum("equipment_type", [
  "drybox",
  "enclosure",
  "storage_bin",
  "other",
]);

// ── Labels ───────────────────────────────────────────────────────────────────

export const labelFormatEnum = pgEnum("label_format", [
  "labelife_image",
  "labelife_native",
  "png",
  "pdf",
]);

export const printJobStatusEnum = pgEnum("print_job_status", [
  "pending",
  "sent",
  "printing",
  "done",
  "failed",
  "cancelled",
]);

// ── Hardware Catalog ─────────────────────────────────────────────────────────

export const hardwareCategoryEnum = pgEnum("hardware_category", [
  "label_printer",
  "scan_station",
  "shelf_station",
  "fdm_printer",
  "resin_printer",
  "cnc",
  "laser_cutter",
  "laser_engraver",
  "drybox",
  "filament_changer",
  "enclosure",
  "other",
]);

export const hardwareIdentifierTypeEnum = pgEnum("hardware_identifier_type", [
  "usb_vid_pid",
  "ble_name_prefix",
  "ble_service_uuid",
  "mdns_service",
  "mqtt_topic_prefix",
  "serial_pattern",
]);

// ── Machine Protocols ────────────────────────────────────────────────────────

export const machineProtocolEnum = pgEnum("machine_protocol", [
  "bambu",
  "klipper",
  "octoprint",
  "prusalink",
  "grbl",
  "manual",
]);

// ── Machines ─────────────────────────────────────────────────────────────────

export const machineTypeEnum = pgEnum("machine_type", [
  "fdm",
  "cnc",
  "laser",
  "resin",
  "multi",
]);

export const changerTypeEnum = pgEnum("changer_type", [
  "ams",
  "ams_lite",
  "mmu",
  "manual",
]);

export const toolCategoryEnum = pgEnum("tool_category", [
  "nozzle",
  "spindle_bit",
  "laser_module",
]);

export const nozzleMaterialEnum = pgEnum("nozzle_material", [
  "brass",
  "hardened_steel",
  "stainless_steel",
  "copper_alloy",
  "ruby",
]);

export const nozzleTypeEnum = pgEnum("nozzle_type", [
  "standard",
  "high_flow",
  "chc",
  "revo",
]);

export const wearLevelEnum = pgEnum("wear_level", [
  "new",
  "good",
  "worn",
  "replace",
]);

export const accessoryTypeEnum = pgEnum("accessory_type", [
  "smoke_extractor",
  "enclosure",
  "camera",
  "light",
  "exhaust_fan",
  "filament_buffer",
  "purge_tray",
  "dust_collector",
  "air_assist",
  "rotary_module",
  "other",
]);

export const workSurfaceTypeEnum = pgEnum("work_surface_type", [
  "cool_plate",
  "textured_pei",
  "engineering_plate",
  "high_temp_plate",
  "wasteboard",
  "aluminum_bed",
  "vacuum_table",
  "honeycomb_bed",
  "knife_blade_bed",
  "material_pass_through",
]);

export const connectionTypeEnum = pgEnum("connection_type", [
  "wifi",
  "ethernet",
]);

// ── Submissions ──────────────────────────────────────────────────────────────

export const submissionTypeEnum = pgEnum("submission_type", [
  "new_filament",
  "new_variant",
  "correction",
  "equivalence",
]);

export const submissionStatusEnum = pgEnum("submission_status", [
  "pending",
  "approved",
  "rejected",
  "duplicate",
]);

// ── Audit ────────────────────────────────────────────────────────────────────

export const auditActorTypeEnum = pgEnum("audit_actor_type", [
  "session",
  "api_key",
  "system",
]);

export const auditActionEnum = pgEnum("audit_action", [
  "create",
  "update",
  "delete",
  "review",
  "login",
  "logout",
]);
