"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  QrCode,
  Search,
  ScanLine,
  Weight,
  Ruler,
  Nfc,
  Star,
  Loader2,
  CheckCircle,
  Plus,
  Thermometer,
  Calendar,
  Hash,
  Palette,
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
  getScanSession,
  lookupProductByBarcode,
  searchProducts,
  createIntakeItem,
  createWebSession,
} from "@/lib/actions/scan";
import { createUserItem } from "@/lib/actions/user-library";
import { submitProduct } from "@/lib/actions/central-catalog";
import QRCode from "qrcode";
import { listBrands, listMaterials } from "@/lib/actions/central-catalog";

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Types ─────────────────────────────────────────────────────────────────────

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
  createdAt?: string | Date | null;
};

type BrandOption = { id: string; name: string };
type MaterialOption = { id: string; name: string; abbreviation?: string | null };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  sessionId?: string | null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AddItemSheet({ open, onClose, onSaved, sessionId }: Props) {
  // ── Source ──────────────────────────────────────────────────────────────
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(sessionId ?? null);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // ── Active session (created on open for phone companion) ────────────────
  const [activeSessionId, setActiveSessionId] = useState<string | null>(sessionId ?? null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [showQr, setShowQr] = useState(false);

  // ── NFC reading ─────────────────────────────────────────────────────────
  const [nfcReading, setNfcReading] = useState(false);
  const [nfcSupported, setNfcSupported] = useState(false);
  useEffect(() => { setNfcSupported(typeof window !== "undefined" && "NDEFReader" in window); }, []);

  // ── Product identification ─────────────────────────────────────────────
  const [productMatch, setProductMatch] = useState<any>(null);
  const [showCamera, setShowCamera] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── New product fields (when no catalog match) ─────────────────────────
  const [newProductName, setNewProductName] = useState("");
  const [newBrandId, setNewBrandId] = useState<string>("_none");
  const [newBrandName, setNewBrandName] = useState("");
  const [newMaterialId, setNewMaterialId] = useState<string>("_none");
  const [newColorName, setNewColorName] = useState("");
  const [newColorHex, setNewColorHex] = useState("");
  const [newNetWeightG, setNewNetWeightG] = useState("");
  const [newDiameter, setNewDiameter] = useState("1.75");
  const [newNozzleTempMin, setNewNozzleTempMin] = useState("");
  const [newNozzleTempMax, setNewNozzleTempMax] = useState("");
  const [newBedTempMin, setNewBedTempMin] = useState("");
  const [newBedTempMax, setNewBedTempMax] = useState("");
  const [brands, setBrands] = useState<BrandOption[]>([]);
  const [materials, setMaterials] = useState<MaterialOption[]>([]);
  const [creatingNew, setCreatingNew] = useState(false);

  // ── Station readings (from scan) ───────────────────────────────────────
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [nfcUid, setNfcUid] = useState("");
  const [nfcTagFormat, setNfcTagFormat] = useState("");

  // ── Instance-specific fields ───────────────────────────────────────────
  const [packageType, setPackageType] = useState("_none");
  const [status, setStatus] = useState("active");
  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState(0);
  const [spoolWeightG, setSpoolWeightG] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState("USD");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [openedAt, setOpenedAt] = useState("");
  const [lotNumber, setLotNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");

  // ── Location ───────────────────────────────────────────────────────────
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedSlotAddress, setSelectedSlotAddress] = useState("");
  const [storageLocation, setStorageLocation] = useState("");

  // ── Save state ─────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasProduct = !!productMatch;

  // ── Load sessions + brands + materials on open, create web session ─────
  useEffect(() => {
    if (!open) return;
    setSaved(false);
    setSaveError(null);
    setShowQr(false);
    setQrDataUrl(null);
    setLoadingSessions(true);
    listMyScanSessions({ includeRecent: true, limit: 20 }).then((r) => {
      if (r.data) setSessions(r.data as ScanSession[]);
      setLoadingSessions(false);
    });
    listBrands({ limit: 200 }).then((r) => {
      if (r.data) setBrands(r.data.map((b: any) => ({ id: b.id, name: b.name })));
    });
    listMaterials({ limit: 200 }).then((r) => {
      if (r.data) setMaterials(r.data.map((m: any) => ({ id: m.id, name: m.name, abbreviation: m.abbreviation })));
    });
    if (sessionId) {
      // Load the specific session (e.g. from QR code / direct URL)
      setSelectedSessionId(sessionId);
      setActiveSessionId(sessionId);
      getScanSession(sessionId).then((r) => {
        if (r.data) {
          const s = r.data as ScanSession;
          setSessions((prev) => {
            if (prev.find((p) => p.id === s.id)) return prev;
            return [s, ...prev];
          });
        }
      });
    } else {
      // Create a web session for phone companion
      createWebSession().then((r) => {
        if (r.data) {
          setActiveSessionId(r.data.id);
          setSelectedSessionId(r.data.id);
        }
      });
    }
  }, [open, sessionId]);

  // ── Auto-fill from scan session ────────────────────────────────────────
  useEffect(() => {
    if (!selectedSessionId) return;
    const session = sessions.find((s) => s.id === selectedSessionId);
    if (!session) return;
    setWeight(session.bestWeightG?.toFixed(1) ?? "");
    setHeight(session.bestHeightMm?.toFixed(0) ?? "");
    setColorHex(session.bestColorHex ?? "");
    setNfcUid(session.nfcUid ?? "");
    setNfcTagFormat(session.nfcTagFormat ?? "");
    const parsed = session.nfcParsedData as Record<string, any> | null;
    if (parsed) {
      if (parsed.spoolNetWeight) setNewNetWeightG(String(parsed.spoolNetWeight));
      if (parsed.colorName) setNewColorName(parsed.colorName);
      if (parsed.colorHex) setNewColorHex(parsed.colorHex);
      if (parsed.name) setNewProductName(parsed.name);
      if (parsed.filamentDiameter) setNewDiameter(String(parsed.filamentDiameter));
      if (parsed.nozzleTempMin) setNewNozzleTempMin(String(parsed.nozzleTempMin));
      if (parsed.nozzleTempMax) setNewNozzleTempMax(String(parsed.nozzleTempMax));
      if (parsed.bedTemp) setNewBedTempMin(String(parsed.bedTemp));
      if (parsed.material) {
        // Try to match material by name/abbreviation
        const match = materials.find(
          (m) => m.name.toLowerCase() === parsed.material?.toLowerCase() ||
                 m.abbreviation?.toLowerCase() === parsed.material?.toLowerCase()
        );
        if (match) setNewMaterialId(match.id);
      }
      // If NFC has parsed data but no catalog match, auto-open the new product form
      if (!session.matchedProductId && parsed.name) {
        setCreatingNew(true);
      }
    }
    if (session.bestColorHex && !parsed?.colorHex) setNewColorHex(session.bestColorHex);
    if (session.matchedProductId) {
      setProductMatch({
        match: session.matchMethod,
        product: { id: session.matchedProductId, name: session.productName },
        brand: session.brandName ? { name: session.brandName } : null,
      });
    }
  }, [selectedSessionId, sessions, materials]);

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

  // ── Reset ──────────────────────────────────────────────────────────────
  const resetForm = useCallback(() => {
    setSelectedSessionId(null);
    setActiveSessionId(null);
    setQrDataUrl(null); setShowQr(false);
    setProductMatch(null); setSearchQuery(""); setSearchResults([]);
    setCreatingNew(false);
    setNewProductName(""); setNewBrandId("_none"); setNewBrandName("");
    setNewMaterialId("_none"); setNewColorName(""); setNewColorHex("");
    setNewNetWeightG(""); setNewDiameter("1.75");
    setNewNozzleTempMin(""); setNewNozzleTempMax("");
    setNewBedTempMin(""); setNewBedTempMax("");
    setWeight(""); setHeight(""); setColorHex(""); setNfcUid(""); setNfcTagFormat("");
    setPackageType("_none"); setStatus("active"); setNotes(""); setRating(0);
    setSpoolWeightG(""); setPurchasePrice(""); setPurchaseCurrency("USD");
    setPurchaseDate(""); setOpenedAt(""); setLotNumber(""); setSerialNumber("");
    setSelectedSlotId(null); setSelectedSlotAddress(""); setStorageLocation("");
    setSaved(false); setSaveError(null);
  }, []);

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    const toFloat = (v: string) => v ? parseFloat(v) : undefined;
    let productId = productMatch?.product?.id;

    // If no product matched and user filled in new product fields, submit to catalog
    if (!productId && creatingNew && newProductName) {
      const productResult = await submitProduct({
        name: newProductName,
        brandId: newBrandId !== "_none" ? newBrandId : undefined,
        materialId: newMaterialId !== "_none" ? newMaterialId : undefined,
        category: "filament",
        colorName: newColorName || undefined,
        colorHex: newColorHex || colorHex || undefined,
        netWeightG: toFloat(newNetWeightG),
      });
      if (productResult.error) {
        setSaveError(productResult.error);
        setSaving(false);
        return;
      }
      productId = productResult.data?.id;
    }

    if (selectedSessionId) {
      const sessionParsed = selectedSession?.nfcParsedData as Record<string, any> | null;
      const result = await createIntakeItem({
        productId,
        sessionId: selectedSessionId,
        slotId: selectedSlotId ?? undefined,
        nfcUid: nfcUid || undefined,
        nfcTagFormat: nfcTagFormat || undefined,
        bambuTrayUid: sessionParsed?.trayUid || undefined,
        initialWeightG: toFloat(weight),
        netFilamentWeightG: toFloat(newNetWeightG),
        spoolWeightG: toFloat(spoolWeightG),
        measuredColorHex: colorHex || undefined,
        measuredHeightMm: toFloat(height),
        packageType: packageType !== "_none" ? packageType : undefined,
        purchasePrice: toFloat(purchasePrice),
        purchaseCurrency: purchaseCurrency || undefined,
        purchasedAt: purchaseDate || undefined,
        lotNumber: lotNumber || undefined,
        serialNumber: serialNumber || undefined,
        rating: rating || undefined,
        notes: notes || undefined,
        storageLocation: storageLocation || undefined,
      });
      setSaving(false);
      if (result.error) { setSaveError(result.error); return; }
    } else {
      const result = await createUserItem({
        productId: productId ?? null,
        status,
        packageType: packageType !== "_none" ? packageType : null,
        initialWeightG: toFloat(weight) ?? null,
        currentWeightG: toFloat(weight) ?? null,
        netFilamentWeightG: toFloat(newNetWeightG) ?? null,
        spoolWeightG: toFloat(spoolWeightG) ?? null,
        measuredColorHex: colorHex || newColorHex || null,
        measuredHeightMm: toFloat(height) ?? null,
        nfcUid: nfcUid || null,
        nfcTagFormat: nfcTagFormat || null,
        purchasePrice: toFloat(purchasePrice) ?? null,
        purchaseCurrency: purchaseCurrency || null,
        purchasedAt: purchaseDate ? new Date(purchaseDate) : null,
        openedAt: openedAt ? new Date(openedAt) : null,
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

  const handleClose = () => { resetForm(); onClose(); };
  const selectedSession = sessions.find((s) => s.id === selectedSessionId);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-none! md:w-[80vw] md:max-w-300 p-0 flex flex-col"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-3 border-b bg-[#0F1F23] text-white shrink-0">
          <h2 className="font-display text-base font-bold">Add Item</h2>
          <Button variant="ghost" size="icon" onClick={handleClose} className="text-white/60 hover:text-white hover:bg-white/10 size-8">
            <X className="size-4" />
          </Button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 py-6 flex flex-col gap-6">

            {/* ══════════════════════════════════════════════════════════════
               STEP 1: IDENTIFY — find or define the product
            ══════════════════════════════════════════════════════════════ */}

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                1. Identify
              </h3>

              {/* Source selector */}
              {sessions.length > 0 && (
                <div className="mb-4">
                  <Label className="text-xs text-muted-foreground mb-1 block">From scan station</Label>
                  <Select
                    value={selectedSessionId ?? "_manual"}
                    onValueChange={(v) => {
                      if (v === "_manual") resetForm();
                      else setSelectedSessionId(v);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select source...">
                        {(value: any) => {
                          if (!value || value === "_manual") return "Manual Entry";
                          const s = sessions.find((s) => s.id === value);
                          if (!s) return value;
                          return `${s.productName ?? (s.nfcParsedData as any)?.name ?? s.nfcUid ?? "Scan"} — ${s.bestWeightG ? `${Math.round(s.bestWeightG)}g` : "—"} — ${s.createdAt ? new Date(s.createdAt).toLocaleTimeString() : ""}`;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_manual">Manual Entry</SelectItem>
                      {sessions.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.productName ?? (s.nfcParsedData as any)?.name ?? s.nfcUid ?? "Scan"} — {s.bestWeightG ? `${Math.round(s.bestWeightG)}g` : "—"} — {s.createdAt ? new Date(s.createdAt).toLocaleTimeString() : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Scan session summary + NFC parsed data */}
              {selectedSession && (() => {
                const parsed = selectedSession.nfcParsedData as Record<string, any> | null;
                return (
                  <div className="rounded-lg border bg-muted/30 mb-4 overflow-hidden">
                    {/* Header bar */}
                    <div className="flex items-center gap-3 px-4 py-3 bg-muted/50">
                      {(selectedSession.bestColorHex || parsed?.colorHex) && (
                        <div
                          className="size-10 rounded-full shrink-0 border-2 border-background shadow-inner"
                          style={{ backgroundColor: parsed?.colorHex || selectedSession.bestColorHex }}
                        />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {selectedSession.productName ?? parsed?.name ?? selectedSession.nfcUid ?? "Unidentified"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {parsed?.material && <span className="font-medium">{parsed.material}</span>}
                          {parsed?.variantId && <span> · {parsed.variantId}</span>}
                          {parsed?.materialId && parsed.materialId !== parsed.material && <span> · {parsed.materialId}</span>}
                        </p>
                      </div>
                      {selectedSession.nfcTagFormat && (
                        <Badge variant="outline" className="text-xs shrink-0">
                          <Nfc className="size-3 mr-1" />{selectedSession.nfcTagFormat}
                        </Badge>
                      )}
                    </div>

                    {/* NFC parsed data — all fields */}
                    {parsed && (
                      <div className="px-4 py-3 text-xs space-y-3">
                        {/* Row 1: Color + Weight + Diameter */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                          {parsed.colorHex != null && (
                            <div>
                              <span className="text-muted-foreground">Color</span>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <div className="size-5 rounded-sm border shrink-0" style={{ backgroundColor: parsed.colorHex }} />
                                <span className="font-mono">{parsed.colorHex}</span>
                                <span className="text-muted-foreground">RGBA({parsed.colorR},{parsed.colorG},{parsed.colorB},{parsed.colorA})</span>
                              </div>
                            </div>
                          )}
                          {parsed.spoolNetWeight != null && (
                            <div>
                              <span className="text-muted-foreground">Net Weight</span>
                              <p className="font-semibold mt-0.5">{parsed.spoolNetWeight}g</p>
                            </div>
                          )}
                          {parsed.filamentDiameter != null && (
                            <div>
                              <span className="text-muted-foreground">Diameter</span>
                              <p className="mt-0.5">{parsed.filamentDiameter}mm</p>
                            </div>
                          )}
                          {parsed.filamentLengthM != null && parsed.filamentLengthM > 0 && (
                            <div>
                              <span className="text-muted-foreground">Length</span>
                              <p className="mt-0.5">{parsed.filamentLengthM}m</p>
                            </div>
                          )}
                        </div>

                        {/* Row 2: Temperatures */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                          {(parsed.nozzleTempMin != null || parsed.nozzleTempMax != null) && (
                            <div>
                              <span className="text-muted-foreground">Nozzle Temp</span>
                              <p className="mt-0.5">{parsed.nozzleTempMin}–{parsed.nozzleTempMax}°C</p>
                            </div>
                          )}
                          {parsed.bedTemp != null && parsed.bedTemp > 0 && (
                            <div>
                              <span className="text-muted-foreground">Bed Temp</span>
                              <p className="mt-0.5">{parsed.bedTemp}°C</p>
                            </div>
                          )}
                          {parsed.dryingTemp != null && parsed.dryingTemp > 0 && (
                            <div>
                              <span className="text-muted-foreground">Drying</span>
                              <p className="mt-0.5">{parsed.dryingTemp}°C / {parsed.dryingTime}h</p>
                            </div>
                          )}
                          {parsed.productionDate && (
                            <div>
                              <span className="text-muted-foreground">Production Date</span>
                              <p className="mt-0.5">{parsed.productionDate.replace(/_/g, "-")}</p>
                            </div>
                          )}
                        </div>

                        {/* Row 3: X-Cam */}
                        {(parsed.xcamA != null || parsed.xcamB != null) && (
                          <div>
                            <span className="text-muted-foreground">X-Cam</span>
                            <p className="font-mono mt-0.5">
                              A={parsed.xcamA} B={parsed.xcamB} C={parsed.xcamC} D={parsed.xcamD} E={parsed.xcamE?.toFixed(2)} F={parsed.xcamF?.toFixed(2)}
                            </p>
                          </div>
                        )}

                        {/* Row 4: IDs */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                          {selectedSession.nfcUid && (
                            <div>
                              <span className="text-muted-foreground">NFC UID</span>
                              <p className="font-mono mt-0.5">{selectedSession.nfcUid}</p>
                            </div>
                          )}
                          {parsed.trayUid && (
                            <div>
                              <span className="text-muted-foreground">Tray UID</span>
                              <p className="font-mono mt-0.5 truncate">{parsed.trayUid}</p>
                            </div>
                          )}
                        </div>

                        {/* Row 5: Multicolor + Sectors */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
                          {parsed.multicolorData && (
                            <div>
                              <span className="text-muted-foreground">Multicolor Data</span>
                              <p className="font-mono mt-0.5 truncate">{parsed.multicolorData}</p>
                            </div>
                          )}
                          {parsed.sectorsOk && (
                            <div>
                              <span className="text-muted-foreground">Sectors OK</span>
                              <p className="font-mono mt-0.5">[{(parsed.sectorsOk as number[]).join(", ")}]</p>
                            </div>
                          )}
                        </div>

                        {/* Warnings */}
                        {parsed.parseWarnings && (parsed.parseWarnings as string[]).length > 0 && (
                          <div className="text-amber-600 dark:text-amber-400">
                            <span className="font-medium">Warnings:</span> {(parsed.parseWarnings as string[]).join("; ")}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Station sensor readings */}
                    {(weight || height) && (
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 px-4 py-3 border-t">
                        <div>
                          <Label className="text-xs text-muted-foreground"><Weight className="size-3 inline mr-1" />Measured Weight</Label>
                          <Input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" placeholder="g" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground"><Ruler className="size-3 inline mr-1" />Height</Label>
                          <Input value={height} onChange={(e) => setHeight(e.target.value)} type="number" placeholder="mm" />
                        </div>
                        {colorHex && !parsed?.colorHex && (
                          <div>
                            <Label className="text-xs text-muted-foreground">Measured Color</Label>
                            <div className="flex gap-2">
                              <div className="size-9 rounded-md border shrink-0" style={{ backgroundColor: colorHex }} />
                              <Input value={colorHex} onChange={(e) => setColorHex(e.target.value)} placeholder="#hex" />
                            </div>
                          </div>
                        )}
                        {nfcUid && !parsed && (
                          <div>
                            <Label className="text-xs text-muted-foreground"><Nfc className="size-3 inline mr-1" />NFC UID</Label>
                            <Input value={nfcUid} onChange={(e) => setNfcUid(e.target.value)} placeholder="UID" />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Station readings when no session selected */}
              {!selectedSession && (weight || height || colorHex || nfcUid) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
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
              )}

              {/* Product match display or search */}
              {productMatch ? (
                <div className="flex items-start gap-3 p-4 rounded-lg border bg-green-50/50 dark:bg-green-950/20 border-green-200 dark:border-green-900">
                  <CheckCircle className="size-5 text-green-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">Matched — {productMatch.brand?.name} {productMatch.product?.name}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">Catalog data will be used for this item.</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => { setProductMatch(null); setCreatingNew(false); }}>Change</Button>
                </div>
              ) : creatingNew ? (
                /* ── New product form ── */
                <div className="rounded-lg border border-dashed border-primary/30 bg-primary/5 p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-semibold">New Catalog Entry <Badge variant="outline" className="ml-2 text-[10px]">Unverified</Badge></p>
                    <Button variant="ghost" size="sm" onClick={() => setCreatingNew(false)}>Back to search</Button>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <Label className="text-xs">Product Name *</Label>
                      <Input value={newProductName} onChange={(e) => setNewProductName(e.target.value)} placeholder="e.g. Bambu Lab PLA Basic White" />
                    </div>
                    <div>
                      <Label className="text-xs">Brand</Label>
                      <Select value={newBrandId} onValueChange={(v) => setNewBrandId(v ?? "_none")}>
                        <SelectTrigger><SelectValue>
                          {(value: any) => {
                            if (!value || value === "_none") return "Select brand...";
                            return brands.find((b) => b.id === value)?.name ?? value;
                          }}
                        </SelectValue></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Select brand...</SelectItem>
                          {brands.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Material</Label>
                      <Select value={newMaterialId} onValueChange={(v) => setNewMaterialId(v ?? "_none")}>
                        <SelectTrigger><SelectValue>
                          {(value: any) => {
                            if (!value || value === "_none") return "Select material...";
                            const m = materials.find((m) => m.id === value);
                            return m ? (m.abbreviation ?? m.name) : value;
                          }}
                        </SelectValue></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_none">Select material...</SelectItem>
                          {materials.map((m) => <SelectItem key={m.id} value={m.id}>{m.abbreviation ?? m.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs">Color Name</Label>
                      <Input value={newColorName} onChange={(e) => setNewColorName(e.target.value)} placeholder="e.g. White" />
                    </div>
                    <div>
                      <Label className="text-xs">Color Hex</Label>
                      <div className="flex gap-2">
                        <div className="size-9 rounded-md border shrink-0" style={{ backgroundColor: newColorHex || colorHex || "#ccc" }} />
                        <Input value={newColorHex || colorHex} onChange={(e) => setNewColorHex(e.target.value)} placeholder="#FFFFFF" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Net Weight (g)</Label>
                      <Input value={newNetWeightG} onChange={(e) => setNewNetWeightG(e.target.value)} type="number" placeholder="1000" />
                    </div>
                    <div>
                      <Label className="text-xs">Diameter (mm)</Label>
                      <Input value={newDiameter} onChange={(e) => setNewDiameter(e.target.value)} type="number" placeholder="1.75" />
                    </div>
                  </div>
                  <Accordion>
                    <AccordionItem value="temps">
                      <AccordionTrigger className="text-xs font-medium py-2">Temperature Settings</AccordionTrigger>
                      <AccordionContent>
                        <div className="grid grid-cols-4 gap-3 pt-1">
                          <div><Label className="text-xs">Nozzle Min</Label><Input value={newNozzleTempMin} onChange={(e) => setNewNozzleTempMin(e.target.value)} type="number" placeholder="°C" /></div>
                          <div><Label className="text-xs">Nozzle Max</Label><Input value={newNozzleTempMax} onChange={(e) => setNewNozzleTempMax(e.target.value)} type="number" placeholder="°C" /></div>
                          <div><Label className="text-xs">Bed Min</Label><Input value={newBedTempMin} onChange={(e) => setNewBedTempMin(e.target.value)} type="number" placeholder="°C" /></div>
                          <div><Label className="text-xs">Bed Max</Label><Input value={newBedTempMax} onChange={(e) => setNewBedTempMax(e.target.value)} type="number" placeholder="°C" /></div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  </Accordion>
                </div>
              ) : (
                /* ── Search / scan / manual ── */
                <div className="flex flex-col gap-3">
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="outline" size="sm" onClick={async () => {
                      const sid = activeSessionId ?? selectedSessionId;
                      if (sid) {
                        const url = `${window.location.origin}/scan/${sid}`;
                        const dataUrl = await QRCode.toDataURL(url, { width: 200, margin: 2 });
                        setQrDataUrl(dataUrl);
                        setShowQr(true);
                      } else {
                        setShowCamera(true);
                      }
                    }}>
                      <ScanLine className="size-3.5 mr-1" />Scan with Phone
                    </Button>
                    {nfcSupported && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={nfcReading}
                        onClick={async () => {
                          setNfcReading(true);
                          try {
                            const ndef = new (window as any).NDEFReader();
                            await ndef.scan();
                            ndef.addEventListener("reading", ({ serialNumber, message }: any) => {
                              // Set NFC UID from serial number
                              const uid = serialNumber?.replace(/:/g, "").toUpperCase() ?? "";
                              setNfcUid(uid);
                              setNfcTagFormat("ntag");

                              // Try to extract text records for product matching
                              for (const record of message?.records ?? []) {
                                if (record.recordType === "text") {
                                  const decoder = new TextDecoder(record.encoding || "utf-8");
                                  const text = decoder.decode(record.data);
                                  // Use NFC text as search query
                                  if (text.length > 2) {
                                    handleSearchChange(text);
                                  }
                                } else if (record.recordType === "url") {
                                  const decoder = new TextDecoder();
                                  const url = decoder.decode(record.data);
                                  // Could be an OpenSpool/TigerTag URL
                                  if (url.length > 2) {
                                    handleSearchChange(url);
                                  }
                                }
                              }
                              setNfcReading(false);
                            });
                            ndef.addEventListener("readingerror", () => {
                              setNfcReading(false);
                            });
                            // Auto-stop after 30 seconds
                            setTimeout(() => setNfcReading(false), 30000);
                          } catch (e) {
                            console.error("NFC read failed:", e);
                            setNfcReading(false);
                          }
                        }}
                      >
                        <Nfc className="size-3.5 mr-1" />
                        {nfcReading ? "Waiting for tag..." : "Read NFC"}
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => setCreatingNew(true)}>
                      <Plus className="size-3.5 mr-1" />New Product
                    </Button>
                  </div>

                  {/* QR code for phone companion */}
                  {showQr && qrDataUrl && (
                    <div className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-white">
                      <p className="text-sm font-medium text-center">Use your phone&apos;s camera</p>
                      <img src={qrDataUrl} alt="QR Code" className="size-48" />
                      <p className="text-xs text-muted-foreground text-center max-w-xs">
                        Scan barcodes, QR codes, take photos, and read labels with OCR. Everything syncs to this session automatically.
                      </p>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={() => { setShowQr(false); setShowCamera(true); }}>
                          Use this device&apos;s camera
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setShowQr(false)}>Dismiss</Button>
                      </div>
                    </div>
                  )}

                  {/* Webcam fallback (mobile or if no session) */}
                  {showCamera && (
                    <div>
                      <BarcodeScanner onDetected={handleCodesDetected} onClose={() => setShowCamera(false)} />
                      <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowCamera(false)}>Cancel</Button>
                    </div>
                  )}

                  <div className="relative">
                    <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => handleSearchChange(e.target.value)}
                      placeholder="Search catalog by name, brand, material..."
                      className="pl-9"
                    />
                    {searching && <Loader2 className="absolute right-3 top-2.5 size-4 animate-spin text-muted-foreground" />}
                  </div>
                  {searchResults.length > 0 && (
                    <div className="border rounded-lg max-h-48 overflow-y-auto">
                      {searchResults.map((r: any) => (
                        <button
                          key={r.product?.id ?? r.id}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2"
                          onClick={() => { setProductMatch(r); setSearchQuery(""); setSearchResults([]); }}
                        >
                          {r.product?.colorHex && <div className="size-4 rounded-sm shrink-0" style={{ backgroundColor: r.product.colorHex }} />}
                          <span className="truncate">{r.brand?.name} {r.product?.name}</span>
                          {r.product?.colorName && <span className="text-muted-foreground text-xs ml-auto shrink-0">{r.product.colorName}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {lookingUp && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="size-4 animate-spin" />Looking up barcode...
                    </div>
                  )}
                </div>
              )}
            </section>

            <Separator />

            {/* ══════════════════════════════════════════════════════════════
               STEP 2: DETAILS — instance-specific fields
            ══════════════════════════════════════════════════════════════ */}

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                2. Details
              </h3>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div>
                  <Label className="text-xs">Package Type</Label>
                  <Select value={packageType} onValueChange={(v) => setPackageType(v ?? "_none")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">Auto</SelectItem>
                      {PACKAGE_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v ?? "active")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="empty">Empty</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* Only show weight here if not already shown in station readings */}
                {!selectedSession && (
                  <div>
                    <Label className="text-xs">Weight (g)</Label>
                    <Input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" placeholder="Total weight" />
                  </div>
                )}
                <div>
                  <Label className="text-xs">Spool/Pkg (g)</Label>
                  <Input value={spoolWeightG} onChange={(e) => setSpoolWeightG(e.target.value)} type="number" placeholder="Empty spool" />
                </div>
              </div>

              <div className="flex gap-1 mb-4">
                <Label className="text-xs mr-2 mt-1">Rating</Label>
                {[1, 2, 3, 4, 5].map((s) => (
                  <button key={s} onClick={() => setRating(rating === s ? 0 : s)} className="p-0">
                    <Star className={`size-5 ${s <= rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/30"}`} />
                  </button>
                ))}
              </div>

              <Accordion>
                <AccordionItem value="purchase">
                  <AccordionTrigger className="text-sm font-medium">Purchase & Lifecycle</AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                      <div><Label className="text-xs">Price</Label><Input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} type="number" placeholder="0.00" /></div>
                      <div><Label className="text-xs">Currency</Label><Input value={purchaseCurrency} onChange={(e) => setPurchaseCurrency(e.target.value)} maxLength={3} /></div>
                      <div><Label className="text-xs">Purchased</Label><Input value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} type="date" /></div>
                      <div><Label className="text-xs">Opened</Label><Input value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} type="date" /></div>
                      <div><Label className="text-xs">Lot #</Label><Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} /></div>
                      <div><Label className="text-xs">Serial #</Label><Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} /></div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="mt-3">
                <Label className="text-xs">Notes</Label>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional notes..." />
              </div>
            </section>

            <Separator />

            {/* ══════════════════════════════════════════════════════════════
               STEP 3: LOCATION — where to store it
            ══════════════════════════════════════════════════════════════ */}

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                3. Location
              </h3>
              <SlotPicker
                selectedSlotId={selectedSlotId}
                onSelect={(slotId, address) => { setSelectedSlotId(slotId); setSelectedSlotAddress(address ?? ""); }}
              />
              <div className="mt-2">
                <Input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} placeholder="Or type a freetext location..." className="text-sm" />
              </div>
            </section>
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="border-t px-6 py-3 flex items-center gap-3 shrink-0 bg-background">
          {saveError && <p className="text-sm text-destructive flex-1">Error: {saveError}</p>}
          {saved && <p className="text-sm text-green-600 flex-1 flex items-center gap-1"><CheckCircle className="size-4" /> Saved</p>}
          {!saved && !saveError && <div className="flex-1" />}
          <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || saved}>
            {saving ? <Loader2 className="size-4 animate-spin mr-1" /> : null}
            {saving ? "Saving..." : saved ? "Saved" : creatingNew ? "Save & Submit to Catalog" : "Save to Inventory"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
