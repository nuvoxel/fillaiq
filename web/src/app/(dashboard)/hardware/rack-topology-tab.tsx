"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MemoryIcon from "@mui/icons-material/Memory";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import PrintIcon from "@mui/icons-material/Print";
import InputBase from "@mui/material/InputBase";
import { listMyZones, listRacksByZone, getRackTopology, updateZone, updateRack, updateShelf } from "@/lib/actions/hardware";
import {
  LocationDialog,
  type LocationLevel,
} from "@/components/locations/location-dialog";
import {
  PrintLabelDialog,
  type PrintLabelItem,
} from "@/components/labels/print-label-dialog";

type SlotStatusData = { state: string; [key: string]: unknown };
type SlotData = { id: string; position: number; label?: string | null; nfcTagId?: string | null; address?: string | null; status?: SlotStatusData | null; [key: string]: unknown };
type BayData = { id: string; position: number; label?: string | null; slotCount?: number | null; nfcTagId?: string | null; slots: SlotData[]; [key: string]: unknown };
type ShelfData = { id: string; position: number; label?: string | null; bayCount: number | null; nfcTagId?: string | null; hasTempHumiditySensor: boolean | null; bays: BayData[]; [key: string]: unknown };
type RackTopology = { id: string; name?: string; position?: number | null; shelfCount?: number | null; nfcTagId?: string | null; shelves: ShelfData[]; [key: string]: unknown };
type ZoneSummary = { id: string; name: string; type?: string | null; description: string | null; nfcTagId?: string | null; [key: string]: unknown };

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

type DialogState = {
  open: boolean;
  level: LocationLevel;
  parentId?: string;
  existing?: Record<string, any> | null;
  deleteMode?: boolean;
};

const closedDialog: DialogState = { open: false, level: "zone" };

type PrintDialogState = {
  open: boolean;
  items: PrintLabelItem[];
  title?: string;
};
const closedPrint: PrintDialogState = { open: false, items: [] };

export function RackTopologyTab() {
  const [zonesWithRacks, setZonesWithRacks] = useState<ZoneWithRacks[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<DialogState>(closedDialog);
  const [printDialog, setPrintDialog] = useState<PrintDialogState>(closedPrint);

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
    setDialog(closedDialog);
    loadData();
  };

  const openAdd = (level: LocationLevel, parentId: string) =>
    setDialog({ open: true, level, parentId });
  const openEdit = (level: LocationLevel, existing: Record<string, any>) =>
    setDialog({ open: true, level, existing });
  const openDelete = (level: LocationLevel, existing: Record<string, any>) =>
    setDialog({ open: true, level, existing, deleteMode: true });

  /** Collect all slot labels from a bay */
  const baySlotItems = (bay: BayData, shelfLabel: string | number, rackName: string): PrintLabelItem[] =>
    bay.slots.map((slot) => ({
      label: `Slot ${slot.label || slot.position}`,
      location: `${rackName} / Shelf ${shelfLabel} / Bay ${bay.label || bay.position} / Slot ${slot.label || slot.position}`,
      ...(slot.address ? { lotNumber: slot.address } : {}),
    }));

  const openBayPrint = (bay: BayData, shelfLabel: string | number, rackName: string) => {
    const items = baySlotItems(bay, shelfLabel, rackName);
    if (items.length === 0) return;
    setPrintDialog({
      open: true,
      items,
      title: `Print Labels — Bay ${bay.label || bay.position} (${items.length} slots)`,
    });
  };

  const openShelfPrint = (shelf: ShelfData, rackName: string) => {
    const items = shelf.bays.flatMap((bay) => baySlotItems(bay, shelf.label || shelf.position, rackName));
    if (items.length === 0) return;
    setPrintDialog({
      open: true,
      items,
      title: `Print Labels — Shelf ${shelf.label || shelf.position} (${items.length} slots)`,
    });
  };

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
          open={dialog.open}
          level={dialog.level}
          parentId={dialog.parentId}
          existing={dialog.existing}
          deleteMode={dialog.deleteMode}
          onClose={() => setDialog(closedDialog)}
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
                    <IconButton size="small" onClick={() => openDelete("zone", zone)}>
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
                      <InlineEdit
                        value={rack.name ?? rack.id.slice(0, 8)}
                        fontWeight={500}
                        onSave={(name) => { updateRack(rack.id, { name }); loadData(); }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        {rack.shelves?.length ?? 0} {(rack.shelves?.length ?? 0) === 1 ? "shelf" : "shelves"}
                      </Typography>
                      <Box sx={{ ml: "auto", mr: 1, display: "flex", gap: 0.5 }}>
                        <Tooltip title="Print all labels in rack">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openRackPrint(rack); }}>
                            <PrintIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete rack">
                          <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDelete("rack", rack); }}>
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
                            <InlineEdit
                              value={`Shelf ${shelf.label || shelf.position}`}
                              variant="body2"
                              fontWeight={500}
                              onSave={(label) => { updateShelf(shelf.id, { label: label.replace(/^Shelf\s*/i, "") || null }); loadData(); }}
                            />
                            <Typography variant="caption" color="text.secondary">
                              {shelf.bays.length} bay{shelf.bays.length !== 1 ? "s" : ""}
                            </Typography>
                            <Box sx={{ ml: "auto", mr: 1, display: "flex", gap: 0.5 }}>
                              <Tooltip title="Print all labels on shelf">
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); openShelfPrint(shelf, rack.name ?? rack.id.slice(0, 8)); }}>
                                  <PrintIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete shelf">
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); openDelete("shelf", shelf); }}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </Box>
                          </Box>
                        </AccordionSummary>
                        <AccordionDetails>
                          <Grid container spacing={1}>
                            {shelf.bays.map((bay) => (
                              <Grid key={bay.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                                <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1, textAlign: "center", position: "relative" }}>
                                  {/* Bay actions */}
                                  <Box sx={{ position: "absolute", top: 2, right: 2, display: "flex", gap: 0 }}>
                                    {bay.slots.length > 0 && (
                                      <Tooltip title={`Print ${bay.slots.length} slot labels`}>
                                        <IconButton size="small" sx={{ p: 0.25 }} onClick={() => openBayPrint(bay, shelf.label || shelf.position, rack.name ?? rack.id.slice(0, 8))}>
                                          <PrintIcon sx={{ fontSize: 14 }} />
                                        </IconButton>
                                      </Tooltip>
                                    )}
                                    <Tooltip title="Edit bay">
                                      <IconButton size="small" sx={{ p: 0.25 }} onClick={() => openEdit("bay", bay)}>
                                        <EditIcon sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    </Tooltip>
                                    <Tooltip title="Delete bay">
                                      <IconButton size="small" sx={{ p: 0.25 }} onClick={() => openDelete("bay", bay)}>
                                        <DeleteIcon sx={{ fontSize: 14 }} />
                                      </IconButton>
                                    </Tooltip>
                                  </Box>

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
                onClick={() => openAdd("rack", zone.id)}
                sx={{ mt: 0.5 }}
              >
                Add Rack
              </Button>
            </CardContent>
          </Card>
        ))}
      </Stack>

      <LocationDialog
        open={dialog.open}
        level={dialog.level}
        parentId={dialog.parentId}
        existing={dialog.existing}
        deleteMode={dialog.deleteMode}
        onClose={() => setDialog(closedDialog)}
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
