/**
 * Convert spectral/color sensor data from firmware payloads to hex + Lab.
 *
 * Supports: AS7341, AS7343, TCS34725, OPT4048, AS7265x.
 * AS7331 is UV-only — returns null.
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface ColorResult {
  hex: string; // "#RRGGBB"
  labL: number;
  labA: number;
  labB: number;
}

interface SpectralPayload {
  sensor: string;
  channelCount: number;
  channels: number[];
  // AS7341/AS7343/AS7265x named fields
  f1_415nm?: number;
  f2_445nm?: number;
  f3_480nm?: number;
  f4_515nm?: number;
  f5_555nm?: number;
  f6_590nm?: number;
  f7_630nm?: number;
  f8_680nm?: number;
  clear?: number;
  nir?: number;
  // TCS34725
  r?: number;
  g?: number;
  b?: number;
  c?: number;
  colorTemp?: number;
  lux?: number;
  // OPT4048
  cie_x?: number;
  cie_y?: number;
  cie_z?: number;
  // AS7331 (UV only)
  uva?: number;
  uvb?: number;
  uvc?: number;
}

// ── Color Math ──────────────────────────────────────────────────────────────

/** D65 reference white point. */
const D65 = { X: 95.047, Y: 100.0, Z: 108.883 };

/** sRGB linear to gamma-corrected. */
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;
}

/** Clamp 0-1. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/** XYZ (absolute, D65 illuminant, Y=100 scale) → sRGB hex. */
function xyzToHex(X: number, Y: number, Z: number): string {
  // Normalize to 0-1 range
  const x = X / 100;
  const y = Y / 100;
  const z = Z / 100;

  // XYZ to linear sRGB (D65)
  let r = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let g = x * -0.969266 + y * 1.8760108 + z * 0.041556;
  let b = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  // Gamma correction
  r = linearToSrgb(clamp01(r));
  g = linearToSrgb(clamp01(g));
  b = linearToSrgb(clamp01(b));

  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");

  return "#" + toHex(r) + toHex(g) + toHex(b);
}

