"use client";

import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import FormControlLabel from "@mui/material/FormControlLabel";
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
  /** Parent entity ID (zoneId for rack, rackId for shelf, etc.) */
  parentId?: string;
  /** Existing entity for edit mode */
  existing?: Record<string, any> | null;
  /** Delete mode */
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
  const [name, setName] = useState("");
  const [type, setType] = useState("workshop");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState("");
  const [label, setLabel] = useState("");
  const [nfcTagId, setNfcTagId] = useState("");
  const [address, setAddress] = useState("");
  const [shelfCount, setShelfCount] = useState("");
  const [bayCount, setBayCount] = useState("");
  const [slotCount, setSlotCount] = useState("");
  const [hasTempHumiditySensor, setHasTempHumiditySensor] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isEdit = !!existing && !deleteMode;
  const isDelete = !!existing && !!deleteMode;

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
      setShelfCount(existing.shelfCount?.toString() ?? "");
      setBayCount(existing.bayCount?.toString() ?? "");
      setSlotCount(existing.slotCount?.toString() ?? "");
      setHasTempHumiditySensor(existing.hasTempHumiditySensor ?? false);
    } else {
      setName("");
      setType("workshop");
      setDescription("");
      setPosition("");
      setLabel("");
      setNfcTagId("");
      setAddress("");
      setShelfCount("");
      setBayCount("");
      setSlotCount("");
      setHasTempHumiditySensor(false);
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    let result: any;

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
        shelfCount: shelfCount ? parseInt(shelfCount) : null,
        nfcTagId: nfcTagId || null,
      };
      result = isEdit
        ? await updateRack(existing!.id, payload)
        : await createRack(payload);
    } else if (level === "shelf") {
      const payload = {
        rackId: parentId,
        position: position ? parseInt(position) : 1,
        label: label || null,
        bayCount: bayCount ? parseInt(bayCount) : null,
        nfcTagId: nfcTagId || null,
        hasTempHumiditySensor,
      };
      result = isEdit
        ? await updateShelf(existing!.id, payload)
        : await createShelf(payload);
    } else if (level === "bay") {
      const payload = {
        shelfId: parentId,
        position: position ? parseInt(position) : 1,
        label: label || null,
        slotCount: slotCount ? parseInt(slotCount) : null,
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

    setSaving(false);
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
              ? This will also delete all items inside it.
            </Typography>
          ) : (
            <Grid container spacing={2}>
              {/* Name — zone and rack */}
              {(level === "zone" || level === "rack") && (
                <Grid size={{ xs: 12, sm: level === "zone" ? 6 : 12 }}>
                  <TextField
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    size="small"
                    fullWidth
                  />
                </Grid>
              )}

              {/* Zone type */}
              {level === "zone" && (
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    label="Type"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    required
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
              )}

              {/* Zone description */}
              {level === "zone" && (
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    size="small"
                    fullWidth
                    multiline
                    rows={2}
                  />
                </Grid>
              )}

              {/* Position — rack, shelf, bay, slot */}
              {level !== "zone" && (
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Position"
                    type="number"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    size="small"
                    fullWidth
                    helperText={
                      level === "rack"
                        ? "Order within zone"
                        : level === "shelf"
                        ? "Shelf number (bottom-up)"
                        : level === "bay"
                        ? "Left-to-right on shelf"
                        : "Position within bay"
                    }
                  />
                </Grid>
              )}

              {/* Label — shelf, bay, slot */}
              {(level === "shelf" || level === "bay" || level === "slot") && (
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Label"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="Optional display label"
                  />
                </Grid>
              )}

              {/* Address — slot only */}
              {level === "slot" && (
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="e.g. WS-A-2-1-3"
                    helperText="Short address for display. Auto-generated if blank."
                  />
                </Grid>
              )}

              {/* Count hints */}
              {level === "rack" && (
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Shelf Count"
                    type="number"
                    value={shelfCount}
                    onChange={(e) => setShelfCount(e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Expected number of shelves"
                  />
                </Grid>
              )}
              {level === "shelf" && (
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Bay Count"
                    type="number"
                    value={bayCount}
                    onChange={(e) => setBayCount(e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Expected number of bays"
                  />
                </Grid>
              )}
              {level === "bay" && (
                <Grid size={{ xs: 6 }}>
                  <TextField
                    label="Slot Count"
                    type="number"
                    value={slotCount}
                    onChange={(e) => setSlotCount(e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Expected number of slots"
                  />
                </Grid>
              )}

              {/* Temp/humidity sensor — shelf only */}
              {level === "shelf" && (
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={hasTempHumiditySensor}
                        onChange={(e) => setHasTempHumiditySensor(e.target.checked)}
                      />
                    }
                    label="Has temperature/humidity sensor"
                  />
                </Grid>
              )}

              {/* NFC tag ID — all levels */}
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="NFC Tag ID"
                  value={nfcTagId}
                  onChange={(e) => setNfcTagId(e.target.value)}
                  size="small"
                  fullWidth
                  helperText="Optional NFC tag for quick identification"
                />
              </Grid>
            </Grid>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
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
            : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
