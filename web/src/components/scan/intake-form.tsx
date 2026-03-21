"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import CircularProgress from "@mui/material/CircularProgress";
import Autocomplete from "@mui/material/Autocomplete";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import IconButton from "@mui/material/IconButton";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import SearchIcon from "@mui/icons-material/Search";
import PlaceIcon from "@mui/icons-material/Place";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import PrintIcon from "@mui/icons-material/Print";
import DeleteIcon from "@mui/icons-material/Delete";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import ScaleIcon from "@mui/icons-material/Scale";
import HeightIcon from "@mui/icons-material/Height";
import NfcIcon from "@mui/icons-material/Nfc";
import { BarcodeScanner, type DetectedCode } from "@/components/scan/barcode-scanner";
import { ProductCard } from "@/components/scan/product-card";
import { SlotPicker } from "@/components/scan/slot-picker";
import {
  lookupProductByBarcode,
  searchProducts,
  createIntakeItem,
} from "@/lib/actions/scan";
import { PrintLabelDialog } from "@/components/labels/print-label-dialog";

/**
 * Scan data pre-filled from a station session.
 * Pass null/undefined for manual scans without a station.
 */
export type StationData = {
  sessionId?: string;
  weightG?: number | null;
  colorHex?: string | null;
  colorLabL?: number | null;
  colorLabA?: number | null;
  colorLabB?: number | null;
  heightMm?: number | null;
  nfcUid?: string | null;
  nfcTagFormat?: string | null;
  nfcParsedData?: Record<string, any> | null;
  matchedProduct?: any;
};

