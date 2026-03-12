"use client";

import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  getRackTopology,
  updateRack,
  createShelf,
  updateShelf,
  removeShelf,
  createBay,
  updateBay,
  removeBay,
  createSlot,
  updateSlot,
  removeSlot,
} from "@/lib/actions/hardware";

type SlotEdit = { id?: string; position: number; label: string; _delete?: boolean };
type BayEdit = { id?: string; position: number; label: string; slots: SlotEdit[]; _delete?: boolean };
type ShelfEdit = { id?: string; position: number; label: string; bays: BayEdit[]; _delete?: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  rackId: string;
  rackName: string;
};

export function RackEditDialog({ open, onClose, onSaved, rackId, rackName }: Props) {
  const [name, setName] = useState(rackName);
  const [shelves, setShelves] = useState<ShelfEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(rackName);
    setError(null);
    setSaving(false);
    setLoading(true);

    (async () => {
      const result = await getRackTopology(rackId);
      if (result.data) {
        const topo = result.data as any;
        setShelves(
          (topo.shelves ?? []).map((s: any) => ({
            id: s.id,
            position: s.position,
            label: s.label ?? "",
            bays: (s.bays ?? []).map((b: any) => ({
              id: b.id,
              position: b.position,
              label: b.label ?? "",
              slots: (b.slots ?? []).map((sl: any) => ({
                id: sl.id,
                position: sl.position,
                label: sl.label ?? "",
              })),
            })),
          }))
        );
      }
      setLoading(false);
    })();
  }, [open, rackId, rackName]);

  // ── Shelf operations ──
  const addShelf = () => {
    const maxPos = shelves.filter((s) => !s._delete).reduce((m, s) => Math.max(m, s.position), 0);
    setShelves([...shelves, { position: maxPos + 1, label: "", bays: [] }]);
  };

  const updateShelfField = (idx: number, field: keyof ShelfEdit, value: any) => {
    setShelves(shelves.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const markShelfDeleted = (idx: number) => {
    setShelves(shelves.map((s, i) => (i === idx ? { ...s, _delete: true } : s)));
  };

  // ── Bay operations ──
  const addBay = (shelfIdx: number) => {
    setShelves(shelves.map((s, si) => {
      if (si !== shelfIdx) return s;
      const maxPos = s.bays.filter((b) => !b._delete).reduce((m, b) => Math.max(m, b.position), 0);
      return { ...s, bays: [...s.bays, { position: maxPos + 1, label: "", slots: [] }] };
    }));
  };

  const updateBayField = (shelfIdx: number, bayIdx: number, field: keyof BayEdit, value: any) => {
    setShelves(shelves.map((s, si) => {
      if (si !== shelfIdx) return s;
      return { ...s, bays: s.bays.map((b, bi) => (bi === bayIdx ? { ...b, [field]: value } : b)) };
    }));
  };

  const markBayDeleted = (shelfIdx: number, bayIdx: number) => {
    setShelves(shelves.map((s, si) => {
      if (si !== shelfIdx) return s;
      return { ...s, bays: s.bays.map((b, bi) => (bi === bayIdx ? { ...b, _delete: true } : b)) };
    }));
  };

  // ── Slot operations ──
  const addSlot = (shelfIdx: number, bayIdx: number) => {
    setShelves(shelves.map((s, si) => {
      if (si !== shelfIdx) return s;
      return {
        ...s,
        bays: s.bays.map((b, bi) => {
          if (bi !== bayIdx) return b;
          const maxPos = b.slots.filter((sl) => !sl._delete).reduce((m, sl) => Math.max(m, sl.position), 0);
          return { ...b, slots: [...b.slots, { position: maxPos + 1, label: "" }] };
        }),
      };
    }));
  };

  const updateSlotField = (shelfIdx: number, bayIdx: number, slotIdx: number, field: keyof SlotEdit, value: any) => {
    setShelves(shelves.map((s, si) => {
      if (si !== shelfIdx) return s;
      return {
        ...s,
        bays: s.bays.map((b, bi) => {
          if (bi !== bayIdx) return b;
          return { ...b, slots: b.slots.map((sl, sli) => (sli === slotIdx ? { ...sl, [field]: value } : sl)) };
        }),
      };
    }));
  };

  const markSlotDeleted = (shelfIdx: number, bayIdx: number, slotIdx: number) => {
    setShelves(shelves.map((s, si) => {
      if (si !== shelfIdx) return s;
      return {
        ...s,
        bays: s.bays.map((b, bi) => {
          if (bi !== bayIdx) return b;
          return { ...b, slots: b.slots.map((sl, sli) => (sli === slotIdx ? { ...sl, _delete: true } : sl)) };
        }),
      };
    }));
  };

  // ── Save ──
  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      // Update rack name
      if (name !== rackName) {
        const r = await updateRack(rackId, { name });
        if (r.error) { setError(r.error); setSaving(false); return; }
      }

      // Process shelves
      for (const shelf of shelves) {
        if (shelf._delete && shelf.id) {
          await removeShelf(shelf.id);
          continue;
        }

        let shelfId = shelf.id;
        if (!shelfId) {
          // Create new shelf
          const r = await createShelf({ rackId, position: shelf.position, label: shelf.label || null });
          if (r.error) { setError(r.error); setSaving(false); return; }
          shelfId = r.data?.id;
        } else {
          // Update existing shelf
          await updateShelf(shelfId, { position: shelf.position, label: shelf.label || null });
        }

        if (!shelfId) continue;

        // Process bays
        for (const bay of shelf.bays) {
          if (bay._delete && bay.id) {
            await removeBay(bay.id);
            continue;
          }

          let bayId = bay.id;
          if (!bayId) {
            const r = await createBay({ shelfId, position: bay.position, label: bay.label || null });
            if (r.error) continue;
            bayId = r.data?.id;
          } else {
            await updateBay(bayId, { position: bay.position, label: bay.label || null });
          }

          if (!bayId) continue;

          // Process slots
          for (const slot of bay.slots) {
            if (slot._delete && slot.id) {
              await removeSlot(slot.id);
              continue;
            }

            if (!slot.id) {
              await createSlot({ bayId, position: slot.position, label: slot.label || null });
            } else {
              await updateSlot(slot.id, { position: slot.position, label: slot.label || null });
            }
          }
        }
      }

      setSaving(false);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const visibleShelves = shelves.filter((s) => !s._delete);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit Rack</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {loading ? (
            <Typography color="text.secondary">Loading...</Typography>
          ) : (
            <>
              {/* Rack name */}
              <TextField
                label="Rack Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                size="small"
                fullWidth
              />

              <Divider />

              {/* Shelves */}
              {visibleShelves.length === 0 && (
                <Typography variant="body2" color="text.secondary">No shelves yet.</Typography>
              )}

              {shelves.map((shelf, si) => {
                if (shelf._delete) return null;
                const visibleBays = shelf.bays.filter((b) => !b._delete);

                return (
                  <Box
                    key={shelf.id ?? `new-${si}`}
                    sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1.5 }}
                  >
                    {/* Shelf header */}
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ minWidth: 60 }}>
                        Shelf {shelf.position}
                      </Typography>
                      <TextField
                        label="Label"
                        value={shelf.label}
                        onChange={(e) => updateShelfField(si, "label", e.target.value)}
                        size="small"
                        sx={{ flex: 1 }}
                        placeholder="Optional"
                      />
                      <Tooltip title="Delete shelf">
                        <IconButton size="small" color="error" onClick={() => markShelfDeleted(si)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>

                    {/* Bays */}
                    {visibleBays.length > 0 && (
                      <Box sx={{ pl: 2 }}>
                        {shelf.bays.map((bay, bi) => {
                          if (bay._delete) return null;
                          const visibleSlots = bay.slots.filter((sl) => !sl._delete);

                          return (
                            <Box
                              key={bay.id ?? `new-bay-${bi}`}
                              sx={{ border: 1, borderColor: "grey.200", borderRadius: 1, p: 1, mb: 1 }}
                            >
                              {/* Bay header */}
                              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.5 }}>
                                <Typography variant="caption" sx={{ minWidth: 50 }}>
                                  Bay {bay.position}
                                </Typography>
                                <TextField
                                  label="Label"
                                  value={bay.label}
                                  onChange={(e) => updateBayField(si, bi, "label", e.target.value)}
                                  size="small"
                                  sx={{ flex: 1 }}
                                  placeholder="Optional"
                                />
                                <Tooltip title="Delete bay">
                                  <IconButton size="small" color="error" onClick={() => markBayDeleted(si, bi)}>
                                    <DeleteIcon sx={{ fontSize: 16 }} />
                                  </IconButton>
                                </Tooltip>
                              </Box>

                              {/* Slots */}
                              {visibleSlots.length > 0 && (
                                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, pl: 2, mb: 0.5 }}>
                                  {bay.slots.map((slot, sli) => {
                                    if (slot._delete) return null;
                                    return (
                                      <Box
                                        key={slot.id ?? `new-slot-${sli}`}
                                        sx={{
                                          display: "flex",
                                          alignItems: "center",
                                          gap: 0.25,
                                          border: 1,
                                          borderColor: "grey.200",
                                          borderRadius: 1,
                                          px: 0.5,
                                          py: 0.25,
                                        }}
                                      >
                                        <Typography variant="caption" color="text.secondary" sx={{ minWidth: 16 }}>
                                          {slot.position}
                                        </Typography>
                                        <TextField
                                          value={slot.label}
                                          onChange={(e) => updateSlotField(si, bi, sli, "label", e.target.value)}
                                          size="small"
                                          variant="standard"
                                          placeholder={`Slot ${slot.position}`}
                                          sx={{ width: 80 }}
                                          slotProps={{ input: { sx: { fontSize: 12, py: 0 } } }}
                                        />
                                        <IconButton
                                          size="small"
                                          sx={{ p: 0 }}
                                          onClick={() => markSlotDeleted(si, bi, sli)}
                                        >
                                          <DeleteIcon sx={{ fontSize: 12, color: "text.disabled" }} />
                                        </IconButton>
                                      </Box>
                                    );
                                  })}
                                </Box>
                              )}

                              <Button
                                size="small"
                                startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                                onClick={() => addSlot(si, bi)}
                                sx={{ fontSize: 11, ml: 2 }}
                              >
                                Add Slot
                              </Button>
                            </Box>
                          );
                        })}
                      </Box>
                    )}

                    <Button
                      size="small"
                      startIcon={<AddIcon sx={{ fontSize: 14 }} />}
                      onClick={() => addBay(si)}
                      sx={{ fontSize: 12, ml: 2 }}
                    >
                      Add Bay
                    </Button>
                  </Box>
                );
              })}

              <Button
                size="small"
                variant="outlined"
                startIcon={<AddIcon />}
                onClick={addShelf}
              >
                Add Shelf
              </Button>
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving || loading || !name.trim()}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
