"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Alert from "@mui/material/Alert";
import Autocomplete from "@mui/material/Autocomplete";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Checkbox from "@mui/material/Checkbox";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import FormControlLabel from "@mui/material/FormControlLabel";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Slider from "@mui/material/Slider";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SyncAltIcon from "@mui/icons-material/SyncAlt";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import {
  listAliasesForProduct,
  createProductAlias,
  removeProductAlias,
  listProducts,
  listBrands,
  getProductById,
} from "@/lib/actions/central-catalog";

// ── Types ──────────────────────────────────────────────────────────────────────

type ProductOption = { id: string; name: string; brandName: string };

type AliasRow = {
  id: string;
  productId: string;
  relatedProductId: string;
  aliasType: string;
  confidence: number | null;
  bidirectional: boolean | null;
  source: string | null;
  notes: string | null;
  createdAt: Date;
};

const ALIAS_TYPE_LABELS: Record<string, string> = {
  oem_rebrand: "OEM / Rebrand",
  sku_variant: "SKU Variant",
  substitute: "Substitute",
  color_match: "Color Match",
};

const ALIAS_TYPE_COLORS: Record<string, "primary" | "secondary" | "success" | "warning"> = {
  oem_rebrand: "primary",
  sku_variant: "secondary",
  substitute: "warning",
  color_match: "success",
};

// ── Component ──────────────────────────────────────────────────────────────────

type Props = {
  productId: string;
};

