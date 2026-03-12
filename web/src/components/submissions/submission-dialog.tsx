"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { createCatalogSubmission } from "@/lib/actions/submissions";
import { listProducts } from "@/lib/actions/central-catalog";

// ── Types ───────────────────────────────────────────────────────────────────

type SubmissionType = "new_filament" | "new_variant" | "correction" | "equivalence";

type ProductOption = { id: string; label: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const submissionTypes: { value: SubmissionType; label: string; description: string }[] = [
  { value: "new_filament", label: "New Filament", description: "Submit a filament product not yet in the catalog" },
  { value: "new_variant", label: "New Variant", description: "Submit a new color/size variant of an existing product" },
  { value: "correction", label: "Correction", description: "Correct information on an existing product" },
  { value: "equivalence", label: "Equivalence", description: "Link two products as equivalent (rebrand, alias, etc.)" },
];

// ── Product Search Autocomplete ─────────────────────────────────────────────

function ProductSearch({
  label,
  value,
  onChange,
  helperText,
}: {
  label: string;
  value: ProductOption | null;
  onChange: (opt: ProductOption | null) => void;
  helperText?: string;
}) {
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const result = await listProducts({ search: query, limit: 20 });
      if (result.data) {
        setOptions(
          result.data.map((p) => ({
            id: p.id,
            label: p.name,
          }))
        );
      }
      setLoading(false);
    }, 300);
  }, []);

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(_, newVal) => onChange(newVal)}
      inputValue={inputValue}
      onInputChange={(_, newInput) => {
        setInputValue(newInput);
        search(newInput);
      }}
      isOptionEqualToValue={(opt, val) => opt.id === val.id}
      getOptionLabel={(opt) => opt.label}
      loading={loading}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          size="small"
          helperText={helperText}
          slotProps={{
            input: {
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading ? <CircularProgress size={18} /> : null}
                  {params.InputProps.endAdornment}
                </>
              ),
            },
          }}
        />
      )}
    />
  );
}

// ── Main Dialog ─────────────────────────────────────────────────────────────

