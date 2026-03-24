"use client";

import { useState, useEffect } from "react";
import { Pencil, Trash2, ChevronUp, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { listMyMachines, getMachineWithRelations, removeMachine, createMachine } from "@/lib/actions/user-library";
import { MachineDialog } from "@/components/hardware/machine-dialog";
import { useDeleteWithUndo } from "@/components/hardware/use-delete-with-undo";
import { MachineDetail } from "./machine-detail";
import { toast } from "sonner";

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

// -- Status colors matching Stitch design --

const STATUS_COLORS = {
  online: "#00E676",
  idle: "#00E676",
  offline: "#94A3B8",
  printing: "#00D2FF",
  paused: "#FFB229",
  finishing: "#00E676",
  error: "#FF2A5F",
  busy: "#00D2FF",
} as const;

function getStatusColor(state: string | undefined): string {
  if (!state) return STATUS_COLORS.offline;
  return STATUS_COLORS[state as keyof typeof STATUS_COLORS] ?? STATUS_COLORS.offline;
}

function getStatusLabel(state: string | undefined): string {
  if (!state) return "Offline";
  const labels: Record<string, string> = {
    idle: "Online",
    printing: "Printing",
    paused: "Paused",
    finishing: "Finishing",
    error: "Error",
    busy: "Busy",
  };
  return labels[state] ?? state.charAt(0).toUpperCase() + state.slice(1);
}

function getBorderColor(state: string | undefined): string {
  if (!state) return STATUS_COLORS.offline;
  if (state === "printing") return STATUS_COLORS.printing;
  if (state === "error") return STATUS_COLORS.error;
  if (state === "paused") return STATUS_COLORS.paused;
  if (state === "idle" || state === "finishing") return STATUS_COLORS.online;
  return STATUS_COLORS.offline;
}

// -- Helpers --

function formatTime(seconds: number): string {
  if (seconds <= 0) return "--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

const DISPLAY_FONT = "var(--font-display), 'Space Grotesk', sans-serif";

// -- Progress Ring SVG --

function ProgressRing({ progress }: { progress: number }) {
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (progress / 100) * c;
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[2px]">
      <div className="relative w-24 h-24">
        <svg width="96" height="96" style={{ transform: "rotate(-90deg)" }}>
          <circle cx="48" cy="48" r={r} fill="transparent" stroke="rgba(255,255,255,0.2)" strokeWidth="6" />
          <circle cx="48" cy="48" r={r} fill="transparent" stroke={STATUS_COLORS.printing} strokeWidth="6" strokeDasharray={c} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-xl font-bold text-white">{progress}%</span>
        </div>
      </div>
    </div>
  );
}

// -- Inline live status panel --

function TempDisplay({ label, current, target }: { label: string; current: number; target?: number }) {
  const active = (target ?? 0) > 0;
  return (
    <div className="text-center">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className={`text-lg font-semibold ${active ? "text-primary" : ""}`}>
        {Math.round(current)}{"\u00B0"}C
      </p>
      {active && target != null && (
        <span className="text-xs text-muted-foreground">/ {Math.round(target)}{"\u00B0"}C</span>
      )}
    </div>
  );
}

function MachineLiveStatus({ status }: { status: Record<string, any> }) {
  const s = status;
  const temps = s.temperatures ?? {};
  const job = s.job;
  const slots = (s.materialSlots ?? []) as Array<Record<string, any>>;
  const hasJob = s.state === "printing" || s.state === "paused" || s.state === "finishing";

  return (
    <div className="border rounded-lg p-3 mb-2 bg-muted/50">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <Badge style={{ backgroundColor: getStatusColor(s.state), color: "#fff" }}>
          {s.state?.toUpperCase() || "UNKNOWN"}
        </Badge>
        {s.protocol && <Badge variant="outline">{s.protocol}</Badge>}
        {job?.name && <span className="text-sm font-medium truncate flex-1">{job.name}</span>}
        {s.wifiSignal != null && (
          <span className="text-xs text-muted-foreground">WiFi: {s.wifiSignal}dBm</span>
        )}
      </div>

      {hasJob && job && (
        <div className="mb-3">
          <div className="flex justify-between mb-1">
            <span className="text-sm font-medium">{job.progress ?? 0}%</span>
            {job.currentLayer != null && job.totalLayers != null && (
              <span className="text-sm text-muted-foreground">Layer {job.currentLayer} / {job.totalLayers}</span>
            )}
            {job.remainingTime != null && (
              <span className="text-sm text-muted-foreground">{formatTime(job.remainingTime)} remaining</span>
            )}
          </div>
          <Progress value={job.progress ?? 0} className="h-2" />
        </div>
      )}

      {(temps.nozzle || temps.bed || temps.chamber) && (
        <div className="flex gap-6 mb-3">
          {temps.nozzle && <TempDisplay label="Nozzle" current={temps.nozzle.current} target={temps.nozzle.target} />}
          {temps.bed && <TempDisplay label="Bed" current={temps.bed.current} target={temps.bed.target} />}
          {temps.chamber && <TempDisplay label="Chamber" current={temps.chamber.current} target={temps.chamber.target} />}
        </div>
      )}

      {(s.spindleRpm != null || s.laserPower != null || s.feedRate != null) && (
        <div className="flex gap-6 mb-3">
          {s.spindleRpm != null && (
            <div className="text-center">
              <span className="text-xs text-muted-foreground">Spindle</span>
              <p className="text-lg font-semibold">{s.spindleRpm} RPM</p>
            </div>
          )}
          {s.laserPower != null && (
            <div className="text-center">
              <span className="text-xs text-muted-foreground">Laser</span>
              <p className="text-lg font-semibold">{s.laserPower}%</p>
            </div>
          )}
          {s.feedRate != null && (
            <div className="text-center">
              <span className="text-xs text-muted-foreground">Feed Rate</span>
              <p className="text-lg font-semibold">{s.feedRate} mm/min</p>
            </div>
          )}
        </div>
      )}

      {s.position && (
        <span className="text-xs text-muted-foreground block mb-1">
          Position: X{s.position.x?.toFixed(2)} Y{s.position.y?.toFixed(2)} Z{s.position.z?.toFixed(2)}
        </span>
      )}

      {slots.length > 0 && (
        <>
          <span className="text-xs text-muted-foreground font-semibold block mb-1">
            Material Slots ({slots.length})
          </span>
          <div className="grid grid-cols-6 gap-2">
            {slots.map((slot, i) => {
              const colorHex = slot.color
                ? `#${(slot.color >>> 8).toString(16).padStart(6, "0")}`
                : "#ccc";
              return (
                <div key={i} className="border rounded p-1.5 text-center">
                  <div className="w-6 h-6 rounded-full mx-auto mb-1 border-2 border-border" style={{ backgroundColor: colorHex }} />
                  <span className="text-xs font-semibold block">{slot.material || "--"}</span>
                  {slot.remaining != null && (
                    <span className="text-xs text-muted-foreground">{slot.remaining}%</span>
                  )}
                  {slot.humidity != null && (
                    <span className="text-xs text-muted-foreground block">{slot.humidity}% RH</span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {s.error && (
        <span className="text-xs text-destructive block mt-1">
          {s.error.message || `Error code: ${s.error.code}`}
        </span>
      )}
    </div>
  );
}

// -- Machine Card --

function MachineCard({
  machine,
  expanded,
  details,
  onToggle,
  onEdit,
  onDelete,
  onDetailRefresh,
}: {
  machine: Machine;
  expanded: boolean;
  details: MachineWithRelations | undefined;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDetailRefresh: () => void;
}) {
  const status = machine.liveStatus;
  const state = status?.state as string | undefined;
  const isPrinting = state === "printing";
  const borderColor = getBorderColor(state);
  const statusColor = getStatusColor(state);
  const statusLabel = getStatusLabel(state);
  const job = status?.job;
  const progress = job?.progress ?? 0;
  const materialSlots = (status?.materialSlots ?? []) as Array<Record<string, any>>;
  const firstSlot = materialSlots[0];
  const modelText = [machine.manufacturer, machine.model].filter(Boolean).join(" ");

  return (
    <div
      onClick={onToggle}
      className="rounded-xl shadow-sm overflow-hidden cursor-pointer transition-all hover:-translate-y-1 hover:shadow-md ring-1 ring-foreground/10 bg-card"
      style={{ borderTop: `4px solid ${borderColor}` }}
    >
      <div className="p-4">
        {/* Header: name + status badge */}
        <div className="flex justify-between items-start mb-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-bold text-[1.1rem] leading-tight truncate" style={{ fontFamily: DISPLAY_FONT }}>
              {machine.name}
            </h3>
            {modelText && (
              <span className="text-xs text-muted-foreground font-medium truncate block">{modelText}</span>
            )}
          </div>
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full shrink-0 ml-2"
            style={{ backgroundColor: `${statusColor}14` }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: statusColor,
                ...(isPrinting ? { animation: "pulse 2s ease-in-out infinite" } : {}),
              }}
            />
            <span
              className="text-[0.625rem] font-bold uppercase tracking-wider"
              style={{ color: statusColor, fontFamily: DISPLAY_FONT }}
            >
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Machine thumbnail area */}
        <div
          className="aspect-square w-full rounded-lg bg-muted overflow-hidden mb-4 relative flex items-center justify-center"
          style={{
            ...(!state || state === "offline"
              ? { filter: "grayscale(1)", opacity: 0.4 }
              : state === "idle"
                ? { filter: "grayscale(0.6)", opacity: 0.8 }
                : {}),
          }}
        >
          <Factory className="size-16 text-muted-foreground" />
          {isPrinting && job && <ProgressRing progress={progress} />}
        </div>

        {/* Info rows */}
        <div className="flex flex-col gap-3">
          {/* Material loaded */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Material Loaded</span>
            {firstSlot ? (
              <span className="flex items-center gap-1 bg-muted px-2 py-0.5 rounded text-xs font-bold">
                {firstSlot.color != null && (
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: `#${(firstSlot.color >>> 8).toString(16).padStart(6, "0")}` }} />
                )}
                {firstSlot.material || "--"}
              </span>
            ) : (
              <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded">None</span>
            )}
          </div>

          {/* Machine type */}
          <div className="flex justify-between items-center">
            <span className="text-xs text-muted-foreground">Type</span>
            <span className="text-xs font-mono font-medium">{machine.machineType?.toUpperCase() ?? "--"}</span>
          </div>

          {/* Build volume if present */}
          {machine.buildVolumeX != null && machine.buildVolumeY != null && machine.buildVolumeZ != null && (
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Build Volume</span>
              <span className="text-xs font-mono font-medium">
                {machine.buildVolumeX} x {machine.buildVolumeY} x {machine.buildVolumeZ}
              </span>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-1 justify-end mt-3 pt-3 border-t border-border">
          <button
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
          >
            <Pencil className="size-4" />
          </button>
          <button
            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {/* Expanded detail panel */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border">
          <div className="flex items-center justify-between my-2">
            <span className="font-bold text-sm" style={{ fontFamily: DISPLAY_FONT }}>Details</span>
            <button
              className="p-1 rounded-md hover:bg-muted"
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
            >
              <ChevronUp className="size-4" />
            </button>
          </div>

          {status && <MachineLiveStatus status={status} />}

          {details ? (
            <MachineDetail
              machineId={machine.id}
              machineType={details.machineType}
              toolHeads={details.toolHeads}
              workSurfaces={details.workSurfaces}
              materialSlots={details.materialSlots}
              accessories={details.accessories}
              onRefresh={onDetailRefresh}
            />
          ) : (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-24 rounded-lg" />
              <Skeleton className="h-24 rounded-lg" />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -- Fleet Summary Bar --

function FleetSummary({ machines }: { machines: Machine[] }) {
  const total = machines.length;
  const online = machines.filter((m) => {
    const s = m.liveStatus?.state;
    return s && s !== "offline" && s !== "error";
  }).length;
  const printing = machines.filter((m) => m.liveStatus?.state === "printing").length;
  const offline = total - online;

  return (
    <div className="mt-4 px-4 py-2.5 flex items-center gap-4 rounded-xl border bg-card flex-wrap">
      <span className="font-bold text-sm" style={{ fontFamily: DISPLAY_FONT }}>
        {total} Machine{total !== 1 ? "s" : ""}
      </span>
      <div className="w-0.5 h-4 bg-border rounded" />
      <div className="flex gap-4">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.online }} />
          <span className="font-bold text-xs" style={{ fontFamily: DISPLAY_FONT }}>{online} Online</span>
        </div>
        {printing > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.printing }} />
            <span className="font-bold text-xs" style={{ fontFamily: DISPLAY_FONT }}>{printing} Printing</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS.offline }} />
          <span className="font-bold text-xs" style={{ fontFamily: DISPLAY_FONT }}>{offline} Offline</span>
        </div>
      </div>
    </div>
  );
}

// -- Main Component --

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

  // Show toast when snackbar triggers
  useEffect(() => {
    if (snackbarOpen && snackbarMessage) {
      toast(snackbarMessage, {
        action: { label: "UNDO", onClick: handleUndo },
        duration: 6000,
        onAutoClose: () => handleSnackbarClose(),
        onDismiss: () => handleSnackbarClose(),
      });
    }
  }, [snackbarOpen, snackbarMessage, handleUndo, handleSnackbarClose]);

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

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-96 rounded-xl" />
        ))}
      </div>
    );
  }

  if (machines.length === 0) {
    return (
      <div className="text-center py-8">
        <Factory className="size-12 text-muted-foreground mx-auto mb-1" />
        <p className="font-medium">No machines configured</p>
        <p className="text-sm text-muted-foreground">
          Add your first machine to track tool heads, work surfaces, and more.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {machines.map((machine) => (
          <MachineCard
            key={machine.id}
            machine={machine}
            expanded={expandedId === machine.id}
            details={details[machine.id]}
            onToggle={() => handleToggle(machine.id)}
            onEdit={() => {
              setEditingMachine(machine);
              setEditDialogOpen(true);
            }}
            onDelete={() => handleDelete(machine)}
            onDetailRefresh={handleDetailRefresh}
          />
        ))}
      </div>

      <FleetSummary machines={machines} />

      <MachineDialog
        open={editDialogOpen}
        onClose={() => { setEditDialogOpen(false); setEditingMachine(null); }}
        onSaved={() => { loadData(); if (expandedId) loadDetails(expandedId); }}
        existing={editingMachine}
      />
    </>
  );
}