export function AliasManager({ productId }: Props) {
  const [aliases, setAliases] = useState<(AliasRow & { linkedProductName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadAliases = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listAliasesForProduct(productId);
    if (result.error !== null) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // For each alias, determine the "other" product and resolve its name
    const enriched = await Promise.all(
      result.data.map(async (alias) => {
        const linkedId =
          alias.productId === productId ? alias.relatedProductId : alias.productId;
        const prodResult = await getProductById(linkedId);
        const linkedProductName =
          prodResult.error === null ? prodResult.data.name : "(unknown)";
        return { ...alias, linkedProductName } as AliasRow & { linkedProductName: string };
      })
    );
    setAliases(enriched);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    loadAliases();
  }, [loadAliases]);

  const handleDelete = async (id: string) => {
    const result = await removeProductAlias(id);
    if (result.error !== null) {
      setError(result.error);
    } else {
      setConfirmDeleteId(null);
      loadAliases();
    }
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          Product Aliases
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add Alias
        </Button>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 1 }}>
          {error}
        </Alert>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
          <CircularProgress size={24} />
        </Box>
      ) : aliases.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          No aliases defined for this product.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Linked Product</TableCell>
                <TableCell>Type</TableCell>
                <TableCell align="center">Direction</TableCell>
                <TableCell align="right">Confidence</TableCell>
                <TableCell>Notes</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {aliases.map((alias) => (
                <TableRow key={alias.id}>
                  <TableCell>{alias.linkedProductName}</TableCell>
                  <TableCell>
                    <Chip
                      label={ALIAS_TYPE_LABELS[alias.aliasType] ?? alias.aliasType}
                      color={ALIAS_TYPE_COLORS[alias.aliasType] ?? "default"}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title={alias.bidirectional ? "Bidirectional" : "One-way"}>
                      {alias.bidirectional ? (
                        <SyncAltIcon fontSize="small" color="action" />
                      ) : (
                        <ArrowForwardIcon fontSize="small" color="action" />
                      )}
                    </Tooltip>
                  </TableCell>
                  <TableCell align="right">
                    {alias.confidence != null
                      ? `${Math.round(alias.confidence * 100)}%`
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 200 }}>
                      {alias.notes || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    {confirmDeleteId === alias.id ? (
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleDelete(alias.id)}
                        >
                          Confirm
                        </Button>
                        <Button
                          size="small"
                          onClick={() => setConfirmDeleteId(null)}
                        >
                          Cancel
                        </Button>
                      </Stack>
                    ) : (
                      <IconButton
                        size="small"
                        onClick={() => setConfirmDeleteId(alias.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <AddAliasDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        productId={productId}
        onSaved={loadAliases}
      />
    </Box>
  );
}

// ── Add Alias Dialog ───────────────────────────────────────────────────────────

function AddAliasDialog({
  open,
  onClose,
  productId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  onSaved: () => void;
}) {
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productLoading, setProductLoading] = useState(false);

  const [aliasType, setAliasType] = useState("substitute");
  const [confidence, setConfidence] = useState(100);
  const [bidirectional, setBidirectional] = useState(true);
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch product options when search changes (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setProductLoading(true);
      try {
        const [prodResult, brandResult] = await Promise.all([
          listProducts({ search: productSearch, limit: 20 }),
          listBrands({ limit: 500 }),
        ]);
        if (prodResult.error === null && brandResult.error === null) {
          const brandMap = new Map(
            brandResult.data.map((b) => [b.id, b.name])
          );
          setProductOptions(
            prodResult.data
              .filter((p) => p.id !== productId) // exclude self
              .map((p) => ({
                id: p.id,
                name: p.name,
                brandName: (p.brandId && brandMap.get(p.brandId)) || "Unknown",
              }))
          );
        }
      } finally {
        setProductLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [productSearch, productId]);

  // Reset form on open
  useEffect(() => {
    if (open) {
      setSelectedProduct(null);
      setProductSearch("");
      setAliasType("substitute");
      setConfidence(100);
      setBidirectional(true);
      setNotes("");
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!selectedProduct) {
      setError("Please select a product");
      return;
    }
    setError(null);
    setSaving(true);
    const result = await createProductAlias({
      productId,
      relatedProductId: selectedProduct.id,
      aliasType,
      confidence: confidence / 100,
      bidirectional,
      notes: notes || null,
    });
    setSaving(false);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Add Product Alias</DialogTitle>
      <DialogContent>
        <Stack spacing={2.5} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Autocomplete
            options={productOptions}
            getOptionLabel={(opt) => `${opt.brandName} - ${opt.name}`}
            filterOptions={(x) => x}
            value={selectedProduct}
            onChange={(_e, newValue) => setSelectedProduct(newValue)}
            inputValue={productSearch}
            onInputChange={(_e, newInput) => setProductSearch(newInput)}
            isOptionEqualToValue={(opt, val) => opt.id === val.id}
            loading={productLoading}
            size="small"
            fullWidth
            renderInput={(params) => (
              <TextField
                {...params}
                label="Linked Product"
                required
                slotProps={{
                  input: {
                    ...params.InputProps,
                    endAdornment: (
                      <>
                        {productLoading ? (
                          <CircularProgress color="inherit" size={18} />
                        ) : null}
                        {params.InputProps.endAdornment}
                      </>
                    ),
                  },
                }}
              />
            )}
          />

          <TextField
            select
            label="Alias Type"
            value={aliasType}
            onChange={(e) => setAliasType(e.target.value)}
            size="small"
            fullWidth
          >
            <MenuItem value="oem_rebrand">OEM / Rebrand</MenuItem>
            <MenuItem value="sku_variant">SKU Variant</MenuItem>
            <MenuItem value="substitute">Substitute</MenuItem>
            <MenuItem value="color_match">Color Match</MenuItem>
          </TextField>

          <Box>
            <Typography variant="body2" gutterBottom>
              Confidence: {confidence}%
            </Typography>
            <Slider
              value={confidence}
              onChange={(_e, val) => setConfidence(val as number)}
              min={0}
              max={100}
              step={1}
              valueLabelDisplay="auto"
              size="small"
            />
          </Box>

          <FormControlLabel
            control={
              <Checkbox
                checked={bidirectional}
                onChange={(e) => setBidirectional(e.target.checked)}
                size="small"
              />
            }
            label="Bidirectional (A is alias of B and B is alias of A)"
          />

          <TextField
            label="Notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            size="small"
            fullWidth
            multiline
            rows={2}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving || !selectedProduct}
        >
          {saving ? "Saving..." : "Add Alias"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
