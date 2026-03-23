"use client";

import { useState, createContext, useContext, useCallback } from "react";
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
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import InputBase from "@mui/material/InputBase";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PrintIcon from "@mui/icons-material/Print";
import EditIcon from "@mui/icons-material/Edit";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import RemoveCircleOutlineIcon from "@mui/icons-material/RemoveCircleOutline";

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
  active: { base: "#16A34A", mid: "#0F7A35", hub: "#0A5225" },
  empty: { base: "#9CA3AF", mid: "#6B7280", hub: "#4B5563" },
  error: { base: "#DC2626", mid: "#B91C1C", hub: "#7F1D1D" },
  detecting: { base: "#D97706", mid: "#B45309", hub: "#78350F" },
  unknown_spool: { base: "#7C3AED", mid: "#5B21B6", hub: "#3B0764" },
  removed: { base: "#6B7280", mid: "#4B5563", hub: "#374151" },
};
const DEFAULT_COLORS = SPOOL_COLORS.empty;

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
    <Box
      component="span"
      sx={{
        position: "absolute",
        top: 0,
        right: 0,
        width: 14,
        height: 14,
        borderRadius: "50%",
        bgcolor: "#0EA5E9",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "1.5px solid #fff",
        zIndex: 1,
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}
    >
      <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
        <path
          d="M5 8 C5 8 2 6.5 2 5 C2 3.5 3.34 2 5 2"
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M5 6 C5 6 3.5 5.5 3.5 5 C3.5 4.1 4.17 3.5 5 3.5"
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="5" cy="5" r="0.8" fill="white" />
      </svg>
    </Box>
  );
}

// ── Slot shape types ──────────────────────────────────────────────────────────

export type SlotShape = "spool" | "cell";

// ── Slot Cell (generic — works for any item) ─────────────────────────────────

