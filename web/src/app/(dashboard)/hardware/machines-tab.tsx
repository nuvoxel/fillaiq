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
import { listMyMachines, getMachineWithRelations, removeMachine, createMachine } from "@/lib/actions/user-library";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
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
  buildVolumeX: number | null;
  buildVolumeY: number | null;
  buildVolumeZ: number | null;
  ipAddress: string | null;
  hasFilamentChanger: boolean | null;
  filamentChangerSlotCount: number | null;
  filamentChangerUnitCount: number | null;
  liveStatus: Record<string, any> | null;
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

// ── Live printer status (from Bambu MQTT relay) ─────────────────────────

function stateColor(state: string): "success" | "primary" | "warning" | "error" | "default" {
  switch (state) {
    case "RUNNING": return "primary";
    case "PAUSE": return "warning";
    case "FINISH": return "success";
    case "FAILED": return "error";
    default: return "default";
  }
}

function formatTime(minutes: number): string {
  if (minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function TempDisplay({ label, current, target }: { label: string; current: number; target: number }) {
  const active = target > 0;
  return (
    <Box sx={{ textAlign: "center" }}>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="h6" fontWeight={600} color={active ? "primary.main" : "text.primary"}>
        {Math.round(current)}°C
      </Typography>
      {active && (
        <Typography variant="caption" color="text.secondary">/ {Math.round(target)}°C</Typography>
      )}
    </Box>
  );
}

function PrinterLiveStatus({ status }: { status: Record<string, any> }) {
  const s = status;
  const trays = (s.trays ?? []) as Array<Record<string, any>>;
  const isPrinting = s.gcodeState === "RUNNING";

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2, bgcolor: "grey.50" }}>
      {/* Header: state + job name */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
        <Chip
          label={s.gcodeState || "UNKNOWN"}
          size="small"
          color={stateColor(s.gcodeState)}
        />
        {s.subtaskName && (
          <Typography variant="body2" fontWeight={500} noWrap sx={{ flex: 1 }}>
            {s.subtaskName}
          </Typography>
        )}
        {s.wifiSignal != null && s.wifiSignal !== 0 && (
          <Typography variant="caption" color="text.secondary">
            WiFi: {s.wifiSignal}dBm
          </Typography>
        )}
      </Stack>

      {/* Progress bar (if printing) */}
      {isPrinting && (
        <Box sx={{ mb: 2 }}>
          <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
            <Typography variant="body2" fontWeight={500}>
              {s.printPercent ?? 0}%
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Layer {s.currentLayer ?? 0} / {s.totalLayers ?? 0}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {formatTime(s.remainingTime ?? 0)} remaining
            </Typography>
          </Stack>
          <LinearProgress
            variant="determinate"
            value={s.printPercent ?? 0}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>
      )}

      {/* Temperatures */}
      <Stack direction="row" spacing={4} sx={{ mb: 2 }}>
        <TempDisplay label="Nozzle" current={s.nozzleTemp ?? 0} target={s.nozzleTarget ?? 0} />
        <TempDisplay label="Bed" current={s.bedTemp ?? 0} target={s.bedTarget ?? 0} />
        <TempDisplay label="Chamber" current={s.chamberTemp ?? 0} target={0} />
      </Stack>

      {/* AMS Trays */}
      {trays.length > 0 && (
        <>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: "block" }}>
            AMS Trays ({s.amsCount ?? 0} unit{(s.amsCount ?? 0) !== 1 ? "s" : ""})
          </Typography>
          <Grid container spacing={1}>
            {trays.map((tray, i) => {
              const colorHex = tray.color
                ? `#${(tray.color >>> 8).toString(16).padStart(6, "0")}`
                : "#ccc";
              return (
                <Grid size={{ xs: 6, sm: 3, md: 2 }} key={i}>
                  <Paper
                    variant="outlined"
                    sx={{ p: 1, textAlign: "center", position: "relative" }}
                  >
                    <Box
                      sx={{
                        width: 24, height: 24, borderRadius: "50%",
                        bgcolor: colorHex, border: "2px solid", borderColor: "divider",
                        mx: "auto", mb: 0.5,
                      }}
                    />
                    <Typography variant="caption" fontWeight={600} display="block">
                      {tray.type || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {tray.remain ?? 0}%
                    </Typography>
                    {tray.humidity != null && tray.humidity >= 0 && (
                      <Typography variant="caption" color="text.secondary" display="block">
                        {tray.humidity}% RH
                      </Typography>
                    )}
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}

      {/* Error */}
      {s.printError > 0 && (
        <Typography variant="caption" color="error.main" sx={{ mt: 1, display: "block" }}>
          Error code: {s.printError}
        </Typography>
      )}
    </Paper>
  );
}

export function MachinesTab({ refreshKey }: { refreshKey?: number }) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [details, setDetails] = useState<Record<string, MachineWithRelations>>({});
  const [editingMachine, setEditingMachine] = useState<Machine | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);

  const loadData = () => {
    setLoading(true);
    listMyMachines().then((result) => {
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
      field: "buildVolume",
      headerName: "Build Volume",
      width: 150,
      valueGetter: (_value, row) => {
        const { buildVolumeX: x, buildVolumeY: y, buildVolumeZ: z } = row;
        if (x != null && y != null && z != null) return `${x} x ${y} x ${z}`;
        return null;
      },
      valueFormatter: (v: string | null) => v ?? "—",
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
            {/* Live printer status from MQTT */}
            {machines.find((m) => m.id === expandedId)?.liveStatus && (
              <PrinterLiveStatus status={machines.find((m) => m.id === expandedId)!.liveStatus!} />
            )}

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
