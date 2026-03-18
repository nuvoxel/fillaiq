"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Autocomplete from "@mui/material/Autocomplete";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
import ScaleIcon from "@mui/icons-material/Scale";
import HeightIcon from "@mui/icons-material/Height";
import NfcIcon from "@mui/icons-material/Nfc";
import PaletteIcon from "@mui/icons-material/Palette";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import DeleteIcon from "@mui/icons-material/Delete";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import SendIcon from "@mui/icons-material/Send";

type SessionData = {
  session: any;
  events: any[];
  matchedProduct: any;
};

type Brand = { id: string; name: string; slug: string };
type Material = { id: string; name: string; abbreviation: string | null };

export default function ScanEnrichmentPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [data, setData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enrichment form state
  const [brands, setBrands] = useState<Brand[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [colorName, setColorName] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/scan/session/${sessionId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Session not found");
        return;
      }
      const result: SessionData = await res.json();
      setData(result);

      // Pre-fill from existing enrichment data
      const parsed = result.session.nfcParsedData as Record<string, any> | null;
      if (parsed?.photoUrl) setPhotoUrl(parsed.photoUrl);
      if (parsed?.userColorName) setColorName(parsed.userColorName);
      if (parsed?.userNotes) setNotes(parsed.userNotes);
    } catch {
      setError("Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  const fetchCatalog = useCallback(async () => {
    try {
      const [brandsRes, materialsRes] = await Promise.all([
        fetch("/api/v1/catalog/brands"),
        fetch("/api/v1/catalog/materials"),
      ]);
      if (brandsRes.ok) {
        const b = await brandsRes.json();
        setBrands(Array.isArray(b) ? b : b.data ?? []);
      }
      if (materialsRes.ok) {
        const m = await materialsRes.json();
        setMaterials(Array.isArray(m) ? m : m.data ?? []);
      }
    } catch {
      // Non-critical — dropdowns will be empty
    }
  }, []);

  useEffect(() => {
    fetchSession();
    fetchCatalog();
  }, [fetchSession, fetchCatalog]);

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/upload?category=scans", {
        method: "POST",
        body: formData,
      });
      const result = await res.json();
      if (!res.ok) {
        setError(result.error || "Upload failed");
        return;
      }
      setPhotoUrl(result.url);
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/v1/scan/session/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photoUrl,
          brandId: selectedBrand?.id ?? null,
          materialId: selectedMaterial?.id ?? null,
          colorName: colorName || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Failed to submit");
        return;
      }
      setSubmitted(true);
      fetchSession();
    } catch {
      setError("Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: 2 }}>
        <Box sx={{ maxWidth: 480, mx: "auto" }}>
          <Skeleton variant="rounded" height={64} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" height={200} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" height={300} />
        </Box>
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          bgcolor: "background.default",
          p: 2,
        }}
      >
        <Card sx={{ maxWidth: 400, width: "100%" }}>
          <CardContent sx={{ textAlign: "center", py: 4 }}>
            <HelpOutlineIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
            <Typography variant="h6" gutterBottom>
              Session Not Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {error}
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!data) return null;

  const { session, events, matchedProduct } = data;
  const parsed = session.nfcParsedData as Record<string, any> | null;
  const isIdentified = !!session.matchedProductId;

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", pb: 4 }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: isIdentified ? "success.main" : "primary.main",
          color: "white",
          px: 2,
          py: 2.5,
        }}
      >
        <Box sx={{ maxWidth: 480, mx: "auto" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                bgcolor: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Typography variant="body1" fontWeight={700}>
                F
              </Typography>
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                FillaScan
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                {isIdentified ? "Item Identified" : "Help identify this item"}
              </Typography>
            </Box>
            {isIdentified ? (
              <CheckCircleIcon sx={{ fontSize: 28 }} />
            ) : (
              <HelpOutlineIcon sx={{ fontSize: 28 }} />
            )}
          </Box>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 480, mx: "auto", px: 2, mt: 2 }}>
        {/* Identified product card */}
        {isIdentified && matchedProduct && (
          <Card sx={{ mb: 2, border: 2, borderColor: "success.main" }}>
            <CardContent>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <CheckCircleIcon color="success" sx={{ fontSize: 20 }} />
                <Typography variant="subtitle2" color="success.main">
                  Matched Product
                </Typography>
                {session.matchConfidence != null && (
                  <Chip
                    label={`${Math.round(session.matchConfidence * 100)}%`}
                    size="small"
                    color="success"
                    variant="outlined"
                    sx={{ ml: "auto" }}
                  />
                )}
              </Box>
              <Typography variant="h6" fontWeight={600}>
                {matchedProduct.name}
              </Typography>
              <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                {matchedProduct.brandName && (
                  <Chip label={matchedProduct.brandName} size="small" />
                )}
                {matchedProduct.materialAbbreviation && (
                  <Chip label={matchedProduct.materialAbbreviation} size="small" variant="outlined" />
                )}
                {matchedProduct.colorName && (
                  <Chip
                    label={matchedProduct.colorName}
                    size="small"
                    variant="outlined"
                    icon={
                      <Box
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          bgcolor: matchedProduct.colorHex || "#ccc",
                          flexShrink: 0,
                        }}
                      />
                    }
                  />
                )}
              </Stack>
              {session.matchMethod && (
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                  Matched via {session.matchMethod}
                </Typography>
              )}
            </CardContent>
          </Card>
        )}

        {/* Scan data card */}
        <Card sx={{ mb: 2 }}>
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
              Scan Data
            </Typography>
            <Stack spacing={1.5}>
              {/* Weight */}
              {session.bestWeightG != null && (
                <DataRow
                  icon={<ScaleIcon sx={{ fontSize: 20, color: "info.main" }} />}
                  label="Weight"
                  value={`${session.bestWeightG.toFixed(1)} g`}
                />
              )}

              {/* Height */}
              {session.bestHeightMm != null && (
                <DataRow
                  icon={<HeightIcon sx={{ fontSize: 20, color: "warning.main" }} />}
                  label="Height"
                  value={`${session.bestHeightMm.toFixed(1)} mm`}
                />
              )}

              {/* Color */}
              {session.bestColorHex && (
                <DataRow
                  icon={<PaletteIcon sx={{ fontSize: 20, color: "secondary.main" }} />}
                  label="Color"
                  value={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: 1,
                          bgcolor: session.bestColorHex,
                          border: 1,
                          borderColor: "divider",
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" fontFamily="monospace">
                        {session.bestColorHex}
                      </Typography>
                    </Box>
                  }
                />
              )}

              {/* NFC */}
              {session.nfcUid && (
                <DataRow
                  icon={<NfcIcon sx={{ fontSize: 20, color: "primary.main" }} />}
                  label="NFC Tag"
                  value={
                    <Box>
                      <Typography variant="body2">
                        {session.nfcTagFormat
                          ? session.nfcTagFormat.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                          : "Detected"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" fontFamily="monospace">
                        {session.nfcUid}
                      </Typography>
                    </Box>
                  }
                />
              )}

              {/* NFC parsed details */}
              {parsed?.material && (
                <DataRow
                  icon={<ThermostatIcon sx={{ fontSize: 20, color: "error.main" }} />}
                  label="Material"
                  value={
                    <Box>
                      <Typography variant="body2">{parsed.material}</Typography>
                      {(parsed.nozzleTempMin || parsed.nozzleTempMax) && (
                        <Typography variant="caption" color="text.secondary">
                          Nozzle: {parsed.nozzleTempMin}–{parsed.nozzleTempMax}°C
                          {parsed.bedTemp ? ` | Bed: ${parsed.bedTemp}°C` : ""}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              )}

              {/* Parsed color from NFC */}
              {parsed?.colorHex && !session.bestColorHex && (
                <DataRow
                  icon={<PaletteIcon sx={{ fontSize: 20, color: "secondary.main" }} />}
                  label="NFC Color"
                  value={
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: 1,
                          bgcolor: parsed.colorHex,
                          border: 1,
                          borderColor: "divider",
                          flexShrink: 0,
                        }}
                      />
                      <Typography variant="body2" fontFamily="monospace">
                        {parsed.colorHex}
                      </Typography>
                    </Box>
                  }
                />
              )}

              {/* Timestamp */}
              <DataRow
                icon={<Box sx={{ width: 20, textAlign: "center", color: "text.disabled", fontSize: 14 }}>&#x1F4C5;</Box>}
                label="Scanned"
                value={new Date(session.createdAt).toLocaleString()}
              />
            </Stack>
          </CardContent>
        </Card>

        {/* Enrichment form */}
        {!isIdentified && (
          <Card sx={{ mb: 2 }}>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Help Identify This Item
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Upload a photo of the label or select the brand and material to help identify this item.
              </Typography>

              {submitted && (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Enrichment data submitted. Thank you!
                </Alert>
              )}

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Stack spacing={2.5}>
                {/* Photo upload */}
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
                    Photo of label / spool
                  </Typography>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handlePhotoUpload(file);
                      e.target.value = "";
                    }}
                  />
                  {photoUrl ? (
                    <Box sx={{ position: "relative", display: "inline-block" }}>
                      <Box
                        component="img"
                        src={photoUrl}
                        alt="Uploaded photo"
                        sx={{
                          width: "100%",
                          maxHeight: 200,
                          objectFit: "contain",
                          borderRadius: 2,
                          border: 1,
                          borderColor: "divider",
                          bgcolor: "grey.50",
                        }}
                      />
                      <IconButton
                        size="small"
                        sx={{
                          position: "absolute",
                          top: 4,
                          right: 4,
                          bgcolor: "background.paper",
                          boxShadow: 1,
                          "&:hover": { bgcolor: "error.light", color: "white" },
                        }}
                        onClick={() => setPhotoUrl(null)}
                      >
                        <DeleteIcon sx={{ fontSize: 16 }} />
                      </IconButton>
                    </Box>
                  ) : (
                    <Button
                      variant="outlined"
                      fullWidth
                      startIcon={uploading ? <CircularProgress size={18} /> : <CameraAltIcon />}
                      disabled={uploading}
                      onClick={() => fileInputRef.current?.click()}
                      sx={{
                        height: 80,
                        borderStyle: "dashed",
                        textTransform: "none",
                      }}
                    >
                      {uploading ? "Uploading..." : "Take Photo or Choose File"}
                    </Button>
                  )}
                </Box>

                {/* Brand selection */}
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

                {/* Material selection */}
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

                {/* Color name */}
                <TextField
                  label="Color Name"
                  size="small"
                  fullWidth
                  value={colorName}
                  onChange={(e) => setColorName(e.target.value)}
                  placeholder="e.g., Galaxy Black, Sunrise Orange"
                />

                {/* Notes */}
                <TextField
                  label="Notes"
                  size="small"
                  fullWidth
                  multiline
                  minRows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any additional details..."
                />

                {/* Submit */}
                <Button
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={submitting || (!photoUrl && !selectedBrand && !selectedMaterial && !colorName && !notes)}
                  onClick={handleSubmit}
                  endIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
                  sx={{ textTransform: "none" }}
                >
                  {submitting ? "Submitting..." : "Submit"}
                </Button>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Scan events detail (collapsible-style) */}
        {events.length > 0 && (
          <Card>
            <CardContent>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Scan Events ({events.length})
              </Typography>
              <Stack spacing={1} divider={<Divider />}>
                {events.map((evt: any) => (
                  <Box key={evt.id}>
                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Typography variant="caption" color="text.secondary">
                        {new Date(evt.createdAt).toLocaleTimeString()}
                      </Typography>
                      <Stack direction="row" spacing={0.5}>
                        {evt.weightG != null && (
                          <Chip label={`${evt.weightG.toFixed(1)}g`} size="small" variant="outlined" />
                        )}
                        {evt.colorHex && (
                          <Chip
                            size="small"
                            variant="outlined"
                            label={evt.colorHex}
                            icon={
                              <Box
                                sx={{
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  bgcolor: evt.colorHex,
                                  flexShrink: 0,
                                }}
                              />
                            }
                          />
                        )}
                        {evt.nfcPresent && <Chip label="NFC" size="small" color="primary" variant="outlined" />}
                        {evt.heightMm != null && (
                          <Chip label={`${evt.heightMm.toFixed(0)}mm`} size="small" variant="outlined" />
                        )}
                      </Stack>
                    </Box>
                  </Box>
                ))}
              </Stack>
            </CardContent>
          </Card>
        )}
      </Box>
    </Box>
  );
}

/** Small reusable row for scan data display */
function DataRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
      <Box sx={{ mt: 0.25 }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
        {typeof value === "string" ? (
          <Typography variant="body2">{value}</Typography>
        ) : (
          value
        )}
      </Box>
    </Box>
  );
}
