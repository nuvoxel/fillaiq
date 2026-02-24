import { pgEnum } from "drizzle-orm/pg-core";

export const validationStatusEnum = pgEnum("validation_status", [
  "draft",
  "submitted",
  "validated",
  "deprecated",
]);

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

export const spoolStatusEnum = pgEnum("spool_status", [
  "active",
  "empty",
  "archived",
]);

export const slotStateEnum = pgEnum("slot_state", [
  "empty",
  "detecting",
  "active",
  "unknown_spool",
  "removed",
  "error",
]);

export const weightEventTypeEnum = pgEnum("weight_event_type", [
  "placed",
  "removed",
  "reading",
  "usage",
  "drying",
]);

export const equipmentTypeEnum = pgEnum("equipment_type", [
  "drybox",
  "enclosure",
  "storage_bin",
  "other",
]);

export const spoolMaterialTypeEnum = pgEnum("spool_material_type", [
  "plastic",
  "cardboard",
  "metal",
  "unknown",
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

export const bedTempTypeEnum = pgEnum("bed_temp_type", [
  "cool_plate",
  "textured_pei",
  "engineering_plate",
  "high_temp_plate",
]);

export const labelFormatEnum = pgEnum("label_format", [
  "labelife_image",
  "labelife_native",
  "png",
  "pdf",
]);

export const materialClassEnum = pgEnum("material_class", ["fff", "sla"]);

export const connectionTypeEnum = pgEnum("connection_type", [
  "wifi",
  "ethernet",
]);

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
