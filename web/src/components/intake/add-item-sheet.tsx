"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  QrCode,
  Search,
  ScanLine,
  Type,
  Weight,
  Ruler,
  Nfc,
  Camera,
  Star,
  Loader2,
  CheckCircle,
  MapPin,
  Printer,
  Upload,
  ChevronDown,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { BarcodeScanner, type DetectedCode } from "@/components/scan/barcode-scanner";
import { ProductCard } from "@/components/scan/product-card";
import { SlotPicker } from "@/components/scan/slot-picker";
import {
  listMyScanSessions,
  lookupProductByBarcode,
  searchProducts,
  createIntakeItem,
} from "@/lib/actions/scan";
import { createUserItem } from "@/lib/actions/user-library";
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

type ScanSession = {
  id: string;
  status: string;
  bestWeightG?: number | null;
  bestColorHex?: string | null;
  bestColorLabL?: number | null;
  bestColorLabA?: number | null;
  bestColorLabB?: number | null;
  bestHeightMm?: number | null;
  nfcUid?: string | null;
  nfcTagFormat?: string | null;
  nfcParsedData?: Record<string, any> | null;
  matchedProductId?: string | null;
  matchConfidence?: number | null;
  matchMethod?: string | null;
  productName?: string | null;
  brandName?: string | null;
  createdAt?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  sessionId?: string | null;
};

