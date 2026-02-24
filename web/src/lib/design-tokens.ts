/** Design tokens shared across web + future React Native / firmware */

export const colors = {
  action: {
    create: { DEFAULT: "#16A34A", bg: "#F0FDF4" },
    update: { DEFAULT: "#2563EB", bg: "#EFF6FF" },
    delete: { DEFAULT: "#DC2626", bg: "#FEF2F2" },
    review: { DEFAULT: "#9333EA", bg: "#FAF5FF" },
    login: { DEFAULT: "#0891B2", bg: "#ECFEFF" },
    logout: { DEFAULT: "#6B7280", bg: "#F3F4F6" },
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
