"use client";

import { useState, useCallback } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import TextField from "@mui/material/TextField";
import Stepper from "@mui/material/Stepper";
import Step from "@mui/material/Step";
import StepLabel from "@mui/material/StepLabel";
import Alert from "@mui/material/Alert";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import CircularProgress from "@mui/material/CircularProgress";
import Autocomplete from "@mui/material/Autocomplete";
import Stack from "@mui/material/Stack";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import SearchIcon from "@mui/icons-material/Search";
import PlaceIcon from "@mui/icons-material/Place";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import PrintIcon from "@mui/icons-material/Print";
import NfcIcon from "@mui/icons-material/Nfc";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import ColorLensIcon from "@mui/icons-material/ColorLens";
import TextFieldsIcon from "@mui/icons-material/TextFields";
import { PageHeader } from "@/components/layout/page-header";
import { BarcodeScanner, type DetectedCode } from "@/components/scan/barcode-scanner";
import { ColorCapture, type CapturedColor } from "@/components/scan/color-capture";
import { ProductCard } from "@/components/scan/product-card";
import { SlotPicker } from "@/components/scan/slot-picker";
import {
  StationPanel,
  type StationScanData,
} from "@/components/scan/station-panel";
import {
  lookupProductByBarcode,
  searchProducts,
  createIntakeItem,
} from "@/lib/actions/scan";
import {
  PrintLabelDialog,
  type PrintLabelItem,
} from "@/components/labels/print-label-dialog";

const STEPS = ["Identify", "Details", "Location", "Done"];

const PACKAGE_TYPES = [
  { value: "spool", label: "Spool" },
  { value: "box", label: "Box" },
  { value: "bottle", label: "Bottle" },
  { value: "bag", label: "Bag" },
  { value: "cartridge", label: "Cartridge" },
  { value: "other", label: "Other" },
] as const;

type PackageType = (typeof PACKAGE_TYPES)[number]["value"];

type ProductMatch = {
  match: string;
  product: any;
  brand: any;
};

