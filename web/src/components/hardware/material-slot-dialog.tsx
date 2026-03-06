"use client";

import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import { createMachineMaterialSlot, updateMachineMaterialSlot } from "@/lib/actions/user-library";
import { enumToOptions, changerTypeLabels } from "./enum-labels";

const changerOptions = enumToOptions(changerTypeLabels);

type MaterialSlot = {
  id: string;
  machineId: string;
  changerType: string;
  unitNumber: number;
  slotPosition: number;
  spoolId: string | null;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  machineId: string;
  existing?: MaterialSlot | null;
};

export function MaterialSlotDialog({ open, onClose, onSaved, machineId, existing }: Props) {
  const [changerType, setChangerType] = useState("ams");
  const [unitNumber, setUnitNumber] = useState("1");
  const [slotPosition, setSlotPosition] = useState("1");
  const [spoolId, setSpoolId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setChangerType(existing.changerType);
      setUnitNumber(String(existing.unitNumber));
      setSlotPosition(String(existing.slotPosition));
      setSpoolId(existing.spoolId ?? "");
    } else {
      setChangerType("ams");
      setUnitNumber("1");
      setSlotPosition("1");
      setSpoolId("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const payload = {
      machineId,
      changerType,
      unitNumber: Number(unitNumber),
      slotPosition: Number(slotPosition),
      spoolId: spoolId || null,
    };
    const result = existing
      ? await updateMachineMaterialSlot(existing.id, payload)
      : await createMachineMaterialSlot(payload);
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
      <DialogTitle>{existing ? "Edit Material Slot" : "Add Material Slot"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField select label="Changer Type" value={changerType} onChange={(e) => setChangerType(e.target.value)} required size="small">
            {changerOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField label="Unit Number" value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} type="number" required size="small" fullWidth />
            <TextField label="Slot Position" value={slotPosition} onChange={(e) => setSlotPosition(e.target.value)} type="number" required size="small" fullWidth />
          </Stack>
          <TextField label="Spool ID (optional)" value={spoolId} onChange={(e) => setSpoolId(e.target.value)} size="small" />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
