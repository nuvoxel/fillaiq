"use client";

import { useState, useEffect, useTransition } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
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
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Divider from "@mui/material/Divider";
import Slider from "@mui/material/Slider";
import DeleteIcon from "@mui/icons-material/Delete";
import AddIcon from "@mui/icons-material/Add";
import DevicesIcon from "@mui/icons-material/Devices";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import PrintIcon from "@mui/icons-material/Print";
import SettingsIcon from "@mui/icons-material/Settings";
import InfoIcon from "@mui/icons-material/Info";
import FiberManualRecordIcon from "@mui/icons-material/FiberManualRecord";
import { listMyStations, revokeDevice, updateStationChannel, claimDevice, getStationEnvironment, updateDeviceConfig } from "@/lib/actions/scan";
import { listMyPrinters, listMyPrintJobs, cancelPrintJob, cancelAllPendingPrintJobs } from "@/lib/actions/user-library";
import CloseIcon from "@mui/icons-material/Close";
import BatteryFullIcon from "@mui/icons-material/BatteryFull";
import Battery5BarIcon from "@mui/icons-material/Battery5Bar";
import Battery2BarIcon from "@mui/icons-material/Battery2Bar";
import BatteryAlertIcon from "@mui/icons-material/BatteryAlert";
import EnvironmentChart from "@/components/charts/environment-chart";

// ── Types ────────────────────────────────────────────────────────────────────

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
    touch?: SensorDetail;
    sdCard?: SensorDetail;
    audio?: SensorDetail;
    battery?: SensorDetail;
  };
  deviceSettings?: Record<string, any>;
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

// ── Small components ─────────────────────────────────────────────────────────

function InfoRow({ label, value, mono }: { label: string; value?: string | null; mono?: boolean }) {
  if (!value) return null;
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "baseline" }}>
      <Typography variant="body2" color="text.secondary" sx={{ minWidth: 100, flexShrink: 0 }}>
        {label}
      </Typography>
      <Typography variant="body2" fontFamily={mono ? "monospace" : undefined}>
        {value}
      </Typography>
    </Box>
  );
}

function SensorRow({ label, sensor }: { label: string; sensor?: SensorDetail }) {
  if (!sensor?.detected) return null;
  const details = [sensor.chip, sensor.interface, sensor.address].filter(Boolean).join(" · ");
  const pins = [
    sensor.pin != null ? `GPIO${sensor.pin}` : null,
    sensor.pin2 != null ? `GPIO${sensor.pin2}` : null,
  ].filter(Boolean).join(", ");
  return (
    <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
      <Chip label={label} size="small" variant="outlined" sx={{ minWidth: 60 }} />
      <Typography variant="body2" color="text.secondary">
        {details}
        {pins && <Typography component="span" variant="body2" color="text.disabled" sx={{ ml: 0.5 }}>({pins})</Typography>}
      </Typography>
    </Box>
  );
}

// ── Station Card ─────────────────────────────────────────────────────────────