export default function ScanPage() {
  // ── Workflow state ──────────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState(0);
  const [showCamera, setShowCamera] = useState(false);
  const [showColorCapture, setShowColorCapture] = useState(false);

  // ── Station ─────────────────────────────────────────────────────────────────
  const [pairedStation, setPairedStation] = useState<any>(null);
  const [stationData, setStationData] = useState<StationScanData | null>(null);

  // ── Identification ──────────────────────────────────────────────────────────
  const [detectedCodes, setDetectedCodes] = useState<DetectedCode[]>([]);
  const [barcode, setBarcode] = useState<{
    value: string;
    format: string;
  } | null>(null);
  const [productMatch, setProductMatch] = useState<ProductMatch | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

  // ── Package type ─────────────────────────────────────────────────────────
  const [packageType, setPackageType] = useState<PackageType | null>(null);

  // ── Color (phone camera) ──────────────────────────────────────────────────
  const [phoneColor, setPhoneColor] = useState<CapturedColor | null>(null);

  // ── OCR ─────────────────────────────────────────────────────────────────────
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);

  // ── Details ─────────────────────────────────────────────────────────────────
  const [notes, setNotes] = useState("");
  const [initialWeight, setInitialWeight] = useState("");

  // ── Location ────────────────────────────────────────────────────────────────
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedSlotAddress, setSelectedSlotAddress] = useState("");

  // ── Result ──────────────────────────────────────────────────────────────────
  const [intakeResult, setIntakeResult] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  // ── Station scan received ───────────────────────────────────────────────────

  const handleStationScan = useCallback(
    (data: StationScanData) => {
      setStationData(data);

      // Pre-fill weight from station if we don't have one yet
      if (data.weightG != null && data.weightStable && !initialWeight) {
        setInitialWeight(data.weightG.toFixed(1));
      }

      // If station auto-identified a product via NFC, apply it
      if (data.autoProduct && !productMatch) {
        setProductMatch({
          match: "nfc",
          product: data.autoProduct.product,
          brand: data.autoProduct.brand,
        });
      }
    },
    [initialWeight, productMatch]
  );

  // ── Barcodes detected (phone camera) ──────────────────────────────────────

  const handleCodesDetected = useCallback(
    async (codes: DetectedCode[]) => {
      setDetectedCodes(codes);
      setShowCamera(false);

      // Use first code as primary barcode
      const primary = codes[0];
      if (primary) {
        setBarcode({ value: primary.value, format: primary.format });

        // Try to look up each code until we find a product match
        setLookingUp(true);
        setError(null);

        for (const code of codes) {
          const result = await lookupProductByBarcode(code.value);
          if (result.data) {
            setBarcode({ value: code.value, format: code.format });
            setProductMatch(result.data);
            setLookingUp(false);
            setActiveStep(1);
            return;
          }
          if (result.error) {
            setError(result.error);
          }
        }

        setLookingUp(false);
      }
    },
    []
  );

  // ── OCR extraction ──────────────────────────────────────────────────────────

  const handleRunOcr = useCallback(async () => {
    // We need a video frame — reopen camera in a special mode? No, let's
    // capture from the same flow. We'll use the barcode scanner's last frame
    // or open a new camera capture for OCR.
    // For simplicity, open the barcode scanner and after codes are captured,
    // offer an "Extract Text" button that runs OCR on a new frame.
    setOcrRunning(true);
    try {
      // Capture a frame from the camera
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      const video = document.createElement("video");
      video.srcObject = stream;
      video.playsInline = true;
      await video.play();

      // Wait a moment for camera to stabilize
      await new Promise((r) => setTimeout(r, 500));

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(video, 0, 0);
      stream.getTracks().forEach((t) => t.stop());

      // Dynamic import of tesseract.js
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

  // ── Color captured (phone camera) ─────────────────────────────────────────

  const handleColorCaptured = useCallback((color: CapturedColor) => {
    setPhoneColor(color);
    setShowColorCapture(false);
  }, []);

  // ── Manual search ───────────────────────────────────────────────────────────

  const handleSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    const result = await searchProducts(query);
    setSearching(false);
    if (result.data) {
      setSearchResults(result.data);
    }
  }, []);

  const handleSelectSearchResult = (result: any) => {
    setProductMatch({ match: "search", ...result });
    setActiveStep(1);
  };

  // ── Effective color (station takes priority, then phone camera) ───────────

  const effectiveColorHex = stationData?.colorHex ?? phoneColor?.hex;

  // ── Save intake ─────────────────────────────────────────────────────────────

  const handleSaveIntake = async () => {
    setSaving(true);
    setError(null);

    // Build notes with extra data
    const notesParts: string[] = [];
    if (notes) notesParts.push(notes);

    // Append additional barcodes beyond the primary
    if (detectedCodes.length > 1) {
      const extra = detectedCodes
        .slice(1)
        .map((c) => `${c.value} (${c.format})`)
        .join(", ");
      notesParts.push(`Additional codes: ${extra}`);
    }

    // Append OCR text
    if (ocrText) {
      notesParts.push(`OCR text: ${ocrText}`);
    }

    const result = await createIntakeItem({
      productId: productMatch?.product?.id,
      packageType: packageType ?? undefined,
      scanEventId: stationData?.scanEventId,
      sessionId: stationData?.sessionId ?? undefined,
      slotId: selectedSlotId ?? undefined,
      barcodeValue: barcode?.value,
      barcodeFormat: barcode?.format,
      nfcUid: stationData?.nfcUid ?? undefined,
      nfcTagFormat: stationData?.nfcTagFormat ?? undefined,
      initialWeightG: initialWeight ? parseFloat(initialWeight) : undefined,
      measuredColorHex: effectiveColorHex ?? undefined,
      measuredColorLabL: stationData?.colorLabL ?? undefined,
      measuredColorLabA: stationData?.colorLabA ?? undefined,
      measuredColorLabB: stationData?.colorLabB ?? undefined,
      measuredSpectralData: stationData?.spectralData ?? undefined,
      measuredHeightMm: stationData?.heightMm ?? undefined,
      notes: notesParts.join("\n") || undefined,
    });

    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setIntakeResult(result.data);
    setActiveStep(3);
  };

  // ── Reset for next item ─────────────────────────────────────────────────────

  const handleReset = () => {
    setActiveStep(0);
    setShowCamera(false);
    setShowColorCapture(false);
    setDetectedCodes([]);
    setBarcode(null);
    setProductMatch(null);
    setSearchQuery("");
    setSearchResults([]);
    setPackageType(null);
    setPhoneColor(null);
    setOcrText(null);
    setNotes("");
    setInitialWeight("");
    setSelectedSlotId(null);
    setSelectedSlotAddress("");
    setIntakeResult(null);
    setStationData(null);
    setError(null);
  };

  // ── Whether we have station providing data ──────────────────────────────────

  const hasStation = pairedStation?.isOnline;
  const hasStationWeight =
    stationData?.weightG != null && stationData?.weightStable;
  const hasStationNfc = stationData?.nfcPresent && stationData?.nfcUid;

  return (
    <Box>
      <PageHeader
        title="Scan & Intake"
        description={
          hasStation
            ? `Connected to ${pairedStation.name} — place spool on station, then use phone to identify`
            : "Add spools to your inventory by scanning barcodes or searching the catalog"
        }
      />

      {/* ── Station Panel (always visible when stations exist) ────────── */}
      <Box sx={{ mb: 2 }}>
        <StationPanel
          onScanData={handleStationScan}
          onStationChange={setPairedStation}
        />
      </Box>

      {/* ── Stepper ───────────────────────────────────────────────────── */}
      <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 3 }}>
        {STEPS.map((label) => (
          <Step key={label}>
            <StepLabel>{label}</StepLabel>
          </Step>
        ))}
      </Stepper>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Step 0: IDENTIFY
          Station provides: NFC (auto-lookup), weight, color, height
          Phone provides: barcode camera, manual search
          ══════════════════════════════════════════════════════════════════ */}
      {activeStep === 0 && (
        <Stack spacing={2}>
          {/* Auto-identified via station NFC */}
          {productMatch?.match === "nfc" && (
            <Alert severity="success" icon={<NfcIcon />}>
              <Typography variant="body2" fontWeight={600}>
                Identified via NFC tag!
              </Typography>
            </Alert>
          )}

          {/* Parsed NFC tag details (Bambu material, color, temps, etc.) */}
          {stationData?.nfcParsedData && (
            <Card variant="outlined">
              <CardContent sx={{ py: 1.5, "&:last-child": { pb: 1.5 } }}>
                <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 0.5, display: "block" }}>
                  NFC TAG DATA
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, fontSize: "0.8rem" }}>
                  {stationData.nfcParsedData.material && (
                    <Chip label={`Material: ${stationData.nfcParsedData.material}`} size="small" variant="outlined" />
                  )}
                  {stationData.nfcParsedData.name && (
                    <Chip label={stationData.nfcParsedData.name} size="small" variant="outlined" />
                  )}
                  {stationData.nfcParsedData.colorHex && (
                    <Chip
                      icon={<Box sx={{ width: 12, height: 12, borderRadius: "50%", bgcolor: stationData.nfcParsedData.colorHex, border: "1px solid", borderColor: "divider" }} />}
                      label={stationData.nfcParsedData.colorHex}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  {stationData.nfcParsedData.nozzleTempMin != null && (
                    <Chip label={`Nozzle: ${stationData.nfcParsedData.nozzleTempMin}-${stationData.nfcParsedData.nozzleTempMax}\u00B0C`} size="small" variant="outlined" />
                  )}
                  {stationData.nfcParsedData.bedTemp != null && (
                    <Chip label={`Bed: ${stationData.nfcParsedData.bedTemp}\u00B0C`} size="small" variant="outlined" />
                  )}
                  {stationData.nfcParsedData.spoolNetWeight != null && (
                    <Chip label={`Net: ${stationData.nfcParsedData.spoolNetWeight}g`} size="small" variant="outlined" />
                  )}
                </Box>
              </CardContent>
            </Card>
          )}

          {productMatch && (
            <>
              <ProductCard data={productMatch} />
              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => setActiveStep(1)}
              >
                Confirm &amp; Continue
              </Button>
              <Button
                variant="text"
                size="small"
                onClick={() => setProductMatch(null)}
              >
                Wrong product? Search again
              </Button>
            </>
          )}

          {/* Phone barcode scanner */}
          {!productMatch && (
            <>
              {showCamera ? (
                <BarcodeScanner
                  onDetected={handleCodesDetected}
                  onClose={() => setShowCamera(false)}
                />
              ) : (
                <Card variant="outlined">
                  <CardContent>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 1.5 }}
                    >
                      {hasStation
                        ? "Use your phone to scan the barcode"
                        : "Scan a barcode to identify"}
                    </Typography>
                    <Button
                      fullWidth
                      variant="contained"
                      size="large"
                      startIcon={<QrCodeScannerIcon />}
                      onClick={() => setShowCamera(true)}
                    >
                      Scan Barcode
                    </Button>

                    {/* Detected codes list */}
                    {detectedCodes.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ display: "block", mb: 0.5 }}>
                          DETECTED CODES ({detectedCodes.length})
                        </Typography>
                        <Stack direction="row" flexWrap="wrap" gap={0.5} sx={{ mb: 1 }}>
                          {detectedCodes.map((code) => (
                            <Chip
                              key={code.value}
                              label={`${code.value} (${code.format})`}
                              size="small"
                              variant="outlined"
                              color={code.value === barcode?.value ? "primary" : "default"}
                            />
                          ))}
                        </Stack>
                        {lookingUp && (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                            }}
                          >
                            <CircularProgress size={16} />
                            <Typography variant="body2">
                              Looking up...
                            </Typography>
                          </Box>
                        )}
                        {!lookingUp && !productMatch && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                          >
                            No product match found. Try searching below or add as new.
                          </Typography>
                        )}
                      </Box>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* OCR: Extract text from label */}
              {!showCamera && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Extract label text (OCR)
                    </Typography>
                    <Button
                      fullWidth
                      variant="outlined"
                      startIcon={
                        ocrRunning ? (
                          <CircularProgress size={16} />
                        ) : (
                          <TextFieldsIcon />
                        )
                      }
                      onClick={handleRunOcr}
                      disabled={ocrRunning}
                    >
                      {ocrRunning ? "Reading text..." : "Capture & Read Text"}
                    </Button>
                    {ocrText && (
                      <Alert severity="info" sx={{ mt: 1.5 }}>
                        <Typography variant="caption" fontWeight={600} sx={{ display: "block", mb: 0.5 }}>
                          EXTRACTED TEXT
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.75rem" }}
                        >
                          {ocrText}
                        </Typography>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Manual catalog search */}
              {!showCamera && (
                <Card variant="outlined">
                  <CardContent>
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{ mb: 1 }}
                    >
                      Or search the catalog
                    </Typography>
                    <Autocomplete
                      freeSolo
                      options={searchResults}
                      getOptionLabel={(opt: any) =>
                        typeof opt === "string"
                          ? opt
                          : `${opt.brand?.name ?? ""} ${opt.product.name}`.trim()
                      }
                      loading={searching}
                      inputValue={searchQuery}
                      onInputChange={(_, val) => {
                        setSearchQuery(val);
                        handleSearch(val);
                      }}
                      onChange={(_, val) => {
                        if (val && typeof val !== "string") {
                          handleSelectSearchResult(val);
                        }
                      }}
                      renderOption={(props, option: any) => {
                        const { key, ...rest } = props as any;
                        return (
                          <Box
                            component="li"
                            key={option.product.id}
                            {...rest}
                          >
                            <Box
                              sx={{
                                width: 24,
                                height: 24,
                                borderRadius: "50%",
                                bgcolor: option.product.colorHex ?? "#ccc",
                                border: "1px solid",
                                borderColor: "divider",
                                mr: 1.5,
                                flexShrink: 0,
                              }}
                            />
                            <Box>
                              <Typography variant="body2" fontWeight={600}>
                                {option.product.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {option.brand?.name} &middot;{" "}
                                {option.product.colorName ?? ""}
                              </Typography>
                            </Box>
                          </Box>
                        );
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Search by name, color, brand..."
                          slotProps={{
                            input: {
                              ...params.InputProps,
                              startAdornment: (
                                <SearchIcon color="action" sx={{ mr: 1 }} />
                              ),
                            },
                          }}
                        />
                      )}
                    />
                  </CardContent>
                </Card>
              )}

              {/* Skip identification */}
              {!showCamera && (
                <Button
                  variant="outlined"
                  startIcon={<AddCircleOutlineIcon />}
                  onClick={() => {
                    setProductMatch(null);
                    setActiveStep(1);
                  }}
                >
                  Add without product match
                </Button>
              )}
            </>
          )}
        </Stack>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Step 1: DETAILS
          Station fills: weight (auto), color, height
          Phone fills: notes, manual weight override, camera color
          ══════════════════════════════════════════════════════════════════ */}
      {activeStep === 1 && (
        <Stack spacing={2}>
          {productMatch && <ProductCard data={productMatch} />}

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Details
              </Typography>

              {/* Package type */}
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Package type
              </Typography>
              <ToggleButtonGroup
                value={packageType}
                exclusive
                onChange={(_, val) => { if (val !== null) setPackageType(val); }}
                size="small"
                sx={{ mb: 2, flexWrap: "wrap", gap: 0.5 }}
              >
                {PACKAGE_TYPES.map((pt) => (
                  <ToggleButton key={pt.value} value={pt.value} sx={{ textTransform: "none", px: 1.5 }}>
                    {pt.label}
                  </ToggleButton>
                ))}
              </ToggleButtonGroup>

              <TextField
                fullWidth
                label="Weight (g)"
                type="number"
                value={initialWeight}
                onChange={(e) => setInitialWeight(e.target.value)}
                placeholder="e.g. 1200"
                helperText={
                  hasStationWeight
                    ? `From station scale: ${stationData!.weightG!.toFixed(1)}g (${stationData!.weightStable ? "stable" : "settling..."})`
                    : "Total weight including spool. Leave blank if unknown."
                }
                sx={{ mb: 2 }}
                slotProps={{
                  inputLabel: { shrink: !!initialWeight },
                }}
              />

              {/* Color section */}
              {showColorCapture ? (
                <Box sx={{ mb: 2 }}>
                  <ColorCapture
                    onCapture={handleColorCaptured}
                    onClose={() => setShowColorCapture(false)}
                  />
                </Box>
              ) : (
                <>
                  {/* Station color (takes priority) */}
                  {stationData?.colorHex && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        mb: 2,
                        p: 1.5,
                        bgcolor: "action.hover",
                        borderRadius: 2,
                      }}
                    >
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          bgcolor: stationData.colorHex,
                          border: "2px solid",
                          borderColor: "divider",
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          Measured color: {stationData.colorHex}
                        </Typography>
                        {stationData.colorLabL != null && (
                          <Typography variant="caption" color="text.secondary">
                            L*a*b*: {stationData.colorLabL.toFixed(1)},{" "}
                            {stationData.colorLabA?.toFixed(1)},{" "}
                            {stationData.colorLabB?.toFixed(1)}
                          </Typography>
                        )}
                      </Box>
                      <Chip label="station" size="small" variant="outlined" color="success" sx={{ height: 20, fontSize: "0.65rem" }} />
                    </Box>
                  )}

                  {/* Phone camera color */}
                  {phoneColor && (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1.5,
                        mb: 2,
                        p: 1.5,
                        bgcolor: "action.hover",
                        borderRadius: 2,
                      }}
                    >
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: "50%",
                          bgcolor: phoneColor.hex,
                          border: "2px solid",
                          borderColor: "divider",
                        }}
                      />
                      <Box sx={{ flex: 1 }}>
                        <Typography variant="body2" fontWeight={600}>
                          Camera color: {phoneColor.hex.toUpperCase()}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          RGB({phoneColor.r}, {phoneColor.g}, {phoneColor.b})
                        </Typography>
                      </Box>
                      <Chip label="phone" size="small" variant="outlined" color="info" sx={{ height: 20, fontSize: "0.65rem" }} />
                    </Box>
                  )}

                  {/* Capture color button (always available when no station color) */}
                  <Button
                    fullWidth
                    variant="outlined"
                    startIcon={<ColorLensIcon />}
                    onClick={() => setShowColorCapture(true)}
                    sx={{ mb: 2 }}
                  >
                    {phoneColor ? "Re-capture Color" : "Capture Color"}
                  </Button>
                </>
              )}

              {/* Station height */}
              {stationData?.heightMm != null && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 2,
                    p: 1.5,
                    bgcolor: "action.hover",
                    borderRadius: 2,
                  }}
                >
                  <Typography variant="body2">
                    Measured height: <strong>{stationData.heightMm.toFixed(0)}mm</strong>
                  </Typography>
                </Box>
              )}

              {/* OCR text preview (if captured in step 0) */}
              {ocrText && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  <Typography variant="caption" fontWeight={600} sx={{ display: "block", mb: 0.5 }}>
                    LABEL TEXT (OCR)
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ whiteSpace: "pre-wrap", fontFamily: "monospace", fontSize: "0.75rem" }}
                  >
                    {ocrText}
                  </Typography>
                </Alert>
              )}

              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes about this spool..."
              />
            </CardContent>
          </Card>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => setActiveStep(0)}
            >
              Back
            </Button>
            <Button
              variant="contained"
              endIcon={<ArrowForwardIcon />}
              onClick={() => setActiveStep(2)}
              sx={{ flex: 1 }}
            >
              Choose Location
            </Button>
          </Box>
        </Stack>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Step 2: LOCATION
          ══════════════════════════════════════════════════════════════════ */}
      {activeStep === 2 && (
        <Stack spacing={2}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                <PlaceIcon
                  fontSize="small"
                  sx={{ verticalAlign: "middle", mr: 0.5 }}
                />
                Assign Storage Location
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ mb: 2 }}
              >
                Pick a slot or skip to assign later.
              </Typography>

              <SlotPicker
                selectedSlotId={selectedSlotId}
                onSelect={(id, addr) => {
                  setSelectedSlotId(id);
                  setSelectedSlotAddress(addr);
                }}
              />

              {selectedSlotId && (
                <Alert severity="success" sx={{ mt: 1 }}>
                  Selected: <strong>{selectedSlotAddress}</strong>
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Summary
              </Typography>
              <Stack spacing={0.5}>
                <SummaryRow
                  label="Product"
                  value={productMatch?.product?.name ?? "Unidentified"}
                />
                {productMatch?.brand && (
                  <SummaryRow label="Brand" value={productMatch.brand.name} />
                )}
                {packageType && (
                  <SummaryRow label="Package" value={packageType} />
                )}
                {detectedCodes.length > 0 && (
                  <SummaryRow
                    label="Codes"
                    value={detectedCodes.map((c) => c.value).join(", ")}
                  />
                )}
                {hasStationNfc && (
                  <SummaryRow
                    label="NFC"
                    value={stationData!.nfcUid!}
                    source="station"
                  />
                )}
                {initialWeight && (
                  <SummaryRow
                    label="Weight"
                    value={`${initialWeight}g`}
                    source={hasStationWeight ? "station" : undefined}
                  />
                )}
                {effectiveColorHex && (
                  <SummaryRow
                    label="Color"
                    value={effectiveColorHex}
                    source={stationData?.colorHex ? "station" : "phone"}
                    swatch={effectiveColorHex}
                  />
                )}
                {stationData?.heightMm != null && (
                  <SummaryRow
                    label="Height"
                    value={`${stationData.heightMm.toFixed(0)}mm`}
                    source="station"
                  />
                )}
                {ocrText && (
                  <SummaryRow label="OCR" value={ocrText.slice(0, 60) + (ocrText.length > 60 ? "..." : "")} />
                )}
                {selectedSlotAddress && (
                  <SummaryRow label="Location" value={selectedSlotAddress} />
                )}
              </Stack>
            </CardContent>
          </Card>

          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => setActiveStep(1)}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleSaveIntake}
              disabled={saving}
              sx={{ flex: 1 }}
              startIcon={
                saving ? (
                  <CircularProgress size={16} />
                ) : (
                  <CheckCircleOutlineIcon />
                )
              }
            >
              {saving ? "Saving..." : "Save to Inventory"}
            </Button>
          </Box>
        </Stack>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          Step 3: DONE
          ══════════════════════════════════════════════════════════════════ */}
      {activeStep === 3 && (
        <Stack spacing={2}>
          <Alert severity="success" variant="filled">
            <Typography variant="subtitle1" fontWeight={600}>
              Item added to inventory!
            </Typography>
          </Alert>

          {productMatch && <ProductCard data={productMatch} />}

          {selectedSlotAddress && (
            <Alert severity="info" icon={<PlaceIcon />}>
              Place spool at: <strong>{selectedSlotAddress}</strong>
            </Alert>
          )}

          {/* Actions (print / write NFC) */}
          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 1 }}>
                Actions
              </Typography>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={<PrintIcon />}
                  onClick={() => setShowPrintDialog(true)}
                >
                  Print Label
                </Button>
                {hasStation && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<NfcIcon />}
                    disabled
                  >
                    Write NFC Tag
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>

          <Divider />

          <Button
            fullWidth
            variant="contained"
            size="large"
            startIcon={<QrCodeScannerIcon />}
            onClick={handleReset}
          >
            Scan Next Item
          </Button>
        </Stack>
      )}

      <PrintLabelDialog
        open={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        items={[
          {
            brand: productMatch?.product?.brand ?? undefined,
            material: productMatch?.product?.materialName ?? productMatch?.product?.name ?? undefined,
            color: effectiveColorHex ?? undefined,
            nozzleTemp: productMatch?.product?.nozzleTempMin
              ? `${productMatch.product.nozzleTempMin}-${productMatch.product.nozzleTempMax ?? productMatch.product.nozzleTempMin}°C`
              : undefined,
            bedTemp: productMatch?.product?.bedTempMin
              ? `${productMatch.product.bedTempMin}°C`
              : undefined,
            weight: initialWeight ? `${initialWeight}g` : undefined,
            location: selectedSlotAddress || undefined,
          },
        ]}
      />
    </Box>
  );
}

// ── Summary row helper ────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  source,
  swatch,
}: {
  label: string;
  value: string;
  source?: "station" | "phone";
  swatch?: string;
}) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Typography variant="body2" sx={{ minWidth: 70 }}>
        <strong>{label}:</strong>
      </Typography>
      {swatch && (
        <Box
          sx={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            bgcolor: swatch,
            border: "1px solid",
            borderColor: "divider",
          }}
        />
      )}
      <Typography variant="body2" sx={{ flex: 1 }} noWrap>
        {value}
      </Typography>
      {source && (
        <Chip
          label={source}
          size="small"
          variant="outlined"
          color={source === "station" ? "success" : "info"}
          sx={{ height: 20, fontSize: "0.65rem" }}
        />
      )}
    </Box>
  );
}
