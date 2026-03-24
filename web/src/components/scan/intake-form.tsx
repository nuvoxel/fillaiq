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
import Grid from "@mui/material/Grid";
import InputAdornment from "@mui/material/InputAdornment";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Rating from "@mui/material/Rating";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import DataObjectIcon from "@mui/icons-material/DataObject";
import StarIcon from "@mui/icons-material/Star";
import { BarcodeScanner, type DetectedCode } from "@/components/scan/barcode-scanner";
import { ProductCard } from "@/components/scan/product-card";
import { SlotPicker } from "@/components/scan/slot-picker";
import {
  lookupProductByBarcode,
  searchProducts,
  createIntakeItem,
} from "@/lib/actions/scan";
import { PrintLabelDialog } from "@/components/labels/print-label-dialog";

const PACKAGE_TYPES = [
  { value: "spool", label: "Spool" },
  { value: "box", label: "Box" },
  { value: "bottle", label: "Bottle" },
  { value: "bag", label: "Bag" },
  { value: "cartridge", label: "Cartridge" },
  { value: "tool", label: "Tool" },
  { value: "bolt", label: "Bolt" },
  { value: "nut", label: "Nut" },
  { value: "screw", label: "Screw" },
  { value: "electronic_component", label: "Electronic" },
  { value: "other", label: "Other" },
] as const;

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
  nfcRawData?: string | null;
  nfcSectorsRead?: number | null;
  spectralData?: Record<string, any> | null;
  matchedProduct?: any;
};

