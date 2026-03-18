"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import TextField from "@mui/material/TextField";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import InputLabel from "@mui/material/InputLabel";
import FormControl from "@mui/material/FormControl";
import Typography from "@mui/material/Typography";
import Divider from "@mui/material/Divider";
import Stack from "@mui/material/Stack";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import Chip from "@mui/material/Chip";
import Alert from "@mui/material/Alert";
import Skeleton from "@mui/material/Skeleton";
import Grid from "@mui/material/Grid";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import SaveIcon from "@mui/icons-material/Save";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import LabelIcon from "@mui/icons-material/Label";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import {
  listLabelTemplates,
  createLabelTemplate,
  updateLabelTemplate,
  removeLabelTemplate,
  getLabelTemplateById,
} from "@/lib/actions/user-library";
import {
  LabelPreview,
  type LabelPreviewSettings,
} from "@/components/labels/label-preview";

// ── Types ────────────────────────────────────────────────────────────────────

type LabelFormat = "labelife_image" | "labelife_native" | "png" | "pdf";

type TemplateRow = {
  id: string;
  name: string;
  labelFormat: LabelFormat;
  widthMm: number | null;
  heightMm: number | null;
  isDefault: boolean | null;
  showBrand: boolean | null;
  showMaterial: boolean | null;
  showColor: boolean | null;
  showColorSwatch: boolean | null;
  showTemps: boolean | null;
  showQrCode: boolean | null;
  showWeight: boolean | null;
  showLocation: boolean | null;
  showPrice: boolean | null;
  showPurchaseDate: boolean | null;
  showLotNumber: boolean | null;
  qrCodeBaseUrl: string | null;
  customCss: string | null;
};

type EditorState = {
  name: string;
  labelFormat: LabelFormat;
  widthMm: number;
  heightMm: number;
  isDefault: boolean;
  showBrand: boolean;
  showMaterial: boolean;
  showColor: boolean;
  showColorSwatch: boolean;
  showTemps: boolean;
  showQrCode: boolean;
  showWeight: boolean;
  showLocation: boolean;
  showPrice: boolean;
  showPurchaseDate: boolean;
  showLotNumber: boolean;
  qrCodeBaseUrl: string;
};

const DEFAULT_STATE: EditorState = {
  name: "Untitled Template",
  labelFormat: "png",
  widthMm: 50,
  heightMm: 30,
  isDefault: false,
  showBrand: true,
  showMaterial: true,
  showColor: true,
  showColorSwatch: true,
  showTemps: true,
  showQrCode: true,
  showWeight: true,
  showLocation: false,
  showPrice: false,
  showPurchaseDate: false,
  showLotNumber: false,
  qrCodeBaseUrl: "app.fillaiq.com/item/",
};

const SIZE_PRESETS = [
  { label: "50 x 30 mm", w: 50, h: 30 },
  { label: "40 x 70 mm", w: 40, h: 70 },
  { label: "40 x 30 mm", w: 40, h: 30 },
  { label: "25 x 50 mm", w: 25, h: 50 },
];

const FORMAT_OPTIONS: { value: LabelFormat; label: string }[] = [
  { value: "labelife_image", label: "Labelife Image" },
  { value: "labelife_native", label: "Labelife Native" },
  { value: "png", label: "PNG" },
  { value: "pdf", label: "PDF" },
];

const CONTENT_TOGGLES: { key: keyof EditorState; label: string }[] = [
  { key: "showBrand", label: "Brand" },
  { key: "showMaterial", label: "Material" },
  { key: "showColor", label: "Color name" },
  { key: "showColorSwatch", label: "Color swatch" },
  { key: "showTemps", label: "Temperatures" },
  { key: "showWeight", label: "Weight" },
  { key: "showQrCode", label: "QR code" },
  { key: "showLocation", label: "Location" },
  { key: "showPrice", label: "Price" },
  { key: "showPurchaseDate", label: "Purchase date" },
  { key: "showLotNumber", label: "Lot number" },
];

