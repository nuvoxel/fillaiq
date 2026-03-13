"use client";

import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import OpacityIcon from "@mui/icons-material/Opacity";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ColorDetailsProps {
  colorHex?: string | null;
  colorName?: string | null;
  colorR?: number | null;
  colorG?: number | null;
  colorB?: number | null;
  colorLabL?: number | null;
  colorLabA?: number | null;
  colorLabB?: number | null;
  closestPantone?: string | null;
  closestRal?: string | null;
  closestPms?: string | null;
  colorParent?: string | null;
  multiColorHexes?: string[] | null;
  multiColorDirection?: string | null;
  translucent?: boolean | null;
  glow?: boolean | null;
  finish?: string | null;
  pattern?: string | null;
  transmissionDistance?: number | null;
  tdVoteCount?: number | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Returns black or white depending on which contrasts better with the given hex. */
function contrastText(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  // W3C relative luminance
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "#000" : "#fff";
}

/** Normalise a hex value to always start with # */
function normaliseHex(hex: string): string {
  return hex.startsWith("#") ? hex : `#${hex}`;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function ColorSwatch({ hex, size = 64 }: { hex: string; size?: number }) {
  const normalised = normaliseHex(hex);
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: 2,
        backgroundColor: normalised,
        border: "1px solid",
        borderColor: "divider",
        flexShrink: 0,
      }}
    />
  );
}

function MultiColorSwatches({
  hexes,
  direction,
}: {
  hexes: string[];
  direction?: string | null;
}) {
  if (direction === "coaxial") {
    // Concentric circles
    const outerSize = 48;
    const step = outerSize / (hexes.length + 1);
    return (
      <Box sx={{ position: "relative", width: outerSize, height: outerSize }}>
        {hexes.map((hex, i) => {
          const size = outerSize - i * step;
          const offset = (outerSize - size) / 2;
          return (
            <Box
              key={i}
              sx={{
                position: "absolute",
                top: offset,
                left: offset,
                width: size,
                height: size,
                borderRadius: "50%",
                backgroundColor: normaliseHex(hex),
                border: "1px solid",
                borderColor: "divider",
              }}
            />
          );
        })}
      </Box>
    );
  }

  // Longitudinal (side-by-side gradient) — default
  return (
    <Stack direction="row" spacing={0.5} alignItems="center">
      {hexes.map((hex, i) => (
        <Box key={i} sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box
            sx={{
              width: 24,
              height: 24,
              borderRadius: 1,
              backgroundColor: normaliseHex(hex),
              border: "1px solid",
              borderColor: "divider",
            }}
          />
          {i < hexes.length - 1 && (
            <ArrowForwardIcon sx={{ fontSize: 14, color: "text.disabled" }} />
          )}
        </Box>
      ))}
    </Stack>
  );
}

