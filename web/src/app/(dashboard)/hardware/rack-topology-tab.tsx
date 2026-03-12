"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
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

type SlotStatusData = { state: string; [key: string]: unknown };
type SlotData = { id: string; position: number; label?: string | null; address?: string | null; status?: SlotStatusData | null; [key: string]: unknown };
type BayData = { id: string; position: number; label?: string | null; slots: SlotData[]; [key: string]: unknown };
type ShelfData = { id: string; position: number; label?: string | null; bays: BayData[]; [key: string]: unknown };
type RackTopology = { id: string; name?: string; position?: number | null; shelves: ShelfData[]; [key: string]: unknown };
type ZoneSummary = { id: string; name: string; type?: string | null; description: string | null; [key: string]: unknown };

const slotStateColors: Record<string, string> = {
  active: "#16A34A",
  empty: "#9CA3AF",
  error: "#DC2626",
  detecting: "#D97706",
  unknown_spool: "#7C3AED",
  removed: "#6B7280",
};

type ZoneWithRacks = { zone: ZoneSummary; racks: RackTopology[] };
type PrintDialogState = { open: boolean; items: PrintLabelItem[]; title?: string };
const closedPrint: PrintDialogState = { open: false, items: [] };

export function RackTopologyTab() {
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
  const saveZoneName = async (id: string, name: string) => {
    await updateZone(id, { name });
    loadData();
  };
  const saveRackName = async (id: string, name: string) => {
    await updateRack(id, { name });
    loadData();
  };
  const saveShelfLabel = async (id: string, label: string) => {
    await updateShelf(id, { label: label || null });
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
    const maxPos = currentShelves.reduce((m, s) => Math.max(m, s.position), 0);
    await createShelf({ rackId, position: maxPos + 1 });
    loadData();
  };
  const addBayToShelf = async (shelfId: string, currentBays: BayData[]) => {
    const maxPos = currentBays.reduce((m, b) => Math.max(m, b.position), 0);
    await createBay({ shelfId, position: maxPos + 1 });
    loadData();
  };
  const addSlotToBay = async (bayId: string, currentSlots: SlotData[]) => {
    const maxPos = currentSlots.reduce((m, s) => Math.max(m, s.position), 0);
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
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <MemoryIcon color="primary" />
                  <InlineEdit value={zone.name} variant="h6" fontWeight={600} onSave={(n) => saveZoneName(zone.id, n)} />
                  {zone.description && (
                    <Typography variant="body2" color="text.secondary">{zone.description}</Typography>
                  )}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Tooltip title="Print all labels"><IconButton size="small" onClick={() => openZonePrint(zone, racks)}><PrintIcon fontSize="small" /></IconButton></Tooltip>
                  <Tooltip title="Delete zone"><IconButton size="small" onClick={() => setDeleteDialog({ open: true, level: "zone", existing: zone })}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                </Box>
              </Box>

              {/* ── Racks ── */}
              {racks.map((rack) => {
                const rackExpanded = expandedRacks.has(rack.id);
                const rackName = rack.name ?? rack.id.slice(0, 8);
                return (
                  <Box key={rack.id} sx={{ border: 1, borderColor: "divider", borderRadius: 2, mb: 1, overflow: "hidden" }}>
                    {/* Rack header */}
                    <Box
                      sx={{
                        display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 1,
                        bgcolor: "grey.50", cursor: "pointer", "&:hover": { bgcolor: "grey.100" },
                      }}
                      onClick={() => toggleRack(rack.id)}
                    >
                      {rackExpanded ? <ExpandLessIcon fontSize="small" color="action" /> : <ExpandMoreIcon fontSize="small" color="action" />}
                      <InlineEdit value={rackName} fontWeight={500} onSave={(n) => saveRackName(rack.id, n)} />
                      <Typography variant="caption" color="text.secondary">
                        {rack.shelves?.length ?? 0} {(rack.shelves?.length ?? 0) === 1 ? "shelf" : "shelves"}
                      </Typography>
                      <Box sx={{ ml: "auto", display: "flex", gap: 0.5 }}>
                        <Tooltip title="Print labels"><IconButton size="small" onClick={(e) => { e.stopPropagation(); openRackPrint(rack); }}><PrintIcon fontSize="small" /></IconButton></Tooltip>
                        <Tooltip title="Delete rack"><IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, level: "rack", existing: rack }); }}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                      </Box>
                    </Box>

                    {/* Rack content */}
                    {rackExpanded && (
                      <Box sx={{ px: 1.5, py: 1 }}>
                        {rack.shelves?.map((shelf) => {
                          const shelfExpanded = expandedShelves.has(shelf.id);
                          return (
                            <Box key={shelf.id} sx={{ border: 1, borderColor: "grey.200", borderRadius: 1.5, mb: 0.75, overflow: "hidden" }}>
                              {/* Shelf header */}
                              <Box
                                sx={{
                                  display: "flex", alignItems: "center", gap: 1, px: 1.5, py: 0.75,
                                  cursor: "pointer", "&:hover": { bgcolor: "grey.50" },
                                }}
                                onClick={() => toggleShelf(shelf.id)}
                              >
                                {shelfExpanded ? <ExpandLessIcon sx={{ fontSize: 16 }} color="action" /> : <ExpandMoreIcon sx={{ fontSize: 16 }} color="action" />}
                                <InlineEdit
                                  value={shelf.label || `Shelf ${shelf.position}`}
                                  variant="body2"
                                  fontWeight={500}
                                  onSave={(v) => saveShelfLabel(shelf.id, v)}
                                />
                                <Typography variant="caption" color="text.secondary">
                                  {shelf.bays.length} bay{shelf.bays.length !== 1 ? "s" : ""}
                                </Typography>
                                <Box sx={{ ml: "auto" }}>
                                  <Tooltip title="Remove shelf">
                                    <IconButton size="small" sx={{ p: 0.25 }} onClick={(e) => { e.stopPropagation(); deleteShelf(shelf.id); }}>
                                      <DeleteIcon sx={{ fontSize: 14 }} color="action" />
                                    </IconButton>
                                  </Tooltip>
                                </Box>
                              </Box>

                              {/* Shelf content: bays */}
                              {shelfExpanded && (
                                <Box sx={{ px: 1.5, pb: 1 }}>
                                  <Grid container spacing={1}>
                                    {shelf.bays.map((bay) => (
                                      <Grid key={bay.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                                        <Box sx={{ border: 1, borderColor: "grey.200", borderRadius: 1.5, p: 1, position: "relative" }}>
                                          {/* Bay header */}
                                          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 0.5 }}>
                                            <InlineEdit
                                              value={bay.label || `Bay ${bay.position}`}
                                              variant="body2"
                                              fontWeight={500}
                                              fontSize={12}
                                              onSave={(v) => saveBayLabel(bay.id, v)}
                                            />
                                            <Tooltip title="Remove bay">
                                              <IconButton size="small" sx={{ p: 0.125 }} onClick={() => deleteBay(bay.id)}>
                                                <DeleteIcon sx={{ fontSize: 12 }} color="action" />
                                              </IconButton>
                                            </Tooltip>
                                          </Box>

                                          {/* Slots */}
                                          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", justifyContent: "center" }}>
                                            {bay.slots.length > 0 ? (
                                              bay.slots.map((slot) => {
                                                const state = slot.status?.state ?? "empty";
                                                return (
                                                  <SlotDot
                                                    key={slot.id}
                                                    slot={slot}
                                                    state={state}
                                                    onSaveLabel={(v) => saveSlotLabel(slot.id, v)}
                                                    onDelete={() => deleteSlot(slot.id)}
                                                  />
                                                );
                                              })
                                            ) : (
                                              <Typography variant="caption" color="text.disabled">No slots</Typography>
                                            )}
                                          </Box>

                                          {/* Add slot */}
                                          <Box sx={{ textAlign: "center", mt: 0.5 }}>
                                            <Tooltip title="Add slot">
                                              <IconButton size="small" sx={{ p: 0.25 }} onClick={() => addSlotToBay(bay.id, bay.slots)}>
                                                <AddIcon sx={{ fontSize: 14 }} />
                                              </IconButton>
                                            </Tooltip>
                                          </Box>
                                        </Box>
                                      </Grid>
                                    ))}

                                    {/* Add bay card */}
                                    <Grid size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                                      <Box
                                        sx={{
                                          border: "2px dashed",
                                          borderColor: "grey.300",
                                          borderRadius: 1.5,
                                          p: 1,
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          minHeight: 60,
                                          cursor: "pointer",
                                          "&:hover": { borderColor: "primary.main", bgcolor: "primary.50" },
                                        }}
                                        onClick={() => addBayToShelf(shelf.id, shelf.bays)}
                                      >
                                        <AddIcon sx={{ fontSize: 20, color: "text.disabled" }} />
                                      </Box>
                                    </Grid>
                                  </Grid>
                                </Box>
                              )}
                            </Box>
                          );
                        })}

                        {/* Add shelf */}
                        <Button
                          size="small"
                          startIcon={<AddIcon />}
                          onClick={() => addShelfToRack(rack.id, rack.shelves ?? [])}
                          sx={{ mt: 0.5 }}
                        >
                          Add Shelf
                        </Button>
                      </Box>
                    )}
                  </Box>
                );
              })}

              {/* Add rack */}
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setAddDialog({ open: true, level: "rack", parentId: zone.id })}
                sx={{ mt: 0.5 }}
              >
                Add Rack
              </Button>
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

