"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import MemoryIcon from "@mui/icons-material/Memory";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import PrintIcon from "@mui/icons-material/Print";
import CheckIcon from "@mui/icons-material/Check";
import EditIcon from "@mui/icons-material/Edit";
import CloseIcon from "@mui/icons-material/Close";
import TextField from "@mui/material/TextField";
import {
  listMyZones,
  listRacksByZone,
  getRackTopology,
  updateZone,
  updateRack,
  updateShelf,
  updateBay,
  updateSlot,
  createShelf,
  createBay,
  createSlot,
  removeShelf,
  removeBay,
  removeSlot,
} from "@/lib/actions/hardware";
import { LocationDialog } from "@/components/locations/location-dialog";
import {
  PrintLabelDialog,
  type PrintLabelItem,
} from "@/components/labels/print-label-dialog";
import {
  RackVisualizer,
  type RackVisualizerCallbacks,
} from "@/components/locations/rack-visualizer";

type SlotStatusData = { state: string; [key: string]: unknown };
type SlotData = { id: string; position: number; label?: string | null; address?: string | null; status?: SlotStatusData | null; [key: string]: unknown };
type BayData = { id: string; position: number; label?: string | null; slots: SlotData[]; [key: string]: unknown };
type ShelfData = { id: string; position: number; label?: string | null; bays: BayData[]; [key: string]: unknown };
type RackTopology = { id: string; name?: string; position?: number | null; shelves: ShelfData[]; [key: string]: unknown };
type ZoneSummary = { id: string; name: string; type?: string | null; description: string | null; [key: string]: unknown };

type ZoneWithRacks = { zone: ZoneSummary; racks: RackTopology[] };
type PrintDialogState = { open: boolean; items: PrintLabelItem[]; title?: string };
const closedPrint: PrintDialogState = { open: false, items: [] };

