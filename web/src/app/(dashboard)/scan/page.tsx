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
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import SearchIcon from "@mui/icons-material/Search";
import PlaceIcon from "@mui/icons-material/Place";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import PrintIcon from "@mui/icons-material/Print";
import NfcIcon from "@mui/icons-material/Nfc";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { PageHeader } from "@/components/layout/page-header";
import { BarcodeScanner } from "@/components/scan/barcode-scanner";
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

const STEPS = ["Identify", "Details", "Location", "Done"];

type ProductMatch = {
  match: string;
  product: any;
  brand: any;
};

export default function ScanPage() {
  // ── Workflow state ──────────────────────────────────────────────────────────
  const [activeStep, setActiveStep] = useState(0);
  const [showCamera, setShowCamera] = useState(false);

  // ── Station ─────────────────────────────────────────────────────────────────
  const [pairedStation, setPairedStation] = useState<any>(null);
  const [stationData, setStationData] = useState<StationScanData | null>(null);

  // ── Identification ──────────────────────────────────────────────────────────
  const [barcode, setBarcode] = useState<{
    value: string;
    format: string;
  } | null>(null);
  const [productMatch, setProductMatch] = useState<ProductMatch | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);

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

  // ── Barcode detected (phone camera) ─────────────────────────────────────────

  const handleBarcodeDetected = useCallback(
    async (value: string, format: string) => {
      setBarcode({ value, format });
      setShowCamera(false);
      setLookingUp(true);
      setError(null);

      const result = await lookupProductByBarcode(value);
      setLookingUp(false);

      if (result.error) {
        setError(result.error);
        return;
      }

      if (result.data) {
        setProductMatch(result.data);
        setActiveStep(1);
      }
    },
    []
  );

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

  // ── Save intake ─────────────────────────────────────────────────────────────

  const handleSaveIntake = async () => {
    setSaving(true);
    setError(null);

    const result = await createIntakeItem({
      productId: productMatch?.product?.id,
      scanEventId: stationData?.scanEventId,
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
      measuredSpectralData: stationData?.spectralData ?? undefined,
      measuredHeightMm: stationData?.heightMm ?? undefined,
      notes: notes || undefined,
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
    setBarcode(null);
    setProductMatch(null);
    setSearchQuery("");
    setSearchResults([]);
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
                  onDetected={handleBarcodeDetected}
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

                    {barcode && (
                      <Alert
                        severity="info"
                        sx={{ mt: 2 }}
                      >
                        <Typography variant="body2">
                          Barcode: <strong>{barcode.value}</strong>{" "}
                          <Chip label={barcode.format} size="small" />
                        </Typography>
                        {lookingUp && (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1,
                              mt: 1,
                            }}
                          >
                            <CircularProgress size={16} />
                            <Typography variant="body2">
                              Looking up...
                            </Typography>
                          </Box>
                        )}
                        {!lookingUp && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{ mt: 0.5 }}
                          >
                            No match found. Try searching below or add as new.
                          </Typography>
                        )}
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
          Phone fills: notes, manual weight override
          ══════════════════════════════════════════════════════════════════ */}
      {activeStep === 1 && (
        <Stack spacing={2}>
          {productMatch && <ProductCard data={productMatch} />}

          <Card variant="outlined">
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 2 }}>
                Details
              </Typography>

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

              {/* Station color preview */}
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
                  <Box>
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
                </Box>
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
                {barcode && (
                  <SummaryRow label="Barcode" value={barcode.value} />
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
                {stationData?.colorHex && (
                  <SummaryRow
                    label="Color"
                    value={stationData.colorHex}
                    source="station"
                    swatch={stationData.colorHex}
                  />
                )}
                {stationData?.heightMm != null && (
                  <SummaryRow
                    label="Height"
                    value={`${stationData.heightMm.toFixed(0)}mm`}
                    source="station"
                  />
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

          {/* Station actions (print / write NFC) */}
          {hasStation && (
            <Card variant="outlined">
              <CardContent>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>
                  Station Actions
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<PrintIcon />}
                    disabled
                  >
                    Print Label
                  </Button>
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<NfcIcon />}
                    disabled
                  >
                    Write NFC Tag
                  </Button>
                </Stack>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ mt: 1, display: "block" }}
                >
                  Label printing and NFC writing coming soon.
                </Typography>
              </CardContent>
            </Card>
          )}

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
