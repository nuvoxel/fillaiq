"use client";

import { useState, createContext, useContext, useCallback, useRef, useEffect } from "react";
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  Plus,
  Trash2,
  Printer,
  Pencil,
  ArrowLeftRight,
  ExternalLink,
  CircleMinus,
  Wrench,
  FlaskConical,
  Cpu,
  HardHat,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

// ── Types ─────────────────────────────────────────────────────────────────────

type SlotStatusData = {
  state: string;
  nfcUid?: string | null;
  [key: string]: unknown;
};
type SlotData = {
  id: string;
  position: number;
  label?: string | null;
  address?: string | null;
  nfcTagId?: string | null;
  status?: SlotStatusData | null;
  shape?: SlotShape | null;
  colSpan?: number | null;
  rowSpan?: number | null;
};
type BayData = {
  id: string;
  position: number;
  label?: string | null;
  displayStyle?: RackDisplayStyle | null;
  slots: SlotData[];
};
type ShelfData = {
  id: string;
  position: number;
  label?: string | null;
  displayStyle?: RackDisplayStyle | null;
  bays: BayData[];
};
type RackTopology = {
  id: string;
  name?: string;
  columns?: number | null;
  displayStyle?: RackDisplayStyle | null;
  shelves: ShelfData[];
};

// ── Display styles ────────────────────────────────────────────────────────────

export type RackDisplayStyle = "shelf" | "drawer" | "ams" | "grid";

export const DISPLAY_STYLE_LABELS: Record<RackDisplayStyle, string> = {
  shelf: "Open Shelving",
  drawer: "Cabinet / Drawers",
  ams: "AMS / Compact",
  grid: "Grid / Flat",
};

// ── Callbacks ─────────────────────────────────────────────────────────────────

export type RackVisualizerCallbacks = {
  onSaveSlotLabel?: (id: string, label: string) => void;
  onDeleteSlot?: (id: string) => void;
  onAddSlotToBay?: (bayId: string, currentSlots: SlotData[]) => void;
  onSaveBayLabel?: (id: string, label: string) => void;
  onDeleteBay?: (id: string) => void;
  onAddBayToShelf?: (shelfId: string, currentBays: BayData[]) => void;
  onSaveShelf?: (id: string, updates: { label?: string | null; position?: number }) => void;
  onDeleteShelf?: (id: string) => void;
  onAddShelfToRack?: (rackId: string, currentShelves: ShelfData[]) => void;
  onPrintSlot?: (slot: SlotData, context: string) => void;
  onSlotClick?: (slot: SlotData) => void;
  onViewItem?: (itemId: string) => void;
  onEditItem?: (itemId: string) => void;
  onRemoveItem?: (slotId: string) => void;
  onMoveItem?: (slotId: string) => void;
  onDragMoveItem?: (itemId: string, fromSlotId: string, toSlotId: string) => void;
};

// ── Spool ring color map ──────────────────────────────────────────────────────

const SPOOL_COLORS: Record<string, { base: string; mid: string; hub: string }> = {
  active: { base: "#00E676", mid: "#00C853", hub: "#00A844" },
  empty: { base: "#94A3B8", mid: "#64748B", hub: "#475569" },
  error: { base: "#FF2A5F", mid: "#E0224F", hub: "#B01A3F" },
  detecting: { base: "#FF7A00", mid: "#E56A00", hub: "#B35400" },
  unknown_spool: { base: "#7C3AED", mid: "#5B21B6", hub: "#3B0764" },
  removed: { base: "#64748B", mid: "#475569", hub: "#374151" },
};
const DEFAULT_COLORS = SPOOL_COLORS.empty;

// Icon + color config for non-spool/box package types
const ICON_PACKAGE_TYPES: Record<string, { icon: typeof Wrench; bg: string; fg: string }> = {
  tool:                 { icon: Wrench,       bg: "linear-gradient(180deg, #546E7A 0%, #37474F 100%)", fg: "#CFD8DC" },
  bolt:                 { icon: HardHat,      bg: "linear-gradient(180deg, #78909C 0%, #455A64 100%)", fg: "#ECEFF1" },
  nut:                  { icon: HardHat,      bg: "linear-gradient(180deg, #8D6E63 0%, #5D4037 100%)", fg: "#D7CCC8" },
  screw:                { icon: HardHat,      bg: "linear-gradient(180deg, #90A4AE 0%, #607D8B 100%)", fg: "#ECEFF1" },
  electronic_component: { icon: Cpu,          bg: "linear-gradient(180deg, #1B5E20 0%, #0D3B13 100%)", fg: "#A5D6A7" },
  bottle:               { icon: FlaskConical, bg: "linear-gradient(180deg, #4FC3F7 0%, #0288D1 100%)", fg: "#E1F5FE" },
};

// ── Slot selection context (avoids threading props through every component) ──

const SlotSelectionContext = createContext<{
  selectedSlotId: string | null;
  onSlotClick: ((slot: SlotData) => void) | null;
  onViewItem: ((itemId: string) => void) | null;
  onEditItem: ((itemId: string) => void) | null;
  onRemoveItem: ((slotId: string) => void) | null;
  onMoveItem: ((slotId: string) => void) | null;
  onPrintSlot: ((slot: SlotData, context: string) => void) | null;
  onDragMoveItem: ((itemId: string, fromSlotId: string, toSlotId: string) => void) | null;
  draggingSlotId: string | null;
  ctxMenuSlotId: string | null;
  ctxMenuPos: { x: number; y: number } | null;
  openCtxMenu: (slotId: string, x: number, y: number, slot?: SlotData, ctx?: string) => void;
  closeCtxMenu: () => void;
}>({ selectedSlotId: null, onSlotClick: null, onViewItem: null, onEditItem: null, onRemoveItem: null, onMoveItem: null, onPrintSlot: null, onDragMoveItem: null, draggingSlotId: null, ctxMenuSlotId: null, ctxMenuPos: null, openCtxMenu: () => {}, closeCtxMenu: () => {} });

// ── NFC Badge ─────────────────────────────────────────────────────────────────

