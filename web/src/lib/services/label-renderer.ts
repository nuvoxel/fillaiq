/**
 * Server-side label bitmap renderer for thermal printers.
 *
 * Renders label content as a 1-bit packed bitmap (MSB first) suitable for
 * direct streaming to Phomemo/ESC-POS thermal printers. No native image
 * dependencies -- uses a built-in 5x7 bitmap font and arithmetic drawing.
 *
 * Output format: each row is ceil(widthDots/8) bytes, MSB first.
 * 1 = black pixel (print), 0 = white pixel (no print).
 */

// ── 5x7 Bitmap Font ─────────────────────────────────────────────────────────
// Each character is 5 columns wide, 7 rows tall. Stored as 5 bytes per char,
// each byte is a column (bit 0 = top row, bit 6 = bottom row).

const FONT_5X7: Record<string, number[]> = {
  " ": [0x00, 0x00, 0x00, 0x00, 0x00],
  "!": [0x00, 0x00, 0x5f, 0x00, 0x00],
  '"': [0x00, 0x07, 0x00, 0x07, 0x00],
  "#": [0x14, 0x7f, 0x14, 0x7f, 0x14],
  $: [0x24, 0x2a, 0x7f, 0x2a, 0x12],
  "%": [0x23, 0x13, 0x08, 0x64, 0x62],
  "&": [0x36, 0x49, 0x55, 0x22, 0x50],
  "'": [0x00, 0x05, 0x03, 0x00, 0x00],
  "(": [0x00, 0x1c, 0x22, 0x41, 0x00],
  ")": [0x00, 0x41, 0x22, 0x1c, 0x00],
  "*": [0x14, 0x08, 0x3e, 0x08, 0x14],
  "+": [0x08, 0x08, 0x3e, 0x08, 0x08],
  ",": [0x00, 0x50, 0x30, 0x00, 0x00],
  "-": [0x08, 0x08, 0x08, 0x08, 0x08],
  ".": [0x00, 0x60, 0x60, 0x00, 0x00],
  "/": [0x20, 0x10, 0x08, 0x04, 0x02],
  "0": [0x3e, 0x51, 0x49, 0x45, 0x3e],
  "1": [0x00, 0x42, 0x7f, 0x40, 0x00],
  "2": [0x42, 0x61, 0x51, 0x49, 0x46],
  "3": [0x21, 0x41, 0x45, 0x4b, 0x31],
  "4": [0x18, 0x14, 0x12, 0x7f, 0x10],
  "5": [0x27, 0x45, 0x45, 0x45, 0x39],
  "6": [0x3c, 0x4a, 0x49, 0x49, 0x30],
  "7": [0x01, 0x71, 0x09, 0x05, 0x03],
  "8": [0x36, 0x49, 0x49, 0x49, 0x36],
  "9": [0x06, 0x49, 0x49, 0x29, 0x1e],
  ":": [0x00, 0x36, 0x36, 0x00, 0x00],
  ";": [0x00, 0x56, 0x36, 0x00, 0x00],
  "<": [0x08, 0x14, 0x22, 0x41, 0x00],
  "=": [0x14, 0x14, 0x14, 0x14, 0x14],
  ">": [0x00, 0x41, 0x22, 0x14, 0x08],
  "?": [0x02, 0x01, 0x51, 0x09, 0x06],
  "@": [0x32, 0x49, 0x79, 0x41, 0x3e],
  A: [0x7e, 0x11, 0x11, 0x11, 0x7e],
  B: [0x7f, 0x49, 0x49, 0x49, 0x36],
  C: [0x3e, 0x41, 0x41, 0x41, 0x22],
  D: [0x7f, 0x41, 0x41, 0x22, 0x1c],
  E: [0x7f, 0x49, 0x49, 0x49, 0x41],
  F: [0x7f, 0x09, 0x09, 0x09, 0x01],
  G: [0x3e, 0x41, 0x49, 0x49, 0x7a],
  H: [0x7f, 0x08, 0x08, 0x08, 0x7f],
  I: [0x00, 0x41, 0x7f, 0x41, 0x00],
  J: [0x20, 0x40, 0x41, 0x3f, 0x01],
  K: [0x7f, 0x08, 0x14, 0x22, 0x41],
  L: [0x7f, 0x40, 0x40, 0x40, 0x40],
  M: [0x7f, 0x02, 0x0c, 0x02, 0x7f],
  N: [0x7f, 0x04, 0x08, 0x10, 0x7f],
  O: [0x3e, 0x41, 0x41, 0x41, 0x3e],
  P: [0x7f, 0x09, 0x09, 0x09, 0x06],
  Q: [0x3e, 0x41, 0x51, 0x21, 0x5e],
  R: [0x7f, 0x09, 0x19, 0x29, 0x46],
  S: [0x46, 0x49, 0x49, 0x49, 0x31],
  T: [0x01, 0x01, 0x7f, 0x01, 0x01],
  U: [0x3f, 0x40, 0x40, 0x40, 0x3f],
  V: [0x1f, 0x20, 0x40, 0x20, 0x1f],
  W: [0x3f, 0x40, 0x38, 0x40, 0x3f],
  X: [0x63, 0x14, 0x08, 0x14, 0x63],
  Y: [0x07, 0x08, 0x70, 0x08, 0x07],
  Z: [0x61, 0x51, 0x49, 0x45, 0x43],
  "[": [0x00, 0x7f, 0x41, 0x41, 0x00],
  "\\": [0x02, 0x04, 0x08, 0x10, 0x20],
  "]": [0x00, 0x41, 0x41, 0x7f, 0x00],
  "^": [0x04, 0x02, 0x01, 0x02, 0x04],
  _: [0x40, 0x40, 0x40, 0x40, 0x40],
  "`": [0x00, 0x01, 0x02, 0x04, 0x00],
  a: [0x20, 0x54, 0x54, 0x54, 0x78],
  b: [0x7f, 0x48, 0x44, 0x44, 0x38],
  c: [0x38, 0x44, 0x44, 0x44, 0x20],
  d: [0x38, 0x44, 0x44, 0x48, 0x7f],
  e: [0x38, 0x54, 0x54, 0x54, 0x18],
  f: [0x08, 0x7e, 0x09, 0x01, 0x02],
  g: [0x0c, 0x52, 0x52, 0x52, 0x3e],
  h: [0x7f, 0x08, 0x04, 0x04, 0x78],
  i: [0x00, 0x44, 0x7d, 0x40, 0x00],
  j: [0x20, 0x40, 0x44, 0x3d, 0x00],
  k: [0x7f, 0x10, 0x28, 0x44, 0x00],
  l: [0x00, 0x41, 0x7f, 0x40, 0x00],
  m: [0x7c, 0x04, 0x18, 0x04, 0x78],
  n: [0x7c, 0x08, 0x04, 0x04, 0x78],
  o: [0x38, 0x44, 0x44, 0x44, 0x38],
  p: [0x7c, 0x14, 0x14, 0x14, 0x08],
  q: [0x08, 0x14, 0x14, 0x18, 0x7c],
  r: [0x7c, 0x08, 0x04, 0x04, 0x08],
  s: [0x48, 0x54, 0x54, 0x54, 0x20],
  t: [0x04, 0x3f, 0x44, 0x40, 0x20],
  u: [0x3c, 0x40, 0x40, 0x20, 0x7c],
  v: [0x1c, 0x20, 0x40, 0x20, 0x1c],
  w: [0x3c, 0x40, 0x30, 0x40, 0x3c],
  x: [0x44, 0x28, 0x10, 0x28, 0x44],
  y: [0x0c, 0x50, 0x50, 0x50, 0x3c],
  z: [0x44, 0x64, 0x54, 0x4c, 0x44],
  "{": [0x00, 0x08, 0x36, 0x41, 0x00],
  "|": [0x00, 0x00, 0x7f, 0x00, 0x00],
  "}": [0x00, 0x41, 0x36, 0x08, 0x00],
  "~": [0x10, 0x08, 0x08, 0x10, 0x10],
  "\xB0": [0x00, 0x06, 0x09, 0x09, 0x06], // degree symbol
};

