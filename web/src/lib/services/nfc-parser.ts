/**
 * Server-side NFC tag parsing.
 *
 * Bambu MIFARE Classic layout (same for all tags):
 *   S0: [UID block] [variantId(8)+materialId(8)] [material name(16)]
 *   S1: [product name(16)] [RGBA(4)+netWeight(2)+reserved(2)+diameter(4)+reserved(4)] [dryTemp(2)+dryTime(2)+reserved(2)+bedTemp(2)+nozzleMax(2)+nozzleMin(2)+reserved(4)]
 *   S2: [xcam A-F(16)] [tray UID(16)] [reserved]
 *   S3: [production date(16)] [reserved] [reserved(4)+filamentLength(2)+reserved]
 *   S4: [multicolor data(16)] [reserved] [reserved]
 *
 * The firmware sends ALL 16 sectors in the hex string with zeros for failed reads.
 * The `sectorOk` bitmask indicates which sectors were successfully authenticated
 * and read. For older firmware that doesn't send sectorOk, we validate data fields
 * to detect garbage from failed reads.
 */

import type { NfcTagFormat } from "./types";

// ── Types ───────────────────────────────────────────────────────────────────

export interface BambuParsedData {
  format: "bambu_mifare";
  // Sector 0
  variantId: string | null;
  materialId: string | null;
  material: string | null;
  // Sector 1
  name: string | null;
  colorR: number | null;
  colorG: number | null;
  colorB: number | null;
  colorA: number | null;
  colorHex: string | null;
  spoolNetWeight: number | null;
  filamentDiameter: number | null;
  dryingTemp: number | null;
  dryingTime: number | null;
  bedTemp: number | null;
  nozzleTempMax: number | null;
  nozzleTempMin: number | null;
  // Sector 2
  xcamA: number | null;
  xcamB: number | null;
  xcamC: number | null;
  xcamD: number | null;
  xcamE: number | null;
  xcamF: number | null;
  trayUid: string | null;
  // Sector 3
  productionDate: string | null;
  filamentLengthM: number | null;
  // Sector 4
  multicolorData: string | null;
  // Metadata
  sectorsOk: number[];
  parseWarnings: string[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function hexToBuffer(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

function readString(buf: Buffer, offset: number, length: number): string {
  if (offset + length > buf.length) return "";
  let str = buf.subarray(offset, offset + length).toString("ascii");
  str = str.replace(/[\x00\s]+$/, "");
  return str;
}

function readU16LE(buf: Buffer, offset: number): number {
  if (offset + 2 > buf.length) return 0;
  return buf.readUInt16LE(offset);
}

function readFloatLE(buf: Buffer, offset: number): number {
  if (offset + 4 > buf.length) return 0;
  return buf.readFloatLE(offset);
}

function toHex(buf: Buffer, offset: number, length: number): string {
  if (offset + length > buf.length) return "";
  return buf.subarray(offset, offset + length).toString("hex").toUpperCase();
}

function isPrintableAscii(buf: Buffer, offset: number, length: number): boolean {
  if (offset + length > buf.length) return false;
  let hasPrintable = false;
  for (let i = offset; i < offset + length; i++) {
    const b = buf[i];
    if (b === 0) continue;
    if (b < 0x20 || b > 0x7E) return false;
    hasPrintable = true;
  }
  return hasPrintable;
}

function isSaneTemp(val: number): boolean {
  return val > 0 && val < 500;
}

function isZeroBlock(buf: Buffer, offset: number, length: number): boolean {
  if (offset + length > buf.length) return true;
  for (let i = offset; i < offset + length; i++) {
    if (buf[i] !== 0) return false;
  }
  return true;
}

/**
 * Determine if a sector was successfully read.
 * Uses the sectorOk bitmask if available (new firmware), otherwise
 * checks if the sector data is all zeros (heuristic for failed reads).
 */
function isSectorOk(
  sectorIndex: number,
  sectorOkBitmask: number | null,
  buf: Buffer,
): boolean {
  if (sectorOkBitmask != null) {
    return (sectorOkBitmask & (1 << sectorIndex)) !== 0;
  }
  // Heuristic: if the entire sector (48 bytes) is zeros, it wasn't read
  const offset = sectorIndex * 48;
  if (offset + 48 > buf.length) return false;
  return !isZeroBlock(buf, offset, 48);
}

// ── Bambu Parser ────────────────────────────────────────────────────────────

/**
 * Parse Bambu MIFARE Classic raw data.
 *
 * The hex string contains 16 sectors × 3 data blocks × 16 bytes each (768 bytes).
 * For older firmware that only sent N sectors, the string is shorter.
 *
 * The `sectorOk` bitmask (if provided) indicates which sectors were successfully
 * authenticated and read. Sectors that failed authentication contain zeros or garbage.
 */
export function parseBambuRawData(
  hexString: string,
  sectorsInData: number,
  sectorOk: number | null = null,
): BambuParsedData | null {
  const bytesPerSector = 3 * 16;
  const buf = hexToBuffer(hexString);
  const warnings: string[] = [];

  if (buf.length < bytesPerSector) return null; // Need at least 1 sector

  const totalSectors = Math.min(sectorsInData, Math.floor(buf.length / bytesPerSector));

  // Byte offset for sector s, block b, byte i
  const off = (s: number, b: number, i: number) => s * 48 + b * 16 + i;
  const hasSector = (s: number) => s < totalSectors && isSectorOk(s, sectorOk, buf);

  // Track which sectors we could read
  const sectorsOk: number[] = [];
  for (let s = 0; s < totalSectors; s++) {
    if (isSectorOk(s, sectorOk, buf)) sectorsOk.push(s);
  }

  const result: BambuParsedData = {
    format: "bambu_mifare",
    variantId: null, materialId: null, material: null,
    name: null,
    colorR: null, colorG: null, colorB: null, colorA: null, colorHex: null,
    spoolNetWeight: null, filamentDiameter: null,
    dryingTemp: null, dryingTime: null,
    bedTemp: null, nozzleTempMax: null, nozzleTempMin: null,
    xcamA: null, xcamB: null, xcamC: null, xcamD: null, xcamE: null, xcamF: null,
    trayUid: null,
    productionDate: null, filamentLengthM: null,
    multicolorData: null,
    sectorsOk,
    parseWarnings: warnings,
  };

  // ── Sector 0: Material identification ─────────────────────────────────
  if (hasSector(0)) {
    const block1Str = readString(buf, off(0, 1, 0), 16);
    const block2Str = readString(buf, off(0, 2, 0), 16);

    if (block1Str.includes("-")) {
      // Standard: block 1 = "A00-K00" + "GFA00", block 2 = "PLA"
      result.variantId = readString(buf, off(0, 1, 0), 8) || null;
      result.materialId = readString(buf, off(0, 1, 8), 8) || null;
      result.material = block2Str || null;
    } else if (isPrintableAscii(buf, off(0, 1, 0), 16) && block1Str) {
      result.material = block1Str;
      result.materialId = block1Str;
    } else {
      warnings.push("Sector 0: block 1 not readable");
    }
  } else {
    warnings.push("Sector 0: not read");
  }

  // ── Sector 1: Name, color, weight, temps ──────────────────────────────
  if (hasSector(1)) {
    const s1b0Str = readString(buf, off(1, 0, 0), 16);

    if (isPrintableAscii(buf, off(1, 0, 0), 16) && s1b0Str) {
      result.name = s1b0Str;
    } else {
      warnings.push("Sector 1: block 0 not a valid name");
      result.name = result.material; // fallback
    }

    // Block 1: color RGBA + net weight + diameter
    const r = buf[off(1, 1, 0)], g = buf[off(1, 1, 1)], b = buf[off(1, 1, 2)], a = buf[off(1, 1, 3)];
    result.colorR = r; result.colorG = g; result.colorB = b; result.colorA = a;
    result.colorHex = "#" + r.toString(16).padStart(2, "0") + g.toString(16).padStart(2, "0") + b.toString(16).padStart(2, "0");

    const netWeight = readU16LE(buf, off(1, 1, 4));
    if (netWeight > 0 && netWeight < 10000) result.spoolNetWeight = netWeight;

    const diameter = readFloatLE(buf, off(1, 1, 8));
    if (diameter > 1.0 && diameter < 5.0) result.filamentDiameter = diameter;

    // Block 2: drying info + temps
    const dryTemp = readU16LE(buf, off(1, 2, 0));
    const dryTime = readU16LE(buf, off(1, 2, 2));
    if (isSaneTemp(dryTemp)) result.dryingTemp = dryTemp;
    if (dryTime > 0 && dryTime < 100) result.dryingTime = dryTime;

    const bedTemp = readU16LE(buf, off(1, 2, 6));
    const nozzleMax = readU16LE(buf, off(1, 2, 8));
    const nozzleMin = readU16LE(buf, off(1, 2, 10));
    if (isSaneTemp(bedTemp)) result.bedTemp = bedTemp;
    if (isSaneTemp(nozzleMax)) result.nozzleTempMax = nozzleMax;
    if (isSaneTemp(nozzleMin)) result.nozzleTempMin = nozzleMin;
  } else {
    warnings.push("Sector 1: not read");
  }

  // ── Sector 2: X-cam data, Tray UID ───────────────────────────────────
  if (hasSector(2)) {
    result.xcamA = readU16LE(buf, off(2, 0, 0));
    result.xcamB = readU16LE(buf, off(2, 0, 2));
    result.xcamC = readU16LE(buf, off(2, 0, 4));
    result.xcamD = readU16LE(buf, off(2, 0, 6));
    result.xcamE = readFloatLE(buf, off(2, 0, 8));
    result.xcamF = readFloatLE(buf, off(2, 0, 12));

    if (!isZeroBlock(buf, off(2, 1, 0), 16)) {
      result.trayUid = toHex(buf, off(2, 1, 0), 16);
    }
  } else {
    warnings.push("Sector 2: not read");
  }

  // ── Sector 3: Production date, filament length ────────────────────────
  if (hasSector(3)) {
    const dateStr = readString(buf, off(3, 0, 0), 16);
    if (/^\d{4}/.test(dateStr)) {
      result.productionDate = dateStr;
    }

    const filLen = readU16LE(buf, off(3, 2, 4));
    if (filLen > 0 && filLen < 5000) result.filamentLengthM = filLen;
  } else {
    warnings.push("Sector 3: not read");
  }

  // ── Sector 4: Multicolor data ─────────────────────────────────────────
  if (hasSector(4)) {
    if (!isZeroBlock(buf, off(4, 0, 0), 16)) {
      result.multicolorData = toHex(buf, off(4, 0, 0), 16);
    }
  }

  return result;
}

// ── Tag Format Detection ────────────────────────────────────────────────────

export function detectTagFormat(
  nfcRawData: string,
  nfcTagType: number | null,
  sectorsRead: number | null,
  pagesRead: number | null,
  sectorOk: number | null = null,
): NfcTagFormat {
  if (nfcTagType === 1 && sectorsRead && sectorsRead >= 1) {
    const parsed = parseBambuRawData(nfcRawData, sectorsRead, sectorOk);
    if (parsed && parsed.material) {
      return "bambu_mifare";
    }
  }

  if (nfcTagType === 2 && pagesRead) {
    return "ntag";
  }

  if (nfcTagType === 3 && pagesRead) {
    return "unknown";
  }

  return "unknown";
}

/**
 * Parse any NFC raw data based on detected format.
 */
export function parseNfcRawData(
  nfcRawData: string,
  nfcTagType: number | null,
  sectorsRead: number | null,
  pagesRead: number | null,
  sectorOk: number | null = null,
): { format: NfcTagFormat; parsed: Record<string, any> | null } {
  const format = detectTagFormat(nfcRawData, nfcTagType, sectorsRead, pagesRead, sectorOk);

  switch (format) {
    case "bambu_mifare": {
      const parsed = parseBambuRawData(nfcRawData, sectorsRead!, sectorOk);
      return { format, parsed };
    }
    default:
      return { format, parsed: null };
  }
}
