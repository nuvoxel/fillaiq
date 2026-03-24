"use client";

import { useState, useEffect } from "react";
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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createHardwareModel, updateHardwareModel } from "@/lib/actions/hardware-catalog";
import { enumToOptions, hardwareCategoryLabels } from "./enum-labels";
import { ImageUpload } from "@/components/image-upload";

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
  const [imageUrl, setImageUrl] = useState<string | null>(null);
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
      setImageUrl(e.imageUrl ?? null);
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
      setImageUrl(null);
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
      imageUrl: imageUrl || null,
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Hardware Model" : "Add Hardware Model"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Identity */}
          <div className="flex gap-3">
            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              category="hardware"
              label="Product Image"
              width={120}
              height={120}
            />
            <div className="flex-1 grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category *</Label>
                <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Manufacturer *</Label>
                <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Model *</Label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Slug *</Label>
                <Input value={slug} onChange={(e) => setSlug(e.target.value)} />
                <p className="text-xs text-muted-foreground">Auto-generated URL identifier</p>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Website URL</Label>
                <Input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Label Printer Specs */}
          {isLabelPrinter && (
            <>
              <p className="text-sm font-semibold text-muted-foreground">Label Printer Specs</p>
              <div className="grid grid-cols-4 gap-3">
                <div className="space-y-1.5">
                  <Label>Print Width (mm)</Label>
                  <Input value={printWidthMm} onChange={(e) => setPrintWidthMm(e.target.value)} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Height (mm)</Label>
                  <Input value={printHeightMaxMm} onChange={(e) => setPrintHeightMaxMm(e.target.value)} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>DPI</Label>
                  <Input value={printDpi} onChange={(e) => setPrintDpi(e.target.value)} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Dots/Line</Label>
                  <Input value={dotsPerLine} onChange={(e) => setDotsPerLine(e.target.value)} type="number" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Technology</Label>
                  <Select value={printTechnology || "_none"} onValueChange={(v) => v && setPrintTechnology(v === "_none" ? "" : v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">&mdash;</SelectItem>
                      <SelectItem value="thermal">Thermal</SelectItem>
                      <SelectItem value="thermal_transfer">Thermal Transfer</SelectItem>
                      <SelectItem value="inkjet">Inkjet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch checked={continuousFeed} onCheckedChange={setContinuousFeed} />
                  <Label>Continuous Feed</Label>
                </div>
              </div>
            </>
          )}

          {/* Machine Specs */}
          {isMachine && (
            <>
              <p className="text-sm font-semibold text-muted-foreground">Machine Specs</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label>Build X (mm)</Label>
                  <Input value={buildVolumeX} onChange={(e) => setBuildVolumeX(e.target.value)} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Build Y (mm)</Label>
                  <Input value={buildVolumeY} onChange={(e) => setBuildVolumeY(e.target.value)} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Build Z (mm)</Label>
                  <Input value={buildVolumeZ} onChange={(e) => setBuildVolumeZ(e.target.value)} type="number" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Max Nozzle Temp</Label>
                  <Input value={maxNozzleTemp} onChange={(e) => setMaxNozzleTemp(e.target.value)} type="number" />
                </div>
                <div className="space-y-1.5">
                  <Label>Max Bed Temp</Label>
                  <Input value={maxBedTemp} onChange={(e) => setMaxBedTemp(e.target.value)} type="number" />
                </div>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Switch checked={hasEnclosure} onCheckedChange={setHasEnclosure} />
                  <Label>Enclosure</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={hasFilamentChanger} onCheckedChange={setHasFilamentChanger} />
                  <Label>Filament Changer</Label>
                </div>
                {hasFilamentChanger && (
                  <div className="space-y-1.5">
                    <Label>Changer Slots</Label>
                    <Input value={filamentChangerSlots} onChange={(e) => setFilamentChangerSlots(e.target.value)} type="number" className="w-24" />
                  </div>
                )}
              </div>
            </>
          )}

          {/* Connectivity */}
          <p className="text-sm font-semibold text-muted-foreground">Connectivity</p>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2"><Switch checked={hasUsb} onCheckedChange={setHasUsb} size="sm" /><Label>USB</Label></div>
            <div className="flex items-center gap-2"><Switch checked={hasBle} onCheckedChange={setHasBle} size="sm" /><Label>BLE</Label></div>
            <div className="flex items-center gap-2"><Switch checked={hasWifi} onCheckedChange={setHasWifi} size="sm" /><Label>WiFi</Label></div>
            <div className="flex items-center gap-2"><Switch checked={hasEthernet} onCheckedChange={setHasEthernet} size="sm" /><Label>Ethernet</Label></div>
            <div className="flex items-center gap-2"><Switch checked={hasMqtt} onCheckedChange={setHasMqtt} size="sm" /><Label>MQTT</Label></div>
          </div>

          {/* Protocol */}
          <p className="text-sm font-semibold text-muted-foreground">Protocol</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Protocol</Label>
              <Input value={protocol} onChange={(e) => setProtocol(e.target.value)} placeholder="e.g. esc_pos, gcode, marlin" />
            </div>
            {hasBle && (
              <>
                <div className="space-y-1.5">
                  <Label>BLE Service UUID</Label>
                  <Input value={bleServiceUuid} onChange={(e) => setBleServiceUuid(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>BLE Write Char UUID</Label>
                  <Input value={bleWriteCharUuid} onChange={(e) => setBleWriteCharUuid(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>BLE Notify Char UUID</Label>
                  <Input value={bleNotifyCharUuid} onChange={(e) => setBleNotifyCharUuid(e.target.value)} />
                </div>
              </>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={!manufacturer || !model || saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
