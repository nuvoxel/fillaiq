"use client";

import { useState, useEffect, useTransition } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import IconButton from "@mui/material/IconButton";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Alert from "@mui/material/Alert";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Paper from "@mui/material/Paper";
import Tooltip from "@mui/material/Tooltip";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import DevicesIcon from "@mui/icons-material/Devices";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import SettingsIcon from "@mui/icons-material/Settings";
import Slider from "@mui/material/Slider";
import { listMyStations, revokeDevice, updateStationChannel, claimDevice, getStationEnvironment, updateDeviceConfig } from "@/lib/actions/scan";

type SensorDetail = {
  detected?: boolean;
  chip?: string;
  interface?: string;
  address?: string;
  pin?: number;
  pin2?: number;
};

type PrinterDetail = {
  detected?: boolean;
  model?: string;
  connection?: string;
  labelWidthMm?: number;
  labelHeightMm?: number;
  dpi?: number;
  protocol?: string;
  usbVid?: string;
  usbPid?: string;
  bleAddr?: string;
};

type StationConfig = {
  capabilities?: {
    nfc?: SensorDetail;
    scale?: SensorDetail;
    tof?: SensorDetail;
    colorSensor?: SensorDetail;
    display?: SensorDetail;
    leds?: SensorDetail;
    turntable?: boolean;
    camera?: boolean;
    environment?: SensorDetail;
    printer?: PrinterDetail;
  };
  deviceSettings?: Record<string, any>;
  latestEnvironment?: {
    temperatureC?: number | null;
    humidity?: number | null;
    pressureHPa?: number | null;
    createdAt?: string;
  };
} | null;

type Station = {
  id: string;
  name: string;
  hardwareId: string;
  deviceSku: string | null;
  firmwareVersion: string | null;
  firmwareChannel: string | null;
  ipAddress: string | null;
  isOnline: boolean | null;
  lastSeenAt: string | null;
  hasTurntable: boolean | null;
  hasColorSensor: boolean | null;
  hasTofSensor: boolean | null;
  hasCamera: boolean | null;
  config: StationConfig;
  createdAt: string;
};

