"use client";

import { Droplets, Lightbulb, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";

// Types

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

// Helpers

function normaliseHex(hex: string): string {
  return hex.startsWith("#") ? hex : `#${hex}`;
}

// Sub-components

function ColorSwatch({ hex, size = 64 }: { hex: string; size?: number }) {
  const normalised = normaliseHex(hex);
  return (
    <div
      className="shrink-0 rounded-lg border border-border"
      style={{
        width: size,
        height: size,
        backgroundColor: normalised,
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
    const outerSize = 48;
    const step = outerSize / (hexes.length + 1);
    return (
      <div className="relative" style={{ width: outerSize, height: outerSize }}>
        {hexes.map((hex, i) => {
          const size = outerSize - i * step;
          const offset = (outerSize - size) / 2;
          return (
            <div
              key={i}
              className="absolute rounded-full border border-border"
              style={{
                top: offset,
                left: offset,
                width: size,
                height: size,
                backgroundColor: normaliseHex(hex),
              }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1">
      {hexes.map((hex, i) => (
        <div key={i} className="flex items-center gap-1">
          <div
            className="w-6 h-6 rounded border border-border"
            style={{ backgroundColor: normaliseHex(hex) }}
          />
          {i < hexes.length - 1 && (
            <ArrowRight className="size-3.5 text-muted-foreground/50" />
          )}
        </div>
      ))}
    </div>
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
    <div className="w-full">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-xs text-muted-foreground">
          Transmission Distance
        </span>
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-semibold">
            {value.toFixed(1)} mm
          </span>
          {voteCount != null && voteCount > 0 && (
            <span className="text-xs text-muted-foreground">
              ({voteCount} vote{voteCount !== 1 ? "s" : ""})
            </span>
          )}
        </div>
      </div>
      <Tooltip>
        <TooltipTrigger className="w-full">
          <div className="relative">
            <div className="h-2.5 w-full rounded bg-muted overflow-hidden">
              <div
                className="h-full rounded"
                style={{
                  width: `${percent}%`,
                  background: "linear-gradient(90deg, rgba(0,0,0,0.85) 0%, rgba(255,255,255,0.3) 100%)",
                }}
              />
            </div>
            <div className="flex justify-between mt-0.5">
              <span className="text-[10px] text-muted-foreground/50">
                0 (opaque)
              </span>
              <span className="text-[10px] text-muted-foreground/50">
                200 mm (translucent)
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          {value.toFixed(1)} mm &mdash; {percent < 25 ? "opaque" : percent < 60 ? "semi-translucent" : "translucent"}
        </TooltipContent>
      </Tooltip>
    </div>
  );
}

// Main component

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
    <div className="flex flex-col gap-4">
      {/* Swatch + Name + Hex */}
      {(displayHex || colorName) && (
        <div className="flex items-center gap-4">
          {displayHex && <ColorSwatch hex={displayHex} />}
          <div className="space-y-0.5">
            {colorName && (
              <p className="text-base font-semibold">{colorName}</p>
            )}
            {displayHex && (
              <p className="text-sm font-mono text-muted-foreground">
                {displayHex.toUpperCase()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* RGB row */}
      {colorR != null && colorG != null && colorB != null && (
        <div className="flex gap-4">
          <span className="text-xs text-muted-foreground">R: {colorR}</span>
          <span className="text-xs text-muted-foreground">G: {colorG}</span>
          <span className="text-xs text-muted-foreground">B: {colorB}</span>
        </div>
      )}

      {/* Lab row */}
      {hasLab && (
        <div className="flex gap-4">
          <span className="text-xs text-muted-foreground">L*: {colorLabL!.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">a*: {colorLabA!.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">b*: {colorLabB!.toFixed(1)}</span>
        </div>
      )}

      {/* Industry matches */}
      {hasIndustry && (
        <div className="flex flex-wrap gap-1.5">
          {closestPantone && <Badge variant="secondary">Pantone {closestPantone}</Badge>}
          {closestRal && <Badge variant="secondary">RAL {closestRal}</Badge>}
          {closestPms && <Badge variant="secondary">PMS {closestPms}</Badge>}
        </div>
      )}

      {/* Color parent */}
      {colorParent && (
        <Badge variant="outline" className="self-start">{colorParent}</Badge>
      )}

      {/* Multi-color */}
      {hasMultiColor && (
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">
            Multi-color
            {multiColorDirection ? ` (${multiColorDirection})` : ""}
          </span>
          <MultiColorSwatches
            hexes={multiColorHexes!}
            direction={multiColorDirection}
          />
        </div>
      )}

      {/* Properties row */}
      {hasProperties && (
        <div className="flex flex-wrap gap-1.5">
          {translucent && (
            <Badge variant="outline">
              <Droplets className="size-3 mr-1" />
              Translucent
            </Badge>
          )}
          {glow && (
            <Badge variant="outline" className="text-amber-600 border-amber-300">
              <Lightbulb className="size-3 mr-1" />
              Glow
            </Badge>
          )}
          {finish && (
            <Badge variant="outline">
              {finish.charAt(0).toUpperCase() + finish.slice(1)}
            </Badge>
          )}
          {pattern && pattern !== "solid" && (
            <Badge variant="outline">
              {pattern.charAt(0).toUpperCase() + pattern.slice(1)}
            </Badge>
          )}
        </div>
      )}

      {/* Transmission distance */}
      {hasTd && (
        <TransmissionDistanceBar
          value={transmissionDistance!}
          voteCount={tdVoteCount}
        />
      )}
    </div>
  );
}
