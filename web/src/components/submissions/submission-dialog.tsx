"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { createCatalogSubmission } from "@/lib/actions/submissions";
import { listProducts } from "@/lib/actions/central-catalog";

// -- Types --

type SubmissionType = "new_filament" | "new_variant" | "correction" | "equivalence";
type ProductOption = { id: string; label: string };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const submissionTypes: { value: SubmissionType; label: string; description: string }[] = [
  { value: "new_filament", label: "New Filament", description: "Submit a filament product not yet in the catalog" },
  { value: "new_variant", label: "New Variant", description: "Submit a new color/size variant of an existing product" },
  { value: "correction", label: "Correction", description: "Correct information on an existing product" },
  { value: "equivalence", label: "Equivalence", description: "Link two products as equivalent (rebrand, alias, etc.)" },
];

// -- Product Search --

function ProductSearch({
  label,
  value,
  onChange,
  helperText,
}: {
  label: string;
  value: ProductOption | null;
  onChange: (opt: ProductOption | null) => void;
  helperText?: string;
}) {
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query || query.length < 2) {
      setOptions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      const result = await listProducts({ search: query, limit: 20 });
      if (result.data) {
        setOptions(
          result.data.map((p) => ({ id: p.id, label: p.name }))
        );
      }
      setLoading(false);
      setShowDropdown(true);
    }, 300);
  }, []);

  return (
    <div className="relative">
      <label className="text-xs font-medium block mb-1">{label}</label>
      <div className="flex gap-1 items-center">
        <Input
          value={value ? value.label : inputValue}
          onChange={(e) => {
            if (value) onChange(null);
            setInputValue(e.target.value);
            search(e.target.value);
          }}
          onFocus={() => options.length > 0 && setShowDropdown(true)}
          onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
          placeholder="Type to search..."
        />
        {loading && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
      </div>
      {helperText && <p className="text-[0.625rem] text-muted-foreground mt-0.5">{helperText}</p>}
      {showDropdown && options.length > 0 && (
        <div className="absolute z-50 top-full left-0 w-full mt-1 bg-popover border rounded-lg shadow-md max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <button
              key={opt.id}
              className="w-full px-2 py-1.5 text-sm text-left hover:bg-muted transition-colors"
              onMouseDown={(e) => {
                e.preventDefault();
                onChange(opt);
                setInputValue("");
                setShowDropdown(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Main Dialog --

export function SubmissionDialog({ open, onClose, onSaved }: Props) {
  const [type, setType] = useState<SubmissionType>("new_filament");

  // New filament / new variant fields
  const [brandName, setBrandName] = useState("");
  const [materialName, setMaterialName] = useState("");
  const [productName, setProductName] = useState("");
  const [colorName, setColorName] = useState("");
  const [colorHex, setColorHex] = useState("");
  const [netWeightG, setNetWeightG] = useState("");

  // New variant: base product
  const [baseProduct, setBaseProduct] = useState<ProductOption | null>(null);

  // Correction fields
  const [correctionProduct, setCorrectionProduct] = useState<ProductOption | null>(null);
  const [correctionField, setCorrectionField] = useState("name");
  const [correctionValue, setCorrectionValue] = useState("");

  // Equivalence fields
  const [sourceBarcode, setSourceBarcode] = useState("");
  const [equivalenceProduct, setEquivalenceProduct] = useState<ProductOption | null>(null);

  // Shared
  const [notes, setNotes] = useState("");

  // UI state
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!open) return;
    setType("new_filament");
    setBrandName("");
    setMaterialName("");
    setProductName("");
    setColorName("");
    setColorHex("");
    setNetWeightG("");
    setBaseProduct(null);
    setCorrectionProduct(null);
    setCorrectionField("name");
    setCorrectionValue("");
    setSourceBarcode("");
    setEquivalenceProduct(null);
    setNotes("");
    setError(null);
  }, [open]);

  const handleSave = async () => {
    setError(null);

    let payload: Record<string, unknown> = {};
    let targetTable: string | null = null;
    let targetId: string | null = null;

    if (type === "new_filament") {
      if (!brandName.trim() || !productName.trim()) {
        setError("Brand name and product name are required.");
        return;
      }
      payload = {
        brandName: brandName.trim(),
        materialName: materialName.trim() || null,
        productName: productName.trim(),
        colorName: colorName.trim() || null,
        colorHex: colorHex.trim() || null,
        netWeightG: netWeightG ? Number(netWeightG) : null,
      };
    } else if (type === "new_variant") {
      if (!baseProduct) {
        setError("Please select a base product.");
        return;
      }
      if (!colorName.trim() && !productName.trim()) {
        setError("Please provide at least a color name or product name for the variant.");
        return;
      }
      targetTable = "products";
      targetId = baseProduct.id;
      payload = {
        baseProductId: baseProduct.id,
        baseProductName: baseProduct.label,
        productName: productName.trim() || null,
        colorName: colorName.trim() || null,
        colorHex: colorHex.trim() || null,
        netWeightG: netWeightG ? Number(netWeightG) : null,
      };
    } else if (type === "correction") {
      if (!correctionProduct) {
        setError("Please select the product to correct.");
        return;
      }
      if (!correctionField.trim() || !correctionValue.trim()) {
        setError("Please specify the field and corrected value.");
        return;
      }
      targetTable = "products";
      targetId = correctionProduct.id;
      payload = {
        productId: correctionProduct.id,
        productName: correctionProduct.label,
        field: correctionField.trim(),
        correctedValue: correctionValue.trim(),
      };
    } else if (type === "equivalence") {
      if (!equivalenceProduct) {
        setError("Please select the target product.");
        return;
      }
      if (!sourceBarcode.trim()) {
        setError("Please enter the source barcode.");
        return;
      }
      targetTable = "products";
      targetId = equivalenceProduct.id;
      payload = {
        sourceBarcode: sourceBarcode.trim(),
        targetProductId: equivalenceProduct.id,
        targetProductName: equivalenceProduct.label,
      };
    }

    if (notes.trim()) {
      payload.notes = notes.trim();
    }

    setSaving(true);
    const result = await createCatalogSubmission({
      type,
      payload,
      targetTable,
      targetId,
    });
    setSaving(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    onSaved();
    onClose();
  };

  const correctionFieldOptions = [
    { value: "name", label: "Product Name" },
    { value: "colorName", label: "Color Name" },
    { value: "colorHex", label: "Color Hex" },
    { value: "netWeightG", label: "Net Weight (g)" },
    { value: "materialName", label: "Material" },
    { value: "brandName", label: "Brand Name" },
    { value: "gtin", label: "GTIN / Barcode" },
    { value: "other", label: "Other" },
  ];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Submission</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-3 max-h-[70vh] overflow-y-auto pr-1">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Submission Type */}
          <div>
            <label className="text-xs font-medium block mb-1">Submission Type</label>
            <Select value={type} onValueChange={(v) => v && setType(v as SubmissionType)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {submissionTypes.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-0.5">
              {submissionTypes.find((t) => t.value === type)?.description}
            </p>
          </div>

          {/* New Filament Fields */}
          {type === "new_filament" && (
            <>
              <p className="text-xs font-semibold text-muted-foreground">Product Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1">Brand Name *</label>
                  <Input value={brandName} onChange={(e) => setBrandName(e.target.value)} />
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Material (e.g. PLA, PETG)</label>
                  <Input value={materialName} onChange={(e) => setMaterialName(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium block mb-1">Product Name *</label>
                  <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
                  <p className="text-[0.625rem] text-muted-foreground mt-0.5">Full product name as shown on packaging</p>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Color Name</label>
                  <Input value={colorName} onChange={(e) => setColorName(e.target.value)} />
                </div>
                <div className="flex gap-1 items-end">
                  <div className="flex-1">
                    <label className="text-xs font-medium block mb-1">Color Hex</label>
                    <Input value={colorHex} onChange={(e) => setColorHex(e.target.value)} placeholder="#FF0000" maxLength={9} />
                  </div>
                  {colorHex && /^#[0-9a-fA-F]{6}$/.test(colorHex) && (
                    <div className="w-8 h-8 rounded border border-border shrink-0" style={{ backgroundColor: colorHex }} />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Net Weight (g)</label>
                  <Input value={netWeightG} onChange={(e) => setNetWeightG(e.target.value)} type="number" />
                </div>
              </div>
            </>
          )}

          {/* New Variant Fields */}
          {type === "new_variant" && (
            <>
              <p className="text-xs font-semibold text-muted-foreground">Base Product</p>
              <ProductSearch label="Search existing product" value={baseProduct} onChange={setBaseProduct} helperText="The product this variant is based on" />
              <p className="text-xs font-semibold text-muted-foreground">Variant Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium block mb-1">Variant Product Name</label>
                  <Input value={productName} onChange={(e) => setProductName(e.target.value)} />
                  <p className="text-[0.625rem] text-muted-foreground mt-0.5">Leave blank to inherit from base product</p>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Color Name</label>
                  <Input value={colorName} onChange={(e) => setColorName(e.target.value)} />
                </div>
                <div className="flex gap-1 items-end">
                  <div className="flex-1">
                    <label className="text-xs font-medium block mb-1">Color Hex</label>
                    <Input value={colorHex} onChange={(e) => setColorHex(e.target.value)} placeholder="#FF0000" maxLength={9} />
                  </div>
                  {colorHex && /^#[0-9a-fA-F]{6}$/.test(colorHex) && (
                    <div className="w-8 h-8 rounded border border-border shrink-0" style={{ backgroundColor: colorHex }} />
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Net Weight (g)</label>
                  <Input value={netWeightG} onChange={(e) => setNetWeightG(e.target.value)} type="number" />
                </div>
              </div>
            </>
          )}

          {/* Correction Fields */}
          {type === "correction" && (
            <>
              <p className="text-xs font-semibold text-muted-foreground">Product to Correct</p>
              <ProductSearch label="Search product" value={correctionProduct} onChange={setCorrectionProduct} />
              <p className="text-xs font-semibold text-muted-foreground">Correction</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-medium block mb-1">Field to Correct *</label>
                  <Select value={correctionField} onValueChange={(v) => v && setCorrectionField(v)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {correctionFieldOptions.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium block mb-1">Corrected Value *</label>
                  <Input value={correctionValue} onChange={(e) => setCorrectionValue(e.target.value)} />
                </div>
              </div>
            </>
          )}

          {/* Equivalence Fields */}
          {type === "equivalence" && (
            <>
              <p className="text-xs font-semibold text-muted-foreground">Source</p>
              <div>
                <label className="text-xs font-medium block mb-1">Source Barcode *</label>
                <Input value={sourceBarcode} onChange={(e) => setSourceBarcode(e.target.value)} />
                <p className="text-[0.625rem] text-muted-foreground mt-0.5">Barcode of the unrecognized or alias product</p>
              </div>
              <p className="text-xs font-semibold text-muted-foreground">Target Product</p>
              <ProductSearch label="Search target product" value={equivalenceProduct} onChange={setEquivalenceProduct} helperText="The existing catalog product this barcode should map to" />
            </>
          )}

          {/* Notes */}
          <div>
            <label className="text-xs font-medium block mb-1">Notes</label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
            <p className="text-[0.625rem] text-muted-foreground mt-0.5">Optional additional context for reviewers</p>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cancel</DialogClose>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="size-4 mr-1 animate-spin" />}
            {saving ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
