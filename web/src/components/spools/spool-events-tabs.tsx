"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Tab from "@mui/material/Tab";
import Tabs from "@mui/material/Tabs";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";

type UsageSession = {
  id: string;
  filamentUsedG: number | null;
  weightBeforeG: number | null;
  weightAfterG: number | null;
  printJobId: string | null;
  removedAt: string | Date | null;
  returnedAt: string | Date | null;
  createdAt: string | Date;
};

type DryingSession = {
  id: string;
  temperatureC: number | null;
  durationMinutes: number | null;
  weightBeforeG: number | null;
  weightAfterG: number | null;
  moistureLostG: number | null;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  createdAt: string | Date;
};

type SpoolMovement = {
  id: string;
  weightAtMoveG: number | null;
  createdAt: string | Date;
  fromSlotId: string | null;
  toSlotId: string | null;
};

const fmtDate = (v: string | Date | null) =>
  v ? new Date(v).toLocaleString() : "—";

const usageColumns: GridColDef[] = [
  { field: "printJobId", headerName: "Print Job", width: 160, valueFormatter: (v: string | null) => v ?? "—" },
  { field: "filamentUsedG", headerName: "Used (g)", width: 100, valueFormatter: (v: number | null) => v != null ? `${v.toFixed(1)}g` : "—" },
  { field: "weightBeforeG", headerName: "Before (g)", width: 110, valueFormatter: (v: number | null) => v != null ? `${Math.round(v)}g` : "—" },
  { field: "weightAfterG", headerName: "After (g)", width: 110, valueFormatter: (v: number | null) => v != null ? `${Math.round(v)}g` : "—" },
  { field: "removedAt", headerName: "Removed", width: 170, valueFormatter: (v: string | Date | null) => fmtDate(v) },
  { field: "returnedAt", headerName: "Returned", width: 170, valueFormatter: (v: string | Date | null) => fmtDate(v) },
];

const dryingColumns: GridColDef[] = [
  { field: "temperatureC", headerName: "Temp (C)", width: 100, valueFormatter: (v: number | null) => v != null ? `${v}°C` : "—" },
  { field: "durationMinutes", headerName: "Duration", width: 110, valueFormatter: (v: number | null) => v != null ? `${Math.floor(v / 60)}h ${v % 60}m` : "—" },
  { field: "moistureLostG", headerName: "Moisture (g)", width: 120, valueFormatter: (v: number | null) => v != null ? `${v.toFixed(1)}g` : "—" },
  { field: "weightBeforeG", headerName: "Before (g)", width: 110, valueFormatter: (v: number | null) => v != null ? `${Math.round(v)}g` : "—" },
  { field: "weightAfterG", headerName: "After (g)", width: 110, valueFormatter: (v: number | null) => v != null ? `${Math.round(v)}g` : "—" },
  { field: "startedAt", headerName: "Started", width: 170, valueFormatter: (v: string | Date | null) => fmtDate(v) },
  { field: "completedAt", headerName: "Completed", width: 170, valueFormatter: (v: string | Date | null) => fmtDate(v) },
];

const movementColumns: GridColDef[] = [
  { field: "fromSlotId", headerName: "From Slot", width: 120, valueFormatter: (v: string | null) => v ? v.slice(0, 8) : "—" },
  { field: "toSlotId", headerName: "To Slot", width: 120, valueFormatter: (v: string | null) => v ? v.slice(0, 8) : "—" },
  { field: "weightAtMoveG", headerName: "Weight (g)", width: 110, valueFormatter: (v: number | null) => v != null ? `${Math.round(v)}g` : "—" },
  { field: "createdAt", headerName: "Date", width: 200, valueFormatter: (v: string | Date) => fmtDate(v) },
];

const gridSx = {
  border: 1,
  borderColor: "divider",
  borderRadius: 2,
  "& .MuiDataGrid-columnHeaders": { bgcolor: "background.paper" },
};

function EmptyState({ text }: { text: string }) {
  return (
    <Box sx={{ textAlign: "center", py: 4 }}>
      <Typography variant="body2" color="text.secondary">
        {text}
      </Typography>
    </Box>
  );
}

export function SpoolEventsTabs({
  usageSessions,
  dryingSessions,
  movements,
}: {
  usageSessions: UsageSession[];
  dryingSessions: DryingSession[];
  movements: SpoolMovement[];
}) {
  const [tab, setTab] = useState(0);

  return (
    <Card>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ px: 2, pt: 1 }}>
        <Tab
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              Usage Sessions
              <Chip label={usageSessions.length} size="small" variant="outlined" />
            </Box>
          }
        />
        <Tab
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              Drying
              <Chip label={dryingSessions.length} size="small" variant="outlined" />
            </Box>
          }
        />
        <Tab
          label={
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              Movements
              <Chip label={movements.length} size="small" variant="outlined" />
            </Box>
          }
        />
      </Tabs>
      <CardContent>
        {tab === 0 &&
          (usageSessions.length === 0 ? (
            <EmptyState text="No usage sessions recorded." />
          ) : (
            <DataGrid
              rows={usageSessions}
              columns={usageColumns}
              initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
              pageSizeOptions={[5, 10]}
              disableRowSelectionOnClick
              autoHeight
              sx={gridSx}
            />
          ))}
        {tab === 1 &&
          (dryingSessions.length === 0 ? (
            <EmptyState text="No drying sessions recorded." />
          ) : (
            <DataGrid
              rows={dryingSessions}
              columns={dryingColumns}
              initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
              pageSizeOptions={[5, 10]}
              disableRowSelectionOnClick
              autoHeight
              sx={gridSx}
            />
          ))}
        {tab === 2 &&
          (movements.length === 0 ? (
            <EmptyState text="No spool movements recorded." />
          ) : (
            <DataGrid
              rows={movements}
              columns={movementColumns}
              initialState={{ pagination: { paginationModel: { pageSize: 5 } } }}
              pageSizeOptions={[5, 10]}
              disableRowSelectionOnClick
              autoHeight
              sx={gridSx}
            />
          ))}
      </CardContent>
    </Card>
  );
}
