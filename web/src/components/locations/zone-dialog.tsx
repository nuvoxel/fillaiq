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
import { createZone, updateZone } from "@/lib/actions/hardware";

const zoneTypeLabels: Record<string, string> = {
  workshop: "Workshop",
  storage: "Storage",
  printer_area: "Printer Area",
  drying: "Drying",
  other: "Other",
};

const zoneTypeOptions = Object.entries(zoneTypeLabels).map(([value, label]) => ({
  value,
  label,
}));

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: {
    id: string;
    name: string;
    type: string;
    description: string | null;
    nfcTagId: string | null;
  } | null;
};

export function ZoneDialog({ open, onClose, onSaved, existing }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState("workshop");
  const [description, setDescription] = useState("");
  const [nfcTagId, setNfcTagId] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setType(existing.type);
      setDescription(existing.description ?? "");
      setNfcTagId(existing.nfcTagId ?? "");
    } else {
      setName("");
      setType("workshop");
      setDescription("");
      setNfcTagId("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const payload = {
      name,
      type,
      description: description || null,
      nfcTagId: nfcTagId || null,
    };

    const result = existing
      ? await updateZone(existing.id, payload)
      : await createZone(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Zone" : "Add Zone"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-12 gap-3">
            <div className="col-span-12 sm:col-span-6">
              <Label>Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="col-span-12 sm:col-span-6">
              <Label>Type</Label>
              <Select value={type} onValueChange={(v) => { if (v) setType(v); }}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {zoneTypeOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-12">
              <Label>Description</Label>
              <textarea
                className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 min-h-[60px]"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="col-span-12">
              <Label>NFC Tag ID</Label>
              <Input
                value={nfcTagId}
                onChange={(e) => setNfcTagId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">Optional NFC tag identifier for this zone</p>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!name || saving}
          >
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
