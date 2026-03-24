"use client";

import { useState, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
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
import { toast } from "sonner";

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

const wearVariant: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  new: "default",
  good: "secondary",
  worn: "outline",
  replace: "destructive",
};

const changerLabels: Record<string, string> = {
  ams: "AMS",
  ams_lite: "AMS Lite",
  mmu: "MMU",
  manual: "Manual",
};

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center gap-2 mb-1">
      <span className="text-sm font-semibold">{title}</span>
      <button className="p-0.5 rounded-md hover:bg-muted" onClick={onAdd}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

function ActionButtons({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex gap-1">
      <button className="p-1 rounded-md hover:bg-muted" onClick={onEdit}><Pencil className="size-3.5" /></button>
      <button className="p-1 rounded-md hover:bg-muted" onClick={onDelete}><Trash2 className="size-3.5" /></button>
    </div>
  );
}

function useUndoToast(undo: { snackbarOpen: boolean; snackbarMessage: string; handleUndo: () => Promise<void>; handleSnackbarClose: (...args: any[]) => void }) {
  useEffect(() => {
    if (undo.snackbarOpen && undo.snackbarMessage) {
      toast(undo.snackbarMessage, {
        action: { label: "UNDO", onClick: undo.handleUndo },
        duration: 6000,
        onAutoClose: () => undo.handleSnackbarClose(),
        onDismiss: () => undo.handleSnackbarClose(),
      });
    }
  }, [undo.snackbarOpen, undo.snackbarMessage, undo.handleUndo, undo.handleSnackbarClose]);
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

  // Wire up toasts
  useUndoToast(toolHeadUndo);
  useUndoToast(workSurfaceUndo);
  useUndoToast(materialSlotUndo);
  useUndoToast(accessoryUndo);

  const maxUnit = materialSlots.length > 0 ? Math.max(...materialSlots.map((s) => s.unitNumber)) : 0;
  const changerType = materialSlots.length > 0 ? materialSlots[0].changerType : null;

  // Group tool heads by category
  const nozzles = toolHeads.filter((t) => t.toolCategory === "nozzle");
  const bits = toolHeads.filter((t) => t.toolCategory === "spindle_bit");
  const lasers = toolHeads.filter((t) => t.toolCategory === "laser_module");

  return (
    <TooltipProvider>
      <>
        <div className="flex flex-col gap-4 pt-1">
          {/* Nozzles */}
          {(nozzles.length > 0 || true) && (
            <div>
              <SectionHeader title="Nozzles" onAdd={() => { setEditingToolHead(null); setToolHeadDialogOpen(true); }} />
              {nozzles.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Diameter</TableHead>
                      <TableHead>Material</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Wear</TableHead>
                      <TableHead>Installs</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {nozzles.map((n) => (
                      <TableRow key={n.id}>
                        <TableCell>{n.diameterMm}mm</TableCell>
                        <TableCell className="capitalize">{n.nozzleMaterial?.replace(/_/g, " ") ?? "\u2014"}</TableCell>
                        <TableCell className="uppercase">{n.nozzleType ?? "\u2014"}</TableCell>
                        <TableCell>
                          <Badge variant={n.isInstalled ? "default" : "outline"}>
                            {n.isInstalled ? "Installed" : "Spare"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={wearVariant[n.wearLevel] ?? "outline"}>{n.wearLevel}</Badge>
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
              )}
            </div>
          )}

          {/* Spindle Bits */}
          {bits.length > 0 && (
            <div>
              <span className="text-sm font-semibold mb-1 block">Spindle Bits</span>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Diameter</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Flutes</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Wear</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bits.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell>{b.name ?? "\u2014"}</TableCell>
                      <TableCell>{b.bitDiameterMm != null ? `${b.bitDiameterMm}mm` : "\u2014"}</TableCell>
                      <TableCell className="capitalize">{b.bitType?.replace(/_/g, " ") ?? "\u2014"}</TableCell>
                      <TableCell>{b.fluteCount ?? "\u2014"}</TableCell>
                      <TableCell className="capitalize">{b.bitMaterial?.replace(/_/g, " ") ?? "\u2014"}</TableCell>
                      <TableCell>
                        <Badge variant={b.isInstalled ? "default" : "outline"}>{b.isInstalled ? "Installed" : "Spare"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={wearVariant[b.wearLevel] ?? "outline"}>{b.wearLevel}</Badge>
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
            </div>
          )}

          {/* Laser Modules */}
          {lasers.length > 0 && (
            <div>
              <span className="text-sm font-semibold mb-1 block">Laser Modules</span>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Power</TableHead>
                    <TableHead>Wavelength</TableHead>
                    <TableHead>Focal Length</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Wear</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {lasers.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.name ?? "\u2014"}</TableCell>
                      <TableCell>{l.laserPowerW != null ? `${l.laserPowerW}W` : "\u2014"}</TableCell>
                      <TableCell>{l.laserWavelengthNm != null ? `${l.laserWavelengthNm}nm` : "\u2014"}</TableCell>
                      <TableCell>{l.focalLengthMm != null ? `${l.focalLengthMm}mm` : "\u2014"}</TableCell>
                      <TableCell>
                        <Badge variant={l.isInstalled ? "default" : "outline"}>{l.isInstalled ? "Installed" : "Spare"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={wearVariant[l.wearLevel] ?? "outline"}>{l.wearLevel}</Badge>
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
            </div>
          )}

          {/* Work Surfaces */}
          <div>
            <SectionHeader title="Work Surfaces" onAdd={() => { setEditingWorkSurface(null); setWorkSurfaceDialogOpen(true); }} />
            {workSurfaces.length > 0 && (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Condition</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {workSurfaces.map((ws) => (
                    <TableRow key={ws.id}>
                      <TableCell>{ws.name}</TableCell>
                      <TableCell className="capitalize">{ws.type.replace(/_/g, " ")}</TableCell>
                      <TableCell>
                        <Badge variant={ws.isInstalled ? "default" : "outline"}>{ws.isInstalled ? "Installed" : "Spare"}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={wearVariant[ws.surfaceCondition] ?? "outline"}>{ws.surfaceCondition}</Badge>
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
            )}
          </div>

          {/* Material Slots */}
          <div>
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
                  <div key={unit} className="mb-1">
                    <span className="text-xs text-muted-foreground block mb-1">Unit {unit}</span>
                    <div className="flex gap-1">
                      {unitSlots.map((slot) => {
                        const loaded = !!(slot as any).spoolId;
                        return (
                          <Tooltip key={slot.id}>
                            <TooltipTrigger>
                              <div
                                className="w-10 h-10 rounded-lg border-2 flex items-center justify-center cursor-pointer"
                                style={{
                                  borderColor: loaded ? "var(--primary)" : "var(--border)",
                                  backgroundColor: loaded ? "hsl(var(--primary) / 0.1)" : "var(--muted)",
                                }}
                                onClick={() => { setEditingMaterialSlot(slot); setMaterialSlotDialogOpen(true); }}
                              >
                                <span className="text-xs font-semibold">{slot.slotPosition}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {loaded ? `Slot ${slot.slotPosition}: Spool loaded` : `Slot ${slot.slotPosition}: Empty`}
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>

          {/* Accessories */}
          <div>
            <SectionHeader title="Accessories" onAdd={() => { setEditingAccessory(null); setAccessoryDialogOpen(true); }} />
            {accessories.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {accessories.map((acc) => (
                  <Badge
                    key={acc.id}
                    variant={acc.isActive ? "default" : "outline"}
                    className="cursor-pointer"
                    onClick={() => { setEditingAccessory(acc); setAccessoryDialogOpen(true); }}
                  >
                    {acc.name}{acc.manufacturer ? ` (${acc.manufacturer})` : ""}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

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
      </>
    </TooltipProvider>
  );
}