export function IntakeForm({ stationData }: { stationData?: StationData | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  // ── Identification ──────────────────────────────────────────────────────────
  const [showCamera, setShowCamera] = useState(false);
  const [detectedCodes, setDetectedCodes] = useState<DetectedCode[]>([]);
  const [barcode, setBarcode] = useState<{ value: string; format: string } | null>(null);
  const [productMatch, setProductMatch] = useState<any>(
    stationData?.matchedProduct
      ? {
          match: "auto",
          product: stationData.matchedProduct,
          brand: stationData.matchedProduct.brandName
            ? { name: stationData.matchedProduct.brandName }
            : null,
        }
      : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // ── OCR ─────────────────────────────────────────────────────────────────────
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);

  // ── Details ─────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");
  const [initialWeight, setInitialWeight] = useState(
    stationData?.weightG != null ? stationData.weightG.toFixed(1) : ""
  );
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Location ────────────────────────────────────────────────────────────────
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedSlotAddress, setSelectedSlotAddress] = useState("");

  // ── Save ────────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  const parsed = stationData?.nfcParsedData;

  // ── Barcode scanning ──────────────────────────────────────────────────────

  const handleCodesDetected = useCallback(
    async (codes: DetectedCode[]) => {
      setDetectedCodes(codes);
      setShowCamera(false);
      const primary = codes[0];
      if (primary) {
        setBarcode({ value: primary.value, format: primary.format });
        setLookingUp(true);
        setError(null);
        for (const code of codes) {
          const result = await lookupProductByBarcode(code.value);
          if (result.data) {
            setBarcode({ value: code.value, format: code.format });
            setProductMatch(result.data);
            setLookingUp(false);
            return;
          }
        }
        setLookingUp(false);
      }
    },
    []
  );

  // ── Catalog search ────────────────────────────────────────────────────────

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const result = await searchProducts(query);
    setSearching(false);
    if (result.data) setSearchResults(result.data);
  }, []);

  // ── OCR ───────────────────────────────────────────────────────────────────

  const handleRunOcr = useCallback(async () => {
    setOcrRunning(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.playsInline = true;
      await video.play();
      await new Promise((r) => setTimeout(r, 500));

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());

      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data } = await worker.recognize(canvas);
      await worker.terminate();

      const text = data.text.trim();
      setOcrText(text || null);
    } catch (e) {
      console.error("OCR failed:", e);
      setOcrText(null);
    } finally {
      setOcrRunning(false);
    }
  }, []);

  // ── Photo upload ──────────────────────────────────────────────────────────

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

  // ── Save to inventory ─────────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    setError(null);

    const notesParts: string[] = [];
    if (notes) notesParts.push(notes);
    if (ocrText) notesParts.push(`OCR text: ${ocrText}`);

    const result = await createIntakeItem({
      productId: productMatch?.product?.id,
      sessionId: stationData?.sessionId,
      slotId: selectedSlotId ?? undefined,
      barcodeValue: barcode?.value,
      barcodeFormat: barcode?.format,
      nfcUid: stationData?.nfcUid ?? undefined,
      nfcTagFormat: stationData?.nfcTagFormat ?? undefined,
      initialWeightG: initialWeight ? parseFloat(initialWeight) : undefined,
      measuredColorHex: stationData?.colorHex ?? undefined,
      measuredColorLabL: stationData?.colorLabL ?? undefined,
      measuredColorLabA: stationData?.colorLabA ?? undefined,
      measuredColorLabB: stationData?.colorLabB ?? undefined,
      measuredHeightMm: stationData?.heightMm ?? undefined,
      notes: notesParts.join("\n") || undefined,
    });

    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setSaved(true);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const effectiveColorHex = stationData?.colorHex;

  if (saved) {
    return (
      <Stack spacing={2}>
        <Alert severity="success" variant="filled">
          Item added to inventory!
        </Alert>
        {productMatch && <ProductCard data={productMatch} />}
        {selectedSlotAddress && (
          <Alert severity="info" icon={<PlaceIcon />}>
            Stored at: <strong>{selectedSlotAddress}</strong>
          </Alert>
        )}
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<PrintIcon />}
            onClick={() => setShowPrintDialog(true)}
            sx={{ textTransform: "none" }}
          >
            Print Label
          </Button>
          <Button
            variant="contained"
            startIcon={<QrCodeScannerIcon />}
            onClick={() => router.push("/scan")}
            sx={{ flex: 1, textTransform: "none" }}
          >
            Back to Scans
          </Button>
        </Stack>
        <PrintLabelDialog
          open={showPrintDialog}
          onClose={() => setShowPrintDialog(false)}
          items={[
            {
              brand: productMatch?.brand?.name ?? undefined,
              material: productMatch?.product?.materialName ?? productMatch?.product?.name ?? undefined,
              color: effectiveColorHex ?? undefined,
              weight: initialWeight ? `${initialWeight}g` : undefined,
              location: selectedSlotAddress || undefined,
            },
          ]}
        />
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      {error && (
        <Alert severity="error" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ── Station readings (if from scanner) ─────────────────────── */}
      {stationData && (
        <Card variant="outlined">
          <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: "block" }}>
              STATION READINGS
            </Typography>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              {stationData.weightG != null && (
                <Chip icon={<ScaleIcon sx={{ fontSize: "16px !important" }} />} label={`${stationData.weightG.toFixed(1)}g`} size="small" variant="outlined" />
              )}
              {stationData.colorHex && (
                <Chip
                  icon={<Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: stationData.colorHex, border: 1, borderColor: "divider" }} />}
                  label={stationData.colorHex} size="small" variant="outlined"
                />
              )}
              {stationData.nfcUid && (
                <Chip icon={<NfcIcon sx={{ fontSize: "16px !important" }} />}
                  label={stationData.nfcTagFormat?.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()) ?? "NFC Tag"}
                  size="small" variant="outlined" color="primary"
                />
              )}
              {stationData.heightMm != null && (
                <Chip icon={<HeightIcon sx={{ fontSize: "16px !important" }} />} label={`${stationData.heightMm.toFixed(0)}mm`} size="small" variant="outlined" />
              )}
            </Box>
            {parsed?.material && (
              <Box sx={{ mt: 1, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
                <Chip label={parsed.material} size="small" color="secondary" />
                {parsed.nozzleTempMin && <Chip label={`Nozzle: ${parsed.nozzleTempMin}–${parsed.nozzleTempMax}°C`} size="small" variant="outlined" />}
                {parsed.bedTemp && <Chip label={`Bed: ${parsed.bedTemp}°C`} size="small" variant="outlined" />}
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Product Identification ──────────────────────────────────── */}
      {productMatch ? (
        <>
          <ProductCard data={productMatch} />
          <Button variant="text" size="small" onClick={() => setProductMatch(null)} sx={{ textTransform: "none" }}>
            Wrong product? Search again
          </Button>
        </>
      ) : (
        <Card variant="outlined">
          <CardContent>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
              Identify Product
            </Typography>

            {/* Barcode scanner */}
            {showCamera ? (
              <BarcodeScanner onDetected={handleCodesDetected} onClose={() => setShowCamera(false)} />
            ) : (
              <Button
                fullWidth variant="contained" startIcon={<QrCodeScannerIcon />}
                onClick={() => setShowCamera(true)}
                sx={{ mb: 1.5, textTransform: "none" }}
              >
                Scan Barcode
              </Button>
            )}

            {/* Detected codes */}
            {detectedCodes.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 0.5 }}>
                  {detectedCodes.map((code) => (
                    <Chip key={code.value} label={`${code.value} (${code.format})`} size="small" variant="outlined"
                      color={code.value === barcode?.value ? "primary" : "default"} />
                  ))}
                </Stack>
                {lookingUp && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <CircularProgress size={16} />
                    <Typography variant="body2">Looking up...</Typography>
                  </Box>
                )}
                {!lookingUp && !productMatch && (
                  <Typography variant="body2" color="text.secondary">
                    No match found. Try OCR or search below.
                  </Typography>
                )}
              </Box>
            )}

            {/* OCR */}
            {!showCamera && (
              <Button
                fullWidth variant="outlined"
                startIcon={ocrRunning ? <CircularProgress size={16} /> : <TextFieldsIcon />}
                onClick={handleRunOcr} disabled={ocrRunning}
                sx={{ mb: 1.5, textTransform: "none" }}
              >
                {ocrRunning ? "Reading text..." : "Capture & Read Label (OCR)"}
              </Button>
            )}

            {ocrText && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={600} sx={{ display: "block", mb: 0.5 }}>
                  EXTRACTED TEXT
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.75rem" }}>
                  {ocrText}
                </Typography>
              </Alert>
            )}

            {/* Catalog search */}
            {!showCamera && (
              <Autocomplete
                freeSolo
                options={searchResults}
                getOptionLabel={(opt: any) =>
                  typeof opt === "string" ? opt : `${opt.brand?.name ?? ""} ${opt.product.name}`.trim()
                }
                loading={searching}
                inputValue={searchQuery}
                onInputChange={(_, val) => { setSearchQuery(val); handleSearch(val); }}
                onChange={(_, val) => {
                  if (val && typeof val !== "string") setProductMatch({ match: "search", ...val });
                }}
                renderOption={(props, option: any) => {
                  const { key, ...rest } = props as any;
                  return (
                    <Box component="li" key={option.product.id} {...rest}>
                      <Box sx={{ width: 24, height: 24, borderRadius: "50%", bgcolor: option.product.colorHex ?? "#ccc", border: "1px solid", borderColor: "divider", mr: 1.5, flexShrink: 0 }} />
                      <Box>
                        <Typography variant="body2" fontWeight={600}>{option.product.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{option.brand?.name} &middot; {option.product.colorName ?? ""}</Typography>
                      </Box>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField {...params} placeholder="Search by name, color, brand..."
                    slotProps={{ input: { ...params.InputProps, startAdornment: <SearchIcon color="action" sx={{ mr: 1 }} /> } }}
                  />
                )}
              />
            )}
          </CardContent>
        </Card>
      )}

      {/* ── Details ────────────────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            Details
          </Typography>

          {/* Photo upload */}
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
          />
          {photoUrl ? (
            <Box sx={{ position: "relative", display: "inline-block", mb: 2, width: "100%" }}>
              <Box component="img" src={photoUrl} alt="Uploaded" sx={{ width: "100%", maxHeight: 200, objectFit: "contain", borderRadius: 2, border: 1, borderColor: "divider", bgcolor: "grey.50" }} />
              <IconButton size="small" sx={{ position: "absolute", top: 4, right: 4, bgcolor: "background.paper", boxShadow: 1, "&:hover": { bgcolor: "error.light", color: "white" } }}
                onClick={() => setPhotoUrl(null)}>
                <DeleteIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Box>
          ) : (
            <Button variant="outlined" fullWidth
              startIcon={uploading ? <CircularProgress size={18} /> : <CameraAltIcon />}
              disabled={uploading} onClick={() => fileInputRef.current?.click()}
              sx={{ height: 64, borderStyle: "dashed", textTransform: "none", mb: 2 }}>
              {uploading ? "Uploading..." : "Take Photo"}
            </Button>
          )}

          {/* Weight — manual entry if no station data */}
          {!stationData?.weightG && (
            <TextField fullWidth label="Weight (g)" type="number" size="small"
              value={initialWeight} onChange={(e) => setInitialWeight(e.target.value)}
              placeholder="e.g. 1200" helperText="Total weight including spool" sx={{ mb: 2 }}
            />
          )}

          <TextField fullWidth label="Notes" size="small" multiline minRows={2}
            value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional details..."
          />
        </CardContent>
      </Card>

      {/* ── Location ───────────────────────────────────────────────── */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
            <PlaceIcon fontSize="small" sx={{ verticalAlign: "middle", mr: 0.5 }} />
            Storage Location
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Pick a slot or skip to assign later.
          </Typography>
          <SlotPicker selectedSlotId={selectedSlotId}
            onSelect={(id, addr) => { setSelectedSlotId(id); setSelectedSlotAddress(addr); }}
          />
          {selectedSlotAddress && (
            <Alert severity="success" sx={{ mt: 1 }}>
              Selected: <strong>{selectedSlotAddress}</strong>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* ── Save ───────────────────────────────────────────────────── */}
      <Button variant="contained" size="large" fullWidth onClick={handleSave} disabled={saving}
        startIcon={saving ? <CircularProgress size={18} /> : <CheckCircleOutlineIcon />}
        sx={{ textTransform: "none" }}>
        {saving ? "Saving..." : "Save to Inventory"}
      </Button>
    </Stack>
  );
}