function StationCard({
  station,
  envData,
  isPending,
  onChannelChange,
  onRevoke,
  onSaveConfig,
}: {
  station: Station;
  envData: { temperatureC?: number | null; humidity?: number | null; pressureHPa?: number | null } | undefined;
  isPending: boolean;
  onChannelChange: (id: string, channel: string) => void;
  onRevoke: (id: string, name: string) => void;
  onSaveConfig: (id: string, settings: Record<string, any>) => void;
}) {
  const caps = (station.config as StationConfig)?.capabilities;
  const settings = (station.config as StationConfig)?.deviceSettings ?? {};
  const printer = caps?.printer;

  const [configValues, setConfigValues] = useState({
    envReportIntervalMs: (settings.envReportIntervalMs ?? 300000) / 60000,
    otaCheckIntervalMs: (settings.otaCheckIntervalMs ?? 300000) / 60000,
    weightCalibration: settings.weightCalibration ?? "",
    displayBrightness: settings.displayBrightness ?? 255,
    ledBrightness: settings.ledBrightness ?? 50,
    printerSpeed: settings.printerSpeed ?? 3,
    printerDensity: settings.printerDensity ?? 10,
  });

  const handleSave = () => {
    const out: Record<string, any> = {};
    if (configValues.envReportIntervalMs)
      out.envReportIntervalMs = configValues.envReportIntervalMs * 60000;
    if (configValues.otaCheckIntervalMs)
      out.otaCheckIntervalMs = configValues.otaCheckIntervalMs * 60000;
    if (configValues.weightCalibration)
      out.weightCalibration = parseFloat(String(configValues.weightCalibration));
    out.displayBrightness = configValues.displayBrightness;
    out.ledBrightness = configValues.ledBrightness;
    out.printerSpeed = configValues.printerSpeed;
    out.printerDensity = configValues.printerDensity;
    onSaveConfig(station.id, out);
  };

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      {/* ── Station Header ──────────────────────────────────────────── */}
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 2, bgcolor: "grey.50" }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {station.name}
            </Typography>
            <Chip
              icon={<FiberManualRecordIcon sx={{ fontSize: "10px !important" }} />}
              label={station.isOnline ? "Online" : "Offline"}
              size="small"
              color={station.isOnline ? "success" : "default"}
              variant="outlined"
            />
          </Box>
          <Box sx={{ display: "flex", gap: 2, mt: 0.25, flexWrap: "wrap" }}>
            <Typography variant="caption" color="text.secondary">
              {station.deviceSku ?? "filla-scan"} &middot; {station.hardwareId}
            </Typography>
            <Typography variant="caption" fontFamily="monospace" color="text.secondary">
              FW {station.firmwareVersion ?? "—"}
            </Typography>
            {station.ipAddress && (
              <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                {station.ipAddress}
              </Typography>
            )}
            {station.lastSeenAt && (
              <Typography variant="caption" color="text.secondary">
                Last seen {new Date(station.lastSeenAt).toLocaleString()}
              </Typography>
            )}
          </Box>
        </Box>
        <Select
          size="small"
          value={station.firmwareChannel ?? "stable"}
          onChange={(e) => onChannelChange(station.id, e.target.value)}
          disabled={isPending}
          sx={{ minWidth: 90, fontSize: "0.8125rem" }}
        >
          <MenuItem value="stable">Stable</MenuItem>
          <MenuItem value="beta">Beta</MenuItem>
          <MenuItem value="dev">Dev</MenuItem>
        </Select>
        <IconButton
          size="small"
          color="error"
          onClick={() => onRevoke(station.id, station.name)}
          disabled={isPending}
          title="Revoke device"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* ── Capabilities accordion ──────────────────────────────────── */}
      <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <InfoIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography variant="body2" fontWeight={500}>Capabilities</Typography>
            {caps && (
              <Box sx={{ display: "flex", gap: 0.5, ml: 1, flexWrap: "wrap" }}>
                {caps.nfc?.detected && <Chip label="NFC" size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />}
                {caps.scale?.detected && <Chip label="Scale" size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />}
                {caps.tof?.detected && <Chip label="TOF" size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />}
                {caps.colorSensor?.detected && <Chip label="Color" size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />}
                {caps.display?.detected && <Chip label="Display" size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />}
                {caps.leds?.detected && <Chip label="LED" size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />}
                {caps.environment?.detected && <Chip label="Env" size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />}
                {caps.touch?.detected && <Chip label="Touch" size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />}
                {caps.sdCard?.detected && <Chip label="SD" size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />}
                {caps.audio?.detected && <Chip label="Audio" size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />}
                {caps.battery?.detected && <Chip label="Battery" size="small" variant="outlined" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />}
                {caps.printer?.detected && <Chip label="Printer" size="small" variant="outlined" color="secondary" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />}
              </Box>
            )}
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Stack spacing={0.75}>
            <SensorRow label="NFC" sensor={caps?.nfc} />
            <SensorRow label="Scale" sensor={caps?.scale} />
            <SensorRow label="TOF" sensor={caps?.tof} />
            <SensorRow label="Color" sensor={caps?.colorSensor} />
            <SensorRow label="Display" sensor={caps?.display} />
            <SensorRow label="LEDs" sensor={caps?.leds} />
            <SensorRow label="Env" sensor={caps?.environment} />
            <SensorRow label="Touch" sensor={caps?.touch} />
            <SensorRow label="SD Card" sensor={caps?.sdCard} />
            <SensorRow label="Audio" sensor={caps?.audio} />
            <SensorRow label="Battery" sensor={caps?.battery} />
            {caps?.turntable && <Chip label="Turntable" size="small" variant="outlined" sx={{ alignSelf: "flex-start" }} />}
            {caps?.camera && <Chip label="Camera" size="small" variant="outlined" sx={{ alignSelf: "flex-start" }} />}
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* ── Environment chart accordion ─────────────────────────────── */}
      {caps?.environment?.detected && (
        <>
          <Divider />
          <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <ThermostatIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                <Typography variant="body2" fontWeight={500}>Environment</Typography>
                {envData && (
                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    {[
                      envData.temperatureC != null ? `${envData.temperatureC.toFixed(1)}\u00b0C` : null,
                      envData.humidity != null ? `${envData.humidity.toFixed(0)}% RH` : null,
                      envData.pressureHPa != null ? `${envData.pressureHPa.toFixed(0)} hPa` : null,
                    ].filter(Boolean).join(" \u00b7 ")}
                  </Typography>
                )}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <EnvironmentChart stationId={station.id} />
            </AccordionDetails>
          </Accordion>
        </>
      )}

      <Divider />

      {/* ── Settings accordion ──────────────────────────────────────── */}
      <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SettingsIcon sx={{ fontSize: 18, color: "text.secondary" }} />
            <Typography variant="body2" fontWeight={500}>Settings</Typography>
          </Box>
        </AccordionSummary>
        <AccordionDetails>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 2 }}>
            Settings are pushed to the device on the next heartbeat check.
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Env Report (min)"
                type="number"
                size="small"
                fullWidth
                value={configValues.envReportIntervalMs}
                onChange={(e) => setConfigValues(v => ({ ...v, envReportIntervalMs: Number(e.target.value) }))}
                slotProps={{ htmlInput: { min: 1, max: 60 } }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="OTA Check (min)"
                type="number"
                size="small"
                fullWidth
                value={configValues.otaCheckIntervalMs}
                onChange={(e) => setConfigValues(v => ({ ...v, otaCheckIntervalMs: Number(e.target.value) }))}
                slotProps={{ htmlInput: { min: 1, max: 60 } }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Weight Calibration"
                type="number"
                size="small"
                fullWidth
                value={configValues.weightCalibration}
                onChange={(e) => setConfigValues(v => ({ ...v, weightCalibration: e.target.value }))}
                slotProps={{ htmlInput: { step: 0.0001 } }}
              />
            </Grid>
            <Grid size={{ xs: 6 }} />
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">Display Brightness ({configValues.displayBrightness})</Typography>
              <Slider
                value={configValues.displayBrightness}
                onChange={(_, v) => setConfigValues(vals => ({ ...vals, displayBrightness: v as number }))}
                min={0} max={255} step={1} size="small"
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <Typography variant="caption" color="text.secondary">LED Brightness ({configValues.ledBrightness})</Typography>
              <Slider
                value={configValues.ledBrightness}
                onChange={(_, v) => setConfigValues(vals => ({ ...vals, ledBrightness: v as number }))}
                min={0} max={255} step={1} size="small"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                <Button size="small" variant="contained" onClick={handleSave} disabled={isPending}>
                  {isPending ? "Saving..." : "Save Settings"}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* ── Printer sub-device accordion ────────────────────────────── */}
      {printer?.detected && (
        <>
          <Divider />
          <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <PrintIcon sx={{ fontSize: 18, color: "secondary.main" }} />
                <Typography variant="body2" fontWeight={500}>
                  Label Printer
                </Typography>
                <Chip
                  label={printer.model || "Unknown"}
                  size="small"
                  color="secondary"
                  variant="outlined"
                  sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }}
                />
                <Typography variant="caption" color="text.secondary">
                  via {printer.connection}
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {/* Printer Info */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", mb: 1 }}>
                    Device Info
                  </Typography>
                  <Stack spacing={0.5}>
                    <InfoRow label="Model" value={printer.model} />
                    <InfoRow label="Connection" value={printer.connection} />
                    <InfoRow label="Protocol" value={printer.protocol?.toUpperCase()} />
                    <InfoRow label="Resolution" value={printer.dpi ? `${printer.dpi} DPI` : undefined} />
                    <InfoRow
                      label="Label Size"
                      value={printer.labelWidthMm && printer.labelHeightMm
                        ? `${printer.labelWidthMm} x ${printer.labelHeightMm} mm`
                        : undefined}
                    />
                    <InfoRow label="BLE Address" value={printer.bleAddr} mono />
                    {printer.usbVid && (
                      <InfoRow label="USB ID" value={`${printer.usbVid}:${printer.usbPid}`} mono />
                    )}
                  </Stack>
                </Grid>

                {/* Printer Settings */}
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", mb: 1 }}>
                    Print Settings
                  </Typography>
                  <Stack spacing={1.5}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Print Speed ({configValues.printerSpeed})
                      </Typography>
                      <Slider
                        value={configValues.printerSpeed}
                        onChange={(_, v) => setConfigValues(vals => ({ ...vals, printerSpeed: v as number }))}
                        min={1} max={5} step={1} size="small"
                        marks={[
                          { value: 1, label: "Slow" },
                          { value: 3, label: "Normal" },
                          { value: 5, label: "Fast" },
                        ]}
                      />
                    </Box>
                    <Box>
                      <Typography variant="caption" color="text.secondary">
                        Print Density ({configValues.printerDensity})
                      </Typography>
                      <Slider
                        value={configValues.printerDensity}
                        onChange={(_, v) => setConfigValues(vals => ({ ...vals, printerDensity: v as number }))}
                        min={1} max={15} step={1} size="small"
                        marks={[
                          { value: 1, label: "Light" },
                          { value: 8, label: "Normal" },
                          { value: 15, label: "Dark" },
                        ]}
                      />
                    </Box>
                    <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
                      <Button size="small" variant="contained" onClick={handleSave} disabled={isPending}>
                        {isPending ? "Saving..." : "Save Settings"}
                      </Button>
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </>
      )}
    </Paper>
  );
}