// ── Drawing Primitives ──────────────────────────────────────────────────────

type Bitmap = {
  data: Buffer;
  width: number;
  height: number;
  bytesPerRow: number;
};

function createBitmap(width: number, height: number): Bitmap {
  const bytesPerRow = Math.ceil(width / 8);
  return {
    data: Buffer.alloc(bytesPerRow * height, 0x00),
    width,
    height,
    bytesPerRow,
  };
}

function setPixel(bmp: Bitmap, x: number, y: number) {
  if (x < 0 || x >= bmp.width || y < 0 || y >= bmp.height) return;
  const byteIdx = y * bmp.bytesPerRow + Math.floor(x / 8);
  const bitIdx = 7 - (x % 8);
  bmp.data[byteIdx] |= 1 << bitIdx;
}

function fillRect(
  bmp: Bitmap,
  x: number,
  y: number,
  w: number,
  h: number
) {
  for (let row = y; row < y + h; row++) {
    for (let col = x; col < x + w; col++) {
      setPixel(bmp, col, row);
    }
  }
}

function drawRect(
  bmp: Bitmap,
  x: number,
  y: number,
  w: number,
  h: number,
  lineWidth = 1
) {
  fillRect(bmp, x, y, w, lineWidth); // top
  fillRect(bmp, x, y + h - lineWidth, w, lineWidth); // bottom
  fillRect(bmp, x, y, lineWidth, h); // left
  fillRect(bmp, x + w - lineWidth, y, lineWidth, h); // right
}