function rowToEditor(row: TemplateRow): EditorState {
  return {
    name: row.name,
    labelFormat: row.labelFormat,
    widthMm: row.widthMm ?? 50,
    heightMm: row.heightMm ?? 30,
    isDefault: row.isDefault ?? false,
    showBrand: row.showBrand ?? true,
    showMaterial: row.showMaterial ?? true,
    showColor: row.showColor ?? true,
    showColorSwatch: row.showColorSwatch ?? true,
    showTemps: row.showTemps ?? true,
    showQrCode: row.showQrCode ?? true,
    showWeight: row.showWeight ?? true,
    showLocation: row.showLocation ?? false,
    showPrice: row.showPrice ?? false,
    showPurchaseDate: row.showPurchaseDate ?? false,
    showLotNumber: row.showLotNumber ?? false,
    qrCodeBaseUrl: row.qrCodeBaseUrl ?? "app.fillaiq.com/item/",
  };
}

function editorToPreview(state: EditorState): LabelPreviewSettings {
  return {
    widthMm: state.widthMm,
    heightMm: state.heightMm,
    showBrand: state.showBrand,
    showMaterial: state.showMaterial,
    showColor: state.showColor,
    showColorSwatch: state.showColorSwatch,
    showTemps: state.showTemps,
    showQrCode: state.showQrCode,
    showWeight: state.showWeight,
    showLocation: state.showLocation,
    showPrice: state.showPrice,
    showPurchaseDate: state.showPurchaseDate,
    showLotNumber: state.showLotNumber,
  };
}

// ── Component ────────────────────────────────────────────────────────────────

