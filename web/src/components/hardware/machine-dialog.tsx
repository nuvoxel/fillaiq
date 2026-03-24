"use client";

import { useState, useEffect, useMemo } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
} from "@/components/ui/select";
import { createMachine, updateMachine, listMyStations } from "@/lib/actions/user-library";
import { listHardwareModels } from "@/lib/actions/hardware-catalog";
import { enumToOptions, machineTypeLabels, machineProtocolLabels } from "./enum-labels";
import { getAllPlugins, type ConnectionFieldDef } from "@/lib/machines";

const typeOptions = enumToOptions(machineTypeLabels);
const protocolOptions = enumToOptions(machineProtocolLabels);

type CatalogModel = {
  id: string;
  manufacturer: string;
  model: string;
  category: string;
  buildVolumeX: number | null;
  buildVolumeY: number | null;
  buildVolumeZ: number | null;
  maxNozzleTemp: number | null;
  maxBedTemp: number | null;
  hasEnclosure: boolean | null;
  hasFilamentChanger: boolean | null;
  filamentChangerSlots: number | null;
  hasWifi: boolean | null;
  hasMqtt: boolean | null;
  protocol: string | null;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Record<string, any> | null;
};

// Build a map of protocol -> connectionFields for rendering dynamic forms
const pluginFieldsMap: Record<string, ConnectionFieldDef[]> = {};
for (const plugin of getAllPlugins()) {
  pluginFieldsMap[plugin.protocol] = plugin.connectionFields;
}