function NfcBadge() {
  return (
    <span
      className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-sky-500 flex items-center justify-center z-[1]"
      style={{ border: "1.5px solid #fff", boxShadow: "0 1px 3px rgba(0,0,0,0.3)" }}
    >
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
        <path d="M5 8 C5 8 2 6.5 2 5 C2 3.5 3.34 2 5 2" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <path d="M5 6 C5 6 3.5 5.5 3.5 5 C3.5 4.1 4.17 3.5 5 3.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" fill="none" />
        <circle cx="5" cy="5" r="0.8" fill="white" />
      </svg>
    </span>
  );
}

// ── Slot shape types ──────────────────────────────────────────────────────────

export type SlotShape = "spool" | "cell";

// ── Slot Cell (generic — works for any item) ─────────────────────────────────

const CELL_GAP = 4;

function SlotCell({
  slot,
  size = 44,
  shape = "cell",
  context,
  onSaveLabel,
  onDelete,
  onPrint,
}: {
  slot: SlotData;
  size?: number;
  shape?: SlotShape;
  context?: string;
  onSaveLabel?: (label: string) => void;
  onDelete?: () => void;
  onPrint?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editLabel, setEditLabel] = useState(slot.label ?? "");
  const selection = useContext(SlotSelectionContext);
  const isSelected = selection.selectedSlotId === slot.id;
  const ctxMenuOpen = selection.ctxMenuSlotId === slot.id;

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    selection.openCtxMenu(slot.id, e.clientX, e.clientY, slot, context);
  };

  const colSpan = slot.colSpan ?? 1;
  const rowSpan = slot.rowSpan ?? 1;
  const w = size * colSpan + CELL_GAP * (colSpan - 1);
  const h = size * rowSpan + CELL_GAP * (rowSpan - 1);

  const state = slot.status?.state ?? "empty";

  const isDraggable = state === "active" && !!selection.onDragMoveItem;
  const itemId = (slot.status as any)?.userItemId as string | undefined;
  const { attributes: dragAttrs, listeners: dragListeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: `drag-${slot.id}`,
    data: { slotId: slot.id, itemId },
    disabled: !isDraggable,
  });
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: `drop-${slot.id}`,
    data: { slotId: slot.id },
  });
  const setRefs = useCallback((node: HTMLElement | null) => {
    setDragRef(node);
    setDropRef(node);
  }, [setDragRef, setDropRef]);
  const hasNfc = Boolean(slot.nfcTagId || slot.status?.nfcUid);
  const itemColorHex = (slot.status as any)?.colorHex as string | undefined;
  const colors = itemColorHex && state === "active"
    ? { base: itemColorHex, mid: itemColorHex, hub: "#0D0D0D" }
    : (SPOOL_COLORS[state] ?? DEFAULT_COLORS);
  const label = slot.label ?? String(slot.position);

  const commit = () => {
    const trimmed = editLabel.trim();
    if (trimmed !== (slot.label ?? "") && onSaveLabel) onSaveLabel(trimmed);
    setEditing(false);
  };

  const packageType = (slot.status as any)?.packageType as string | undefined;
  const isSpool = (shape === "spool" || packageType === "spool" || (state === "active" && !packageType)) && colSpan === 1 && rowSpan === 1;
  const radius = isSpool ? "50%" : `${Math.round(size * 0.18)}px`;

  const minDim = Math.min(w, h);
  const r1 = Math.round(minDim * 0.135);
  const r2 = Math.round(minDim * 0.31);
  const r3 = Math.round(minDim * 0.42);

  const spanLabel = colSpan > 1 || rowSpan > 1 ? ` (${colSpan}\u00d7${rowSpan})` : "";

  if (editing) {
    return (
      <div
        style={{
          width: w, height: h, borderRadius: radius,
          backgroundColor: colors.hub,
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          flexShrink: 0, border: "2px solid hsl(var(--primary))", gap: 2,
        }}
      >
        <input
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setEditLabel(slot.label ?? ""); setEditing(false); }
          }}
          autoFocus
          placeholder={String(slot.position)}
          style={{
            fontSize: size < 40 ? 7 : 9, color: "#fff", width: w * 0.7,
            padding: 0, textAlign: "center", background: "transparent", border: "none", outline: "none",
          }}
        />
        {onDelete && (
          <button
            className="p-0"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 style={{ width: 10, height: 10, color: "#ef9a9a" }} />
          </button>
        )}
      </div>
    );
  }

  const statusData = slot.status as any;
  const productName = statusData?.productName;
  const brandName = statusData?.brandName;
  const weightG = statusData?.weightStableG as number | undefined;
  const pctRemaining = statusData?.percentRemaining as number | undefined;
  const initialWeightG = statusData?.initialWeightG as number | undefined;

  // We use title attribute for simple tooltip since the rich tooltip from MUI
  // with complex JSX content is difficult to replicate exactly with shadcn Tooltip.
  // The visual slots already convey the key information.
  const tooltipText = state === "active"
    ? `${productName ?? "Unknown"}${brandName ? ` (${brandName})` : ""}${weightG != null ? ` \u2022 ${Math.round(weightG)}g` : ""}${pctRemaining != null ? ` \u2022 ${pctRemaining}%` : ""}`
    : `Slot ${label}${spanLabel}${context ? ` \u2022 ${context}` : ""} \u2022 Available`;

  return (
    <>
    <div
      ref={setRefs}
      {...(isDraggable ? { ...dragAttrs, ...dragListeners } : {})}
      onContextMenu={handleContextMenu}
      onClick={(e) => {
        e.stopPropagation();
        if (selection.onSlotClick) selection.onSlotClick(slot);
      }}
      title={isDragging ? undefined : tooltipText}
      style={{
        display: "inline-flex",
        opacity: isDragging ? 0.3 : 1,
        touchAction: isDraggable ? "none" : undefined,
        cursor: isDraggable ? "grab" : selection.onSlotClick ? "pointer" : undefined,
        outline: isOver && !isDragging ? "2px dashed #1976d2" : undefined,
        outlineOffset: 3,
        borderRadius: 4,
      }}
    >
      {/* Spool side-view: flanges + filament, wider than tall */}
      {state === "active" && isSpool ? (() => {
        const fil = itemColorHex ?? colors.base;
        const spoolW = Math.round(size * 0.7);
        const spoolH = Math.round(size * 1.0);
        const flangeW = Math.round(spoolW * 0.12);
        const flangeR = Math.round(spoolH * 0.12);
        return (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (selection.onSlotClick) selection.onSlotClick(slot);
            else if (onSaveLabel) { setEditLabel(slot.label ?? ""); setEditing(true); }
          }}
          style={{
            position: "relative",
            width: spoolW, height: spoolH, flexShrink: 0,
            cursor: selection.onSlotClick || onSaveLabel ? "pointer" : "default",
            outline: isSelected ? "3px solid hsl(var(--primary))" : "none",
            outlineOffset: 2,
            display: "flex", flexDirection: "row", alignItems: "stretch",
            overflow: "hidden",
            transition: "transform 0.12s ease, outline 0.12s ease",
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
          }}
          className="hover:scale-108 hover:-translate-y-0.5 hover:z-[2]"
        >
          <div style={{
            width: flangeW,
            borderRadius: `${flangeR}px 0 0 ${flangeR}px`,
            background: "linear-gradient(180deg, #888 0%, #555 40%, #444 60%, #333 100%)",
            boxShadow: "inset -1px 0 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
          }} />
          <div style={{
            flex: 1, position: "relative",
            background: `linear-gradient(180deg,
              color-mix(in srgb, ${fil} 50%, white) 0%,
              color-mix(in srgb, ${fil} 80%, white) 8%,
              ${fil} 25%,
              color-mix(in srgb, ${fil} 90%, black) 55%,
              color-mix(in srgb, ${fil} 70%, black) 85%,
              color-mix(in srgb, ${fil} 50%, black) 100%)`,
          }}>
            <div style={{
              position: "absolute", inset: 0, opacity: 0.08,
              background: `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.6) 1px, rgba(255,255,255,0.6) 2px)`,
            }} />
          </div>
          <div style={{
            width: flangeW,
            borderRadius: `0 ${flangeR}px ${flangeR}px 0`,
            background: "linear-gradient(180deg, #777 0%, #4a4a4a 40%, #3a3a3a 60%, #2a2a2a 100%)",
            boxShadow: "inset 1px 0 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
          }} />
          {hasNfc && <span style={{ position: "absolute", top: 1, right: 1 }}><NfcBadge /></span>}
        </div>
        );
      })() : state === "active" && packageType === "box" ? (() => {
        const fil = itemColorHex ?? "#888";
        const boxW = Math.round(size * 0.85);
        const boxH = Math.round(size * 0.95);
        const r = Math.round(size * 0.08);
        return (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (selection.onSlotClick) selection.onSlotClick(slot);
            else if (onSaveLabel) { setEditLabel(slot.label ?? ""); setEditing(true); }
          }}
          style={{
            position: "relative", width: boxW, height: boxH, flexShrink: 0,
            cursor: selection.onSlotClick || onSaveLabel ? "pointer" : "default",
            outline: isSelected ? "3px solid hsl(var(--primary))" : "none",
            outlineOffset: 2,
            borderRadius: `${r}px`,
            background: "linear-gradient(180deg, #A1887F 0%, #8D6E63 30%, #795548 70%, #5D4037 100%)",
            boxShadow: "0 2px 5px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
            overflow: "hidden",
            transition: "transform 0.12s ease, outline 0.12s ease",
          }}
          className="hover:scale-108 hover:-translate-y-0.5 hover:z-[2]"
        >
          <div style={{
            position: "absolute", top: "25%", left: "20%", width: "60%", height: "40%",
            borderRadius: `${Math.round(r * 0.6)}px`,
            backgroundColor: fil,
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)",
          }} />
          <div style={{
            position: "absolute", top: 0, left: "50%", width: 1, height: "100%",
            backgroundColor: "rgba(0,0,0,0.12)",
          }} />
          {hasNfc && <span style={{ position: "absolute", top: 1, right: 1 }}><NfcBadge /></span>}
        </div>
        );
      })() : state === "active" && packageType && ICON_PACKAGE_TYPES[packageType] ? (() => {
        const { icon: PkgIcon, bg, fg } = ICON_PACKAGE_TYPES[packageType];
        const cellW = Math.round(size * 0.85);
        const cellH = Math.round(size * 0.95);
        const r = Math.round(size * 0.12);
        const iconSize = Math.round(size * 0.45);
        return (
        <div
          onClick={(e) => {
            e.stopPropagation();
            if (selection.onSlotClick) selection.onSlotClick(slot);
            else if (onSaveLabel) { setEditLabel(slot.label ?? ""); setEditing(true); }
          }}
          style={{
            position: "relative", width: cellW, height: cellH, flexShrink: 0,
            cursor: selection.onSlotClick || onSaveLabel ? "pointer" : "default",
            outline: isSelected ? "3px solid hsl(var(--primary))" : "none",
            outlineOffset: 2,
            borderRadius: `${r}px`,
            background: bg,
            boxShadow: "0 2px 5px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.15)",
            overflow: "hidden",
            display: "flex", alignItems: "center", justifyContent: "center",
            transition: "transform 0.12s ease, outline 0.12s ease",
          }}
          className="hover:scale-108 hover:-translate-y-0.5 hover:z-[2]"
        >
          <PkgIcon style={{ width: iconSize, height: iconSize, color: fg, opacity: 0.85 }} />
          {hasNfc && <span style={{ position: "absolute", top: 1, right: 1 }}><NfcBadge /></span>}
        </div>
        );
      })() : (
      <div
        onClick={(e) => {
          e.stopPropagation();
          if (selection.onSlotClick) {
            selection.onSlotClick(slot);
          } else if (onSaveLabel) {
            setEditLabel(slot.label ?? "");
            setEditing(true);
          }
        }}
        style={{
          position: "relative",
          width: w, height: h, borderRadius: radius,
          flexShrink: 0,
          cursor: selection.onSlotClick || onSaveLabel ? "pointer" : "default",
          outline: isSelected ? "3px solid hsl(var(--primary))" : "none",
          outlineOffset: 2,
          background: isSpool
            ? `radial-gradient(circle at 35% 28%, color-mix(in srgb, ${colors.base} 65%, white) 0%, ${colors.base} 60%)`
            : `linear-gradient(135deg, color-mix(in srgb, ${colors.base} 70%, white) 0%, ${colors.base} 50%, ${colors.mid} 100%)`,
          boxShadow: isSpool
            ? `inset 0 0 0 ${r1}px ${colors.mid}, inset 0 0 0 ${r2}px ${colors.hub}, inset 0 0 0 ${r3}px #0D0D0D, 0 2px 5px rgba(0,0,0,0.35)`
            : `inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.3)`,
          transition: "transform 0.12s ease, outline 0.12s ease",
        }}
        className="hover:-translate-y-0.5 hover:scale-104 hover:outline-2 hover:outline-[hsl(var(--primary))] hover:outline-offset-[2px] hover:z-[2]"
      >
        {hasNfc && <NfcBadge />}
      </div>
      )}
    </div>
    </>
  );
}