export function LabelDesigner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>(DEFAULT_STATE);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Load templates
  const loadTemplates = useCallback(async () => {
    const result = await listLabelTemplates();
    if (result.data) {
      setTemplates(result.data as TemplateRow[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Handle ?id= param
  useEffect(() => {
    const idParam = searchParams.get("id");
    if (idParam && templates.length > 0) {
      const found = templates.find((t) => t.id === idParam);
      if (found) {
        setSelectedId(found.id);
        setEditor(rowToEditor(found));
      }
    }
  }, [searchParams, templates]);

  const selectTemplate = (tmpl: TemplateRow) => {
    setSelectedId(tmpl.id);
    setEditor(rowToEditor(tmpl));
    setFeedback(null);
    router.replace(`/settings/labels?id=${tmpl.id}`, { scroll: false });
  };

  const startNew = () => {
    setSelectedId(null);
    setEditor({ ...DEFAULT_STATE });
    setFeedback(null);
    router.replace("/settings/labels", { scroll: false });
  };

  const updateField = <K extends keyof EditorState>(
    key: K,
    value: EditorState[K]
  ) => {
    setEditor((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const payload = {
        name: editor.name,
        labelFormat: editor.labelFormat,
        widthMm: editor.widthMm,
        heightMm: editor.heightMm,
        isDefault: editor.isDefault,
        showBrand: editor.showBrand,
        showMaterial: editor.showMaterial,
        showColor: editor.showColor,
        showColorSwatch: editor.showColorSwatch,
        showTemps: editor.showTemps,
        showQrCode: editor.showQrCode,
        showWeight: editor.showWeight,
        showLocation: editor.showLocation,
        showPrice: editor.showPrice,
        showPurchaseDate: editor.showPurchaseDate,
        showLotNumber: editor.showLotNumber,
        qrCodeBaseUrl: editor.qrCodeBaseUrl,
      };

      if (selectedId) {
        const result = await updateLabelTemplate(selectedId, payload);
        if (result.error) {
          setFeedback({ type: "error", message: result.error });
        } else {
          setFeedback({ type: "success", message: "Template saved." });
          await loadTemplates();
        }
      } else {
        const result = await createLabelTemplate(payload);
        if (result.error) {
          setFeedback({ type: "error", message: result.error });
        } else if (result.data) {
          setFeedback({ type: "success", message: "Template created." });
          await loadTemplates();
          const created = result.data as TemplateRow;
          setSelectedId(created.id);
          router.replace(`/settings/labels?id=${created.id}`, {
            scroll: false,
          });
        }
      }
    } catch {
      setFeedback({ type: "error", message: "An unexpected error occurred." });
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!selectedId) return;
    setSaving(true);
    const result = await removeLabelTemplate(selectedId);
    if (result.error) {
      setFeedback({ type: "error", message: result.error });
    } else {
      setFeedback({ type: "success", message: "Template deleted." });
      setSelectedId(null);
      setEditor({ ...DEFAULT_STATE });
      router.replace("/settings/labels", { scroll: false });
      await loadTemplates();
    }
    setSaving(false);
  };

  const matchingPreset = SIZE_PRESETS.find(
    (p) => p.w === editor.widthMm && p.h === editor.heightMm
  );

  return (
    <Grid container spacing={3}>
      {/* ── Template List (left sidebar) ──────────────────────────────── */}
      <Grid size={{ xs: 12, md: 3 }}>
        <Card sx={{ position: "sticky", top: 16 }}>
          <CardHeader
            title="Templates"
            titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
            action={
              <IconButton size="small" onClick={startNew} title="New template">
                <AddIcon />
              </IconButton>
            }
            sx={{ pb: 0 }}
          />
          <Divider sx={{ mt: 1 }} />
          <CardContent sx={{ p: 0 }}>
            {loading ? (
              <Box sx={{ p: 2 }}>
                <Skeleton variant="rounded" height={80} />
              </Box>
            ) : templates.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 3 }}>
                <LabelIcon
                  sx={{ fontSize: 32, color: "text.disabled", mb: 0.5 }}
                />
                <Typography variant="body2" color="text.secondary">
                  No templates yet
                </Typography>
              </Box>
            ) : (
              <List dense disablePadding>
                {templates.map((tmpl) => (
                  <ListItemButton
                    key={tmpl.id}
                    selected={tmpl.id === selectedId}
                    onClick={() => selectTemplate(tmpl)}
                  >
                    <ListItemIcon sx={{ minWidth: 32 }}>
                      {tmpl.isDefault ? (
                        <StarIcon
                          sx={{ fontSize: 18, color: "warning.main" }}
                        />
                      ) : (
                        <LabelIcon sx={{ fontSize: 18, color: "action.active" }} />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={tmpl.name}
                      secondary={
                        tmpl.widthMm && tmpl.heightMm
                          ? `${tmpl.widthMm}\u00d7${tmpl.heightMm}mm`
                          : "No size set"
                      }
                      primaryTypographyProps={{
                        variant: "body2",
                        fontWeight: 500,
                        noWrap: true,
                      }}
                      secondaryTypographyProps={{
                        variant: "caption",
                        sx: { textTransform: "capitalize" },
                      }}
                    />
                  </ListItemButton>
                ))}
              </List>
            )}
            <Divider />
            <Box sx={{ p: 1 }}>
              <Button
                fullWidth
                size="small"
                startIcon={<AddIcon />}
                onClick={startNew}
              >
                New Template
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Button
          size="small"
          startIcon={<ArrowBackIcon />}
          href="/settings"
          sx={{ mt: 1 }}
        >
          Back to Settings
        </Button>
      </Grid>

      {/* ── Label Preview (center) ────────────────────────────────────── */}
      <Grid size={{ xs: 12, md: 5 }}>
        <Card>
          <CardHeader
            title="Preview"
            titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
            subheader={`${editor.widthMm} \u00d7 ${editor.heightMm} mm`}
          />
          <Divider />
          <CardContent>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minHeight: 200,
                p: 2,
                bgcolor: "grey.50",
                borderRadius: 1,
                border: "1px solid",
                borderColor: "grey.200",
              }}
            >
              <LabelPreview
                settings={editorToPreview(editor)}
                maxWidth={360}
              />
            </Box>
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ display: "block", textAlign: "center", mt: 1 }}
            >
              Preview rendered at 4px/mm. Actual print may vary.
            </Typography>
          </CardContent>
        </Card>
      </Grid>

      {/* ── Template Settings (right sidebar) ─────────────────────────── */}
      <Grid size={{ xs: 12, md: 4 }}>
        <Card>
          <CardHeader
            title={selectedId ? "Edit Template" : "New Template"}
            titleTypographyProps={{ variant: "subtitle1", fontWeight: 600 }}
          />
          <Divider />
          <CardContent>
            <Stack spacing={2.5}>
              {/* Feedback */}
              {feedback && (
                <Alert
                  severity={feedback.type}
                  onClose={() => setFeedback(null)}
                >
                  {feedback.message}
                </Alert>
              )}

              {/* Name */}
              <TextField
                label="Template Name"
                size="small"
                fullWidth
                value={editor.name}
                onChange={(e) => updateField("name", e.target.value)}
              />

              {/* Size presets */}
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.5, display: "block" }}
                >
                  Label Size
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1 }}>
                  {SIZE_PRESETS.map((p) => (
                    <Chip
                      key={p.label}
                      label={p.label}
                      size="small"
                      variant={
                        matchingPreset === p ? "filled" : "outlined"
                      }
                      color={matchingPreset === p ? "primary" : "default"}
                      onClick={() => {
                        updateField("widthMm", p.w);
                        updateField("heightMm", p.h);
                      }}
                    />
                  ))}
                </Box>
                <Box sx={{ display: "flex", gap: 1 }}>
                  <TextField
                    label="Width (mm)"
                    size="small"
                    type="number"
                    value={editor.widthMm}
                    onChange={(e) =>
                      updateField(
                        "widthMm",
                        Math.max(10, parseInt(e.target.value) || 10)
                      )
                    }
                    slotProps={{ htmlInput: { min: 10, max: 200 } }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Height (mm)"
                    size="small"
                    type="number"
                    value={editor.heightMm}
                    onChange={(e) =>
                      updateField(
                        "heightMm",
                        Math.max(10, parseInt(e.target.value) || 10)
                      )
                    }
                    slotProps={{ htmlInput: { min: 10, max: 200 } }}
                    sx={{ flex: 1 }}
                  />
                </Box>
              </Box>

              <Divider />

              {/* Content toggles */}
              <Box>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mb: 0.5, display: "block" }}
                >
                  Content Fields
                </Typography>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 0,
                  }}
                >
                  {CONTENT_TOGGLES.map(({ key, label }) => (
                    <FormControlLabel
                      key={key}
                      control={
                        <Switch
                          size="small"
                          checked={editor[key] as boolean}
                          onChange={(e) =>
                            updateField(key, e.target.checked as never)
                          }
                        />
                      }
                      label={
                        <Typography variant="body2">{label}</Typography>
                      }
                      sx={{ mr: 0 }}
                    />
                  ))}
                </Box>
              </Box>

              <Divider />

              {/* QR code URL */}
              <TextField
                label="QR Code Base URL"
                size="small"
                fullWidth
                value={editor.qrCodeBaseUrl}
                onChange={(e) =>
                  updateField("qrCodeBaseUrl", e.target.value)
                }
                helperText="Item ID will be appended to this URL"
              />

              {/* Default toggle */}
              <FormControlLabel
                control={
                  <Switch
                    checked={editor.isDefault}
                    onChange={(e) =>
                      updateField("isDefault", e.target.checked)
                    }
                  />
                }
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {editor.isDefault ? (
                      <StarIcon sx={{ fontSize: 18, color: "warning.main" }} />
                    ) : (
                      <StarBorderIcon sx={{ fontSize: 18 }} />
                    )}
                    <Typography variant="body2">Set as default template</Typography>
                  </Box>
                }
              />

              <Divider />

              {/* Action buttons */}
              <Box sx={{ display: "flex", gap: 1, justifyContent: "flex-end" }}>
                {selectedId && (
                  <Button
                    variant="outlined"
                    color="error"
                    startIcon={<DeleteIcon />}
                    onClick={handleDelete}
                    disabled={saving}
                  >
                    Delete
                  </Button>
                )}
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={handleSave}
                  disabled={saving || !editor.name.trim()}
                >
                  {saving
                    ? "Saving..."
                    : selectedId
                      ? "Save Changes"
                      : "Create Template"}
                </Button>
              </Box>
            </Stack>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );
}
