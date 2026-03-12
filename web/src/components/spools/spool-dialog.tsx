"use client";

import { useState, useEffect } from "react";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Grid from "@mui/material/Grid";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { createUserItem, updateUserItem } from "@/lib/actions/user-library";
import { SlotPicker } from "@/components/scan/slot-picker";

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: { id: string; [key: string]: unknown } | null;
};

function toStr(val: unknown): string {
  return val != null ? String(val) : "";
}

function toDateStr(val: unknown): string {
  if (!val) return "";
  const d = new Date(val as string | number | Date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function SpoolDialog({ open, onClose, onSaved, existing }: Props) {
  // Identity
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState("active");

  // Weight
  const [initialWeightG, setInitialWeightG] = useState("");
  const [currentWeightG, setCurrentWeightG] = useState("");
  const [netFilamentWeightG, setNetFilamentWeightG] = useState("");
  const [spoolWeightG, setSpoolWeightG] = useState("");

  // Cost
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState("USD");

  // Lifecycle
  const [purchasedAt, setPurchasedAt] = useState("");
  const [openedAt, setOpenedAt] = useState("");
  const [productionDate, setProductionDate] = useState("");

  // Provenance
  const [lotNumber, setLotNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Location
  const [storageLocation, setStorageLocation] = useState("");
  const [currentSlotId, setCurrentSlotId] = useState<string | null>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      const e = existing as Record<string, any>;
      setProductId(toStr(e.productId));
      setStatus(e.status ?? "active");
      setInitialWeightG(toStr(e.initialWeightG));
      setCurrentWeightG(toStr(e.currentWeightG));
      setNetFilamentWeightG(toStr(e.netFilamentWeightG));
      setSpoolWeightG(toStr(e.spoolWeightG));
      setPurchasePrice(toStr(e.purchasePrice));
      setPurchaseCurrency(e.purchaseCurrency ?? "USD");
      setPurchasedAt(toDateStr(e.purchasedAt));
      setOpenedAt(toDateStr(e.openedAt));
      setProductionDate(e.productionDate ?? "");
      setLotNumber(e.lotNumber ?? "");
      setSerialNumber(e.serialNumber ?? "");
      setNotes(e.notes ?? "");
      setStorageLocation(e.storageLocation ?? "");
      setCurrentSlotId(e.currentSlotId ?? null);
    } else {
      setProductId("");
      setStatus("active");
      setInitialWeightG("");
      setCurrentWeightG("");
      setNetFilamentWeightG("");
      setSpoolWeightG("");
      setPurchasePrice("");
      setPurchaseCurrency("USD");
      setPurchasedAt("");
      setOpenedAt("");
      setProductionDate("");
      setLotNumber("");
      setSerialNumber("");
      setNotes("");
      setStorageLocation("");
      setCurrentSlotId(null);
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      status,
      productId: productId || null,
      initialWeightG: initialWeightG ? Number(initialWeightG) : null,
      currentWeightG: currentWeightG ? Number(currentWeightG) : null,
      netFilamentWeightG: netFilamentWeightG ? Number(netFilamentWeightG) : null,
      spoolWeightG: spoolWeightG ? Number(spoolWeightG) : null,
      purchasePrice: purchasePrice ? Number(purchasePrice) : null,
      purchaseCurrency: purchaseCurrency || null,
      purchasedAt: purchasedAt ? new Date(purchasedAt).toISOString() : null,
      openedAt: openedAt ? new Date(openedAt).toISOString() : null,
      productionDate: productionDate || null,
      lotNumber: lotNumber || null,
      serialNumber: serialNumber || null,
      notes: notes || null,
      storageLocation: storageLocation || null,
      currentSlotId: currentSlotId || null,
    };

    const result = existing
      ? await updateUserItem(existing.id, payload)
      : await createUserItem(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{existing ? "Edit Spool" : "Add Spool"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          {/* ── Identity ─────────────────────────────────────────── */}
          <Typography variant="subtitle2" color="text.secondary">Identity</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 8 }}>
              <TextField
                label="Product"
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                size="small"
                fullWidth
                helperText="Product UUID (product picker coming soon)"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                select
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                size="small"
                fullWidth
              >
                <MenuItem value="active">Active</MenuItem>
                <MenuItem value="empty">Empty</MenuItem>
                <MenuItem value="archived">Archived</MenuItem>
              </TextField>
            </Grid>
          </Grid>

          {/* ── Weight ───────────────────────────────────────────── */}
          <Typography variant="subtitle2" color="text.secondary">Weight</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Initial Weight (g)"
                value={initialWeightG}
                onChange={(e) => setInitialWeightG(e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Current Weight (g)"
                value={currentWeightG}
                onChange={(e) => setCurrentWeightG(e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Net Filament (g)"
                value={netFilamentWeightG}
                onChange={(e) => setNetFilamentWeightG(e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField
                label="Spool Weight (g)"
                value={spoolWeightG}
                onChange={(e) => setSpoolWeightG(e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
            </Grid>
          </Grid>

          {/* ── Cost ─────────────────────────────────────────────── */}
          <Typography variant="subtitle2" color="text.secondary">Cost</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Purchase Price"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                type="number"
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Currency"
                value={purchaseCurrency}
                onChange={(e) => setPurchaseCurrency(e.target.value)}
                size="small"
                fullWidth
                inputProps={{ maxLength: 3 }}
                helperText="3-letter code (e.g. USD)"
              />
            </Grid>
          </Grid>

          {/* ── Lifecycle ────────────────────────────────────────── */}
          <Typography variant="subtitle2" color="text.secondary">Lifecycle</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Purchased At"
                value={purchasedAt}
                onChange={(e) => setPurchasedAt(e.target.value)}
                type="date"
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Opened At"
                value={openedAt}
                onChange={(e) => setOpenedAt(e.target.value)}
                type="date"
                size="small"
                fullWidth
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Production Date"
                value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)}
                size="small"
                fullWidth
                helperText="Freetext (e.g. 2025-Q3)"
              />
            </Grid>
          </Grid>

          {/* ── Provenance ───────────────────────────────────────── */}
          <Typography variant="subtitle2" color="text.secondary">Provenance</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Lot Number"
                value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Serial Number"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                size="small"
                fullWidth
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                size="small"
                fullWidth
                multiline
                rows={3}
              />
            </Grid>
          </Grid>

          {/* ── Location ─────────────────────────────────────────── */}
          <Typography variant="subtitle2" color="text.secondary">Location</Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Storage Location"
                value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)}
                size="small"
                fullWidth
                helperText="Freetext location (e.g. Shelf A, Bin 3)"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Or assign to a specific slot:
              </Typography>
              <SlotPicker
                selectedSlotId={currentSlotId}
                onSelect={(slotId) => setCurrentSlotId(slotId)}
              />
            </Grid>
          </Grid>
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={handleSave} variant="contained" disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