function drawHLine(bmp: Bitmap, x: number, y: number, w: number) {
  fillRect(bmp, x, y, w, 1);
}

/**
 * Draw text using the 5x7 font at a given scale.
 * Returns the width in pixels of the drawn text.
 */
function drawText(
  bmp: Bitmap,
  x: number,
  y: number,
  text: string,
  scale: number = 1
): number {
  let curX = x;
  const charW = 5 * scale;
  const charH = 7 * scale;
  const spacing = scale; // 1px gap at scale 1

  for (const ch of text) {
    const glyph = FONT_5X7[ch] ?? FONT_5X7["?"];
    if (!glyph) {
      curX += charW + spacing;
      continue;
    }

    for (let col = 0; col < 5; col++) {
      const colBits = glyph[col];
      for (let row = 0; row < 7; row++) {
        if (colBits & (1 << row)) {
          // Scale up the pixel
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              setPixel(bmp, curX + col * scale + sx, y + row * scale + sy);
            }
          }
        }
      }
    }
    curX += charW + spacing;
  }

  return curX - x;
}

/** Measure text width without drawing */
function measureText(text: string, scale: number): number {
  const charW = 5 * scale;
  const spacing = scale;
  return text.length * (charW + spacing) - spacing;
}

/**
 * Draw a filled circle (for color swatch).
 */
function fillCircle(
  bmp: Bitmap,
  cx: number,
  cy: number,
  r: number
) {
  for (let y = -r; y <= r; y++) {
    for (let x = -r; x <= r; x++) {
      if (x * x + y * y <= r * r) {
        setPixel(bmp, cx + x, cy + y);
      }
    }
  }
}

/**
 * Draw a circle outline (for color swatch border).
 */
function drawCircle(
  bmp: Bitmap,
  cx: number,
  cy: number,
  r: number,
  lineWidth = 1
) {
  for (let y = -r - lineWidth; y <= r + lineWidth; y++) {
    for (let x = -r - lineWidth; x <= r + lineWidth; x++) {
      const d2 = x * x + y * y;
      const outer = (r + lineWidth) * (r + lineWidth);
      const inner = (r - lineWidth) * (r - lineWidth);
      if (d2 <= outer && d2 >= inner) {
        setPixel(bmp, cx + x, cy + y);
      }
    }
  }
}

// ── Color swatch rendering ──────────────────────────────────────────────────
// For thermal printers, we approximate the color swatch with a pattern:
// - Dark colors (luminance < 0.4): filled circle
// - Medium colors: half-filled / hatched circle
// - Light colors: outline only with crosshatch

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = hex.match(/^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return null;
  return {
    r: parseInt(m[1], 16),
    g: parseInt(m[2], 16),
    b: parseInt(m[3], 16),
  };
}

