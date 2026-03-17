"use client";

import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import { createMaterial, updateMaterial } from "@/lib/actions/central-catalog";

const materialClassOptions = [
  { value: "", label: "—" },
  { value: "fff", label: "FFF" },
  { value: "sla", label: "SLA" },
  { value: "cnc", label: "CNC" },
  { value: "laser", label: "Laser" },
];

type Material = {
  id: string;
  name: string;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Material | null;
};

export function MaterialDialog({ open, onClose, onSaved, existing }: Props) {
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [category, setCategory] = useState("");
  const [materialClass, setMaterialClass] = useState("");
  const [density, setDensity] = useState("");
  const [hygroscopic, setHygroscopic] = useState(false);
  const [defaultDryingTemp, setDefaultDryingTemp] = useState("");
  const [defaultDryingTimeMin, setDefaultDryingTimeMin] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      const e = existing as Record<string, any>;
      setName(e.name ?? "");
      setAbbreviation(e.abbreviation ?? "");
      setCategory(e.category ?? "");
      setMaterialClass(e.materialClass ?? "");
      setDensity(e.density != null ? String(e.density) : "");
      setHygroscopic(e.hygroscopic ?? false);
      setDefaultDryingTemp(
        e.defaultDryingTemp != null ? String(e.defaultDryingTemp) : ""
      );
      setDefaultDryingTimeMin(
        e.defaultDryingTimeMin != null ? String(e.defaultDryingTimeMin) : ""
      );
    } else {
      setName("");
      setAbbreviation("");
      setCategory("");
      setMaterialClass("");
      setDensity("");
      setHygroscopic(false);
      setDefaultDryingTemp("");
      setDefaultDryingTimeMin("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      name,
      abbreviation: abbreviation || null,
      category: category || null,
      materialClass: materialClass || null,
      density: density ? Number(density) : null,
      hygroscopic,
      defaultDryingTemp: defaultDryingTemp ? Number(defaultDryingTemp) : null,
      defaultDryingTimeMin: defaultDryingTimeMin
        ? Number(defaultDryingTimeMin)
        : null,
    };

    const result = existing
      ? await updateMaterial(existing.id, payload)
      : await createMaterial(payload);
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
      <DialogTitle>
        {existing ? "Edit Material" : "Add Material"}
      </DialogTitle>
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
                label="Abbreviation"
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value)}
                size="small"
                fullWidth
                helperText="e.g. PLA, PETG, ABS"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                size="small"
                fullWidth
                helperText="e.g. thermoplastic, thermoset, composite"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Material Class"
                value={materialClass}
                onChange={(e) => setMaterialClass(e.target.value)}
                size="small"
                fullWidth
              >
                {materialClassOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Density (g/cm\u00B3)"
                value={density}
                onChange={(e) => setDensity(e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Drying Temp (\u00B0C)"
                value={defaultDryingTemp}
                onChange={(e) => setDefaultDryingTemp(e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Drying Time (min)"
                value={defaultDryingTimeMin}
                onChange={(e) => setDefaultDryingTimeMin(e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={hygroscopic}
                    onChange={(e) => setHygroscopic(e.target.checked)}
                  />
                }
                label="Hygroscopic"
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