// ── Printer types & card ─────────────────────────────────────────────────────

type UserPrinterRow = {
  id: string;
  name: string;
  hardwareModelId: string | null;
  serialNumber: string | null;
  firmwareVersion: string | null;
  bleAddress: string | null;
  bleName: string | null;
  batteryPercent: number | null;
  paperLoaded: boolean | null;
  coverClosed: boolean | null;
  lastSeenAt: string | null;
  lastConnectedVia: string | null;
  scanStationId: string | null;
  notes: string | null;
  createdAt: string;
};

const JOB_STATUS_COLOR: Record<string, "default" | "warning" | "success" | "error" | "info"> = {
  pending: "warning",
  sent: "info",
  printing: "info",
  printed: "success",
  done: "success",
  failed: "error",
  cancelled: "default",
};

function PrinterCard({
  printer, stationName, stationOnline, jobs, isPending, onCancelJob, onClearAll,
}: {
  printer: UserPrinterRow;
  stationName?: string;
  stationOnline?: boolean;
  jobs: PrintJobRow[];
  isPending: boolean;
  onCancelJob: (id: string) => void;
  onClearAll: () => void;
}) {
  const isOnline = stationOnline ?? false;
  const activeJobs = jobs.filter((j) => ["pending", "sent", "printing"].includes(j.status));
  const recentJobs = jobs.filter((j) => !["pending", "sent", "printing"].includes(j.status)).slice(0, 5);
  const allJobs = [...activeJobs, ...recentJobs];

  return (
    <Paper variant="outlined" sx={{ overflow: "hidden" }}>
      <Box sx={{ px: 2, py: 1.5, display: "flex", alignItems: "center", gap: 2, bgcolor: "grey.50" }}>
        <PrintIcon sx={{ color: "secondary.main" }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="subtitle1" fontWeight={600} noWrap>
              {printer.name}
            </Typography>
            <Chip
              icon={<FiberManualRecordIcon sx={{ fontSize: "10px !important" }} />}
              label={isOnline ? "Online" : "Offline"}
              size="small"
              color={isOnline ? "success" : "default"}
              variant="outlined"
            />
            {activeJobs.length > 0 && (
              <Chip label={`${activeJobs.length} queued`} size="small" color="warning" sx={{ height: 20, "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }} />
            )}
          </Box>
          <Box sx={{ display: "flex", gap: 2, mt: 0.25, flexWrap: "wrap" }}>
            {printer.bleAddress && (
              <Typography variant="caption" fontFamily="monospace" color="text.secondary">
                BLE {printer.bleAddress}
              </Typography>
            )}
            {printer.bleName && (
              <Typography variant="caption" color="text.secondary">
                {printer.bleName}
              </Typography>
            )}
            {stationName && (
              <Typography variant="caption" color="text.secondary">
                via {stationName}
              </Typography>
            )}
            {printer.lastSeenAt && (
              <Typography variant="caption" color="text.secondary">
                Last seen {new Date(printer.lastSeenAt).toLocaleString()}
              </Typography>
            )}
          </Box>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          {printer.batteryPercent != null && (
            <Chip
              icon={
                printer.batteryPercent <= 10 ? <BatteryAlertIcon /> :
                printer.batteryPercent <= 30 ? <Battery2BarIcon /> :
                printer.batteryPercent <= 70 ? <Battery5BarIcon /> :
                <BatteryFullIcon />
              }
              label={`${printer.batteryPercent}%`}
              size="small"
              variant="outlined"
              color={printer.batteryPercent <= 10 ? "error" : printer.batteryPercent <= 25 ? "warning" : "default"}
            />
          )}
        </Box>
      </Box>
      {/* ── Status indicators ── */}
      <Box sx={{ px: 2, py: 1, display: "flex", gap: 1, flexWrap: "wrap", borderTop: 1, borderColor: "divider" }}>
        {printer.paperLoaded != null && (
          <Chip
            label={printer.paperLoaded ? "Paper OK" : "No Paper"}
            size="small"
            color={printer.paperLoaded ? "success" : "warning"}
            variant="outlined"
            sx={{ height: 22 }}
          />
        )}
        {printer.coverClosed != null && (
          <Chip
            label={printer.coverClosed ? "Cover Closed" : "Cover Open"}
            size="small"
            color={printer.coverClosed ? "success" : "warning"}
            variant="outlined"
            sx={{ height: 22 }}
          />
        )}
        {printer.lastConnectedVia && (
          <Chip label={printer.lastConnectedVia.toUpperCase()} size="small" variant="outlined" sx={{ height: 22 }} />
        )}
        {printer.firmwareVersion && (
          <Chip label={`FW ${printer.firmwareVersion}`} size="small" variant="outlined" sx={{ height: 22 }} />
        )}
      </Box>
      {/* ── Print queue ── */}
      <Box sx={{ borderTop: 1, borderColor: "divider" }}>
        <Box sx={{ px: 2, py: 0.75, display: "flex", alignItems: "center", justifyContent: "space-between", bgcolor: "grey.50" }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary">
            Print Queue
          </Typography>
          {activeJobs.length > 0 && (
            <Button size="small" color="error" onClick={onClearAll} disabled={isPending} sx={{ fontSize: "0.7rem", minWidth: 0, py: 0 }}>
              Clear All
            </Button>
          )}
        </Box>
        {allJobs.length === 0 ? (
          <Box sx={{ px: 2, py: 1.5, borderTop: 1, borderColor: "divider" }}>
            <Typography variant="caption" color="text.disabled">
              No print jobs
            </Typography>
          </Box>
        ) : (
          allJobs.map((job) => (
            <Box
              key={job.id}
              sx={{
                px: 2, py: 0.75,
                display: "flex", alignItems: "center", gap: 1,
                borderTop: 1, borderColor: "divider",
              }}
            >
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography variant="body2" fontSize="0.8rem" noWrap>
                  {(job.labelData as any)?.label || (job.labelData as any)?.location || "Print job"}
                </Typography>
                <Typography variant="caption" color="text.secondary" fontSize="0.7rem">
                  {new Date(job.createdAt).toLocaleString()}
                </Typography>
              </Box>
              <Chip
                label={job.status}
                size="small"
                color={JOB_STATUS_COLOR[job.status] ?? "default"}
                variant="outlined"
                sx={{ height: 20, textTransform: "capitalize", "& .MuiChip-label": { px: 0.75, fontSize: "0.7rem" } }}
              />
              {["pending", "sent", "printing"].includes(job.status) && (
                <IconButton size="small" onClick={() => onCancelJob(job.id)} disabled={isPending} sx={{ p: 0.25 }}>
                  <CloseIcon sx={{ fontSize: 14 }} />
                </IconButton>
              )}
            </Box>
          ))
        )}
      </Box>
    </Paper>
  );
}

// ── Main Tab ─────────────────────────────────────────────────────────────────

type PrintJobRow = {
  id: string;
  status: string;
  labelData: Record<string, any>;
  copies: number;
  stationId: string | null;
  errorMessage: string | null;
  createdAt: string;
};

export function FillaIqTab() {
  const [stations, setStations] = useState<Station[]>([]);
  const [printers, setPrinters] = useState<UserPrinterRow[]>([]);
  const [printJobs, setPrintJobs] = useState<PrintJobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [envData, setEnvData] = useState<Record<string, { temperatureC?: number | null; humidity?: number | null; pressureHPa?: number | null }>>({});
  const [pairOpen, setPairOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [pairError, setPairError] = useState("");

  const fetchStations = async () => {
    const [stationsResult, printersResult, jobsResult] = await Promise.all([
      listMyStations(),
      listMyPrinters(),
      listMyPrintJobs({ limit: 50 }),
    ]);
    if (stationsResult.data) {
      const stationList = stationsResult.data as unknown as Station[];
      setStations(stationList);

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
    if (printersResult.data) {
      setPrinters(printersResult.data as unknown as UserPrinterRow[]);
    }
    if (jobsResult.data) {
      setPrintJobs(jobsResult.data as unknown as PrintJobRow[]);
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
      if (!result.error) fetchStations();
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

  const handleChannelChange = (id: string, channel: string) => {
    startTransition(async () => {
      const result = await updateStationChannel(id, channel);
      if (!result.error) fetchStations();
    });
  };

  const handleSaveConfig = (id: string, settings: Record<string, any>) => {
    startTransition(async () => {
      const result = await updateDeviceConfig(id, settings);
      if (!result.error) fetchStations();
    });
  };

  const stationNameMap = Object.fromEntries(stations.map((s) => [s.id, s.name]));
  const stationPrinterOnlineMap = Object.fromEntries(stations.map((s) => {
    const hasPrinter = Boolean((s.config as StationConfig)?.capabilities?.printer?.detected);
    return [s.id, Boolean(s.isOnline) && hasPrinter];
  }));

  return (
    <>
      {/* ── Scan Stations ── */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
        <Typography variant="h6" fontWeight={600}>
          Scan Stations
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
        <Stack spacing={2}>
          {stations.map((station) => (
            <StationCard
              key={station.id}
              station={station}
              envData={envData[station.id]}
              isPending={isPending}
              onChannelChange={handleChannelChange}
              onRevoke={handleRevoke}
              onSaveConfig={handleSaveConfig}
            />
          ))}
        </Stack>
      )}

      {/* ── Label Printers ── */}
      {!loading && printers.length > 0 && (
        <>
          <Typography variant="h6" fontWeight={600} sx={{ mt: 4, mb: 2 }}>
            Label Printers
          </Typography>
          <Stack spacing={2}>
            {printers.map((p) => {
              // Jobs for this printer: assigned to its station, or unassigned
              const printerJobs = printJobs.filter(
                (j) => !j.stationId || j.stationId === p.scanStationId
              );
              return (
                <PrinterCard
                  key={p.id}
                  printer={p}
                  stationName={p.scanStationId ? stationNameMap[p.scanStationId] : undefined}
                  stationOnline={p.scanStationId ? stationPrinterOnlineMap[p.scanStationId] : undefined}
                  jobs={printerJobs}
                  isPending={isPending}
                  onCancelJob={(id) => {
                    startTransition(async () => {
                      await cancelPrintJob(id);
                      fetchStations();
                    });
                  }}
                  onClearAll={() => {
                    startTransition(async () => {
                      await cancelAllPendingPrintJobs();
                      fetchStations();
                    });
                  }}
                />
              );
            })}
          </Stack>
        </>
      )}

      {/* Pair dialog */}
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
