"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import PrintIcon from "@mui/icons-material/Print";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { PageHeader } from "@/components/layout/page-header";
import { SpoolDialog } from "@/components/spools/spool-dialog";
import {
  PrintLabelDialog,
  type PrintLabelItem,
} from "@/components/labels/print-label-dialog";
import { listMyItems, type MyItem } from "@/lib/actions/user-library";

const statusColors: Record<string, "success" | "warning" | "default"> = {
  active: "success",
  empty: "warning",
  archived: "default",
};

export default function SpoolsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [userItems, setMyItems] = useState<MyItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MyItem | null>(null);
  const [printItem, setPrintItem] = useState<PrintLabelItem | null>(null);

  const loadItems = useCallback(() => {
    setLoading(true);
    listMyItems().then((result) => {
      if (result.data) setMyItems(result.data as MyItem[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: MyItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSaved = () => {
    loadItems();
  };

  const filtered = statusFilter
    ? userItems.filter((s) => s.status === statusFilter)
    : userItems;

  const columns: GridColDef[] = [
    {
      field: "colorHex",
      headerName: "",
      width: 48,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const hex = (params.row.colorHex ?? params.row.measuredColorHex) as string | null;
        return (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            {hex ? (
              <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: hex, border: 1, borderColor: "divider" }} />
            ) : (
              <CircleOutlinedIcon sx={{ color: "text.disabled" }} />
            )}
          </Box>
        );
      },
    },
    {
      field: "brandName",
      headerName: "Brand",
      width: 120,
      valueFormatter: (value: string | null) => value ?? "\u2014",
    },
    {
      field: "productName",
      headerName: "Product",
      flex: 1,
      minWidth: 160,
      valueFormatter: (value: string | null) => value ?? "\u2014",
    },
    {
      field: "materialName",
      headerName: "Material",
      width: 100,
      valueFormatter: (value: string | null) => value ?? "\u2014",
    },
    { field: "status", headerName: "Status", width: 100,
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
      valueFormatter: (value: number | null) => value != null ? `${Math.round(value)}g` : "\u2014",
    },
    {
      field: "netFilamentWeightG",
      headerName: "Net (g)",
      width: 120,
      valueFormatter: (value: number | null) => value != null ? `${Math.round(value)}g` : "\u2014",
    },
    {
      field: "updatedAt",
      headerName: "Last Updated",
      width: 180,
      valueFormatter: (value: Date) =>
        value ? new Date(value).toLocaleDateString() : "\u2014",
    },
    {
      field: "actions",
      headerName: "",
      width: 90,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => {
        const row = params.row as MyItem;
        return (
          <Box sx={{ display: "flex", gap: 0.25 }}>
            <Tooltip title="Print label">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setPrintItem({
                    brand: row.brandName ?? undefined,
                    material: row.materialName ?? row.productName ?? undefined,
                    color: row.colorHex ?? (row as any).measuredColorHex ?? undefined,
                    weight: row.currentWeightG ? `${Math.round(row.currentWeightG)}g` : undefined,
                  });
                }}
              >
                <PrintIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenEdit(row);
                }}
              >
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        );
      },
    },
  ];

  return (
    <div>
      <PageHeader
        title="Spools"
        description="Manage your filament spool inventory."
        action={
          <Button variant="contained" startIcon={<AddIcon />} onClick={handleOpenCreate}>
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

      <SpoolDialog
        open={dialogOpen}
        onClose={handleDialogClose}
        onSaved={handleSaved}
        existing={editingItem}
      />

      <PrintLabelDialog
        open={!!printItem}
        onClose={() => setPrintItem(null)}
        items={printItem ? [printItem] : []}
      />
    </div>
  );
}