export function RackTopologyTab({ editing = false }: { editing?: boolean } = {}) {
  const [zonesWithRacks, setZonesWithRacks] = useState<ZoneWithRacks[]>([]);
  const [loading, setLoading] = useState(true);
  const [printDialog, setPrintDialog] = useState<PrintDialogState>(closedPrint);
  const [addDialog, setAddDialog] = useState<{ open: boolean; level: "zone" | "rack"; parentId?: string }>({ open: false, level: "zone" });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; level: "zone" | "rack"; existing?: Record<string, any> | null }>({ open: false, level: "zone" });
  // Track which racks/shelves are expanded
  const [expandedRacks, setExpandedRacks] = useState<Set<string>>(new Set());
  const [expandedShelves, setExpandedShelves] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    const result = await listMyZones();
    if (result.data) {
      const zoneList = result.data as ZoneSummary[];
      const zwr: ZoneWithRacks[] = [];
      await Promise.allSettled(
        zoneList.map(async (zone) => {
          const racksResult = await listRacksByZone(zone.id);
          const rackSummaries = racksResult.data ?? [];
          const rackTopos: RackTopology[] = [];
          await Promise.allSettled(
            (rackSummaries as any[]).map(async (rack: any) => {
              const t = await getRackTopology(rack.id);
              if (t.data) rackTopos.push(t.data as RackTopology);
            })
          );
          zwr.push({ zone, racks: rackTopos });
        })
      );
      setZonesWithRacks(zwr);
      // Auto-expand all on first load
      if (expandedRacks.size === 0) {
        const rIds = new Set<string>();
        const sIds = new Set<string>();
        zwr.forEach(({ racks }) => racks.forEach((r) => {
          rIds.add(r.id);
          r.shelves?.forEach((s) => sIds.add(s.id));
        }));
        setExpandedRacks(rIds);
        setExpandedShelves(sIds);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaved = () => {
    setAddDialog({ open: false, level: "zone" });
    setDeleteDialog({ open: false, level: "zone" });
    loadData();
  };

  const toggleRack = (id: string) => setExpandedRacks((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleShelf = (id: string) => setExpandedShelves((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  // ── Inline save helpers ──
  const saveShelf = async (id: string, updates: { label?: string | null; position?: number }) => {
    await updateShelf(id, updates);
    loadData();
  };
  const saveBayLabel = async (id: string, label: string) => {
    await updateBay(id, { label: label || null });
    loadData();
  };
  const saveSlotLabel = async (id: string, label: string) => {
    await updateSlot(id, { label: label || null });
    loadData();
  };

  // ── Inline add helpers ──
  const addShelfToRack = async (rackId: string, currentShelves: ShelfData[]) => {
    const maxPos = (currentShelves ?? []).reduce((m, s) => Math.max(m, s.position), 0);
    await createShelf({ rackId, position: maxPos + 1 });
    loadData();
  };
  const addBayToShelf = async (shelfId: string, currentBays: BayData[]) => {
    const maxPos = (currentBays ?? []).reduce((m, b) => Math.max(m, b.position), 0);
    await createBay({ shelfId, position: maxPos + 1 });
    loadData();
  };
  const addSlotToBay = async (bayId: string, currentSlots: SlotData[]) => {
    const maxPos = (currentSlots ?? []).reduce((m, s) => Math.max(m, s.position), 0);
    await createSlot({ bayId, position: maxPos + 1 });
    loadData();
  };

  // ── Inline delete helpers ──
  const deleteShelf = async (id: string) => { await removeShelf(id); loadData(); };
  const deleteBay = async (id: string) => { await removeBay(id); loadData(); };
  const deleteSlot = async (id: string) => { await removeSlot(id); loadData(); };

  // ── Print helpers ──
  const baySlotItems = (bay: BayData, shelfLabel: string | number, rackName: string): PrintLabelItem[] =>
    bay.slots.map((slot) => ({
      label: `Slot ${slot.label || slot.position}`,
      location: `${rackName} / Shelf ${shelfLabel} / Bay ${bay.label || bay.position} / Slot ${slot.label || slot.position}`,
      ...(slot.address ? { lotNumber: slot.address } : {}),
    }));

  const openRackPrint = (rack: RackTopology) => {
    const rackName = rack.name ?? rack.id.slice(0, 8);
    const items = (rack.shelves ?? []).flatMap((shelf) =>
      shelf.bays.flatMap((bay) => baySlotItems(bay, shelf.label || shelf.position, rackName))
    );
    if (items.length === 0) return;
    setPrintDialog({ open: true, items, title: `Print — Rack ${rackName} (${items.length} slots)` });
  };

  const openZonePrint = (zone: ZoneSummary, zoneRacks: RackTopology[]) => {
    const items = zoneRacks.flatMap((rack) => {
      const rackName = rack.name ?? rack.id.slice(0, 8);
      return (rack.shelves ?? []).flatMap((shelf) =>
        shelf.bays.flatMap((bay) => baySlotItems(bay, shelf.label || shelf.position, rackName))
      );
    });
    if (items.length === 0) return;
    setPrintDialog({ open: true, items, title: `Print — ${zone.name} (${items.length} slots)` });
  };

  if (loading) {
    return (
      <Stack spacing={2}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={120} />
        ))}
      </Stack>
    );
  }

  if (zonesWithRacks.length === 0) {
    return (
      <>
        <Box sx={{ textAlign: "center", py: 8 }}>
          <MemoryIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography variant="subtitle1" fontWeight={500}>No locations configured</Typography>
          <Typography variant="body2" color="text.secondary">Add your first zone to start organizing your storage layout.</Typography>
        </Box>
        <LocationDialog
          open={addDialog.open}
          level={addDialog.level}
          parentId={addDialog.parentId}
          onClose={() => setAddDialog({ open: false, level: "zone" })}
          onSaved={handleSaved}
        />
      </>
    );
  }

  return (
    <>
      <Stack spacing={2}>
        {zonesWithRacks.map(({ zone, racks }) => (
          <Card key={zone.id}>
            <CardContent>
              {/* ── Zone header ── */}
              <ZoneHeader
                zone={zone}
                editing={editing}
                onSave={async (updates) => { await updateZone(zone.id, updates); loadData(); }}
                onPrint={() => openZonePrint(zone, racks)}
                onDelete={() => setDeleteDialog({ open: true, level: "zone", existing: zone })}
              />

              {/* ── Racks ── */}
              {racks.map((rack) => {
                const rackExpanded = expandedRacks.has(rack.id);
                return (
                  <Box key={rack.id} sx={{ border: 1, borderColor: "divider", borderRadius: 2, mb: 1, overflow: "hidden" }}>
                    {/* Rack header */}
                    <RackHeader
                      rack={rack}
                      expanded={rackExpanded}
                      editing={editing}
                      onToggle={() => toggleRack(rack.id)}
                      onSave={async (updates) => { await updateRack(rack.id, updates); loadData(); }}
                      onPrint={() => openRackPrint(rack)}
                      onDelete={() => setDeleteDialog({ open: true, level: "rack", existing: rack })}
                    />

                    {/* Rack content — visual shelf display */}
                    {rackExpanded && (
                      <Box sx={{ px: 1.5, py: 1 }}>
                        <RackVisualizer
                          rack={rack}
                          displayStyle="shelf"
                          editing={editing}
                          callbacks={{
                            onSaveSlotLabel: saveSlotLabel,
                            onDeleteSlot: deleteSlot,
                            onAddSlotToBay: addSlotToBay,
                            onSaveBayLabel: saveBayLabel,
                            onDeleteBay: deleteBay,
                            onAddBayToShelf: addBayToShelf,
                            onSaveShelf: saveShelf,
                            onDeleteShelf: deleteShelf,
                            onAddShelfToRack: addShelfToRack,
                            onPrintSlot: (slot, context) => {
                              const rackName = rack.name ?? rack.id.slice(0, 8);
                              setPrintDialog({
                                open: true,
                                items: [{
                                  label: `Slot ${slot.label || slot.position}`,
                                  location: `${rackName} / ${context} / Slot ${slot.label || slot.position}`,
                                  ...(slot.address ? { lotNumber: slot.address } : {}),
                                }],
                                title: `Print — Slot ${slot.label || slot.position}`,
                              });
                            },
                          }}
                        />
                      </Box>
                    )}
                  </Box>
                );
              })}

              {/* Add rack — only in edit mode */}
              {editing && <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setAddDialog({ open: true, level: "rack", parentId: zone.id })}
                sx={{ mt: 0.5 }}
              >
                Add Rack
              </Button>}
            </CardContent>
          </Card>
        ))}
      </Stack>

      <LocationDialog
        open={addDialog.open}
        level={addDialog.level}
        parentId={addDialog.parentId}
        onClose={() => setAddDialog({ open: false, level: "zone" })}
        onSaved={handleSaved}
      />

      <LocationDialog
        open={deleteDialog.open}
        level={deleteDialog.level}
        existing={deleteDialog.existing}
        deleteMode
        onClose={() => setDeleteDialog({ open: false, level: "zone" })}
        onSaved={handleSaved}
      />

      <PrintLabelDialog
        open={printDialog.open}
        items={printDialog.items}
        title={printDialog.title}
        onClose={() => setPrintDialog(closedPrint)}
      />

    </>
  );
}

// ── Inline editable text ──────────────────────────────────────────────────────

// ── Zone header with inline-expandable editing ──────────────────────────────

function ZoneHeader({
  zone,
  editing: pageEditing,
  onSave,
  onPrint,
  onDelete,
}: {
  zone: ZoneSummary;
  editing: boolean;
  onSave: (updates: { name?: string; description?: string | null; nfcTagId?: string | null }) => Promise<void>;
  onPrint: () => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(zone.name);
  const [description, setDescription] = useState(zone.description ?? "");
  const [shortcode, setShortcode] = useState((zone as any).nfcTagId ?? "");

  useEffect(() => {
    setName(zone.name);
    setDescription(zone.description ?? "");
    setShortcode((zone as any).nfcTagId ?? "");
  }, [zone]);

  const commit = async () => {
    const updates: Record<string, any> = {};
    if (name.trim() && name.trim() !== zone.name) updates.name = name.trim();
    if ((description || null) !== (zone.description || null)) updates.description = description || null;
    if ((shortcode || null) !== ((zone as any).nfcTagId || null)) updates.nfcTagId = shortcode || null;
    if (Object.keys(updates).length > 0) await onSave(updates);
    setEditing(false);
  };

  if (editing) {
    return (
      <Box sx={{ mb: 1.5 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
          <MemoryIcon color="primary" />
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            variant="standard"
            placeholder="Zone name"
            autoFocus
            sx={{ fontWeight: 600, fontSize: "1.25rem", "& input": { fontWeight: 600, fontSize: "1.25rem" } }}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          />
          <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
            <Tooltip title="Save"><IconButton size="small" onClick={commit}><CheckIcon fontSize="small" color="primary" /></IconButton></Tooltip>
            <Tooltip title="Cancel"><IconButton size="small" onClick={() => setEditing(false)}><CloseIcon fontSize="small" /></IconButton></Tooltip>
          </Box>
        </Box>
        <Box sx={{ display: "flex", gap: 1.5, pl: 4.5 }}>
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            size="small"
            fullWidth
            multiline
            maxRows={2}
            placeholder="Optional"
            onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
          />
          <TextField
            label="Shortcode"
            value={shortcode}
            onChange={(e) => setShortcode(e.target.value)}
            size="small"
            sx={{ minWidth: 120 }}
            placeholder="e.g. OF"
            helperText="Address prefix"
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
          />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
      <Box
        sx={{ display: "flex", alignItems: "center", gap: 1.5, cursor: pageEditing ? "pointer" : "default" }}
        onClick={pageEditing ? () => setEditing(true) : undefined}
      >
        <MemoryIcon color="primary" />
        <Typography variant="h6" fontWeight={600} sx={pageEditing ? { borderBottom: "1px dashed transparent", "&:hover": { borderBottomColor: "text.secondary" } } : {}}>
          {zone.name}
        </Typography>
        {zone.description && (
          <Typography variant="body2" color="text.secondary">{zone.description}</Typography>
        )}
        {(zone as any).nfcTagId && (
          <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>
            [{(zone as any).nfcTagId}]
          </Typography>
        )}
      </Box>
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
        <Tooltip title="Print all labels"><IconButton size="small" onClick={onPrint}><PrintIcon fontSize="small" /></IconButton></Tooltip>
        {pageEditing && <Tooltip title="Delete zone"><IconButton size="small" onClick={onDelete}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
      </Box>
    </Box>
  );
}

// ── Rack header with inline-expandable editing ───────────────────────────────

function RackHeader({
  rack,
  expanded,
  editing: pageEditing,
  onToggle,
  onSave,
  onPrint,
  onDelete,
}: {
  rack: RackTopology;
  expanded: boolean;
  editing: boolean;
  onToggle: () => void;
  onSave: (updates: { name?: string; position?: number | null }) => Promise<void>;
  onPrint: () => void;
  onDelete: () => void;
}) {
  const [inlineEditing, setInlineEditing] = useState(false);
  const rackName = rack.name ?? rack.id.slice(0, 8);
  const [name, setName] = useState(rackName);
  const [position, setPosition] = useState(String(rack.position ?? ""));

  useEffect(() => {
    setName(rack.name ?? rack.id.slice(0, 8));
    setPosition(String(rack.position ?? ""));
  }, [rack]);

  const commit = async () => {
    const updates: Record<string, any> = {};
    if (name.trim() && name.trim() !== rackName) updates.name = name.trim();
    const newPos = position.trim() ? parseInt(position) : null;
    if (newPos !== (rack.position ?? null)) updates.position = newPos;
    if (Object.keys(updates).length > 0) await onSave(updates);
    setInlineEditing(false);
  };

  if (inlineEditing) {
    return (
      <Box
        sx={{ px: 1.5, py: 1, bgcolor: "grey.50" }}
        onClick={(e) => e.stopPropagation()}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {expanded ? <ExpandLessIcon fontSize="small" color="action" /> : <ExpandMoreIcon fontSize="small" color="action" />}
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            size="small"
            variant="standard"
            placeholder="Rack name"
            autoFocus
            sx={{ fontWeight: 500, "& input": { fontWeight: 500 } }}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setInlineEditing(false); }}
          />
          <TextField
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            size="small"
            variant="standard"
            placeholder="Pos"
            type="number"
            sx={{ width: 50, "& input": { textAlign: "center" } }}
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setInlineEditing(false); }}
          />
          <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
            <Tooltip title="Save"><IconButton size="small" onClick={commit}><CheckIcon fontSize="small" color="primary" /></IconButton></Tooltip>
            <Tooltip title="Cancel"><IconButton size="small" onClick={() => setInlineEditing(false)}><CloseIcon fontSize="small" /></IconButton></Tooltip>
          </Box>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1,
        bgcolor: "grey.50", cursor: "pointer", "&:hover": { bgcolor: "grey.100" },
      }}
      onClick={onToggle}
    >
      {expanded ? <ExpandLessIcon fontSize="small" color="action" /> : <ExpandMoreIcon fontSize="small" color="action" />}
      <Typography
        fontWeight={500}
        sx={{
          cursor: pageEditing ? "pointer" : "default",
          ...(pageEditing ? { borderBottom: "1px dashed transparent", "&:hover": { borderBottomColor: "text.secondary" } } : {}),
        }}
        onClick={pageEditing ? (e) => { e.stopPropagation(); setInlineEditing(true); } : undefined}
      >
        {rackName}
      </Typography>
      {rack.position != null && (
        <Typography variant="caption" color="text.disabled" sx={{ fontFamily: "monospace" }}>
          #{rack.position}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary">
        {rack.shelves?.length ?? 0} {(rack.shelves?.length ?? 0) === 1 ? "shelf" : "shelves"}
      </Typography>
      <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
        <Tooltip title="Print labels"><IconButton size="small" onClick={(e) => { e.stopPropagation(); onPrint(); }}><PrintIcon fontSize="small" /></IconButton></Tooltip>
        {pageEditing && <Tooltip title="Delete rack"><IconButton size="small" onClick={(e) => { e.stopPropagation(); onDelete(); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
      </Box>
    </Box>
  );
}

