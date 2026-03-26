"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ScanLine,
  Search,
  MapPin,
  CheckCircle,
  Printer,
  Trash2,
  Camera,
  Type,
  Weight,
  Ruler,
  Nfc,
  ChevronDown,
  Code,
  Star,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
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

  // -- Editable Station Readings --
  const [weight, setWeight] = useState(stationData?.weightG?.toFixed(1) ?? "");
  const [height, setHeight] = useState(stationData?.heightMm?.toFixed(0) ?? "");
  const [colorHex, setColorHex] = useState(stationData?.colorHex ?? "");

  // -- Product Identification --
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

  // -- OCR --
  const [ocrText, setOcrText] = useState<string | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);

  // -- Photos --
  const [photos, setPhotos] = useState<string[]>([]);
  const [primaryPhoto, setPrimaryPhoto] = useState<number>(0);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // -- Product Details --
  const [packageType, setPackageType] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState("USD");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [productionDate, setProductionDate] = useState(parsed?.productionDate ?? "");
  const [lotNumber, setLotNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [rating, setRating] = useState<number | null>(null);

  // -- Weight Details --
  const [netFilamentWeightG, setNetFilamentWeightG] = useState(parsed?.spoolNetWeight?.toString() ?? "");
  const [spoolWeightG, setSpoolWeightG] = useState("");
  const [storageLocation, setStorageLocation] = useState("");

  // -- Spool Dimensions --
  const [spoolOuterDia, setSpoolOuterDia] = useState("");
  const [spoolInnerDia, setSpoolInnerDia] = useState("");
  const [spoolWidth, setSpoolWidth] = useState("");
  const [spoolHubHoleDia, setSpoolHubHoleDia] = useState("");
  const [spoolMeasuredWeight, setSpoolMeasuredWeight] = useState("");

  // -- Location --
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [selectedSlotAddress, setSelectedSlotAddress] = useState("");

  // -- Save --
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showPrintDialog, setShowPrintDialog] = useState(false);

  // -- Handlers --

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

  // -- Render: Saved --

  if (saved) {
    return (
      <div className="flex flex-col gap-3">
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="size-4 text-green-600" />
          <AlertDescription className="text-green-700">Item added to inventory!</AlertDescription>
        </Alert>
        {productMatch && <ProductCard data={productMatch} />}
        {selectedSlotAddress && (
          <Alert>
            <MapPin className="size-4" />
            <AlertDescription>Stored at: <strong>{selectedSlotAddress}</strong></AlertDescription>
          </Alert>
        )}
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowPrintDialog(true)}>
            <Printer className="size-4 mr-1" />
            Print Label
          </Button>
          <Button onClick={() => router.push("/scan-station")} className="flex-1">
            <ScanLine className="size-4 mr-1" />
            Back to Scans
          </Button>
        </div>
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
      </div>
    );
  }

  // -- Render: Active --

  return (
    <div className="flex flex-col gap-3">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* 1. Station Readings (editable) */}
      <Card>
        <CardContent>
          <p className="text-sm font-semibold text-muted-foreground mb-2">Measurements</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Weight (g)</Label>
              <div className="flex items-center gap-1">
                <Weight className="size-3.5 text-muted-foreground" />
                <Input value={weight} onChange={(e) => setWeight(e.target.value)} type="number" className="h-7" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Height (mm)</Label>
              <div className="flex items-center gap-1">
                <Ruler className="size-3.5 text-muted-foreground" />
                <Input value={height} onChange={(e) => setHeight(e.target.value)} type="number" className="h-7" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color</Label>
              <div className="flex items-center gap-1">
                {colorHex && (
                  <div className="w-4 h-4 rounded-full border border-border shrink-0" style={{ backgroundColor: colorHex }} />
                )}
                <Input value={colorHex} onChange={(e) => setColorHex(e.target.value)} placeholder="#FF5500" className="h-7" />
              </div>
            </div>
            <div className="flex items-end">
              {stationData?.nfcUid && (
                <Badge variant="outline" className="mt-1">
                  <Nfc className="size-3 mr-1" />
                  {stationData.nfcTagFormat && stationData.nfcTagFormat !== "unknown"
                    ? stationData.nfcTagFormat.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
                    : stationData.nfcUid.slice(0, 12) + "..."}
                </Badge>
              )}
            </div>
          </div>
          {/* NFC parsed data chips */}
          {parsed?.material && (
            <div className="mt-2 flex gap-1 flex-wrap">
              <Badge variant="secondary">{parsed.material}</Badge>
              {parsed.name && <Badge variant="outline">{parsed.name}</Badge>}
              {parsed.nozzleTempMin && <Badge variant="outline">Nozzle: {parsed.nozzleTempMin}--{parsed.nozzleTempMax}&deg;C</Badge>}
              {parsed.bedTemp && <Badge variant="outline">Bed: {parsed.bedTemp}&deg;C</Badge>}
              {parsed.spoolNetWeight && <Badge variant="outline">Net: {parsed.spoolNetWeight}g</Badge>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 2. Raw Scan Data (collapsible) */}
      {stationData && (stationData.nfcRawData || stationData.spectralData || stationData.nfcParsedData) && (
        <Accordion>
          <AccordionItem value="raw-data">
            <AccordionTrigger>
              <div className="flex items-center gap-1">
                <Code className="size-4 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">Raw Scan Data</span>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {stationData.nfcParsedData && (
                <div className="mb-3">
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">NFC Parsed</span>
                  <pre className="text-[0.7rem] font-mono bg-muted p-2 rounded overflow-auto max-h-48 m-0">
                    {JSON.stringify(stationData.nfcParsedData, null, 2)}
                  </pre>
                </div>
              )}
              {stationData.nfcRawData && stationData.nfcSectorsRead && (
                <div className="mb-3">
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">
                    NFC Raw ({stationData.nfcSectorsRead} sectors)
                  </span>
                  <pre className="text-[0.65rem] font-mono bg-gray-900 text-gray-100 p-2 rounded overflow-auto max-h-72 m-0">
                    {Array.from({ length: stationData.nfcSectorsRead }).map((_, s) => {
                      const bps = stationData.nfcRawData!.length / 2 / stationData.nfcSectorsRead!;
                      const bpb = bps / 16;
                      const lines: string[] = [`-- Sector ${s} --`];
                      for (let b = 0; b < bpb; b++) {
                        const start = (s * bps + b * 16) * 2;
                        const hex = stationData.nfcRawData!.slice(start, start + 32);
                        const ascii = hex.match(/.{2}/g)?.map(h => { const c = parseInt(h, 16); return c >= 0x20 && c <= 0x7e ? String.fromCharCode(c) : "."; }).join("") ?? "";
                        lines.push(`  B${b}: ${hex.match(/.{2}/g)?.join(" ") ?? hex}  |${ascii}|`);
                      }
                      return lines.join("\n");
                    }).join("\n\n")}
                  </pre>
                </div>
              )}
              {stationData.spectralData && (
                <div>
                  <span className="text-xs font-semibold text-muted-foreground block mb-1">Spectral Data</span>
                  <pre className="text-[0.7rem] font-mono bg-muted p-2 rounded overflow-auto max-h-48 m-0">
                    {JSON.stringify(stationData.spectralData, null, 2)}
                  </pre>
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      )}

      {/* 3. Photos */}
      <Card>
        <CardContent>
          <p className="text-sm font-semibold text-muted-foreground mb-2">Photos</p>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" hidden
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePhotoUpload(f); e.target.value = ""; }}
          />
          {photos.length > 0 && (
            <div className="flex gap-2 flex-wrap mb-2">
              {photos.map((url, i) => (
                <div key={url} className="relative w-20 h-20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`Photo ${i + 1}`}
                    className="w-20 h-20 object-cover rounded cursor-pointer"
                    style={{ border: i === primaryPhoto ? "3px solid var(--primary)" : "1px solid var(--border)" }}
                    onClick={() => setPrimaryPhoto(i)}
                  />
                  <button
                    className="absolute -top-1.5 -right-1.5 p-0.5 rounded-full bg-card shadow-sm hover:bg-destructive hover:text-white"
                    onClick={() => { setPhotos((p) => p.filter((_, j) => j !== i)); if (primaryPhoto >= i && primaryPhoto > 0) setPrimaryPhoto(primaryPhoto - 1); }}
                  >
                    <Trash2 className="size-3" />
                  </button>
                  {i === primaryPhoto && (
                    <Star className="absolute bottom-0.5 left-0.5 size-4 text-primary" style={{ filter: "drop-shadow(0 0 2px white)" }} />
                  )}
                </div>
              ))}
            </div>
          )}
          <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="w-full">
            {uploading ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Camera className="size-4 mr-1" />}
            {uploading ? "Uploading..." : "Take Photo"}
          </Button>
          {photos.length > 1 && (
            <p className="text-xs text-muted-foreground mt-1">
              Tap a photo to set it as primary. Primary photo is used as the product image.
            </p>
          )}
        </CardContent>
      </Card>

      {/* 4. Product Identification */}
      {productMatch ? (
        <>
          <ProductCard data={productMatch} />
          <Button variant="link" size="sm" onClick={() => setProductMatch(null)}>
            Wrong product? Search again
          </Button>
        </>
      ) : (
        <Card>
          <CardContent>
            <p className="text-sm font-semibold text-muted-foreground mb-2">Identify Product</p>
            {showCamera ? (
              <BarcodeScanner onDetected={handleCodesDetected} onClose={() => setShowCamera(false)} />
            ) : (
              <Button onClick={() => setShowCamera(true)} className="w-full mb-2">
                <ScanLine className="size-4 mr-1" />
                Scan Barcode
              </Button>
            )}
            {detectedCodes.length > 0 && (
              <div className="mb-2">
                <div className="flex flex-wrap gap-1 mb-1">
                  {detectedCodes.map((code) => (
                    <Badge key={code.value} variant={code.value === barcode?.value ? "default" : "outline"}>
                      {code.value} ({code.format})
                    </Badge>
                  ))}
                </div>
                {lookingUp && (
                  <div className="flex items-center gap-1">
                    <Loader2 className="size-4 animate-spin" />
                    <span className="text-sm">Looking up...</span>
                  </div>
                )}
                {!lookingUp && !productMatch && <p className="text-sm text-muted-foreground">No match. Try OCR or search.</p>}
              </div>
            )}
            {!showCamera && (
              <Button variant="outline" onClick={handleRunOcr} disabled={ocrRunning} className="w-full mb-2">
                {ocrRunning ? <Loader2 className="size-4 mr-1 animate-spin" /> : <Type className="size-4 mr-1" />}
                {ocrRunning ? "Reading..." : "Capture & Read Label (OCR)"}
              </Button>
            )}
            {ocrText && (
              <Alert className="mb-2">
                <AlertTitle className="text-xs font-semibold">EXTRACTED TEXT</AlertTitle>
                <AlertDescription>
                  <pre className="whitespace-pre-wrap font-mono text-xs">{ocrText}</pre>
                </AlertDescription>
              </Alert>
            )}
            {!showCamera && (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); handleSearch(e.target.value); }}
                  placeholder="Search by name, color, brand..."
                  className="pl-8"
                />
                {searchResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 bg-popover border rounded-lg shadow-lg max-h-60 overflow-auto">
                    {searchResults.map((opt: any) => (
                      <div
                        key={opt.product.id}
                        className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-muted"
                        onClick={() => { setProductMatch({ match: "search", ...opt }); setSearchResults([]); setSearchQuery(""); }}
                      >
                        <div className="w-6 h-6 rounded-full shrink-0 border border-border" style={{ backgroundColor: opt.product.colorHex ?? "#ccc" }} />
                        <div>
                          <p className="text-sm font-semibold">{opt.product.name}</p>
                          <p className="text-xs text-muted-foreground">{opt.brand?.name} &middot; {opt.product.colorName ?? ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* 5. Product Details */}
      <Card>
        <CardContent>
          <p className="text-sm font-semibold text-muted-foreground mb-2">Details</p>

          {/* Package type */}
          <p className="text-xs text-muted-foreground mb-1">Package Type</p>
          <div className="flex flex-wrap gap-1 mb-3">
            {PACKAGE_TYPES.map((pt) => (
              <button
                key={pt.value}
                onClick={() => setPackageType(pt.value === packageType ? null : pt.value)}
                className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                  packageType === pt.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card border-border hover:bg-muted"
                }`}
              >
                {pt.label}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="space-y-1">
              <Label className="text-xs">Purchase Price</Label>
              <div className="flex items-center gap-1">
                <span className="text-sm text-muted-foreground">$</span>
                <Input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} type="number" className="h-7" />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Purchase Date</Label>
              <Input value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} type="date" className="h-7" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Production Date</Label>
              <Input value={productionDate} onChange={(e) => setProductionDate(e.target.value)} placeholder="2025-01-15" className="h-7" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Lot Number</Label>
              <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} className="h-7" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Serial Number</Label>
              <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} className="h-7" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Storage Location</Label>
              <Input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} placeholder="Freetext (if no slot)" className="h-7" />
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs text-muted-foreground">Rating</span>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((v) => (
                <button
                  key={v}
                  onClick={() => setRating(rating === v ? null : v)}
                  className="p-0"
                >
                  <Star
                    className={`size-4 ${rating != null && v <= rating ? "text-yellow-500 fill-yellow-500" : "text-muted-foreground"}`}
                  />
                </button>
              ))}
            </div>
          </div>

          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes..."
            rows={2}
          />
        </CardContent>
      </Card>

      {/* 5b. Weight & Dimensions (expandable) */}
      <Accordion>
        <AccordionItem value="weight-dims">
          <AccordionTrigger>
            <span className="text-sm font-semibold text-muted-foreground">Weight & Spool Dimensions</span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Net Filament (g)</Label>
                <Input value={netFilamentWeightG} onChange={(e) => setNetFilamentWeightG(e.target.value)} type="number" className="h-7" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Spool/Pkg Weight (g)</Label>
                <Input value={spoolWeightG} onChange={(e) => setSpoolWeightG(e.target.value)} type="number" className="h-7" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Measured Spool (g)</Label>
                <Input value={spoolMeasuredWeight} onChange={(e) => setSpoolMeasuredWeight(e.target.value)} type="number" className="h-7" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mt-3">
              <div className="space-y-1">
                <Label className="text-xs">Outer Dia. (mm)</Label>
                <Input value={spoolOuterDia} onChange={(e) => setSpoolOuterDia(e.target.value)} type="number" className="h-7" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Inner Dia. (mm)</Label>
                <Input value={spoolInnerDia} onChange={(e) => setSpoolInnerDia(e.target.value)} type="number" className="h-7" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Width (mm)</Label>
                <Input value={spoolWidth} onChange={(e) => setSpoolWidth(e.target.value)} type="number" className="h-7" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Hub Hole (mm)</Label>
                <Input value={spoolHubHoleDia} onChange={(e) => setSpoolHubHoleDia(e.target.value)} type="number" className="h-7" />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {/* 6. Storage Location */}
      <Card>
        <CardContent>
          <p className="text-sm font-semibold text-muted-foreground mb-1">
            <MapPin className="size-4 inline-block align-middle mr-1" />
            Storage Location
          </p>
          <p className="text-sm text-muted-foreground mb-3">
            Pick a slot or skip to assign later.
          </p>
          <SlotPicker selectedSlotId={selectedSlotId}
            onSelect={(id, addr) => { setSelectedSlotId(id); setSelectedSlotAddress(addr); }}
          />
          {selectedSlotAddress && (
            <Alert className="mt-2 bg-green-50 border-green-200">
              <AlertDescription className="text-green-700">Selected: <strong>{selectedSlotAddress}</strong></AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* 7. Save */}
      <Button size="lg" onClick={handleSave} disabled={saving} className="w-full">
        {saving ? <Loader2 className="size-4 mr-1 animate-spin" /> : <CheckCircle className="size-4 mr-1" />}
        {saving ? "Saving..." : "Save to Inventory"}
      </Button>
    </div>
  );
}