function luminance(r: number, g: number, b: number): number {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

function drawColorSwatch(
  bmp: Bitmap,
  cx: number,
  cy: number,
  r: number,
  colorHex?: string
) {
  const rgb = colorHex ? hexToRgb(colorHex) : null;
  const lum = rgb ? luminance(rgb.r, rgb.g, rgb.b) : 0.5;

  if (lum < 0.3) {
    // Dark: filled circle
    fillCircle(bmp, cx, cy, r);
  } else if (lum < 0.6) {
    // Medium: circle with diagonal hatching
    drawCircle(bmp, cx, cy, r, 2);
    // Diagonal lines inside
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) {
        if (x * x + y * y <= (r - 2) * (r - 2)) {
          if ((x + y) % 3 === 0) {
            setPixel(bmp, cx + x, cy + y);
          }
        }
      }
    }
  } else {
    // Light: outline only
    drawCircle(bmp, cx, cy, r, 2);
  }
}

// ── Label Renderer ──────────────────────────────────────────────────────────

export type LabelData = {
  brand?: string;
  material?: string;
  productName?: string;
  colorHex?: string;
  colorName?: string;
  nozzleTempMin?: number;
  nozzleTempMax?: number;
  bedTemp?: number;
  weight?: string;
  location?: string;
};

export type LabelSettings = {
  widthMm: number;
  heightMm: number;
  showBrand: boolean;
  showMaterial: boolean;
  showColor: boolean;
  showColorSwatch: boolean;
  showTemps: boolean;
  showQrCode: boolean;
  showWeight: boolean;
  showLocation: boolean;
  showPrice: boolean;
};

export function renderLabelBitmap(
  data: LabelData,
  settings: LabelSettings,
  widthDots: number,
  dpi: number
): { bitmap: Buffer; widthPx: number; heightPx: number; bytesPerRow: number } {
  const dotsPerMm = dpi / 25.4;
  const heightDots = Math.round(settings.heightMm * dotsPerMm);

  const bmp = createBitmap(widthDots, heightDots);

  // Margins
  const marginX = Math.round(widthDots * 0.03);
  const marginY = Math.round(heightDots * 0.05);
  const contentW = widthDots - marginX * 2;

  // Font scale calculation based on printer width
  // At 384 dots (48mm @ 203dpi), scale 2 gives readable 10x14 pixel chars
  const baseScale = Math.max(1, Math.round(widthDots / 192));
  const largeScale = baseScale + 1;
  const smallScale = Math.max(1, baseScale - 1);

  const lineH = 7 * baseScale + 4; // line height for base text
  const largeLineH = 7 * largeScale + 6;

  let curY = marginY;

  // ── Color swatch + Brand + Material (top section) ─────────────────────
  const swatchSize = settings.showColorSwatch
    ? Math.round(Math.min(heightDots * 0.25, widthDots * 0.1))
    : 0;
  const textStartX = settings.showColorSwatch
    ? marginX + swatchSize * 2 + 8
    : marginX;

  if (settings.showColorSwatch && swatchSize > 4) {
    drawColorSwatch(
      bmp,
      marginX + swatchSize,
      curY + swatchSize,
      swatchSize,
      data.colorHex
    );
  }

  if (settings.showBrand && data.brand) {
    drawText(bmp, textStartX, curY, data.brand.toUpperCase(), largeScale);
    curY += largeLineH;
  }

  if (settings.showMaterial && data.material) {
    drawText(bmp, textStartX, curY, data.material, baseScale);
    curY += lineH;
  }

  // Ensure curY is past the swatch
  if (settings.showColorSwatch) {
    curY = Math.max(curY, marginY + swatchSize * 2 + 4);
  }

  // Separator line
  drawHLine(bmp, marginX, curY, contentW);
  curY += 4;

  // ── Temperature info ──────────────────────────────────────────────────
  if (settings.showTemps) {
    let tempStr = "";
    if (data.nozzleTempMin && data.nozzleTempMax) {
      tempStr += `${data.nozzleTempMin}-${data.nozzleTempMax}C`;
    } else if (data.nozzleTempMin) {
      tempStr += `${data.nozzleTempMin}C`;
    }
    if (data.bedTemp) {
      if (tempStr) tempStr += "  ";
      tempStr += `Bed ${data.bedTemp}C`;
    }
    if (tempStr) {
      drawText(bmp, marginX, curY, tempStr, baseScale);
      curY += lineH;
    }
  }

  // ── Weight ────────────────────────────────────────────────────────────
  if (settings.showWeight && data.weight) {
    drawText(bmp, marginX, curY, data.weight, largeScale);
    curY += largeLineH;
  }

  // ── Color name ────────────────────────────────────────────────────────
  if (settings.showColor && data.colorName) {
    drawText(bmp, marginX, curY, data.colorName, smallScale);
    curY += 7 * smallScale + 4;
  }

  // ── Location ──────────────────────────────────────────────────────────
  if (settings.showLocation && data.location) {
    drawText(bmp, marginX, curY, data.location, smallScale);
    curY += 7 * smallScale + 4;
  }

  // ── Bottom border ─────────────────────────────────────────────────────
  // Draw a thin border around the whole label for cut alignment
  drawRect(bmp, 0, 0, widthDots, heightDots, 1);

  return {
    bitmap: bmp.data,
    widthPx: widthDots,
    heightPx: heightDots,
    bytesPerRow: bmp.bytesPerRow,
  };
}

