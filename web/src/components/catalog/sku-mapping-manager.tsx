"use client";

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  listSkusByProduct,
  createSkuMapping,
  removeSkuMapping,
} from "@/lib/actions/central-catalog";

// Types

type SkuRow = {
  id: string;
  productId: string;
  sku: string | null;
  barcode: string | null;
  barcodeFormat: string | null;
  gtin: string | null;
  packQuantity: number | null;
  retailer: string | null;
  productUrl: string | null;
  priceAmount: number | null;
  priceCurrency: string | null;
};

// Component

type Props = {
  productId: string;
};

export function SkuMappingManager({ productId }: Props) {
  const [mappings, setMappings] = useState<SkuRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadMappings = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listSkusByProduct(productId);
    if (result.error !== null) {
      setError(result.error);
      setLoading(false);
      return;
    }
    setMappings(result.data as SkuRow[]);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    loadMappings();
  }, [loadMappings]);

  const handleDelete = async (id: string) => {
    const result = await removeSkuMapping(id);
    if (result.error !== null) {
      setError(result.error);
    } else {
      setConfirmDeleteId(null);
      loadMappings();
    }
  };

  const formatPrice = (amount: number | null, currency: string | null) => {
    if (amount == null) return "-";
    return `${currency ?? "USD"} ${amount.toFixed(2)}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-base font-semibold">SKU / Barcode Mappings</p>
        <Button size="sm" variant="ghost" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-1" />
          Add Mapping
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </div>
      ) : mappings.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No SKU mappings defined for this product.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Barcode</TableHead>
              <TableHead>GTIN</TableHead>
              <TableHead>Retailer</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-center">Pack Qty</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {mappings.map((mapping) => (
              <TableRow key={mapping.id}>
                <TableCell>
                  <span className="text-sm font-mono">
                    {mapping.sku || "-"}
                  </span>
                </TableCell>
                <TableCell>
                  <div>
                    <span className="text-sm font-mono">
                      {mapping.barcode || "-"}
                    </span>
                    {mapping.barcodeFormat && (
                      <span className="block text-xs text-muted-foreground">
                        {mapping.barcodeFormat}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm font-mono">
                    {mapping.gtin || "-"}
                  </span>
                </TableCell>
                <TableCell>{mapping.retailer || "-"}</TableCell>
                <TableCell className="text-right">
                  {formatPrice(mapping.priceAmount, mapping.priceCurrency)}
                </TableCell>
                <TableCell className="text-center">{mapping.packQuantity ?? 1}</TableCell>
                <TableCell className="text-right">
                  {confirmDeleteId === mapping.id ? (
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(mapping.id)}
                      >
                        Confirm
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setConfirmDeleteId(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setConfirmDeleteId(mapping.id)}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <AddSkuMappingDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        productId={productId}
        onSaved={loadMappings}
      />
    </div>
  );
}

// Add SKU Mapping Dialog

function AddSkuMappingDialog({
  open,
  onClose,
  productId,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  productId: string;
  onSaved: () => void;
}) {
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [barcodeFormat, setBarcodeFormat] = useState("");
  const [gtin, setGtin] = useState("");
  const [retailer, setRetailer] = useState("");
  const [productUrl, setProductUrl] = useState("");
  const [priceAmount, setPriceAmount] = useState("");
  const [priceCurrency, setPriceCurrency] = useState("USD");
  const [packQuantity, setPackQuantity] = useState("1");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setSku("");
      setBarcode("");
      setBarcodeFormat("");
      setGtin("");
      setRetailer("");
      setProductUrl("");
      setPriceAmount("");
      setPriceCurrency("USD");
      setPackQuantity("1");
      setError(null);
    }
  }, [open]);

  const handleSave = async () => {
    if (!sku && !barcode && !gtin) {
      setError("At least one of SKU, barcode, or GTIN is required");
      return;
    }
    setError(null);
    setSaving(true);
    const result = await createSkuMapping({
      productId,
      sku: sku || null,
      barcode: barcode || null,
      barcodeFormat: barcodeFormat || null,
      gtin: gtin || null,
      retailer: retailer || null,
      productUrl: productUrl || null,
      priceAmount: priceAmount ? Number(priceAmount) : null,
      priceCurrency: priceCurrency || null,
      packQuantity: packQuantity ? Number(packQuantity) : 1,
    });
    setSaving(false);
    if (result.error !== null) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add SKU / Barcode Mapping</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div>
            <Label className="mb-1">SKU</Label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
            <p className="text-[0.625rem] text-muted-foreground mt-0.5">Retailer or manufacturer SKU code</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr] gap-3">
            <div>
              <Label className="mb-1">Barcode</Label>
              <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
            </div>
            <div>
              <Label className="mb-1">Format</Label>
              <Input value={barcodeFormat} onChange={(e) => setBarcodeFormat(e.target.value)} />
              <p className="text-[0.625rem] text-muted-foreground mt-0.5">e.g. EAN-13, UPC-A</p>
            </div>
          </div>

          <div>
            <Label className="mb-1">GTIN</Label>
            <Input value={gtin} onChange={(e) => setGtin(e.target.value)} maxLength={14} />
            <p className="text-[0.625rem] text-muted-foreground mt-0.5">Global Trade Item Number (8, 12, 13, or 14 digits)</p>
          </div>

          <div>
            <Label className="mb-1">Retailer</Label>
            <Input value={retailer} onChange={(e) => setRetailer(e.target.value)} />
            <p className="text-[0.625rem] text-muted-foreground mt-0.5">e.g. Amazon, MicroCenter, Prusa Store</p>
          </div>

          <div>
            <Label className="mb-1">Product URL</Label>
            <Input value={productUrl} onChange={(e) => setProductUrl(e.target.value)} />
          </div>

          <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
            <div>
              <Label className="mb-1">Price</Label>
              <Input value={priceAmount} onChange={(e) => setPriceAmount(e.target.value)} type="number" />
            </div>
            <div>
              <Label className="mb-1">Currency</Label>
              <Input value={priceCurrency} onChange={(e) => setPriceCurrency(e.target.value)} maxLength={3} />
            </div>
            <div>
              <Label className="mb-1">Pack Qty</Label>
              <Input value={packQuantity} onChange={(e) => setPackQuantity(e.target.value)} type="number" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Add Mapping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
