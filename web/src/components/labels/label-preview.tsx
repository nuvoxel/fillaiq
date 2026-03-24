"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export type LabelPreviewData = {
  brand?: string;
  brandLogoUrl?: string;
  material?: string;
  color?: string;
  colorName?: string;
  nozzleTemp?: string;
  bedTemp?: string;
  dryingInfo?: string;
  flowRatio?: string;
  td?: string;
  weight?: string;
  location?: string;
  price?: string;
  purchaseDate?: string;
  lotNumber?: string;
  filamentId?: string;
};

export type LabelPreviewSettings = {
  widthMm: number;
  heightMm: number;
  showBrand: boolean;
  showMaterial: boolean;
  showColor: boolean;
  showColorSwatch: boolean;
  showTemps: boolean;
  showDryingInfo: boolean;
  showQrCode: boolean;
  showWeight: boolean;
  showLocation: boolean;
  showPrice: boolean;
  showPurchaseDate: boolean;
  showLotNumber: boolean;
  showFilamentId: boolean;
};

const SAMPLE_DATA: LabelPreviewData = {
  brand: "Bambu Lab",
  brandLogoUrl: undefined,
  material: "PLA Basic",
  color: "#1A1A1A",
  colorName: "Black",
  nozzleTemp: "190\u2013220\u00b0C",
  bedTemp: "50\u201365\u00b0C",
  dryingInfo: "55\u00b0C / 4h",
  flowRatio: "0.96",
  weight: "742g",
  location: "Shelf A-3",
  price: "$18.99",
  purchaseDate: "2026-01-15",
  lotNumber: "BL-2026-0142",
  filamentId: "108",
};

/** Scale factor: 1mm = this many CSS px in the preview */
const PX_PER_MM = 4;

