"use client";

import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
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
import Typography from "@mui/material/Typography";
import { createHardwareModel, updateHardwareModel } from "@/lib/actions/hardware-catalog";
import { enumToOptions, hardwareCategoryLabels } from "./enum-labels";

const categoryOptions = enumToOptions(hardwareCategoryLabels);

type HardwareModel = {
  id: string;
  category: string;
  manufacturer: string;
  model: string;
  slug: string;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: HardwareModel | null;
};

export function HardwareModelDialog({ open, onClose, onSaved, existing }: Props) {
  const [category, setCategory] = useState("label_printer");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  // Label printer
  const [printWidthMm, setPrintWidthMm] = useState("");
  const [printHeightMaxMm, setPrintHeightMaxMm] = useState("");
  const [printDpi, setPrintDpi] = useState("");
  const [dotsPerLine, setDotsPerLine] = useState("");
  const [printTechnology, setPrintTechnology] = useState("");
  const [continuousFeed, setContinuousFeed] = useState(false);
  // 3D / CNC / Laser
  const [buildVolumeX, setBuildVolumeX] = useState("");
  const [buildVolumeY, setBuildVolumeY] = useState("");
  const [buildVolumeZ, setBuildVolumeZ] = useState("");
  const [maxNozzleTemp, setMaxNozzleTemp] = useState("");
  const [maxBedTemp, setMaxBedTemp] = useState("");
  const [hasEnclosure, setHasEnclosure] = useState(false);
  const [hasFilamentChanger, setHasFilamentChanger] = useState(false);
  const [filamentChangerSlots, setFilamentChangerSlots] = useState("");
  // Connectivity
  const [hasUsb, setHasUsb] = useState(false);
  const [hasBle, setHasBle] = useState(false);
  const [hasWifi, setHasWifi] = useState(false);
  const [hasEthernet, setHasEthernet] = useState(false);
  const [hasMqtt, setHasMqtt] = useState(false);
  // Protocol
  const [protocol, setProtocol] = useState("");
  const [bleServiceUuid, setBleServiceUuid] = useState("");
  const [bleWriteCharUuid, setBleWriteCharUuid] = useState("");
  const [bleNotifyCharUuid, setBleNotifyCharUuid] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isLabelPrinter = category === "label_printer";
  const isMachine = ["fdm_printer", "resin_printer", "cnc", "laser_cutter", "laser_engraver"].includes(category);

  // Auto-generate slug from manufacturer + model
  useEffect(() => {
    if (!existing) {
      const s = `${category}-${manufacturer}-${model}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+$/, "")
        .replace(/^-+/, "");
      setSlug(s);
    }
  }, [category, manufacturer, model, existing]);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setCategory(existing.category);
      setManufacturer(existing.manufacturer);
      setModel(existing.model);
      setSlug(existing.slug);
      const e = existing as Record<string, any>;
      setDescription(e.description ?? "");
      setWebsiteUrl(e.websiteUrl ?? "");
      setPrintWidthMm(e.printWidthMm != null ? String(e.printWidthMm) : "");
      setPrintHeightMaxMm(e.printHeightMaxMm != null ? String(e.printHeightMaxMm) : "");
      setPrintDpi(e.printDpi != null ? String(e.printDpi) : "");
      setDotsPerLine(e.dotsPerLine != null ? String(e.dotsPerLine) : "");
      setPrintTechnology(e.printTechnology ?? "");
      setContinuousFeed(e.continuousFeed ?? false);
      setBuildVolumeX(e.buildVolumeX != null ? String(e.buildVolumeX) : "");
      setBuildVolumeY(e.buildVolumeY != null ? String(e.buildVolumeY) : "");
      setBuildVolumeZ(e.buildVolumeZ != null ? String(e.buildVolumeZ) : "");
      setMaxNozzleTemp(e.maxNozzleTemp != null ? String(e.maxNozzleTemp) : "");
      setMaxBedTemp(e.maxBedTemp != null ? String(e.maxBedTemp) : "");
      setHasEnclosure(e.hasEnclosure ?? false);
      setHasFilamentChanger(e.hasFilamentChanger ?? false);
      setFilamentChangerSlots(e.filamentChangerSlots != null ? String(e.filamentChangerSlots) : "");
      setHasUsb(e.hasUsb ?? false);
      setHasBle(e.hasBle ?? false);
      setHasWifi(e.hasWifi ?? false);
      setHasEthernet(e.hasEthernet ?? false);
      setHasMqtt(e.hasMqtt ?? false);
      setProtocol(e.protocol ?? "");
      setBleServiceUuid(e.bleServiceUuid ?? "");
      setBleWriteCharUuid(e.bleWriteCharUuid ?? "");
      setBleNotifyCharUuid(e.bleNotifyCharUuid ?? "");
    } else {
      setCategory("label_printer");
      setManufacturer("");
      setModel("");
      setSlug("");
      setDescription("");
      setWebsiteUrl("");
      setPrintWidthMm("");
      setPrintHeightMaxMm("");
      setPrintDpi("");
      setDotsPerLine("");
      setPrintTechnology("");
      setContinuousFeed(false);
      setBuildVolumeX("");
      setBuildVolumeY("");
      setBuildVolumeZ("");
      setMaxNozzleTemp("");
      setMaxBedTemp("");
      setHasEnclosure(false);
      setHasFilamentChanger(false);
      setFilamentChangerSlots("");
      setHasUsb(false);
      setHasBle(false);
      setHasWifi(false);
      setHasEthernet(false);
      setHasMqtt(false);
      setProtocol("");
      setBleServiceUuid("");
      setBleWriteCharUuid("");
      setBleNotifyCharUuid("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      category,
      manufacturer,
      model,
      slug,
      description: description || null,
      websiteUrl: websiteUrl || null,
      hasUsb,
      hasBle,
      hasWifi,
      hasEthernet,
      hasMqtt,
      protocol: protocol || null,
      bleServiceUuid: bleServiceUuid || null,
      bleWriteCharUuid: bleWriteCharUuid || null,
      bleNotifyCharUuid: bleNotifyCharUuid || null,
    };

    if (isLabelPrinter) {
      payload.printWidthMm = printWidthMm ? Number(printWidthMm) : null;
      payload.printHeightMaxMm = printHeightMaxMm ? Number(printHeightMaxMm) : null;
      payload.printDpi = printDpi ? Number(printDpi) : null;
      payload.dotsPerLine = dotsPerLine ? Number(dotsPerLine) : null;
      payload.printTechnology = printTechnology || null;
      payload.continuousFeed = continuousFeed;
    }

    if (isMachine) {
      payload.buildVolumeX = buildVolumeX ? Number(buildVolumeX) : null;
      payload.buildVolumeY = buildVolumeY ? Number(buildVolumeY) : null;
      payload.buildVolumeZ = buildVolumeZ ? Number(buildVolumeZ) : null;
      payload.maxNozzleTemp = maxNozzleTemp ? Number(maxNozzleTemp) : null;
      payload.maxBedTemp = maxBedTemp ? Number(maxBedTemp) : null;
      payload.hasEnclosure = hasEnclosure;
      payload.hasFilamentChanger = hasFilamentChanger;
      payload.filamentChangerSlots = filamentChangerSlots ? Number(filamentChangerSlots) : null;
    }

    const result = existing
      ? await updateHardwareModel(existing.id, payload)
      : await createHardwareModel(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{existing ? "Edit Hardware Model" : "Add Hardware Model"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* ── Identity ─────────────────────────────────────────── */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                select
                label="Category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                required
                size="small"
                fullWidth
              >
                {categoryOptions.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} required size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Model" value={model} onChange={(e) => setModel(e.target.value)} required size="small" fullWidth />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} required size="small" fullWidth helperText="Auto-generated URL identifier" />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} size="small" fullWidth multiline rows={2} />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField label="Website URL" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} size="small" fullWidth />
            </Grid>
          </Grid>

          {/* ── Label Printer Specs ──────────────────────────────── */}
          {isLabelPrinter && (
            <>
              <Typography variant="subtitle2" color="text.secondary">Label Printer Specs</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField label="Print Width (mm)" value={printWidthMm} onChange={(e) => setPrintWidthMm(e.target.value)} type="number" size="small" fullWidth />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField label="Max Height (mm)" value={printHeightMaxMm} onChange={(e) => setPrintHeightMaxMm(e.target.value)} type="number" size="small" fullWidth />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField label="DPI" value={printDpi} onChange={(e) => setPrintDpi(e.target.value)} type="number" size="small" fullWidth />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField label="Dots/Line" value={dotsPerLine} onChange={(e) => setDotsPerLine(e.target.value)} type="number" size="small" fullWidth />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField
                    select
                    label="Technology"
                    value={printTechnology}
                    onChange={(e) => setPrintTechnology(e.target.value)}
                    size="small"
                    fullWidth
                  >
                    <MenuItem value="">—</MenuItem>
                    <MenuItem value="thermal">Thermal</MenuItem>
                    <MenuItem value="thermal_transfer">Thermal Transfer</MenuItem>
                    <MenuItem value="inkjet">Inkjet</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <FormControlLabel
                    control={<Switch checked={continuousFeed} onChange={(e) => setContinuousFeed(e.target.checked)} />}
                    label="Continuous Feed"
                  />
                </Grid>
              </Grid>
            </>
          )}

          {/* ── Machine Specs ────────────────────────────────────── */}
          {isMachine && (
            <>
              <Typography variant="subtitle2" color="text.secondary">Machine Specs</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}>
                  <TextField label="Build X (mm)" value={buildVolumeX} onChange={(e) => setBuildVolumeX(e.target.value)} type="number" size="small" fullWidth />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField label="Build Y (mm)" value={buildVolumeY} onChange={(e) => setBuildVolumeY(e.target.value)} type="number" size="small" fullWidth />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <TextField label="Build Z (mm)" value={buildVolumeZ} onChange={(e) => setBuildVolumeZ(e.target.value)} type="number" size="small" fullWidth />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField label="Max Nozzle Temp" value={maxNozzleTemp} onChange={(e) => setMaxNozzleTemp(e.target.value)} type="number" size="small" fullWidth />
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <TextField label="Max Bed Temp" value={maxBedTemp} onChange={(e) => setMaxBedTemp(e.target.value)} type="number" size="small" fullWidth />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <FormControlLabel control={<Switch checked={hasEnclosure} onChange={(e) => setHasEnclosure(e.target.checked)} />} label="Enclosure" />
                </Grid>
                <Grid size={{ xs: 4 }}>
                  <FormControlLabel control={<Switch checked={hasFilamentChanger} onChange={(e) => setHasFilamentChanger(e.target.checked)} />} label="Filament Changer" />
                </Grid>
                {hasFilamentChanger && (
                  <Grid size={{ xs: 4 }}>
                    <TextField label="Changer Slots" value={filamentChangerSlots} onChange={(e) => setFilamentChangerSlots(e.target.value)} type="number" size="small" fullWidth />
                  </Grid>
                )}
              </Grid>
            </>
          )}

          {/* ── Connectivity ─────────────────────────────────────── */}
          <Typography variant="subtitle2" color="text.secondary">Connectivity</Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <FormControlLabel control={<Switch checked={hasUsb} onChange={(e) => setHasUsb(e.target.checked)} size="small" />} label="USB" />
            <FormControlLabel control={<Switch checked={hasBle} onChange={(e) => setHasBle(e.target.checked)} size="small" />} label="BLE" />
            <FormControlLabel control={<Switch checked={hasWifi} onChange={(e) => setHasWifi(e.target.checked)} size="small" />} label="WiFi" />
            <FormControlLabel control={<Switch checked={hasEthernet} onChange={(e) => setHasEthernet(e.target.checked)} size="small" />} label="Ethernet" />
            <FormControlLabel control={<Switch checked={hasMqtt} onChange={(e) => setHasMqtt(e.target.checked)} size="small" />} label="MQTT" />
          </Box>

          {/* ── Protocol ─────────────────────────────────────────── */}
          <Typography variant="subtitle2" color="text.secondary">Protocol</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField label="Protocol" value={protocol} onChange={(e) => setProtocol(e.target.value)} size="small" fullWidth helperText="e.g. esc_pos, gcode, marlin" />
            </Grid>
            {hasBle && (
              <>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="BLE Service UUID" value={bleServiceUuid} onChange={(e) => setBleServiceUuid(e.target.value)} size="small" fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="BLE Write Char UUID" value={bleWriteCharUuid} onChange={(e) => setBleWriteCharUuid(e.target.value)} size="small" fullWidth />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField label="BLE Notify Char UUID" value={bleNotifyCharUuid} onChange={(e) => setBleNotifyCharUuid(e.target.value)} size="small" fullWidth />
                </Grid>
              </>
            )}
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={!manufacturer || !model || saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
