"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";

type WeightEvent = {
  id: string;
  weightG: number | null;
  createdAt: string | Date;
  eventType: string;
};

type TimeRange = "24h" | "7d" | "30d" | "all";

const RANGES: TimeRange[] = ["24h", "7d", "30d", "all"];

function filterByRange(events: WeightEvent[], range: TimeRange): WeightEvent[] {
  if (range === "all") return events;
  const now = Date.now();
  const ms: Record<string, number> = {
    "24h": 24 * 60 * 60 * 1000,
    "7d": 7 * 24 * 60 * 60 * 1000,
    "30d": 30 * 24 * 60 * 60 * 1000,
  };
  const cutoff = now - ms[range];
  return events.filter((e) => new Date(e.createdAt).getTime() >= cutoff);
}

export function WeightChart({ events }: { events: WeightEvent[] }) {
  const [range, setRange] = useState<TimeRange>("30d");

  const sorted = [...events].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );
  const filtered = filterByRange(sorted, range);

  const yData = filtered.map((e) => e.weightG ?? 0);
  const maxY = yData.length > 0 ? Math.max(...yData) : 0;
  const minY = yData.length > 0 ? Math.min(...yData) : 0;
  const rangeY = maxY - minY || 1;

  // Build SVG path for the line chart
  const chartWidth = 600;
  const chartHeight = 250;
  const padding = { top: 20, right: 20, bottom: 40, left: 60 };
  const plotW = chartWidth - padding.left - padding.right;
  const plotH = chartHeight - padding.top - padding.bottom;

  const points = filtered.map((e, i) => {
    const x = padding.left + (filtered.length > 1 ? (i / (filtered.length - 1)) * plotW : plotW / 2);
    const y = padding.top + plotH - ((( (e.weightG ?? 0) - minY) / rangeY) * plotH);
    return { x, y, date: new Date(e.createdAt), weight: e.weightG ?? 0 };
  });

  const pathD = points.length > 0
    ? points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ")
    : "";

  // Y-axis ticks
  const yTicks = 5;
  const yTickValues = Array.from({ length: yTicks }, (_, i) =>
    Math.round(minY + (rangeY / (yTicks - 1)) * i)
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-semibold text-base">Weight Over Time</CardTitle>
        <CardAction>
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {RANGES.map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1 text-xs font-medium transition-colors ${
                  range === r
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </CardAction>
      </CardHeader>
      <CardContent>
        {filtered.length < 2 ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">
              Not enough data points to display chart.
            </p>
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
            className="w-full h-auto"
            preserveAspectRatio="xMidYMid meet"
          >
            {/* Y-axis labels */}
            {yTickValues.map((val) => {
              const y = padding.top + plotH - (((val - minY) / rangeY) * plotH);
              return (
                <g key={val}>
                  <line
                    x1={padding.left}
                    y1={y}
                    x2={padding.left + plotW}
                    y2={y}
                    stroke="currentColor"
                    strokeOpacity={0.1}
                  />
                  <text
                    x={padding.left - 8}
                    y={y + 4}
                    textAnchor="end"
                    className="fill-muted-foreground text-[10px]"
                  >
                    {val}g
                  </text>
                </g>
              );
            })}

            {/* X-axis labels (first, mid, last) */}
            {points.length > 0 && [0, Math.floor(points.length / 2), points.length - 1]
              .filter((v, i, a) => a.indexOf(v) === i)
              .map((idx) => (
                <text
                  key={idx}
                  x={points[idx].x}
                  y={chartHeight - 8}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[10px]"
                >
                  {points[idx].date.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </text>
              ))}

            {/* Area fill */}
            {points.length > 1 && (
              <path
                d={`${pathD} L ${points[points.length - 1].x} ${padding.top + plotH} L ${points[0].x} ${padding.top + plotH} Z`}
                fill="#00D2FF"
                fillOpacity={0.1}
              />
            )}

            {/* Line */}
            <path
              d={pathD}
              fill="none"
              stroke="#00D2FF"
              strokeWidth={2}
              strokeLinejoin="round"
            />

            {/* Data points */}
            {filtered.length < 50 &&
              points.map((p, i) => (
                <circle
                  key={i}
                  cx={p.x}
                  cy={p.y}
                  r={3}
                  fill="#00D2FF"
                  stroke="white"
                  strokeWidth={1.5}
                />
              ))}
          </svg>
        )}
      </CardContent>
    </Card>
  );
}
