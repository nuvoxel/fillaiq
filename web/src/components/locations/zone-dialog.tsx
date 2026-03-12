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
import TextField from "@mui/material/TextField";
import { createZone, updateZone } from "@/lib/actions/hardware";

const zoneTypeLabels: Record<string, string> = {
  workshop: "Workshop",
  storage: "Storage",
  printer_area: "Printer Area",
  drying: "Drying",
  other: "Other",
};

const zoneTypeOptions = Object.entries(zoneTypeLabels).map(([value, label]) => ({
  value,
  label,
}));

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    nfcTagId: string | null;
  } | null;
};

export function ZoneDialog({ open, onClose, onSaved, existing }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState("workshop");
  const [description, setDescription] = useState("");
  const [nfcTagId, setNfcTagId] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setType(existing.type);
      setDescription(existing.description ?? "");
      setNfcTagId(existing.nfcTagId ?? "");
    } else {
      setName("");
      setType("workshop");
      setDescription("");
      setNfcTagId("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const payload = {
      name,
      type,
      description: description || null,
      nfcTagId: nfcTagId || null,
    };

    const result = existing
      ? await updateZone(existing.id, payload)
      : await createZone(payload);
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
      <DialogTitle>{existing ? "Edit Zone" : "Add Zone"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                size="small"
                fullWidth
              />
            </Grid>
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
            <Grid size={{ xs: 12 }}>
              <TextField
                label="NFC Tag ID"
                value={nfcTagId}
                onChange={(e) => setNfcTagId(e.target.value)}
                size="small"
                fullWidth
                helperText="Optional NFC tag identifier for this zone"
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name || saving}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
