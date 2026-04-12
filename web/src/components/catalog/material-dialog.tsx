"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createMaterial, updateMaterial } from "@/lib/actions/central-catalog";
import { materialClassLabels } from "@/lib/labels";

const materialClassOptions = [
  { value: "_none", label: "\u2014" },
  ...Object.entries(materialClassLabels).map(([value, label]) => ({ value, label })),
];

type Material = {
  id: string;
  name: string;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Material | null;
};

export function MaterialDialog({ open, onClose, onSaved, existing }: Props) {
  const [name, setName] = useState("");
  const [abbreviation, setAbbreviation] = useState("");
  const [category, setCategory] = useState("");
  const [materialClass, setMaterialClass] = useState("_none");
  const [density, setDensity] = useState("");
  const [hygroscopic, setHygroscopic] = useState(false);
  const [defaultDryingTemp, setDefaultDryingTemp] = useState("");
  const [defaultDryingTimeMin, setDefaultDryingTimeMin] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      const e = existing as Record<string, any>;
      setName(e.name ?? "");
      setAbbreviation(e.abbreviation ?? "");
      setCategory(e.category ?? "");
      setMaterialClass(e.materialClass || "_none");
      setDensity(e.density != null ? String(e.density) : "");
      setHygroscopic(e.hygroscopic ?? false);
      setDefaultDryingTemp(
        e.defaultDryingTemp != null ? String(e.defaultDryingTemp) : ""
      );
      setDefaultDryingTimeMin(
        e.defaultDryingTimeMin != null ? String(e.defaultDryingTimeMin) : ""
      );
    } else {
      setName("");
      setAbbreviation("");
      setCategory("");
      setMaterialClass("_none");
      setDensity("");
      setHygroscopic(false);
      setDefaultDryingTemp("");
      setDefaultDryingTimeMin("");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      name,
      abbreviation: abbreviation || null,
      category: category || null,
      materialClass: materialClass === "_none" ? null : materialClass,
      density: density ? Number(density) : null,
      hygroscopic,
      defaultDryingTemp: defaultDryingTemp ? Number(defaultDryingTemp) : null,
      defaultDryingTimeMin: defaultDryingTimeMin
        ? Number(defaultDryingTimeMin)
        : null,
    };

    const result = existing
      ? await updateMaterial(existing.id, payload)
      : await createMaterial(payload);
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
          <DialogTitle>
            {existing ? "Edit Material" : "Add Material"}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium block mb-1">Name *</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Abbreviation</label>
              <Input
                value={abbreviation}
                onChange={(e) => setAbbreviation(e.target.value)}
              />
              <p className="text-[0.625rem] text-muted-foreground mt-0.5">e.g. PLA, PETG, ABS</p>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Category</label>
              <Input
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              />
              <p className="text-[0.625rem] text-muted-foreground mt-0.5">e.g. thermoplastic, thermoset, composite</p>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Material Class</label>
              <Select value={materialClass} onValueChange={(v) => v && setMaterialClass(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {materialClassOptions.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-xs font-medium block mb-1">Density (g/cm\u00B3)</label>
              <Input
                value={density}
                onChange={(e) => setDensity(e.target.value)}
                type="number"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Drying Temp (\u00B0C)</label>
              <Input
                value={defaultDryingTemp}
                onChange={(e) => setDefaultDryingTemp(e.target.value)}
                type="number"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Drying Time (min)</label>
              <Input
                value={defaultDryingTimeMin}
                onChange={(e) => setDefaultDryingTimeMin(e.target.value)}
                type="number"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              checked={hygroscopic}
              onCheckedChange={setHygroscopic}
            />
            <label className="text-sm">Hygroscopic</label>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
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
