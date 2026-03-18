"use client";

import { useState, useEffect, useMemo } from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import CircularProgress from "@mui/material/CircularProgress";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MenuItem from "@mui/material/MenuItem";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import PrintIcon from "@mui/icons-material/Print";
import {
  LabelPreview,
  type LabelPreviewData,
  type LabelPreviewSettings,
} from "./label-preview";
import {
  listLabelTemplates,
  listMyStations,
  createPrintJob,
  createBatchPrintJobs,
} from "@/lib/actions/user-library";

type TemplateRow = {
  id: string;
  name: string;
  widthMm: number | null;
  heightMm: number | null;
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
  isDefault: boolean | null;
  [key: string]: unknown;
};

type StationRow = {
  id: string;
  name: string;
  isOnline: boolean | null;
  [key: string]: unknown;
};

export type PrintLabelItem = {
  brand?: string;
  material?: string;
  color?: string;
  nozzleTemp?: string;
  bedTemp?: string;
  weight?: string;
  location?: string;
  price?: string;
  purchaseDate?: string;
  lotNumber?: string;
  /** For unique identification in batch mode */
  label?: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** Single item or batch of items to print labels for */
  items: PrintLabelItem[];
  /** Dialog title override */
  title?: string;
};

function templateToSettings(t: TemplateRow): LabelPreviewSettings {
  return {
    widthMm: t.widthMm ?? 40,
    heightMm: t.heightMm ?? 30,
    showBrand: t.showBrand ?? true,
    showMaterial: t.showMaterial ?? true,
    showColor: t.showColor ?? true,
    showColorSwatch: t.showColorSwatch ?? true,
    showTemps: t.showTemps ?? true,
    showQrCode: t.showQrCode ?? true,
    showWeight: t.showWeight ?? true,
    showLocation: t.showLocation ?? false,
    showPrice: t.showPrice ?? false,
    showPurchaseDate: t.showPurchaseDate ?? false,
    showLotNumber: t.showLotNumber ?? false,
  };
}