// ── Shared: Bay slots row ─────────────────────────────────────────────────────

function BaySlots({
  bay,
  slotSize,
  shape = "cell",
  context,
  callbacks,
}: {
  bay: BayData;
  slotSize: number;
  shape?: SlotShape;
  context?: string;
  callbacks: RackVisualizerCallbacks;
}) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: `${CELL_GAP}px`, flexWrap: "nowrap" }}>
      {bay.slots.length > 0 ? (
        bay.slots.map((slot) => (
          <SlotCell
            key={slot.id}
            slot={slot}
            size={slotSize}
            shape={slot.shape ?? shape}
            context={context}
            onSaveLabel={
              callbacks.onSaveSlotLabel
                ? (v) => callbacks.onSaveSlotLabel!(slot.id, v)
                : undefined
            }
            onDelete={
              callbacks.onDeleteSlot
                ? () => callbacks.onDeleteSlot!(slot.id)
                : undefined
            }
            onPrint={
              callbacks.onPrintSlot
                ? () => callbacks.onPrintSlot!(slot, context ?? "")
                : undefined
            }
          />
        ))
      ) : (
        <div
          style={{
            width: slotSize, height: slotSize,
            borderRadius: shape === "spool" ? "50%" : `${Math.round(slotSize * 0.18)}px`,
            border: "2px dashed rgba(255,255,255,0.2)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <span style={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>empty</span>
        </div>
      )}
      {callbacks.onAddSlotToBay && (
        <button
          title="Add slot"
          onClick={(e) => { e.stopPropagation(); callbacks.onAddSlotToBay!(bay.id, bay.slots ?? []); }}
          style={{
            width: 26, height: 26, borderRadius: "50%",
            border: "1.5px dashed hsl(var(--muted-foreground) / 0.4)",
            backgroundColor: "hsl(var(--muted) / 0.5)",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
            marginBottom: `${slotSize * 0.2}px`,
          }}
          className="hover:bg-muted hover:border-muted-foreground"
        >
          <Plus style={{ width: 14, height: 14, color: "hsl(var(--muted-foreground))" }} />
        </button>
      )}
    </div>
  );
}

