/**
 * Convert spectral/color sensor data from firmware payloads to hex + Lab.
 *
 * Supports: AS7341, AS7343, TCS34725, OPT4048, AS7265x.
 * AS7331 is UV-only — returns null.
 *
 * Color science pipeline:
 *   Spectral → CIE XYZ (1931 2° observer) → sRGB + CIELAB (D65 illuminant)
 */

// ── Types ───────────────────────────────────────────────────────────────────

export interface ColorResult {
  hex: string; // "#RRGGBB"
  r: number; // 0-255
  g: number; // 0-255
  b: number; // 0-255
  labL: number; // 0-100
  labA: number; // -128 to 127
  labB: number; // -128 to 127
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

// ── CIE 1931 2° Standard Observer ──────────────────────────────────────────
//
// Tabulated at 5nm intervals from 380nm to 780nm (81 entries).
// Source: CIE 015:2004 colorimetry standard.

const CIE_LAMBDA_START = 380;
const CIE_LAMBDA_STEP = 5;
const CIE_LAMBDA_END = 780;

// x-bar (red) color matching function
const CIE_X_BAR: readonly number[] = [
  0.001368, 0.002236, 0.004243, 0.00765, 0.01431, 0.02319, 0.04351, 0.07763,
  0.13438, 0.21477, 0.2839, 0.3285, 0.34828, 0.34806, 0.3362, 0.3187,
  0.2908, 0.2511, 0.19536, 0.1421, 0.09564, 0.05795, 0.03201, 0.0147,
  0.0049, 0.0024, 0.0093, 0.02910, 0.06327, 0.1096, 0.1655, 0.22575,
  0.2904, 0.3597, 0.43345, 0.51205, 0.5945, 0.6784, 0.7621, 0.8425,
  0.9163, 0.9786, 1.0263, 1.0567, 1.0622, 1.0456, 1.0026, 0.9384,
  0.85445, 0.7514, 0.6424, 0.5419, 0.4479, 0.3608, 0.2835, 0.2187,
  0.1649, 0.1212, 0.0874, 0.0636, 0.04677, 0.0329, 0.0227, 0.01584,
  0.01136, 0.00811, 0.00579, 0.004109, 0.002899, 0.002049, 0.001440,
  0.001000, 0.000690, 0.000476, 0.000332, 0.000235, 0.000166, 0.000117,
  0.0000830, 0.0000590, 0.0000420,
];

// y-bar (green / luminance) color matching function
const CIE_Y_BAR: readonly number[] = [
  0.000039, 0.000064, 0.00012, 0.000217, 0.000396, 0.00064, 0.00121,
  0.00218, 0.004, 0.0073, 0.0116, 0.01684, 0.023, 0.0298, 0.038,
  0.048, 0.06, 0.0739, 0.09098, 0.1126, 0.13902, 0.1693, 0.20802,
  0.2586, 0.323, 0.4073, 0.503, 0.6082, 0.71, 0.7932, 0.862,
  0.91485, 0.954, 0.9803, 0.99495, 1.0, 0.995, 0.9786, 0.952,
  0.9154, 0.87, 0.8163, 0.757, 0.6949, 0.631, 0.5668, 0.503,
  0.4412, 0.381, 0.321, 0.265, 0.217, 0.175, 0.1382, 0.107,
  0.0816, 0.061, 0.04458, 0.032, 0.0232, 0.017, 0.01192, 0.00821,
  0.005723, 0.004102, 0.002929, 0.002091, 0.001484, 0.001047, 0.00074,
  0.00052, 0.000361, 0.000249, 0.000172, 0.00012, 0.0000848, 0.00006,
  0.0000424, 0.00003, 0.0000212,
];

// z-bar (blue) color matching function
const CIE_Z_BAR: readonly number[] = [
  0.00645, 0.01055, 0.02005, 0.03621, 0.06785, 0.1102, 0.2074, 0.3713,
  0.6456, 1.03905, 1.3856, 1.62296, 1.7471, 1.7826, 1.7721, 1.7441,
  1.6692, 1.5281, 1.28764, 1.0419, 0.8130, 0.6162, 0.46518, 0.3533,
  0.272, 0.2123, 0.1582, 0.1117, 0.07825, 0.05725, 0.04216, 0.02984,
  0.0203, 0.0134, 0.00875, 0.00575, 0.0039, 0.00275, 0.0021, 0.0018,
  0.00165, 0.0014, 0.0011, 0.001, 0.0008, 0.0006, 0.00034, 0.00024,
  0.00019, 0.0001, 0.00005, 0.00003, 0.00002, 0.00001, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0,
  0.0, 0.0, 0.0,
];

/**
 * Look up CIE 1931 2° observer values at a given wavelength (nm).
 * Linearly interpolates between tabulated 5nm points.
 */
function cieObserver(lambdaNm: number): { x: number; y: number; z: number } {
  if (lambdaNm < CIE_LAMBDA_START || lambdaNm > CIE_LAMBDA_END) {
    return { x: 0, y: 0, z: 0 };
  }
  const idx = (lambdaNm - CIE_LAMBDA_START) / CIE_LAMBDA_STEP;
  const lo = Math.floor(idx);
  const hi = Math.min(lo + 1, CIE_X_BAR.length - 1);
  const frac = idx - lo;
  return {
    x: CIE_X_BAR[lo] + frac * (CIE_X_BAR[hi] - CIE_X_BAR[lo]),
    y: CIE_Y_BAR[lo] + frac * (CIE_Y_BAR[hi] - CIE_Y_BAR[lo]),
    z: CIE_Z_BAR[lo] + frac * (CIE_Z_BAR[hi] - CIE_Z_BAR[lo]),
  };
}

// ── Color Math ──────────────────────────────────────────────────────────────

/** D65 reference white (CIE XYZ, Y=100 scale). */
const D65 = { X: 95.047, Y: 100.0, Z: 108.883 };

/** sRGB companding: linear → gamma-corrected. */
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1.0 / 2.4) - 0.055;
}