const CELL_GAP = 4; // px gap between cells — keep in sync with grid gap

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

  // Drag and drop (must be after state is defined)
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
  // Use item's actual color for the spool if available, otherwise fall back to state color
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

  // Spool concentric rings (only for spool shape, no span)
  const minDim = Math.min(w, h);
  const r1 = Math.round(minDim * 0.135);
  const r2 = Math.round(minDim * 0.31);
  const r3 = Math.round(minDim * 0.42);

  const spanLabel = colSpan > 1 || rowSpan > 1
    ? ` (${colSpan}×${rowSpan})`
    : "";

  if (editing) {
    return (
      <Box
        sx={{
          width: w,
          height: h,
          borderRadius: radius,
          bgcolor: colors.hub,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          border: "2px solid",
          borderColor: "primary.main",
          gap: 0.25,
        }}
      >
        <InputBase
          value={editLabel}
          onChange={(e) => setEditLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") {
              setEditLabel(slot.label ?? "");
              setEditing(false);
            }
          }}
          autoFocus
          placeholder={String(slot.position)}
          sx={{
            fontSize: size < 40 ? 7 : 9,
            color: "#fff",
            width: w * 0.7,
            "& input": { p: 0, textAlign: "center", color: "#fff" },
          }}
        />
        {onDelete && (
          <IconButton
            size="small"
            sx={{ p: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <DeleteIcon sx={{ fontSize: 10, color: "error.light" }} />
          </IconButton>
        )}
      </Box>
    );
  }

  const statusData = slot.status as any;
  const productName = statusData?.productName;
  const brandName = statusData?.brandName;
  const weightG = statusData?.weightStableG as number | undefined;
  const pctRemaining = statusData?.percentRemaining as number | undefined;

  const initialWeightG = statusData?.initialWeightG as number | undefined;

  const tooltipContent = state === "active" ? (
    // Rich tooltip card for occupied slots
    <Box sx={{ minWidth: 200, p: 0.5 }}>
      {/* Header: color swatch + name */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
        <Box sx={{
          width: 28, height: 28, borderRadius: "50%",
          bgcolor: itemColorHex ?? colors.base,
          border: "2px solid rgba(255,255,255,0.25)",
          flexShrink: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        }} />
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, lineHeight: 1.2, color: "#fff" }} noWrap>
            {productName ?? "Unknown"}
          </Typography>
          {brandName && (
            <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.65)", lineHeight: 1.1 }}>{brandName}</Typography>
          )}
        </Box>
      </Box>

      {/* Stats row */}
      <Box sx={{ display: "flex", gap: 1.5, mb: 0.5 }}>
        {weightG != null && (
          <Box>
            <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.5)", lineHeight: 1, mb: 0.15 }}>Weight</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#fff", lineHeight: 1 }}>{Math.round(weightG)}g</Typography>
          </Box>
        )}
        {initialWeightG != null && initialWeightG > 0 && weightG != null && (
          <Box>
            <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.5)", lineHeight: 1, mb: 0.15 }}>Used</Typography>
            <Typography sx={{ fontSize: 12, fontWeight: 600, color: "#fff", lineHeight: 1 }}>
              {Math.round(((initialWeightG - weightG) / initialWeightG) * 100)}%
            </Typography>
          </Box>
        )}
        {packageType && (
          <Box>
            <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.5)", lineHeight: 1, mb: 0.15 }}>Type</Typography>
            <Typography sx={{ fontSize: 11, fontWeight: 500, color: "#fff", lineHeight: 1, textTransform: "capitalize" }}>{packageType}</Typography>
          </Box>
        )}
      </Box>

      {/* Progress bar */}
      {pctRemaining != null && (
        <Box sx={{ mb: 0.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Box sx={{ flex: 1, height: 5, bgcolor: "rgba(255,255,255,0.12)", borderRadius: 3, overflow: "hidden" }}>
              <Box sx={{
                width: `${pctRemaining}%`, height: "100%", borderRadius: 3,
                bgcolor: pctRemaining > 50 ? "#4ade80" : pctRemaining > 25 ? "#fbbf24" : "#f87171",
              }} />
            </Box>
            <Typography sx={{ fontSize: 10, fontWeight: 700, color: "#fff", minWidth: 30, textAlign: "right" }}>{pctRemaining}%</Typography>
          </Box>
        </Box>
      )}

      {/* Badges */}
      <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.25 }}>
        {hasNfc && (
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.25, bgcolor: "rgba(255,255,255,0.1)", borderRadius: 1, px: 0.5, py: 0.15 }}>
            <Typography sx={{ fontSize: 8, color: "rgba(255,255,255,0.7)" }}>NFC</Typography>
          </Box>
        )}
      </Box>

      {/* Footer: slot address */}
      <Typography sx={{ fontSize: 9, color: "rgba(255,255,255,0.35)", mt: 0.5, borderTop: "1px solid rgba(255,255,255,0.08)", pt: 0.3 }}>
        Slot {label}{context ? ` · ${context}` : ""}
      </Typography>
    </Box>
  ) : (
    // Simple tooltip for empty slots
    <Box sx={{ p: 0.25 }}>
      <Typography sx={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}>
        Slot {label}{spanLabel}
      </Typography>
      {context && <Typography sx={{ fontSize: 10, opacity: 0.7 }}>{context}</Typography>}
      <Typography sx={{ fontSize: 10, opacity: 0.5 }}>Available</Typography>
    </Box>
  );

  return (
    <>
    <div
      ref={setRefs}
      {...(isDraggable ? { ...dragAttrs, ...dragListeners } : {})}
      onContextMenu={handleContextMenu}
      onPointerUp={(e) => {
        // Only fire click if not dragging (pointer didn't move much)
        if (!isDragging && e.button === 0 && selection.onSlotClick) {
          selection.onSlotClick(slot);
        }
      }}
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
    <Tooltip
      title={isDragging ? "" : tooltipContent}
      arrow
      placement="top"
      disableInteractive
      slotProps={{
        tooltip: { sx: { maxWidth: 260, px: 1.25, py: 0.75 } },
        popper: { modifiers: [{ name: "offset", options: { offset: [0, -4] } }] },
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
        <Box
          onClick={() => {
            if (selection.onSlotClick) selection.onSlotClick(slot);
            else if (onSaveLabel) { setEditLabel(slot.label ?? ""); setEditing(true); }
          }}
          sx={{
            position: "relative",
            width: spoolW,
            height: spoolH,
            flexShrink: 0,
            cursor: selection.onSlotClick || onSaveLabel ? "pointer" : "default",
            outline: isSelected ? "3px solid" : "none",
            outlineColor: isSelected ? "primary.main" : "transparent",
            outlineOffset: 2,
            display: "flex",
            flexDirection: "row",
            alignItems: "stretch",
            overflow: "hidden",
            transition: "transform 0.12s ease, outline 0.12s ease",
            "&:hover": { transform: "translateY(-2px) scale(1.08)", zIndex: 2 },
            filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))",
          }}
        >
          {/* Left flange — circular disc */}
          <Box sx={{
            width: flangeW,
            borderRadius: `${flangeR}px 0 0 ${flangeR}px`,
            background: "linear-gradient(180deg, #888 0%, #555 40%, #444 60%, #333 100%)",
            boxShadow: "inset -1px 0 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)",
          }} />
          {/* Filament wrap — cylinder body */}
          <Box sx={{
            flex: 1, position: "relative",
            background: `linear-gradient(180deg,
              color-mix(in srgb, ${fil} 50%, white) 0%,
              color-mix(in srgb, ${fil} 80%, white) 8%,
              ${fil} 25%,
              color-mix(in srgb, ${fil} 90%, black) 55%,
              color-mix(in srgb, ${fil} 70%, black) 85%,
              color-mix(in srgb, ${fil} 50%, black) 100%)`,
          }}>
            {/* Subtle wrap texture */}
            <Box sx={{
              position: "absolute", inset: 0, opacity: 0.08,
              background: `repeating-linear-gradient(0deg, transparent, transparent 1px, rgba(255,255,255,0.6) 1px, rgba(255,255,255,0.6) 2px)`,
            }} />
          </Box>
          {/* Right flange */}
          <Box sx={{
            width: flangeW,
            borderRadius: `0 ${flangeR}px ${flangeR}px 0`,
            background: "linear-gradient(180deg, #777 0%, #4a4a4a 40%, #3a3a3a 60%, #2a2a2a 100%)",
            boxShadow: "inset 1px 0 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
          }} />
          {hasNfc && <Box sx={{ position: "absolute", top: 1, right: 1 }}><NfcBadge /></Box>}
        </Box>
        );
      })() : state === "active" && packageType === "box" ? (() => {
        // Box rendering: brown cardboard box with color window
        const fil = itemColorHex ?? "#888";
        const boxW = Math.round(size * 0.85);
        const boxH = Math.round(size * 0.95);
        const r = Math.round(size * 0.08);
        return (
        <Box
          onClick={() => {
            if (selection.onSlotClick) selection.onSlotClick(slot);
            else if (onSaveLabel) { setEditLabel(slot.label ?? ""); setEditing(true); }
          }}
          sx={{
            position: "relative", width: boxW, height: boxH, flexShrink: 0,
            cursor: selection.onSlotClick || onSaveLabel ? "pointer" : "default",
            outline: isSelected ? "3px solid" : "none",
            outlineColor: isSelected ? "primary.main" : "transparent",
            outlineOffset: 2,
            borderRadius: `${r}px`,
            background: "linear-gradient(180deg, #c9a86c 0%, #b8945a 30%, #a6834e 70%, #8b6d3f 100%)",
            boxShadow: "0 2px 5px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
            overflow: "hidden",
            transition: "transform 0.12s ease, outline 0.12s ease",
            "&:hover": { transform: "translateY(-2px) scale(1.08)", zIndex: 2 },
          }}
        >
          {/* Color window */}
          <Box sx={{
            position: "absolute",
            top: "25%", left: "20%", width: "60%", height: "40%",
            borderRadius: `${Math.round(r * 0.6)}px`,
            bgcolor: fil,
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.3)",
          }} />
          {/* Box seam line */}
          <Box sx={{
            position: "absolute", top: 0, left: "50%", width: 1, height: "100%",
            bgcolor: "rgba(0,0,0,0.12)",
          }} />
          {hasNfc && <Box sx={{ position: "absolute", top: 1, right: 1 }}><NfcBadge /></Box>}
        </Box>
        );
      })() : (
      <Box
        onClick={() => {
          if (selection.onSlotClick) {
            selection.onSlotClick(slot);
          } else if (onSaveLabel) {
            setEditLabel(slot.label ?? "");
            setEditing(true);
          }
        }}
        sx={{
          position: "relative",
          width: w,
          height: h,
          borderRadius: radius,
          flexShrink: 0,
          cursor: selection.onSlotClick || onSaveLabel ? "pointer" : "default",
          outline: isSelected ? "3px solid" : "none",
          outlineColor: isSelected ? "primary.main" : "transparent",
          outlineOffset: 2,
          background: isSpool
            ? `radial-gradient(circle at 35% 28%, color-mix(in srgb, ${colors.base} 65%, white) 0%, ${colors.base} 60%)`
            : `linear-gradient(135deg, color-mix(in srgb, ${colors.base} 70%, white) 0%, ${colors.base} 50%, ${colors.mid} 100%)`,
          boxShadow: isSpool
            ? `inset 0 0 0 ${r1}px ${colors.mid}, inset 0 0 0 ${r2}px ${colors.hub}, inset 0 0 0 ${r3}px #0D0D0D, 0 2px 5px rgba(0,0,0,0.35)`
            : `inset 0 1px 0 rgba(255,255,255,0.15), 0 2px 4px rgba(0,0,0,0.3)`,
          transition: "transform 0.12s ease, outline 0.12s ease",
          "&:hover": {
            transform: "translateY(-2px) scale(1.04)",
            outline: "2px solid",
            outlineColor: "primary.main",
            outlineOffset: "2px",
            zIndex: 2,
          },
        }}
      >
        {hasNfc && <NfcBadge />}
      </Box>
      )}
    </Tooltip>
    </div>

    {/* Context menu */}
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
    <Box sx={{ display: "flex", alignItems: "flex-end", gap: `${CELL_GAP}px`, flexWrap: "nowrap" }}>
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
        <Box
          sx={{
            width: slotSize,
            height: slotSize,
            borderRadius: shape === "spool" ? "50%" : `${Math.round(slotSize * 0.18)}px`,
            border: "2px dashed rgba(255,255,255,0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography sx={{ fontSize: 8, color: "rgba(255,255,255,0.3)" }}>
            empty
          </Typography>
        </Box>
      )}
      {callbacks.onAddSlotToBay && (
        <Tooltip title="Add slot" arrow>
          <IconButton
            size="small"
            onClick={(e) => { e.stopPropagation(); callbacks.onAddSlotToBay!(bay.id, bay.slots ?? []); }}
            sx={{
              width: 26,
              height: 26,
              border: "1.5px dashed",
              borderColor: "action.disabled",
              bgcolor: "action.hover",
              "&:hover": { bgcolor: "action.selected", borderColor: "text.secondary" },
              mb: `${slotSize * 0.2}px`,
            }}
          >
            <AddIcon sx={{ fontSize: 14, color: "text.secondary" }} />
          </IconButton>
        </Tooltip>
      )}
    </Box>
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
      <Box
        sx={{
          position: "absolute",
          left: 4,
          top: 4,
          zIndex: 5,
          bgcolor: "#EDE9E0",
          border: "1px solid #C8C0B0",
          borderRadius: "4px",
          p: "4px 6px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <InputBase
          value={labelVal}
          onChange={(e) => setLabelVal(e.target.value)}
          placeholder={`S${shelf.position}`}
          autoFocus
          sx={{ fontSize: 9, fontWeight: 700, color: "#3D3020", width: 50, "& input": { p: 0 } }}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
        <InputBase
          value={posVal}
          onChange={(e) => setPosVal(e.target.value)}
          placeholder="#"
          type="number"
          sx={{ fontSize: 9, color: "#3D3020", width: 24, "& input": { p: 0, textAlign: "center" } }}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
        <IconButton size="small" sx={{ p: 0 }} onClick={commit}>
          <AddIcon sx={{ fontSize: 10, color: "#3D3020", transform: "rotate(45deg)" }} />
        </IconButton>
        {onDelete && (
          <IconButton size="small" sx={{ p: 0 }} onClick={() => onDelete()}>
            <DeleteIcon sx={{ fontSize: 9, color: "#8B7355" }} />
          </IconButton>
        )}
      </Box>
    );
  }

  return (
    <Box
      onClick={(e) => {
        e.stopPropagation();
        setLabelVal(shelf.label ?? "");
        setPosVal(String(shelf.position));
        setEditing(true);
      }}
      sx={{
        position: "absolute",
        left: 4,
        top: 6,
        zIndex: 3,
        bgcolor: "#EDE9E0",
        border: "1px solid #C8C0B0",
        borderRadius: "3px",
        px: "5px",
        py: "2px",
        lineHeight: 1,
        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        display: "flex",
        alignItems: "center",
        gap: 0.5,
        cursor: "pointer",
        "&:hover": { borderColor: "#A09080" },
      }}
    >
      <Typography
        sx={{
          fontSize: "9px",
          fontWeight: 700,
          color: "#3D3020",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {displayLabel}
      </Typography>
      {onDelete && (
        <IconButton size="small" sx={{ p: 0 }} onClick={(e) => { e.stopPropagation(); onDelete(); }}>
          <DeleteIcon sx={{ fontSize: 10, color: "#8B7355" }} />
        </IconButton>
      )}
    </Box>
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
      <Box
        sx={{
          position: "absolute",
          left: 10,
          top: 4,
          zIndex: 5,
          bgcolor: "rgba(255,255,255,0.95)",
          border: "1px solid #C0C0C0",
          borderRadius: "3px",
          p: "4px 6px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
          display: "flex",
          alignItems: "center",
          gap: "4px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <InputBase
          value={labelVal}
          onChange={(e) => setLabelVal(e.target.value)}
          placeholder={`D${shelf.position}`}
          autoFocus
          sx={{ fontSize: 9, fontWeight: 700, color: "#444", width: 50, "& input": { p: 0 } }}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
        <InputBase
          value={posVal}
          onChange={(e) => setPosVal(e.target.value)}
          placeholder="#"
          type="number"
          sx={{ fontSize: 9, color: "#444", width: 24, "& input": { p: 0, textAlign: "center" } }}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
        />
        <IconButton size="small" sx={{ p: 0 }} onClick={commit}>
          <AddIcon sx={{ fontSize: 10, color: "#444", transform: "rotate(45deg)" }} />
        </IconButton>
        {onDelete && (
          <IconButton size="small" sx={{ p: 0 }} onClick={() => onDelete()}>
            <DeleteIcon sx={{ fontSize: 9, color: "#999" }} />
          </IconButton>
        )}
      </Box>
    );
  }

  return (
    <Box
      onClick={(e) => {
        e.stopPropagation();
        setLabelVal(shelf.label ?? "");
        setPosVal(String(shelf.position));
        setEditing(true);
      }}
      sx={{
        position: "absolute",
        left: 10,
        top: 4,
        zIndex: 3,
        bgcolor: "rgba(255,255,255,0.85)",
        border: "1px solid #C0C0C0",
        borderRadius: "2px",
        px: "4px",
        py: "1px",
        lineHeight: 1,
        cursor: "pointer",
        "&:hover": { borderColor: "#888" },
      }}
    >
      <Typography
        sx={{
          fontSize: "8px",
          fontWeight: 700,
          color: "#444",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
          display: "flex",
          alignItems: "center",
          gap: 0.5,
        }}
      >
        {displayLabel}
        {onDelete && (
          <IconButton
            size="small"
            sx={{ p: 0 }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <DeleteIcon sx={{ fontSize: 9, color: "#999" }} />
          </IconButton>
        )}
      </Typography>
    </Box>
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
    <Box sx={{ textAlign: "center", mt: 1 }}>
      <Tooltip title={label} arrow>
        <IconButton
          size="small"
          onClick={onClick}
          sx={{
            bgcolor: "grey.100",
            "&:hover": { bgcolor: "grey.200" },
          }}
        >
          <AddIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
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
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: "2px",
          mb: variant === "shelf" ? "2px" : 0,
          ...(variant === "drawer" && { width: 28, flexShrink: 0, flexDirection: "column" }),
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <InputBase
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          autoFocus
          placeholder={defaultLabel}
          sx={{
            fontSize: variant === "drawer" ? "7px" : "8px",
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
            width: variant === "drawer" ? 24 : 40,
            "& input": { p: 0, textAlign: "center", color: "rgba(255,255,255,0.7)" },
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") { setVal(bay.label ?? ""); setEditing(false); }
          }}
        />
        {onDelete && (
          <IconButton
            size="small"
            sx={{ p: 0, opacity: 0.5, "&:hover": { opacity: 1 } }}
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
          >
            <DeleteIcon sx={{ fontSize: variant === "drawer" ? 8 : 9, color: "rgba(255,255,255,0.6)" }} />
          </IconButton>
        )}
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: variant === "drawer" ? "1px" : "2px",
        mb: variant === "shelf" ? "2px" : 0,
        cursor: onSave ? "pointer" : "default",
        ...(variant === "drawer" && { width: 28, flexShrink: 0, flexDirection: "column" }),
        "&:hover": onSave ? { "& .bay-label-text": { color: "rgba(255,255,255,0.8)" } } : {},
      }}
      onClick={onSave ? (e) => { e.stopPropagation(); setVal(bay.label ?? ""); setEditing(true); } : undefined}
    >
      <Typography
        className="bay-label-text"
        sx={{
          fontSize: variant === "drawer" ? "7px" : "8px",
          fontWeight: 700,
          color: "rgba(255,255,255,0.45)",
          letterSpacing: "0.04em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {displayLabel}
      </Typography>
      {onDelete && (
        <IconButton
          size="small"
          sx={{ p: 0, opacity: 0.3, "&:hover": { opacity: 1 } }}
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <DeleteIcon sx={{ fontSize: variant === "drawer" ? 8 : 9, color: "rgba(255,255,255,0.6)" }} />
        </IconButton>
      )}
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE: Open Shelving (bookshelf with wooden planks)
// ═══════════════════════════════════════════════════════════════════════════════

function ShelfBayGroup({
  bay,
  isFirst,
  slotShape,
  shelfLabel,
  callbacks,
}: {
  bay: BayData;
  isFirst: boolean;
  slotShape: SlotShape;
  shelfLabel: string;
  callbacks: RackVisualizerCallbacks;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        borderLeft: isFirst ? "none" : "2px solid rgba(255,255,255,0.12)",
        px: "5px",
      }}
    >
      {(callbacks.onDeleteBay || callbacks.onSaveBayLabel) && (
        <BayLabel
          bay={bay}
          variant="shelf"
          onSave={callbacks.onSaveBayLabel ? (v) => callbacks.onSaveBayLabel!(bay.id, v) : undefined}
          onDelete={callbacks.onDeleteBay ? () => callbacks.onDeleteBay!(bay.id) : undefined}
        />
      )}
      <BaySlots bay={bay} slotSize={40} shape={slotShape} context={`${shelfLabel} · ${bay.label || `B${bay.position}`}`} callbacks={callbacks} />
    </Box>
  );
}

function ShelfUnit({
  shelf,
  slotShape,
  callbacks,
}: {
  shelf: ShelfData;
  slotShape: SlotShape;
  callbacks: RackVisualizerCallbacks;
}) {
  return (
    <Box sx={{ position: "relative" }}>
      {(callbacks.onSaveShelf || callbacks.onDeleteShelf) && (
        <ShelfLabel
          shelf={shelf}
          onSave={
            callbacks.onSaveShelf
              ? (updates) => callbacks.onSaveShelf!(shelf.id, updates)
              : undefined
          }
          onDelete={
            callbacks.onDeleteShelf
              ? () => callbacks.onDeleteShelf!(shelf.id)
              : undefined
          }
        />
      )}

      <Box
        sx={{
          minHeight: 64,
          pl: "6px",
          pr: "6px",
          pt: "22px",
          pb: "6px",
          display: "flex",
          flexDirection: "row",
          alignItems: "flex-end",
          bgcolor: "rgba(245,240,232,0.08)",
          gap: "2px",
          overflowX: "auto",
          boxShadow:
            "inset 0 8px 12px rgba(0,0,0,0.15), inset 0 -1px 0 rgba(0,0,0,0.1)",
          "&::-webkit-scrollbar": { height: 4 },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "rgba(255,255,255,0.15)",
            borderRadius: 2,
          },
        }}
      >
        {shelf.bays.map((bay, i) => (
          <ShelfBayGroup
            key={bay.id}
            bay={bay}
            isFirst={i === 0}
            slotShape={slotShape}
            shelfLabel={shelf.label || `S${shelf.position}`}
            callbacks={callbacks}
          />
        ))}
        {callbacks.onAddBayToShelf && (
          <Tooltip title="Add bay" arrow>
            <Box
              onClick={(e) => {
                e.stopPropagation();
                callbacks.onAddBayToShelf!(shelf.id, shelf.bays ?? []);
              }}
              sx={{
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "2px dashed",
                borderColor: "action.disabled",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
                cursor: "pointer",
                ml: 1,
                bgcolor: "action.hover",
                "&:hover": {
                  borderColor: "text.secondary",
                  bgcolor: "action.selected",
                },
              }}
            >
              <AddIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            </Box>
          </Tooltip>
        )}
      </Box>

      {/* Wooden plank */}
      <Box
        sx={{
          height: 12,
          background:
            "linear-gradient(to bottom, #5C4433 0%, #3D2E1E 35%, #2C2018 100%)",
          borderTop: "1px solid #6B5040",
          boxShadow:
            "0 4px 10px rgba(0,0,0,0.45), 0 1px 3px rgba(0,0,0,0.5)",
        }}
      />
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE: Cabinet / Drawers
// ═══════════════════════════════════════════════════════════════════════════════

function DrawerUnit({
  shelf,
  slotShape,
  callbacks,
}: {
  shelf: ShelfData;
  slotShape: SlotShape;
  callbacks: RackVisualizerCallbacks;
}) {
  const bays = shelf.bays ?? [];
  // Find the max number of slots across all rows to size the column grid
  const maxCols = Math.max(1, ...bays.map((b) => (b.slots ?? []).length));

  return (
    <Box sx={{ position: "relative" }}>
      <Box
        sx={{
          background: "linear-gradient(to bottom, #E8E8E8 0%, #D4D4D4 50%, #BFBFBF 100%)",
          border: "1px solid #A0A0A0",
          borderRadius: "3px",
          mx: "4px",
          overflow: "hidden",
          boxShadow: "0 2px 6px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.6)",
        }}
      >
        {/* Drawer handle bar */}
        <Box
          sx={{
            height: 6,
            mx: "30%",
            mt: "4px",
            borderRadius: "3px",
            background: "linear-gradient(to bottom, #999 0%, #777 100%)",
            boxShadow: "0 1px 2px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.3)",
          }}
        />

        {/* Drawer label — only in edit mode */}
        {(callbacks.onSaveShelf || callbacks.onDeleteShelf) && (
          <DrawerLabel
            shelf={shelf}
            onSave={
              callbacks.onSaveShelf
                ? (updates) => callbacks.onSaveShelf!(shelf.id, updates)
                : undefined
            }
            onDelete={
              callbacks.onDeleteShelf
                ? () => callbacks.onDeleteShelf!(shelf.id)
                : undefined
            }
          />
        )}

        {/* Drawer interior — rows (bays) × columns (slots) grid */}
        <Box
          sx={{
            px: "6px",
            pt: "14px",
            pb: "8px",
            bgcolor: "#3A3A3A",
            m: "4px",
            mt: "6px",
            borderRadius: "2px",
            boxShadow: "inset 0 4px 10px rgba(0,0,0,0.4)",
            overflowX: "auto",
            "&::-webkit-scrollbar": { height: 4 },
            "&::-webkit-scrollbar-thumb": {
              bgcolor: "rgba(255,255,255,0.2)",
              borderRadius: 2,
            },
          }}
        >
          {bays.length > 0 ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              {bays.map((bay, rowIdx) => {
                const slots = bay.slots ?? [];
                return (
                  <Box key={bay.id}>
                    {/* Row: bay label on left, slots across, controls on right */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        borderTop: rowIdx > 0 ? "1px solid rgba(255,255,255,0.08)" : "none",
                        pt: rowIdx > 0 ? "4px" : 0,
                      }}
                    >
                      {/* Row label — only in edit mode */}
                      {(callbacks.onDeleteBay || callbacks.onSaveBayLabel) && (
                        <BayLabel
                          bay={bay}
                          variant="drawer"
                          onSave={callbacks.onSaveBayLabel ? (v) => callbacks.onSaveBayLabel!(bay.id, v) : undefined}
                          onDelete={callbacks.onDeleteBay ? () => callbacks.onDeleteBay!(bay.id) : undefined}
                        />
                      )}

                      {/* Slot cells for this row */}
                      <Box sx={{ display: "flex", gap: `${CELL_GAP}px`, alignItems: "center", flexWrap: "nowrap" }}>
                        {slots.map((slot) => (
                          <SlotCell
                            key={slot.id}
                            slot={slot}
                            size={36}
                            shape={slot.shape ?? slotShape}
                            context={`${shelf.label || `D${shelf.position}`} · ${bay.label || `R${bay.position}`}`}
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
                                ? () => callbacks.onPrintSlot!(slot, `${shelf.label || `D${shelf.position}`} · ${bay.label || `R${bay.position}`}`)
                                : undefined
                            }
                          />
                        ))}

                        {/* Add slot to this row */}
                        {callbacks.onAddSlotToBay && (
                          <Tooltip title="Add slot" arrow>
                            <IconButton
                              size="small"
                              onClick={(e) => { e.stopPropagation(); callbacks.onAddSlotToBay!(bay.id, slots); }}
                              sx={{
                                width: 22,
                                height: 22,
                                bgcolor: "action.hover",
                                "&:hover": { bgcolor: "action.selected" },
                              }}
                            >
                              <AddIcon sx={{ fontSize: 12, color: "text.secondary" }} />
                            </IconButton>
                          </Tooltip>
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.3)", py: 1, textAlign: "center" }}>
              Empty drawer
            </Typography>
          )}

          {/* Add row (bay) button */}
          {callbacks.onAddBayToShelf && (
            <Box sx={{ display: "flex", justifyContent: "center", mt: 1, pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
              <Tooltip title="Add row" arrow>
                <IconButton
                  size="small"
                  onClick={(e) => { e.stopPropagation(); callbacks.onAddBayToShelf!(shelf.id, bays); }}
                  sx={{
                    width: 22,
                    height: 22,
                    bgcolor: "action.hover",
                    "&:hover": { bgcolor: "action.selected" },
                  }}
                >
                  <AddIcon sx={{ fontSize: 12, color: "text.secondary" }} />
                </IconButton>
              </Tooltip>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE: AMS / Compact (Bambu AMS-style boxes)
// ═══════════════════════════════════════════════════════════════════════════════

function AmsUnit({
  shelf,
  slotShape,
  callbacks,
}: {
  shelf: ShelfData;
  slotShape: SlotShape;
  callbacks: RackVisualizerCallbacks;
}) {
  const unitLabel = shelf.label || `Unit ${shelf.position}`;

  // AMS flattens bays — all slots from all bays in one row
  const allSlots = shelf.bays.flatMap((bay) => bay.slots);

  return (
    <Box
      sx={{
        position: "relative",
        background: "linear-gradient(135deg, #2D2D2D 0%, #1A1A1A 100%)",
        borderRadius: "10px",
        border: "1px solid #444",
        overflow: "hidden",
        boxShadow: "0 3px 12px rgba(0,0,0,0.4)",
        minWidth: 180,
      }}
    >
      {/* AMS top lid / status bar */}
      <Box
        sx={{
          height: 24,
          background: "linear-gradient(to bottom, #3D3D3D 0%, #2A2A2A 100%)",
          borderBottom: "1px solid #444",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
        }}
      >
        <Typography
          sx={{
            fontSize: "9px",
            fontWeight: 700,
            color: "rgba(255,255,255,0.7)",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          {unitLabel}
        </Typography>
        {callbacks.onDeleteShelf && (
          <IconButton
            size="small"
            sx={{ p: 0 }}
            onClick={() => callbacks.onDeleteShelf!(shelf.id)}
          >
            <DeleteIcon sx={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }} />
          </IconButton>
        )}
      </Box>

      {/* Slots in a compact row */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          p: "10px 8px",
          overflowX: "auto",
          "&::-webkit-scrollbar": { height: 4 },
          "&::-webkit-scrollbar-thumb": {
            bgcolor: "rgba(255,255,255,0.15)",
            borderRadius: 2,
          },
        }}
      >
        {allSlots.map((slot) => (
          <SlotCell
            key={slot.id}
            slot={slot}
            size={36}
            shape={slot.shape ?? slotShape}
            context={shelf.label || `Unit ${shelf.position}`}
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
                ? () => callbacks.onPrintSlot!(slot, shelf.label || `Unit ${shelf.position}`)
                : undefined
            }
          />
        ))}
        {allSlots.length === 0 && (
          <Typography sx={{ fontSize: 10, color: "rgba(255,255,255,0.3)", py: 1 }}>
            No slots
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Main export — RackVisualizer
// ═══════════════════════════════════════════════════════════════════════════════

// ── Render a single shelf using its resolved display style ───────────────────

function ShelfRenderer({
  shelf,
  resolvedStyle,
  slotShape,
  callbacks,
}: {
  shelf: ShelfData;
  resolvedStyle: RackDisplayStyle;
  slotShape: SlotShape;
  callbacks: RackVisualizerCallbacks;
}) {
  switch (resolvedStyle) {
    case "drawer":
      return <DrawerUnit shelf={shelf} slotShape={slotShape} callbacks={callbacks} />;
    case "ams":
      return <AmsUnit shelf={shelf} slotShape={slotShape} callbacks={callbacks} />;
    case "grid":
      // Inline grid for a single shelf
      return (
        <Box sx={{ mb: 1 }}>
          {(callbacks.onSaveShelf || callbacks.onDeleteShelf) && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
              <Typography sx={{ fontSize: "11px", fontWeight: 700, color: "text.secondary", letterSpacing: "0.06em", textTransform: "uppercase" }}>
                {shelf.label || `Section ${shelf.position}`}
              </Typography>
              {callbacks.onDeleteShelf && (
                <IconButton size="small" sx={{ p: 0 }} onClick={() => callbacks.onDeleteShelf!(shelf.id)}>
                  <DeleteIcon sx={{ fontSize: 12 }} color="action" />
                </IconButton>
              )}
            </Box>
          )}
          <Box sx={{ display: "flex", flexWrap: "nowrap", gap: `${CELL_GAP}px`, overflowX: "auto", "&::-webkit-scrollbar": { height: 4 }, "&::-webkit-scrollbar-thumb": { bgcolor: "rgba(0,0,0,0.15)", borderRadius: 2 } }}>
            {shelf.bays.flatMap((bay) =>
              bay.slots.map((slot) => (
                <SlotCell
                  key={slot.id}
                  slot={slot}
                  size={36}
                  shape={slot.shape ?? slotShape}
                  context={`${shelf.label || `Section ${shelf.position}`} · ${bay.label || `B${bay.position}`}`}
                  onSaveLabel={callbacks.onSaveSlotLabel ? (v) => callbacks.onSaveSlotLabel!(slot.id, v) : undefined}
                  onDelete={callbacks.onDeleteSlot ? () => callbacks.onDeleteSlot!(slot.id) : undefined}
                  onPrint={callbacks.onPrintSlot ? () => callbacks.onPrintSlot!(slot, `${shelf.label || `Section ${shelf.position}`} · ${bay.label || `B${bay.position}`}`) : undefined}
                />
              ))
            )}
          </Box>
        </Box>
      );
    case "shelf":
    default:
      return <ShelfUnit shelf={shelf} slotShape={slotShape} callbacks={callbacks} />;
  }
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
  // When not editing, strip out mutation callbacks (add/delete/rename) so controls don't render
  // Keep interaction callbacks (click, drag, print, context menu) in all modes
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

  // Require 8px of movement before starting drag — allows normal clicks to pass through
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
      <Box sx={{ overflowX: "auto", pb: 1 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column-reverse",
            gap: "3px",
          }}
        >
          {shelvesSorted.map((shelf) => {
            const shelfStyle = shelf.displayStyle ?? rackDefault;
            return (
              <ShelfRenderer
                key={shelf.id}
                shelf={shelf}
                resolvedStyle={shelfStyle}
                slotShape={slotShape}
                callbacks={cb}
              />
            );
          })}
        </Box>

        {cb.onAddShelfToRack && (
          <AddLevelButton
            label="Add shelf"
            onClick={() => cb.onAddShelfToRack!(rack.id, rack.shelves ?? [])}
          />
        )}
      </Box>
    </SlotSelectionContext.Provider>

    {/* Single context menu for all slots */}
    <Menu
      open={ctxMenuSlotId !== null}
      onClose={closeCtxMenu}
      anchorReference="anchorPosition"
      anchorPosition={ctxMenuPos ? { top: ctxMenuPos.y, left: ctxMenuPos.x } : undefined}
      slotProps={{ paper: { sx: { minWidth: 180 } } }}
    >
      {(() => {
        const st = ctxMenuSlot?.status as any;
        const isActive = st?.state === "active";
        return [
          isActive && st?.userItemId && cb.onViewItem && (
            <MenuItem key="view" onClick={() => { cb.onViewItem!(st.userItemId); closeCtxMenu(); }}>
              <ListItemIcon><OpenInNewIcon fontSize="small" /></ListItemIcon>
              <ListItemText>View Details</ListItemText>
            </MenuItem>
          ),
          isActive && st?.userItemId && cb.onEditItem && (
            <MenuItem key="edit" onClick={() => { cb.onEditItem!(st.userItemId); closeCtxMenu(); }}>
              <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Edit Item</ListItemText>
            </MenuItem>
          ),
          isActive && cb.onMoveItem && (
            <MenuItem key="move" onClick={() => { cb.onMoveItem!(ctxMenuSlotId!); closeCtxMenu(); }}>
              <ListItemIcon><SwapHorizIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Move to Another Slot</ListItemText>
            </MenuItem>
          ),
          isActive && cb.onRemoveItem && (
            <MenuItem key="remove" onClick={() => { cb.onRemoveItem!(ctxMenuSlotId!); closeCtxMenu(); }}>
              <ListItemIcon><RemoveCircleOutlineIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Remove from Slot</ListItemText>
            </MenuItem>
          ),
          isActive && cb.onPrintSlot && <Divider key="divider" />,
          isActive && cb.onPrintSlot && ctxMenuSlot && (
            <MenuItem key="print" onClick={() => { cb.onPrintSlot!(ctxMenuSlot, ctxMenuContext); closeCtxMenu(); }}>
              <ListItemIcon><PrintIcon fontSize="small" /></ListItemIcon>
              <ListItemText>Print Label</ListItemText>
            </MenuItem>
          ),
          !isActive && (
            <MenuItem key="empty" disabled>
              <ListItemText>Empty slot</ListItemText>
            </MenuItem>
          ),
        ].filter(Boolean);
      })()}
    </Menu>

    </DndContext>
  );
}
