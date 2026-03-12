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
import CategoryIcon from "@mui/icons-material/Category";
import UsbIcon from "@mui/icons-material/Usb";
import BluetoothIcon from "@mui/icons-material/Bluetooth";
import WifiIcon from "@mui/icons-material/Wifi";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import {
  listHardwareModels,
  removeHardwareModel,
  createHardwareModel,
} from "@/lib/actions/hardware-catalog";
import { HardwareModelDialog } from "@/components/hardware/hardware-model-dialog";
import { useDeleteWithUndo } from "@/components/hardware/use-delete-with-undo";
import { hardwareCategoryLabels } from "@/components/hardware/enum-labels";

type HardwareModel = {
  id: string;
  category: string;
  manufacturer: string;
  model: string;
  slug: string;
  description: string | null;
  validationStatus: string;
  hasUsb: boolean | null;
  hasBle: boolean | null;
  hasWifi: boolean | null;
  printDpi: number | null;
  printWidthMm: number | null;
  buildVolumeX: number | null;
  buildVolumeY: number | null;
  buildVolumeZ: number | null;
  [key: string]: unknown;
};

const categoryColors: Record<string, "primary" | "secondary" | "default" | "success" | "warning" | "info"> = {
  label_printer: "secondary",
  scan_station: "primary",
  shelf_station: "primary",
  fdm_printer: "success",
  resin_printer: "success",
  cnc: "warning",
  laser_cutter: "warning",
  laser_engraver: "warning",
  drybox: "info",
  filament_changer: "info",
  enclosure: "default",
  other: "default",
};

export function HardwareCatalogTab({ refreshKey }: { refreshKey?: number }) {
  const [models, setModels] = useState<HardwareModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingModel, setEditingModel] = useState<HardwareModel | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const loadData = () => {
    setLoading(true);
    listHardwareModels().then((result) => {
      if (result.data) setModels(result.data as HardwareModel[]);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const { snackbarOpen, snackbarMessage, handleDelete, handleUndo, handleSnackbarClose } =
    useDeleteWithUndo<HardwareModel>({
      removeFn: removeHardwareModel,
      recreateFn: createHardwareModel,
      onRefresh: loadData,
      entityLabel: "Hardware Model",
    });

  const columns: GridColDef[] = [
    {
      field: "category",
      headerName: "Category",
      width: 150,
      renderCell: (params) => (
        <Chip
          label={hardwareCategoryLabels[params.value as string] ?? params.value}
          size="small"
          color={categoryColors[params.value as string] ?? "default"}
        />
      ),
    },
    {
      field: "manufacturer",
      headerName: "Manufacturer",
      width: 160,
      renderCell: (params) => (
        <Typography variant="body2" fontWeight={500}>{params.value}</Typography>
      ),
    },
    {
      field: "model",
      headerName: "Model",
      width: 160,
    },
    {
      field: "specs",
      headerName: "Specs",
      width: 200,
      sortable: false,
      valueGetter: (_value: unknown, row: HardwareModel) => {
        if (row.category === "label_printer") {
          const parts = [];
          if (row.printDpi) parts.push(`${row.printDpi} DPI`);
          if (row.printWidthMm) parts.push(`${row.printWidthMm}mm`);
          return parts.join(" · ") || "—";
        }
        if (row.buildVolumeX && row.buildVolumeY && row.buildVolumeZ) {
          return `${row.buildVolumeX}×${row.buildVolumeY}×${row.buildVolumeZ} mm`;
        }
        return "—";
      },
    },
    {
      field: "connectivity",
      headerName: "Connectivity",
      width: 140,
      sortable: false,
      renderCell: (params) => {
        const row = params.row as HardwareModel;
        return (
          <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
            {row.hasUsb && <UsbIcon sx={{ fontSize: 16, color: "text.secondary" }} />}
            {row.hasBle && <BluetoothIcon sx={{ fontSize: 16, color: "primary.main" }} />}
            {row.hasWifi && <WifiIcon sx={{ fontSize: 16, color: "success.main" }} />}
          </Box>
        );
      },
    },
    {
      field: "validationStatus",
      headerName: "Status",
      width: 100,
      renderCell: (params) => {
        const colors: Record<string, "default" | "warning" | "success" | "error"> = {
          draft: "default",
          submitted: "warning",
          validated: "success",
          deprecated: "error",
        };
        return (
          <Chip
            label={params.value}
            size="small"
            color={colors[params.value as string] ?? "default"}
            variant="outlined"
            sx={{ textTransform: "capitalize" }}
          />
        );
      },
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
              setEditingModel(params.row as HardwareModel);
              setDialogOpen(true);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(params.row as HardwareModel);
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

  if (models.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <CategoryIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
        <Typography variant="subtitle1" fontWeight={500}>
          No hardware models in catalog
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Models are auto-discovered when devices connect, or you can add them manually.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <DataGrid
        rows={models}
        columns={columns}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        pageSizeOptions={[10, 25]}
        disableRowSelectionOnClick
        autoHeight
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 3,
          "& .MuiDataGrid-columnHeaders": { bgcolor: "background.paper" },
        }}
      />
      <HardwareModelDialog
        open={dialogOpen}
        onClose={() => {
          setDialogOpen(false);
          setEditingModel(null);
        }}
        onSaved={loadData}
        existing={editingModel}
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