/** sRGB inverse companding: gamma-corrected → linear. */
function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** Clamp to [0, 1]. */
function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * CIE XYZ (Y=100 scale, D65) → sRGB {r, g, b} 0-255 + hex.
 *
 * Uses the IEC 61966-2-1 sRGB matrix (Bradford-adapted D65).
 */
function xyzToSrgb(X: number, Y: number, Z: number): { r: number; g: number; b: number; hex: string } {
  // Normalize to 0-1 range (Y=100 → Y=1)
  const x = X / 100;
  const y = Y / 100;
  const z = Z / 100;

  // XYZ → linear sRGB (IEC 61966-2-1 matrix, D65 reference white)
  let rl = x * 3.2404542 + y * -1.5371385 + z * -0.4985314;
  let gl = x * -0.9692660 + y * 1.8760108 + z * 0.0415560;
  let bl = x * 0.0556434 + y * -0.2040259 + z * 1.0572252;

  // Gamma correction + clamp
  const rs = linearToSrgb(clamp01(rl));
  const gs = linearToSrgb(clamp01(gl));
  const bs = linearToSrgb(clamp01(bl));

  const r8 = Math.round(rs * 255);
  const g8 = Math.round(gs * 255);
  const b8 = Math.round(bs * 255);

  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  const hex = "#" + toHex(r8) + toHex(g8) + toHex(b8);

  return { r: r8, g: g8, b: b8, hex };
}

/**
 * CIE XYZ (Y=100 scale, D65) → CIELAB.
 *
 * Uses the standard CIE 1976 L*a*b* formulas with D65 illuminant.
 */
function xyzToLab(X: number, Y: number, Z: number): { L: number; a: number; b: number } {
  const epsilon = 216 / 24389; // 0.008856
  const kappa = 24389 / 27; // 903.3

  const f = (t: number) => (t > epsilon ? Math.cbrt(t) : (kappa * t + 16) / 116);

  const fx = f(X / D65.X);
  const fy = f(Y / D65.Y);
  const fz = f(Z / D65.Z);

  return {
    L: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz),
  };
}

/** Build a ColorResult from CIE XYZ (Y=100 scale). */
function xyzToColorResult(X: number, Y: number, Z: number): ColorResult {
  const srgb = xyzToSrgb(X, Y, Z);
  const lab = xyzToLab(X, Y, Z);
  return {
    hex: srgb.hex,
    r: srgb.r,
    g: srgb.g,
    b: srgb.b,
    labL: Math.round(lab.L * 100) / 100,
    labA: Math.round(lab.a * 100) / 100,
    labB: Math.round(lab.b * 100) / 100,
  };
}

// ── Spectral Integration ────────────────────────────────────────────────────

/**
 * Integrate discrete spectral bands against CIE 1931 2° observer to get XYZ.
 *
 * Each band is defined by its center wavelength (nm) and measured value.
 * The integration assumes each band covers a region around its center wavelength,
 * with the CIE observer evaluated at that center wavelength.
 *
 * Returns XYZ normalized so Y=100.
 */
