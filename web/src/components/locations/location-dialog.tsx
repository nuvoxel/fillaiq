"use client";

import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  createZone,
  updateZone,
  removeZone,
  createRack,
  updateRack,
  removeRack,
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

export type LocationLevel = "zone" | "rack" | "shelf" | "bay" | "slot";

const levelLabels: Record<LocationLevel, string> = {
  zone: "Zone",
  rack: "Rack",
  shelf: "Shelf",
  bay: "Bay",
  slot: "Slot",
};

const zoneTypeOptions = [
  { value: "workshop", label: "Workshop" },
  { value: "storage", label: "Storage" },
  { value: "printer_area", label: "Printer Area" },
  { value: "drying", label: "Drying" },
  { value: "other", label: "Other" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  level: LocationLevel;
  parentId?: string;
  existing?: Record<string, any> | null;
  deleteMode?: boolean;
};

export function LocationDialog({
  open,
  onClose,
  onSaved,
  level,
  parentId,
  existing,
  deleteMode,
}: Props) {
  // ── Common fields ─────────────────────────────────────────────────────────
  const [name, setName] = useState("");
  const [type, setType] = useState("workshop");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState("");
  const [label, setLabel] = useState("");
  const [nfcTagId, setNfcTagId] = useState("");
  const [address, setAddress] = useState("");

  // ── Quick setup (rack creation only) ──────────────────────────────────────
  const [quickShelves, setQuickShelves] = useState("3");
  const [quickBays, setQuickBays] = useState("1");
  const [quickSlots, setQuickSlots] = useState("2");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");

  const isEdit = !!existing && !deleteMode;
  const isDelete = !!existing && !!deleteMode;
  const isNewRack = level === "rack" && !isEdit && !isDelete;

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name ?? "");
      setType(existing.type ?? "workshop");
      setDescription(existing.description ?? "");
      setPosition(existing.position?.toString() ?? "");
      setLabel(existing.label ?? "");
      setNfcTagId(existing.nfcTagId ?? "");
      setAddress(existing.address ?? "");
    } else {
      setName("");
      setType("workshop");
      setDescription("");
      setPosition("");
      setLabel("");
      setNfcTagId("");
      setAddress("");
      setQuickShelves("3");
      setQuickBays("1");
      setQuickSlots("2");
    }
    setError(null);
    setProgress("");
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    setProgress("");

    let result: any;

    try {
      if (isDelete) {
        const removeFn = { zone: removeZone, rack: removeRack, shelf: removeShelf, bay: removeBay, slot: removeSlot }[level];
        result = await removeFn(existing!.id);
      } else if (level === "zone") {
        const payload = {
          name,
          type,
          description: description || null,
          nfcTagId: nfcTagId || null,
        };
        result = isEdit
          ? await updateZone(existing!.id, payload)
          : await createZone(payload);
      } else if (level === "rack") {
        const payload = {
          zoneId: parentId,
          name,
          position: position ? parseInt(position) : null,
          nfcTagId: nfcTagId || null,
        };

        if (isEdit) {
          result = await updateRack(existing!.id, payload);
        } else {
          // Create rack
          result = await createRack(payload);
          if (result?.error) {
            setSaving(false);
            setError(result.error);
            return;
          }

          // Quick setup: create shelves → bays → slots
          const rackId = result.data?.id;
          const nShelves = parseInt(quickShelves) || 0;
          const nBays = parseInt(quickBays) || 0;
          const nSlots = parseInt(quickSlots) || 0;

          if (rackId && nShelves > 0) {
            for (let s = 1; s <= nShelves; s++) {
              setProgress(`Creating shelf ${s}/${nShelves}...`);
              const shelfResult = await createShelf({ rackId, position: s });
              if (shelfResult?.error) continue;
              const shelfId = shelfResult.data?.id;
              if (!shelfId || nBays <= 0) continue;

              for (let b = 1; b <= nBays; b++) {
                const bayResult = await createBay({ shelfId, position: b });
                if (bayResult?.error) continue;
                const bayId = bayResult.data?.id;
                if (!bayId || nSlots <= 0) continue;

                for (let sl = 1; sl <= nSlots; sl++) {
                  await createSlot({ bayId, position: sl });
                }
              }
            }
          }
        }
      } else if (level === "shelf") {
        const payload = {
          rackId: parentId,
          position: position ? parseInt(position) : 1,
          label: label || null,
          nfcTagId: nfcTagId || null,
        };
        result = isEdit
          ? await updateShelf(existing!.id, payload)
          : await createShelf(payload);
      } else if (level === "bay") {
        const payload = {
          shelfId: parentId,
          position: position ? parseInt(position) : 1,
          label: label || null,
          nfcTagId: nfcTagId || null,
        };
        result = isEdit
          ? await updateBay(existing!.id, payload)
          : await createBay(payload);
      } else if (level === "slot") {
        const payload = {
          bayId: parentId,
          position: position ? parseInt(position) : 1,
          label: label || null,
          nfcTagId: nfcTagId || null,
          address: address || null,
        };
        result = isEdit
          ? await updateSlot(existing!.id, payload)
          : await createSlot(payload);
      }
    } catch (e) {
      setSaving(false);
      setError((e as Error).message);
      return;
    }

    setSaving(false);
    setProgress("");
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  const title = isDelete
    ? `Delete ${levelLabels[level]}`
    : isEdit
    ? `Edit ${levelLabels[level]}`
    : `Add ${levelLabels[level]}`;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {isDelete ? (
            <Typography>
              Are you sure you want to delete{" "}
              <strong>
                {existing?.name || existing?.label || `${levelLabels[level]} ${existing?.position}`}
              </strong>
              ? This will also delete everything inside it.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {/* ── Zone fields ── */}
              {level === "zone" && (
                <>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      size="small"
                      fullWidth
                      placeholder='e.g. "Workshop", "Garage"'
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      select
                      label="Type"
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                      size="small"
                      fullWidth
                    >
                      {zoneTypeOptions.map((o) => (
                        <MenuItem key={o.value} value={o.value}>
                          {o.label}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Description"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      size="small"
                      fullWidth
                      multiline
                      rows={2}
                      placeholder="Optional"
                    />
                  </Grid>
                </>
              )}

              {/* ── Rack fields ── */}
              {level === "rack" && (
                <>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Rack Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      size="small"
                      fullWidth
                      placeholder='e.g. "Rack A", "Left Wall"'
                    />
                  </Grid>
                  {isNewRack && (
                    <>
                      <Grid size={{ xs: 12 }}>
                        <Divider />
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 1 }}>
                          Quick Setup
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Auto-create shelves, bays, and slots. You can always add more later.
                        </Typography>
                      </Grid>
                      <Grid size={{ xs: 4 }}>
                        <TextField
                          label="Shelves"
                          type="number"
                          value={quickShelves}
                          onChange={(e) => setQuickShelves(e.target.value)}
                          size="small"
                          fullWidth
                          slotProps={{ htmlInput: { min: 0, max: 20 } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 4 }}>
                        <TextField
                          label="Bays / shelf"
                          type="number"
                          value={quickBays}
                          onChange={(e) => setQuickBays(e.target.value)}
                          size="small"
                          fullWidth
                          slotProps={{ htmlInput: { min: 0, max: 20 } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 4 }}>
                        <TextField
                          label="Slots / bay"
                          type="number"
                          value={quickSlots}
                          onChange={(e) => setQuickSlots(e.target.value)}
                          size="small"
                          fullWidth
                          slotProps={{ htmlInput: { min: 0, max: 10 } }}
                        />
                      </Grid>
                      {(parseInt(quickShelves) || 0) > 0 && (
                        <Grid size={{ xs: 12 }}>
                          <Typography variant="caption" color="text.secondary">
                            Will create{" "}
                            <strong>
                              {parseInt(quickShelves) || 0} shelves
                              {(parseInt(quickBays) || 0) > 0 &&
                                ` × ${parseInt(quickBays)} bays`}
                              {(parseInt(quickSlots) || 0) > 0 &&
                                (parseInt(quickBays) || 0) > 0 &&
                                ` × ${parseInt(quickSlots)} slots`}
                            </strong>
                            {" = "}
                            {(parseInt(quickShelves) || 0) *
                              Math.max(parseInt(quickBays) || 0, 1) *
                              Math.max(parseInt(quickSlots) || 0, 1)}{" "}
                            total slots
                          </Typography>
                        </Grid>
                      )}
                    </>
                  )}
                </>
              )}

              {/* ── Shelf / Bay / Slot — just position + optional label ── */}
              {(level === "shelf" || level === "bay" || level === "slot") && (
                <>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      label="Position"
                      type="number"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      size="small"
                      fullWidth
                      slotProps={{ htmlInput: { min: 1 } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField
                      label="Label (optional)"
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      size="small"
                      fullWidth
                      placeholder="Auto-numbered if blank"
                    />
                  </Grid>
                </>
              )}

              {/* ── Slot address ── */}
              {level === "slot" && (
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Address (optional)"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="e.g. WS-A-2-1-3 — auto-generated if blank"
                  />
                </Grid>
              )}

              {/* ── NFC tag — only show for zone and rack (useful), hide for sub-items ── */}
              {(level === "zone" || level === "rack") && (
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="NFC Tag ID (optional)"
                    value={nfcTagId}
                    onChange={(e) => setNfcTagId(e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Grid>
              )}
            </Grid>
          )}

          {progress && (
            <Typography variant="caption" color="text.secondary">
              {progress}
            </Typography>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          variant="contained"
          color={isDelete ? "error" : "primary"}
          disabled={
            saving ||
            (!isDelete &&
              ((level === "zone" && !name) ||
                (level === "rack" && !name)))
          }
        >
          {saving
            ? "Saving..."
            : isDelete
            ? "Delete"
            : isNewRack
            ? "Create Rack"
            : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