export function PrintLabelDialog({ open, onClose, items, title }: Props) {
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [stations, setStations] = useState<StationRow[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedStation, setSelectedStation] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);

  const isBatch = items.length > 1;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setSuccess(false);
    setSending(false);
    setPreviewError(false);
    setPreviewLoading(true);

    (async () => {
      setLoading(true);
      const [tRes, sRes] = await Promise.all([
        listLabelTemplates(),
        listMyStations(),
      ]);
      if (tRes.data) {
        setTemplates(tRes.data as TemplateRow[]);
        // Auto-select default template
        const def = (tRes.data as TemplateRow[]).find((t) => t.isDefault);
        if (def) setSelectedTemplate(def.id);
        else if (tRes.data.length > 0)
          setSelectedTemplate((tRes.data as TemplateRow[])[0].id);
      }
      if (sRes.data) {
        setStations(sRes.data as StationRow[]);
        // Auto-select first online station
        const online = (sRes.data as StationRow[]).find((s) => s.isOnline);
        if (online) setSelectedStation(online.id);
        else if (sRes.data.length > 0)
          setSelectedStation((sRes.data as StationRow[])[0].id);
      }
      setLoading(false);
    })();
  }, [open]);

  const template = templates.find((t) => t.id === selectedTemplate);
  const settings = template ? templateToSettings(template) : null;
  const previewItem = items[0] ?? {};

  // Build a server-rendered BMP preview URL from the first item's data
  const previewUrl = useMemo(() => {
    if (!selectedTemplate || !previewItem) return null;
    const params = new URLSearchParams();
    params.set("format", "png");
    params.set("width", "384");
    params.set("dpi", "203");
    params.set("templateId", selectedTemplate);
    if (previewItem.brand) params.set("brand", previewItem.brand);
    if (previewItem.material) params.set("material", previewItem.material);
    if (previewItem.color) params.set("colorHex", previewItem.color);
    if (previewItem.nozzleTemp) {
      // nozzleTemp may be "215°C" or "200-220°C" — parse out numbers
      const tempMatch = previewItem.nozzleTemp.match(/(\d+)\s*[-–]\s*(\d+)/);
      if (tempMatch) {
        params.set("nozzleTempMin", tempMatch[1]);
        params.set("nozzleTempMax", tempMatch[2]);
      } else {
        const single = previewItem.nozzleTemp.match(/(\d+)/);
        if (single) params.set("nozzleTempMin", single[1]);
      }
    }
    if (previewItem.bedTemp) {
      const bedMatch = previewItem.bedTemp.match(/(\d+)/);
      if (bedMatch) params.set("bedTemp", bedMatch[1]);
    }
    if (previewItem.weight) params.set("weight", previewItem.weight);
    if (previewItem.location) params.set("location", previewItem.location);
    return `/api/v1/label/render?${params.toString()}`;
  }, [selectedTemplate, previewItem]);

  const handlePrint = async () => {
    setError(null);
    setSending(true);

    try {
      if (items.length === 1) {
        const result = await createPrintJob({
          templateId: selectedTemplate || undefined,
          stationId: selectedStation || undefined,
          labelData: items[0],
        });
        if (result.error) {
          setError(result.error);
          setSending(false);
          return;
        }
      } else {
        const result = await createBatchPrintJobs(
          items.map((item) => ({
            templateId: selectedTemplate || undefined,
            stationId: selectedStation || undefined,
            labelData: item,
          }))
        );
        if (result.error) {
          setError(result.error);
          setSending(false);
          return;
        }
      }

      setSuccess(true);
      setSending(false);
      setTimeout(() => onClose(), 1500);
    } catch (e) {
      setError((e as Error).message);
      setSending(false);
    }
  };

  const dialogTitle =
    title ??
    (isBatch ? `Print ${items.length} Labels` : "Print Label");

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{dialogTitle}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {success && (
            <Alert severity="success">
              {isBatch
                ? `${items.length} print jobs queued!`
                : "Print job queued!"}
            </Alert>
          )}

          {loading ? (
            <Typography color="text.secondary">Loading...</Typography>
          ) : (
            <>
              {/* Template picker */}
              {templates.length === 0 ? (
                <Alert severity="info">
                  No label templates configured. Create one in Settings &gt;
                  Labels first.
                </Alert>
              ) : (
                <TextField
                  select
                  label="Label Template"
                  value={selectedTemplate}
                  onChange={(e) => setSelectedTemplate(e.target.value)}
                  size="small"
                  fullWidth
                >
                  {templates.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name}
                      {t.widthMm && t.heightMm
                        ? ` (${t.widthMm}×${t.heightMm}mm)`
                        : ""}
                      {t.isDefault ? " ★" : ""}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {/* Station picker */}
              {stations.length === 0 ? (
                <Alert severity="info">
                  No scan stations found. Pair a FillaScan device first.
                </Alert>
              ) : (
                <TextField
                  select
                  label="Print Station"
                  value={selectedStation}
                  onChange={(e) => setSelectedStation(e.target.value)}
                  size="small"
                  fullWidth
                >
                  {stations.map((s) => (
                    <MenuItem key={s.id} value={s.id}>
                      {s.name}
                      {s.isOnline ? " (online)" : " (offline)"}
                    </MenuItem>
                  ))}
                </TextField>
              )}

              {/* Preview */}
              {settings && (
                <Box>
                  <Typography
                    variant="subtitle2"
                    color="text.secondary"
                    sx={{ mb: 1 }}
                  >
                    Preview
                  </Typography>
                  {previewUrl && !previewError ? (
                    <Box sx={{ position: "relative", textAlign: "center" }}>
                      {previewLoading && (
                        <Box
                          sx={{
                            position: "absolute",
                            inset: 0,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            zIndex: 1,
                          }}
                        >
                          <CircularProgress size={24} />
                        </Box>
                      )}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Label preview"
                        onLoad={() => setPreviewLoading(false)}
                        onError={() => {
                          setPreviewLoading(false);
                          setPreviewError(true);
                        }}
                        style={{
                          maxWidth: "100%",
                          imageRendering: "pixelated",
                          border: "1px solid #ccc",
                          borderRadius: 4,
                          opacity: previewLoading ? 0.3 : 1,
                          transition: "opacity 0.2s",
                        }}
                      />
                    </Box>
                  ) : (
                    /* Fall back to CSS preview if BMP fails */
                    <LabelPreview
                      settings={settings}
                      data={previewItem as LabelPreviewData}
                      maxWidth={350}
                    />
                  )}
                </Box>
              )}

              {/* Batch info */}
              {isBatch && (
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                  <Typography variant="caption" color="text.secondary">
                    {items.length} labels:
                  </Typography>
                  {items.slice(0, 10).map((item, i) => (
                    <Chip
                      key={i}
                      label={
                        item.label ??
                        item.material ??
                        item.brand ??
                        `Label ${i + 1}`
                      }
                      size="small"
                      variant="outlined"
                    />
                  ))}
                  {items.length > 10 && (
                    <Chip
                      label={`+${items.length - 10} more`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
              )}
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={sending}>
          Cancel
        </Button>
        <Button
          onClick={handlePrint}
          variant="contained"
          startIcon={<PrintIcon />}
          disabled={
            sending ||
            success ||
            loading ||
            templates.length === 0 ||
            stations.length === 0 ||
            !selectedTemplate
          }
        >
          {sending
            ? "Sending..."
            : success
            ? "Sent!"
            : isBatch
            ? `Print ${items.length} Labels`
            : "Print"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
