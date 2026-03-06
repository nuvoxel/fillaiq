"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import AddIcon from "@mui/icons-material/Add";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { PageHeader } from "@/components/layout/page-header";
import { listSpools } from "@/lib/actions/user-library";

type Spool = {
  id: string;
  status: string;
  currentWeightG: number | null;
  netFilamentWeightG: number | null;
  percentRemaining: number | null;
  createdAt: Date;
  updatedAt: Date;
  [key: string]: unknown;
};

const statusColors: Record<string, "success" | "warning" | "default"> = {
  active: "success",
  empty: "warning",
  archived: "default",
};

const columns: GridColDef[] = [
  {
    field: "color",
    headerName: "",
    width: 48,
    sortable: false,
    filterable: false,
    renderCell: () => (
      <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
        <CircleOutlinedIcon sx={{ color: "text.disabled" }} />
      </Box>
    ),
  },
  { field: "id", headerName: "ID", width: 100, valueGetter: (value: string) => value.slice(0, 8) },
  { field: "status", headerName: "Status", width: 120,
    renderCell: (params) => (
      <Chip
        label={params.value}
        size="small"
        color={statusColors[params.value as string] ?? "default"}
      />
    ),
  },
  {
    field: "percentRemaining",
    headerName: "Weight",
    width: 180,
    renderCell: (params) => {
      const pct = params.value as number | null;
      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%" }}>
          <LinearProgress
            variant="determinate"
            value={pct ?? 0}
            sx={{
              flex: 1,
              height: 8,
              borderRadius: 4,
              bgcolor: "grey.200",
              "& .MuiLinearProgress-bar": {
                bgcolor: (pct ?? 0) > 50 ? "success.main" : (pct ?? 0) > 20 ? "warning.main" : "error.main",
              },
            }}
          />
          <Typography variant="caption" sx={{ minWidth: 36 }}>
            {pct ?? 0}%
          </Typography>
        </Box>
      );
    },
  },
  {
    field: "currentWeightG",
    headerName: "Current (g)",
    width: 120,
    valueFormatter: (value: number | null) => value != null ? `${Math.round(value)}g` : "—",
  },
  {
    field: "netFilamentWeightG",
    headerName: "Net (g)",
    width: 120,
    valueFormatter: (value: number | null) => value != null ? `${Math.round(value)}g` : "—",
  },
  {
    field: "updatedAt",
    headerName: "Last Updated",
    width: 180,
    valueFormatter: (value: Date) =>
      value ? new Date(value).toLocaleDateString() : "—",
  },
];

export default function SpoolsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [spools, setSpools] = useState<Spool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listSpools().then((result) => {
      if (result.data) setSpools(result.data as Spool[]);
      setLoading(false);
    });
  }, []);

  const filtered = statusFilter
    ? spools.filter((s) => s.status === statusFilter)
    : spools;

  return (
    <div>
      <PageHeader
        title="Spools"
        description="Manage your filament spool inventory."
        action={
          <Button variant="contained" startIcon={<AddIcon />}>
            Add Spool
          </Button>
        }
      />

      <Box sx={{ mb: 2 }}>
        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, val) => setStatusFilter(val)}
          size="small"
        >
          <ToggleButton value="active" sx={{ color: "success.main", "&.Mui-selected": { bgcolor: "success.light", color: "success.dark" } }}>
            Active
          </ToggleButton>
          <ToggleButton value="empty" sx={{ color: "warning.main", "&.Mui-selected": { bgcolor: "warning.light", color: "warning.dark" } }}>
            Empty
          </ToggleButton>
          <ToggleButton value="archived" sx={{ color: "text.secondary", "&.Mui-selected": { bgcolor: "grey.200" } }}>
            Archived
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {loading ? (
        <Stack spacing={1}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={52} />
          ))}
        </Stack>
      ) : filtered.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <CircleOutlinedIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography variant="subtitle1" fontWeight={500}>
            No spools found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {statusFilter ? "Try a different filter." : "Add your first spool to get started."}
          </Typography>
        </Box>
      ) : (
        <DataGrid
          rows={filtered}
          columns={columns}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          autoHeight
          onRowClick={(params) => router.push(`/spools/${params.id}`)}
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 3,
            "& .MuiDataGrid-columnHeaders": { bgcolor: "background.paper" },
            "& .MuiDataGrid-row": { cursor: "pointer" },
          }}
        />
      )}
    </div>
  );
}
