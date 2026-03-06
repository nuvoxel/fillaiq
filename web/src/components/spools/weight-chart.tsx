"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import { LineChart } from "@mui/x-charts/LineChart";

type WeightEvent = {
  id: string;
  weightG: number | null;
  createdAt: string | Date;
  eventType: string;
};

type TimeRange = "24h" | "7d" | "30d" | "all";

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

  const sorted = [...events]
    .sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  const filtered = filterByRange(sorted, range);

  const xData = filtered.map((e) => new Date(e.createdAt));
  const yData = filtered.map((e) => e.weightG ?? 0);

  return (
    <Card>
      <CardHeader
        title="Weight Over Time"
        titleTypographyProps={{ fontWeight: 600, variant: "subtitle1" }}
        action={
          <ToggleButtonGroup
            value={range}
            exclusive
            onChange={(_, val) => val && setRange(val)}
            size="small"
          >
            <ToggleButton value="24h">24h</ToggleButton>
            <ToggleButton value="7d">7d</ToggleButton>
            <ToggleButton value="30d">30d</ToggleButton>
            <ToggleButton value="all">All</ToggleButton>
          </ToggleButtonGroup>
        }
      />
      <CardContent>
        {filtered.length < 2 ? (
          <Box sx={{ textAlign: "center", py: 4 }}>
            <Typography variant="body2" color="text.secondary">
              Not enough data points to display chart.
            </Typography>
          </Box>
        ) : (
          <LineChart
            xAxis={[
              {
                data: xData,
                scaleType: "time",
                valueFormatter: (v: Date) =>
                  v.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  }),
              },
            ]}
            series={[
              {
                data: yData,
                label: "Weight (g)",
                color: "#1976d2",
                showMark: filtered.length < 50,
              },
            ]}
            height={300}
            margin={{ left: 60, right: 20, top: 20, bottom: 30 }}
          />
        )}
      </CardContent>
    </Card>
  );
}
