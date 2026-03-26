"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Trash2, Plus, Monitor, Thermometer, ChevronDown,
  Printer, Settings, Info, Circle,
  X, BatteryFull, BatteryMedium, BatteryLow, BatteryWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { listMyStations, revokeDevice, updateStationChannel, claimDevice, getStationEnvironment, updateDeviceConfig } from "@/lib/actions/scan";
import { listMyPrinters, listMyPrintJobs, cancelPrintJob, deletePrintJob, deletePrinter, cancelAllPendingPrintJobs, clearCompletedPrintJobs } from "@/lib/actions/user-library";
import EnvironmentChart from "@/components/charts/environment-chart";

// -- Types --

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
  telemetry?: {
    uptime?: number;
    freeHeap?: number;
    wifiRssi?: number;
    printer?: {
      connected?: boolean;
      battery?: number;
      paperLoaded?: boolean;
      coverClosed?: boolean;
    };
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
  hasCamera: boolean | null;
  config: StationConfig;
  createdAt: string;
};

// -- Small components --

function InfoRow({ label, value, mono }: { label: string; value?: React.ReactNode; mono?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 items-baseline">
      <span className="text-sm text-muted-foreground min-w-[100px] shrink-0">{label}</span>
      <span className={`text-sm ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function SensorRow({ label, sensor }: { label: string; sensor?: SensorDetail }) {
  if (!sensor?.detected) return null;
  const details = [sensor.chip, sensor.interface, sensor.address].filter(Boolean).join(" \u00b7 ");
  const pins = [
    sensor.pin != null ? `GPIO${sensor.pin}` : null,
    sensor.pin2 != null ? `GPIO${sensor.pin2}` : null,
  ].filter(Boolean).join(", ");
  return (
    <div className="flex gap-2 items-center">
      <Badge variant="outline" className="min-w-[60px] justify-center">{label}</Badge>
      <span className="text-sm text-muted-foreground">
        {details}
        {pins && <span className="text-muted-foreground/60 ml-1">({pins})</span>}
      </span>
    </div>
  );
}

function CapBadge({ label, detected }: { label: string; detected?: boolean }) {
  if (!detected) return null;
  return <Badge variant="outline" className="h-5 text-[0.7rem] px-1.5">{label}</Badge>;
}

// -- Station Card --

function StationCard({
  station,
  envData,
  printers,
  jobs,
  isPending,
  onChannelChange,
  onRevoke,
  onSaveConfig,
  onCancelJob,
  onDeleteJob,
  onClearAllJobs,
  onDeletePrinter,
}: {
  station: Station;
  envData: { temperatureC?: number | null; humidity?: number | null; pressureHPa?: number | null } | undefined;
  printers: UserPrinterRow[];
  jobs: PrintJobRow[];
  isPending: boolean;
  onChannelChange: (id: string, channel: string) => void;
  onRevoke: (id: string, name: string) => void;
  onSaveConfig: (id: string, settings: Record<string, any>) => void;
  onCancelJob: (id: string) => void;
  onDeleteJob: (id: string) => void;
  onClearAllJobs: () => void;
  onDeletePrinter: (id: string) => void;
}) {
  const caps = (station.config as StationConfig)?.capabilities;
  const settings = (station.config as StationConfig)?.deviceSettings ?? {};
  const telemetry = (station.config as StationConfig)?.telemetry;

  const [configValues, setConfigValues] = useState({
    envReportIntervalMs: (settings.envReportIntervalMs ?? 300000) / 60000,
    otaCheckIntervalMs: (settings.otaCheckIntervalMs ?? 300000) / 60000,
    weightCalibration: settings.weightCalibration ?? "",
    displayBrightness: settings.displayBrightness ?? 255,
    ledBrightness: settings.ledBrightness ?? 50,
    audioVolume: settings.audioVolume ?? 70,
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
    out.audioVolume = configValues.audioVolume;
    out.printerSpeed = configValues.printerSpeed;
    out.printerDensity = configValues.printerDensity;
    onSaveConfig(station.id, out);
  };

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Station Header */}
      <div className="px-3 py-2 flex items-center gap-3 bg-muted/50">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{station.name}</span>
            <Badge variant={station.isOnline ? "default" : "outline"}>
              <Circle className="size-2.5 mr-1" style={{ fill: station.isOnline ? "#00E676" : "#94A3B8" }} />
              {station.isOnline ? "Online" : "Offline"}
            </Badge>
          </div>
          <div className="flex gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
            <span>{station.deviceSku ?? "filla-scan"} &middot; {station.hardwareId}</span>
            <span className="font-mono">FW {station.firmwareVersion ?? "\u2014"}</span>
            {station.ipAddress && <span className="font-mono">{station.ipAddress}</span>}
            {telemetry?.wifiRssi != null && <span>RSSI {telemetry.wifiRssi} dBm</span>}
            {telemetry?.uptime != null && <span>Up {Math.floor(telemetry.uptime / 3600)}h {Math.floor((telemetry.uptime % 3600) / 60)}m</span>}
            {telemetry?.freeHeap != null && <span>{Math.round(telemetry.freeHeap / 1024)}KB free</span>}
            {station.lastSeenAt && <span>Last seen {new Date(station.lastSeenAt).toLocaleString()}</span>}
          </div>
        </div>
        <Select
          value={station.firmwareChannel ?? "stable"}
          onValueChange={(v) => v && onChannelChange(station.id, v)}
        >
          <SelectTrigger className="w-24" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stable">Stable</SelectItem>
            <SelectItem value="beta">Beta</SelectItem>
            <SelectItem value="dev">Dev</SelectItem>
          </SelectContent>
        </Select>
        <button
          className="p-1.5 rounded-md text-destructive hover:bg-destructive/10"
          onClick={() => onRevoke(station.id, station.name)}
          disabled={isPending}
          title="Revoke device"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {/* Capabilities accordion */}
      <Accordion>
        <AccordionItem value="caps">
          <AccordionTrigger className="px-3">
            <div className="flex items-center gap-2">
              <Info className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Capabilities</span>
              {caps && (
                <div className="flex gap-1 ml-2 flex-wrap">
                  <CapBadge label="NFC" detected={caps.nfc?.detected} />
                  <CapBadge label="Scale" detected={caps.scale?.detected} />
                  <CapBadge label="Color" detected={caps.colorSensor?.detected} />
                  <CapBadge label="Display" detected={caps.display?.detected} />
                  <CapBadge label="LED" detected={caps.leds?.detected} />
                  <CapBadge label="Env" detected={caps.environment?.detected} />
                  <CapBadge label="Touch" detected={caps.touch?.detected} />
                  <CapBadge label="SD" detected={caps.sdCard?.detected} />
                  <CapBadge label="Audio" detected={caps.audio?.detected} />
                  <CapBadge label="Battery" detected={caps.battery?.detected} />
                  {caps.printer?.detected && <Badge variant="secondary" className="h-5 text-[0.7rem] px-1.5">Printer</Badge>}
                </div>
              )}
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3">
            <div className="flex flex-col gap-1.5">
              <SensorRow label="NFC" sensor={caps?.nfc} />
              <SensorRow label="Scale" sensor={caps?.scale} />
              <SensorRow label="Color" sensor={caps?.colorSensor} />
              <SensorRow label="Display" sensor={caps?.display} />
              <SensorRow label="LEDs" sensor={caps?.leds} />
              <SensorRow label="Env" sensor={caps?.environment} />
              <SensorRow label="Touch" sensor={caps?.touch} />
              <SensorRow label="SD Card" sensor={caps?.sdCard} />
              <SensorRow label="Audio" sensor={caps?.audio} />
              <SensorRow label="Battery" sensor={caps?.battery} />
              {caps?.turntable && <Badge variant="outline" className="self-start">Turntable</Badge>}
              {caps?.camera && <Badge variant="outline" className="self-start">Camera</Badge>}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Environment chart accordion */}
      {caps?.environment?.detected && (
        <>
          <Separator />
          <Accordion>
            <AccordionItem value="env">
              <AccordionTrigger className="px-3">
                <div className="flex items-center gap-2">
                  <Thermometer className="size-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Environment</span>
                  {envData && (
                    <span className="text-xs text-muted-foreground ml-2">
                      {[
                        envData.temperatureC != null ? `${envData.temperatureC.toFixed(1)}\u00b0C` : null,
                        envData.humidity != null ? `${envData.humidity.toFixed(0)}% RH` : null,
                        envData.pressureHPa != null ? `${envData.pressureHPa.toFixed(0)} hPa` : null,
                      ].filter(Boolean).join(" \u00b7 ")}
                    </span>
                  )}
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-3">
                <EnvironmentChart stationId={station.id} />
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </>
      )}

      <Separator />

      {/* Settings accordion */}
      <Accordion>
        <AccordionItem value="settings">
          <AccordionTrigger className="px-3">
            <div className="flex items-center gap-2">
              <Settings className="size-4 text-muted-foreground" />
              <span className="text-sm font-medium">Settings</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3">
            <p className="text-xs text-muted-foreground mb-3">
              Settings are pushed to the device on the next heartbeat check.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Env Report (min)</Label>
                <Input type="number" className="h-7" value={configValues.envReportIntervalMs}
                  onChange={(e) => setConfigValues(v => ({ ...v, envReportIntervalMs: Number(e.target.value) }))}
                  min={1} max={60} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">OTA Check (min)</Label>
                <Input type="number" className="h-7" value={configValues.otaCheckIntervalMs}
                  onChange={(e) => setConfigValues(v => ({ ...v, otaCheckIntervalMs: Number(e.target.value) }))}
                  min={1} max={60} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Weight Calibration</Label>
                <Input type="number" className="h-7" value={configValues.weightCalibration}
                  onChange={(e) => setConfigValues(v => ({ ...v, weightCalibration: e.target.value }))}
                  step={0.0001} />
              </div>
              <div />
              <div className="space-y-1">
                <Label className="text-xs">Display Brightness ({configValues.displayBrightness})</Label>
                <input type="range" className="w-full" value={configValues.displayBrightness}
                  onChange={(e) => setConfigValues(v => ({ ...v, displayBrightness: Number(e.target.value) }))}
                  min={0} max={255} step={1} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">LED Brightness ({configValues.ledBrightness})</Label>
                <input type="range" className="w-full" value={configValues.ledBrightness}
                  onChange={(e) => setConfigValues(v => ({ ...v, ledBrightness: Number(e.target.value) }))}
                  min={0} max={255} step={1} />
              </div>
              {caps?.audio?.detected && (
                <div className="space-y-1">
                  <Label className="text-xs">Audio Volume ({configValues.audioVolume}%{configValues.audioVolume === 0 ? " -- Muted" : ""})</Label>
                  <input type="range" className="w-full" value={configValues.audioVolume}
                    onChange={(e) => setConfigValues(v => ({ ...v, audioVolume: Number(e.target.value) }))}
                    min={0} max={100} step={5} />
                </div>
              )}
              <div className="col-span-2 flex justify-end">
                <Button size="sm" onClick={handleSave} disabled={isPending}>
                  {isPending ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* Printers under this station */}
      {printers.length > 0 && (
        <div className="px-3 pb-3">
          <Separator className="mb-2" />
          <span className="text-xs text-muted-foreground font-semibold block mb-2">LABEL PRINTERS</span>
          <div className="flex flex-col gap-3">
            {printers.map((p) => (
              <PrinterCard
                key={p.id}
                printer={p}
                stationOnline={station.isOnline ?? undefined}
                stationConfig={(station.config as StationConfig) ?? undefined}
                jobs={jobs}
                isPending={isPending}
                onCancelJob={onCancelJob}
                onDeleteJob={onDeleteJob}
                onClearAll={onClearAllJobs}
                onSaveSettings={(settings) => onSaveConfig(station.id, settings)}
                onDelete={() => onDeletePrinter(p.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// -- Printer types & card --

type UserPrinterRow = {
  id: string;
  name: string;
  hardwareModelId: string | null;
  modelName: string | null;
  manufacturer: string | null;
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

const JOB_STATUS_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  sent: "secondary",
  printing: "secondary",
  printed: "default",
  done: "default",
  failed: "destructive",
  cancelled: "outline",
};

function PrinterCard({
  printer, stationOnline, stationConfig, jobs, isPending, onCancelJob, onDeleteJob, onClearAll, onSaveSettings, onDelete,
}: {
  printer: UserPrinterRow;
  stationName?: string;
  stationOnline?: boolean;
  stationConfig?: StationConfig;
  jobs: PrintJobRow[];
  isPending: boolean;
  onCancelJob: (id: string) => void;
  onDeleteJob?: (id: string) => void;
  onClearAll: () => void;
  onSaveSettings?: (settings: Record<string, any>) => void;
  onDelete?: () => void;
}) {
  const livePrinter = stationConfig?.telemetry?.printer;
  const isOnline = (stationOnline && livePrinter?.connected) ?? false;
  const caps = stationConfig?.capabilities?.printer;
  const settings = stationConfig?.deviceSettings ?? {};
  const batteryPercent = livePrinter?.battery ?? printer.batteryPercent;
  const [printerSpeed, setPrinterSpeed] = useState(settings.printerSpeed ?? 3);
  const [printerDensity, setPrinterDensity] = useState(settings.printerDensity ?? 10);
  const activeJobs = jobs.filter((j) => ["pending", "sent", "printing"].includes(j.status));
  const recentJobs = jobs.filter((j) => !["pending", "sent", "printing"].includes(j.status)).slice(0, 5);
  const allJobs = [...activeJobs, ...recentJobs];

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="px-3 py-2 flex items-center gap-3 bg-muted/50">
        <Printer className="size-5 text-secondary-foreground" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{printer.name}</span>
            <Badge variant={isOnline ? "default" : "outline"}>
              <Circle className="size-2.5 mr-1" style={{ fill: isOnline ? "#00E676" : "#94A3B8" }} />
              {isOnline ? "Online" : "Offline"}
            </Badge>
            {activeJobs.length > 0 && (
              <Badge variant="outline" className="h-5 text-[0.7rem]">{activeJobs.length} queued</Badge>
            )}
          </div>
          <div className="flex gap-3 mt-0.5 flex-wrap text-xs text-muted-foreground">
            {printer.modelName && <span>{printer.manufacturer ? `${printer.manufacturer} ` : ""}{printer.modelName}</span>}
            {printer.bleAddress && <span className="font-mono">BLE {printer.bleAddress}</span>}
            {printer.lastSeenAt && <span>Last seen {new Date(printer.lastSeenAt).toLocaleString()}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {livePrinter?.paperLoaded === false && (
            <Badge variant="destructive" className="h-5 text-[0.7rem]">No Paper</Badge>
          )}
          {livePrinter?.coverClosed === false && (
            <Badge variant="destructive" className="h-5 text-[0.7rem]">Cover Open</Badge>
          )}
          {batteryPercent != null && (
            <Badge variant={batteryPercent <= 10 ? "destructive" : "outline"}>
              {batteryPercent <= 10 ? <BatteryWarning className="size-3 mr-1" /> :
               batteryPercent <= 30 ? <BatteryLow className="size-3 mr-1" /> :
               batteryPercent <= 70 ? <BatteryMedium className="size-3 mr-1" /> :
               <BatteryFull className="size-3 mr-1" />}
              {batteryPercent}%
            </Badge>
          )}
          {onDelete && (
            <button
              className="p-1 rounded-md text-muted-foreground hover:text-destructive"
              onClick={onDelete}
              disabled={isPending}
              title="Remove printer"
            >
              <Trash2 className="size-4" />
            </button>
          )}
        </div>
      </div>
      {/* Status indicators */}
      <div className="px-3 py-1 flex gap-1 flex-wrap border-t border-border">
        {printer.paperLoaded != null && (
          <Badge variant={printer.paperLoaded ? "default" : "outline"} className="h-5">{printer.paperLoaded ? "Paper OK" : "No Paper"}</Badge>
        )}
        {printer.coverClosed != null && (
          <Badge variant={printer.coverClosed ? "default" : "outline"} className="h-5">{printer.coverClosed ? "Cover Closed" : "Cover Open"}</Badge>
        )}
        {printer.lastConnectedVia && (
          <Badge variant="outline" className="h-5 uppercase">{printer.lastConnectedVia}</Badge>
        )}
        {printer.firmwareVersion && (
          <Badge variant="outline" className="h-5">FW {printer.firmwareVersion}</Badge>
        )}
      </div>
      {/* Device info + settings */}
      <Accordion>
        <AccordionItem value="printer-details">
          <AccordionTrigger className="px-3 py-1">
            <div className="flex items-center gap-1">
              <Settings className="size-3.5 text-muted-foreground" />
              <span className="text-xs font-semibold text-muted-foreground">Details & Settings</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-muted-foreground font-semibold block mb-1">Device Info</span>
                <div className="flex flex-col gap-1">
                  {printer.modelName && <InfoRow label="Model" value={`${printer.manufacturer ? printer.manufacturer + " " : ""}${printer.modelName}`} />}
                  <InfoRow label="Name" value={printer.name} />
                  {caps?.connection && <InfoRow label="Connection" value={caps.connection} />}
                  {caps?.protocol && <InfoRow label="Protocol" value={caps.protocol.toUpperCase()} />}
                  {caps?.dpi && <InfoRow label="Resolution" value={`${caps.dpi} DPI`} />}
                  {caps?.labelWidthMm && caps?.labelHeightMm && <InfoRow label="Label Size" value={`${caps.labelWidthMm} x ${caps.labelHeightMm} mm`} />}
                  {printer.bleAddress && <InfoRow label="BLE Address" value={printer.bleAddress} mono />}
                  {printer.serialNumber && <InfoRow label="Serial" value={printer.serialNumber} mono />}
                </div>
              </div>
              {onSaveSettings && (
                <div>
                  <span className="text-xs text-muted-foreground font-semibold block mb-1">Print Settings</span>
                  <div className="flex flex-col gap-2">
                    <div>
                      <Label className="text-xs">Print Speed ({printerSpeed})</Label>
                      <input type="range" className="w-full" value={printerSpeed}
                        onChange={(e) => setPrinterSpeed(Number(e.target.value))}
                        min={1} max={5} step={1} />
                      <div className="flex justify-between text-[0.6rem] text-muted-foreground">
                        <span>Slow</span><span>Normal</span><span>Fast</span>
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Print Density ({printerDensity})</Label>
                      <input type="range" className="w-full" value={printerDensity}
                        onChange={(e) => setPrinterDensity(Number(e.target.value))}
                        min={1} max={15} step={1} />
                      <div className="flex justify-between text-[0.6rem] text-muted-foreground">
                        <span>Light</span><span>Normal</span><span>Dark</span>
                      </div>
                    </div>
                    <div className="flex justify-end mt-1">
                      <Button size="sm" disabled={isPending}
                        onClick={() => onSaveSettings({ printerSpeed, printerDensity })}>
                        {isPending ? "Saving..." : "Save Settings"}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      {/* Print queue */}
      <div className="border-t border-border">
        <div className="px-3 py-1 flex items-center justify-between bg-muted/50">
          <span className="text-xs font-semibold text-muted-foreground">Print Queue</span>
          {allJobs.length > 0 && (
            <Button variant="destructive" size="xs" onClick={onClearAll} disabled={isPending}>
              Clear All
            </Button>
          )}
        </div>
        {allJobs.length === 0 ? (
          <div className="px-3 py-2 border-t border-border">
            <span className="text-xs text-muted-foreground">No print jobs</span>
          </div>
        ) : (
          allJobs.map((job) => (
            <div key={job.id} className="px-3 py-1 flex items-center gap-2 border-t border-border">
              <div className="flex-1 min-w-0">
                <span className="text-sm truncate block">
                  {(job.labelData as any)?.label || (job.labelData as any)?.location || "Print job"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {new Date(job.createdAt).toLocaleString()}
                </span>
              </div>
              <Badge variant={JOB_STATUS_VARIANT[job.status] ?? "outline"} className="capitalize h-5 text-[0.7rem]">
                {job.status}
              </Badge>
              <button
                className="p-0.5 rounded text-muted-foreground hover:text-destructive"
                disabled={isPending}
                onClick={() => onDeleteJob?.(job.id)}
                title="Delete"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// -- Main Tab --

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
  const searchParams = useSearchParams();
  const [pairOpen, setPairOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [pairError, setPairError] = useState("");

  // Auto-open pair dialog if ?pair=CODE is in the URL (from QR code)
  useEffect(() => {
    const code = searchParams.get("pair");
    if (code && code.length >= 4) {
      setPairingCode(code.toUpperCase());
      setPairOpen(true);
    }
  }, [searchParams]);

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

  return (
    <TooltipProvider>
      <>
        {/* Scan Stations */}
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-semibold">Scan Stations</h2>
          <Button onClick={() => { setPairOpen(true); setPairError(""); setPairingCode(""); }}>
            <Plus className="size-4 mr-1" />
            Pair Device
          </Button>
        </div>

        {loading ? (
          <div className="text-center py-6">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : stations.length === 0 ? (
          <div className="text-center py-6">
            <Monitor className="size-12 text-muted-foreground mx-auto mb-1" />
            <p className="text-sm text-muted-foreground">
              No devices paired. Power on a device and enter the pairing code to connect it.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {stations.map((station) => {
              const stationPrinters = printers.filter((p) => p.scanStationId === station.id);
              const stationJobs = printJobs.filter(
                (j) => !j.stationId || j.stationId === station.id
              );
              return (
                <StationCard
                  key={station.id}
                  station={station}
                  envData={envData[station.id]}
                  printers={stationPrinters}
                  jobs={stationJobs}
                  isPending={isPending}
                  onChannelChange={handleChannelChange}
                  onRevoke={handleRevoke}
                  onSaveConfig={handleSaveConfig}
                  onCancelJob={(id) => {
                    startTransition(async () => {
                      await cancelPrintJob(id);
                      fetchStations();
                    });
                  }}
                  onDeleteJob={(id) => {
                    startTransition(async () => {
                      await deletePrintJob(id);
                      fetchStations();
                    });
                  }}
                  onDeletePrinter={(id) => {
                    if (!confirm("Remove this printer? It will reappear next time the station detects it.")) return;
                    startTransition(async () => {
                      await deletePrinter(id);
                      fetchStations();
                    });
                  }}
                  onClearAllJobs={() => {
                    startTransition(async () => {
                      await cancelAllPendingPrintJobs();
                      await clearCompletedPrintJobs();
                      fetchStations();
                    });
                  }}
                />
              );
            })}
          </div>
        )}

        {/* Printers without a station (orphaned) */}
        {!loading && printers.filter((p) => !p.scanStationId || !stations.find((s) => s.id === p.scanStationId)).length > 0 && (
          <>
            <p className="text-sm font-semibold text-muted-foreground mt-4 mb-2">Unassigned Printers</p>
            <div className="flex flex-col gap-3">
              {printers
                .filter((p) => !p.scanStationId || !stations.find((s) => s.id === p.scanStationId))
                .map((p) => (
                  <PrinterCard
                    key={p.id}
                    printer={p}
                    jobs={printJobs.filter((j) => !j.stationId)}
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
                        await clearCompletedPrintJobs();
                        fetchStations();
                      });
                    }}
                  />
                ))}
            </div>
          </>
        )}

        {/* Pair dialog */}
        <Dialog open={pairOpen} onOpenChange={(o) => { if (!o) setPairOpen(false); }}>
          <DialogContent className="sm:max-w-xs">
            <DialogHeader>
              <DialogTitle>Pair Device</DialogTitle>
            </DialogHeader>
            <p className="text-sm text-muted-foreground mb-2">
              Enter the 6-character pairing code shown on your device.
            </p>
            {pairError && (
              <Alert variant="destructive" className="mb-2">
                <AlertDescription>{pairError}</AlertDescription>
              </Alert>
            )}
            <Input
              autoFocus
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter" && pairingCode.length === 6) handlePair(); }}
              maxLength={6}
              placeholder="ABC123"
              className="text-center text-2xl font-mono font-semibold tracking-widest"
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setPairOpen(false)}>Cancel</Button>
              <Button onClick={handlePair} disabled={isPending || pairingCode.length !== 6}>
                {isPending ? "Pairing..." : "Pair"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    </TooltipProvider>
  );
}
