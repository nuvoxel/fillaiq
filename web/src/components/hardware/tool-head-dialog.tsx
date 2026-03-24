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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Tool Head" : "Add Tool Head"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label>Category *</Label>
            <Select value={toolCategory} onValueChange={(v) => v && setToolCategory(v)}>
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
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          {toolCategory === "nozzle" && (
            <>
              <div className="space-y-1.5">
                <Label>Diameter (mm)</Label>
                <Input value={diameterMm} onChange={(e) => setDiameterMm(e.target.value)} type="number" />
              </div>
              <div className="space-y-1.5">
                <Label>Material</Label>
                <Select value={nozzleMaterial || "_none"} onValueChange={(v) => v && setNozzleMaterial(v === "_none" ? "" : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">&mdash;</SelectItem>
                    {nozzleMaterialOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Nozzle Type</Label>
                <Select value={nozzleType || "_none"} onValueChange={(v) => v && setNozzleType(v === "_none" ? "" : v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_none">&mdash;</SelectItem>
                    {nozzleTypeOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {toolCategory === "spindle_bit" && (
            <>
              <div className="space-y-1.5">
                <Label>Bit Diameter (mm)</Label>
                <Input value={bitDiameterMm} onChange={(e) => setBitDiameterMm(e.target.value)} type="number" />
              </div>
              <div className="space-y-1.5">
                <Label>Bit Type</Label>
                <Input value={bitType} onChange={(e) => setBitType(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Flute Count</Label>
                <Input value={fluteCount} onChange={(e) => setFluteCount(e.target.value)} type="number" />
              </div>
              <div className="space-y-1.5">
                <Label>Bit Material</Label>
                <Input value={bitMaterial} onChange={(e) => setBitMaterial(e.target.value)} />
              </div>
            </>
          )}

          {toolCategory === "laser_module" && (
            <>
              <div className="space-y-1.5">
                <Label>Power (W)</Label>
                <Input value={laserPowerW} onChange={(e) => setLaserPowerW(e.target.value)} type="number" />
              </div>
              <div className="space-y-1.5">
                <Label>Wavelength (nm)</Label>
                <Input value={laserWavelengthNm} onChange={(e) => setLaserWavelengthNm(e.target.value)} type="number" />
              </div>
              <div className="space-y-1.5">
                <Label>Focal Length (mm)</Label>
                <Input value={focalLengthMm} onChange={(e) => setFocalLengthMm(e.target.value)} type="number" />
              </div>
            </>
          )}

          <div className="flex items-center gap-2">
            <Switch checked={isInstalled} onCheckedChange={setIsInstalled} />
            <Label>Installed</Label>
          </div>
          <div className="space-y-1.5">
            <Label>Wear Level</Label>
            <Select value={wearLevel} onValueChange={(v) => v && setWearLevel(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {wearOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Install Count</Label>
            <Input value={installCount} onChange={(e) => setInstallCount(e.target.value)} type="number" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
