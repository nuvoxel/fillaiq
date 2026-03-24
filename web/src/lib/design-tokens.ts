/** Design tokens shared across web + future React Native / firmware */

export const colors = {
  /* Modern Maker palette */
  makerCyan: "#00D2FF",
  liveGreen: "#00E676",
  alertRose: "#FF2A5F",
  signalOrange: "#FF7A00",
  blueprintSlate: "#1A2530",
  toolGray: "#94A3B8",
  softGround: "#F4F6F8",
  deepWorkshop: "#0F1F23",

  action: {
    create: { DEFAULT: "#00E676", bg: "#E8FFF0" },
    update: { DEFAULT: "#00D2FF", bg: "#E0F7FF" },
    delete: { DEFAULT: "#FF2A5F", bg: "#FFF0F3" },
    review: { DEFAULT: "#9333EA", bg: "#FAF5FF" },
    login: { DEFAULT: "#00D2FF", bg: "#E0F7FF" },
    logout: { DEFAULT: "#94A3B8", bg: "#F1F5F9" },
  },
} as const;

export type AuditAction = keyof typeof colors.action;

/** Convert hex color to RGB565 for TFT displays (firmware reference) */
export function hexToRgb565(hex: string): number {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return ((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3);
}