function SensorChip({ label, sensor }: { label: string; sensor?: SensorDetail }) {
  if (!sensor?.detected) return null;
  const details = [
    sensor.chip,
    sensor.interface,
    sensor.address,
    sensor.pin != null ? `GPIO${sensor.pin}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <Tooltip title={details || label} arrow>
      <Chip label={label} size="small" variant="outlined" />
    </Tooltip>
  );
}

function PrinterChip({ printer }: { printer?: PrinterDetail }) {
  if (!printer?.detected) return null;
  const details = [
    printer.model,
    printer.connection,
    printer.dpi ? `${printer.dpi} DPI` : null,
    printer.labelWidthMm && printer.labelHeightMm
      ? `${printer.labelWidthMm}x${printer.labelHeightMm}mm`
      : null,
    printer.protocol,
    printer.usbVid ? `USB ${printer.usbVid}:${printer.usbPid}` : null,
    printer.bleAddr ? `BLE ${printer.bleAddr}` : null,
  ].filter(Boolean).join(" · ");
  return (
    <Tooltip title={details} arrow>
      <Chip label={`Printer: ${printer.model || "Unknown"}`} size="small" variant="outlined" color="secondary" />
    </Tooltip>
  );
}

export function FillaIqTab() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [envData, setEnvData] = useState<Record<string, { temperatureC?: number | null; humidity?: number | null; pressureHPa?: number | null }>>({});
  const [pairOpen, setPairOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [pairError, setPairError] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [configStation, setConfigStation] = useState<Station | null>(null);
  const [configValues, setConfigValues] = useState<Record<string, any>>({});

  const fetchStations = async () => {
    const result = await listMyStations();
    if (result.data) {
      const stationList = result.data as unknown as Station[];
      setStations(stationList);

      // Fetch latest environment reading for stations with environment sensor
      const envEntries: Record<string, { temperatureC?: number | null; humidity?: number | null; pressureHPa?: number | null }> = {};
      await Promise.all(
        stationList
          .filter((s) => (s.config as StationConfig)?.capabilities?.environment?.detected)
          .map(async (s) => {
            const envResult = await getStationEnvironment(s.id, 1);
            if (envResult.data && Array.isArray(envResult.data) && envResult.data.length > 0) {
              const latest = envResult.data[envResult.data.length - 1];
              envEntries[s.id] = {
                temperatureC: latest.temperatureC,
                humidity: latest.humidity,
                pressureHPa: latest.pressureHPa,
              };
            }
          })
      );
      setEnvData(envEntries);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const handleRevoke = (id: string, name: string) => {
    if (!confirm(`Revoke access for "${name}"? The device will need to be re-paired.`)) return;
    startTransition(async () => {
      const result = await revokeDevice(id);
      if (!result.error) {
        fetchStations();
      }
    });
  };

  const handlePair = () => {
    setPairError("");
    startTransition(async () => {
      const result = await claimDevice(pairingCode.trim().toUpperCase());
      if (result.error) {
        setPairError(result.error);
      } else {
        setPairOpen(false);
        setPairingCode("");
        fetchStations();
      }
    });
  };

  const handleOpenConfig = (station: Station) => {
    setConfigStation(station);
    const settings = (station.config as StationConfig)?.deviceSettings ?? {};
    setConfigValues({
      envReportIntervalMs: (settings.envReportIntervalMs ?? 300000) / 60000,
      otaCheckIntervalMs: (settings.otaCheckIntervalMs ?? 300000) / 60000,
      weightCalibration: settings.weightCalibration ?? "",
      displayBrightness: settings.displayBrightness ?? 255,
      ledBrightness: settings.ledBrightness ?? 50,
    });
    setConfigOpen(true);
  };

  const handleSaveConfig = () => {
    if (!configStation) return;
    startTransition(async () => {
      const settings: Record<string, any> = {};
      if (configValues.envReportIntervalMs)
        settings.envReportIntervalMs = configValues.envReportIntervalMs * 60000;
      if (configValues.otaCheckIntervalMs)
        settings.otaCheckIntervalMs = configValues.otaCheckIntervalMs * 60000;
      if (configValues.weightCalibration)
        settings.weightCalibration = parseFloat(configValues.weightCalibration);
      settings.displayBrightness = configValues.displayBrightness;
      settings.ledBrightness = configValues.ledBrightness;

      const result = await updateDeviceConfig(configStation.id, settings);
      if (!result.error) {
        setConfigOpen(false);
        fetchStations();
      }
    });
  };

  const handleChannelChange = (id: string, channel: string) => {
    startTransition(async () => {
      const result = await updateStationChannel(id, channel);
      if (!result.error) {
        fetchStations();
      }
    });
  };

  return (
    <>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Devices
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => { setPairOpen(true); setPairError(""); setPairingCode(""); }}
        >
          Pair Device
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <Typography variant="body2" color="text.secondary">Loading...</Typography>
        </Box>
      ) : stations.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 6 }}>
          <DevicesIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography variant="body2" color="text.secondary">
            No devices paired. Power on a device and enter the pairing code to connect it.
          </Typography>
        </Box>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>SKU</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Hardware ID</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Firmware</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Channel</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Capabilities</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>IP Address</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Environment</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Last Seen</TableCell>
                <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {stations.map((station) => (
                <TableRow key={station.id}>
                  <TableCell>{station.name}</TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                      {station.deviceSku ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                      {station.hardwareId}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                      {station.firmwareVersion ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Select
                      size="small"
                      value={station.firmwareChannel ?? "stable"}
                      onChange={(e) => handleChannelChange(station.id, e.target.value)}
                      disabled={isPending}
                      sx={{ minWidth: 90, fontSize: "0.8125rem" }}
                    >
                      <MenuItem value="stable">Stable</MenuItem>
                      <MenuItem value="beta">Beta</MenuItem>
                      <MenuItem value="dev">Dev</MenuItem>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {(() => {
                        const caps = (station.config as StationConfig)?.capabilities;
                        if (caps) {
                          return (
                            <>
                              <SensorChip label="NFC" sensor={caps.nfc} />
                              <SensorChip label="Scale" sensor={caps.scale} />
                              <SensorChip label="TOF" sensor={caps.tof} />
                              <SensorChip label="Color" sensor={caps.colorSensor} />
                              <SensorChip label="Display" sensor={caps.display} />
                              <SensorChip label="LEDs" sensor={caps.leds} />
                              <SensorChip label="Env" sensor={caps.environment} />
                              <PrinterChip printer={caps.printer} />
                              {caps.turntable && <Chip label="Turntable" size="small" variant="outlined" />}
                              {caps.camera && <Chip label="Camera" size="small" variant="outlined" />}
                            </>
                          );
                        }
                        // Fallback to boolean flags if no rich config
                        return (
                          <>
                            {station.hasTofSensor && <Chip label="TOF" size="small" variant="outlined" />}
                            {station.hasColorSensor && <Chip label="Color" size="small" variant="outlined" />}
                            {station.hasTurntable && <Chip label="Turntable" size="small" variant="outlined" />}
                            {station.hasCamera && <Chip label="Camera" size="small" variant="outlined" />}
                          </>
                        );
                      })()}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                      {station.ipAddress ?? "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={station.isOnline ? "Online" : "Offline"}
                      size="small"
                      color={station.isOnline ? "success" : "default"}
                    />
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const env = envData[station.id];
                      if (!env) return <Typography variant="body2" color="text.secondary">—</Typography>;
                      const parts: string[] = [];
                      if (env.temperatureC != null) parts.push(`${env.temperatureC.toFixed(1)}°C`);
                      if (env.humidity != null) parts.push(`${env.humidity.toFixed(0)}% RH`);
                      if (env.pressureHPa != null) parts.push(`${env.pressureHPa.toFixed(0)} hPa`);
                      if (parts.length === 0) return <Typography variant="body2" color="text.secondary">—</Typography>;
                      return (
                        <Tooltip title="Latest environmental reading" arrow>
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <ThermostatIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                            <Typography variant="body2" fontFamily="monospace" color="text.secondary">
                              {parts.join(" · ")}
                            </Typography>
                          </Box>
                        </Tooltip>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    {station.lastSeenAt
                      ? new Date(station.lastSeenAt).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <IconButton
                      size="small"
                      onClick={() => handleOpenConfig(station)}
                      title="Device settings"
                    >
                      <SettingsIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleRevoke(station.id, station.name)}
                      disabled={isPending}
                      title="Revoke device access"
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <Dialog open={configOpen} onClose={() => setConfigOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Device Settings — {configStation?.name}</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Settings are pushed to the device on the next heartbeat check.
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5 }}>
            <TextField
              label="Environment Report Interval (minutes)"
              type="number"
              size="small"
              value={configValues.envReportIntervalMs ?? ""}
              onChange={(e) => setConfigValues(v => ({ ...v, envReportIntervalMs: e.target.value }))}
              inputProps={{ min: 1, max: 60 }}
            />
            <TextField
              label="OTA Check Interval (minutes)"
              type="number"
              size="small"
              value={configValues.otaCheckIntervalMs ?? ""}
              onChange={(e) => setConfigValues(v => ({ ...v, otaCheckIntervalMs: e.target.value }))}
              inputProps={{ min: 1, max: 60 }}
            />
            <TextField
              label="Weight Calibration Factor"
              type="number"
              size="small"
              value={configValues.weightCalibration ?? ""}
              onChange={(e) => setConfigValues(v => ({ ...v, weightCalibration: e.target.value }))}
              inputProps={{ step: 0.0001 }}
            />
            <Box>
              <Typography variant="body2" gutterBottom>Display Brightness ({configValues.displayBrightness})</Typography>
              <Slider
                value={configValues.displayBrightness ?? 255}
                onChange={(_, v) => setConfigValues(vals => ({ ...vals, displayBrightness: v }))}
                min={0} max={255} step={1}
              />
            </Box>
            <Box>
              <Typography variant="body2" gutterBottom>LED Brightness ({configValues.ledBrightness})</Typography>
              <Slider
                value={configValues.ledBrightness ?? 50}
                onChange={(_, v) => setConfigValues(vals => ({ ...vals, ledBrightness: v }))}
                min={0} max={255} step={1}
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfigOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveConfig} variant="contained" disabled={isPending}>
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={pairOpen} onClose={() => setPairOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Pair Device</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the 6-character pairing code shown on your device.
          </Typography>
          {pairError && <Alert severity="error" sx={{ mb: 2 }}>{pairError}</Alert>}
          <TextField
            autoFocus
            fullWidth
            label="Pairing Code"
            value={pairingCode}
            onChange={(e) => setPairingCode(e.target.value.toUpperCase().slice(0, 6))}
            onKeyDown={(e) => { if (e.key === "Enter" && pairingCode.length === 6) handlePair(); }}
            inputProps={{ maxLength: 6, style: { fontFamily: "monospace", fontSize: "1.5rem", textAlign: "center", letterSpacing: "0.3em" } }}
            placeholder="ABC123"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPairOpen(false)}>Cancel</Button>
          <Button onClick={handlePair} variant="contained" disabled={isPending || pairingCode.length !== 6}>
            {isPending ? "Pairing..." : "Pair"}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
