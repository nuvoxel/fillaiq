"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { createProduct, updateProduct, listBrands, listMaterials } from "@/lib/actions/central-catalog";
import { ImageUpload } from "@/components/image-upload";

const validationStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "validated", label: "Validated" },
  { value: "deprecated", label: "Deprecated" },
];

const categoryOptions = [
  { value: "filament", label: "Filament" },
  { value: "resin", label: "Resin" },
  { value: "cnc_stock", label: "CNC Stock" },
  { value: "laser_stock", label: "Laser Stock" },
  { value: "consumable", label: "Consumable" },
  { value: "other", label: "Other" },
];

type Brand = { id: string; name: string };
type Material = { id: string; name: string; abbreviation: string | null };

type Product = {
  id: string;
  name: string;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Product | null;
};

export function ProductDialog({ open, onClose, onSaved, existing }: Props) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("filament");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [netWeightG, setNetWeightG] = useState("");
  const [validationStatus, setValidationStatus] = useState("draft");
  const [gtin, setGtin] = useState("");

  const [brands, setBrands] = useState<Brand[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>("_none");
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>("_none");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load brands and materials
  useEffect(() => {
    if (!open) return;
    (async () => {
      const [brandsResult, materialsResult] = await Promise.all([
        listBrands(),
        listMaterials(),
      ]);
      if (brandsResult.data) setBrands(brandsResult.data);
      if (materialsResult.data) setMaterials(materialsResult.data);
    })();
  }, [open]);

  // Pre-fill form when editing
  useEffect(() => {
    if (!open) return;
    if (existing) {
      const e = existing as Record<string, any>;
      setName(e.name ?? "");
      setCategory(e.category ?? "filament");
      setDescription(e.description ?? "");
      setImageUrl(e.imageUrl ?? null);
      setColorName(e.colorName ?? "");
      setColorHex(e.colorHex ?? "");
      setNetWeightG(e.netWeightG != null ? String(e.netWeightG) : "");
      setValidationStatus(e.validationStatus ?? "draft");
      setGtin(e.gtin ?? "");
      setSelectedBrandId(e.brandId ?? "_none");
      setSelectedMaterialId(e.materialId ?? "_none");
    } else {
      setName("");
      setCategory("filament");
      setDescription("");
      setImageUrl(null);
      setColorName("");
      setColorHex("");
      setNetWeightG("");
      setValidationStatus("draft");
      setGtin("");
      setSelectedBrandId("_none");
      setSelectedMaterialId("_none");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      name,
      category,
      description: description || null,
      imageUrl: imageUrl || null,
      brandId: selectedBrandId === "_none" ? null : selectedBrandId,
      materialId: selectedMaterialId === "_none" ? null : selectedMaterialId,
      colorName: colorName || null,
      colorHex: colorHex || null,
      netWeightG: netWeightG ? parseFloat(netWeightG) : null,
      validationStatus,
      gtin: gtin || null,
    };

    const result = existing
      ? await updateProduct(existing.id, payload)
      : await createProduct(payload);
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
          <DialogTitle>{existing ? "Edit Product" : "Add Product"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              category="products"
              label="Image"
              width={80}
              height={80}
            />
            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="sm:col-span-2">
                <label className="text-xs font-medium block mb-1">Name *</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Category</label>
                <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium block mb-1">Validation Status</label>
                <Select value={validationStatus} onValueChange={(v) => v && setValidationStatus(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {validationStatusOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium block mb-1">Brand</label>
              <Select value={selectedBrandId} onValueChange={(v) => v && setSelectedBrandId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select brand..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">\u2014 None</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Material</label>
              <Select value={selectedMaterialId} onValueChange={(v) => v && setSelectedMaterialId(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select material..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">\u2014 None</SelectItem>
                  {materials.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.abbreviation ? `${m.name} (${m.abbreviation})` : m.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium block mb-1">Color Name</label>
              <Input
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
                placeholder="e.g., Galaxy Black"
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">Color Hex</label>
              <div className="flex gap-1 items-start">
                <Input
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  placeholder="#00D2FF"
                  className="flex-1"
                />
                {colorHex && /^#[0-9A-Fa-f]{6,8}$/.test(colorHex) && (
                  <div
                    className="w-8 h-8 rounded border border-border shrink-0"
                    style={{ backgroundColor: colorHex }}
                  />
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-medium block mb-1">Net Weight (g)</label>
              <Input
                value={netWeightG}
                onChange={(e) => setNetWeightG(e.target.value)}
                type="number"
                min={0}
                step={0.1}
              />
            </div>
            <div>
              <label className="text-xs font-medium block mb-1">GTIN / Barcode</label>
              <Input
                value={gtin}
                onChange={(e) => setGtin(e.target.value)}
                placeholder="e.g., 0123456789012"
                maxLength={14}
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium block mb-1">Description / Notes</label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
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