// ── Slot dot with click-to-edit ───────────────────────────────────────────────

function SlotDot({
  slot,
  state,
  onSaveLabel,
  onDelete,
}: {
  slot: SlotData;
  state: string;
  onSaveLabel: (label: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [label, setLabel] = useState(slot.label ?? "");

  const commit = () => {
    const trimmed = label.trim();
    if (trimmed !== (slot.label ?? "")) onSaveLabel(trimmed);
    setEditing(false);
  };

  if (editing) {
    return (
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.25, border: 1, borderColor: "primary.main", borderRadius: 1, px: 0.5, py: 0.125 }}>
        <InputBase
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setLabel(slot.label ?? ""); setEditing(false); } }}
          autoFocus
          placeholder={`${slot.position}`}
          sx={{ fontSize: 11, p: 0, width: 50, "& input": { p: 0 } }}
        />
        <IconButton size="small" sx={{ p: 0 }} onClick={onDelete}>
          <DeleteIcon sx={{ fontSize: 10, color: "error.main" }} />
        </IconButton>
      </Box>
    );
  }

  return (
    <Tooltip title={`Slot ${slot.label || slot.position}: ${state.replace("_", " ")} — click to edit`} arrow>
      <Box
        onClick={() => setEditing(true)}
        sx={{
          width: 18,
          height: 18,
          borderRadius: "50%",
          bgcolor: slotStateColors[state] ?? "#9CA3AF",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          fontWeight: 700,
          color: "#fff",
          "&:hover": { outline: "2px solid", outlineColor: "primary.main" },
        }}
      >
        {slot.label || slot.position}
      </Box>
    </Tooltip>
  );
}

// ── Inline editable text ──────────────────────────────────────────────────────

function InlineEdit({
  value,
  onSave,
  variant = "body1",
  fontWeight = 500,
  fontSize,
}: {
  value: string;
  onSave: (newValue: string) => void;
  variant?: "h6" | "body1" | "body2";
  fontWeight?: number;
  fontSize?: number | string;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);

  useEffect(() => { setText(value); }, [value]);

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setText(value);
    setEditing(false);
  };

  if (!editing) {
    return (
      <Typography
        variant={variant}
        fontWeight={fontWeight}
        sx={{
          fontSize,
          cursor: "pointer",
          borderBottom: "1px dashed transparent",
          "&:hover": { borderBottomColor: "text.secondary" },
        }}
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
      >
        {value}
      </Typography>
    );
  }

  return (
    <InputBase
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") { setText(value); setEditing(false); }
      }}
      autoFocus
      sx={{
        fontWeight,
        fontSize: fontSize ?? (variant === "h6" ? "1.25rem" : variant === "body2" ? "0.875rem" : "1rem"),
        p: 0,
        "& input": { p: 0 },
        borderBottom: "2px solid",
        borderColor: "primary.main",
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
