"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2, ArrowRightLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  listAliasesForProduct,
  createProductAlias,
  removeProductAlias,
  listProducts,
  listBrands,
  getProductById,
} from "@/lib/actions/central-catalog";

// Types

type ProductOption = { id: string; name: string; brandName: string };

type AliasRow = {
  id: string;
  productId: string;
  relatedProductId: string;
  aliasType: string;
  confidence: number | null;
  bidirectional: boolean | null;
  source: string | null;
  notes: string | null;
  createdAt: Date;
};

const ALIAS_TYPE_LABELS: Record<string, string> = {
  oem_rebrand: "OEM / Rebrand",
  sku_variant: "SKU Variant",
  substitute: "Substitute",
  color_match: "Color Match",
};

const ALIAS_TYPE_VARIANTS: Record<string, "default" | "secondary" | "outline"> = {
  oem_rebrand: "default",
  sku_variant: "secondary",
  substitute: "outline",
  color_match: "default",
};

// Component

type Props = {
  productId: string;
};

export function AliasManager({ productId }: Props) {
  const [aliases, setAliases] = useState<(AliasRow & { linkedProductName: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const loadAliases = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listAliasesForProduct(productId);
    if (result.error !== null) {
      setError(result.error);
      setLoading(false);
      return;
    }

    const enriched = await Promise.all(
      result.data.map(async (alias) => {
        const linkedId =
          alias.productId === productId ? alias.relatedProductId : alias.productId;
        const prodResult = await getProductById(linkedId);
        const linkedProductName =
          prodResult.error === null ? prodResult.data.name : "(unknown)";
        return { ...alias, linkedProductName } as AliasRow & { linkedProductName: string };
      })
    );
    setAliases(enriched);
    setLoading(false);
  }, [productId]);

  useEffect(() => {
    loadAliases();
  }, [loadAliases]);

  const handleDelete = async (id: string) => {
    const result = await removeProductAlias(id);
    if (result.error !== null) {
      setError(result.error);
    } else {
      setConfirmDeleteId(null);
      loadAliases();
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-base font-semibold">Product Aliases</p>
        <Button size="sm" variant="ghost" onClick={() => setDialogOpen(true)}>
          <Plus className="size-4 mr-1" />
          Add Alias
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
      ) : aliases.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">
          No aliases defined for this product.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Linked Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-center">Direction</TableHead>
              <TableHead className="text-right">Confidence</TableHead>
              <TableHead>Notes</TableHead>
              <TableHead className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {aliases.map((alias) => (
              <TableRow key={alias.id}>
                <TableCell>{alias.linkedProductName}</TableCell>
                <TableCell>
                  <Badge variant={ALIAS_TYPE_VARIANTS[alias.aliasType] ?? "outline"}>
                    {ALIAS_TYPE_LABELS[alias.aliasType] ?? alias.aliasType}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Tooltip>
                    <TooltipTrigger>
                      {alias.bidirectional ? (
                        <ArrowRightLeft className="size-4 text-muted-foreground" />
                      ) : (
                        <ArrowRight className="size-4 text-muted-foreground" />
                      )}
                    </TooltipTrigger>
                    <TooltipContent>
                      {alias.bidirectional ? "Bidirectional" : "One-way"}
                    </TooltipContent>
                  </Tooltip>
                </TableCell>
                <TableCell className="text-right">
                  {alias.confidence != null
                    ? `${Math.round(alias.confidence * 100)}%`
                    : "-"}
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
                    {alias.notes || "-"}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  {confirmDeleteId === alias.id ? (
                    <div className="flex items-center gap-1 justify-end">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleDelete(alias.id)}
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
                      onClick={() => setConfirmDeleteId(alias.id)}
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

      <AddAliasDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        productId={productId}
        onSaved={loadAliases}
      />
    </div>
  );
}

// Add Alias Dialog

function AddAliasDialog({
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
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [productOptions, setProductOptions] = useState<ProductOption[]>([]);
  const [productLoading, setProductLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const [aliasType, setAliasType] = useState("substitute");
  const [confidence, setConfidence] = useState(100);
  const [bidirectional, setBidirectional] = useState(true);
  const [notes, setNotes] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          const opts = prodResult.data
            .filter((p) => p.id !== productId)
            .map((p) => ({
              id: p.id,
              name: p.name,
              brandName: (p.brandId && brandMap.get(p.brandId)) || "Unknown",
            }));
          setProductOptions(opts);
          if (productSearch.length >= 2) setShowDropdown(true);
        }
      } finally {
        setProductLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [productSearch, productId]);

  useEffect(() => {
    if (open) {
      setSelectedProduct(null);
      setProductSearch("");
      setAliasType("substitute");
      setConfidence(100);
      setBidirectional(true);
      setNotes("");
      setError(null);
      setShowDropdown(false);
    }
  }, [open]);

  const handleSave = async () => {
    if (!selectedProduct) {
      setError("Please select a product");
      return;
    }
    setError(null);
    setSaving(true);
    const result = await createProductAlias({
      productId,
      relatedProductId: selectedProduct.id,
      aliasType,
      confidence: confidence / 100,
      bidirectional,
      notes: notes || null,
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
          <DialogTitle>Add Product Alias</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4 mt-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Product search */}
          <div className="relative">
            <Label className="mb-1">Linked Product *</Label>
            <div className="flex gap-1 items-center">
              <Input
                value={selectedProduct ? `${selectedProduct.brandName} - ${selectedProduct.name}` : productSearch}
                onChange={(e) => {
                  if (selectedProduct) setSelectedProduct(null);
                  setProductSearch(e.target.value);
                }}
                onFocus={() => productOptions.length > 0 && productSearch.length >= 2 && setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                placeholder="Type to search..."
              />
              {productLoading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
            </div>
            {showDropdown && productOptions.length > 0 && (
              <div className="absolute z-50 top-full left-0 w-full mt-1 bg-popover border rounded-lg shadow-md max-h-48 overflow-y-auto">
                {productOptions.map((opt) => (
                  <button
                    key={opt.id}
                    className="w-full px-2 py-1.5 text-sm text-left hover:bg-muted transition-colors"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSelectedProduct(opt);
                      setProductSearch("");
                      setShowDropdown(false);
                    }}
                  >
                    {opt.brandName} - {opt.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Label className="mb-1">Alias Type</Label>
            <Select value={aliasType} onValueChange={(v) => v && setAliasType(v)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="oem_rebrand">OEM / Rebrand</SelectItem>
                <SelectItem value="sku_variant">SKU Variant</SelectItem>
                <SelectItem value="substitute">Substitute</SelectItem>
                <SelectItem value="color_match">Color Match</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="mb-1">Confidence: {confidence}%</Label>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={confidence}
              onChange={(e) => setConfidence(Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-full appearance-none accent-primary"
            />
          </div>

          <label className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={bidirectional}
              onCheckedChange={(v) => setBidirectional(v === true)}
            />
            Bidirectional (A is alias of B and B is alias of A)
          </label>

          <div>
            <Label className="mb-1">Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>
            Cancel
          </DialogClose>
          <Button onClick={handleSave} disabled={saving || !selectedProduct}>
            {saving ? "Saving..." : "Add Alias"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
