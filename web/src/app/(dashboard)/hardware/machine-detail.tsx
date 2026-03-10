"use client";

import { useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import Snackbar from "@mui/material/Snackbar";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import {
  removeMachineToolHead,
  createMachineToolHead,
  removeMachineWorkSurface,
  createMachineWorkSurface,
  removeMachineMaterialSlot,
  createMachineMaterialSlot,
  removeMachineAccessory,
  createMachineAccessory,
} from "@/lib/actions/user-library";
import { ToolHeadDialog } from "@/components/hardware/tool-head-dialog";
import { WorkSurfaceDialog } from "@/components/hardware/work-surface-dialog";
import { MaterialSlotDialog } from "@/components/hardware/material-slot-dialog";
import { AccessoryDialog } from "@/components/hardware/accessory-dialog";
import { useDeleteWithUndo } from "@/components/hardware/use-delete-with-undo";

type ToolHead = {
  id: string;
  machineId: string;
  toolCategory: string;
  name: string | null;
  diameterMm: number | null;
  nozzleMaterial: string | null;
  nozzleType: string | null;
  isInstalled: boolean;
  wearLevel: string;
  installCount: number;
  bitDiameterMm: number | null;
  bitType: string | null;
  fluteCount: number | null;
  bitMaterial: string | null;
  laserPowerW: number | null;
  laserWavelengthNm: number | null;
  focalLengthMm: number | null;
  notes: string | null;
  [key: string]: unknown;
};

type WorkSurface = {
  id: string;
  machineId: string;
  name: string;
  type: string;
  isInstalled: boolean;
  surfaceCondition: string;
  notes: string | null;
  [key: string]: unknown;
};

type MaterialSlot = {
  id: string;
  machineId: string;
  changerType: string;
  unitNumber: number;
  slotPosition: number;
  userItemId: string | null;
  [key: string]: unknown;
};

type Accessory = {
  id: string;
  machineId: string;
  type: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  isActive: boolean;
  notes: string | null;
  [key: string]: unknown;
};

const wearColors: Record<string, "success" | "info" | "warning" | "error"> = {
  new: "success",
  good: "info",
  worn: "warning",
  replace: "error",
};

const changerLabels: Record<string, string> = {
  ams: "AMS",
  ams_lite: "AMS Lite",
  mmu: "MMU",
  manual: "Manual",
};

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
      <Typography variant="subtitle2" fontWeight={600}>{title}</Typography>
      <IconButton size="small" onClick={onAdd}><AddIcon fontSize="small" /></IconButton>
    </Box>
  );
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <Stack direction="row" spacing={0.5}>
      <IconButton size="small" onClick={onEdit}><EditIcon fontSize="small" /></IconButton>
      <IconButton size="small" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton>
    </Stack>
  );
}

