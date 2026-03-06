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
import { createMachineAccessory, updateMachineAccessory } from "@/lib/actions/user-library";
import { enumToOptions, accessoryTypeLabels } from "./enum-labels";

const typeOptions = enumToOptions(accessoryTypeLabels);

type Accessory = {
  id: string;
  machineId: string;
  type: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  isActive: boolean;
  notes: string | null;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  machineId: string;
  existing?: Accessory | null;
};

export function AccessoryDialog({ open, onClose, onSaved, machineId, existing }: Props) {
  const [type, setType] = useState("camera");
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [isActive, setIsActive] = useState(true);
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
      setIsActive(existing.isActive);
      setNotes(existing.notes ?? "");
    } else {
      setType("camera");
      setName("");
      setManufacturer("");
      setModel("");
      setIsActive(true);
      setNotes("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const payload = {
      machineId,
      type,
      name,
      manufacturer: manufacturer || null,
      model: model || null,
      isActive,
      notes: notes || null,
    };
    const result = existing
      ? await updateMachineAccessory(existing.id, payload)
      : await createMachineAccessory(payload);
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
      <DialogTitle>{existing ? "Edit Accessory" : "Add Accessory"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select label="Type" value={type} onChange={(e) => setType(e.target.value)} required size="small">
            {typeOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required size="small" />
          <Stack direction="row" spacing={2}>
            <TextField label="Manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} size="small" fullWidth />
            <TextField label="Model" value={model} onChange={(e) => setModel(e.target.value)} size="small" fullWidth />
          </Stack>
          <FormControlLabel
            control={<Switch checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />}
            label="Active"
          />
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