function spectralBandsToXYZ(
  bands: { lambda: number; value: number }[],
): { X: number; Y: number; Z: number } | null {
  let X = 0;
  let Y = 0;
  let Z = 0;

  for (const { lambda, value } of bands) {
    const obs = cieObserver(lambda);
    X += value * obs.x;
    Y += value * obs.y;
    Z += value * obs.z;
  }

  if (Y === 0) return null;

  // Normalize to Y=100
  const scale = 100 / Y;
  return { X: X * scale, Y: 100, Z: Z * scale };
}

// ── Sensor-Specific Converters ──────────────────────────────────────────────

/**
 * AS7341: 8 visible spectral channels.
 * Center wavelengths: 415, 445, 480, 515, 555, 590, 630, 680 nm
 */
function convertAS7341(data: SpectralPayload): ColorResult | null {
  const wavelengths = [415, 445, 480, 515, 555, 590, 630, 680];
  const values = [
    data.f1_415nm ?? 0,
    data.f2_445nm ?? 0,
    data.f3_480nm ?? 0,
    data.f4_515nm ?? 0,
    data.f5_555nm ?? 0,
    data.f6_590nm ?? 0,
    data.f7_630nm ?? 0,
    data.f8_680nm ?? 0,
  ];

  if (values.every((v) => v === 0)) return null;

  const bands = wavelengths.map((lambda, i) => ({ lambda, value: values[i] }));
  const xyz = spectralBandsToXYZ(bands);
  if (!xyz) return null;

  return xyzToColorResult(xyz.X, xyz.Y, xyz.Z);
}

/**
 * AS7343: 14 spectral channels.
 *
 * The firmware maps AS7343 register data to the same named fields as AS7341
 * (f1_415nm through f8_680nm), but the actual AS7343 center wavelengths differ:
 *   F1=405, F2=425, FZ=450, F3=475, F4=515, FY=555, FXL=600, F6=640,
 *   F7=690, F8=745, NIR=855, Clear, FD(flicker)
 *
 * The firmware maps these to the named fields as:
 *   f1_415nm ← F1(405), f2_445nm ← F2(425), f3_480nm ← FZ(450),
 *   f4_515nm ← F3(475), f5_555nm ← F4(515), f6_590nm ← FY/FXL(555-600),
 *   f7_630nm ← F6(640), f8_680nm ← F7(690)
 *
 * We use the actual AS7343 center wavelengths for accurate CIE integration.
 */
function convertAS7343(data: SpectralPayload): ColorResult | null {
  // AS7343 has 14 channels stored in channels[] in wavelength order:
  //   [0]=F1(405) [1]=F2(425) [2]=FZ(450) [3]=F3(475) [4]=F4(515)
  //   [5]=F5(550) [6]=FY(555) [7]=FXL(600) [8]=F6(640) [9]=F7(690)
  //   [10]=F8(745) [11]=NIR(855) [12]=Clear [13]=FD
  // Use all visible channels (0-10) for CIE integration, skip NIR/Clear/FD
  const channels = data.channels;
  if (channels && channels.length >= 11) {
    const wavelengths = [405, 425, 450, 475, 515, 550, 555, 600, 640, 690, 745];
    const values = channels.slice(0, 11);

    if (values.every((v) => v === 0)) return null;

    const bands = wavelengths.map((lambda, i) => ({ lambda, value: values[i] }));
    const xyz = spectralBandsToXYZ(bands);
    if (!xyz) return null;
    return xyzToColorResult(xyz.X, xyz.Y, xyz.Z);
  }

  // Fallback: use named fields (mapped by firmware to AS7341-compatible names)
  const wavelengths = [405, 425, 450, 515, 555, 600, 640, 690];
  const values = [
    data.f1_415nm ?? 0, // F1 (405nm)
    data.f2_445nm ?? 0, // F2 (425nm)
    data.f3_480nm ?? 0, // FZ (450nm)
    data.f4_515nm ?? 0, // F4 (515nm)
    data.f5_555nm ?? 0, // FY (555nm)
    data.f6_590nm ?? 0, // FXL (600nm)
    data.f7_630nm ?? 0, // F6 (640nm)
    data.f8_680nm ?? 0, // F7 (690nm)
  ];

  if (values.every((v) => v === 0)) return null;

  const bands = wavelengths.map((lambda, i) => ({ lambda, value: values[i] }));
  const xyz = spectralBandsToXYZ(bands);
  if (!xyz) return null;

  return xyzToColorResult(xyz.X, xyz.Y, xyz.Z);
}

/**
 * TCS34725: RGBC sensor → sRGB + Lab.
 *
 * The sensor has broadband R/G/B filters (not spectral). We normalize by the
 * clear channel to get relative reflectance, treat as linear sRGB, apply
 * gamma, then convert to Lab via XYZ.
 */
