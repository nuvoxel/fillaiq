"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import InputBase from "@mui/material/InputBase";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MemoryIcon from "@mui/icons-material/Memory";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PrintIcon from "@mui/icons-material/Print";
import { listMyZones, listRacksByZone, getRackTopology, updateZone, removeZone, removeRack } from "@/lib/actions/hardware";
import { LocationDialog } from "@/components/locations/location-dialog";
import { RackEditDialog } from "@/components/locations/rack-edit-dialog";
import {
  PrintLabelDialog,
  type PrintLabelItem,
} from "@/components/labels/print-label-dialog";

type SlotStatusData = { state: string; [key: string]: unknown };
type SlotData = { id: string; position: number; label?: string | null; nfcTagId?: string | null; address?: string | null; status?: SlotStatusData | null; [key: string]: unknown };
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

type ZoneWithRacks = {
  zone: ZoneSummary;
  racks: RackTopology[];
};

type PrintDialogState = {
  open: boolean;
  items: PrintLabelItem[];
  title?: string;
};
const closedPrint: PrintDialogState = { open: false, items: [] };

type RackEditState = {
  open: boolean;
  rackId: string;
  rackName: string;
};
const closedRackEdit: RackEditState = { open: false, rackId: "", rackName: "" };

export function RackTopologyTab() {
  const [zonesWithRacks, setZonesWithRacks] = useState<ZoneWithRacks[]>([]);
  const [loading, setLoading] = useState(true);
  const [printDialog, setPrintDialog] = useState<PrintDialogState>(closedPrint);
  const [rackEdit, setRackEdit] = useState<RackEditState>(closedRackEdit);
  // For zone add and rack add (still use LocationDialog for creation)
  const [addDialog, setAddDialog] = useState<{ open: boolean; level: "zone" | "rack"; parentId?: string }>({ open: false, level: "zone" });
  // For delete confirmations
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; level: "zone" | "rack"; existing?: Record<string, any> | null }>({ open: false, level: "zone" });

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
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleSaved = () => {
    setAddDialog({ open: false, level: "zone" });
    setDeleteDialog({ open: false, level: "zone" });
    setRackEdit(closedRackEdit);
    loadData();
  };

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
    setPrintDialog({
      open: true,
      items,
      title: `Print Labels — Rack ${rackName} (${items.length} slots)`,
    });
  };

  const openZonePrint = (zone: ZoneSummary, zoneRacks: RackTopology[]) => {
    const items = zoneRacks.flatMap((rack) => {
      const rackName = rack.name ?? rack.id.slice(0, 8);
      return (rack.shelves ?? []).flatMap((shelf) =>
        shelf.bays.flatMap((bay) => baySlotItems(bay, shelf.label || shelf.position, rackName))
      );
    });
    if (items.length === 0) return;
    setPrintDialog({
      open: true,
      items,
      title: `Print Labels — ${zone.name} (${items.length} slots)`,
    });
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
          <Typography variant="subtitle1" fontWeight={500}>
            No locations configured
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add your first zone to start organizing your storage layout.
          </Typography>
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
              <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                  <MemoryIcon color="primary" />
                  <InlineEdit
                    value={zone.name}
                    variant="h6"
                    fontWeight={600}
                    onSave={(name) => { updateZone(zone.id, { name }); loadData(); }}
                  />
                  {zone.description && (
                    <Typography variant="body2" color="text.secondary">{zone.description}</Typography>
                  )}
                </Box>
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  <Tooltip title="Print all labels in zone">
                    <IconButton size="small" onClick={() => openZonePrint(zone, racks)}>
                      <PrintIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Delete zone">
                    <IconButton size="small" onClick={() => setDeleteDialog({ open: true, level: "zone", existing: zone })}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {/* ── Racks ── */}
              {racks.map((rack) => (
                <Accordion key={rack.id} defaultExpanded disableGutters sx={{ border: 1, borderColor: "divider", "&:before": { display: "none" }, mb: 1 }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
                      <Typography fontWeight={500}>{rack.name ?? rack.id.slice(0, 8)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {rack.shelves?.length ?? 0} {(rack.shelves?.length ?? 0) === 1 ? "shelf" : "shelves"}
                      </Typography>
                      <Box sx={{ ml: "auto", mr: 1, display: "flex", gap: 0.5 }}>
                        <Tooltip title="Edit rack">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setRackEdit({ open: true, rackId: rack.id, rackName: rack.name ?? rack.id.slice(0, 8) }); }}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Print all labels in rack">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openRackPrint(rack); }}>
                            <PrintIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete rack">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDeleteDialog({ open: true, level: "rack", existing: rack }); }}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {rack.shelves?.map((shelf) => (
                      <Accordion key={shelf.id} defaultExpanded disableGutters sx={{ border: 1, borderColor: "divider", "&:before": { display: "none" }, mb: 0.5 }}>
                        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flex: 1 }}>
                            <Typography variant="body2" fontWeight={500}>
                              Shelf {shelf.label || shelf.position}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {shelf.bays.length} bay{shelf.bays.length !== 1 ? "s" : ""}
                            </Typography>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={1}>
                            {shelf.bays.map((bay) => (
                              <Grid key={bay.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                                <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1, textAlign: "center" }}>
                                  <Typography variant="caption" color="text.secondary">
                                    Bay {bay.label || bay.position}
                                  </Typography>
                                  <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center", mt: 0.5, flexWrap: "wrap" }}>
                                    {bay.slots.length > 0 ? (
                                      bay.slots.map((slot) => {
                                        const state = slot.status?.state ?? "empty";
                                        return (
                                          <Tooltip
                                            key={slot.id}
                                            title={`Slot ${slot.label || slot.position}: ${state.replace("_", " ")}`}
                                            arrow
                                          >
                                            <Box
                                              sx={{
                                                width: 16,
                                                height: 16,
                                                borderRadius: "50%",
                                                bgcolor: slotStateColors[state] ?? "#9CA3AF",
                                              }}
                                            />
                                          </Tooltip>
                                        );
                                      })
                                    ) : (
                                      <Typography variant="caption" color="text.disabled">Empty</Typography>
                                    )}
                                  </Box>
                                </Box>
                              </Grid>
                            ))}
                          </Grid>
                        </AccordionDetails>
                      </Accordion>
                    ))}
                  </AccordionDetails>
                </Accordion>
              ))}

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

      {/* Add zone / Add rack dialog (creation only) */}
      <LocationDialog
        open={addDialog.open}
        level={addDialog.level}
        parentId={addDialog.parentId}
        onClose={() => setAddDialog({ open: false, level: "zone" })}
        onSaved={handleSaved}
      />

      {/* Delete confirmation dialog */}
      <LocationDialog
        open={deleteDialog.open}
        level={deleteDialog.level}
        existing={deleteDialog.existing}
        deleteMode
        onClose={() => setDeleteDialog({ open: false, level: "zone" })}
        onSaved={handleSaved}
      />

      {/* Rack edit dialog */}
      <RackEditDialog
        open={rackEdit.open}
        rackId={rackEdit.rackId}
        rackName={rackEdit.rackName}
        onClose={() => setRackEdit(closedRackEdit)}
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

// ── Inline editable name ──────────────────────────────────────────────────────

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

  const commit = () => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== value) {
      onSave(trimmed);
    } else {
      setText(value);
    }
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
          "&:hover": { textDecoration: "underline dotted", textUnderlineOffset: 3 },
        }}
        onClick={() => setEditing(true)}
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
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
