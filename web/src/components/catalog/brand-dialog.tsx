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
import Box from "@mui/material/Box";
import { createBrand, updateBrand } from "@/lib/actions/central-catalog";
import { ImageUpload } from "@/components/image-upload";

const validationStatusOptions = [
  { value: "draft", label: "Draft" },
  { value: "submitted", label: "Submitted" },
  { value: "validated", label: "Validated" },
  { value: "deprecated", label: "Deprecated" },
];

type Brand = {
  id: string;
  name: string;
  slug: string;
  [key: string]: unknown;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: Brand | null;
};

export function BrandDialog({ open, onClose, onSaved, existing }: Props) {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [website, setWebsite] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [countryOfOrigin, setCountryOfOrigin] = useState("");
  const [validationStatus, setValidationStatus] = useState("draft");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Auto-generate slug from name
  useEffect(() => {
    if (!existing) {
      const s = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+$/, "")
        .replace(/^-+/, "");
      setSlug(s);
    }
  }, [name, existing]);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      const e = existing as Record<string, any>;
      setName(e.name ?? "");
      setSlug(e.slug ?? "");
      setWebsite(e.website ?? "");
      setLogoUrl(e.logoUrl ?? null);
      setCountryOfOrigin(e.countryOfOrigin ?? "");
      setValidationStatus(e.validationStatus ?? "draft");
    } else {
      setName("");
      setSlug("");
      setWebsite("");
      setLogoUrl(null);
      setCountryOfOrigin("");
      setValidationStatus("draft");
    }
    setError(null);
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      name,
      slug,
      website: website || null,
      logoUrl: logoUrl || null,
      countryOfOrigin: countryOfOrigin || null,
      validationStatus,
    };

    const result = existing
      ? await updateBrand(existing.id, payload)
      : await createBrand(payload);
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
      <DialogTitle>{existing ? "Edit Brand" : "Add Brand"}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}

          <Box sx={{ display: "flex", gap: 2 }}>
            <ImageUpload
              value={logoUrl}
              onChange={setLogoUrl}
              category="brands"
              label="Logo"
              width={80}
              height={80}
              circular
            />
            <Grid container spacing={2} sx={{ flex: 1 }}>
              <Grid size={{ xs: 12, sm: 6 }}>
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
                label="Slug"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                size="small"
                fullWidth
                helperText="Auto-generated URL identifier"
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                label="Website"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                size="small"
                fullWidth
                placeholder="https://example.com"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                label="Country of Origin"
                value={countryOfOrigin}
                onChange={(e) => setCountryOfOrigin(e.target.value)}
                size="small"
                fullWidth
                helperText="2-letter country code (e.g. US, CN)"
                inputProps={{ maxLength: 2 }}
              />
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
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={handleSave}
          variant="contained"
          disabled={!name || !slug || saving}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
