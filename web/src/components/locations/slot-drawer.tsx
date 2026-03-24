"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Drawer from "@mui/material/Drawer";
import Typography from "@mui/material/Typography";
import TextField from "@mui/material/TextField";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Rating from "@mui/material/Rating";
import Skeleton from "@mui/material/Skeleton";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import LinearProgress from "@mui/material/LinearProgress";
import Autocomplete from "@mui/material/Autocomplete";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import MenuItem from "@mui/material/MenuItem";
import InputAdornment from "@mui/material/InputAdornment";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import Tooltip from "@mui/material/Tooltip";
import CloseIcon from "@mui/icons-material/Close";
import NfcIcon from "@mui/icons-material/Nfc";
import PrintIcon from "@mui/icons-material/Print";
import EditIcon from "@mui/icons-material/Edit";
import VisibilityIcon from "@mui/icons-material/Visibility";
import DeviceThermostatIcon from "@mui/icons-material/DeviceThermostat";
import WaterDropIcon from "@mui/icons-material/WaterDrop";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import LinkIcon from "@mui/icons-material/Link";
import AddIcon from "@mui/icons-material/Add";
import { getSlotWithDetails, updateSlot } from "@/lib/actions/hardware";
import { updateUserItem, checkIsAdmin } from "@/lib/actions/user-library";
import { removeItemFromSlot, searchProducts } from "@/lib/actions/scan";
import { createProduct } from "@/lib/actions/central-catalog";

type Props = {
  slotId: string | null;
  onClose: () => void;
  onUpdate?: () => void;
  onPrintSlot?: () => void;
};

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
];

const ITEM_STATUSES = [
  { value: "active", label: "Active" },
  { value: "empty", label: "Empty" },
  { value: "archived", label: "Archived" },
];

const NFC_TAG_FORMATS = [
  { value: "bambu_mifare", label: "Bambu (MIFARE)" },
  { value: "creality", label: "Creality" },
  { value: "open_print_tag", label: "OpenPrintTag" },
  { value: "open_spool", label: "OpenSpool" },
  { value: "open_tag_3d", label: "OpenTag3D" },
  { value: "tiger_tag", label: "TigerTag" },
  { value: "ntag", label: "NTAG" },
  { value: "filla_iq", label: "Filla IQ" },
  { value: "unknown", label: "Unknown" },
];

function fmtDate(val: string | Date | null | undefined): string {
  if (!val) return "";
  const d = typeof val === "string" ? new Date(val) : val;
  return isNaN(d.getTime()) ? String(val) : d.toISOString().slice(0, 10);
}

function fmtDateTime(val: string | Date | null | undefined): string {
  if (!val) return "—";
  const d = typeof val === "string" ? new Date(val) : val;
  return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
}

function DisplayField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <Box sx={{ mb: 0.75 }}>
      <Typography variant="caption" color="text.secondary" display="block" sx={{ lineHeight: 1.2 }}>{label}</Typography>
      <Typography variant="body2" fontWeight={500} sx={mono ? { fontFamily: "monospace", fontSize: "0.8rem" } : {}} noWrap>
        {value || "—"}
      </Typography>
    </Box>
  );
}

