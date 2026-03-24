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
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createMachineMaterialSlot, updateMachineMaterialSlot } from "@/lib/actions/user-library";
import { enumToOptions, changerTypeLabels } from "./enum-labels";

const changerOptions = enumToOptions(changerTypeLabels);

type MaterialSlot = {
  id: string;
  machineId: string;
  changerType: string;
  unitNumber: number;
  slotPosition: number;
  userItemId: string | null;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  machineId: string;
  existing?: MaterialSlot | null;
};

export function MaterialSlotDialog({ open, onClose, onSaved, machineId, existing }: Props) {
  const [changerType, setChangerType] = useState("ams");
  const [unitNumber, setUnitNumber] = useState("1");
  const [slotPosition, setSlotPosition] = useState("1");
  const [userItemId, setUserItemId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setChangerType(existing.changerType);
      setUnitNumber(String(existing.unitNumber));
      setSlotPosition(String(existing.slotPosition));
      setUserItemId(existing.userItemId ?? "");
    } else {
      setChangerType("ams");
      setUnitNumber("1");
      setSlotPosition("1");
      setUserItemId("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    const payload = {
      machineId,
      changerType,
      unitNumber: Number(unitNumber),
      slotPosition: Number(slotPosition),
      userItemId: userItemId || null,
    };
    const result = existing
      ? await updateMachineMaterialSlot(existing.id, payload)
      : await createMachineMaterialSlot(payload);
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
          <DialogTitle>{existing ? "Edit Material Slot" : "Add Material Slot"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label>Changer Type *</Label>
            <Select value={changerType} onValueChange={(v) => v && setChangerType(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {changerOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-3">
            <div className="flex-1 space-y-1.5">
              <Label>Unit Number *</Label>
              <Input value={unitNumber} onChange={(e) => setUnitNumber(e.target.value)} type="number" />
            </div>
            <div className="flex-1 space-y-1.5">
              <Label>Slot Position *</Label>
              <Input value={slotPosition} onChange={(e) => setSlotPosition(e.target.value)} type="number" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>User Item ID (optional)</Label>
            <Input value={userItemId} onChange={(e) => setUserItemId(e.target.value)} />
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
