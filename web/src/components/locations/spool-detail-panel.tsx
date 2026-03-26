"use client";

import { useState, useEffect } from "react";
import { X, Scale, Nfc, Printer, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserItemWithRelations, updateUserItem } from "@/lib/actions/user-library";

type Props = {
  itemId: string;
  onClose: () => void;
  onUpdate?: () => void;
};

function StarRating({ value, onChange, size = 16 }: { value: number | null; onChange?: (v: number | null) => void; size?: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`p-0 ${onChange ? "cursor-pointer" : "cursor-default"}`}
          onClick={() => onChange?.(value === star ? null : star)}
          disabled={!onChange}
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

export function SpoolDetailPanel({ itemId, onClose, onUpdate }: Props) {
  const [item, setItem] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [notes, setNotes] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [weight, setWeight] = useState("");

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setItem(null);
    (async () => {
      try {
        const result = await getUserItemWithRelations(itemId);
        if (result.error) {
          setError(result.error);
        } else if (result.data) {
          setItem(result.data);
          setNotes(result.data.notes ?? "");
          setRating(result.data.rating);
          setWeight(result.data.currentWeightG?.toFixed(1) ?? "");
        }
      } catch (e) {
        setError((e as Error).message);
      }
      setLoading(false);
    })();
  }, [itemId]);

  const handleSave = async () => {
    setSaving(true);
    await updateUserItem(itemId, {
      notes: notes || null,
      rating,
      currentWeightG: weight ? parseFloat(weight) : null,
    });
    setSaving(false);
    onUpdate?.();
  };

  if (loading) {
    return (
      <div className="border rounded-lg mt-3 p-4">
        <Skeleton className="h-[120px] rounded-lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-destructive rounded-lg p-4">
        <p className="text-sm text-destructive">Error: {error}</p>
        <button className="p-1" onClick={onClose}>
          <X className="size-4" />
        </button>
      </div>
    );
  }

  if (!item) return null;

  const product = item.product;
  const brand = product?.brand;
  const material = product?.material;
  const slot = item.currentSlot;
  const pct = item.percentRemaining;

  return (
    <div className="border-2 border-primary rounded-lg sticky top-20">
      <div className="p-4 pb-3">
        {/* Header */}
        <div className="flex items-start gap-3 mb-3">
          {/* Color swatch */}
          <div
            className="w-12 h-12 rounded-lg shrink-0 shadow-[inset_0_1px_3px_rgba(0,0,0,0.2)]"
            style={{ backgroundColor: item.measuredColorHex ?? "#888" }}
          />
          <div className="flex-1 min-w-0">
            <p className="font-bold truncate">
              {product?.name ?? "Unknown Item"}
            </p>
            <div className="flex gap-1.5 flex-wrap mt-0.5">
              {brand && <Badge variant="outline">{brand.name}</Badge>}
              {material && <Badge variant="outline">{material.abbreviation ?? material.name}</Badge>}
              {item.packageType && <Badge variant="outline" className="capitalize">{item.packageType}</Badge>}
              {item.nfcUid && (
                <Badge variant="outline" className="text-primary border-primary">
                  <Nfc className="size-3 mr-0.5" />NFC
                </Badge>
              )}
            </div>
          </div>
          <button className="p-1 -mt-1 -mr-1" onClick={onClose}>
            <X className="size-4" />
          </button>
        </div>

        {/* Progress bar */}
        {pct != null && (
          <div className="mb-3">
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

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-3">
          <div>
            <span className="text-xs text-muted-foreground block">Weight</span>
            <span className="text-sm font-semibold">
              {item.currentWeightG ? `${Math.round(item.currentWeightG)}g` : "\u2014"}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Initial</span>
            <span className="text-sm font-semibold">
              {item.initialWeightG ? `${Math.round(item.initialWeightG)}g` : "\u2014"}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Color</span>
            <div className="flex items-center gap-1">
              {item.measuredColorHex && (
                <div className="w-3.5 h-3.5 rounded-full border border-border" style={{ backgroundColor: item.measuredColorHex }} />
              )}
              <span className="text-sm font-mono text-xs">
                {item.measuredColorHex ?? "\u2014"}
              </span>
            </div>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Location</span>
            <span className="text-sm font-semibold">
              {slot?.address ?? slot?.label ?? "Unassigned"}
            </span>
          </div>
          <div>
            <span className="text-xs text-muted-foreground block">Purchased</span>
            <span className="text-sm">
              {item.purchasedAt ? new Date(item.purchasedAt).toLocaleDateString() : "\u2014"}
            </span>
          </div>
        </div>

        <Separator className="mb-3" />

        {/* Editable fields */}
        <div className="grid grid-cols-12 gap-3 mb-2">
          <div className="col-span-4">
            <Label>Weight (g)</Label>
            <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
          </div>
          <div className="col-span-8">
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <span className="text-xs text-muted-foreground">Rating</span>
            <StarRating value={rating} onChange={setRating} size={16} />
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>
    </div>
  );
}
