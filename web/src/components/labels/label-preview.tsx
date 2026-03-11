"use client";

import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export type LabelPreviewData = {
  brand?: string;
  material?: string;
  color?: string;
  nozzleTemp?: string;
  bedTemp?: string;
  weight?: string;
  location?: string;
  price?: string;
  purchaseDate?: string;
  lotNumber?: string;
};

export type LabelPreviewSettings = {
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
  showPurchaseDate: boolean;
  showLotNumber: boolean;
};

const SAMPLE_DATA: LabelPreviewData = {
  brand: "Bambu Lab",
  material: "PLA Basic",
  color: "#1A1A1A",
  nozzleTemp: "215\u00b0C",
  bedTemp: "60\u00b0C",
  weight: "742g",
  location: "Shelf A-3",
  price: "$18.99",
  purchaseDate: "2026-01-15",
  lotNumber: "BL-2026-0142",
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
        {/* Top row: Brand + Color swatch */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {settings.showColorSwatch && (
            <Box
              sx={{
                width: compact ? 16 : 28,
                height: compact ? 16 : 28,
                borderRadius: "50%",
                bgcolor: swatchColor,
                border: "2px solid",
                borderColor: "grey.300",
                flexShrink: 0,
              }}
            />
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {settings.showBrand && (
              <Typography
                sx={{
                  fontSize: compact ? 9 : 14,
                  fontWeight: 700,
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  color: "#111",
                }}
              >
                {data.brand}
              </Typography>
            )}
            {settings.showMaterial && (
              <Typography
                sx={{
                  fontSize: compact ? 8 : 12,
                  fontWeight: 500,
                  lineHeight: 1.2,
                  color: "#444",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {data.material}
              </Typography>
            )}
          </Box>
        </Box>

        {/* Color name */}
        {settings.showColor && (
          <Typography
            sx={{
              fontSize: compact ? 7 : 10,
              color: "#666",
              lineHeight: 1.2,
            }}
          >
            Color: {data.color}
          </Typography>
        )}

        {/* Middle info section */}
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            gap: compact ? 0.25 : 0.75,
            flex: 1,
            alignContent: "flex-start",
          }}
        >
          {settings.showTemps && (
            <InfoChip
              label={`${data.nozzleTemp} / ${data.bedTemp}`}
              compact={compact}
            />
          )}
          {settings.showWeight && (
            <InfoChip label={data.weight ?? ""} compact={compact} bold />
          )}
          {settings.showLocation && data.location && (
            <InfoChip label={data.location} compact={compact} />
          )}
          {settings.showPrice && data.price && (
            <InfoChip label={data.price} compact={compact} />
          )}
          {settings.showPurchaseDate && data.purchaseDate && (
            <InfoChip label={data.purchaseDate} compact={compact} />
          )}
          {settings.showLotNumber && data.lotNumber && (
            <InfoChip label={`Lot: ${data.lotNumber}`} compact={compact} />
          )}
        </Box>

        {/* QR code placeholder — bottom-right */}
        {settings.showQrCode && (
          <Box
            sx={{
              position: "absolute",
              bottom: compact ? 4 : 8,
              right: compact ? 4 : 8,
              width: compact ? 24 : 44,
              height: compact ? 24 : 44,
              border: "1.5px solid #999",
              borderRadius: 0.5,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              bgcolor: "#fafafa",
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
  );
}

function InfoChip({
  label,
  compact,
  bold,
}: {
  label: string;
  compact: boolean;
  bold?: boolean;
}) {
  return (
    <Box
      sx={{
        px: compact ? 0.5 : 1,
        py: compact ? 0 : 0.25,
        borderRadius: 0.5,
        bgcolor: "#f4f4f5",
        border: "1px solid #e4e4e7",
      }}
    >
      <Typography
        sx={{
          fontSize: compact ? 7 : 10,
          fontWeight: bold ? 700 : 500,
          color: "#333",
          lineHeight: 1.4,
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </Typography>
    </Box>
  );
}