export function MachineDialog({ open, onClose, onSaved, existing }: Props) {
  const [machineType, setMachineType] = useState("fdm");
  const [protocol, setProtocol] = useState("manual");
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
  const [scanStationId, setScanStationId] = useState("");
  const [connectionConfig, setConnectionConfig] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [stations, setStations] = useState<Array<{ id: string; name: string; hardwareId: string }>>([]);
  const [catalogModels, setCatalogModels] = useState<CatalogModel[]>([]);
  const [selectedCatalog, setSelectedCatalog] = useState<CatalogModel | null>(null);

  // Connection fields for the currently selected protocol
  const connectionFields = useMemo(() => pluginFieldsMap[protocol] ?? [], [protocol]);

  // Filter protocol options to those that support the current machine type
  const filteredProtocolOptions = useMemo(() => {
    const allPlugins = getAllPlugins();
    const supported = allPlugins
      .filter((p) => p.supportedMachineTypes.includes(machineType as any))
      .map((p) => p.protocol);
    return protocolOptions.filter(
      (o) => o.value === "manual" || supported.includes(o.value)
    );
  }, [machineType]);

  useEffect(() => {
    if (open) {
      listMyStations().then((r) => {
        if (r.data) {
          setStations(r.data as any[]);
          if (!existing && r.data.length > 0 && !scanStationId) {
            setScanStationId((r.data as any[])[0].id);
          }
        }
      });
      if (!existing) {
        listHardwareModels({ limit: 200 }).then((r) => {
          if (r.data) {
            const machineCategories = ["fdm_printer", "resin_printer", "cnc", "laser_cutter", "laser_engraver"];
            setCatalogModels(
              (r.data as CatalogModel[]).filter((m) => machineCategories.includes(m.category))
            );
          }
        });
      }
    }
  }, [open, existing]);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setMachineType(existing.machineType);
      setProtocol(existing.protocol ?? "manual");
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
      setScanStationId(existing.scanStationId ?? "");
      setConnectionConfig((existing.connectionConfig as Record<string, string>) ?? {});
      setNotes(existing.notes ?? "");
    } else {
      setMachineType("fdm");
      setProtocol("manual");
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
      setScanStationId("");
      setConnectionConfig({});
      setNotes("");
      setSelectedCatalog(null);
    }
    setError(null);
  }, [open, existing]);

  const categoryToType: Record<string, string> = {
    fdm_printer: "fdm", resin_printer: "resin", cnc: "cnc",
    laser_cutter: "laser", laser_engraver: "laser",
  };

  const applyCatalogModel = (m: CatalogModel | null) => {
    setSelectedCatalog(m);
    if (!m) return;
    setName(`${m.manufacturer} ${m.model}`);
    setMachineType(categoryToType[m.category] ?? "fdm");
    setManufacturer(m.manufacturer ?? "");
    setModel(m.model ?? "");
    if (m.buildVolumeX != null) setBuildVolumeX(String(m.buildVolumeX));
    if (m.buildVolumeY != null) setBuildVolumeY(String(m.buildVolumeY));
    if (m.buildVolumeZ != null) setBuildVolumeZ(String(m.buildVolumeZ));
    setHasFilamentChanger(m.hasFilamentChanger ?? false);
    if (m.filamentChangerSlots != null) setFilamentChangerSlotCount(String(m.filamentChangerSlots));
    if (m.hasEnclosure) setEnclosureType("enclosed");
    if (m.protocol) setProtocol(m.protocol);
    else if (m.hasMqtt) setProtocol("bambu");
  };

  const updateConnectionField = (key: string, value: string) => {
    setConnectionConfig((prev) => ({ ...prev, [key]: value }));
  };

  const isFdmLike = machineType === "fdm" || machineType === "resin" || machineType === "multi";
  const isFdmOrMulti = machineType === "fdm" || machineType === "multi";
  const isCncLike = machineType === "cnc" || machineType === "multi";
  const isLaserLike = machineType === "laser" || machineType === "multi";
  const hasProtocol = protocol !== "manual";

  // Group catalog models by manufacturer
  const catalogByManufacturer = useMemo(() => {
    const map = new Map<string, CatalogModel[]>();
    for (const m of catalogModels) {
      const arr = map.get(m.manufacturer) ?? [];
      arr.push(m);
      map.set(m.manufacturer, arr);
    }
    return map;
  }, [catalogModels]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const finalConnectionConfig: Record<string, unknown> = { ...connectionConfig };

    const payload: Record<string, unknown> = {
      name,
      machineType,
      protocol,
      manufacturer: manufacturer || null,
      model: model || null,
      serialNumber: serialNumber || null,
      firmwareVersion: firmwareVersion || null,
      ipAddress: ipAddress || null,
      mqttTopic: mqttTopic || null,
      scanStationId: scanStationId || null,
      connectionConfig: hasProtocol ? finalConnectionConfig : null,
      accessCode: protocol === "bambu" ? (connectionConfig.accessCode || null) : null,
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Machine" : "Add Machine"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Catalog picker (new machines only) */}
          {!existing && catalogModels.length > 0 && (
            <div className="space-y-1.5">
              <Label>Select a model</Label>
              <Select
                value={selectedCatalog?.id ?? "_none"}
                onValueChange={(v) => {
                  if (v === "_none") { setSelectedCatalog(null); return; }
                  const found = catalogModels.find((m) => m.id === v);
                  if (found) applyCatalogModel(found);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Search models..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">-- Select --</SelectItem>
                  {Array.from(catalogByManufacturer.entries()).map(([mfr, models]) => (
                    <SelectGroup key={mfr}>
                      <SelectLabel>{mfr}</SelectLabel>
                      {models.map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.manufacturer} {m.model}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Catalog model selected -- streamlined form */}
          {!existing && selectedCatalog ? (
            <>
              <p className="text-sm text-muted-foreground">
                {selectedCatalog.manufacturer} {selectedCatalog.model}
                {selectedCatalog.buildVolumeX && ` -- ${selectedCatalog.buildVolumeX}x${selectedCatalog.buildVolumeY}x${selectedCatalog.buildVolumeZ}mm`}
                {selectedCatalog.hasFilamentChanger && ` -- ${selectedCatalog.filamentChangerSlots} AMS slots`}
                {selectedCatalog.hasEnclosure && ` -- Enclosed`}
              </p>
              <div className="space-y-1.5">
                <Label>Name *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>IP Address</Label>
                <Input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} />
              </div>

              {/* Protocol selector */}
              <div className="space-y-1.5">
                <Label>Connection Protocol</Label>
                <Select value={protocol} onValueChange={(v) => { if (v) { setProtocol(v); setConnectionConfig({}); } }}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredProtocolOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Protocol-specific connection fields */}
              {hasProtocol && connectionFields.length > 0 && (
                <>
                  {connectionFields.map((field) => (
                    <div key={field.key} className="space-y-1.5">
                      <Label>{field.label}{field.required ? " *" : ""}</Label>
                      <Input
                        value={connectionConfig[field.key] ?? ""}
                        onChange={(e) => updateConnectionField(field.key, e.target.value)}
                        type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                        placeholder={field.placeholder}
                      />
                      {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
                    </div>
                  ))}
                </>
              )}

              {/* Scan station bridge selector */}
              {hasProtocol && (
                <div className="space-y-1.5">
                  <Label>Scan Station (bridge)</Label>
                  <Select value={scanStationId || "_none"} onValueChange={(v) => v && setScanStationId(v === "_none" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">None</SelectItem>
                      {stations.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name} ({s.hardwareId})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">Station on the same LAN that relays machine status</p>
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </div>
            </>
          ) : (
          <>
          {/* Full manual form (editing or no catalog selection) */}
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Machine Type *</Label>
              <Select value={machineType} onValueChange={(v) => v && setMachineType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {typeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Connection Protocol</Label>
              <Select value={protocol} onValueChange={(v) => { if (v) { setProtocol(v); setConnectionConfig({}); } }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredProtocolOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Manufacturer</Label>
              <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Model</Label>
              <Input value={model} onChange={(e) => setModel(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Serial Number</Label>
              <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Firmware Version</Label>
              <Input value={firmwareVersion} onChange={(e) => setFirmwareVersion(e.target.value)} />
            </div>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>IP Address</Label>
              <Input value={ipAddress} onChange={(e) => setIpAddress(e.target.value)} />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>MQTT Topic</Label>
              <Input value={mqttTopic} onChange={(e) => setMqttTopic(e.target.value)} />
            </div>
          </div>

          {/* Protocol-specific connection fields */}
          {hasProtocol && connectionFields.length > 0 && (
            <>
              <Separator />
              <p className="text-sm font-semibold">
                {machineProtocolLabels[protocol] ?? protocol} Connection
              </p>
              {connectionFields.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label>{field.label}{field.required ? " *" : ""}</Label>
                  <Input
                    value={connectionConfig[field.key] ?? ""}
                    onChange={(e) => updateConnectionField(field.key, e.target.value)}
                    type={field.type === "password" ? "password" : field.type === "number" ? "number" : "text"}
                    placeholder={field.placeholder}
                  />
                  {field.helpText && <p className="text-xs text-muted-foreground">{field.helpText}</p>}
                </div>
              ))}
            </>
          )}

          {/* Scan station bridge selector */}
          {hasProtocol && (
            <>
              <Separator />
              <p className="text-sm font-semibold">Bridge</p>
              <div className="space-y-1.5">
                <Label>Scan Station (bridge)</Label>
                <Select value={scanStationId || "_none"} onValueChange={(v) => v && setScanStationId(v === "_none" ? "" : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">None</SelectItem>
                    {stations.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.hardwareId})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Station on the same LAN that relays machine status</p>
              </div>
            </>
          )}

          {/* FDM / Resin / Multi: build volume & nozzle */}
          {isFdmLike && (
            <>
              <Separator />
              <p className="text-sm font-semibold">Build Volume</p>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>X (mm)</Label>
                  <Input value={buildVolumeX} onChange={(e) => setBuildVolumeX(e.target.value)} type="number" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label>Y (mm)</Label>
                  <Input value={buildVolumeY} onChange={(e) => setBuildVolumeY(e.target.value)} type="number" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label>Z (mm)</Label>
                  <Input value={buildVolumeZ} onChange={(e) => setBuildVolumeZ(e.target.value)} type="number" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Nozzle Diameter (mm)</Label>
                <Input value={nozzleDiameterMm} onChange={(e) => setNozzleDiameterMm(e.target.value)} type="number" />
              </div>
            </>
          )}

          {/* FDM / Multi: changer & tool head */}
          {isFdmOrMulti && (
            <>
              <div className="flex items-center gap-2">
                <Switch checked={hasFilamentChanger} onCheckedChange={setHasFilamentChanger} />
                <Label>Filament Changer</Label>
              </div>
              {hasFilamentChanger && (
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label>Changer Model</Label>
                    <Input value={filamentChangerModel} onChange={(e) => setFilamentChangerModel(e.target.value)} />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label>Slot Count</Label>
                    <Input value={filamentChangerSlotCount} onChange={(e) => setFilamentChangerSlotCount(e.target.value)} type="number" />
                  </div>
                  <div className="flex-1 space-y-1.5">
                    <Label>Unit Count</Label>
                    <Input value={filamentChangerUnitCount} onChange={(e) => setFilamentChangerUnitCount(e.target.value)} type="number" />
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>Tool Head Type</Label>
                  <Input value={toolHeadType} onChange={(e) => setToolHeadType(e.target.value)} />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label>Nozzle Swap System</Label>
                  <Input value={nozzleSwapSystem} onChange={(e) => setNozzleSwapSystem(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Enclosure Type</Label>
                <Input value={enclosureType} onChange={(e) => setEnclosureType(e.target.value)} />
              </div>
            </>
          )}

          {/* CNC / Multi */}
          {isCncLike && (
            <>
              <Separator />
              <p className="text-sm font-semibold">Spindle</p>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>Max RPM</Label>
                  <Input value={spindleMaxRpm} onChange={(e) => setSpindleMaxRpm(e.target.value)} type="number" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label>Power (W)</Label>
                  <Input value={spindlePowerW} onChange={(e) => setSpindlePowerW(e.target.value)} type="number" />
                </div>
              </div>
            </>
          )}

          {/* Laser / Multi */}
          {isLaserLike && (
            <>
              <Separator />
              <p className="text-sm font-semibold">Laser</p>
              <div className="flex gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label>Power (W)</Label>
                  <Input value={laserPowerW} onChange={(e) => setLaserPowerW(e.target.value)} type="number" />
                </div>
                <div className="flex-1 space-y-1.5">
                  <Label>Wavelength (nm)</Label>
                  <Input value={laserWavelengthNm} onChange={(e) => setLaserWavelengthNm(e.target.value)} type="number" />
                </div>
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
          </>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!name || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
