"use client";

import { useState, useEffect, useCallback } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import IconButton from "@mui/material/IconButton";
import Stack from "@mui/material/Stack";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import {
  listSkusByProduct,
  createSkuMapping,
  removeSkuMapping,
} from "@/lib/actions/central-catalog";

// ── Types ──────────────────────────────────────────────────────────────────────

type SkuRow = {
  id: string;
  productId: string;
  sku: string | null;
  barcode: string | null;
  barcodeFormat: string | null;
  gtin: string | null;
  packQuantity: number | null;
  retailer: string | null;
  productUrl: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
};

// ── Component ──────────────────────────────────────────────────────────────────

type Props = {
  productId: string;
};

export function SkuMappingManager({ productId }: Props) {
  const [mappings, setMappings] = useState<SkuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listSkusByProduct(productId);
    if (result.error !== null) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setMappings(result.data as SkuRow[]);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const handleDelete = async (id: string) => {
    const result = await removeSkuMapping(id);
    if (result.error !== null) {
      setError(result.error);
    } else {
      setConfirmDeleteId(null);
      loadMappings();
    }
  };

  const formatPrice = (amount: number | null, currency: string | null) => {
    if (amount == null) return "-";
    return `${currency ?? "USD"} ${amount.toFixed(2)}`;
  };

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
        <Typography variant="subtitle1" fontWeight={600}>
          SKU / Barcode Mappings
        </Typography>
        <Button
          size="small"
          startIcon={<AddIcon />}
          onClick={() => setDialogOpen(true)}
        >
          Add Mapping
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
      ) : mappings.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 2 }}>
          No SKU mappings defined for this product.
        </Typography>
      ) : (
        <TableContainer>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>SKU</TableCell>
                <TableCell>Barcode</TableCell>
                <TableCell>GTIN</TableCell>
                <TableCell>Retailer</TableCell>
                <TableCell align="right">Price</TableCell>
                <TableCell align="center">Pack Qty</TableCell>
                <TableCell align="right" />
              </TableRow>
            </TableHead>
            <TableBody>
              {mappings.map((mapping) => (
                <TableRow key={mapping.id}>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {mapping.sku || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Stack>
                      <Typography variant="body2" fontFamily="monospace">
                        {mapping.barcode || "-"}
                      </Typography>
                      {mapping.barcodeFormat && (
                        <Typography variant="caption" color="text.secondary">
                          {mapping.barcodeFormat}
                        </Typography>
                      )}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" fontFamily="monospace">
                      {mapping.gtin || "-"}
                    </Typography>
                  </TableCell>
                  <TableCell>{mapping.retailer || "-"}</TableCell>
                  <TableCell align="right">
                    {formatPrice(mapping.priceAmount, mapping.priceCurrency)}
                  </TableCell>
                  <TableCell align="center">{mapping.packQuantity ?? 1}</TableCell>
                  <TableCell align="right">
                    {confirmDeleteId === mapping.id ? (
                      <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                        <Button
                          size="small"
                          color="error"
                          onClick={() => handleDelete(mapping.id)}
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
                        onClick={() => setConfirmDeleteId(mapping.id)}
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

      <AddSkuMappingDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        productId={productId}
        onSaved={loadMappings}
      />
    </Box>
  );
}

// ── Add SKU Mapping Dialog ─────────────────────────────────────────────────────

function AddSkuMappingDialog({
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
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [barcodeFormat, setBarcodeFormat] = useState("");
  const [gtin, setGtin] = useState("");
  const [retailer, setRetailer] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [packQuantity, setPackQuantity] = useState("1");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset form on open
  useEffect(() => {
    if (open) {
      setSku("");
      setBarcode("");
      setBarcodeFormat("");
      setGtin("");
      setRetailer("");
      setProductUrl("");
      setPriceAmount("");
      setPriceCurrency("USD");
      setPackQuantity("1");
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!sku && !barcode && !gtin) {
      setError("At least one of SKU, barcode, or GTIN is required");
      return;
    }
    setError(null);
    setSaving(true);
    const result = await createSkuMapping({
      productId,
      sku: sku || null,
      barcode: barcode || null,
      barcodeFormat: barcodeFormat || null,
      gtin: gtin || null,
      retailer: retailer || null,
      productUrl: productUrl || null,
      priceAmount: priceAmount ? Number(priceAmount) : null,
      priceCurrency: priceCurrency || null,
      packQuantity: packQuantity ? Number(packQuantity) : 1,
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
      <DialogTitle>Add SKU / Barcode Mapping</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <TextField
            label="SKU"
            value={sku}
            onChange={(e) => setSku(e.target.value)}
            size="small"
            fullWidth
            helperText="Retailer or manufacturer SKU code"
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                label="Barcode"
                value={barcode}
                onChange={(e) => setBarcode(e.target.value)}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Format"
                value={barcodeFormat}
                onChange={(e) => setBarcodeFormat(e.target.value)}
                size="small"
                fullWidth
                helperText="e.g. EAN-13, UPC-A"
              />
            </Grid>
          </Grid>

          <TextField
            label="GTIN"
            value={gtin}
            onChange={(e) => setGtin(e.target.value)}
            size="small"
            fullWidth
            inputProps={{ maxLength: 14 }}
            helperText="Global Trade Item Number (8, 12, 13, or 14 digits)"
          />

          <TextField
            label="Retailer"
            value={retailer}
            onChange={(e) => setRetailer(e.target.value)}
            size="small"
            fullWidth
            helperText="e.g. Amazon, MicroCenter, Prusa Store"
          />

          <TextField
            label="Product URL"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            size="small"
            fullWidth
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Price"
                value={priceAmount}
                onChange={(e) => setPriceAmount(e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 3 }}>
              <TextField
                label="Currency"
                value={priceCurrency}
                onChange={(e) => setPriceCurrency(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ maxLength: 3 }}
              />
            </Grid>
            <Grid size={{ xs: 3 }}>
              <TextField
                label="Pack Qty"
                value={packQuantity}
                onChange={(e) => setPackQuantity(e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={saving}
        >
          {saving ? "Saving..." : "Add Mapping"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