export function MachineDetail({
  machineId,
  machineType,
  toolHeads,
  workSurfaces,
  materialSlots,
  accessories,
  onRefresh,
}: {
  machineId: string;
  machineType: string;
  toolHeads: ToolHead[];
  workSurfaces: WorkSurface[];
  materialSlots: MaterialSlot[];
  accessories: Accessory[];
  onRefresh: () => void;
}) {
  // Tool Head dialog state
  const [toolHeadDialogOpen, setToolHeadDialogOpen] = useState(false);
  const [editingToolHead, setEditingToolHead] = useState<ToolHead | null>(null);
  const toolHeadUndo = useDeleteWithUndo<ToolHead>({
    removeFn: removeMachineToolHead,
    recreateFn: createMachineToolHead,
    onRefresh,
    entityLabel: "Tool head",
  });

  // Work Surface dialog state
  const [workSurfaceDialogOpen, setWorkSurfaceDialogOpen] = useState(false);
  const [editingWorkSurface, setEditingWorkSurface] = useState<WorkSurface | null>(null);
  const workSurfaceUndo = useDeleteWithUndo<WorkSurface>({
    removeFn: removeMachineWorkSurface,
    recreateFn: createMachineWorkSurface,
    onRefresh,
    entityLabel: "Work surface",
  });

  // Material Slot dialog state
  const [materialSlotDialogOpen, setMaterialSlotDialogOpen] = useState(false);
  const [editingMaterialSlot, setEditingMaterialSlot] = useState<MaterialSlot | null>(null);
  const materialSlotUndo = useDeleteWithUndo<MaterialSlot>({
    removeFn: removeMachineMaterialSlot,
    recreateFn: createMachineMaterialSlot,
    onRefresh,
    entityLabel: "Material slot",
  });

  // Accessory dialog state
  const [accessoryDialogOpen, setAccessoryDialogOpen] = useState(false);
  const [editingAccessory, setEditingAccessory] = useState<Accessory | null>(null);
  const accessoryUndo = useDeleteWithUndo<Accessory>({
    removeFn: removeMachineAccessory,
    recreateFn: createMachineAccessory,
    onRefresh,
    entityLabel: "Accessory",
  });

  const maxUnit = materialSlots.length > 0 ? Math.max(...materialSlots.map((s) => s.unitNumber)) : 0;
  const changerType = materialSlots.length > 0 ? materialSlots[0].changerType : null;

  // Group tool heads by category
  const nozzles = toolHeads.filter((t) => t.toolCategory === "nozzle");
  const bits = toolHeads.filter((t) => t.toolCategory === "spindle_bit");
  const lasers = toolHeads.filter((t) => t.toolCategory === "laser_module");

  return (
    <>
      <Stack spacing={3} sx={{ pt: 1 }}>
        {/* Nozzles */}
        {(nozzles.length > 0 || true) && (
          <Box>
            <SectionHeader title="Nozzles" onAdd={() => { setEditingToolHead(null); setToolHeadDialogOpen(true); }} />
            {nozzles.length > 0 && (
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 600 }}>Diameter</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Material</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Wear</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Installs</TableCell>
                      <TableCell />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {nozzles.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell>{n.diameterMm}mm</TableCell>
                        <TableCell sx={{ textTransform: "capitalize" }}>
                          {n.nozzleMaterial?.replace(/_/g, " ") ?? "—"}
                        </TableCell>
                        <TableCell sx={{ textTransform: "uppercase" }}>{n.nozzleType ?? "—"}</TableCell>
                        <TableCell>
                          <Chip label={n.isInstalled ? "Installed" : "Spare"} size="small" color={n.isInstalled ? "primary" : "default"} variant={n.isInstalled ? "filled" : "outlined"} />
                        </TableCell>
                        <TableCell>
                          <Chip label={n.wearLevel} size="small" color={wearColors[n.wearLevel] ?? "default"} variant="outlined" />
                        </TableCell>
                        <TableCell>{n.installCount}</TableCell>
                        <TableCell>
                          <ActionButtons
                            onEdit={() => { setEditingToolHead(n); setToolHeadDialogOpen(true); }}
                            onDelete={() => toolHeadUndo.handleDelete(n)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Box>
        )}

        {/* Spindle Bits */}
        {bits.length > 0 && (
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Spindle Bits</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Diameter</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Flutes</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Material</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Wear</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {bits.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.name ?? "—"}</TableCell>
                      <TableCell>{b.bitDiameterMm != null ? `${b.bitDiameterMm}mm` : "—"}</TableCell>
                      <TableCell sx={{ textTransform: "capitalize" }}>{b.bitType?.replace(/_/g, " ") ?? "—"}</TableCell>
                      <TableCell>{b.fluteCount ?? "—"}</TableCell>
                      <TableCell sx={{ textTransform: "capitalize" }}>{b.bitMaterial?.replace(/_/g, " ") ?? "—"}</TableCell>
                      <TableCell>
                        <Chip label={b.isInstalled ? "Installed" : "Spare"} size="small" color={b.isInstalled ? "primary" : "default"} variant={b.isInstalled ? "filled" : "outlined"} />
                      </TableCell>
                      <TableCell>
                        <Chip label={b.wearLevel} size="small" color={wearColors[b.wearLevel] ?? "default"} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <ActionButtons
                          onEdit={() => { setEditingToolHead(b); setToolHeadDialogOpen(true); }}
                          onDelete={() => toolHeadUndo.handleDelete(b)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Laser Modules */}
        {lasers.length > 0 && (
          <Box>
            <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Laser Modules</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Power</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Wavelength</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Focal Length</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Wear</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {lasers.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.name ?? "—"}</TableCell>
                      <TableCell>{l.laserPowerW != null ? `${l.laserPowerW}W` : "—"}</TableCell>
                      <TableCell>{l.laserWavelengthNm != null ? `${l.laserWavelengthNm}nm` : "—"}</TableCell>
                      <TableCell>{l.focalLengthMm != null ? `${l.focalLengthMm}mm` : "—"}</TableCell>
                      <TableCell>
                        <Chip label={l.isInstalled ? "Installed" : "Spare"} size="small" color={l.isInstalled ? "primary" : "default"} variant={l.isInstalled ? "filled" : "outlined"} />
                      </TableCell>
                      <TableCell>
                        <Chip label={l.wearLevel} size="small" color={wearColors[l.wearLevel] ?? "default"} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <ActionButtons
                          onEdit={() => { setEditingToolHead(l); setToolHeadDialogOpen(true); }}
                          onDelete={() => toolHeadUndo.handleDelete(l)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        )}

        {/* Work Surfaces */}
        <Box>
          <SectionHeader title="Work Surfaces" onAdd={() => { setEditingWorkSurface(null); setWorkSurfaceDialogOpen(true); }} />
          {workSurfaces.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Condition</TableCell>
                    <TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {workSurfaces.map((ws) => (
                    <TableRow key={ws.id}>
                      <TableCell>{ws.name}</TableCell>
                      <TableCell sx={{ textTransform: "capitalize" }}>{ws.type.replace(/_/g, " ")}</TableCell>
                      <TableCell>
                        <Chip label={ws.isInstalled ? "Installed" : "Spare"} size="small" color={ws.isInstalled ? "primary" : "default"} variant={ws.isInstalled ? "filled" : "outlined"} />
                      </TableCell>
                      <TableCell>
                        <Chip label={ws.surfaceCondition} size="small" color={wearColors[ws.surfaceCondition] ?? "default"} variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <ActionButtons
                          onEdit={() => { setEditingWorkSurface(ws); setWorkSurfaceDialogOpen(true); }}
                          onDelete={() => workSurfaceUndo.handleDelete(ws)}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Box>

        {/* Material Slots */}
        <Box>
          <SectionHeader
            title={`Material Slots${changerType ? ` (${changerLabels[changerType] ?? changerType})` : ""}`}
            onAdd={() => { setEditingMaterialSlot(null); setMaterialSlotDialogOpen(true); }}
          />
          {materialSlots.length > 0 &&
            Array.from({ length: maxUnit }, (_, i) => i + 1).map((unit) => {
              const unitSlots = materialSlots
                .filter((s) => s.unitNumber === unit)
                .sort((a, b) => a.slotPosition - b.slotPosition);
              return (
                <Box key={unit} sx={{ mb: 1 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
                    Unit {unit}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 1 }}>
                    {unitSlots.map((slot) => {
                      const loaded = !!slot.spoolId;
                      return (
                        <Tooltip
                          key={slot.id}
                          title={loaded ? `Slot ${slot.slotPosition}: Spool loaded` : `Slot ${slot.slotPosition}: Empty`}
                          arrow
                        >
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 2,
                              border: 2,
                              borderColor: loaded ? "primary.main" : "divider",
                              bgcolor: loaded ? "primary.light" : "grey.100",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              position: "relative",
                            }}
                            onClick={() => { setEditingMaterialSlot(slot); setMaterialSlotDialogOpen(true); }}
                          >
                            <Typography variant="caption" fontWeight={600}>
                              {slot.slotPosition}
                            </Typography>
                          </Box>
                        </Tooltip>
                      );
                    })}
                  </Box>
                </Box>
              );
            })}
        </Box>

        {/* Accessories */}
        <Box>
          <SectionHeader title="Accessories" onAdd={() => { setEditingAccessory(null); setAccessoryDialogOpen(true); }} />
          {accessories.length > 0 && (
            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
              {accessories.map((acc) => (
                <Chip
                  key={acc.id}
                  label={`${acc.name}${acc.manufacturer ? ` (${acc.manufacturer})` : ""}`}
                  size="small"
                  color={acc.isActive ? "primary" : "default"}
                  variant="outlined"
                  onDelete={() => accessoryUndo.handleDelete(acc)}
                  onClick={() => { setEditingAccessory(acc); setAccessoryDialogOpen(true); }}
                />
              ))}
            </Stack>
          )}
        </Box>
      </Stack>

      {/* Dialogs */}
      <ToolHeadDialog
        open={toolHeadDialogOpen}
        onClose={() => { setToolHeadDialogOpen(false); setEditingToolHead(null); }}
        onSaved={onRefresh}
        machineId={machineId}
        existing={editingToolHead}
      />
      <WorkSurfaceDialog
        open={workSurfaceDialogOpen}
        onClose={() => { setWorkSurfaceDialogOpen(false); setEditingWorkSurface(null); }}
        onSaved={onRefresh}
        machineId={machineId}
        existing={editingWorkSurface}
      />
      <MaterialSlotDialog
        open={materialSlotDialogOpen}
        onClose={() => { setMaterialSlotDialogOpen(false); setEditingMaterialSlot(null); }}
        onSaved={onRefresh}
        machineId={machineId}
        existing={editingMaterialSlot}
      />
      <AccessoryDialog
        open={accessoryDialogOpen}
        onClose={() => { setAccessoryDialogOpen(false); setEditingAccessory(null); }}
        onSaved={onRefresh}
        machineId={machineId}
        existing={editingAccessory}
      />

      {/* Snackbars for undo */}
      {[toolHeadUndo, workSurfaceUndo, materialSlotUndo, accessoryUndo].map((undo, i) => (
        <Snackbar
          key={i}
          open={undo.snackbarOpen}
          autoHideDuration={6000}
          onClose={undo.handleSnackbarClose}
          message={undo.snackbarMessage}
          action={
            <Button color="inherit" size="small" onClick={undo.handleUndo}>
              UNDO
            </Button>
          }
        />
      ))}
    </>
  );
}
