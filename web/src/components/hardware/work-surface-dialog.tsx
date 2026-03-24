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
import { createMachineWorkSurface, updateMachineWorkSurface } from "@/lib/actions/user-library";
import { enumToOptions, workSurfaceTypeLabels, wearLevelLabels } from "./enum-labels";

const typeOptions = enumToOptions(workSurfaceTypeLabels);
const conditionOptions = enumToOptions(wearLevelLabels);

type WorkSurface = {
  id: string;
  machineId: string;
  name: string;
  type: string;
  isInstalled: boolean;
  surfaceCondition: string;
  notes: string | null;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  machineId: string;
  existing?: WorkSurface | null;
};

export function WorkSurfaceDialog({ open, onClose, onSaved, machineId, existing }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState("textured_pei");
  const [isInstalled, setIsInstalled] = useState(false);
  const [surfaceCondition, setSurfaceCondition] = useState("new");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setType(existing.type);
      setIsInstalled(existing.isInstalled);
      setSurfaceCondition(existing.surfaceCondition);
      setNotes(existing.notes ?? "");
    } else {
      setName("");
      setType("textured_pei");
      setIsInstalled(false);
      setSurfaceCondition("new");
      setNotes("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const payload = {
      machineId,
      name,
      type,
      isInstalled,
      surfaceCondition,
      notes: notes || null,
    };
    const result = existing
      ? await updateMachineWorkSurface(existing.id, payload)
      : await createMachineWorkSurface(payload);
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
          <DialogTitle>{existing ? "Edit Work Surface" : "Add Work Surface"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Type *</Label>
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
          <div className="flex items-center gap-2">
            <Switch checked={isInstalled} onCheckedChange={setIsInstalled} />
            <Label>Installed</Label>
          </div>
          <div className="space-y-1.5">
            <Label>Condition</Label>
            <Select value={surfaceCondition} onValueChange={(v) => v && setSurfaceCondition(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {conditionOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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