function TransmissionDistanceBar({
  value,
  voteCount,
}: {
  value: number;
  voteCount?: number | null;
}) {
  const maxTd = 200;
  const percent = Math.min((value / maxTd) * 100, 100);

  return (
    <Box sx={{ width: "100%" }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
        sx={{ mb: 0.5 }}
      >
        <Typography variant="caption" color="text.secondary">
          Transmission Distance
        </Typography>
        <Stack direction="row" spacing={0.5} alignItems="baseline">
          <Typography variant="body2" fontWeight={600}>
            {value.toFixed(1)} mm
          </Typography>
          {voteCount != null && voteCount > 0 && (
            <Typography variant="caption" color="text.secondary">
              ({voteCount} vote{voteCount !== 1 ? "s" : ""})
            </Typography>
          )}
        </Stack>
      </Stack>
      <Tooltip
        title={`${value.toFixed(1)} mm — ${percent < 25 ? "opaque" : percent < 60 ? "semi-translucent" : "translucent"}`}
      >
        <Box sx={{ position: "relative" }}>
          <LinearProgress
            variant="determinate"
            value={percent}
            sx={{
              height: 10,
              borderRadius: 1,
              backgroundColor: "grey.300",
              "& .MuiLinearProgress-bar": {
                borderRadius: 1,
                background: `linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(255,255,255,0.3) 100%)`,
              },
            }}
          />
          {/* Scale labels */}
          <Stack
            direction="row"
            justifyContent="space-between"
            sx={{ mt: 0.25 }}
          >
            <Typography variant="caption" color="text.disabled" fontSize={10}>
              0 (opaque)
            </Typography>
            <Typography variant="caption" color="text.disabled" fontSize={10}>
              200 mm (translucent)
            </Typography>
          </Stack>
        </Box>
      </Tooltip>
    </Box>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function ColorDetails(props: ColorDetailsProps) {
  const {
    colorHex,
    colorName,
    colorR,
    colorG,
    colorB,
    colorLabL,
    colorLabA,
    colorLabB,
    closestPantone,
    closestRal,
    closestPms,
    colorParent,
    multiColorHexes,
    multiColorDirection,
    translucent,
    glow,
    finish,
    pattern,
    transmissionDistance,
    tdVoteCount,
  } = props;

  const hasColor = colorHex || (colorR != null && colorG != null && colorB != null);
  const hasLab = colorLabL != null && colorLabA != null && colorLabB != null;
  const hasIndustry = closestPantone || closestRal || closestPms;
  const hasMultiColor = multiColorHexes && multiColorHexes.length > 0;
  const hasProperties = translucent || glow || finish || pattern;
  const hasTd = transmissionDistance != null;

  if (
    !hasColor &&
    !hasLab &&
    !hasIndustry &&
    !hasMultiColor &&
    !hasProperties &&
    !hasTd &&
    !colorParent &&
    !colorName
  ) {
    return null;
  }

  const displayHex = colorHex
    ? normaliseHex(colorHex)
    : colorR != null && colorG != null && colorB != null
      ? `#${colorR.toString(16).padStart(2, "0")}${colorG.toString(16).padStart(2, "0")}${colorB.toString(16).padStart(2, "0")}`
      : null;

  return (
    <Stack spacing={2}>
      {/* ── Swatch + Name + Hex ──────────────────────────────────── */}
      {(displayHex || colorName) && (
        <Stack direction="row" spacing={2} alignItems="center">
          {displayHex && <ColorSwatch hex={displayHex} />}
          <Stack spacing={0.25}>
            {colorName && (
              <Typography variant="subtitle1" fontWeight={600}>
                {colorName}
              </Typography>
            )}
            {displayHex && (
              <Typography
                variant="body2"
                fontFamily="monospace"
                color="text.secondary"
              >
                {displayHex.toUpperCase()}
              </Typography>
            )}
          </Stack>
        </Stack>
      )}

      {/* ── RGB row ──────────────────────────────────────────────── */}
      {colorR != null && colorG != null && colorB != null && (
        <Stack direction="row" spacing={2}>
          <Typography variant="caption" color="text.secondary">
            R: {colorR}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            G: {colorG}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            B: {colorB}
          </Typography>
        </Stack>
      )}

      {/* ── Lab row ──────────────────────────────────────────────── */}
      {hasLab && (
        <Stack direction="row" spacing={2}>
          <Typography variant="caption" color="text.secondary">
            L*: {colorLabL!.toFixed(1)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            a*: {colorLabA!.toFixed(1)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            b*: {colorLabB!.toFixed(1)}
          </Typography>
        </Stack>
      )}

      {/* ── Industry matches ─────────────────────────────────────── */}
      {hasIndustry && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {closestPantone && (
            <Chip label={`Pantone ${closestPantone}`} size="small" />
          )}
          {closestRal && <Chip label={`RAL ${closestRal}`} size="small" />}
          {closestPms && <Chip label={`PMS ${closestPms}`} size="small" />}
        </Stack>
      )}

      {/* ── Color parent ─────────────────────────────────────────── */}
      {colorParent && (
        <Chip
          label={colorParent}
          size="small"
          variant="outlined"
          sx={{ alignSelf: "flex-start" }}
        />
      )}

      {/* ── Multi-color ──────────────────────────────────────────── */}
      {hasMultiColor && (
        <Stack spacing={0.5}>
          <Typography variant="caption" color="text.secondary">
            Multi-color
            {multiColorDirection ? ` (${multiColorDirection})` : ""}
          </Typography>
          <MultiColorSwatches
            hexes={multiColorHexes!}
            direction={multiColorDirection}
          />
        </Stack>
      )}

      {/* ── Properties row ───────────────────────────────────────── */}
      {hasProperties && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {translucent && (
            <Chip
              icon={<OpacityIcon />}
              label="Translucent"
              size="small"
              variant="outlined"
            />
          )}
          {glow && (
            <Chip
              icon={<LightbulbIcon />}
              label="Glow"
              size="small"
              variant="outlined"
              color="warning"
            />
          )}
          {finish && (
            <Chip
              label={finish.charAt(0).toUpperCase() + finish.slice(1)}
              size="small"
              variant="outlined"
            />
          )}
          {pattern && pattern !== "solid" && (
            <Chip
              label={pattern.charAt(0).toUpperCase() + pattern.slice(1)}
              size="small"
              variant="outlined"
            />
          )}
        </Stack>
      )}

      {/* ── Transmission distance ────────────────────────────────── */}
      {hasTd && (
        <TransmissionDistanceBar
          value={transmissionDistance!}
          voteCount={tdVoteCount}
        />
      )}
    </Stack>
  );
}