// ── Shelf label tag with inline editing ────────────────────────────────────────

function ShelfLabel({
  shelf,
  onSave,
  onDelete,
}: {
  shelf: ShelfData;
  onSave?: (updates: { label?: string | null; position?: number }) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [labelVal, setLabelVal] = useState(shelf.label ?? "");
  const [posVal, setPosVal] = useState(String(shelf.position));

  const displayLabel = shelf.label || `S${shelf.position}`;

  const commit = () => {
    if (onSave) {
      const updates: { label?: string | null; position?: number } = {};
      const newLabel = labelVal.trim() || null;
      if (newLabel !== (shelf.label || null)) updates.label = newLabel;
      const newPos = parseInt(posVal);
      if (!isNaN(newPos) && newPos !== shelf.position) updates.position = newPos;
      if (Object.keys(updates).length > 0) onSave(updates);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        style={{
          position: "absolute", left: 4, top: 4, zIndex: 5,
          backgroundColor: "#F4F6F8", border: "1px solid #94A3B8", borderRadius: 4,
          padding: "4px 6px", boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          display: "flex", alignItems: "center", gap: 4,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          value={labelVal}
          onChange={(e) => setLabelVal(e.target.value)}
          placeholder={`S${shelf.position}`}
          autoFocus
          style={{ fontSize: 9, fontWeight: 700, color: "#1A2530", width: 50, padding: 0, background: "transparent", border: "none", outline: "none" }}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
        <input
          value={posVal}
          onChange={(e) => setPosVal(e.target.value)}
          placeholder="#"
          type="number"
          style={{ fontSize: 9, color: "#1A2530", width: 24, padding: 0, textAlign: "center", background: "transparent", border: "none", outline: "none" }}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
        <button className="p-0" onClick={commit}>
          <Plus style={{ fontSize: 10, color: "#1A2530", transform: "rotate(45deg)", width: 10, height: 10 }} />
        </button>
        {onDelete && (
          <button className="p-0" onClick={() => onDelete()}>
            <Trash2 style={{ width: 9, height: 9, color: "#64748B" }} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setLabelVal(shelf.label ?? "");
        setPosVal(String(shelf.position));
        setEditing(true);
      }}
      style={{
        position: "absolute", left: 4, top: 6, zIndex: 3,
        backgroundColor: "#F4F6F8", border: "1px solid #94A3B8", borderRadius: 3,
        padding: "2px 5px", lineHeight: 1,
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
      }}
      className="hover:border-[#64748B]"
    >
      <span style={{ fontSize: 9, fontWeight: 700, color: "#1A2530", letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
        {displayLabel}
      </span>
      {onDelete && (
        <button className="p-0" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <Trash2 style={{ width: 10, height: 10, color: "#64748B" }} />
        </button>
      )}
    </div>
  );
}

// ── Drawer label tag with inline editing ──────────────────────────────────────

function DrawerLabel({
  shelf,
  onSave,
  onDelete,
}: {
  shelf: ShelfData;
  onSave?: (updates: { label?: string | null; position?: number }) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [labelVal, setLabelVal] = useState(shelf.label ?? "");
  const [posVal, setPosVal] = useState(String(shelf.position));

  const displayLabel = shelf.label || `D${shelf.position}`;

  const commit = () => {
    if (onSave) {
      const updates: { label?: string | null; position?: number } = {};
      const newLabel = labelVal.trim() || null;
      if (newLabel !== (shelf.label || null)) updates.label = newLabel;
      const newPos = parseInt(posVal);
      if (!isNaN(newPos) && newPos !== shelf.position) updates.position = newPos;
      if (Object.keys(updates).length > 0) onSave(updates);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        style={{
          position: "absolute", left: 10, top: 4, zIndex: 5,
          backgroundColor: "rgba(255,255,255,0.95)", border: "1px solid #C0C0C0", borderRadius: 3,
          padding: "4px 6px", boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          display: "flex", alignItems: "center", gap: 4,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          value={labelVal}
          onChange={(e) => setLabelVal(e.target.value)}
          placeholder={`D${shelf.position}`}
          autoFocus
          style={{ fontSize: 9, fontWeight: 700, color: "#1A2530", width: 50, padding: 0, background: "transparent", border: "none", outline: "none" }}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
        <input
          value={posVal}
          onChange={(e) => setPosVal(e.target.value)}
          placeholder="#"
          type="number"
          style={{ fontSize: 9, color: "#1A2530", width: 24, padding: 0, textAlign: "center", background: "transparent", border: "none", outline: "none" }}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
        <button className="p-0" onClick={commit}>
          <Plus style={{ width: 10, height: 10, color: "#1A2530", transform: "rotate(45deg)" }} />
        </button>
        {onDelete && (
          <button className="p-0" onClick={() => onDelete()}>
            <Trash2 style={{ width: 9, height: 9, color: "#94A3B8" }} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        setLabelVal(shelf.label ?? "");
        setPosVal(String(shelf.position));
        setEditing(true);
      }}
      style={{
        position: "absolute", left: 10, top: 4, zIndex: 3,
        backgroundColor: "rgba(255,255,255,0.85)", border: "1px solid #C0C0C0", borderRadius: 2,
        padding: "1px 4px", lineHeight: 1, cursor: "pointer",
      }}
      className="hover:border-[#64748B]"
    >
      <span style={{
        fontSize: 8, fontWeight: 700, color: "#1A2530",
        letterSpacing: "0.04em", textTransform: "uppercase", whiteSpace: "nowrap",
        display: "flex", alignItems: "center", gap: 4,
      }}>
        {displayLabel}
        {onDelete && (
          <button className="p-0" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 style={{ width: 9, height: 9, color: "#94A3B8" }} />
          </button>
        )}
      </span>
    </div>
  );
}

// ── Add level button ──────────────────────────────────────────────────────────

function AddLevelButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <div className="text-center mt-2">
      <button
        title={label}
        onClick={onClick}
        className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted hover:bg-muted/80 border border-border"
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}

// ── Bay label with inline editing ─────────────────────────────────────────────

function BayLabel({
  bay,
  variant = "shelf",
  onSave,
  onDelete,
}: {
  bay: BayData;
  variant?: "shelf" | "drawer";
  onSave?: (label: string) => void;
  onDelete?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(bay.label ?? "");

  const defaultLabel = variant === "drawer" ? `R${bay.position}` : `B${bay.position}`;
  const displayLabel = bay.label || defaultLabel;

  const commit = () => {
    const trimmed = val.trim();
    if (trimmed !== (bay.label ?? "") && onSave) onSave(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <div
        style={{
          display: "flex", alignItems: "center", gap: 2,
          marginBottom: variant === "shelf" ? 2 : 0,
          ...(variant === "drawer" && { width: 28, flexShrink: 0, flexDirection: "column" as const }),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          autoFocus
          placeholder={defaultLabel}
          style={{
            fontSize: variant === "drawer" ? 7 : 8, fontWeight: 700,
            color: "rgba(255,255,255,0.7)", width: variant === "drawer" ? 24 : 40,
            padding: 0, textAlign: "center", background: "transparent", border: "none", outline: "none",
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setVal(bay.label ?? ""); setEditing(false); }
          }}
        />
        {onDelete && (
          <button
            className="p-0 opacity-50 hover:opacity-100"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <Trash2 style={{ width: variant === "drawer" ? 8 : 9, height: variant === "drawer" ? 8 : 9, color: "rgba(255,255,255,0.6)" }} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex", alignItems: "center",
        gap: variant === "drawer" ? 1 : 2,
        marginBottom: variant === "shelf" ? 2 : 0,
        cursor: onSave ? "pointer" : "default",
        ...(variant === "drawer" && { width: 28, flexShrink: 0, flexDirection: "column" as const }),
      }}
      onClick={onSave ? (e) => { e.stopPropagation(); setVal(bay.label ?? ""); setEditing(true); } : undefined}
    >
      <span
        className="bay-label-text"
        style={{
          fontSize: variant === "drawer" ? 7 : 8, fontWeight: 700,
          color: "rgba(255,255,255,0.45)", letterSpacing: "0.04em",
          textTransform: "uppercase", whiteSpace: "nowrap",
        }}
      >
        {displayLabel}
      </span>
      {onDelete && (
        <button
          className="p-0 opacity-30 hover:opacity-100"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 style={{ width: variant === "drawer" ? 8 : 9, height: variant === "drawer" ? 8 : 9, color: "rgba(255,255,255,0.6)" }} />
        </button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE: Open Shelving (bookshelf with wooden planks)
// ═══════════════════════════════════════════════════════════════════════════════

function ShelfBayGroup({
  bay, isFirst, slotShape, shelfLabel, callbacks,
}: {
  bay: BayData; isFirst: boolean; slotShape: SlotShape; shelfLabel: string; callbacks: RackVisualizerCallbacks;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      borderLeft: isFirst ? "none" : "2px solid rgba(255,255,255,0.12)", paddingLeft: 5, paddingRight: 5,
    }}>
      {(callbacks.onDeleteBay || callbacks.onSaveBayLabel) && (
        <BayLabel
          bay={bay}
          variant="shelf"
          onSave={callbacks.onSaveBayLabel ? (v) => callbacks.onSaveBayLabel!(bay.id, v) : undefined}
          onDelete={callbacks.onDeleteBay ? () => callbacks.onDeleteBay!(bay.id) : undefined}
        />
      )}
      <BaySlots bay={bay} slotSize={40} shape={slotShape} context={`${shelfLabel} \u00b7 ${bay.label || `B${bay.position}`}`} callbacks={callbacks} />
    </div>
  );
}

function ShelfUnit({ shelf, slotShape, callbacks }: { shelf: ShelfData; slotShape: SlotShape; callbacks: RackVisualizerCallbacks }) {
  return (
    <div style={{ position: "relative" }}>
      {(callbacks.onSaveShelf || callbacks.onDeleteShelf) && (
        <ShelfLabel
          shelf={shelf}
          onSave={callbacks.onSaveShelf ? (updates) => callbacks.onSaveShelf!(shelf.id, updates) : undefined}
          onDelete={callbacks.onDeleteShelf ? () => callbacks.onDeleteShelf!(shelf.id) : undefined}
        />
      )}

      <div style={{
        minHeight: 64, paddingLeft: 6, paddingRight: 6, paddingTop: 22, paddingBottom: 6,
        display: "flex", flexDirection: "row", alignItems: "flex-end",
        backgroundColor: "rgba(245,240,232,0.08)", gap: 2, overflowX: "auto",
        boxShadow: "inset 0 8px 12px rgba(0,0,0,0.15), inset 0 -1px 0 rgba(0,0,0,0.1)",
      }}>
        {shelf.bays.map((bay, i) => (
          <ShelfBayGroup key={bay.id} bay={bay} isFirst={i === 0} slotShape={slotShape} shelfLabel={shelf.label || `S${shelf.position}`} callbacks={callbacks} />
        ))}
        {callbacks.onAddBayToShelf && (
          <div
            title="Add bay"
            onClick={(e) => { e.stopPropagation(); callbacks.onAddBayToShelf!(shelf.id, shelf.bays ?? []); }}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              border: "2px dashed hsl(var(--muted-foreground) / 0.4)",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, cursor: "pointer", marginLeft: 8,
              backgroundColor: "hsl(var(--muted) / 0.5)",
            }}
            className="hover:border-muted-foreground hover:bg-muted"
          >
            <Plus style={{ width: 18, height: 18, color: "hsl(var(--muted-foreground))" }} />
          </div>
        )}
      </div>

      {/* Shelf plank */}
      <div style={{
        height: 12,
        background: "linear-gradient(to bottom, #546E7A 0%, #37474F 35%, #263238 100%)",
        borderTop: "1px solid #607D8B",
        boxShadow: "0 4px 10px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.5)",
      }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE: Cabinet / Drawers
// ═══════════════════════════════════════════════════════════════════════════════

function DrawerUnit({ shelf, slotShape, callbacks }: { shelf: ShelfData; slotShape: SlotShape; callbacks: RackVisualizerCallbacks }) {
  const bays = shelf.bays ?? [];

  return (
    <div style={{ position: "relative" }}>
      <div style={{
        background: "linear-gradient(to bottom, #E8E8E8 0%, #D4D4D4 50%, #BFBFBF 100%)",
        border: "1px solid #A0A0A0", borderRadius: 3, marginLeft: 4, marginRight: 4,
        overflow: "hidden",
        boxShadow: "0 2px 6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6)",
      }}>
        <div style={{
          height: 6, marginLeft: "30%", marginRight: "30%", marginTop: 4, borderRadius: 3,
          background: "linear-gradient(to bottom, #90A4AE 0%, #607D8B 100%)",
          boxShadow: "0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)",
        }} />

        {(callbacks.onSaveShelf || callbacks.onDeleteShelf) && (
          <DrawerLabel
            shelf={shelf}
            onSave={callbacks.onSaveShelf ? (updates) => callbacks.onSaveShelf!(shelf.id, updates) : undefined}
            onDelete={callbacks.onDeleteShelf ? () => callbacks.onDeleteShelf!(shelf.id) : undefined}
          />
        )}

        <div style={{
          padding: "14px 6px 8px", backgroundColor: "#3A3A3A",
          margin: "6px 4px 4px", borderRadius: 2,
          boxShadow: "inset 0 4px 10px rgba(0,0,0,0.4)", overflowX: "auto",
        }}>
          {bays.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {bays.map((bay, rowIdx) => {
                const slots = bay.slots ?? [];
                return (
                  <div key={bay.id}>
                    <div style={{
                      display: "flex", alignItems: "center", gap: 4,
                      borderTop: rowIdx > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
                      paddingTop: rowIdx > 0 ? 4 : 0,
                    }}>
                      {(callbacks.onDeleteBay || callbacks.onSaveBayLabel) && (
                        <BayLabel bay={bay} variant="drawer"
                          onSave={callbacks.onSaveBayLabel ? (v) => callbacks.onSaveBayLabel!(bay.id, v) : undefined}
                          onDelete={callbacks.onDeleteBay ? () => callbacks.onDeleteBay!(bay.id) : undefined}
                        />
                      )}
                      <div style={{ display: "flex", gap: `${CELL_GAP}px`, alignItems: "center", flexWrap: "nowrap" }}>
                        {slots.map((slot) => (
                          <SlotCell key={slot.id} slot={slot} size={36} shape={slot.shape ?? slotShape}
                            context={`${shelf.label || `D${shelf.position}`} \u00b7 ${bay.label || `R${bay.position}`}`}
                            onSaveLabel={callbacks.onSaveSlotLabel ? (v) => callbacks.onSaveSlotLabel!(slot.id, v) : undefined}
                            onDelete={callbacks.onDeleteSlot ? () => callbacks.onDeleteSlot!(slot.id) : undefined}
                            onPrint={callbacks.onPrintSlot ? () => callbacks.onPrintSlot!(slot, `${shelf.label || `D${shelf.position}`} \u00b7 ${bay.label || `R${bay.position}`}`) : undefined}
                          />
                        ))}
                        {callbacks.onAddSlotToBay && (
                          <button
                            title="Add slot"
                            onClick={(e) => { e.stopPropagation(); callbacks.onAddSlotToBay!(bay.id, slots); }}
                            className="flex items-center justify-center w-[22px] h-[22px] bg-muted/30 hover:bg-muted/60 rounded"
                          >
                            <Plus style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", padding: "8px 0", textAlign: "center" }}>Empty drawer</p>
          )}

          {callbacks.onAddBayToShelf && (
            <div className="flex justify-center mt-2 pt-2 border-t border-border">
              <button
                title="Add row"
                onClick={(e) => { e.stopPropagation(); callbacks.onAddBayToShelf!(shelf.id, bays); }}
                className="flex items-center justify-center w-[22px] h-[22px] bg-muted/30 hover:bg-muted/60 rounded"
              >
                <Plus style={{ width: 12, height: 12, color: "hsl(var(--muted-foreground))" }} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE: AMS / Compact (Bambu AMS-style boxes)
// ═══════════════════════════════════════════════════════════════════════════════

function AmsUnit({ shelf, slotShape, callbacks }: { shelf: ShelfData; slotShape: SlotShape; callbacks: RackVisualizerCallbacks }) {
  const unitLabel = shelf.label || `Unit ${shelf.position}`;
  const allSlots = shelf.bays.flatMap((bay) => bay.slots);

  return (
    <div style={{
      position: "relative",
      background: "linear-gradient(135deg, #2D2D2D 0%, #1A1A1A 100%)",
      borderRadius: 10, border: "1px solid #475569", overflow: "hidden",
      boxShadow: "0 3px 12px rgba(0,0,0,0.4)", minWidth: 180,
    }}>
      <div style={{
        height: 24,
        background: "linear-gradient(to bottom, #3D3D3D 0%, #2A2A2A 100%)",
        borderBottom: "1px solid #475569",
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 8px",
      }}>
        <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          {unitLabel}
        </span>
        {callbacks.onDeleteShelf && (
          <button className="p-0" onClick={() => callbacks.onDeleteShelf!(shelf.id)}>
            <Trash2 style={{ width: 11, height: 11, color: "rgba(255,255,255,0.4)" }} />
          </button>
        )}
      </div>

      <div style={{
        display: "flex", flexDirection: "row", alignItems: "center", justifyContent: "center",
        gap: 6, padding: "10px 8px", overflowX: "auto",
      }}>
        {allSlots.map((slot) => (
          <SlotCell key={slot.id} slot={slot} size={36} shape={slot.shape ?? slotShape}
            context={shelf.label || `Unit ${shelf.position}`}
            onSaveLabel={callbacks.onSaveSlotLabel ? (v) => callbacks.onSaveSlotLabel!(slot.id, v) : undefined}
            onDelete={callbacks.onDeleteSlot ? () => callbacks.onDeleteSlot!(slot.id) : undefined}
            onPrint={callbacks.onPrintSlot ? () => callbacks.onPrintSlot!(slot, shelf.label || `Unit ${shelf.position}`) : undefined}
          />
        ))}
        {allSlots.length === 0 && (
          <span style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", padding: "8px 0" }}>No slots</span>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main export — RackVisualizer
// ═══════════════════════════════════════════════════════════════════════════════

function ShelfRenderer({ shelf, resolvedStyle, slotShape, callbacks }: {
  shelf: ShelfData; resolvedStyle: RackDisplayStyle; slotShape: SlotShape; callbacks: RackVisualizerCallbacks;
}) {
  switch (resolvedStyle) {
    case "drawer":
      return <DrawerUnit shelf={shelf} slotShape={slotShape} callbacks={callbacks} />;
    case "ams":
      return <AmsUnit shelf={shelf} slotShape={slotShape} callbacks={callbacks} />;
    case "grid":
      return (
        <div style={{ marginBottom: 8 }}>
          {(callbacks.onSaveShelf || callbacks.onDeleteShelf) && (
            <div className="flex items-center gap-2 mb-1">
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }} className="text-muted-foreground">
                {shelf.label || `Section ${shelf.position}`}
              </span>
              {callbacks.onDeleteShelf && (
                <button className="p-0" onClick={() => callbacks.onDeleteShelf!(shelf.id)}>
                  <Trash2 className="size-3 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "nowrap", gap: `${CELL_GAP}px`, overflowX: "auto" }}>
            {shelf.bays.flatMap((bay) =>
              bay.slots.map((slot) => (
                <SlotCell key={slot.id} slot={slot} size={36} shape={slot.shape ?? slotShape}
                  context={`${shelf.label || `Section ${shelf.position}`} \u00b7 ${bay.label || `B${bay.position}`}`}
                  onSaveLabel={callbacks.onSaveSlotLabel ? (v) => callbacks.onSaveSlotLabel!(slot.id, v) : undefined}
                  onDelete={callbacks.onDeleteSlot ? () => callbacks.onDeleteSlot!(slot.id) : undefined}
                  onPrint={callbacks.onPrintSlot ? () => callbacks.onPrintSlot!(slot, `${shelf.label || `Section ${shelf.position}`} \u00b7 ${bay.label || `B${bay.position}`}`) : undefined}
                />
              ))
            )}
          </div>
        </div>
      );
    case "shelf":
    default:
      return <ShelfUnit shelf={shelf} slotShape={slotShape} callbacks={callbacks} />;
  }
}

// ── Context Menu (replaces MUI Menu) ──────────────────────────────────────────

function SlotContextMenu({
  slot,
  pos,
  context,
  callbacks,
  onClose,
}: {
  slot: SlotData | null;
  pos: { x: number; y: number } | null;
  context: string;
  callbacks: RackVisualizerCallbacks;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => { document.removeEventListener("mousedown", handleClick); document.removeEventListener("keydown", handleKey); };
  }, [onClose]);

  if (!slot || !pos) return null;

  const st = slot.status as any;
  const isActive = st?.state === "active";

  return (
    <div
      ref={menuRef}
      className="fixed z-50 min-w-[180px] rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 p-1"
      style={{ top: pos.y, left: pos.x }}
    >
      {isActive ? (
        <>
          {st?.userItemId && callbacks.onViewItem && (
            <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground"
              onClick={() => { callbacks.onViewItem!(st.userItemId); onClose(); }}>
              <ExternalLink className="size-4" /> View Details
            </button>
          )}
          {st?.userItemId && callbacks.onEditItem && (
            <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground"
              onClick={() => { callbacks.onEditItem!(st.userItemId); onClose(); }}>
              <Pencil className="size-4" /> Edit Item
            </button>
          )}
          {callbacks.onMoveItem && (
            <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground"
              onClick={() => { callbacks.onMoveItem!(slot.id); onClose(); }}>
              <ArrowLeftRight className="size-4" /> Move to Another Slot
            </button>
          )}
          {callbacks.onRemoveItem && (
            <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground"
              onClick={() => { callbacks.onRemoveItem!(slot.id); onClose(); }}>
              <CircleMinus className="size-4" /> Remove from Slot
            </button>
          )}
          {callbacks.onPrintSlot && (
            <>
              <Separator className="my-1" />
              <button className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded-md hover:bg-accent hover:text-accent-foreground"
                onClick={() => { callbacks.onPrintSlot!(slot, context); onClose(); }}>
                <Printer className="size-4" /> Print Label
              </button>
            </>
          )}
        </>
      ) : (
        <div className="px-2 py-1.5 text-sm text-muted-foreground">Empty slot</div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main export — RackVisualizer
// ═══════════════════════════════════════════════════════════════════════════════

export function RackVisualizer({
  rack,
  displayStyle = "shelf",
  slotShape = "cell",
  editing = false,
  callbacks = {},
  selectedSlotId,
}: {
  rack: RackTopology;
  displayStyle?: RackDisplayStyle;
  slotShape?: SlotShape;
  editing?: boolean;
  callbacks?: RackVisualizerCallbacks;
  selectedSlotId?: string | null;
}) {
  const cb = editing ? callbacks : {
    onPrintSlot: callbacks.onPrintSlot,
    onSlotClick: callbacks.onSlotClick,
    onDragMoveItem: callbacks.onDragMoveItem,
    onViewItem: callbacks.onViewItem,
    onEditItem: callbacks.onEditItem,
    onRemoveItem: callbacks.onRemoveItem,
    onMoveItem: callbacks.onMoveItem,
  };
  const rackDefault = rack.displayStyle ?? displayStyle;

  const shelvesSorted = [...(rack.shelves ?? [])].sort(
    (a, b) => a.position - b.position
  );

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [draggingSlotId, setDraggingSlotId] = useState<string | null>(null);
  const [ctxMenuSlotId, setCtxMenuSlotId] = useState<string | null>(null);
  const [ctxMenuPos, setCtxMenuPos] = useState<{ x: number; y: number } | null>(null);
  const [ctxMenuSlot, setCtxMenuSlot] = useState<SlotData | null>(null);
  const [ctxMenuContext, setCtxMenuContext] = useState("");

  const openCtxMenu = useCallback((slotId: string, x: number, y: number, slot?: SlotData, ctx?: string) => {
    setCtxMenuSlotId(slotId);
    setCtxMenuPos({ x, y });
    if (slot) setCtxMenuSlot(slot);
    if (ctx !== undefined) setCtxMenuContext(ctx);
  }, []);

  const closeCtxMenu = useCallback(() => {
    setCtxMenuSlotId(null);
    setCtxMenuPos(null);
  }, []);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setDraggingSlotId(event.active.data.current?.slotId ?? null);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setDraggingSlotId(null);
    const { active, over } = event;
    if (!over || !cb.onDragMoveItem) return;
    const fromSlotId = active.data.current?.slotId;
    const itemId = active.data.current?.itemId;
    const toSlotId = over.data.current?.slotId;
    if (fromSlotId && toSlotId && itemId && fromSlotId !== toSlotId) {
      cb.onDragMoveItem(itemId, fromSlotId, toSlotId);
    }
  }, [cb]);

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <SlotSelectionContext.Provider value={{
      selectedSlotId: selectedSlotId ?? null,
      onSlotClick: cb.onSlotClick ?? null,
      onViewItem: cb.onViewItem ?? null,
      onEditItem: cb.onEditItem ?? null,
      onRemoveItem: cb.onRemoveItem ?? null,
      onMoveItem: cb.onMoveItem ?? null,
      onPrintSlot: cb.onPrintSlot ?? null,
      onDragMoveItem: cb.onDragMoveItem ?? null,
      draggingSlotId,
      ctxMenuSlotId,
      ctxMenuPos,
      openCtxMenu,
      closeCtxMenu,
    }}>
      <div style={{ overflowX: "auto", paddingBottom: 4 }}>
        <div style={{ display: "flex", flexDirection: "column-reverse", gap: 3 }}>
          {shelvesSorted.map((shelf) => {
            const shelfStyle = shelf.displayStyle ?? rackDefault;
            return (
              <ShelfRenderer key={shelf.id} shelf={shelf} resolvedStyle={shelfStyle} slotShape={slotShape} callbacks={cb} />
            );
          })}
        </div>

        {cb.onAddShelfToRack && (
          <AddLevelButton label="Add shelf" onClick={() => cb.onAddShelfToRack!(rack.id, rack.shelves ?? [])} />
        )}
      </div>
    </SlotSelectionContext.Provider>

    {/* Context menu */}
    {ctxMenuSlotId && (
      <SlotContextMenu
        slot={ctxMenuSlot}
        pos={ctxMenuPos}
        context={ctxMenuContext}
        callbacks={cb}
        onClose={closeCtxMenu}
      />
    )}

    </DndContext>
  );
}
