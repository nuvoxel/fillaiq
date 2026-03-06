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
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import PrecisionManufacturingIcon from "@mui/icons-material/PrecisionManufacturing";
import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { listMachines, getMachineWithRelations, removeMachine, createMachine } from "@/lib/actions/user-library";
import { MachineDialog } from "@/components/hardware/machine-dialog";
import { useDeleteWithUndo } from "@/components/hardware/use-delete-with-undo";
import { MachineDetail } from "./machine-detail";

type Machine = {
  id: string;
  name: string;
  machineType: string;
  manufacturer: string | null;
  model: string | null;
  nozzleDiameterMm: number | null;
  ipAddress: string | null;
  hasFilamentChanger: boolean | null;
  filamentChangerSlotCount: number | null;
  filamentChangerUnitCount: number | null;
  [key: string]: unknown;
};

type MachineWithRelations = Machine & {
  toolHeads: any[];
  workSurfaces: any[];
  materialSlots: any[];
  accessories: any[];
};

const machineTypeColors: Record<string, "primary" | "secondary" | "warning" | "info" | "success"> = {
  fdm: "primary",
  cnc: "warning",
  laser: "secondary",
  resin: "info",
  multi: "success",
};

export function MachinesTab({ refreshKey }: { refreshKey?: number }) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, MachineWithRelations>>({});
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const loadData = () => {
    setLoading(true);
    listMachines().then((result) => {
      if (result.data) setMachines(result.data as Machine[]);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadData();
  }, [refreshKey]);

  const { snackbarOpen, snackbarMessage, handleDelete, handleUndo, handleSnackbarClose } =
    useDeleteWithUndo<Machine>({
      removeFn: removeMachine,
      recreateFn: createMachine,
      onRefresh: () => {
        loadData();
        setExpandedId(null);
      },
      entityLabel: "Machine",
    });

  const loadDetails = async (id: string) => {
    const result = await getMachineWithRelations(id);
    if (result.data) {
      setDetails((prev) => ({ ...prev, [id]: result.data as MachineWithRelations }));
    }
  };

  const handleToggle = async (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    if (!details[id]) {
      await loadDetails(id);
    }
  };

  const handleDetailRefresh = async () => {
    if (expandedId) {
      await loadDetails(expandedId);
    }
  };

  const columns: GridColDef[] = [
    { field: "name", headerName: "Name", width: 160, renderCell: (params) => (
      <Typography variant="body2" fontWeight={500}>{params.value}</Typography>
    ) },
    {
      field: "machineType",
      headerName: "Type",
      width: 100,
      renderCell: (params) => (
        <Chip
          label={params.value?.toUpperCase()}
          size="small"
          color={machineTypeColors[params.value] ?? "default"}
          variant="outlined"
        />
      ),
    },
    {
      field: "manufacturer",
      headerName: "Manufacturer / Model",
      width: 200,
      valueGetter: (_value, row) =>
        [row.manufacturer, row.model].filter(Boolean).join(" "),
    },
    {
      field: "nozzleDiameterMm",
      headerName: "Nozzle",
      width: 100,
      valueFormatter: (v: number | null) => v != null ? `${v}mm` : "—",
    },
    {
      field: "hasFilamentChanger",
      headerName: "Changer",
      width: 110,
      renderCell: (params) =>
        params.row.hasFilamentChanger ? (
          <Chip
            label={`${params.row.filamentChangerUnitCount ?? params.row.filamentChangerSlotCount ?? "?"} slots`}
            size="small"
            color="primary"
            variant="outlined"
          />
        ) : (
          <Typography variant="body2" color="text.secondary">No</Typography>
        ),
    },
    {
      field: "ipAddress",
      headerName: "IP",
      width: 140,
      valueFormatter: (v: string | null) => v ?? "—",
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
              setEditingMachine(params.row as Machine);
              setEditDialogOpen(true);
            }}
          >
            <EditIcon fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(params.row as Machine);
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

  if (machines.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <PrecisionManufacturingIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
        <Typography variant="subtitle1" fontWeight={500}>
          No machines configured
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add your first machine to track tool heads, work surfaces, and more.
        </Typography>
      </Box>
    );
  }

  return (
    <>
      <Stack spacing={1}>
        <DataGrid
          rows={machines}
          columns={columns}
          initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
          pageSizeOptions={[10]}
          disableRowSelectionOnClick
          autoHeight
          onRowClick={(params) => handleToggle(params.id as string)}
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 3,
            "& .MuiDataGrid-columnHeaders": { bgcolor: "background.paper" },
            "& .MuiDataGrid-row": { cursor: "pointer" },
          }}
        />
        {expandedId && (
          <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                {machines.find((m) => m.id === expandedId)?.name} — Details
              </Typography>
              <IconButton size="small" onClick={() => setExpandedId(null)}>
                <ExpandLessIcon />
              </IconButton>
            </Box>
            {details[expandedId] ? (
              <MachineDetail
                machineId={expandedId}
                machineType={details[expandedId].machineType}
                toolHeads={details[expandedId].toolHeads}
                workSurfaces={details[expandedId].workSurfaces}
                materialSlots={details[expandedId].materialSlots}
                accessories={details[expandedId].accessories}
                onRefresh={handleDetailRefresh}
              />
            ) : (
              <Stack spacing={1}>
                <Skeleton variant="rounded" height={100} />
                <Skeleton variant="rounded" height={100} />
              </Stack>
            )}
          </Box>
        )}
      </Stack>

      <MachineDialog
        open={editDialogOpen}
        onClose={() => { setEditDialogOpen(false); setEditingMachine(null); }}
        onSaved={() => { loadData(); if (expandedId) loadDetails(expandedId); }}
        existing={editingMachine}
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
