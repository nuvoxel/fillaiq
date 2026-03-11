"use client";

import { useState, useEffect, useRef } from "react";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";

echarts.use([
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

type Reading = {
  temperatureC: number | null;
  humidity: number | null;
  pressureHPa: number | null;
  createdAt: string;
};

type Props = {
  stationId: string;
};

const TIME_RANGES = [
  { label: "1h", hours: 1 },
  { label: "6h", hours: 6 },
  { label: "24h", hours: 24 },
  { label: "7d", hours: 168 },
  { label: "30d", hours: 720 },
];

export default function EnvironmentChart({ stationId }: Props) {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<Reading[]>([]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/v1/environment?stationId=${stationId}&hours=${hours}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setReadings(data.readings ?? []);
          setLoading(false);
        }
      })
      .catch(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [stationId, hours]);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current, "dark");
    }
    const chart = chartInstance.current;

    const times = readings.map((r) => new Date(r.createdAt).toLocaleString());
    const temps = readings.map((r) => r.temperatureC);
    const humids = readings.map((r) => r.humidity);
    const pressures = readings.map((r) => r.pressureHPa);
    const hasPressure = pressures.some((p) => p != null && p > 0);

    const series: any[] = [
      {
        name: "Temperature",
        type: "line",
        yAxisIndex: 0,
        data: temps,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2 },
        itemStyle: { color: "#FF6B35" },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(255, 107, 53, 0.3)" },
          { offset: 1, color: "rgba(255, 107, 53, 0.02)" },
        ])},
      },
      {
        name: "Humidity",
        type: "line",
        yAxisIndex: 1,
        data: humids,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 2 },
        itemStyle: { color: "#4FC3F7" },
        areaStyle: { color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: "rgba(79, 195, 247, 0.2)" },
          { offset: 1, color: "rgba(79, 195, 247, 0.02)" },
        ])},
      },
    ];

    const yAxes: any[] = [
      {
        type: "value",
        name: "°C",
        position: "left",
        axisLabel: { color: "#FF6B35" },
        splitLine: { lineStyle: { color: "rgba(255,255,255,0.06)" } },
      },
      {
        type: "value",
        name: "% RH",
        position: "right",
        axisLabel: { color: "#4FC3F7" },
        splitLine: { show: false },
      },
    ];

    if (hasPressure) {
      series.push({
        name: "Pressure",
        type: "line",
        yAxisIndex: 2,
        data: pressures,
        smooth: true,
        symbol: "none",
        lineStyle: { width: 1.5, type: "dashed" },
        itemStyle: { color: "#81C784" },
      });
      yAxes.push({
        type: "value",
        name: "hPa",
        position: "right",
        offset: 60,
        axisLabel: { color: "#81C784" },
        splitLine: { show: false },
      });
    }

    chart.setOption({
      backgroundColor: "transparent",
      tooltip: {
        trigger: "axis",
        backgroundColor: "rgba(30,30,30,0.95)",
        borderColor: "rgba(255,255,255,0.1)",
        textStyle: { color: "#fff", fontSize: 12 },
      },
      legend: {
        data: hasPressure ? ["Temperature", "Humidity", "Pressure"] : ["Temperature", "Humidity"],
        textStyle: { color: "rgba(255,255,255,0.7)", fontSize: 11 },
        top: 0,
      },
      grid: {
        left: 50,
        right: hasPressure ? 120 : 60,
        top: 35,
        bottom: 40,
      },
      xAxis: {
        type: "category",
        data: times,
        axisLabel: {
          color: "rgba(255,255,255,0.5)",
          fontSize: 10,
          rotate: 0,
          formatter: (val: string) => {
            const d = new Date(val);
            return hours <= 24
              ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
              : d.toLocaleDateString([], { month: "short", day: "numeric" });
          },
        },
        axisLine: { lineStyle: { color: "rgba(255,255,255,0.1)" } },
      },
      yAxis: yAxes,
      series,
      dataZoom: [
        { type: "inside", xAxisIndex: 0, filterMode: "filter" },
      ],
    }, true);

    const handleResize = () => chart.resize();
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, [readings, hours]);

  // Cleanup chart on unmount
  useEffect(() => {
    return () => {
      chartInstance.current?.dispose();
      chartInstance.current = null;
    };
  }, []);

  return (
    <Box>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">
          Environment History
        </Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          value={hours}
          onChange={(_, v) => v != null && setHours(v)}
        >
          {TIME_RANGES.map((r) => (
            <ToggleButton key={r.hours} value={r.hours} sx={{ px: 1, py: 0.25, fontSize: "0.7rem" }}>
              {r.label}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>
      </Box>
      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={24} />
        </Box>
      ) : readings.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: "center" }}>
          No data for this time range
        </Typography>
      ) : (
        <div ref={chartRef} style={{ width: "100%", height: 220 }} />
      )}
    </Box>
  );
}