export function SubmissionDialog({ open, onClose, onSaved }: Props) {
  const [type, setType] = useState<SubmissionType>("new_filament");

  // New filament / new variant fields
  const [brandName, setBrandName] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [productName, setProductName] = useState("");
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [netWeightG, setNetWeightG] = useState("");

  // New variant: base product
  const [baseProduct, setBaseProduct] = useState<ProductOption | null>(null);

  // Correction fields
  const [correctionProduct, setCorrectionProduct] = useState<ProductOption | null>(null);
  const [correctionField, setCorrectionField] = useState("");
  const [correctionValue, setCorrectionValue] = useState("");

  // Equivalence fields
  const [sourceBarcode, setSourceBarcode] = useState("");
  const [equivalenceProduct, setEquivalenceProduct] = useState<ProductOption | null>(null);

  // Shared
  const [notes, setNotes] = useState("");

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setType("new_filament");
    setBrandName("");
    setMaterialName("");
    setProductName("");
    setColorName("");
    setColorHex("");
    setNetWeightG("");
    setBaseProduct(null);
    setCorrectionProduct(null);
    setCorrectionField("");
    setCorrectionValue("");
    setSourceBarcode("");
    setEquivalenceProduct(null);
    setNotes("");
    setError(null);
  }, [open]);

  const handleSave = async () => {
    setError(null);

    // Build payload and validate based on type
    let payload: Record<string, unknown> = {};
    let targetTable: string | null = null;
    let targetId: string | null = null;

    if (type === "new_filament") {
      if (!brandName.trim() || !productName.trim()) {
        setError("Brand name and product name are required.");
        return;
      }
      payload = {
        brandName: brandName.trim(),
        materialName: materialName.trim() || null,
        productName: productName.trim(),
        colorName: colorName.trim() || null,
        colorHex: colorHex.trim() || null,
        netWeightG: netWeightG ? Number(netWeightG) : null,
      };
    } else if (type === "new_variant") {
      if (!baseProduct) {
        setError("Please select a base product.");
        return;
      }
      if (!colorName.trim() && !productName.trim()) {
        setError("Please provide at least a color name or product name for the variant.");
        return;
      }
      targetTable = "products";
      targetId = baseProduct.id;
      payload = {
        baseProductId: baseProduct.id,
        baseProductName: baseProduct.label,
        productName: productName.trim() || null,
        colorName: colorName.trim() || null,
        colorHex: colorHex.trim() || null,
        netWeightG: netWeightG ? Number(netWeightG) : null,
      };
    } else if (type === "correction") {
      if (!correctionProduct) {
        setError("Please select the product to correct.");
        return;
      }
      if (!correctionField.trim() || !correctionValue.trim()) {
        setError("Please specify the field and corrected value.");
        return;
      }
      targetTable = "products";
      targetId = correctionProduct.id;
      payload = {
        productId: correctionProduct.id,
        productName: correctionProduct.label,
        field: correctionField.trim(),
        correctedValue: correctionValue.trim(),
      };
    } else if (type === "equivalence") {
      if (!equivalenceProduct) {
        setError("Please select the target product.");
        return;
      }
      if (!sourceBarcode.trim()) {
        setError("Please enter the source barcode.");
        return;
      }
      targetTable = "products";
      targetId = equivalenceProduct.id;
      payload = {
        sourceBarcode: sourceBarcode.trim(),
        targetProductId: equivalenceProduct.id,
        targetProductName: equivalenceProduct.label,
      };
    }

    if (notes.trim()) {
      payload.notes = notes.trim();
    }

    setSaving(true);
    const result = await createCatalogSubmission({
      type,
      payload,
      targetTable,
      targetId,
    });
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
      <DialogTitle>New Submission</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* ── Submission Type ──────────────────────────────────── */}
          <TextField
            select
            label="Submission Type"
            value={type}
            onChange={(e) => setType(e.target.value as SubmissionType)}
            size="small"
            fullWidth
          >
            {submissionTypes.map((t) => (
              <MenuItem key={t.value} value={t.value}>
                {t.label}
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="body2" color="text.secondary">
            {submissionTypes.find((t) => t.value === type)?.description}
          </Typography>

          {/* ── New Filament Fields ──────────────────────────────── */}
          {type === "new_filament" && (
            <>
              <Typography variant="subtitle2" color="text.secondary">Product Details</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Brand Name"
                    value={brandName}
                    onChange={(e) => setBrandName(e.target.value)}
                    size="small"
                    fullWidth
                    required
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Material (e.g. PLA, PETG)"
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Product Name"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    size="small"
                    fullWidth
                    required
                    helperText="Full product name as shown on packaging"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Color Name"
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label="Color Hex"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="#FF0000"
                    inputProps={{ maxLength: 9 }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  {colorHex && /^#[0-9a-fA-F]{6}$/.test(colorHex) && (
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: colorHex,
                        border: 1,
                        borderColor: "divider",
                        mt: 0.5,
                      }}
                    />
                  )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Net Weight (g)"
                    value={netWeightG}
                    onChange={(e) => setNetWeightG(e.target.value)}
                    type="number"
                    size="small"
                    fullWidth
                  />
                </Grid>
              </Grid>
            </>
          )}

          {/* ── New Variant Fields ──────────────────────────────── */}
          {type === "new_variant" && (
            <>
              <Typography variant="subtitle2" color="text.secondary">Base Product</Typography>
              <ProductSearch
                label="Search existing product"
                value={baseProduct}
                onChange={setBaseProduct}
                helperText="The product this variant is based on"
              />
              <Typography variant="subtitle2" color="text.secondary">Variant Details</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    label="Variant Product Name"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                    size="small"
                    fullWidth
                    helperText="Leave blank to inherit from base product"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Color Name"
                    value={colorName}
                    onChange={(e) => setColorName(e.target.value)}
                    size="small"
                    fullWidth
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  <TextField
                    label="Color Hex"
                    value={colorHex}
                    onChange={(e) => setColorHex(e.target.value)}
                    size="small"
                    fullWidth
                    placeholder="#FF0000"
                    inputProps={{ maxLength: 9 }}
                  />
                </Grid>
                <Grid size={{ xs: 6, sm: 3 }}>
                  {colorHex && /^#[0-9a-fA-F]{6}$/.test(colorHex) && (
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 1,
                        bgcolor: colorHex,
                        border: 1,
                        borderColor: "divider",
                        mt: 0.5,
                      }}
                    />
                  )}
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Net Weight (g)"
                    value={netWeightG}
                    onChange={(e) => setNetWeightG(e.target.value)}
                    type="number"
                    size="small"
                    fullWidth
                  />
                </Grid>
              </Grid>
            </>
          )}

          {/* ── Correction Fields ───────────────────────────────── */}
          {type === "correction" && (
            <>
              <Typography variant="subtitle2" color="text.secondary">Product to Correct</Typography>
              <ProductSearch
                label="Search product"
                value={correctionProduct}
                onChange={setCorrectionProduct}
              />
              <Typography variant="subtitle2" color="text.secondary">Correction</Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    select
                    label="Field to Correct"
                    value={correctionField}
                    onChange={(e) => setCorrectionField(e.target.value)}
                    size="small"
                    fullWidth
                    required
                  >
                    <MenuItem value="name">Product Name</MenuItem>
                    <MenuItem value="colorName">Color Name</MenuItem>
                    <MenuItem value="colorHex">Color Hex</MenuItem>
                    <MenuItem value="netWeightG">Net Weight (g)</MenuItem>
                    <MenuItem value="materialName">Material</MenuItem>
                    <MenuItem value="brandName">Brand Name</MenuItem>
                    <MenuItem value="gtin">GTIN / Barcode</MenuItem>
                    <MenuItem value="other">Other</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="Corrected Value"
                    value={correctionValue}
                    onChange={(e) => setCorrectionValue(e.target.value)}
                    size="small"
                    fullWidth
                    required
                  />
                </Grid>
              </Grid>
            </>
          )}

          {/* ── Equivalence Fields ──────────────────────────────── */}
          {type === "equivalence" && (
            <>
              <Typography variant="subtitle2" color="text.secondary">Source</Typography>
              <TextField
                label="Source Barcode"
                value={sourceBarcode}
                onChange={(e) => setSourceBarcode(e.target.value)}
                size="small"
                fullWidth
                required
                helperText="Barcode of the unrecognized or alias product"
              />
              <Typography variant="subtitle2" color="text.secondary">Target Product</Typography>
              <ProductSearch
                label="Search target product"
                value={equivalenceProduct}
                onChange={setEquivalenceProduct}
                helperText="The existing catalog product this barcode should map to"
              />
            </>
          )}

          {/* ── Notes (always shown) ────────────────────────────── */}
          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={3}
            helperText="Optional additional context for reviewers"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
          {saving ? "Submitting..." : "Submit"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