export function AddItemSheet({ open, onClose, onSaved, sessionId }: Props) {
  // ── Source ──────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessionId ?? null);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // ── Station Readings ───────────────────────────────────────────────────
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [nfcUid, setNfcUid] = useState("");
  const [nfcTagFormat, setNfcTagFormat] = useState("");

  // ── Product Identification ─────────────────────────────────────────────
  const [showCamera, setShowCamera] = useState(false);
  const [barcode, setBarcode] = useState<{ value: string; format: string } | null>(null);
  const [productMatch, setProductMatch] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── Details ────────────────────────────────────────────────────────────
  const [packageType, setPackageType] = useState<string>("_none");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number>(0);
  const [initialWeightG, setInitialWeightG] = useState("");
  const [netFilamentWeightG, setNetFilamentWeightG] = useState("");
  const [spoolWeightG, setSpoolWeightG] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState("USD");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [openedAt, setOpenedAt] = useState("");
  const [productionDate, setProductionDate] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [barcodeValue, setBarcodeValue] = useState("");
  const [barcodeFormat, setBarcodeFormat] = useState("");

  // ── Dimensions ─────────────────────────────────────────────────────────
  const [spoolOuterDia, setSpoolOuterDia] = useState("");
  const [spoolInnerDia, setSpoolInnerDia] = useState("");
  const [spoolWidth, setSpoolWidth] = useState("");
  const [spoolHubHoleDia, setSpoolHubHoleDia] = useState("");
  const [spoolMeasuredWeight, setSpoolMeasuredWeight] = useState("");

  // ── Location ───────────────────────────────────────────────────────────
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedSlotAddress, setSelectedSlotAddress] = useState("");
  const [storageLocation, setStorageLocation] = useState("");

  // ── Save ────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  // ── Load pending scan sessions ─────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setSaveError(null);
    setLoadingSessions(true);
    listMyScanSessions({ status: "active", limit: 20 }).then((result) => {
      if (result.data) setSessions(result.data as ScanSession[]);
      setLoadingSessions(false);
    });
  }, [open]);

  // ── Auto-fill from selected session ────────────────────────────────────
  useEffect(() => {
    if (!selectedSessionId) return;
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (!session) return;

    setWeight(session.bestWeightG?.toFixed(1) ?? "");
    setHeight(session.bestHeightMm?.toFixed(0) ?? "");
    setColorHex(session.bestColorHex ?? "");
    setNfcUid(session.nfcUid ?? "");
    setNfcTagFormat(session.nfcTagFormat ?? "");

    const parsed = session.nfcParsedData;
    if (parsed?.spoolNetWeight) setNetFilamentWeightG(String(parsed.spoolNetWeight));
    if (parsed?.productionDate) setProductionDate(parsed.productionDate);

    if (session.matchedProductId) {
      setProductMatch({
        match: session.matchMethod,
        product: { id: session.matchedProductId, name: session.productName },
        brand: session.brandName ? { name: session.brandName } : null,
      });
    }
  }, [selectedSessionId, sessions]);

  // ── Product search ─────────────────────────────────────────────────────
  const handleSearchChange = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (query.length < 2) { setSearchResults([]); return; }
    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      const result = await searchProducts(query);
      if (result.data) setSearchResults(result.data);
      setSearching(false);
    }, 300);
  };

  const handleCodesDetected = useCallback(async (codes: DetectedCode[]) => {
    setShowCamera(false);
    const primary = codes[0];
    if (primary) {
      setBarcode({ value: primary.value, format: primary.format });
      setBarcodeValue(primary.value);
      setBarcodeFormat(primary.format);
      setLookingUp(true);
      for (const code of codes) {
        const result = await lookupProductByBarcode(code.value);
        if (result.data) {
          setProductMatch(result.data);
          setLookingUp(false);
          return;
        }
      }
      setLookingUp(false);
    }
  }, []);

  // ── Reset form ─────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setSelectedSessionId(null);
    setWeight(""); setHeight(""); setColorHex(""); setNfcUid(""); setNfcTagFormat("");
    setProductMatch(null); setSearchQuery(""); setSearchResults([]);
    setBarcode(null); setBarcodeValue(""); setBarcodeFormat("");
    setPackageType("_none"); setStatus("active"); setNotes(""); setRating(0);
    setInitialWeightG(""); setNetFilamentWeightG(""); setSpoolWeightG("");
    setPurchasePrice(""); setPurchaseCurrency("USD"); setPurchaseDate("");
    setOpenedAt(""); setProductionDate(""); setLotNumber(""); setSerialNumber("");
    setSpoolOuterDia(""); setSpoolInnerDia(""); setSpoolWidth("");
    setSpoolHubHoleDia(""); setSpoolMeasuredWeight("");
    setSelectedSlotId(null); setSelectedSlotAddress(""); setStorageLocation("");
    setSaved(false); setSaveError(null);
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);

    const toFloat = (v: string) => v ? parseFloat(v) : undefined;

    if (selectedSessionId) {
      // Save via intake (resolves session)
      const result = await createIntakeItem({
        productId: productMatch?.product?.id,
        sessionId: selectedSessionId,
        slotId: selectedSlotId ?? undefined,
        barcodeValue: barcodeValue || undefined,
        barcodeFormat: barcodeFormat || undefined,
        nfcUid: nfcUid || undefined,
        nfcTagFormat: nfcTagFormat || undefined,
        initialWeightG: toFloat(weight),
        netFilamentWeightG: toFloat(netFilamentWeightG),
        spoolWeightG: toFloat(spoolWeightG),
        measuredColorHex: colorHex || undefined,
        measuredHeightMm: toFloat(height),
        measuredSpoolOuterDiameterMm: toFloat(spoolOuterDia),
        measuredSpoolInnerDiameterMm: toFloat(spoolInnerDia),
        measuredSpoolWidthMm: toFloat(spoolWidth),
        measuredSpoolHubHoleDiameterMm: toFloat(spoolHubHoleDia),
        measuredSpoolWeightG: toFloat(spoolMeasuredWeight),
        packageType: packageType !== "_none" ? packageType : undefined,
        purchasePrice: toFloat(purchasePrice),
        purchaseCurrency: purchaseCurrency || undefined,
        purchasedAt: purchaseDate || undefined,
        productionDate: productionDate || undefined,
        lotNumber: lotNumber || undefined,
        serialNumber: serialNumber || undefined,
        rating: rating || undefined,
        notes: notes || undefined,
        storageLocation: storageLocation || undefined,
      });
      setSaving(false);
      if (result.error) { setSaveError(result.error); return; }
    } else {
      // Manual save (no session)
      const result = await createUserItem({
        productId: productMatch?.product?.id ?? null,
        status,
        packageType: packageType !== "_none" ? packageType : null,
        initialWeightG: toFloat(weight) ?? null,
        currentWeightG: toFloat(weight) ?? null,
        netFilamentWeightG: toFloat(netFilamentWeightG) ?? null,
        spoolWeightG: toFloat(spoolWeightG) ?? null,
        measuredColorHex: colorHex || null,
        measuredHeightMm: toFloat(height) ?? null,
        nfcUid: nfcUid || null,
        nfcTagFormat: nfcTagFormat || null,
        barcodeValue: barcodeValue || null,
        barcodeFormat: barcodeFormat || null,
        purchasePrice: toFloat(purchasePrice) ?? null,
        purchaseCurrency: purchaseCurrency || null,
        purchasedAt: purchaseDate ? new Date(purchaseDate) : null,
        openedAt: openedAt ? new Date(openedAt) : null,
        productionDate: productionDate || null,
        lotNumber: lotNumber || null,
        serialNumber: serialNumber || null,
        rating: rating || null,
        notes: notes || null,
        storageLocation: storageLocation || null,
        currentSlotId: selectedSlotId ?? null,
      });
      setSaving(false);
      if (result.error) { setSaveError(result.error); return; }
    }

    setSaved(true);
    onSaved();
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // ── Render ──────────────────────────────────────────────────────────────
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-none! md:w-[80vw] md:max-w-300 p-0 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b bg-[#0F1F23] text-white shrink-0">
          <h2 className="font-display text-lg font-bold">Add Item</h2>
          <Button variant="ghost" size="icon" onClick={handleClose} className="text-white hover:bg-white/10">
            <X className="size-5" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-4xl mx-auto px-6 py-6 flex flex-col gap-6">

            {/* ── Source Selector ── */}
            <section>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Source</Label>
              <Select
                value={selectedSessionId ?? "_manual"}
                onValueChange={(v) => {
                  if (v === "_manual") {
                    resetForm();
                  } else {
                    setSelectedSessionId(v);
                  }
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select source..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_manual">Manual Entry</SelectItem>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.productName ?? s.nfcUid ?? "Scan"} — {s.bestWeightG ? `${Math.round(s.bestWeightG)}g` : "no weight"} — {s.createdAt ? new Date(s.createdAt).toLocaleString() : ""}
                    </SelectItem>
                  ))}
                  {loadingSessions && <SelectItem value="_loading" disabled>Loading...</SelectItem>}
                </SelectContent>
              </Select>

              {selectedSession && (
                <div className="mt-3 flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                  {selectedSession.bestColorHex && (
                    <div
                      className="size-8 rounded-md shrink-0 shadow-inner"
                      style={{ backgroundColor: selectedSession.bestColorHex }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {selectedSession.productName ?? selectedSession.nfcUid ?? "Unidentified"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedSession.bestWeightG ? `${Math.round(selectedSession.bestWeightG)}g` : "—"}
                      {selectedSession.nfcTagFormat && ` · ${selectedSession.nfcTagFormat}`}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      // TODO: Show QR code modal with session URL
                      navigator.clipboard.writeText(`${window.location.origin}/scan/${selectedSession.id}`);
                    }}
                  >
                    <QrCode className="size-3.5 mr-1" />
                    Open on Phone
                  </Button>
                </div>
              )}
            </section>

            <Separator />

            {/* ── Station Readings ── */}
            {(weight || height || colorHex || nfcUid) && (
              <>
                <section>
                  <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Station Readings</Label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div>
                      <Label className="text-xs text-muted-foreground"><Weight className="size-3 inline mr-1" />Weight</Label>
                      <Input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" placeholder="g" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground"><Ruler className="size-3 inline mr-1" />Height</Label>
                      <Input value={height} onChange={(e) => setHeight(e.target.value)} type="number" placeholder="mm" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Color</Label>
                      <div className="flex gap-2">
                        <div className="size-9 rounded-md border shrink-0" style={{ backgroundColor: colorHex || "#ccc" }} />
                        <Input value={colorHex} onChange={(e) => setColorHex(e.target.value)} placeholder="#hex" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground"><Nfc className="size-3 inline mr-1" />NFC</Label>
                      <div className="flex items-center gap-1">
                        <Input value={nfcUid} onChange={(e) => setNfcUid(e.target.value)} placeholder="UID" className="flex-1" />
                        {nfcTagFormat && <Badge variant="outline" className="text-[10px] shrink-0">{nfcTagFormat}</Badge>}
                      </div>
                    </div>
                  </div>
                </section>
                <Separator />
              </>
            )}

            {/* ── Product Match ── */}
            <section>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Product</Label>
              {productMatch ? (
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <ProductCard data={productMatch} />
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setProductMatch(null)}>Change</Button>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setShowCamera(true)}>
                      <ScanLine className="size-3.5 mr-1" />
                      Scan Barcode
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => {
                      const el = document.getElementById("product-search-input");
                      el?.focus();
                    }}>
                      <Search className="size-3.5 mr-1" />
                      Search Catalog
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="product-search-input"
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search by name, brand, material..."
                    />
                    {searching && <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-muted-foreground" />}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      {searchResults.map((r: any) => (
                        <button
                          key={r.product?.id ?? r.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2"
                          onClick={() => {
                            setProductMatch(r);
                            setSearchQuery("");
                            setSearchResults([]);
                          }}
                        >
                          {r.product?.colorHex && (
                            <div className="size-4 rounded-sm shrink-0" style={{ backgroundColor: r.product.colorHex }} />
                          )}
                          <span>{r.brand?.name} {r.product?.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {lookingUp && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />
                      Looking up barcode...
                    </div>
                  )}
                </div>
              )}
              {showCamera && (
                <div className="mt-3">
                  <BarcodeScanner onDetected={handleCodesDetected} />
                  <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowCamera(false)}>Cancel</Button>
                </div>
              )}
            </section>

            <Separator />

            {/* ── Detail Sections ── */}
            <Accordion type="multiple" defaultValue={["basic", "weight"]}>
              {/* Basic Info */}
              <AccordionItem value="basic">
                <AccordionTrigger className="text-sm font-semibold">Basic Info</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                    <div>
                      <Label className="text-xs">Package Type</Label>
                      <Select value={packageType} onValueChange={setPackageType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">None</SelectItem>
                          {PACKAGE_TYPES.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Status</Label>
                      <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">Active</SelectItem>
                          <SelectItem value="empty">Empty</SelectItem>
                          <SelectItem value="archived">Archived</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Label className="text-xs">Rating</Label>
                      <div className="flex gap-0.5 pt-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <button key={s} onClick={() => setRating(rating === s ? 0 : s)} className="p-0">
                            <Star className={`size-5 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3">
                    <Label className="text-xs">Notes</Label>
                    <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Weight & Dimensions */}
              <AccordionItem value="weight">
                <AccordionTrigger className="text-sm font-semibold">Weight & Dimensions</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-3 gap-3 pt-2">
                    <div>
                      <Label className="text-xs">Initial Weight</Label>
                      <Input value={initialWeightG || weight} onChange={(e) => setInitialWeightG(e.target.value)} type="number" placeholder="g" />
                    </div>
                    <div>
                      <Label className="text-xs">Net Filament</Label>
                      <Input value={netFilamentWeightG} onChange={(e) => setNetFilamentWeightG(e.target.value)} type="number" placeholder="g" />
                    </div>
                    <div>
                      <Label className="text-xs">Spool/Pkg Weight</Label>
                      <Input value={spoolWeightG} onChange={(e) => setSpoolWeightG(e.target.value)} type="number" placeholder="g" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mt-3">
                    <div>
                      <Label className="text-xs">Outer Dia.</Label>
                      <Input value={spoolOuterDia} onChange={(e) => setSpoolOuterDia(e.target.value)} type="number" placeholder="mm" />
                    </div>
                    <div>
                      <Label className="text-xs">Inner Dia.</Label>
                      <Input value={spoolInnerDia} onChange={(e) => setSpoolInnerDia(e.target.value)} type="number" placeholder="mm" />
                    </div>
                    <div>
                      <Label className="text-xs">Width</Label>
                      <Input value={spoolWidth} onChange={(e) => setSpoolWidth(e.target.value)} type="number" placeholder="mm" />
                    </div>
                    <div>
                      <Label className="text-xs">Hub Hole</Label>
                      <Input value={spoolHubHoleDia} onChange={(e) => setSpoolHubHoleDia(e.target.value)} type="number" placeholder="mm" />
                    </div>
                    <div>
                      <Label className="text-xs">Meas. Spool Wt.</Label>
                      <Input value={spoolMeasuredWeight} onChange={(e) => setSpoolMeasuredWeight(e.target.value)} type="number" placeholder="g" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Purchase & Lifecycle */}
              <AccordionItem value="purchase">
                <AccordionTrigger className="text-sm font-semibold">Purchase & Lifecycle</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3 pt-2">
                    <div>
                      <Label className="text-xs">Purchase Price</Label>
                      <Input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} type="number" placeholder="0.00" />
                    </div>
                    <div>
                      <Label className="text-xs">Currency</Label>
                      <Input value={purchaseCurrency} onChange={(e) => setPurchaseCurrency(e.target.value)} placeholder="USD" maxLength={3} />
                    </div>
                    <div>
                      <Label className="text-xs">Purchased</Label>
                      <Input value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} type="date" />
                    </div>
                    <div>
                      <Label className="text-xs">Opened</Label>
                      <Input value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} type="date" />
                    </div>
                    <div>
                      <Label className="text-xs">Production Date</Label>
                      <Input value={productionDate} onChange={(e) => setProductionDate(e.target.value)} placeholder="e.g. 2025-Q3" />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* NFC & Identification */}
              <AccordionItem value="nfc">
                <AccordionTrigger className="text-sm font-semibold">NFC & Identification</AccordionTrigger>
                <AccordionContent>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <Label className="text-xs">NFC UID</Label>
                      <Input value={nfcUid} onChange={(e) => setNfcUid(e.target.value)} placeholder="Tag UID" />
                    </div>
                    <div>
                      <Label className="text-xs">Tag Format</Label>
                      <Input value={nfcTagFormat} onChange={(e) => setNfcTagFormat(e.target.value)} placeholder="e.g. bambu_mifare" />
                    </div>
                    <div>
                      <Label className="text-xs">Barcode Value</Label>
                      <Input value={barcodeValue} onChange={(e) => setBarcodeValue(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Barcode Format</Label>
                      <Input value={barcodeFormat} onChange={(e) => setBarcodeFormat(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Lot Number</Label>
                      <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
                    </div>
                    <div>
                      <Label className="text-xs">Serial Number</Label>
                      <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>

            <Separator />

            {/* ── Location ── */}
            <section>
              <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 block">Storage Location</Label>
              <SlotPicker
                selectedSlotId={selectedSlotId}
                onSelect={(slotId, address) => {
                  setSelectedSlotId(slotId);
                  setSelectedSlotAddress(address ?? "");
                }}
              />
              <div className="mt-2">
                <Input
                  value={storageLocation}
                  onChange={(e) => setStorageLocation(e.target.value)}
                  placeholder="Or type a freetext location..."
                  className="text-sm"
                />
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex items-center gap-3 shrink-0 bg-background">
          {saveError && (
            <p className="text-sm text-destructive flex-1">Save failed: {saveError}</p>
          )}
          {saved && (
            <p className="text-sm text-green-600 flex-1 flex items-center gap-1">
              <CheckCircle className="size-4" /> Saved to inventory
            </p>
          )}
          {!saved && !saveError && <div className="flex-1" />}
          <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || saved}>
            {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            {saving ? "Saving..." : saved ? "Saved" : "Save to Inventory"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
