"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { createUserItem, updateUserItem } from "@/lib/actions/user-library";
import {
  listProducts,
  listBrands,
  getProductWithRelations,
} from "@/lib/actions/central-catalog";
import { SlotPicker } from "@/components/scan/slot-picker";

type ProductOption = { id: string; name: string; brandName: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  existing?: { id: string; [key: string]: unknown } | null;
};

function toStr(val: unknown): string {
  return val != null ? String(val) : "";
}

function toDateStr(val: unknown): string {
  if (!val) return "";
  const d = new Date(val as string | number | Date);
  if (isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function SpoolDialog({ open, onClose, onSaved, existing }: Props) {
  // Identity
  const [productId, setProductId] = useState("");
  const [status, setStatus] = useState("active");

  // Weight
  const [initialWeightG, setInitialWeightG] = useState("");
  const [currentWeightG, setCurrentWeightG] = useState("");
  const [netFilamentWeightG, setNetFilamentWeightG] = useState("");
  const [spoolWeightG, setSpoolWeightG] = useState("");

  // Cost
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseCurrency, setPurchaseCurrency] = useState("USD");

  // Lifecycle
  const [purchasedAt, setPurchasedAt] = useState("");
  const [openedAt, setOpenedAt] = useState("");
  const [productionDate, setProductionDate] = useState("");

  // Provenance
  const [lotNumber, setLotNumber] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [notes, setNotes] = useState("");

  // Location
  const [storageLocation, setStorageLocation] = useState("");
  const [currentSlotId, setCurrentSlotId] = useState<string | null>(null);

  // Product autocomplete
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Fetch product options when search changes (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setProductLoading(true);
      try {
        const [prodResult, brandResult] = await Promise.all([
          listProducts({ search: productSearch, limit: 20 }),
          listBrands({ limit: 500 }),
        ]);
        if (prodResult.error === null && brandResult.error === null) {
          const brandMap = new Map(
            brandResult.data.map((b) => [b.id, b.name])
          );
          const opts = prodResult.data.map((p) => ({
            id: p.id,
            name: p.name,
            brandName: (p.brandId && brandMap.get(p.brandId)) || "Unknown",
          }));
          setProductOptions(opts);
          if (productSearch.length >= 2) setShowProductDropdown(true);
        }
      } finally {
        setProductLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [productSearch]);

  // Load existing product on edit to populate the autocomplete display
  const loadExistingProduct = useCallback(async (id: string) => {
    const result = await getProductWithRelations(id);
    if (result.error === null) {
      const p = result.data;
      const brandName =
        (p as any).brand?.name || "Unknown";
      setSelectedProduct({ id: p.id, name: p.name, brandName });
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    if (existing) {
      const e = existing as Record<string, any>;
      setProductId(toStr(e.productId));
      setStatus(e.status ?? "active");
      setInitialWeightG(toStr(e.initialWeightG));
      setCurrentWeightG(toStr(e.currentWeightG));
      setNetFilamentWeightG(toStr(e.netFilamentWeightG));
      setSpoolWeightG(toStr(e.spoolWeightG));
      setPurchasePrice(toStr(e.purchasePrice));
      setPurchaseCurrency(e.purchaseCurrency ?? "USD");
      setPurchasedAt(toDateStr(e.purchasedAt));
      setOpenedAt(toDateStr(e.openedAt));
      setProductionDate(e.productionDate ?? "");
      setLotNumber(e.lotNumber ?? "");
      setSerialNumber(e.serialNumber ?? "");
      setNotes(e.notes ?? "");
      setStorageLocation(e.storageLocation ?? "");
      setCurrentSlotId(e.currentSlotId ?? null);
      if (e.productId) {
        loadExistingProduct(e.productId);
      } else {
        setSelectedProduct(null);
      }
    } else {
      setProductId("");
      setStatus("active");
      setInitialWeightG("");
      setCurrentWeightG("");
      setNetFilamentWeightG("");
      setSpoolWeightG("");
      setPurchasePrice("");
      setPurchaseCurrency("USD");
      setPurchasedAt("");
      setOpenedAt("");
      setProductionDate("");
      setLotNumber("");
      setSerialNumber("");
      setNotes("");
      setStorageLocation("");
      setCurrentSlotId(null);
      setSelectedProduct(null);
    }
    setProductSearch("");
    setError(null);
    setShowProductDropdown(false);
  }, [open, existing, loadExistingProduct]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    const payload: Record<string, unknown> = {
      status,
      productId: productId || null,
      initialWeightG: initialWeightG ? Number(initialWeightG) : null,
      currentWeightG: currentWeightG ? Number(currentWeightG) : null,
      netFilamentWeightG: netFilamentWeightG ? Number(netFilamentWeightG) : null,
      spoolWeightG: spoolWeightG ? Number(spoolWeightG) : null,
      purchasePrice: purchasePrice ? Number(purchasePrice) : null,
      purchaseCurrency: purchaseCurrency || null,
      purchasedAt: purchasedAt ? new Date(purchasedAt).toISOString() : null,
      openedAt: openedAt ? new Date(openedAt).toISOString() : null,
      productionDate: productionDate || null,
      lotNumber: lotNumber || null,
      serialNumber: serialNumber || null,
      notes: notes || null,
      storageLocation: storageLocation || null,
      currentSlotId: currentSlotId || null,
    };

    const result = existing
      ? await updateUserItem(existing.id, payload)
      : await createUserItem(payload);
    setSaving(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Spool" : "Add Spool"}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Identity */}
          <p className="text-xs font-semibold text-muted-foreground">Identity</p>
          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
            {/* Product search dropdown */}
            <div className="relative">
              <Label className="mb-1">Product</Label>
              <div className="flex gap-1 items-center">
                <Input
                  value={selectedProduct ? `${selectedProduct.brandName} - ${selectedProduct.name}` : productSearch}
                  onChange={(e) => {
                    if (selectedProduct) {
                      setSelectedProduct(null);
                      setProductId("");
                    }
                    setProductSearch(e.target.value);
                  }}
                  onFocus={() => productOptions.length > 0 && productSearch.length >= 2 && setShowProductDropdown(true)}
                  onBlur={() => setTimeout(() => setShowProductDropdown(false), 200)}
                  placeholder="Type to search..."
                />
                {productLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              </div>
              {showProductDropdown && productOptions.length > 0 && (
                <div className="absolute z-50 top-full left-0 w-full mt-1 bg-popover border rounded-lg shadow-md max-h-48 overflow-y-auto">
                  {productOptions.map((opt) => (
                    <button
                      key={opt.id}
                      className="w-full px-2 py-1.5 text-sm text-left hover:bg-muted transition-colors"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setSelectedProduct(opt);
                        setProductId(opt.id);
                        setProductSearch("");
                        setShowProductDropdown(false);
                      }}
                    >
                      {opt.brandName} - {opt.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <Label className="mb-1">Status</Label>
              <Select value={status} onValueChange={(v) => v && setStatus(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="empty">Empty</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Weight */}
          <p className="text-xs font-semibold text-muted-foreground">Weight</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="mb-1">Initial Weight (g)</Label>
              <Input value={initialWeightG} onChange={(e) => setInitialWeightG(e.target.value)} type="number" />
            </div>
            <div>
              <Label className="mb-1">Current Weight (g)</Label>
              <Input value={currentWeightG} onChange={(e) => setCurrentWeightG(e.target.value)} type="number" />
            </div>
            <div>
              <Label className="mb-1">Net Filament (g)</Label>
              <Input value={netFilamentWeightG} onChange={(e) => setNetFilamentWeightG(e.target.value)} type="number" />
            </div>
            <div>
              <Label className="mb-1">Spool Weight (g)</Label>
              <Input value={spoolWeightG} onChange={(e) => setSpoolWeightG(e.target.value)} type="number" />
            </div>
          </div>

          {/* Cost */}
          <p className="text-xs font-semibold text-muted-foreground">Cost</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="mb-1">Purchase Price</Label>
              <Input value={purchasePrice} onChange={(e) => setPurchasePrice(e.target.value)} type="number" />
            </div>
            <div>
              <Label className="mb-1">Currency</Label>
              <Input value={purchaseCurrency} onChange={(e) => setPurchaseCurrency(e.target.value)} maxLength={3} />
              <p className="text-[0.625rem] text-muted-foreground mt-0.5">3-letter code (e.g. USD)</p>
            </div>
          </div>

          {/* Lifecycle */}
          <p className="text-xs font-semibold text-muted-foreground">Lifecycle</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="mb-1">Purchased At</Label>
              <Input value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} type="date" />
            </div>
            <div>
              <Label className="mb-1">Opened At</Label>
              <Input value={openedAt} onChange={(e) => setOpenedAt(e.target.value)} type="date" />
            </div>
            <div>
              <Label className="mb-1">Production Date</Label>
              <Input value={productionDate} onChange={(e) => setProductionDate(e.target.value)} />
              <p className="text-[0.625rem] text-muted-foreground mt-0.5">Freetext (e.g. 2025-Q3)</p>
            </div>
          </div>

          {/* Provenance */}
          <p className="text-xs font-semibold text-muted-foreground">Provenance</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="mb-1">Lot Number</Label>
              <Input value={lotNumber} onChange={(e) => setLotNumber(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1">Serial Number</Label>
              <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label className="mb-1">Notes</Label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            </div>
          </div>

          {/* Location */}
          <p className="text-xs font-semibold text-muted-foreground">Location</p>
          <div className="space-y-3">
            <div>
              <Label className="mb-1">Storage Location</Label>
              <Input value={storageLocation} onChange={(e) => setStorageLocation(e.target.value)} />
              <p className="text-[0.625rem] text-muted-foreground mt-0.5">Freetext location (e.g. Shelf A, Bin 3)</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">
                Or assign to a specific slot:
              </p>
              <SlotPicker
                selectedSlotId={currentSlotId}
                onSelect={(slotId) => setCurrentSlotId(slotId)}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