/**
 * Convert a 1-bit packed bitmap (MSB first) to a BMP file.
 *
 * BMP 1-bit format is natively supported by all browsers, so this needs
 * zero external dependencies. The color table maps 0 = white, 1 = black
 * to match the thermal printer convention (1 = print = black).
 *
 * BMP rows are stored bottom-to-top and padded to 4-byte boundaries.
 */
export function convertBitmapToBmp(
  bitmap: Buffer,
  widthPx: number,
  heightPx: number,
  bytesPerRow: number
): Buffer {
  // BMP row stride: must be a multiple of 4 bytes
  const bmpRowStride = Math.ceil(widthPx / 8);
  const bmpRowPadded = Math.ceil(bmpRowStride / 4) * 4;
  const pixelDataSize = bmpRowPadded * heightPx;

  // File structure sizes
  const fileHeaderSize = 14;
  const dibHeaderSize = 40;
  const colorTableSize = 8; // 2 colors x 4 bytes (BGRA)
  const pixelDataOffset = fileHeaderSize + dibHeaderSize + colorTableSize;
  const fileSize = pixelDataOffset + pixelDataSize;

  const buf = Buffer.alloc(fileSize, 0);

  // ── BMP File Header (14 bytes) ──
  buf.write("BM", 0); // signature
  buf.writeUInt32LE(fileSize, 2); // file size
  buf.writeUInt32LE(0, 6); // reserved
  buf.writeUInt32LE(pixelDataOffset, 10); // pixel data offset

  // ── DIB Header (BITMAPINFOHEADER, 40 bytes) ──
  buf.writeUInt32LE(dibHeaderSize, 14); // header size
  buf.writeInt32LE(widthPx, 18); // width
  buf.writeInt32LE(heightPx, 22); // height (positive = bottom-up)
  buf.writeUInt16LE(1, 26); // color planes
  buf.writeUInt16LE(1, 28); // bits per pixel
  buf.writeUInt32LE(0, 30); // compression (none)
  buf.writeUInt32LE(pixelDataSize, 34); // image size
  buf.writeInt32LE(3780, 38); // x pixels per meter (~96 dpi)
  buf.writeInt32LE(3780, 42); // y pixels per meter
  buf.writeUInt32LE(2, 46); // colors used
  buf.writeUInt32LE(2, 50); // important colors

  // ── Color Table (2 entries, BGRA) ──
  // Index 0 = white (pixel value 0 = no print)
  buf.writeUInt32LE(0x00ffffff, 54); // BGRA white
  // Index 1 = black (pixel value 1 = print)
  buf.writeUInt32LE(0x00000000, 58); // BGRA black

  // ── Pixel Data (bottom-up) ──
  for (let y = 0; y < heightPx; y++) {
    // BMP stores rows bottom-to-top
    const bmpRow = heightPx - 1 - y;
    const srcOffset = y * bytesPerRow;
    const dstOffset = pixelDataOffset + bmpRow * bmpRowPadded;
    // Copy the row bytes (source bytesPerRow may differ from bmpRowStride)
    const copyLen = Math.min(bytesPerRow, bmpRowStride);
    bitmap.copy(buf, dstOffset, srcOffset, srcOffset + copyLen);
  }

  return buf;
}
