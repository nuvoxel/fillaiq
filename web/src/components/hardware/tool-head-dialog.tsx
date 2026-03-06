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
import { createMachineToolHead, updateMachineToolHead } from "@/lib/actions/user-library";
import {
  enumToOptions,
  toolCategoryLabels,
  nozzleMaterialLabels,
  nozzleTypeLabels,
  wearLevelLabels,
} from "./enum-labels";

const categoryOptions = enumToOptions(toolCategoryLabels);
const nozzleMaterialOptions = enumToOptions(nozzleMaterialLabels);
const nozzleTypeOptions = enumToOptions(nozzleTypeLabels);
const wearOptions = enumToOptions(wearLevelLabels);

type ToolHead = {
  id: string;
  machineId: string;
  toolCategory: string;
  name: string | null;
  diameterMm: number | null;
  nozzleMaterial: string | null;
  nozzleType: string | null;
  isInstalled: boolean;
  wearLevel: string;
  installCount: number;
  bitDiameterMm: number | null;
  bitType: string | null;
  fluteCount: number | null;
  bitMaterial: string | null;
  laserPowerW: number | null;
  laserWavelengthNm: number | null;
  focalLengthMm: number | null;
  notes: string | null;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  machineId: string;
  existing?: ToolHead | null;
};

export function ToolHeadDialog({ open, onClose, onSaved, machineId, existing }: Props) {
  const [toolCategory, setToolCategory] = useState("nozzle");
  const [name, setName] = useState("");
  const [isInstalled, setIsInstalled] = useState(false);
  const [wearLevel, setWearLevel] = useState("new");
  const [installCount, setInstallCount] = useState("0");
  // Nozzle
  const [diameterMm, setDiameterMm] = useState("");
  const [nozzleMaterial, setNozzleMaterial] = useState("");
  const [nozzleType, setNozzleType] = useState("");
  // Spindle bit
  const [bitDiameterMm, setBitDiameterMm] = useState("");
  const [bitType, setBitType] = useState("");
  const [fluteCount, setFluteCount] = useState("");
  const [bitMaterial, setBitMaterial] = useState("");
  // Laser
  const [laserPowerW, setLaserPowerW] = useState("");
  const [laserWavelengthNm, setLaserWavelengthNm] = useState("");
  const [focalLengthMm, setFocalLengthMm] = useState("");

  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setToolCategory(existing.toolCategory);
      setName(existing.name ?? "");
      setIsInstalled(existing.isInstalled);
      setWearLevel(existing.wearLevel);
      setInstallCount(String(existing.installCount));
      setDiameterMm(existing.diameterMm != null ? String(existing.diameterMm) : "");
      setNozzleMaterial(existing.nozzleMaterial ?? "");
      setNozzleType(existing.nozzleType ?? "");
      setBitDiameterMm(existing.bitDiameterMm != null ? String(existing.bitDiameterMm) : "");
      setBitType(existing.bitType ?? "");
      setFluteCount(existing.fluteCount != null ? String(existing.fluteCount) : "");
      setBitMaterial(existing.bitMaterial ?? "");
      setLaserPowerW(existing.laserPowerW != null ? String(existing.laserPowerW) : "");
      setLaserWavelengthNm(existing.laserWavelengthNm != null ? String(existing.laserWavelengthNm) : "");
      setFocalLengthMm(existing.focalLengthMm != null ? String(existing.focalLengthMm) : "");
      setNotes(existing.notes ?? "");
    } else {
      setToolCategory("nozzle");
      setName("");
      setIsInstalled(false);
      setWearLevel("new");
      setInstallCount("0");
      setDiameterMm("");
      setNozzleMaterial("");
      setNozzleType("");
      setBitDiameterMm("");
      setBitType("");
      setFluteCount("");
      setBitMaterial("");
      setLaserPowerW("");
      setLaserWavelengthNm("");
      setFocalLengthMm("");
      setNotes("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const payload: Record<string, unknown> = {
      machineId,
      toolCategory,
      name: name || null,
      isInstalled,
      wearLevel,
      installCount: Number(installCount),
      notes: notes || null,
    };

    if (toolCategory === "nozzle") {
      payload.diameterMm = diameterMm ? Number(diameterMm) : null;
      payload.nozzleMaterial = nozzleMaterial || null;
      payload.nozzleType = nozzleType || null;
    } else if (toolCategory === "spindle_bit") {
      payload.bitDiameterMm = bitDiameterMm ? Number(bitDiameterMm) : null;
      payload.bitType = bitType || null;
      payload.fluteCount = fluteCount ? Number(fluteCount) : null;
      payload.bitMaterial = bitMaterial || null;
    } else if (toolCategory === "laser_module") {
      payload.laserPowerW = laserPowerW ? Number(laserPowerW) : null;
      payload.laserWavelengthNm = laserWavelengthNm ? Number(laserWavelengthNm) : null;
      payload.focalLengthMm = focalLengthMm ? Number(focalLengthMm) : null;
    }

    const result = existing
      ? await updateMachineToolHead(existing.id, payload)
      : await createMachineToolHead(payload);
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
      <DialogTitle>{existing ? "Edit Tool Head" : "Add Tool Head"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          <TextField
            select
            label="Category"
            value={toolCategory}
            onChange={(e) => setToolCategory(e.target.value)}
            required
            size="small"
          >
            {categoryOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} size="small" />

          {toolCategory === "nozzle" && (
            <>
              <TextField label="Diameter (mm)" value={diameterMm} onChange={(e) => setDiameterMm(e.target.value)} type="number" size="small" />
              <TextField select label="Material" value={nozzleMaterial} onChange={(e) => setNozzleMaterial(e.target.value)} size="small">
                <MenuItem value="">—</MenuItem>
                {nozzleMaterialOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
              <TextField select label="Nozzle Type" value={nozzleType} onChange={(e) => setNozzleType(e.target.value)} size="small">
                <MenuItem value="">—</MenuItem>
                {nozzleTypeOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
            </>
          )}

          {toolCategory === "spindle_bit" && (
            <>
              <TextField label="Bit Diameter (mm)" value={bitDiameterMm} onChange={(e) => setBitDiameterMm(e.target.value)} type="number" size="small" />
              <TextField label="Bit Type" value={bitType} onChange={(e) => setBitType(e.target.value)} size="small" />
              <TextField label="Flute Count" value={fluteCount} onChange={(e) => setFluteCount(e.target.value)} type="number" size="small" />
              <TextField label="Bit Material" value={bitMaterial} onChange={(e) => setBitMaterial(e.target.value)} size="small" />
            </>
          )}

          {toolCategory === "laser_module" && (
            <>
              <TextField label="Power (W)" value={laserPowerW} onChange={(e) => setLaserPowerW(e.target.value)} type="number" size="small" />
              <TextField label="Wavelength (nm)" value={laserWavelengthNm} onChange={(e) => setLaserWavelengthNm(e.target.value)} type="number" size="small" />
              <TextField label="Focal Length (mm)" value={focalLengthMm} onChange={(e) => setFocalLengthMm(e.target.value)} type="number" size="small" />
            </>
          )}

          <FormControlLabel
            control={<Switch checked={isInstalled} onChange={(e) => setIsInstalled(e.target.checked)} />}
            label="Installed"
          />
          <TextField select label="Wear Level" value={wearLevel} onChange={(e) => setWearLevel(e.target.value)} size="small">
            {wearOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <TextField label="Install Count" value={installCount} onChange={(e) => setInstallCount(e.target.value)} type="number" size="small" />
          <TextField label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} multiline rows={2} size="small" />
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
