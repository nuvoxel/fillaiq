/**
 * Server-side NFC tag parsing.
 *
 * Ports the Bambu parser from firmware/scan-station/src/bambu_tag.cpp (lines 196-292).
 * The firmware already decrypted MIFARE Classic sectors — the hex string here is
 * the plaintext sector data (3 data blocks × 16 bytes per sector).
 */

import type { NfcTagFormat } from "./types";

// ── Types ───────────────────────────────────────────────────────────────────

export interface BambuParsedData {
  format: "bambu_mifare";
  // Sector 0
  variantId: string;
  materialId: string;
  material: string;
  // Sector 1
  name: string;
  colorR: number;
  colorG: number;
  colorB: number;
  colorA: number;
  colorHex: string;
  spoolNetWeight: number;
  filamentDiameter: number;
  dryingTemp: number;
  dryingTime: number;
  bedTemp: number;
  nozzleTempMax: number;
  nozzleTempMin: number;
  // Sector 2
  xcamA: number;
  xcamB: number;
  xcamC: number;
  xcamD: number;
  xcamE: number;
  xcamF: number;
  trayUid: string;
  // Sector 3
  productionDate: string;
  filamentLengthM: number;
  // Sector 4
  multicolorData: string | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Decode hex string into a Buffer. */
function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

/** Read a null/space-trimmed ASCII string from a buffer region. */
function readString(buf: Buffer, offset: number, length: number): string {
  let str = buf.subarray(offset, offset + length).toString("ascii");
  // Trim trailing nulls and spaces
  str = str.replace(/[\x00\s]+$/, "");
  return str;
}

/** Read uint16 little-endian. */
function readU16LE(buf: Buffer, offset: number): number {
  return buf.readUInt16LE(offset);
}

/** Read float32 little-endian. */
function readFloatLE(buf: Buffer, offset: number): number {
  return buf.readFloatLE(offset);
}

/** Convert a buffer region to uppercase hex string. */
function toHex(buf: Buffer, offset: number, length: number): string {
  return buf.subarray(offset, offset + length).toString("hex").toUpperCase();
}

// ── Bambu Parser ────────────────────────────────────────────────────────────

/**
 * Parse Bambu MIFARE Classic raw data.
 *
 * Hex string format: `sectorsRead` sectors × 3 blocks × 16 bytes each.
 * Each sector contributes 96 hex characters (48 bytes = 3 blocks × 16 bytes).
 *
 * Block layout per sector mirrors the firmware C++ struct offsets:
 *   sector_data[s][block][byte]
 *
 * In the hex string, sector s, block b, byte i is at hex position:
 *   (s * 3 * 16 + b * 16 + i) * 2
 */
export function parseBambuRawData(
  hexString: string,
  sectorsRead: number
): BambuParsedData | null {
  const expectedBytes = sectorsRead * 3 * 16;
  if (hexString.length < expectedBytes * 2) return null;

  const buf = hexToBuffer(hexString);

  // Helper to get byte offset for sector s, block b, byte i
  const off = (s: number, b: number, i: number) => s * 48 + b * 16 + i;

  const result: Partial<BambuParsedData> = { format: "bambu_mifare" };

  // Sector 0: Block 1 (variant/material IDs), Block 2 (material type)
  if (sectorsRead > 0) {
    result.variantId = readString(buf, off(0, 1, 0), 8);
    result.materialId = readString(buf, off(0, 1, 8), 8);
    result.material = readString(buf, off(0, 2, 0), 16);
  }

  // Sector 1: Name, color, weight, diameter, temps
  if (sectorsRead > 1) {
    result.name = readString(buf, off(1, 0, 0), 16);

    result.colorR = buf[off(1, 1, 0)];
    result.colorG = buf[off(1, 1, 1)];
    result.colorB = buf[off(1, 1, 2)];
    result.colorA = buf[off(1, 1, 3)];
    result.colorHex =
      "#" +
      result.colorR.toString(16).padStart(2, "0") +
      result.colorG.toString(16).padStart(2, "0") +
      result.colorB.toString(16).padStart(2, "0");

    result.spoolNetWeight = readU16LE(buf, off(1, 1, 4));
    result.filamentDiameter = readFloatLE(buf, off(1, 1, 8));

    result.dryingTemp = readU16LE(buf, off(1, 2, 0));
    result.dryingTime = readU16LE(buf, off(1, 2, 2));
    result.bedTemp = readU16LE(buf, off(1, 2, 6));
    result.nozzleTempMax = readU16LE(buf, off(1, 2, 8));
    result.nozzleTempMin = readU16LE(buf, off(1, 2, 10));
  }

  // Sector 2: X-cam data, Tray UID
  if (sectorsRead > 2) {
    result.xcamA = readU16LE(buf, off(2, 0, 0));
    result.xcamB = readU16LE(buf, off(2, 0, 2));
    result.xcamC = readU16LE(buf, off(2, 0, 4));
    result.xcamD = readU16LE(buf, off(2, 0, 6));
    result.xcamE = readFloatLE(buf, off(2, 0, 8));
    result.xcamF = readFloatLE(buf, off(2, 0, 12));

    result.trayUid = toHex(buf, off(2, 1, 0), 16);
  }

  // Sector 3: Production date, filament length
  if (sectorsRead > 3) {
    result.productionDate = readString(buf, off(3, 0, 0), 16);
    result.filamentLengthM = readU16LE(buf, off(3, 2, 4));
  }

  // Sector 4: Multicolor data
  if (sectorsRead > 4) {
    const mcBytes = buf.subarray(off(4, 0, 0), off(4, 0, 16));
    const hasData = mcBytes.some((b) => b !== 0);
    result.multicolorData = hasData ? toHex(buf, off(4, 0, 0), 16) : null;
  } else {
    result.multicolorData = null;
  }

  return result as BambuParsedData;
}

// ── Tag Format Detection ────────────────────────────────────────────────────

/**
 * Detect the NFC tag format from raw data and tag type.
 *
 * Tag types (from firmware PN532):
 *   0 = MIFARE Classic
 *   1 = NTAG/Ultralight
 */
export function detectTagFormat(
  nfcRawData: string,
  nfcTagType: number | null,
  sectorsRead: number | null,
  pagesRead: number | null
): NfcTagFormat {
  // MIFARE Classic with sector data → likely Bambu
  // Firmware enum: TAG_MIFARE_CLASSIC = 1, TAG_NTAG = 2
  if (nfcTagType === 1 && sectorsRead && sectorsRead >= 4) {
    // Try to parse — if sector 0 has a materialId, it's Bambu
    const parsed = parseBambuRawData(nfcRawData, sectorsRead);
    if (parsed && parsed.materialId) {
      return "bambu_mifare";
    }
  }

  // NTAG/Ultralight (firmware enum: TAG_NTAG = 2)
  if (nfcTagType === 2 && pagesRead) {
    // TODO: detect OpenSpool, TigerTag, OpenPrintTag, etc. by parsing NDEF records
    return "ntag";
  }

  // ISO15693 / ICODE SLIX (firmware enum: TAG_ISO15693 = 3)
  if (nfcTagType === 3 && pagesRead) {
    // TODO: parse ICODE SLIX data
    return "unknown";
  }

  return "unknown";
}

/**
 * Parse any NFC raw data based on detected format.
 * Returns structured parsed data or null.
 */
export function parseNfcRawData(
  nfcRawData: string,
  nfcTagType: number | null,
  sectorsRead: number | null,
  pagesRead: number | null
): { format: NfcTagFormat; parsed: Record<string, any> | null } {
  const format = detectTagFormat(nfcRawData, nfcTagType, sectorsRead, pagesRead);

  switch (format) {
    case "bambu_mifare": {
      const parsed = parseBambuRawData(nfcRawData, sectorsRead!);
      return { format, parsed };
    }
    // Future: case "tiger_tag": ...
    // Future: case "open_spool": ...
    default:
      return { format, parsed: null };
  }
}
