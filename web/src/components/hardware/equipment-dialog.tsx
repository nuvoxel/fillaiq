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
import { createEquipment, updateEquipment } from "@/lib/actions/user-library";
import { enumToOptions, equipmentTypeLabels } from "./enum-labels";

const typeOptions = enumToOptions(equipmentTypeLabels);

type Equipment = {
  id: string;
  type: string;
  name: string;
  manufacturer: string | null;
  model: string | null;
  capacity: number | null;
  maxTemp: number | null;
  hasHumidityControl: boolean | null;
  notes: string | null;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Equipment | null;
};

export function EquipmentDialog({ open, onClose, onSaved, existing }: Props) {
  const [type, setType] = useState("drybox");
  const [name, setName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [capacity, setCapacity] = useState("");
  const [maxTemp, setMaxTemp] = useState("");
  const [hasHumidityControl, setHasHumidityControl] = useState(false);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setType(existing.type);
      setName(existing.name);
      setManufacturer(existing.manufacturer ?? "");
      setModel(existing.model ?? "");
      setCapacity(existing.capacity != null ? String(existing.capacity) : "");
      setMaxTemp(existing.maxTemp != null ? String(existing.maxTemp) : "");
      setHasHumidityControl(existing.hasHumidityControl ?? false);
      setNotes(existing.notes ?? "");
    } else {
      setType("drybox");
      setName("");
      setManufacturer("");
      setModel("");
      setCapacity("");
      setMaxTemp("");
      setHasHumidityControl(false);
      setNotes("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const payload: Record<string, unknown> = {
      type,
      name,
      manufacturer: manufacturer || null,
      model: model || null,
      capacity: capacity ? Number(capacity) : null,
      notes: notes || null,
    };
    if (type === "drybox") {
      payload.maxTemp = maxTemp ? Number(maxTemp) : null;
      payload.hasHumidityControl = hasHumidityControl;
    }
    const result = existing
      ? await updateEquipment(existing.id, payload)
      : await createEquipment(payload);
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
          <DialogTitle>{existing ? "Edit Equipment" : "Add Equipment"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => v && setType(v)}>
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
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Manufacturer</Label>
            <Input value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Model</Label>
            <Input value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Capacity (spools)</Label>
            <Input value={capacity} onChange={(e) => setCapacity(e.target.value)} type="number" />
          </div>
          {type === "drybox" && (
            <>
              <div className="space-y-1.5">
                <Label>Max Temp (°C)</Label>
                <Input value={maxTemp} onChange={(e) => setMaxTemp(e.target.value)} type="number" />
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={hasHumidityControl} onCheckedChange={setHasHumidityControl} />
                <Label>Humidity Control</Label>
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
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
