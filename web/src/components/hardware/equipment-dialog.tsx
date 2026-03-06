"use client";

import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { createEquipment, updateEquipment } from "@/lib/actions/user-library";
import { enumToOptions, equipmentTypeLabels } from "./enum-labels";

const typeOptions = enumToOptions(equipmentTypeLabels);

type Equipment = {
  id: string;
  type: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  capacity: number | null;
  maxTemp: number | null;
  hasHumidityControl: boolean | null;
  notes: string | null;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Equipment | null;
};

export function EquipmentDialog({ open, onClose, onSaved, existing }: Props) {
  const [type, setType] = useState("drybox");
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [capacity, setCapacity] = useState("");
  const [maxTemp, setMaxTemp] = useState("");
  const [hasHumidityControl, setHasHumidityControl] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setType(existing.type);
      setName(existing.name);
      setManufacturer(existing.manufacturer ?? "");
      setModel(existing.model ?? "");
      setCapacity(existing.capacity != null ? String(existing.capacity) : "");
      setMaxTemp(existing.maxTemp != null ? String(existing.maxTemp) : "");
      setHasHumidityControl(existing.hasHumidityControl ?? false);
      setNotes(existing.notes ?? "");
    } else {
      setType("drybox");
      setName("");
      setManufacturer("");
      setModel("");
      setCapacity("");
      setMaxTemp("");
      setHasHumidityControl(false);
      setNotes("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const payload: Record<string, unknown> = {
      type,
      name,
      manufacturer: manufacturer || null,
      model: model || null,
      capacity: capacity ? Number(capacity) : null,
      notes: notes || null,
    };
    if (type === "drybox") {
      payload.maxTemp = maxTemp ? Number(maxTemp) : null;
      payload.hasHumidityControl = hasHumidityControl;
    }
    const result = existing
      ? await updateEquipment(existing.id, payload)
      : await createEquipment(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{existing ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            label="Type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            required
            size="small"
          >
            {typeOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required size="small" />
          <TextField label="Manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} size="small" />
          <TextField label="Model" value={model} onChange={(e) => setModel(e.target.value)} size="small" />
          <TextField label="Capacity (spools)" value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" size="small" />
          {type === "drybox" && (
            <>
              <TextField label="Max Temp (°C)" value={maxTemp} onChange={(e) => setMaxTemp(e.target.value)} type="number" size="small" />
              <FormControlLabel
                control={<Switch checked={hasHumidityControl} onChange={(e) => setHasHumidityControl(e.target.checked)} />}
                label="Humidity Control"
              />
            </>
          )}
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline rows={2} size="small" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!name || saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