export function LabelPreview({
  settings,
  data = SAMPLE_DATA,
  maxWidth,
}: {
  settings: LabelPreviewSettings;
  data?: LabelPreviewData;
  maxWidth?: number;
}) {
  const naturalW = settings.widthMm * PX_PER_MM;
  const naturalH = settings.heightMm * PX_PER_MM;

  // Scale down to fit container if needed
  const scale =
    maxWidth && naturalW > maxWidth ? maxWidth / naturalW : 1;
  const displayW = naturalW * scale;
  const displayH = naturalH * scale;

  const isLandscape = settings.widthMm >= settings.heightMm;
  const compact = settings.widthMm <= 30 || settings.heightMm <= 30;

  // Determine a readable text color that contrasts with the swatch color
  const swatchColor = data.color ?? "#1A1A1A";

  return (
    <Box
      sx={{
        width: displayW,
        height: displayH,
        border: "1px dashed",
        borderColor: "divider",
        borderRadius: 1,
        overflow: "hidden",
        bgcolor: "#fff",
        position: "relative",
        mx: "auto",
      }}
    >
      <Box
        sx={{
          width: naturalW,
          height: naturalH,
          transform: scale < 1 ? `scale(${scale})` : undefined,
          transformOrigin: "top left",
          display: "flex",
          flexDirection: "column",
          p: compact ? 0.5 : 1.5,
          gap: compact ? 0.25 : 0.5,
          fontFamily: "'Inter', 'Roboto', sans-serif",
        }}
      >
        {/* ── Row 1: Brand (logo or text) + Color hex ── */}
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
          {settings.showBrand && (
            data.brandLogoUrl ? (
              <Box
                component="img"
                src={data.brandLogoUrl}
                alt={data.brand}
                sx={{
                  height: compact ? 14 : 22,
                  maxWidth: "65%",
                  objectFit: "contain",
                  objectPosition: "left",
                  flex: 1,
                  minWidth: 0,
                }}
              />
            ) : (
              <Typography
                sx={{
                  fontSize: compact ? 10 : 16,
                  fontWeight: 800,
                  lineHeight: 1.1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#111",
                  letterSpacing: "-0.02em",
                  flex: 1,
                  minWidth: 0,
                }}
              >
                {data.brand}
              </Typography>
            )
          )}
          {settings.showColor && data.color && (
            <Typography
              sx={{
                fontSize: compact ? 6 : 9,
                fontWeight: 500,
                color: "#666",
                fontFamily: "monospace",
                flexShrink: 0,
                ml: 0.5,
                mt: compact ? 0.25 : 0.5,
              }}
            >
              {data.color}
            </Typography>
          )}
        </Box>

        {/* ── Row 2: Material on dark strip ── */}
        {settings.showMaterial && (
          <Box
            sx={{
              bgcolor: "#1a1a1a",
              color: "#fff",
              px: compact ? 0.5 : 1,
              py: compact ? 0 : 0.15,
              mx: compact ? -0.5 : -1.5,
              display: "inline-flex",
              alignSelf: "flex-start",
              maxWidth: "75%",
            }}
          >
            <Typography
              sx={{
                fontSize: compact ? 7 : 11,
                fontWeight: 700,
                lineHeight: 1.3,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {data.material}
            </Typography>
          </Box>
        )}

        {/* ── Row 3: Color name ── */}
        {(settings.showColor && data.colorName) && (
          <Typography
            sx={{
              fontSize: compact ? 8 : 13,
              fontWeight: 600,
              color: "#222",
              lineHeight: 1.2,
            }}
          >
            {data.colorName}
          </Typography>
        )}

        {/* ── Bottom section: Info fields + QR code ── */}
        <Box sx={{ display: "flex", flex: 1, alignItems: "flex-end", mt: "auto" }}>
          {/* Left column: key-value pairs */}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            {settings.showTemps && data.nozzleTemp && (
              <InfoRow label="Nozzle:" value={data.nozzleTemp} compact={compact} />
            )}
            {settings.showTemps && data.bedTemp && (
              <InfoRow label="Bed:" value={data.bedTemp} compact={compact} />
            )}
            {settings.showDryingInfo && data.dryingInfo && (
              <InfoRow label="Drying Info:" value={data.dryingInfo} compact={compact} />
            )}
            {data.flowRatio && (
              <InfoRow label="Flow Ratio:" value={data.flowRatio} compact={compact} />
            )}
            {data.td && (
              <InfoRow label="TD:" value={data.td} compact={compact} />
            )}
            {settings.showFilamentId && data.filamentId && (
              <InfoRow label="Filament ID:" value={data.filamentId} compact={compact} />
            )}
            {settings.showWeight && data.weight && (
              <InfoRow label="Weight:" value={data.weight} compact={compact} />
            )}
            {settings.showLocation && data.location && (
              <InfoRow label="Location:" value={data.location} compact={compact} />
            )}
            {settings.showPrice && data.price && (
              <InfoRow label="Price:" value={data.price} compact={compact} />
            )}
            {settings.showLotNumber && data.lotNumber && (
              <InfoRow label="Lot:" value={data.lotNumber} compact={compact} />
            )}
          </Box>

          {/* Right: QR code */}
          {settings.showQrCode && (
            <Box
              sx={{
                width: compact ? 24 : 44,
                height: compact ? 24 : 44,
                border: "1.5px solid #999",
                borderRadius: 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "#fafafa",
                flexShrink: 0,
                ml: 0.5,
              }}
            >
              <Typography
                sx={{
                  fontSize: compact ? 6 : 9,
                  fontWeight: 600,
                  color: "#999",
                  userSelect: "none",
                }}
              >
                QR
              </Typography>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

function InfoRow({
  label,
  value,
  compact,
}: {
  label: string;
  value: string;
  compact: boolean;
}) {
  return (
    <Box sx={{ display: "flex", gap: compact ? 0.25 : 0.5, lineHeight: 1 }}>
      <Typography
        sx={{
          fontSize: compact ? 6 : 9,
          fontWeight: 500,
          color: "#666",
          lineHeight: 1.4,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Typography>
      <Typography
        sx={{
          fontSize: compact ? 6 : 9,
          fontWeight: 600,
          color: "#333",
          lineHeight: 1.4,
          whiteSpace: "nowrap",
        }}
      >
        {value}
      </Typography>
    </Box>
  );
}
