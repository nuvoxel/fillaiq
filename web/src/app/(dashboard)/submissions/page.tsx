"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import AddIcon from "@mui/icons-material/Add";
import SendIcon from "@mui/icons-material/Send";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { PageHeader } from "@/components/layout/page-header";
import { listCatalogSubmissions } from "@/lib/actions/submissions";

type Submission = {
  id: string;
  type: string;
  status: string;
  targetTable: string | null;
  targetId: string | null;
  createdAt: Date;
  [key: string]: unknown;
};

const statusColors: Record<string, "warning" | "success" | "error" | "default"> = {
  pending: "warning",
  approved: "success",
  rejected: "error",
  duplicate: "default",
};

const typeColors: Record<string, "primary" | "secondary" | "info" | "default"> = {
  new_filament: "primary",
  new_variant: "secondary",
  correction: "info",
  equivalence: "default",
};

const columns: GridColDef[] = [
  {
    field: "type",
    headerName: "Type",
    width: 160,
    renderCell: (params) => (
      <Chip
        label={(params.value as string).replace("_", " ")}
        size="small"
        color={typeColors[params.value as string] ?? "default"}
      />
    ),
  },
  {
    field: "targetTable",
    headerName: "Target",
    width: 140,
    valueFormatter: (value: string | null) => value ?? "—",
  },
  {
    field: "status",
    headerName: "Status",
    width: 130,
    renderCell: (params) => (
      <Chip
        label={params.value}
        size="small"
        color={statusColors[params.value as string] ?? "default"}
      />
    ),
  },
  {
    field: "userId",
    headerName: "Submitted By",
    width: 160,
    valueGetter: (value: string) => value?.slice(0, 8) ?? "—",
  },
  {
    field: "createdAt",
    headerName: "Date",
    width: 180,
    valueFormatter: (value: Date) =>
      value ? new Date(value).toLocaleDateString() : "—",
  },
];

export default function SubmissionsPage() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listCatalogSubmissions().then((result) => {
      if (result.data) setSubmissions(result.data as Submission[]);
      setLoading(false);
    });
  }, []);

  const filtered = statusFilter
    ? submissions.filter((s) => s.status === statusFilter)
    : submissions;

  return (
    <div>
      <PageHeader
        title="Submissions"
        description="Review community catalog submissions."
        action={
          <Button variant="contained" startIcon={<AddIcon />}>
            New Submission
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
          <ToggleButton value="pending" sx={{ color: "warning.main", "&.Mui-selected": { bgcolor: "warning.light", color: "warning.dark" } }}>
            Pending
          </ToggleButton>
          <ToggleButton value="approved" sx={{ color: "success.main", "&.Mui-selected": { bgcolor: "success.light", color: "success.dark" } }}>
            Approved
          </ToggleButton>
          <ToggleButton value="rejected" sx={{ color: "error.main", "&.Mui-selected": { bgcolor: "error.light", color: "error.dark" } }}>
            Rejected
          </ToggleButton>
          <ToggleButton value="duplicate" sx={{ color: "text.secondary", "&.Mui-selected": { bgcolor: "grey.200" } }}>
            Duplicate
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
          <SendIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography variant="subtitle1" fontWeight={500}>
            No submissions found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {statusFilter ? "Try a different filter." : "No catalog submissions yet."}
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
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 3,
            "& .MuiDataGrid-columnHeaders": { bgcolor: "background.paper" },
          }}
        />
      )}
    </div>
  );
}