export function SlotDrawer({ slotId, onClose, onUpdate, onPrintSlot }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);

  // Slot fields
  const [slotLabel, setSlotLabel] = useState("");
  const [slotNfcTagId, setSlotNfcTagId] = useState("");

  // Item fields — all schema columns
  const [f, setF] = useState<Record<string, any>>({});
  const set = (key: string) => (val: any) => setF((prev) => ({ ...prev, [key]: val }));

  // Product search
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<any[]>([]);
  const [productSearchLoading, setProductSearchLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [addingToCatalog, setAddingToCatalog] = useState(false);

  useEffect(() => {
    if (!slotId) return;
    setLoading(true);
    setData(null);
    setEditing(false);

    (async () => {
      try {
        const [res, adminRes] = await Promise.all([
          getSlotWithDetails(slotId),
          checkIsAdmin(),
        ]);
        setIsAdmin(adminRes);

        if (res.data) {
          const d = res.data as any;
          setData(d);
          setSlotLabel(d.label ?? "");
          setSlotNfcTagId(d.nfcTagId ?? "");

          const item = d.items?.[0];
          if (item) {
            setF({
              packageType: item.packageType ?? "",
              status: item.status ?? "active",
              notes: item.notes ?? "",
              rating: item.rating,
              currentWeightG: item.currentWeightG?.toString() ?? "",
              initialWeightG: item.initialWeightG?.toString() ?? "",
              netFilamentWeightG: item.netFilamentWeightG?.toString() ?? "",
              spoolWeightG: item.spoolWeightG?.toString() ?? "",
              percentRemaining: item.percentRemaining?.toString() ?? "",
              measuredHeightMm: item.measuredHeightMm?.toString() ?? "",
              measuredColorHex: item.measuredColorHex ?? "",
              measuredColorLabL: item.measuredColorLabL?.toString() ?? "",
              measuredColorLabA: item.measuredColorLabA?.toString() ?? "",
              measuredColorLabB: item.measuredColorLabB?.toString() ?? "",
              measuredSpoolOuterDiameterMm: item.measuredSpoolOuterDiameterMm?.toString() ?? "",
              measuredSpoolInnerDiameterMm: item.measuredSpoolInnerDiameterMm?.toString() ?? "",
              measuredSpoolWidthMm: item.measuredSpoolWidthMm?.toString() ?? "",
              measuredSpoolHubHoleDiameterMm: item.measuredSpoolHubHoleDiameterMm?.toString() ?? "",
              measuredSpoolWeightG: item.measuredSpoolWeightG?.toString() ?? "",
              nfcUid: item.nfcUid ?? "",
              nfcTagFormat: item.nfcTagFormat ?? "",
              nfcTagWritten: item.nfcTagWritten ?? false,
              bambuTrayUid: item.bambuTrayUid ?? "",
              barcodeValue: item.barcodeValue ?? "",
              barcodeFormat: item.barcodeFormat ?? "",
              lotNumber: item.lotNumber ?? "",
              serialNumber: item.serialNumber ?? "",
              purchasePrice: item.purchasePrice?.toString() ?? "",
              purchaseCurrency: item.purchaseCurrency ?? "USD",
              purchasedAt: fmtDate(item.purchasedAt),
              productionDate: item.productionDate ?? "",
              openedAt: fmtDate(item.openedAt),
              emptiedAt: fmtDate(item.emptiedAt),
              expiresAt: fmtDate(item.expiresAt),
              lastDriedAt: fmtDate(item.lastDriedAt),
              dryingCycleCount: item.dryingCycleCount?.toString() ?? "0",
              storageLocation: item.storageLocation ?? "",
            });
            if (item.product) {
              setSelectedProduct({ product: item.product, brand: item.product.brand });
            }
          }
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [slotId]);

  // Product search debounce
  const handleProductSearch = useCallback(async (query: string) => {
    if (query.length < 2) { setProductOptions([]); return; }
    setProductSearchLoading(true);
    try {
      const res = await searchProducts(query);
      if (res.data) setProductOptions(res.data as any[]);
    } catch { /* ignore */ }
    setProductSearchLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => handleProductSearch(productSearch), 300);
    return () => clearTimeout(timer);
  }, [productSearch, handleProductSearch]);

  const item = data?.items?.[0];
  const slotStatus = data?.status;
  const hasItem = !!item && item.status !== undefined;
  const product = selectedProduct?.product;
  const brand = selectedProduct?.brand ?? product?.brand;
  const material = product?.material;
  const pct = f.percentRemaining ? parseInt(f.percentRemaining) : item?.percentRemaining;

  // Location breadcrumb
  const locationParts: string[] = [];
  if (data) {
    const zone = data.bay?.shelf?.rack?.zone;
    const rack = data.bay?.shelf?.rack;
    const shelf = data.bay?.shelf;
    const bay = data.bay;
    if (zone?.name) locationParts.push(zone.name);
    if (rack?.name) locationParts.push(rack.name);
    if (shelf) locationParts.push(`Shelf ${shelf.label || shelf.position}`);
    if (bay) locationParts.push(`Bay ${bay.label || bay.position}`);
    locationParts.push(`Slot ${data.label || data.position}`);
  }

  const handleSaveSlot = async () => {
    if (!slotId) return;
    setSaving(true);
    await updateSlot(slotId, { label: slotLabel || null, nfcTagId: slotNfcTagId || null });
    setSaving(false);
    onUpdate?.();
  };

  const handleSaveItem = async () => {
    if (!item) return;
    setSaving(true);
    const toFloat = (v: string) => v ? parseFloat(v) : null;
    const toInt = (v: string) => v ? parseInt(v) : null;
    const toDateOrNull = (v: string) => v || null;
    await updateUserItem(item.id, {
      packageType: f.packageType || null,
      status: f.status,
      notes: f.notes || null,
      rating: f.rating,
      currentWeightG: toFloat(f.currentWeightG),
      initialWeightG: toFloat(f.initialWeightG),
      netFilamentWeightG: toFloat(f.netFilamentWeightG),
      spoolWeightG: toFloat(f.spoolWeightG),
      percentRemaining: toInt(f.percentRemaining),
      measuredHeightMm: toFloat(f.measuredHeightMm),
      measuredColorHex: f.measuredColorHex || null,
      measuredColorLabL: toFloat(f.measuredColorLabL),
      measuredColorLabA: toFloat(f.measuredColorLabA),
      measuredColorLabB: toFloat(f.measuredColorLabB),
      measuredSpoolOuterDiameterMm: toFloat(f.measuredSpoolOuterDiameterMm),
      measuredSpoolInnerDiameterMm: toFloat(f.measuredSpoolInnerDiameterMm),
      measuredSpoolWidthMm: toFloat(f.measuredSpoolWidthMm),
      measuredSpoolHubHoleDiameterMm: toFloat(f.measuredSpoolHubHoleDiameterMm),
      measuredSpoolWeightG: toFloat(f.measuredSpoolWeightG),
      nfcUid: f.nfcUid || null,
      nfcTagFormat: f.nfcTagFormat || null,
      nfcTagWritten: f.nfcTagWritten,
      bambuTrayUid: f.bambuTrayUid || null,
      barcodeValue: f.barcodeValue || null,
      barcodeFormat: f.barcodeFormat || null,
      lotNumber: f.lotNumber || null,
      serialNumber: f.serialNumber || null,
      purchasePrice: toFloat(f.purchasePrice),
      purchaseCurrency: f.purchaseCurrency || null,
      purchasedAt: toDateOrNull(f.purchasedAt),
      productionDate: f.productionDate || null,
      openedAt: toDateOrNull(f.openedAt),
      emptiedAt: toDateOrNull(f.emptiedAt),
      expiresAt: toDateOrNull(f.expiresAt),
      lastDriedAt: toDateOrNull(f.lastDriedAt),
      dryingCycleCount: toInt(f.dryingCycleCount),
      storageLocation: f.storageLocation || null,
      productId: selectedProduct?.product?.id ?? null,
    });
    setSaving(false);
    setEditing(false);
    onUpdate?.();
  };

  const handleRemoveItem = async () => {
    if (!slotId) return;
    await removeItemFromSlot(slotId);
    setData((prev: any) => prev ? { ...prev, items: [] } : null);
    onUpdate?.();
  };

  const handleAddToCatalog = async () => {
    if (!item) return;
    setAddingToCatalog(true);
    try {
      const res = await createProduct({
        name: product?.name || f.notes || "Untitled Item",
        category: "other",
        colorHex: f.measuredColorHex || null,
        netWeightG: f.netFilamentWeightG ? parseFloat(f.netFilamentWeightG) : null,
        packageWeightG: f.spoolWeightG ? parseFloat(f.spoolWeightG) : null,
        brandId: brand?.id ?? null,
        materialId: material?.id ?? null,
      });
      if (res.data) {
        setSelectedProduct({ product: res.data, brand });
        await updateUserItem(item.id, { productId: (res.data as any).id });
        onUpdate?.();
      }
    } catch { /* ignore */ }
    setAddingToCatalog(false);
  };

  // Helper for edit mode number fields
  const editNum = (label: string, key: string, unit?: string, xs = 4) => (
    <Grid size={{ xs }}>
      <TextField fullWidth size="small" label={label} type="number" value={f[key] ?? ""}
        onChange={(e) => set(key)(e.target.value)}
        slotProps={unit ? { input: { endAdornment: <InputAdornment position="end">{unit}</InputAdornment> } } : undefined}
      />
    </Grid>
  );

  // Helper for edit mode text fields
  const editText = (label: string, key: string, xs = 6, props?: Record<string, any>) => (
    <Grid size={{ xs }}>
      <TextField fullWidth size="small" label={label} value={f[key] ?? ""}
        onChange={(e) => set(key)(e.target.value)} {...props} />
    </Grid>
  );

  // Helper for edit mode date fields
  const editDate = (label: string, key: string, xs = 4) => (
    <Grid size={{ xs }}>
      <TextField fullWidth size="small" label={label} type="date" value={f[key] ?? ""}
        onChange={(e) => set(key)(e.target.value)} slotProps={{ inputLabel: { shrink: true } }} />
    </Grid>
  );

  // Helper for display mode
  const displayNum = (label: string, key: string, unit?: string, xs = 4) => (
    <Grid size={{ xs }}>
      <DisplayField label={label} value={f[key] ? `${f[key]}${unit ? ` ${unit}` : ""}` : null} />
    </Grid>
  );

  const pkgLabel = PACKAGE_TYPES.find((p) => p.value === f.packageType)?.label ?? f.packageType;
  const statusLabel = ITEM_STATUSES.find((s) => s.value === f.status)?.label ?? f.status;
  const nfcFormatLabel = NFC_TAG_FORMATS.find((n) => n.value === f.nfcTagFormat)?.label ?? f.nfcTagFormat;

  return (
    <Drawer
      anchor="right"
      open={!!slotId}
      onClose={onClose}
      slotProps={{ paper: { sx: { width: { xs: "100%", md: "66vw" }, maxWidth: 900, p: 0, display: "flex", flexDirection: "column" } } }}
    >
      {/* ── Header ── */}
      <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", px: 2.5, py: 1.5, borderBottom: 1, borderColor: "divider", flexShrink: 0 }}>
        <Box>
          <Typography variant="h6" fontWeight={600} sx={{ lineHeight: 1.2 }}>Slot Details</Typography>
          {data && (
            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: "monospace", fontSize: "0.7rem" }}>
              {locationParts.join(" / ")}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          {hasItem && (
            <Tooltip title={editing ? "View mode" : "Edit mode"}>
              <IconButton size="small" onClick={() => setEditing((v) => !v)}
                sx={editing ? { bgcolor: "primary.main", color: "white", "&:hover": { bgcolor: "primary.dark" } } : {}}>
                {editing ? <VisibilityIcon fontSize="small" /> : <EditIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
          {onPrintSlot && <IconButton size="small" onClick={onPrintSlot}><PrintIcon fontSize="small" /></IconButton>}
          <IconButton size="small" onClick={onClose}><CloseIcon /></IconButton>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ p: 2.5 }}>
          <Skeleton variant="rounded" height={80} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" height={200} />
        </Box>
      ) : data ? (
        <Box sx={{ overflow: "auto", flex: 1 }}>
          {/* ── Slot Section ── */}
          <Box sx={{ px: 2.5, py: 2 }}>
            <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mb: 1.5 }}>
              {data.address && <Chip label={data.address} size="small" variant="outlined" sx={{ fontFamily: "monospace" }} />}
              <Chip label={hasItem ? "Occupied" : "Empty"} size="small" color={hasItem ? "success" : "default"} variant="outlined" />
            </Box>

            {editing ? (
              <>
                <Grid container spacing={1.5} sx={{ mb: 1 }}>
                  <Grid size={{ xs: 6 }}>
                    <TextField fullWidth size="small" label="Slot Label" value={slotLabel}
                      onChange={(e) => setSlotLabel(e.target.value)} placeholder={`Position ${data.position}`} />
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <TextField fullWidth size="small" label="Slot NFC Tag" value={slotNfcTagId}
                      onChange={(e) => setSlotNfcTagId(e.target.value)} placeholder="Optional" />
                  </Grid>
                </Grid>
                <Button size="small" variant="outlined" onClick={handleSaveSlot} disabled={saving} sx={{ textTransform: "none" }}>
                  {saving ? "Saving..." : "Save Slot"}
                </Button>
              </>
            ) : (
              <Grid container spacing={2}>
                <Grid size={{ xs: 4 }}><DisplayField label="Label" value={slotLabel || `Position ${data.position}`} /></Grid>
                <Grid size={{ xs: 4 }}><DisplayField label="NFC Tag" value={slotNfcTagId} mono /></Grid>
                <Grid size={{ xs: 4 }}><DisplayField label="Position" value={data.position} /></Grid>
              </Grid>
            )}

            {/* Live sensor data */}
            {slotStatus && (slotStatus.temperatureC != null || slotStatus.humidityPercent != null || slotStatus.weightStableG != null) && (
              <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mt: 1 }}>
                {slotStatus.weightStableG != null && <Chip label={`${Math.round(slotStatus.weightStableG)}g`} size="small" variant="outlined" />}
                {slotStatus.temperatureC != null && <Chip icon={<DeviceThermostatIcon sx={{ fontSize: "14px !important" }} />} label={`${slotStatus.temperatureC.toFixed(1)}°C`} size="small" variant="outlined" />}
                {slotStatus.humidityPercent != null && <Chip icon={<WaterDropIcon sx={{ fontSize: "14px !important" }} />} label={`${slotStatus.humidityPercent.toFixed(0)}%`} size="small" variant="outlined" />}
              </Box>
            )}
          </Box>

          <Divider />

          {/* ── Item Section ── */}
          {!hasItem ? (
            <Box sx={{ px: 2.5, py: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">No item in this slot.</Typography>
            </Box>
          ) : (
            <Box>
              {/* Item header — always visible */}
              <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.5, px: 2.5, py: 2 }}>
                <Box
                  sx={{
                    width: 48, height: 48, borderRadius: 2, flexShrink: 0,
                    bgcolor: product?.colorHex || f.measuredColorHex || "#888",
                    boxShadow: "inset 0 1px 3px rgba(0,0,0,0.2)",
                    ...(editing ? { cursor: "pointer" } : {}),
                  }}
                  onClick={editing ? () => {
                    const input = document.createElement("input");
                    input.type = "color";
                    input.value = f.measuredColorHex || "#888888";
                    input.onchange = (e) => set("measuredColorHex")((e.target as HTMLInputElement).value);
                    input.click();
                  } : undefined}
                />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="subtitle1" fontWeight={700} noWrap>
                    {product?.name ?? "Unknown Item"}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.25 }}>
                    {brand && <Chip label={brand.name} size="small" variant="outlined" />}
                    {material && <Chip label={material.abbreviation ?? material.name} size="small" variant="outlined" />}
                    {f.packageType && <Chip label={pkgLabel} size="small" variant="outlined" sx={{ textTransform: "capitalize" }} />}
                    <Chip label={statusLabel} size="small" color={f.status === "active" ? "success" : f.status === "empty" ? "default" : "warning"} variant="outlined" />
                  </Box>
                </Box>
              </Box>

              {/* Progress bar */}
              {pct != null && pct > 0 && (
                <Box sx={{ px: 2.5, mb: 1 }}>
                  <Box sx={{ display: "flex", justifyContent: "space-between", mb: 0.25 }}>
                    <Typography variant="caption" color="text.secondary">Remaining</Typography>
                    <Typography variant="caption" fontWeight={600}>{pct}%</Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={pct} sx={{
                    height: 6, borderRadius: 3, bgcolor: "grey.200",
                    "& .MuiLinearProgress-bar": { bgcolor: pct > 50 ? "success.main" : pct > 25 ? "warning.main" : "error.main", borderRadius: 3 },
                  }} />
                </Box>
              )}

              {/* ── Catalog Link ── */}
              <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <LinkIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                    <Typography variant="body2" fontWeight={600}>Catalog Product</Typography>
                    {product && <Chip label="Linked" size="small" color="success" variant="outlined" sx={{ height: 18, "& .MuiChip-label": { px: 0.5, fontSize: "0.65rem" } }} />}
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2.5, pt: 0 }}>
                  {editing ? (
                    <>
                      <Autocomplete size="small" options={productOptions}
                        getOptionLabel={(opt: any) => `${opt.brand?.name ? opt.brand.name + " " : ""}${opt.product?.name ?? ""}`}
                        loading={productSearchLoading} value={selectedProduct}
                        onInputChange={(_, val) => setProductSearch(val)}
                        onChange={(_, val) => setSelectedProduct(val)}
                        isOptionEqualToValue={(a: any, b: any) => a?.product?.id === b?.product?.id}
                        renderOption={(props, opt: any) => (
                          <li {...props} key={opt.product?.id}>
                            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                              {opt.product?.colorHex && <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: opt.product.colorHex, border: 1, borderColor: "divider", flexShrink: 0 }} />}
                              <Typography variant="body2" noWrap>{opt.brand?.name ? `${opt.brand.name} ` : ""}{opt.product?.name}</Typography>
                            </Box>
                          </li>
                        )}
                        renderInput={(params) => <TextField {...params} label="Search catalog products..." placeholder="Type to search..." />}
                        sx={{ mb: 1 }}
                      />
                      {isAdmin && (
                        <Button size="small" startIcon={<AddIcon />} onClick={handleAddToCatalog} disabled={addingToCatalog} sx={{ textTransform: "none" }}>
                          {addingToCatalog ? "Adding..." : "Add to Catalog"}
                        </Button>
                      )}
                    </>
                  ) : product ? (
                    <Box sx={{ p: 1.5, bgcolor: "grey.50", borderRadius: 1 }}>
                      <Typography variant="body2" fontWeight={600}>{brand?.name ? `${brand.name} ` : ""}{product.name}</Typography>
                      {product.colorName && <Typography variant="caption" color="text.secondary">Color: {product.colorName}</Typography>}
                      {product.netWeightG && <Typography variant="caption" color="text.secondary" display="block">Net: {product.netWeightG}g</Typography>}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary">Not linked to a catalog product.</Typography>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* ── Basic Info ── */}
              <Accordion defaultExpanded disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                  <Typography variant="body2" fontWeight={600}>Basic Info</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2.5, pt: 0 }}>
                  {editing ? (
                    <Grid container spacing={1.5}>
                      <Grid size={{ xs: 4 }}>
                        <FormControl fullWidth size="small"><InputLabel>Type</InputLabel>
                          <Select value={f.packageType} label="Type" onChange={(e) => set("packageType")(e.target.value)}>
                            <MenuItem value=""><em>None</em></MenuItem>
                            {PACKAGE_TYPES.map((pt) => <MenuItem key={pt.value} value={pt.value}>{pt.label}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 4 }}>
                        <FormControl fullWidth size="small"><InputLabel>Status</InputLabel>
                          <Select value={f.status} label="Status" onChange={(e) => set("status")(e.target.value)}>
                            {ITEM_STATUSES.map((s) => <MenuItem key={s.value} value={s.value}>{s.label}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 4 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, pt: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">Rating</Typography>
                          <Rating value={f.rating} onChange={(_, v) => set("rating")(v)} size="small" />
                        </Box>
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextField fullWidth size="small" label="Notes" multiline maxRows={3} value={f.notes} onChange={(e) => set("notes")(e.target.value)} />
                      </Grid>
                      {editText("Storage Location", "storageLocation", 12, { placeholder: "Freetext fallback location" })}
                    </Grid>
                  ) : (
                    <Grid container spacing={1} sx={{ "& .MuiGrid2-root": { py: 0.25 } }}>
                      <Grid size={{ xs: 3 }}><DisplayField label="Type" value={pkgLabel} /></Grid>
                      <Grid size={{ xs: 3 }}><DisplayField label="Status" value={statusLabel} /></Grid>
                      <Grid size={{ xs: 3 }}><DisplayField label="Rating" value={f.rating ? <Rating value={f.rating} size="small" readOnly /> : "—"} /></Grid>
                      <Grid size={{ xs: 3 }}><DisplayField label="Storage" value={f.storageLocation} /></Grid>
                      {f.notes && <Grid size={{ xs: 12 }}><DisplayField label="Notes" value={f.notes} /></Grid>}
                    </Grid>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* ── Weight & Dimensions ── */}
              <Accordion defaultExpanded disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                  <Typography variant="body2" fontWeight={600}>Weight & Dimensions</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2.5, pt: 0 }}>
                  {editing ? (
                    <Grid container spacing={1.5}>
                      {editNum("Current Weight", "currentWeightG", "g")}
                      {editNum("Initial Weight", "initialWeightG", "g")}
                      {editNum("% Remaining", "percentRemaining", "%")}
                      {editNum("Net Filament", "netFilamentWeightG", "g")}
                      {editNum("Spool/Pkg Weight", "spoolWeightG", "g")}
                      {editNum("Height", "measuredHeightMm", "mm")}
                      {editNum("Outer Diameter", "measuredSpoolOuterDiameterMm", "mm")}
                      {editNum("Inner Diameter", "measuredSpoolInnerDiameterMm", "mm")}
                      {editNum("Spool Width", "measuredSpoolWidthMm", "mm")}
                      {editNum("Hub Hole Dia.", "measuredSpoolHubHoleDiameterMm", "mm")}
                      {editNum("Measured Spool Wt.", "measuredSpoolWeightG", "g")}
                    </Grid>
                  ) : (
                    <Grid container spacing={1} sx={{ "& .MuiGrid2-root": { py: 0.25 } }}>
                      {displayNum("Current", "currentWeightG", "g")}
                      {displayNum("Initial", "initialWeightG", "g")}
                      {displayNum("% Left", "percentRemaining", "%")}
                      {displayNum("Net Filament", "netFilamentWeightG", "g")}
                      {displayNum("Spool/Pkg", "spoolWeightG", "g")}
                      {displayNum("Height", "measuredHeightMm", "mm")}
                      {displayNum("Outer Dia.", "measuredSpoolOuterDiameterMm", "mm")}
                      {displayNum("Inner Dia.", "measuredSpoolInnerDiameterMm", "mm")}
                      {displayNum("Width", "measuredSpoolWidthMm", "mm")}
                      {displayNum("Hub Hole", "measuredSpoolHubHoleDiameterMm", "mm")}
                      {displayNum("Meas. Spool Wt.", "measuredSpoolWeightG", "g")}
                    </Grid>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* ── Filament Profile (from catalog product) ── */}
              {product?.filamentProfile && (
                <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                    <Typography variant="body2" fontWeight={600}>Filament Profile</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 2.5, pt: 0 }}>
                    {(() => { const fp = product.filamentProfile; return (
                      <Grid container spacing={1} sx={{ "& .MuiGrid2-root": { py: 0.25 } }}>
                        <Grid size={{ xs: 4 }}>
                          <DisplayField label="Nozzle Temp" value={fp.nozzleTempMin && fp.nozzleTempMax ? `${fp.nozzleTempMin}–${fp.nozzleTempMax}°C` : fp.nozzleTempMin ? `${fp.nozzleTempMin}°C` : null} />
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <DisplayField label="Bed Temp" value={fp.bedTempMin && fp.bedTempMax ? `${fp.bedTempMin}–${fp.bedTempMax}°C` : fp.bedTempMin ? `${fp.bedTempMin}°C` : null} />
                        </Grid>
                        <Grid size={{ xs: 4 }}>
                          <DisplayField label="Chamber Temp" value={fp.chamberTempMin && fp.chamberTempMax ? `${fp.chamberTempMin}–${fp.chamberTempMax}°C` : fp.chamberTempMin ? `${fp.chamberTempMin}°C` : null} />
                        </Grid>
                        <Grid size={{ xs: 4 }}><DisplayField label="Diameter" value={fp.diameter ? `${fp.diameter}mm` : null} /></Grid>
                        <Grid size={{ xs: 4 }}><DisplayField label="Min Nozzle" value={fp.minNozzleDiameter ? `${fp.minNozzleDiameter}mm` : null} /></Grid>
                        <Grid size={{ xs: 4 }}><DisplayField label="Filament Length" value={fp.filamentLengthM ? `${fp.filamentLengthM}m` : null} /></Grid>
                        <Grid size={{ xs: 4 }}><DisplayField label="Flow Ratio" value={fp.defaultFlowRatio} /></Grid>
                        <Grid size={{ xs: 4 }}><DisplayField label="Pressure Adv." value={fp.defaultPressureAdvance} /></Grid>
                        <Grid size={{ xs: 4 }}><DisplayField label="Vol. Speed" value={fp.maxVolumetricSpeed ? `${fp.maxVolumetricSpeed} mm³/s` : null} /></Grid>
                        <Grid size={{ xs: 4 }}><DisplayField label="Drying Temp" value={fp.dryingTemp ? `${fp.dryingTemp}°C` : null} /></Grid>
                        <Grid size={{ xs: 4 }}><DisplayField label="Drying Time" value={fp.dryingTimeMin ? `${fp.dryingTimeMin} min` : null} /></Grid>
                        <Grid size={{ xs: 4 }}><DisplayField label="Spool Weight" value={fp.spoolWeightG ? `${fp.spoolWeightG}g` : null} /></Grid>
                        <Grid size={{ xs: 4 }}><DisplayField label="TD" value={fp.transmissionDistance} /></Grid>
                      </Grid>
                    ); })()}
                  </AccordionDetails>
                </Accordion>
              )}

              {/* ── Product Details (from catalog) ── */}
              {product && (
                <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                    <Typography variant="body2" fontWeight={600}>Product Details</Typography>
                  </AccordionSummary>
                  <AccordionDetails sx={{ px: 2.5, pt: 0 }}>
                    <Grid container spacing={1} sx={{ "& .MuiGrid2-root": { py: 0.25 } }}>
                      <Grid size={{ xs: 6 }}><DisplayField label="Name" value={product.name} /></Grid>
                      <Grid size={{ xs: 6 }}><DisplayField label="Brand" value={brand?.name} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Material" value={material?.name} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Category" value={product.category} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Color Name" value={product.colorName} /></Grid>
                      {product.colorHex && (
                        <Grid size={{ xs: 4 }}>
                          <DisplayField label="Product Color" value={
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                              <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: product.colorHex, border: 1, borderColor: "divider" }} />
                              <span>{product.colorHex}</span>
                            </Box>
                          } />
                        </Grid>
                      )}
                      <Grid size={{ xs: 4 }}><DisplayField label="Finish" value={product.finish} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Net Weight" value={product.netWeightG ? `${product.netWeightG}g` : null} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="GTIN" value={product.gtin} mono /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Country" value={product.countryOfOrigin} /></Grid>
                      {product.websiteUrl && (
                        <Grid size={{ xs: 8 }}><DisplayField label="Website" value={product.websiteUrl} mono /></Grid>
                      )}
                      {product.discontinued && (
                        <Grid size={{ xs: 4 }}><Chip label="Discontinued" size="small" color="error" variant="outlined" /></Grid>
                      )}
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              )}

              {/* ── Color ── */}
              <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <Typography variant="body2" fontWeight={600}>Color</Typography>
                    {f.measuredColorHex && <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: f.measuredColorHex, border: 1, borderColor: "divider" }} />}
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2.5, pt: 0 }}>
                  {editing ? (
                    <Grid container spacing={1.5}>
                      <Grid size={{ xs: 5 }}>
                        <TextField fullWidth size="small" label="Hex Color" value={f.measuredColorHex}
                          onChange={(e) => set("measuredColorHex")(e.target.value)} placeholder="#FF5C2E"
                          slotProps={{ input: { startAdornment: f.measuredColorHex ? <InputAdornment position="start"><Box sx={{ width: 16, height: 16, borderRadius: "50%", bgcolor: f.measuredColorHex, border: 1, borderColor: "divider" }} /></InputAdornment> : undefined } }}
                        />
                      </Grid>
                      <Grid size={{ xs: 3 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1, height: "100%" }}>
                          <input type="color" value={f.measuredColorHex || "#888888"}
                            onChange={(e) => set("measuredColorHex")(e.target.value)}
                            style={{ width: 40, height: 32, border: "none", cursor: "pointer", borderRadius: 4, padding: 0 }} />
                        </Box>
                      </Grid>
                      {editNum("LAB L*", "measuredColorLabL", undefined, 4)}
                      {editNum("LAB a*", "measuredColorLabA")}
                      {editNum("LAB b*", "measuredColorLabB")}
                    </Grid>
                  ) : (
                    <Grid container spacing={1} sx={{ "& .MuiGrid2-root": { py: 0.25 } }}>
                      <Grid size={{ xs: 4 }}>
                        <DisplayField label="Hex" value={f.measuredColorHex ? (
                          <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                            <Box sx={{ width: 14, height: 14, borderRadius: "50%", bgcolor: f.measuredColorHex, border: 1, borderColor: "divider" }} />
                            <span>{f.measuredColorHex}</span>
                          </Box>
                        ) : null} mono />
                      </Grid>
                      <Grid size={{ xs: 8 }}>
                        <DisplayField label="LAB" value={f.measuredColorLabL ? `${parseFloat(f.measuredColorLabL).toFixed(1)} / ${parseFloat(f.measuredColorLabA).toFixed(1)} / ${parseFloat(f.measuredColorLabB).toFixed(1)}` : null} mono />
                      </Grid>
                      {item.measuredSpectralData && (
                        <Grid size={{ xs: 12 }}>
                          <DisplayField label="Spectral Data" value="Available (AS7341)" />
                        </Grid>
                      )}
                    </Grid>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* ── NFC & Identification ── */}
              <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                    <NfcIcon sx={{ fontSize: 16, color: "text.secondary" }} />
                    <Typography variant="body2" fontWeight={600}>NFC & Identification</Typography>
                    {f.nfcUid && <Chip label="NFC" size="small" color="primary" variant="outlined" sx={{ height: 18, "& .MuiChip-label": { px: 0.5, fontSize: "0.65rem" } }} />}
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2.5, pt: 0 }}>
                  {editing ? (
                    <Grid container spacing={1.5}>
                      <Grid size={{ xs: 6 }}>
                        <TextField fullWidth size="small" label="NFC UID" value={f.nfcUid}
                          onChange={(e) => set("nfcUid")(e.target.value)} placeholder="04:A3:..." />
                      </Grid>
                      <Grid size={{ xs: 6 }}>
                        <FormControl fullWidth size="small"><InputLabel>NFC Format</InputLabel>
                          <Select value={f.nfcTagFormat} label="NFC Format" onChange={(e) => set("nfcTagFormat")(e.target.value)}>
                            <MenuItem value=""><em>None</em></MenuItem>
                            {NFC_TAG_FORMATS.map((n) => <MenuItem key={n.value} value={n.value}>{n.label}</MenuItem>)}
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid size={{ xs: 4 }}>
                        <FormControlLabel
                          control={<Switch size="small" checked={f.nfcTagWritten} onChange={(e) => set("nfcTagWritten")(e.target.checked)} />}
                          label={<Typography variant="caption">Tag Written</Typography>} sx={{ mt: 0.5 }}
                        />
                      </Grid>
                      {editText("Bambu Tray UID", "bambuTrayUid", 8)}
                      {editText("Barcode Value", "barcodeValue", 7)}
                      {editText("Barcode Format", "barcodeFormat", 5, { placeholder: "CODE128" })}
                      {editText("Lot Number", "lotNumber")}
                      {editText("Serial Number", "serialNumber")}
                    </Grid>
                  ) : (
                    <Grid container spacing={1} sx={{ "& .MuiGrid2-root": { py: 0.25 } }}>
                      <Grid size={{ xs: 4 }}><DisplayField label="NFC UID" value={f.nfcUid} mono /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Format" value={nfcFormatLabel} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Written" value={f.nfcTagWritten ? "Yes" : "No"} /></Grid>
                      <Grid size={{ xs: 6 }}><DisplayField label="Bambu Tray UID" value={f.bambuTrayUid} mono /></Grid>
                      <Grid size={{ xs: 6 }}><DisplayField label="Barcode" value={f.barcodeValue ? `${f.barcodeValue}${f.barcodeFormat ? ` (${f.barcodeFormat})` : ""}` : null} mono /></Grid>
                      <Grid size={{ xs: 6 }}><DisplayField label="Lot Number" value={f.lotNumber} /></Grid>
                      <Grid size={{ xs: 6 }}><DisplayField label="Serial Number" value={f.serialNumber} mono /></Grid>
                    </Grid>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* ── Purchase & Lifecycle ── */}
              <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                  <Typography variant="body2" fontWeight={600}>Purchase & Lifecycle</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2.5, pt: 0 }}>
                  {editing ? (
                    <Grid container spacing={1.5}>
                      <Grid size={{ xs: 4 }}>
                        <TextField fullWidth size="small" label="Price" type="number" value={f.purchasePrice}
                          onChange={(e) => set("purchasePrice")(e.target.value)}
                          slotProps={{ input: { startAdornment: <InputAdornment position="start">$</InputAdornment> } }} />
                      </Grid>
                      {editText("Currency", "purchaseCurrency", 2)}
                      {editDate("Purchased", "purchasedAt")}
                      {editText("Production Date", "productionDate", 6, { placeholder: "YYYY-MM-DD" })}
                      {editDate("Opened", "openedAt")}
                      {editDate("Emptied", "emptiedAt")}
                      {editDate("Expires", "expiresAt", 4)}
                      {editDate("Last Dried", "lastDriedAt", 4)}
                      {editNum("Drying Cycles", "dryingCycleCount", undefined, 4)}
                    </Grid>
                  ) : (
                    <Grid container spacing={1} sx={{ "& .MuiGrid2-root": { py: 0.25 } }}>
                      <Grid size={{ xs: 4 }}><DisplayField label="Price" value={f.purchasePrice ? `${f.purchasePrice} ${f.purchaseCurrency}` : null} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Purchased" value={f.purchasedAt} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Production" value={f.productionDate} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Opened" value={f.openedAt} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Emptied" value={f.emptiedAt} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Expires" value={f.expiresAt} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Last Dried" value={f.lastDriedAt} /></Grid>
                      <Grid size={{ xs: 4 }}><DisplayField label="Drying Cycles" value={f.dryingCycleCount !== "0" ? f.dryingCycleCount : null} /></Grid>
                    </Grid>
                  )}
                </AccordionDetails>
              </Accordion>

              {/* ── Metadata (read-only) ── */}
              <Accordion disableGutters elevation={0} sx={{ "&:before": { display: "none" } }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, minHeight: 40, "& .MuiAccordionSummary-content": { my: 0.5 } }}>
                  <Typography variant="body2" fontWeight={600} color="text.secondary">Metadata</Typography>
                </AccordionSummary>
                <AccordionDetails sx={{ px: 2.5, pt: 0 }}>
                  <Grid container spacing={1} sx={{ "& .MuiGrid2-root": { py: 0.25 } }}>
                    <Grid size={{ xs: 6 }}><DisplayField label="Item ID" value={item.id} mono /></Grid>
                    <Grid size={{ xs: 6 }}><DisplayField label="Product ID" value={item.productId} mono /></Grid>
                    <Grid size={{ xs: 6 }}><DisplayField label="Created" value={fmtDateTime(item.createdAt)} /></Grid>
                    <Grid size={{ xs: 6 }}><DisplayField label="Updated" value={fmtDateTime(item.updatedAt)} /></Grid>
                    {item.intakeScanEventId && <Grid size={{ xs: 12 }}><DisplayField label="Intake Scan" value={item.intakeScanEventId} mono /></Grid>}
                  </Grid>
                </AccordionDetails>
              </Accordion>

              {/* ── Actions ── */}
              <Box sx={{ px: 2.5, py: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                {editing ? (
                  <>
                    <Button variant="contained" size="small" onClick={handleSaveItem} disabled={saving} sx={{ textTransform: "none", flex: 1 }}>
                      {saving ? "Saving..." : "Save All Changes"}
                    </Button>
                    <Button variant="outlined" size="small" onClick={() => setEditing(false)} sx={{ textTransform: "none" }}>Cancel</Button>
                  </>
                ) : (
                  <Button variant="outlined" size="small" startIcon={<EditIcon />} onClick={() => setEditing(true)} sx={{ textTransform: "none" }}>Edit Item</Button>
                )}
                <Button variant="outlined" size="small" color="error" onClick={handleRemoveItem} sx={{ textTransform: "none" }}>
                  Remove from Slot
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      ) : null}
    </Drawer>
  );
}