export function IntakeForm({ stationData }: { stationData?: StationData | null }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const parsed = stationData?.nfcParsedData;

  // ── Editable Station Readings ───────────────────────────────────────────────
  const [weight, setWeight] = useState(stationData?.weightG?.toFixed(1) ?? "");
  const [height, setHeight] = useState(stationData?.heightMm?.toFixed(0) ?? "");
  const [colorHex, setColorHex] = useState(stationData?.colorHex ?? "");

  // ── Product Identification ──────────────────────────────────────────────────
  const [showCamera, setShowCamera] = useState(false);
  const [detectedCodes, setDetectedCodes] = useState<DetectedCode[]>([]);
  const [barcode, setBarcode] = useState<{ value: string; format: string } | null>(null);
  const [productMatch, setProductMatch] = useState<any>(
    stationData?.matchedProduct
      ? { match: "auto", product: stationData.matchedProduct, brand: stationData.matchedProduct.brandName ? { name: stationData.matchedProduct.brandName } : null }
      : null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // ── OCR ─────────────────────────────────────────────────────────────────────
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);

  // ── Photos ──────────────────────────────────────────────────────────────────
  const [photos, setPhotos] = useState<string[]>([]);
  const [primaryPhoto, setPrimaryPhoto] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Product Details ─────────────────────────────────────────────────────────
  const [packageType, setPackageType] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState("USD");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [productionDate, setProductionDate] = useState(parsed?.productionDate ?? "");
  const [lotNumber, setLotNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [rating, setRating] = useState<number | null>(null);

  // ── Weight Details ────────────────────────────────────────────────────────
  const [netFilamentWeightG, setNetFilamentWeightG] = useState(parsed?.spoolNetWeight?.toString() ?? "");
  const [spoolWeightG, setSpoolWeightG] = useState("");
  const [storageLocation, setStorageLocation] = useState("");

  // ── Spool Dimensions ──────────────────────────────────────────────────────
  const [spoolOuterDia, setSpoolOuterDia] = useState("");
  const [spoolInnerDia, setSpoolInnerDia] = useState("");
  const [spoolWidth, setSpoolWidth] = useState("");
  const [spoolHubHoleDia, setSpoolHubHoleDia] = useState("");
  const [spoolMeasuredWeight, setSpoolMeasuredWeight] = useState("");

  // ── Location ────────────────────────────────────────────────────────────────
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedSlotAddress, setSelectedSlotAddress] = useState("");

  // ── Save ────────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleCodesDetected = useCallback(async (codes: DetectedCode[]) => {
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
  }, []);

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    const result = await searchProducts(query);
    setSearching(false);
    if (result.data) setSearchResults(result.data);
  }, []);

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
      canvas.getContext("2d")!.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data } = await worker.recognize(canvas);
      await worker.terminate();
      setOcrText(data.text.trim() || null);
    } catch (e) {
      console.error("OCR failed:", e);
    } finally {
      setOcrRunning(false);
    }
  }, []);

  const handlePhotoUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/v1/upload?category=scans", { method: "POST", body: formData });
      const result = await res.json();
      if (!res.ok) { setError(result.error || "Upload failed"); return; }
      setPhotos((prev) => [...prev, result.url]);
    } catch {
      setError("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    const notesParts: string[] = [];
    if (notes) notesParts.push(notes);
    if (ocrText) notesParts.push(`OCR: ${ocrText}`);

    const result = await createIntakeItem({
      productId: productMatch?.product?.id,
      sessionId: stationData?.sessionId,
      slotId: selectedSlotId ?? undefined,
      barcodeValue: barcode?.value,
      barcodeFormat: barcode?.format,
      nfcUid: stationData?.nfcUid ?? undefined,
      nfcTagFormat: stationData?.nfcTagFormat ?? undefined,
      initialWeightG: weight ? parseFloat(weight) : undefined,
      netFilamentWeightG: netFilamentWeightG ? parseFloat(netFilamentWeightG) : undefined,
      spoolWeightG: spoolWeightG ? parseFloat(spoolWeightG) : undefined,
      measuredColorHex: colorHex || undefined,
      measuredColorLabL: stationData?.colorLabL ?? undefined,
      measuredColorLabA: stationData?.colorLabA ?? undefined,
      measuredColorLabB: stationData?.colorLabB ?? undefined,
      measuredHeightMm: height ? parseFloat(height) : undefined,
      measuredSpoolOuterDiameterMm: spoolOuterDia ? parseFloat(spoolOuterDia) : undefined,
      measuredSpoolInnerDiameterMm: spoolInnerDia ? parseFloat(spoolInnerDia) : undefined,
      measuredSpoolWidthMm: spoolWidth ? parseFloat(spoolWidth) : undefined,
      measuredSpoolHubHoleDiameterMm: spoolHubHoleDia ? parseFloat(spoolHubHoleDia) : undefined,
      measuredSpoolWeightG: spoolMeasuredWeight ? parseFloat(spoolMeasuredWeight) : undefined,
      packageType: packageType ?? undefined,
      purchasePrice: purchasePrice ? parseFloat(purchasePrice) : undefined,
      purchaseCurrency: purchaseCurrency || undefined,
      purchasedAt: purchaseDate || undefined,
      productionDate: productionDate || undefined,
      lotNumber: lotNumber || undefined,
      serialNumber: serialNumber || undefined,
      rating: rating ?? undefined,
      notes: notesParts.join("\n") || undefined,
      storageLocation: storageLocation || undefined,
    });

    setSaving(false);
    if (result.error) { setError(result.error); return; }
    setSaved(true);
  };

  // ── Render: Saved ─────────────────────────────────────────────────────────

  if (saved) {
    return (
      <Stack spacing={2}>
        <Alert severity="success" variant="filled">Item added to inventory!</Alert>
        {productMatch && <ProductCard data={productMatch} />}
        {selectedSlotAddress && (
          <Alert severity="info" icon={<PlaceIcon />}>Stored at: <strong>{selectedSlotAddress}</strong></Alert>
        )}
        <Stack direction="row" spacing={1}>
          <Button variant="outlined" startIcon={<PrintIcon />} onClick={() => setShowPrintDialog(true)} sx={{ textTransform: "none" }}>
            Print Label
          </Button>
          <Button variant="contained" startIcon={<QrCodeScannerIcon />} onClick={() => router.push("/scan")} sx={{ flex: 1, textTransform: "none" }}>
            Back to Scans
          </Button>
        </Stack>
        <PrintLabelDialog
          open={showPrintDialog} onClose={() => setShowPrintDialog(false)}
          items={[{
            brand: productMatch?.brand?.name,
            material: productMatch?.product?.materialName ?? productMatch?.product?.name,
            color: colorHex || undefined,
            weight: weight ? `${weight}g` : undefined,
            location: selectedSlotAddress || undefined,
          }]}
        />
      </Stack>
    );
  }

  // ── Render: Active ────────────────────────────────────────────────────────

  return (
    <Stack spacing={2}>
      {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}

      {/* ═══ 1. Station Readings (editable) ═══════════════════════════════ */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>
            Measurements
          </Typography>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth size="small" label="Weight (g)" type="number"
                value={weight} onChange={(e) => setWeight(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><ScaleIcon sx={{ fontSize: 16 }} /></InputAdornment> } }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth size="small" label="Height (mm)" type="number"
                value={height} onChange={(e) => setHeight(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start"><HeightIcon sx={{ fontSize: 16 }} /></InputAdornment> } }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <TextField fullWidth size="small" label="Color" value={colorHex}
                onChange={(e) => setColorHex(e.target.value)} placeholder="#FF5500"
                slotProps={{ input: {
                  startAdornment: colorHex ? (
                    <InputAdornment position="start">
                      <Box sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: colorHex, border: 1, borderColor: "divider" }} />
                    </InputAdornment>
                  ) : undefined,
                } }}
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              {stationData?.nfcUid && (
                <Chip icon={<NfcIcon sx={{ fontSize: "16px !important" }} />}
                  label={stationData.nfcTagFormat && stationData.nfcTagFormat !== "unknown"
                    ? stationData.nfcTagFormat.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                    : stationData.nfcUid.slice(0, 12) + "..."}
                  variant="outlined" color="primary" sx={{ mt: 0.5 }}
                />
              )}
            </Grid>
          </Grid>
          {/* NFC parsed data chips */}
          {parsed?.material && (
            <Box sx={{ mt: 1.5, display: "flex", gap: 0.75, flexWrap: "wrap" }}>
              <Chip label={parsed.material} size="small" color="secondary" />
              {parsed.name && <Chip label={parsed.name} size="small" variant="outlined" />}
              {parsed.nozzleTempMin && <Chip label={`Nozzle: ${parsed.nozzleTempMin}–${parsed.nozzleTempMax}°C`} size="small" variant="outlined" />}
              {parsed.bedTemp && <Chip label={`Bed: ${parsed.bedTemp}°C`} size="small" variant="outlined" />}
              {parsed.spoolNetWeight && <Chip label={`Net: ${parsed.spoolNetWeight}g`} size="small" variant="outlined" />}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* ═══ 2. Raw Scan Data (collapsible) ═══════════════════════════════ */}
      {stationData && (stationData.nfcRawData || stationData.spectralData || stationData.nfcParsedData) && (
        <Accordion disableGutters variant="outlined" sx={{ "&:before": { display: "none" } }}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
              <DataObjectIcon sx={{ fontSize: 16, color: "text.secondary" }} />
              <Typography variant="caption" fontWeight={600} color="text.secondary">Raw Scan Data</Typography>
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ pt: 0 }}>
            {stationData.nfcParsedData && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.5 }}>NFC Parsed</Typography>
                <Box component="pre" sx={{ fontSize: "0.7rem", fontFamily: "monospace", bgcolor: "grey.50", p: 1.5, borderRadius: 1, overflow: "auto", maxHeight: 200, m: 0 }}>
                  {JSON.stringify(stationData.nfcParsedData, null, 2)}
                </Box>
              </Box>
            )}
            {stationData.nfcRawData && stationData.nfcSectorsRead && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                  NFC Raw ({stationData.nfcSectorsRead} sectors)
                </Typography>
                <Box component="pre" sx={{ fontSize: "0.65rem", fontFamily: "monospace", bgcolor: "grey.900", color: "grey.100", p: 1.5, borderRadius: 1, overflow: "auto", maxHeight: 300, m: 0 }}>
                  {Array.from({ length: stationData.nfcSectorsRead }).map((_, s) => {
                    const bps = stationData.nfcRawData!.length / 2 / stationData.nfcSectorsRead!;
                    const bpb = bps / 16;
                    const lines: string[] = [`── Sector ${s} ──`];
                    for (let b = 0; b < bpb; b++) {
                      const start = (s * bps + b * 16) * 2;
                      const hex = stationData.nfcRawData!.slice(start, start + 32);
                      const ascii = hex.match(/.{2}/g)?.map(h => { const c = parseInt(h, 16); return c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : "."; }).join("") ?? "";
                      lines.push(`  B${b}: ${hex.match(/.{2}/g)?.join(" ") ?? hex}  |${ascii}|`);
                    }
                    return lines.join("\n");
                  }).join("\n\n")}
                </Box>
              </Box>
            )}
            {stationData.spectralData && (
              <Box>
                <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.5 }}>Spectral Data</Typography>
                <Box component="pre" sx={{ fontSize: "0.7rem", fontFamily: "monospace", bgcolor: "grey.50", p: 1.5, borderRadius: 1, overflow: "auto", maxHeight: 200, m: 0 }}>
                  {JSON.stringify(stationData.spectralData, null, 2)}
                </Box>
              </Box>
            )}
          </AccordionDetails>
        </Accordion>
      )}

      {/* ═══ 3. Photos ════════════════════════════════════════════════════ */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>Photos</Typography>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
          />
          {photos.length > 0 && (
            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 1.5 }}>
              {photos.map((url, i) => (
                <Box key={url} sx={{ position: "relative", width: 80, height: 80 }}>
                  <Box component="img" src={url} alt={`Photo ${i + 1}`}
                    sx={{ width: 80, height: 80, objectFit: "cover", borderRadius: 1, border: i === primaryPhoto ? 3 : 1, borderColor: i === primaryPhoto ? "primary.main" : "divider", cursor: "pointer" }}
                    onClick={() => setPrimaryPhoto(i)}
                  />
                  <IconButton size="small" onClick={() => { setPhotos((p) => p.filter((_, j) => j !== i)); if (primaryPhoto >= i && primaryPhoto > 0) setPrimaryPhoto(primaryPhoto - 1); }}
                    sx={{ position: "absolute", top: -6, right: -6, bgcolor: "background.paper", boxShadow: 1, p: 0.25, "&:hover": { bgcolor: "error.light", color: "white" } }}>
                    <DeleteIcon sx={{ fontSize: 14 }} />
                  </IconButton>
                  {i === primaryPhoto && (
                    <StarIcon sx={{ position: "absolute", bottom: 2, left: 2, fontSize: 16, color: "primary.main", filter: "drop-shadow(0 0 2px white)" }} />
                  )}
                </Box>
              ))}
            </Box>
          )}
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" startIcon={uploading ? <CircularProgress size={16} /> : <CameraAltIcon />}
              disabled={uploading} onClick={() => fileInputRef.current?.click()} sx={{ textTransform: "none", flex: 1 }}>
              {uploading ? "Uploading..." : "Take Photo"}
            </Button>
          </Stack>
          {photos.length > 1 && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
              Tap a photo to set it as primary. Primary photo is used as the product image.
            </Typography>
          )}
        </CardContent>
      </Card>

      {/* ═══ 4. Product Identification ════════════════════════════════════ */}
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
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>Identify Product</Typography>
            {showCamera ? (
              <BarcodeScanner onDetected={handleCodesDetected} onClose={() => setShowCamera(false)} />
            ) : (
              <Button fullWidth variant="contained" startIcon={<QrCodeScannerIcon />}
                onClick={() => setShowCamera(true)} sx={{ mb: 1.5, textTransform: "none" }}>
                Scan Barcode
              </Button>
            )}
            {detectedCodes.length > 0 && (
              <Box sx={{ mb: 1.5 }}>
                <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 0.5 }}>
                  {detectedCodes.map((code) => (
                    <Chip key={code.value} label={`${code.value} (${code.format})`} size="small" variant="outlined"
                      color={code.value === barcode?.value ? "primary" : "default"} />
                  ))}
                </Stack>
                {lookingUp && <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}><CircularProgress size={16} /><Typography variant="body2">Looking up...</Typography></Box>}
                {!lookingUp && !productMatch && <Typography variant="body2" color="text.secondary">No match. Try OCR or search.</Typography>}
              </Box>
            )}
            {!showCamera && (
              <Button fullWidth variant="outlined" startIcon={ocrRunning ? <CircularProgress size={16} /> : <TextFieldsIcon />}
                onClick={handleRunOcr} disabled={ocrRunning} sx={{ mb: 1.5, textTransform: "none" }}>
                {ocrRunning ? "Reading..." : "Capture & Read Label (OCR)"}
              </Button>
            )}
            {ocrText && (
              <Alert severity="info" sx={{ mb: 1.5 }}>
                <Typography variant="caption" fontWeight={600} sx={{ display: "block", mb: 0.5 }}>EXTRACTED TEXT</Typography>
                <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.75rem" }}>{ocrText}</Typography>
              </Alert>
            )}
            {!showCamera && (
              <Autocomplete freeSolo options={searchResults}
                getOptionLabel={(opt: any) => typeof opt === "string" ? opt : `${opt.brand?.name ?? ""} ${opt.product.name}`.trim()}
                loading={searching} inputValue={searchQuery}
                onInputChange={(_, val) => { setSearchQuery(val); handleSearch(val); }}
                onChange={(_, val) => { if (val && typeof val !== "string") setProductMatch({ match: "search", ...val }); }}
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

      {/* ═══ 5. Product Details ═══════════════════════════════════════════ */}
      <Card variant="outlined">
        <CardContent>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.5 }}>Details</Typography>

          {/* Package type */}
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block" }}>Package Type</Typography>
          <ToggleButtonGroup value={packageType} exclusive size="small"
            onChange={(_, val) => { if (val !== null) setPackageType(val); }}
            sx={{ mb: 2, flexWrap: "wrap", gap: 0.5 }}>
            {PACKAGE_TYPES.map((pt) => (
              <ToggleButton key={pt.value} value={pt.value} sx={{ textTransform: "none", px: 1.5 }}>{pt.label}</ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" label="Purchase Price" type="number"
                value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)}
                slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" label="Purchase Date" type="date"
                value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)}
                slotProps={{ inputLabel: { shrink: true } }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" label="Production Date" value={productionDate}
                onChange={(e) => setProductionDate(e.target.value)} placeholder="2025-01-15"
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" label="Lot Number" value={lotNumber}
                onChange={(e) => setLotNumber(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" label="Serial Number" value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField fullWidth size="small" label="Storage Location" value={storageLocation}
                onChange={(e) => setStorageLocation(e.target.value)} placeholder="Freetext (if no slot)"
              />
            </Grid>
          </Grid>

          {/* Rating */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <Typography variant="caption" color="text.secondary">Rating</Typography>
            <Rating value={rating} onChange={(_, v) => setRating(v)} size="small" />
          </Box>

          <TextField fullWidth size="small" label="Notes" multiline minRows={2}
            value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Any notes..."
          />
        </CardContent>
      </Card>

      {/* ═══ 5b. Weight & Dimensions (expandable) ═════════════════════════ */}
      <Accordion disableGutters variant="outlined" sx={{ "&:before": { display: "none" } }}>
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
          <Typography variant="subtitle2" color="text.secondary">Weight & Spool Dimensions</Typography>
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 4 }}>
              <TextField fullWidth size="small" label="Net Filament (g)" type="number"
                value={netFilamentWeightG} onChange={(e) => setNetFilamentWeightG(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField fullWidth size="small" label="Spool/Pkg Weight (g)" type="number"
                value={spoolWeightG} onChange={(e) => setSpoolWeightG(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 4 }}>
              <TextField fullWidth size="small" label="Measured Spool (g)" type="number"
                value={spoolMeasuredWeight} onChange={(e) => setSpoolMeasuredWeight(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 3 }}>
              <TextField fullWidth size="small" label="Outer Dia. (mm)" type="number"
                value={spoolOuterDia} onChange={(e) => setSpoolOuterDia(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 3 }}>
              <TextField fullWidth size="small" label="Inner Dia. (mm)" type="number"
                value={spoolInnerDia} onChange={(e) => setSpoolInnerDia(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 3 }}>
              <TextField fullWidth size="small" label="Width (mm)" type="number"
                value={spoolWidth} onChange={(e) => setSpoolWidth(e.target.value)} />
            </Grid>
            <Grid size={{ xs: 3 }}>
              <TextField fullWidth size="small" label="Hub Hole (mm)" type="number"
                value={spoolHubHoleDia} onChange={(e) => setSpoolHubHoleDia(e.target.value)} />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>

      {/* ═══ 6. Storage Location ══════════════════════════════════════════ */}
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
            <Alert severity="success" sx={{ mt: 1 }}>Selected: <strong>{selectedSlotAddress}</strong></Alert>
          )}
        </CardContent>
      </Card>

      {/* ═══ 7. Save ══════════════════════════════════════════════════════ */}
      <Button variant="contained" size="large" fullWidth onClick={handleSave} disabled={saving}
        startIcon={saving ? <CircularProgress size={18} /> : <CheckCircleOutlineIcon />}
        sx={{ textTransform: "none" }}>
        {saving ? "Saving..." : "Save to Inventory"}
      </Button>
    </Stack>
  );
}
