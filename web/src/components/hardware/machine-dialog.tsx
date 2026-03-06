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
import Typography from "@mui/material/Typography";
import { createMachine, updateMachine } from "@/lib/actions/user-library";
import { enumToOptions, machineTypeLabels } from "./enum-labels";

const typeOptions = enumToOptions(machineTypeLabels);

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Record<string, any> | null;
};

export function MachineDialog({ open, onClose, onSaved, existing }: Props) {
  const [machineType, setMachineType] = useState("fdm");
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [firmwareVersion, setFirmwareVersion] = useState("");
  const [ipAddress, setIpAddress] = useState("");
  const [mqttTopic, setMqttTopic] = useState("");
  const [buildVolumeX, setBuildVolumeX] = useState("");
  const [buildVolumeY, setBuildVolumeY] = useState("");
  const [buildVolumeZ, setBuildVolumeZ] = useState("");
  const [nozzleDiameterMm, setNozzleDiameterMm] = useState("");
  const [hasFilamentChanger, setHasFilamentChanger] = useState(false);
  const [filamentChangerModel, setFilamentChangerModel] = useState("");
  const [filamentChangerSlotCount, setFilamentChangerSlotCount] = useState("");
  const [filamentChangerUnitCount, setFilamentChangerUnitCount] = useState("");
  const [toolHeadType, setToolHeadType] = useState("");
  const [nozzleSwapSystem, setNozzleSwapSystem] = useState("");
  const [enclosureType, setEnclosureType] = useState("");
  const [spindleMaxRpm, setSpindleMaxRpm] = useState("");
  const [spindlePowerW, setSpindlePowerW] = useState("");
  const [laserPowerW, setLaserPowerW] = useState("");
  const [laserWavelengthNm, setLaserWavelengthNm] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setMachineType(existing.machineType);
      setName(existing.name);
      setManufacturer(existing.manufacturer ?? "");
      setModel(existing.model ?? "");
      setSerialNumber(existing.serialNumber ?? "");
      setFirmwareVersion(existing.firmwareVersion ?? "");
      setIpAddress(existing.ipAddress ?? "");
      setMqttTopic(existing.mqttTopic ?? "");
      setBuildVolumeX(existing.buildVolumeX != null ? String(existing.buildVolumeX) : "");
      setBuildVolumeY(existing.buildVolumeY != null ? String(existing.buildVolumeY) : "");
      setBuildVolumeZ(existing.buildVolumeZ != null ? String(existing.buildVolumeZ) : "");
      setNozzleDiameterMm(existing.nozzleDiameterMm != null ? String(existing.nozzleDiameterMm) : "");
      setHasFilamentChanger(existing.hasFilamentChanger ?? false);
      setFilamentChangerModel(existing.filamentChangerModel ?? "");
      setFilamentChangerSlotCount(existing.filamentChangerSlotCount != null ? String(existing.filamentChangerSlotCount) : "");
      setFilamentChangerUnitCount(existing.filamentChangerUnitCount != null ? String(existing.filamentChangerUnitCount) : "");
      setToolHeadType(existing.toolHeadType ?? "");
      setNozzleSwapSystem(existing.nozzleSwapSystem ?? "");
      setEnclosureType(existing.enclosureType ?? "");
      setSpindleMaxRpm(existing.spindleMaxRpm != null ? String(existing.spindleMaxRpm) : "");
      setSpindlePowerW(existing.spindlePowerW != null ? String(existing.spindlePowerW) : "");
      setLaserPowerW(existing.laserPowerW != null ? String(existing.laserPowerW) : "");
      setLaserWavelengthNm(existing.laserWavelengthNm != null ? String(existing.laserWavelengthNm) : "");
      setNotes(existing.notes ?? "");
    } else {
      setMachineType("fdm");
      setName("");
      setManufacturer("");
      setModel("");
      setSerialNumber("");
      setFirmwareVersion("");
      setIpAddress("");
      setMqttTopic("");
      setBuildVolumeX("");
      setBuildVolumeY("");
      setBuildVolumeZ("");
      setNozzleDiameterMm("");
      setHasFilamentChanger(false);
      setFilamentChangerModel("");
      setFilamentChangerSlotCount("");
      setFilamentChangerUnitCount("");
      setToolHeadType("");
      setNozzleSwapSystem("");
      setEnclosureType("");
      setSpindleMaxRpm("");
      setSpindlePowerW("");
      setLaserPowerW("");
      setLaserWavelengthNm("");
      setNotes("");
    }
    setError(null);
  }, [open, existing]);

  const isFdmLike = machineType === "fdm" || machineType === "resin" || machineType === "multi";
  const isFdmOrMulti = machineType === "fdm" || machineType === "multi";
  const isCncLike = machineType === "cnc" || machineType === "multi";
  const isLaserLike = machineType === "laser" || machineType === "multi";

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const payload: Record<string, unknown> = {
      name,
      machineType,
      manufacturer: manufacturer || null,
      model: model || null,
      serialNumber: serialNumber || null,
      firmwareVersion: firmwareVersion || null,
      ipAddress: ipAddress || null,
      mqttTopic: mqttTopic || null,
      notes: notes || null,
    };

    if (isFdmLike) {
      payload.buildVolumeX = buildVolumeX ? Number(buildVolumeX) : null;
      payload.buildVolumeY = buildVolumeY ? Number(buildVolumeY) : null;
      payload.buildVolumeZ = buildVolumeZ ? Number(buildVolumeZ) : null;
      payload.nozzleDiameterMm = nozzleDiameterMm ? Number(nozzleDiameterMm) : null;
    }

    if (isFdmOrMulti) {
      payload.hasFilamentChanger = hasFilamentChanger;
      if (hasFilamentChanger) {
        payload.filamentChangerModel = filamentChangerModel || null;
        payload.filamentChangerSlotCount = filamentChangerSlotCount ? Number(filamentChangerSlotCount) : null;
        payload.filamentChangerUnitCount = filamentChangerUnitCount ? Number(filamentChangerUnitCount) : null;
      }
      payload.toolHeadType = toolHeadType || null;
      payload.nozzleSwapSystem = nozzleSwapSystem || null;
      payload.enclosureType = enclosureType || null;
    }

    if (isCncLike) {
      payload.spindleMaxRpm = spindleMaxRpm ? Number(spindleMaxRpm) : null;
      payload.spindlePowerW = spindlePowerW ? Number(spindlePowerW) : null;
    }

    if (isLaserLike) {
      payload.laserPowerW = laserPowerW ? Number(laserPowerW) : null;
      payload.laserWavelengthNm = laserWavelengthNm ? Number(laserWavelengthNm) : null;
    }

    const result = existing
      ? await updateMachine(existing.id, payload)
      : await createMachine(payload);
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
      <DialogTitle>{existing ? "Edit Machine" : "Add Machine"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* Common fields */}
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required size="small" />
          <TextField
            select
            label="Machine Type"
            value={machineType}
            onChange={(e) => setMachineType(e.target.value)}
            required
            size="small"
          >
            {typeOptions.map((o) => (
              <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={2}>
            <TextField label="Manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} size="small" fullWidth />
            <TextField label="Model" value={model} onChange={(e) => setModel(e.target.value)} size="small" fullWidth />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="Serial Number" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} size="small" fullWidth />
            <TextField label="Firmware Version" value={firmwareVersion} onChange={(e) => setFirmwareVersion(e.target.value)} size="small" fullWidth />
          </Stack>
          <Stack direction="row" spacing={2}>
            <TextField label="IP Address" value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} size="small" fullWidth />
            <TextField label="MQTT Topic" value={mqttTopic} onChange={(e) => setMqttTopic(e.target.value)} size="small" fullWidth />
          </Stack>

          {/* FDM / Resin / Multi: build volume & nozzle */}
          {isFdmLike && (
            <>
              <Typography variant="subtitle2" fontWeight={600}>Build Volume</Typography>
              <Stack direction="row" spacing={2}>
                <TextField label="X (mm)" value={buildVolumeX} onChange={(e) => setBuildVolumeX(e.target.value)} type="number" size="small" fullWidth />
                <TextField label="Y (mm)" value={buildVolumeY} onChange={(e) => setBuildVolumeY(e.target.value)} type="number" size="small" fullWidth />
                <TextField label="Z (mm)" value={buildVolumeZ} onChange={(e) => setBuildVolumeZ(e.target.value)} type="number" size="small" fullWidth />
              </Stack>
              <TextField label="Nozzle Diameter (mm)" value={nozzleDiameterMm} onChange={(e) => setNozzleDiameterMm(e.target.value)} type="number" size="small" />
            </>
          )}

          {/* FDM / Multi: changer & tool head */}
          {isFdmOrMulti && (
            <>
              <FormControlLabel
                control={<Switch checked={hasFilamentChanger} onChange={(e) => setHasFilamentChanger(e.target.checked)} />}
                label="Filament Changer"
              />
              {hasFilamentChanger && (
                <Stack direction="row" spacing={2}>
                  <TextField label="Changer Model" value={filamentChangerModel} onChange={(e) => setFilamentChangerModel(e.target.value)} size="small" fullWidth />
                  <TextField label="Slot Count" value={filamentChangerSlotCount} onChange={(e) => setFilamentChangerSlotCount(e.target.value)} type="number" size="small" fullWidth />
                  <TextField label="Unit Count" value={filamentChangerUnitCount} onChange={(e) => setFilamentChangerUnitCount(e.target.value)} type="number" size="small" fullWidth />
                </Stack>
              )}
              <Stack direction="row" spacing={2}>
                <TextField label="Tool Head Type" value={toolHeadType} onChange={(e) => setToolHeadType(e.target.value)} size="small" fullWidth />
                <TextField label="Nozzle Swap System" value={nozzleSwapSystem} onChange={(e) => setNozzleSwapSystem(e.target.value)} size="small" fullWidth />
              </Stack>
              <TextField label="Enclosure Type" value={enclosureType} onChange={(e) => setEnclosureType(e.target.value)} size="small" />
            </>
          )}

          {/* CNC / Multi */}
          {isCncLike && (
            <>
              <Typography variant="subtitle2" fontWeight={600}>Spindle</Typography>
              <Stack direction="row" spacing={2}>
                <TextField label="Max RPM" value={spindleMaxRpm} onChange={(e) => setSpindleMaxRpm(e.target.value)} type="number" size="small" fullWidth />
                <TextField label="Power (W)" value={spindlePowerW} onChange={(e) => setSpindlePowerW(e.target.value)} type="number" size="small" fullWidth />
              </Stack>
            </>
          )}

          {/* Laser / Multi */}
          {isLaserLike && (
            <>
              <Typography variant="subtitle2" fontWeight={600}>Laser</Typography>
              <Stack direction="row" spacing={2}>
                <TextField label="Power (W)" value={laserPowerW} onChange={(e) => setLaserPowerW(e.target.value)} type="number" size="small" fullWidth />
                <TextField label="Wavelength (nm)" value={laserWavelengthNm} onChange={(e) => setLaserWavelengthNm(e.target.value)} type="number" size="small" fullWidth />
              </Stack>
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
