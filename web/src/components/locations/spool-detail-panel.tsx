"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Rating from "@mui/material/Rating";
import Skeleton from "@mui/material/Skeleton";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import CloseIcon from "@mui/icons-material/Close";
import ScaleIcon from "@mui/icons-material/Scale";
import NfcIcon from "@mui/icons-material/Nfc";
import PrintIcon from "@mui/icons-material/Print";
import { getUserItemWithRelations, updateUserItem } from "@/lib/actions/user-library";

type Props = {
  itemId: string;
  onClose: () => void;
  onUpdate?: () => void;
};

export function SpoolDetailPanel({ itemId, onClose, onUpdate }: Props) {
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [weight, setWeight] = useState("");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setItem(null);
    (async () => {
      try {
        const result = await getUserItemWithRelations(itemId);
        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          setItem(result.data);
          setNotes(result.data.notes ?? "");
          setRating(result.data.rating);
          setWeight(result.data.currentWeightG?.toFixed(1) ?? "");
        }
      } catch (e) {
        setError((e as Error).message);
      }
      setLoading(false);
    })();
  }, [itemId]);

  const handleSave = async () => {
    setSaving(true);
    await updateUserItem(itemId, {
      notes: notes || null,
      rating,
      currentWeightG: weight ? parseFloat(weight) : null,
    });
    setSaving(false);
    onUpdate?.();
  };

  if (loading) {
    return (
      <Card variant="outlined" sx={{ mt: 1.5 }}>
        <CardContent>
          <Skeleton variant="rounded" height={120} />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card variant="outlined" sx={{ borderColor: "error.main" }}>
        <CardContent>
          <Typography color="error" variant="body2">Error: {error}</Typography>
          <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
        </CardContent>
      </Card>
    );
  }

  if (!item) return null;

  const product = item.product;
  const brand = product?.brand;
  const material = product?.material;
  const slot = item.currentSlot;
  const pct = item.percentRemaining;

  return (
    <Card variant="outlined" sx={{ borderColor: "primary.main", borderWidth: 2, position: "sticky", top: 80 }}>
      <CardContent sx={{ pb: "12px !important" }}>
        {/* Header */}
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, mb: 1.5 }}>
          {/* Color swatch */}
          <Box sx={{
            width: 48, height: 48, borderRadius: 2, flexShrink: 0,
            bgcolor: item.measuredColorHex ?? "#888",
            boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)",
          }} />
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="subtitle1" fontWeight={700} noWrap>
              {product?.name ?? "Unknown Item"}
            </Typography>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 0.25 }}>
              {brand && <Chip label={brand.name} size="small" variant="outlined" />}
              {material && <Chip label={material.abbreviation ?? material.name} size="small" variant="outlined" />}
              {item.packageType && <Chip label={item.packageType} size="small" variant="outlined" sx={{ textTransform: "capitalize" }} />}
              {item.nfcUid && <Chip icon={<NfcIcon sx={{ fontSize: "14px !important" }} />} label="NFC" size="small" variant="outlined" color="primary" />}
            </Box>
          </Box>
          <IconButton size="small" onClick={onClose} sx={{ mt: -0.5, mr: -0.5 }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Progress bar */}
        {pct != null && (
          <Box sx={{ mb: 1.5 }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
              <Typography variant="caption" color="text.secondary">Remaining</Typography>
              <Typography variant="caption" fontWeight={600}>{pct}%</Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={pct}
              sx={{
                height: 6, borderRadius: 3,
                bgcolor: "grey.200",
                "& .MuiLinearProgress-bar": {
                  bgcolor: pct > 50 ? "success.main" : pct > 25 ? "warning.main" : "error.main",
                  borderRadius: 3,
                },
              }}
            />
          </Box>
        )}

        {/* Stats row */}
        <Grid container spacing={2} sx={{ mb: 1.5 }}>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">Weight</Typography>
            <Typography variant="body2" fontWeight={600}>
              {item.currentWeightG ? `${Math.round(item.currentWeightG)}g` : "—"}
            </Typography>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">Initial</Typography>
            <Typography variant="body2" fontWeight={600}>
              {item.initialWeightG ? `${Math.round(item.initialWeightG)}g` : "—"}
            </Typography>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">Height</Typography>
            <Typography variant="body2" fontWeight={600}>
              {item.measuredHeightMm ? `${Math.round(item.measuredHeightMm)}mm` : "—"}
            </Typography>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">Color</Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              {item.measuredColorHex && (
                <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: item.measuredColorHex, border: 1, borderColor: "divider" }} />
              )}
              <Typography variant="body2" fontFamily="monospace" fontSize="0.75rem">
                {item.measuredColorHex ?? "—"}
              </Typography>
            </Box>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">Location</Typography>
            <Typography variant="body2" fontWeight={600}>
              {slot?.address ?? slot?.label ?? "Unassigned"}
            </Typography>
          </Grid>
          <Grid size={{ xs: 4 }}>
            <Typography variant="caption" color="text.secondary">Purchased</Typography>
            <Typography variant="body2">
              {item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString() : "—"}
            </Typography>
          </Grid>
        </Grid>

        <Divider sx={{ mb: 1.5 }} />

        {/* Editable fields */}
        <Grid container spacing={1.5} sx={{ mb: 1 }}>
          <Grid size={{ xs: 4 }}>
            <TextField fullWidth size="small" label="Weight (g)" type="number"
              value={weight} onChange={(e) => setWeight(e.target.value)}
            />
          </Grid>
          <Grid size={{ xs: 8 }}>
            <TextField fullWidth size="small" label="Notes"
              value={notes} onChange={(e) => setNotes(e.target.value)}
            />
          </Grid>
        </Grid>

        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
            <Typography variant="caption" color="text.secondary">Rating</Typography>
            <Rating value={rating} onChange={(_, v) => setRating(v)} size="small" />
          </Box>
          <Button size="small" variant="contained" onClick={handleSave} disabled={saving}
            sx={{ textTransform: "none" }}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </Box>
      </CardContent>
    </Card>
  );
}