/** XYZ (Y=100 scale) → CIELAB. */
function xyzToLab(X: number, Y: number, Z: number): { L: number; a: number; b: number } {
  const f = (t: number) =>
    t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;

  const fx = f(X / D65.X);
  const fy = f(Y / D65.Y);
  const fz = f(Z / D65.Z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

// ── Sensor-Specific Converters ──────────────────────────────────────────────

/**
 * AS7341/AS7343: 8 spectral bands → XYZ via CIE 1931 weighting.
 *
 * Approximate CIE 1931 2° observer weights for the AS7341 center wavelengths.
 * These are rough but practical for filament color matching.
 */
function convertAS7341(data: SpectralPayload): ColorResult | null {
  const bands = [
    data.f1_415nm ?? 0,
    data.f2_445nm ?? 0,
    data.f3_480nm ?? 0,
    data.f4_515nm ?? 0,
    data.f5_555nm ?? 0,
    data.f6_590nm ?? 0,
    data.f7_630nm ?? 0,
    data.f8_680nm ?? 0,
  ];

  // If all zero, no valid reading
  if (bands.every((b) => b === 0)) return null;

  // CIE 1931 2° observer x̄, ȳ, z̄ at AS7341 center wavelengths
  // 415nm, 445nm, 480nm, 515nm, 555nm, 590nm, 630nm, 680nm
  const xBar = [0.1142, 0.3481, 0.0956, 0.0093, 0.4334, 1.0622, 0.6424, 0.0816];
  const yBar = [0.0040, 0.0298, 0.1390, 0.5030, 0.9950, 0.7570, 0.2650, 0.0170];
  const zBar = [0.5505, 1.7471, 0.8120, 0.0549, 0.0087, 0.0011, 0.0000, 0.0000];

  let X = 0,
    Y = 0,
    Z = 0;
  for (let i = 0; i < 8; i++) {
    X += bands[i] * xBar[i];
    Y += bands[i] * yBar[i];
    Z += bands[i] * zBar[i];
  }

  // Normalize so Y = 100 (relative luminance)
  if (Y === 0) return null;
  const scale = 100 / Y;
  X *= scale;
  Y = 100;
  Z *= scale;

  const lab = xyzToLab(X, Y, Z);
  return {
    hex: xyzToHex(X, Y, Z),
    labL: Math.round(lab.L * 100) / 100,
    labA: Math.round(lab.a * 100) / 100,
    labB: Math.round(lab.b * 100) / 100,
  };
}

/**
 * TCS34725: RGBC sensor → sRGB hex + Lab.
 */
function convertTCS34725(data: SpectralPayload): ColorResult | null {
  const { r, g, b, c } = data;
  if (r == null || g == null || b == null || c == null || c === 0) return null;

  // Normalize by clear channel
  let rn = r / c;
  let gn = g / c;
  let bn = b / c;

  // Clamp
  rn = clamp01(rn);
  gn = clamp01(gn);
  bn = clamp01(bn);

  // Apply gamma correction for sRGB output
  const rg = linearToSrgb(rn);
  const gg = linearToSrgb(gn);
  const bg = linearToSrgb(bn);

  const toHex = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");

  const hex = "#" + toHex(rg) + toHex(gg) + toHex(bg);

  // For Lab, convert sRGB → XYZ → Lab
  // First, inverse sRGB gamma to get linear
  const srgbToLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

  const rl = srgbToLinear(rg);
  const gl = srgbToLinear(gg);
  const bl = srgbToLinear(bg);

  // Linear sRGB → XYZ (D65)
  const X = (rl * 0.4124564 + gl * 0.3575761 + bl * 0.1804375) * 100;
  const Y = (rl * 0.2126729 + gl * 0.7151522 + bl * 0.072175) * 100;
  const Z = (rl * 0.0193339 + gl * 0.119192 + bl * 0.9503041) * 100;

  const lab = xyzToLab(X, Y, Z);
  return {
    hex,
    labL: Math.round(lab.L * 100) / 100,
    labA: Math.round(lab.a * 100) / 100,
    labB: Math.round(lab.b * 100) / 100,
  };
}

/**
 * OPT4048: Native CIE XYZ channels → sRGB + Lab.
 */
function convertOPT4048(data: SpectralPayload): ColorResult | null {
  const { cie_x, cie_y, cie_z } = data;
  if (cie_x == null || cie_y == null || cie_z == null) return null;
  if (cie_x === 0 && cie_y === 0 && cie_z === 0) return null;

  // OPT4048 outputs raw CIE XYZ counts — normalize so Y=100
  const total = cie_y;
  if (total === 0) return null;

  const scale = 100 / total;
  const X = cie_x * scale;
  const Y = 100;
  const Z = cie_z * scale;

  const lab = xyzToLab(X, Y, Z);
  return {
    hex: xyzToHex(X, Y, Z),
    labL: Math.round(lab.L * 100) / 100,
    labA: Math.round(lab.a * 100) / 100,
    labB: Math.round(lab.b * 100) / 100,
  };
}

/**
 * AS7265x: 18-channel triad spectral sensor → XYZ → sRGB/Lab.
 *
 * Center wavelengths: 410, 435, 460, 485, 510, 535, 560, 585, 610,
 *                     645, 680, 705, 730, 760, 810, 860, 900, 940 nm
 *
 * We use the first 12 channels (visible range 410-705nm) for color.
 */
function convertAS7265x(data: SpectralPayload): ColorResult | null {
  const channels = data.channels;
  if (!channels || channels.length < 12) return null;
  if (channels.every((c) => c === 0)) return null;

  // CIE 1931 2° observer approximate weights for AS7265x visible wavelengths
  // 410, 435, 460, 485, 510, 535, 560, 585, 610, 645, 680, 705 nm
  const xBar = [0.0435, 0.2148, 0.2908, 0.0475, 0.0049, 0.1096, 0.5945, 1.0263, 0.8544, 0.4479, 0.0816, 0.0287];
  const yBar = [0.0012, 0.0140, 0.0600, 0.1780, 0.3230, 0.7932, 0.9950, 0.8163, 0.5030, 0.1750, 0.0170, 0.0047];
  const zBar = [0.2074, 1.0743, 1.6220, 0.5720, 0.0782, 0.0170, 0.0039, 0.0017, 0.0003, 0.0000, 0.0000, 0.0000];

  let X = 0,
    Y = 0,
    Z = 0;
  for (let i = 0; i < 12; i++) {
    X += channels[i] * xBar[i];
    Y += channels[i] * yBar[i];
    Z += channels[i] * zBar[i];
  }

  if (Y === 0) return null;
  const scale = 100 / Y;
  X *= scale;
  Y = 100;
  Z *= scale;

  const lab = xyzToLab(X, Y, Z);
  return {
    hex: xyzToHex(X, Y, Z),
    labL: Math.round(lab.L * 100) / 100,
    labA: Math.round(lab.a * 100) / 100,
    labB: Math.round(lab.b * 100) / 100,
  };
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert spectral/sensor data to hex color + Lab values.
 * Returns null for UV-only sensors or invalid data.
 */
export function spectralToColor(spectralData: any): ColorResult | null {
  if (!spectralData || !spectralData.sensor) return null;

  const data = spectralData as SpectralPayload;

  switch (data.sensor) {
    case "as7341":
    case "as7343":
      return convertAS7341(data);

    case "tcs34725":
      return convertTCS34725(data);

    case "opt4048":
      return convertOPT4048(data);

    case "as7265x":
      return convertAS7265x(data);

    case "as7331":
      // UV only — no visible color
      return null;

    default:
      return null;
  }
}
