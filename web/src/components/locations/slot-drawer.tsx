"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  Nfc,
  Printer,
  Pencil,
  Eye,
  Thermometer,
  Droplets,
  ChevronDown,
  Link,
  Plus,
  Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
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
  if (!val) return "\u2014";
  const d = typeof val === "string" ? new Date(val) : val;
  return isNaN(d.getTime()) ? String(val) : d.toLocaleString();
}

function DisplayField({ label, value, mono }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="mb-1.5">
      <span className="text-xs text-muted-foreground block leading-tight">{label}</span>
      <span className={`text-sm font-medium truncate block ${mono ? "font-mono text-xs" : ""}`}>
        {value || "\u2014"}
      </span>
    </div>
  );
}

function StarRating({ value, onChange, size = 16, readOnly }: { value: number | null; onChange?: (v: number | null) => void; size?: number; readOnly?: boolean }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`p-0 ${!readOnly && onChange ? "cursor-pointer" : "cursor-default"}`}
          onClick={() => !readOnly && onChange?.(value === star ? null : star)}
          disabled={readOnly || !onChange}
        >
          <Star
            className={`${value != null && star <= value ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40"}`}
            style={{ width: size, height: size }}
          />
        </button>
      ))}
    </div>
  );
}

export function SlotDrawer({ slotId, onClose, onUpdate, onPrintSlot }: Props) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [editing, setEditing] = useState(false);

  const [slotLabel, setSlotLabel] = useState("");
  const [slotNfcTagId, setSlotNfcTagId] = useState("");

  const [f, setF] = useState<Record<string, any>>({});
  const set = (key: string) => (val: any) => setF((prev) => ({ ...prev, [key]: val }));

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
    const result = await updateUserItem(item.id, {
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
    if (result.error) {
      console.error("Failed to save item:", result.error);
      setSaveError(result.error);
    }
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
  const editNum = (label: string, key: string, unit?: string, cols = "col-span-4") => (
    <div className={cols}>
      <Label>{label}</Label>
      <div className="relative">
        <Input type="number" value={f[key] ?? ""} onChange={(e) => set(key)(e.target.value)} />
        {unit && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );

  const editText = (label: string, key: string, cols = "col-span-6", props?: Record<string, any>) => (
    <div className={cols}>
      <Label>{label}</Label>
      <Input value={f[key] ?? ""} onChange={(e) => set(key)(e.target.value)} {...props} />
    </div>
  );

  const editDate = (label: string, key: string, cols = "col-span-4") => (
    <div className={cols}>
      <Label>{label}</Label>
      <Input type="date" value={f[key] ?? ""} onChange={(e) => set(key)(e.target.value)} />
    </div>
  );

  const displayNum = (label: string, key: string, unit?: string, cols = "col-span-4") => (
    <div className={cols}>
      <DisplayField label={label} value={f[key] ? `${f[key]}${unit ? ` ${unit}` : ""}` : null} />
    </div>
  );

  const pkgLabel = PACKAGE_TYPES.find((p) => p.value === f.packageType)?.label ?? f.packageType;
  const statusLabel = ITEM_STATUSES.find((s) => s.value === f.status)?.label ?? f.status;
  const nfcFormatLabel = NFC_TAG_FORMATS.find((n) => n.value === f.nfcTagFormat)?.label ?? f.nfcTagFormat;

  return (
    <Sheet open={!!slotId} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="w-full sm:max-w-none! md:w-[66vw] md:max-w-225 p-0 flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b shrink-0">
          <div>
            <h2 className="text-lg font-semibold leading-tight">Slot Details</h2>
            {data && (
              <span className="text-xs text-muted-foreground font-mono">{locationParts.join(" / ")}</span>
            )}
          </div>
          <div className="flex gap-1 items-center">
            {hasItem && (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant={editing ? "default" : "ghost"}
                      size="icon-xs"
                      onClick={() => setEditing((v) => !v)}
                    />
                  }
                >
                  {editing ? <Eye className="size-4" /> : <Pencil className="size-4" />}
                </TooltipTrigger>
                <TooltipContent>{editing ? "View mode" : "Edit mode"}</TooltipContent>
              </Tooltip>
            )}
            {onPrintSlot && (
              <Button variant="ghost" size="icon-xs" onClick={onPrintSlot}>
                <Printer className="size-4" />
              </Button>
            )}
            <Button variant="ghost" size="icon-xs" onClick={onClose}>
              <X className="size-5" />
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="p-5">
            <Skeleton className="h-20 mb-4 rounded-lg" />
            <Skeleton className="h-48 rounded-lg" />
          </div>
        ) : data ? (
          <div className="overflow-auto flex-1">
            {/* Slot Section */}
            <div className="px-5 py-4">
              <div className="flex gap-1.5 flex-wrap mb-3">
                {data.address && <Badge variant="outline" className="font-mono">{data.address}</Badge>}
                <Badge variant="outline" className={hasItem ? "border-green-500 text-green-700" : ""}>{hasItem ? "Occupied" : "Empty"}</Badge>
              </div>

              {editing ? (
                <>
                  <div className="grid grid-cols-12 gap-3 mb-2">
                    <div className="col-span-6">
                      <Label>Slot Label</Label>
                      <Input value={slotLabel} onChange={(e) => setSlotLabel(e.target.value)} placeholder={`Position ${data.position}`} />
                    </div>
                    <div className="col-span-6">
                      <Label>Slot NFC Tag</Label>
                      <Input value={slotNfcTagId} onChange={(e) => setSlotNfcTagId(e.target.value)} placeholder="Optional" />
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={handleSaveSlot} disabled={saving}>
                    {saving ? "Saving..." : "Save Slot"}
                  </Button>
                </>
              ) : (
                <div className="grid grid-cols-12 gap-4">
                  <div className="col-span-4"><DisplayField label="Label" value={slotLabel || `Position ${data.position}`} /></div>
                  <div className="col-span-4"><DisplayField label="NFC Tag" value={slotNfcTagId} mono /></div>
                  <div className="col-span-4"><DisplayField label="Position" value={data.position} /></div>
                </div>
              )}

              {/* Live sensor data */}
              {slotStatus && (slotStatus.temperatureC != null || slotStatus.humidityPercent != null || slotStatus.weightStableG != null) && (
                <div className="flex gap-2 flex-wrap mt-2">
                  {slotStatus.weightStableG != null && <Badge variant="outline">{Math.round(slotStatus.weightStableG)}g</Badge>}
                  {slotStatus.temperatureC != null && (
                    <Badge variant="outline"><Thermometer className="size-3 mr-0.5" />{slotStatus.temperatureC.toFixed(1)}&deg;C</Badge>
                  )}
                  {slotStatus.humidityPercent != null && (
                    <Badge variant="outline"><Droplets className="size-3 mr-0.5" />{slotStatus.humidityPercent.toFixed(0)}%</Badge>
                  )}
                </div>
              )}
            </div>

            <Separator />

            {/* Item Section */}
            {!hasItem ? (
              <div className="px-5 py-6 text-center">
                <p className="text-sm text-muted-foreground">No item in this slot.</p>
              </div>
            ) : (
              <div>
                {/* Item header */}
                <div className="flex items-start gap-3 px-5 py-4">
                  <div
                    className="w-12 h-12 rounded-lg shrink-0 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]"
                    style={{ backgroundColor: product?.colorHex || f.measuredColorHex || "#888", ...(editing ? { cursor: "pointer" } : {}) }}
                    onClick={editing ? () => {
                      const input = document.createElement("input");
                      input.type = "color";
                      input.value = f.measuredColorHex || "#888888";
                      input.onchange = (e) => set("measuredColorHex")((e.target as HTMLInputElement).value);
                      input.click();
                    } : undefined}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{product?.name ?? "Unknown Item"}</p>
                    <div className="flex gap-1 flex-wrap mt-0.5">
                      {brand && <Badge variant="outline">{brand.name}</Badge>}
                      {material && <Badge variant="outline">{material.abbreviation ?? material.name}</Badge>}
                      {f.packageType && <Badge variant="outline" className="capitalize">{pkgLabel}</Badge>}
                      <Badge variant="outline" className={f.status === "active" ? "border-green-500 text-green-700" : f.status === "archived" ? "border-yellow-500 text-yellow-700" : ""}>{statusLabel}</Badge>
                    </div>
                  </div>
                </div>

                {/* Progress bar */}
                {pct != null && pct > 0 && (
                  <div className="px-5 mb-2">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-xs text-muted-foreground">Remaining</span>
                      <span className="text-xs font-semibold">{pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct > 50 ? "bg-green-500" : pct > 25 ? "bg-yellow-500" : "bg-red-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Accordion sections */}
                <Accordion defaultValue={["basic", "weight"]}>
                  {/* Catalog Link */}
                  <AccordionItem value="catalog">
                    <AccordionTrigger className="px-5">
                      <div className="flex items-center gap-1.5">
                        <Link className="size-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">Catalog Product</span>
                        {product && <Badge variant="outline" className="border-green-500 text-green-700 text-[10px] h-4 px-1">Linked</Badge>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5">
                      {editing ? (
                        <>
                          <div className="relative mb-2">
                            <Input
                              value={productSearch}
                              onChange={(e) => setProductSearch(e.target.value)}
                              placeholder="Search catalog products..."
                            />
                            {productOptions.length > 0 && productSearch.length >= 2 && (
                              <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-auto rounded-lg border bg-popover shadow-md">
                                {productOptions.map((opt: any) => (
                                  <button
                                    key={opt.product?.id}
                                    className="flex items-center gap-2 w-full px-3 py-1.5 text-sm hover:bg-accent text-left"
                                    onClick={() => {
                                      setSelectedProduct(opt);
                                      setProductSearch("");
                                      setProductOptions([]);
                                    }}
                                  >
                                    {opt.product?.colorHex && (
                                      <div className="w-3.5 h-3.5 rounded-full border border-border shrink-0" style={{ backgroundColor: opt.product.colorHex }} />
                                    )}
                                    <span className="truncate">{opt.brand?.name ? `${opt.brand.name} ` : ""}{opt.product?.name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          {selectedProduct && (
                            <p className="text-sm mb-1">Selected: <strong>{brand?.name ? `${brand.name} ` : ""}{product?.name}</strong></p>
                          )}
                          {isAdmin && (
                            <Button variant="ghost" size="sm" onClick={handleAddToCatalog} disabled={addingToCatalog}>
                              <Plus className="size-3.5" data-icon="inline-start" />
                              {addingToCatalog ? "Adding..." : "Add to Catalog"}
                            </Button>
                          )}
                        </>
                      ) : product ? (
                        <div className="p-3 bg-muted/50 rounded">
                          <p className="text-sm font-semibold">{brand?.name ? `${brand.name} ` : ""}{product.name}</p>
                          {product.colorName && <p className="text-xs text-muted-foreground">Color: {product.colorName}</p>}
                          {product.netWeightG && <p className="text-xs text-muted-foreground">Net: {product.netWeightG}g</p>}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">Not linked to a catalog product.</p>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Basic Info */}
                  <AccordionItem value="basic">
                    <AccordionTrigger className="px-5">
                      <span className="text-sm font-semibold">Basic Info</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-5">
                      {editing ? (
                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-4">
                            <Label>Type</Label>
                            <Select value={f.packageType || "_none"} onValueChange={(v) => set("packageType")(v === "_none" ? "" : v)}>
                              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none"><em>None</em></SelectItem>
                                {PACKAGE_TYPES.map((pt) => <SelectItem key={pt.value} value={pt.value}>{pt.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-4">
                            <Label>Status</Label>
                            <Select value={f.status} onValueChange={(v) => set("status")(v)}>
                              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {ITEM_STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-4">
                            <div className="flex items-center gap-1 pt-1">
                              <span className="text-xs text-muted-foreground">Rating</span>
                              <StarRating value={f.rating} onChange={(v) => set("rating")(v)} size={16} />
                            </div>
                          </div>
                          <div className="col-span-12">
                            <Label>Notes</Label>
                            <textarea
                              className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 min-h-[40px]"
                              value={f.notes}
                              onChange={(e) => set("notes")(e.target.value)}
                              rows={2}
                            />
                          </div>
                          {editText("Storage Location", "storageLocation", "col-span-12", { placeholder: "Freetext fallback location" })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-3"><DisplayField label="Type" value={pkgLabel} /></div>
                          <div className="col-span-3"><DisplayField label="Status" value={statusLabel} /></div>
                          <div className="col-span-3"><DisplayField label="Rating" value={f.rating ? <StarRating value={f.rating} size={14} readOnly /> : "\u2014"} /></div>
                          <div className="col-span-3"><DisplayField label="Storage" value={f.storageLocation} /></div>
                          {f.notes && <div className="col-span-12"><DisplayField label="Notes" value={f.notes} /></div>}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Weight & Dimensions */}
                  <AccordionItem value="weight">
                    <AccordionTrigger className="px-5">
                      <span className="text-sm font-semibold">Weight & Dimensions</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-5">
                      {editing ? (
                        <div className="grid grid-cols-12 gap-3">
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
                        </div>
                      ) : (
                        <div className="grid grid-cols-12 gap-2">
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
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Filament Profile */}
                  {product?.filamentProfile && (
                    <AccordionItem value="filament-profile">
                      <AccordionTrigger className="px-5">
                        <span className="text-sm font-semibold">Filament Profile</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-5">
                        {(() => { const fp = product.filamentProfile; return (
                          <div className="grid grid-cols-12 gap-2">
                            <div className="col-span-4"><DisplayField label="Nozzle Temp" value={fp.nozzleTempMin && fp.nozzleTempMax ? `${fp.nozzleTempMin}\u2013${fp.nozzleTempMax}\u00b0C` : fp.nozzleTempMin ? `${fp.nozzleTempMin}\u00b0C` : null} /></div>
                            <div className="col-span-4"><DisplayField label="Bed Temp" value={fp.bedTempMin && fp.bedTempMax ? `${fp.bedTempMin}\u2013${fp.bedTempMax}\u00b0C` : fp.bedTempMin ? `${fp.bedTempMin}\u00b0C` : null} /></div>
                            <div className="col-span-4"><DisplayField label="Chamber Temp" value={fp.chamberTempMin && fp.chamberTempMax ? `${fp.chamberTempMin}\u2013${fp.chamberTempMax}\u00b0C` : fp.chamberTempMin ? `${fp.chamberTempMin}\u00b0C` : null} /></div>
                            <div className="col-span-4"><DisplayField label="Diameter" value={fp.diameter ? `${fp.diameter}mm` : null} /></div>
                            <div className="col-span-4"><DisplayField label="Min Nozzle" value={fp.minNozzleDiameter ? `${fp.minNozzleDiameter}mm` : null} /></div>
                            <div className="col-span-4"><DisplayField label="Filament Length" value={fp.filamentLengthM ? `${fp.filamentLengthM}m` : null} /></div>
                            <div className="col-span-4"><DisplayField label="Flow Ratio" value={fp.defaultFlowRatio} /></div>
                            <div className="col-span-4"><DisplayField label="Pressure Adv." value={fp.defaultPressureAdvance} /></div>
                            <div className="col-span-4"><DisplayField label="Vol. Speed" value={fp.maxVolumetricSpeed ? `${fp.maxVolumetricSpeed} mm\u00b3/s` : null} /></div>
                            <div className="col-span-4"><DisplayField label="Drying Temp" value={fp.dryingTemp ? `${fp.dryingTemp}\u00b0C` : null} /></div>
                            <div className="col-span-4"><DisplayField label="Drying Time" value={fp.dryingTimeMin ? `${fp.dryingTimeMin} min` : null} /></div>
                            <div className="col-span-4"><DisplayField label="Spool Weight" value={fp.spoolWeightG ? `${fp.spoolWeightG}g` : null} /></div>
                            <div className="col-span-4"><DisplayField label="TD" value={fp.transmissionDistance} /></div>
                          </div>
                        ); })()}
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Product Details */}
                  {product && (
                    <AccordionItem value="product-details">
                      <AccordionTrigger className="px-5">
                        <span className="text-sm font-semibold">Product Details</span>
                      </AccordionTrigger>
                      <AccordionContent className="px-5">
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-6"><DisplayField label="Name" value={product.name} /></div>
                          <div className="col-span-6"><DisplayField label="Brand" value={brand?.name} /></div>
                          <div className="col-span-4"><DisplayField label="Material" value={material?.name} /></div>
                          <div className="col-span-4"><DisplayField label="Category" value={product.category} /></div>
                          <div className="col-span-4"><DisplayField label="Color Name" value={product.colorName} /></div>
                          {product.colorHex && (
                            <div className="col-span-4"><DisplayField label="Product Color" value={
                              <span className="flex items-center gap-1">
                                <span className="w-3.5 h-3.5 rounded-full border border-border inline-block" style={{ backgroundColor: product.colorHex }} />
                                {product.colorHex}
                              </span>
                            } /></div>
                          )}
                          <div className="col-span-4"><DisplayField label="Finish" value={product.finish} /></div>
                          <div className="col-span-4"><DisplayField label="Net Weight" value={product.netWeightG ? `${product.netWeightG}g` : null} /></div>
                          <div className="col-span-4"><DisplayField label="GTIN" value={product.gtin} mono /></div>
                          <div className="col-span-4"><DisplayField label="Country" value={product.countryOfOrigin} /></div>
                          {product.websiteUrl && <div className="col-span-8"><DisplayField label="Website" value={product.websiteUrl} mono /></div>}
                          {product.discontinued && <div className="col-span-4"><Badge variant="destructive">Discontinued</Badge></div>}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )}

                  {/* Color */}
                  <AccordionItem value="color">
                    <AccordionTrigger className="px-5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">Color</span>
                        {f.measuredColorHex && <span className="w-3.5 h-3.5 rounded-full border border-border inline-block" style={{ backgroundColor: f.measuredColorHex }} />}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5">
                      {editing ? (
                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-5">
                            <Label>Hex Color</Label>
                            <div className="relative">
                              {f.measuredColorHex && <span className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border border-border" style={{ backgroundColor: f.measuredColorHex }} />}
                              <Input value={f.measuredColorHex} onChange={(e) => set("measuredColorHex")(e.target.value)} placeholder="#00D2FF" className={f.measuredColorHex ? "pl-8" : ""} />
                            </div>
                          </div>
                          <div className="col-span-3 flex items-end">
                            <input type="color" value={f.measuredColorHex || "#888888"}
                              onChange={(e) => set("measuredColorHex")(e.target.value)}
                              style={{ width: 40, height: 32, border: "none", cursor: "pointer", borderRadius: 4, padding: 0 }} />
                          </div>
                          {editNum("LAB L*", "measuredColorLabL", undefined, "col-span-4")}
                          {editNum("LAB a*", "measuredColorLabA")}
                          {editNum("LAB b*", "measuredColorLabB")}
                        </div>
                      ) : (
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-4">
                            <DisplayField label="Hex" value={f.measuredColorHex ? (
                              <span className="flex items-center gap-1">
                                <span className="w-3.5 h-3.5 rounded-full border border-border inline-block" style={{ backgroundColor: f.measuredColorHex }} />
                                {f.measuredColorHex}
                              </span>
                            ) : null} mono />
                          </div>
                          <div className="col-span-8">
                            <DisplayField label="LAB" value={f.measuredColorLabL ? `${parseFloat(f.measuredColorLabL).toFixed(1)} / ${parseFloat(f.measuredColorLabA).toFixed(1)} / ${parseFloat(f.measuredColorLabB).toFixed(1)}` : null} mono />
                          </div>
                          {item.measuredSpectralData && <div className="col-span-12"><DisplayField label="Spectral Data" value="Available (AS7341)" /></div>}
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* NFC & Identification */}
                  <AccordionItem value="nfc">
                    <AccordionTrigger className="px-5">
                      <div className="flex items-center gap-1.5">
                        <Nfc className="size-4 text-muted-foreground" />
                        <span className="text-sm font-semibold">NFC & Identification</span>
                        {f.nfcUid && <Badge variant="outline" className="border-primary text-primary text-[10px] h-4 px-1">NFC</Badge>}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-5">
                      {editing ? (
                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-6">
                            <Label>NFC UID</Label>
                            <Input value={f.nfcUid} onChange={(e) => set("nfcUid")(e.target.value)} placeholder="04:A3:..." />
                          </div>
                          <div className="col-span-6">
                            <Label>NFC Format</Label>
                            <Select value={f.nfcTagFormat || "_none"} onValueChange={(v) => set("nfcTagFormat")(v === "_none" ? "" : v)}>
                              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="_none"><em>None</em></SelectItem>
                                {NFC_TAG_FORMATS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-4 flex items-center gap-2 pt-2">
                            <Switch checked={f.nfcTagWritten} onCheckedChange={(v) => set("nfcTagWritten")(v)} />
                            <span className="text-xs">Tag Written</span>
                          </div>
                          {editText("Bambu Tray UID", "bambuTrayUid", "col-span-8")}
                          {editText("Barcode Value", "barcodeValue", "col-span-7")}
                          {editText("Barcode Format", "barcodeFormat", "col-span-5", { placeholder: "CODE128" })}
                          {editText("Lot Number", "lotNumber")}
                          {editText("Serial Number", "serialNumber")}
                        </div>
                      ) : (
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-4"><DisplayField label="NFC UID" value={f.nfcUid} mono /></div>
                          <div className="col-span-4"><DisplayField label="Format" value={nfcFormatLabel} /></div>
                          <div className="col-span-4"><DisplayField label="Written" value={f.nfcTagWritten ? "Yes" : "No"} /></div>
                          <div className="col-span-6"><DisplayField label="Bambu Tray UID" value={f.bambuTrayUid} mono /></div>
                          <div className="col-span-6"><DisplayField label="Barcode" value={f.barcodeValue ? `${f.barcodeValue}${f.barcodeFormat ? ` (${f.barcodeFormat})` : ""}` : null} mono /></div>
                          <div className="col-span-6"><DisplayField label="Lot Number" value={f.lotNumber} /></div>
                          <div className="col-span-6"><DisplayField label="Serial Number" value={f.serialNumber} mono /></div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Purchase & Lifecycle */}
                  <AccordionItem value="purchase">
                    <AccordionTrigger className="px-5">
                      <span className="text-sm font-semibold">Purchase & Lifecycle</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-5">
                      {editing ? (
                        <div className="grid grid-cols-12 gap-3">
                          <div className="col-span-4">
                            <Label>Price</Label>
                            <div className="relative">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">$</span>
                              <Input type="number" value={f.purchasePrice} onChange={(e) => set("purchasePrice")(e.target.value)} className="pl-6" />
                            </div>
                          </div>
                          {editText("Currency", "purchaseCurrency", "col-span-2")}
                          {editDate("Purchased", "purchasedAt")}
                          {editText("Production Date", "productionDate", "col-span-6", { placeholder: "YYYY-MM-DD" })}
                          {editDate("Opened", "openedAt")}
                          {editDate("Emptied", "emptiedAt")}
                          {editDate("Expires", "expiresAt")}
                          {editDate("Last Dried", "lastDriedAt")}
                          {editNum("Drying Cycles", "dryingCycleCount", undefined, "col-span-4")}
                        </div>
                      ) : (
                        <div className="grid grid-cols-12 gap-2">
                          <div className="col-span-4"><DisplayField label="Price" value={f.purchasePrice ? `${f.purchasePrice} ${f.purchaseCurrency}` : null} /></div>
                          <div className="col-span-4"><DisplayField label="Purchased" value={f.purchasedAt} /></div>
                          <div className="col-span-4"><DisplayField label="Production" value={f.productionDate} /></div>
                          <div className="col-span-4"><DisplayField label="Opened" value={f.openedAt} /></div>
                          <div className="col-span-4"><DisplayField label="Emptied" value={f.emptiedAt} /></div>
                          <div className="col-span-4"><DisplayField label="Expires" value={f.expiresAt} /></div>
                          <div className="col-span-4"><DisplayField label="Last Dried" value={f.lastDriedAt} /></div>
                          <div className="col-span-4"><DisplayField label="Drying Cycles" value={f.dryingCycleCount !== "0" ? f.dryingCycleCount : null} /></div>
                        </div>
                      )}
                    </AccordionContent>
                  </AccordionItem>

                  {/* Metadata */}
                  <AccordionItem value="metadata">
                    <AccordionTrigger className="px-5">
                      <span className="text-sm font-semibold text-muted-foreground">Metadata</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-5">
                      <div className="grid grid-cols-12 gap-2">
                        <div className="col-span-6"><DisplayField label="Item ID" value={item.id} mono /></div>
                        <div className="col-span-6"><DisplayField label="Product ID" value={item.productId} mono /></div>
                        <div className="col-span-6"><DisplayField label="Created" value={fmtDateTime(item.createdAt)} /></div>
                        <div className="col-span-6"><DisplayField label="Updated" value={fmtDateTime(item.updatedAt)} /></div>
                        {item.intakeScanEventId && <div className="col-span-12"><DisplayField label="Intake Scan" value={item.intakeScanEventId} mono /></div>}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>

                {/* Actions */}
                {saveError && (
                  <div className="px-5 py-2">
                    <p className="text-sm text-destructive">Save failed: {saveError}</p>
                  </div>
                )}
                <div className="px-5 py-4 flex gap-2 flex-wrap">
                  {editing ? (
                    <>
                      <Button size="sm" onClick={() => { setSaveError(null); handleSaveItem(); }} disabled={saving} className="flex-1">
                        {saving ? "Saving..." : "Save All Changes"}
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setEditing(false); setSaveError(null); }}>Cancel</Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                      <Pencil className="size-3.5" data-icon="inline-start" />
                      Edit Item
                    </Button>
                  )}
                  <Button variant="destructive" size="sm" onClick={handleRemoveItem}>
                    Remove from Slot
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