function convertTCS34725(data: SpectralPayload): ColorResult | null {
  const { r, g, b, c } = data;
  if (r == null || g == null || b == null || c == null || c === 0) return null;

  // Normalize by clear channel to get 0-1 reflectance
  const rn = clamp01(r / c);
  const gn = clamp01(g / c);
  const bn = clamp01(b / c);

  // Treat normalized values as linear sRGB, apply gamma for display
  const rs = linearToSrgb(rn);
  const gs = linearToSrgb(gn);
  const bs = linearToSrgb(bn);

  const r8 = Math.round(rs * 255);
  const g8 = Math.round(gs * 255);
  const b8 = Math.round(bs * 255);

  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  const hex = "#" + toHex(r8) + toHex(g8) + toHex(b8);

  // For Lab, go linear sRGB → XYZ → Lab
  // Use the normalized linear values directly (rn, gn, bn are already linear)
  const X = (rn * 0.4124564 + gn * 0.3575761 + bn * 0.1804375) * 100;
  const Y = (rn * 0.2126729 + gn * 0.7151522 + bn * 0.0721750) * 100;
  const Z = (rn * 0.0193339 + gn * 0.1191920 + bn * 0.9503041) * 100;

  const lab = xyzToLab(X, Y, Z);
  return {
    hex,
    r: r8,
    g: g8,
    b: b8,
    labL: Math.round(lab.L * 100) / 100,
    labA: Math.round(lab.a * 100) / 100,
    labB: Math.round(lab.b * 100) / 100,
  };
}

/**
 * OPT4048: Native CIE XYZ output → sRGB + Lab.
 *
 * The sensor outputs raw CIE XYZ tristimulus values directly.
 * We normalize so Y=100 (relative luminance).
 */
function convertOPT4048(data: SpectralPayload): ColorResult | null {
  const { cie_x, cie_y, cie_z } = data;
  if (cie_x == null || cie_y == null || cie_z == null) return null;
  if (cie_x === 0 && cie_y === 0 && cie_z === 0) return null;
  if (cie_y === 0) return null;

  const scale = 100 / cie_y;
  const X = cie_x * scale;
  const Y = 100;
  const Z = cie_z * scale;

  return xyzToColorResult(X, Y, Z);
}

/**
 * AS7265x: 18-channel triad spectral sensor → XYZ → sRGB + Lab.
 *
 * Three on-chip sensors covering UV + VIS + NIR:
 *   Channel center wavelengths (nm):
 *   410, 435, 460, 485, 510, 535, 560, 585, 610,
 *   645, 680, 705, 730, 760, 810, 860, 900, 940
 *
 * Only the first ~12 channels (410-705nm) contribute meaningfully to visible
 * color. Channels beyond 730nm are NIR and ignored for color computation.
 */
function convertAS7265x(data: SpectralPayload): ColorResult | null {
  const channels = data.channels;
  if (!channels || channels.length < 12) return null;
  if (channels.slice(0, 12).every((c) => c === 0)) return null;

  // All 18 center wavelengths
  const wavelengths = [410, 435, 460, 485, 510, 535, 560, 585, 610, 645, 680, 705, 730, 760, 810, 860, 900, 940];

  // Use visible channels (410-705nm) for color integration.
  // Channels beyond 705nm have negligible CIE observer response.
  const visibleCount = 12;
  const bands: { lambda: number; value: number }[] = [];
  for (let i = 0; i < visibleCount; i++) {
    bands.push({ lambda: wavelengths[i], value: channels[i] });
  }

  const xyz = spectralBandsToXYZ(bands);
  if (!xyz) return null;

  return xyzToColorResult(xyz.X, xyz.Y, xyz.Z);
}

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Convert spectral/sensor data from a firmware color payload to standard
 * color representations (hex, RGB 0-255, CIELAB).
 *
 * Returns null for UV-only sensors (AS7331) or invalid/missing data.
 */
export function spectralToColor(
  spectralData: Record<string, unknown>,
): ColorResult | null {
  if (!spectralData || !spectralData.sensor) return null;

  const data = spectralData as unknown as SpectralPayload;

  switch (data.sensor) {
    case "as7341":
      return convertAS7341(data);

    case "as7343":
      return convertAS7343(data);

    case "tcs34725":
      return convertTCS34725(data);

    case "opt4048":
      return convertOPT4048(data);

    case "as7265x":
      return convertAS7265x(data);

    case "as7331":
      // UV only — no visible color information
      return null;

    default:
      return null;
  }
}
