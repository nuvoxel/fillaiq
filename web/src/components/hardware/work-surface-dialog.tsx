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
import { createMachineWorkSurface, updateMachineWorkSurface } from "@/lib/actions/user-library";
import { enumToOptions, workSurfaceTypeLabels, wearLevelLabels } from "./enum-labels";

const typeOptions = enumToOptions(workSurfaceTypeLabels);
const conditionOptions = enumToOptions(wearLevelLabels);

type WorkSurface = {
  id: string;
  machineId: string;
  name: string;
  type: string;
  isInstalled: boolean;
  surfaceCondition: string;
  notes: string | null;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  machineId: string;
  existing?: WorkSurface | null;
};

export function WorkSurfaceDialog({ open, onClose, onSaved, machineId, existing }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState("textured_pei");
  const [isInstalled, setIsInstalled] = useState(false);
  const [surfaceCondition, setSurfaceCondition] = useState("new");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setType(existing.type);
      setIsInstalled(existing.isInstalled);
      setSurfaceCondition(existing.surfaceCondition);
      setNotes(existing.notes ?? "");
    } else {
      setName("");
      setType("textured_pei");
      setIsInstalled(false);
      setSurfaceCondition("new");
      setNotes("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const payload = {
      machineId,
      name,
      type,
      isInstalled,
      surfaceCondition,
      notes: notes || null,
    };
    const result = existing
      ? await updateMachineWorkSurface(existing.id, payload)
      : await createMachineWorkSurface(payload);
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
      <DialogTitle>{existing ? "Edit Work Surface" : "Add Work Surface"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required size="small" />
          <TextField select label="Type" value={type} onChange={(e) => setType(e.target.value)} required size="small">
            {typeOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <FormControlLabel
            control={<Switch checked={isInstalled} onChange={(e) => setIsInstalled(e.target.checked)} />}
            label="Installed"
          />
          <TextField select label="Condition" value={surfaceCondition} onChange={(e) => setSurfaceCondition(e.target.value)} size="small">
            {conditionOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
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
