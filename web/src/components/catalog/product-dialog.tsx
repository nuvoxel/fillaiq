"use client";

import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
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
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load brands and materials for autocomplete
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
      // Set brand/material after brands and materials are loaded
      if (e.brandId) {
        setSelectedBrand({ id: e.brandId, name: "" }); // Will be resolved when brands load
      } else {
        setSelectedBrand(null);
      }
      if (e.materialId) {
        setSelectedMaterial({ id: e.materialId, name: "", abbreviation: null });
      } else {
        setSelectedMaterial(null);
      }
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
      setSelectedBrand(null);
      setSelectedMaterial(null);
    }
    setError(null);
  }, [open, existing]);

  // Resolve brand/material names after data loads
  useEffect(() => {
    if (selectedBrand && !selectedBrand.name && brands.length > 0) {
      const found = brands.find((b) => b.id === selectedBrand.id);
      if (found) setSelectedBrand(found);
    }
  }, [brands, selectedBrand]);

  useEffect(() => {
    if (selectedMaterial && !selectedMaterial.name && materials.length > 0) {
      const found = materials.find((m) => m.id === selectedMaterial.id);
      if (found) setSelectedMaterial(found);
    }
  }, [materials, selectedMaterial]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      name,
      category,
      description: description || null,
      imageUrl: imageUrl || null,
      brandId: selectedBrand?.id ?? null,
      materialId: selectedMaterial?.id ?? null,
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
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{existing ? "Edit Product" : "Add Product"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Box sx={{ display: "flex", gap: 2 }}>
            <ImageUpload
              value={imageUrl}
              onChange={setImageUrl}
              category="products"
              label="Image"
              width={80}
              height={80}
            />
            <Grid container spacing={2} sx={{ flex: 1 }}>
              <Grid size={{ xs: 12 }}>
                <TextField
                  label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  size="small"
                  fullWidth
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  size="small"
                  fullWidth
                >
                  {categoryOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
                <TextField
                  select
                  label="Validation Status"
                  value={validationStatus}
                  onChange={(e) => setValidationStatus(e.target.value)}
                  size="small"
                  fullWidth
                >
                  {validationStatusOptions.map((o) => (
                    <MenuItem key={o.value} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>
              </Grid>
            </Grid>
          </Box>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete
                options={brands}
                getOptionLabel={(opt) => opt.name}
                value={selectedBrand}
                onChange={(_, val) => setSelectedBrand(val)}
                renderInput={(params) => (
                  <TextField {...params} label="Brand" size="small" />
                )}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Autocomplete
                options={materials}
                getOptionLabel={(opt) =>
                  opt.abbreviation ? `${opt.name} (${opt.abbreviation})` : opt.name
                }
                value={selectedMaterial}
                onChange={(_, val) => setSelectedMaterial(val)}
                renderInput={(params) => (
                  <TextField {...params} label="Material" size="small" />
                )}
                isOptionEqualToValue={(opt, val) => opt.id === val.id}
              />
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Color Name"
                value={colorName}
                onChange={(e) => setColorName(e.target.value)}
                size="small"
                fullWidth
                placeholder="e.g., Galaxy Black"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                <TextField
                  label="Color Hex"
                  value={colorHex}
                  onChange={(e) => setColorHex(e.target.value)}
                  size="small"
                  fullWidth
                  placeholder="#FF5733"
                />
                {colorHex && /^#[0-9A-Fa-f]{6,8}$/.test(colorHex) && (
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 1,
                      bgcolor: colorHex,
                      border: 1,
                      borderColor: "divider",
                      flexShrink: 0,
                    }}
                  />
                )}
              </Box>
            </Grid>
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Net Weight (g)"
                value={netWeightG}
                onChange={(e) => setNetWeightG(e.target.value)}
                type="number"
                size="small"
                fullWidth
                slotProps={{ htmlInput: { min: 0, step: 0.1 } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="GTIN / Barcode"
                value={gtin}
                onChange={(e) => setGtin(e.target.value)}
                size="small"
                fullWidth
                placeholder="e.g., 0123456789012"
                slotProps={{ htmlInput: { maxLength: 14 } }}
              />
            </Grid>
          </Grid>

          <TextField
            label="Description / Notes"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            size="small"
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name || saving}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
