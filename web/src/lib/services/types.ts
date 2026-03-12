/**
 * Shared types for scan services.
 */

export type NfcTagFormat =
  | "bambu_mifare"
  | "creality"
  | "open_print_tag"
  | "open_spool"
  | "open_tag_3d"
  | "tiger_tag"
  | "ntag"
  | "filla_iq"
  | "unknown";

export type ScanSessionStatus = "active" | "resolved" | "abandoned";
