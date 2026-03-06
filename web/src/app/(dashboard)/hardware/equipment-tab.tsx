"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Skeleton from "@mui/material/Skeleton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import InventoryIcon from "@mui/icons-material/Inventory";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { listEquipment, removeEquipment, createEquipment } from "@/lib/actions/user-library";
import { EquipmentDialog } from "@/components/hardware/equipment-dialog";
import { useDeleteWithUndo } from "@/components/hardware/use-delete-with-undo";

type Equipment = {
  id: string;
  name: string;
  type: string;
  manufacturer: string | null;
  model: string | null;
  capacity: number | null;
  maxTemp: number | null;
  hasHumidityControl: boolean | null;
  notes: string | null;
  [key: string]: unknown;
};

const typeColors: Record<string, "primary" | "secondary" | "default" | "success"> = {
  drybox: "primary",
  enclosure: "secondary",
  storage_bin: "default",
  other: "default",
};

export function EquipmentTab({ refreshKey }: { refreshKey?: number }) {
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingEquipment, setEditingEquipment] = useState<Equipment | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadData = () => {
    setLoading(true);
    listEquipment().then((result) => {
      if (result.data) setEquipment(result.data as Equipment[]);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const { snackbarOpen, snackbarMessage, handleDelete, handleUndo, handleSnackbarClose } =
    useDeleteWithUndo<Equipment>({
      removeFn: removeEquipment,
      recreateFn: createEquipment,
      onRefresh: loadData,
      entityLabel: "Equipment",
    });

  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: "Name",
      width: 200,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={500}>{params.value}</Typography>
      ),
    },
    {
      field: "type",
      headerName: "Type",
      width: 140,
      renderCell: (params) => (
        <Chip
          label={params.value.replace(/_/g, " ")}
          size="small"
          color={typeColors[params.value as string] ?? "default"}
          sx={{ textTransform: "capitalize" }}
        />
      ),
    },
    {
      field: "manufacturer",
      headerName: "Manufacturer",
      width: 160,
      valueFormatter: (v: string | null) => v ?? "—",
    },
    {
      field: "model",
      headerName: "Model",
      width: 140,
      valueFormatter: (v: string | null) => v ?? "—",
    },
    {
      field: "capacity",
      headerName: "Capacity",
      width: 100,
      valueFormatter: (v: number | null) => v != null ? `${v} spools` : "—",
    },
    {
      field: "maxTemp",
      headerName: "Max Temp",
      width: 110,
      valueFormatter: (v: number | null) => v != null ? `${v}°C` : "—",
    },
    {
      field: "actions",
      headerName: "",
      width: 100,
      sortable: false,
      filterable: false,
      disableColumnMenu: true,
      renderCell: (params) => (
        <Stack direction="row" spacing={0.5}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              setEditingEquipment(params.row as Equipment);
              setDialogOpen(true);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(params.row as Equipment);
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ),
    },
  ];

  if (loading) {
    return (
      <Stack spacing={1}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={52} />
        ))}
      </Stack>
    );
  }

  if (equipment.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <InventoryIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
        <Typography variant="subtitle1" fontWeight={500}>
          No equipment configured
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add dryers, storage bins, and other equipment.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <DataGrid
        rows={equipment}
        columns={columns}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        pageSizeOptions={[10]}
        disableRowSelectionOnClick
        autoHeight
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 3,
          "& .MuiDataGrid-columnHeaders": { bgcolor: "background.paper" },
        }}
      />
      <EquipmentDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingEquipment(null);
        }}
        onSaved={loadData}
        existing={editingEquipment}
      />
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={handleSnackbarClose}
        message={snackbarMessage}
        action={
          <Button color="inherit" size="small" onClick={handleUndo}>
            UNDO
          </Button>
        }
      />
    </>
  );
}
