"use client";

import { useState, useEffect } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  createZone,
  updateZone,
  removeZone,
  createRack,
  updateRack,
  removeRack,
  createShelf,
  updateShelf,
  removeShelf,
  createBay,
  updateBay,
  removeBay,
  createSlot,
  updateSlot,
  removeSlot,
} from "@/lib/actions/hardware";

export type LocationLevel = "zone" | "rack" | "shelf" | "bay" | "slot";

const levelLabels: Record<LocationLevel, string> = {
  zone: "Zone",
  rack: "Rack",
  shelf: "Shelf",
  bay: "Bay",
  slot: "Slot",
};

const zoneTypeOptions = [
  { value: "workshop", label: "Workshop" },
  { value: "storage", label: "Storage" },
  { value: "printer_area", label: "Printer Area" },
  { value: "drying", label: "Drying" },
  { value: "other", label: "Other" },
];

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  level: LocationLevel;
  parentId?: string;
  existing?: Record<string, any> | null;
  deleteMode?: boolean;
};

export function LocationDialog({
  open,
  onClose,
  onSaved,
  level,
  parentId,
  existing,
  deleteMode,
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState("workshop");
  const [description, setDescription] = useState("");
  const [position, setPosition] = useState("");
  const [label, setLabel] = useState("");
  const [nfcTagId, setNfcTagId] = useState("");
  const [address, setAddress] = useState("");

  const [quickShelves, setQuickShelves] = useState("3");
  const [quickBays, setQuickBays] = useState("1");
  const [quickSlots, setQuickSlots] = useState("2");

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState("");

  const isEdit = !!existing && !deleteMode;
  const isDelete = !!existing && !!deleteMode;
  const isNewRack = level === "rack" && !isEdit && !isDelete;

  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name ?? "");
      setType(existing.type ?? "workshop");
      setDescription(existing.description ?? "");
      setPosition(existing.position?.toString() ?? "");
      setLabel(existing.label ?? "");
      setNfcTagId(existing.nfcTagId ?? "");
      setAddress(existing.address ?? "");
    } else {
      setName("");
      setType("workshop");
      setDescription("");
      setPosition("");
      setLabel("");
      setNfcTagId("");
      setAddress("");
      setQuickShelves("3");
      setQuickBays("1");
      setQuickSlots("2");
    }
    setError(null);
    setProgress("");
  }, [open, existing]);

  const handleSave = async () => {
    setError(null);
    setSaving(true);
    setProgress("");

    let result: any;

    try {
      if (isDelete) {
        const removeFn = { zone: removeZone, rack: removeRack, shelf: removeShelf, bay: removeBay, slot: removeSlot }[level];
        result = await removeFn(existing!.id);
      } else if (level === "zone") {
        const payload = {
          name,
          type,
          description: description || null,
          nfcTagId: nfcTagId || null,
        };
        result = isEdit
          ? await updateZone(existing!.id, payload)
          : await createZone(payload);
      } else if (level === "rack") {
        const payload = {
          zoneId: parentId,
          name,
          position: position ? parseInt(position) : null,
          nfcTagId: nfcTagId || null,
        };

        if (isEdit) {
          result = await updateRack(existing!.id, payload);
        } else {
          result = await createRack(payload);
          if (result?.error) {
            setSaving(false);
            setError(result.error);
            return;
          }

          const rackId = result.data?.id;
          const nShelves = parseInt(quickShelves) || 0;
          const nBays = parseInt(quickBays) || 0;
          const nSlots = parseInt(quickSlots) || 0;

          if (rackId && nShelves > 0) {
            for (let s = 1; s <= nShelves; s++) {
              setProgress(`Creating shelf ${s}/${nShelves}...`);
              const shelfResult = await createShelf({ rackId, position: s });
              if (shelfResult?.error) continue;
              const shelfId = shelfResult.data?.id;
              if (!shelfId || nBays <= 0) continue;

              for (let b = 1; b <= nBays; b++) {
                const bayResult = await createBay({ shelfId, position: b });
                if (bayResult?.error) continue;
                const bayId = bayResult.data?.id;
                if (!bayId || nSlots <= 0) continue;

                for (let sl = 1; sl <= nSlots; sl++) {
                  await createSlot({ bayId, position: sl });
                }
              }
            }
          }
        }
      } else if (level === "shelf") {
        const payload = {
          rackId: parentId,
          position: position ? parseInt(position) : 1,
          label: label || null,
          nfcTagId: nfcTagId || null,
        };
        result = isEdit
          ? await updateShelf(existing!.id, payload)
          : await createShelf(payload);
      } else if (level === "bay") {
        const payload = {
          shelfId: parentId,
          position: position ? parseInt(position) : 1,
          label: label || null,
          nfcTagId: nfcTagId || null,
        };
        result = isEdit
          ? await updateBay(existing!.id, payload)
          : await createBay(payload);
      } else if (level === "slot") {
        const payload = {
          bayId: parentId,
          position: position ? parseInt(position) : 1,
          label: label || null,
          nfcTagId: nfcTagId || null,
          address: address || null,
        };
        result = isEdit
          ? await updateSlot(existing!.id, payload)
          : await createSlot(payload);
      }
    } catch (e) {
      setSaving(false);
      setError((e as Error).message);
      return;
    }

    setSaving(false);
    setProgress("");
    if (result?.error) {
      setError(result.error);
      return;
    }
    onSaved();
    onClose();
  };

  const title = isDelete
    ? `Delete ${levelLabels[level]}`
    : isEdit
    ? `Edit ${levelLabels[level]}`
    : `Add ${levelLabels[level]}`;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {isDelete ? (
            <p className="text-sm">
              Are you sure you want to delete{" "}
              <strong>
                {existing?.name || existing?.label || `${levelLabels[level]} ${existing?.position}`}
              </strong>
              ? This will also delete everything inside it.
            </p>
          ) : (
            <div className="grid grid-cols-12 gap-3">
              {/* Zone fields */}
              {level === "zone" && (
                <>
                  <div className="col-span-12 sm:col-span-6">
                    <Label>Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder='e.g. "Workshop", "Garage"'
                    />
                  </div>
                  <div className="col-span-12 sm:col-span-6">
                    <Label>Type</Label>
                    <Select value={type} onValueChange={(v) => { if (v) setType(v); }}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {zoneTypeOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-12">
                    <Label>Description</Label>
                    <textarea
                      className="flex w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 min-h-[60px]"
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={2}
                      placeholder="Optional"
                    />
                  </div>
                </>
              )}

              {/* Rack fields */}
              {level === "rack" && (
                <>
                  <div className="col-span-12">
                    <Label>Rack Name</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      placeholder='e.g. "Rack A", "Left Wall"'
                    />
                  </div>
                  {isNewRack && (
                    <>
                      <div className="col-span-12">
                        <Separator />
                        <p className="text-sm font-medium text-muted-foreground mt-2">
                          Quick Setup
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Auto-create shelves, bays, and slots. You can always add more later.
                        </p>
                      </div>
                      <div className="col-span-4">
                        <Label>Shelves</Label>
                        <Input
                          type="number"
                          value={quickShelves}
                          onChange={(e) => setQuickShelves(e.target.value)}
                          min={0}
                          max={50}
                        />
                      </div>
                      <div className="col-span-4">
                        <Label>Bays / shelf</Label>
                        <Input
                          type="number"
                          value={quickBays}
                          onChange={(e) => setQuickBays(e.target.value)}
                          min={0}
                          max={50}
                        />
                      </div>
                      <div className="col-span-4">
                        <Label>Slots / bay</Label>
                        <Input
                          type="number"
                          value={quickSlots}
                          onChange={(e) => setQuickSlots(e.target.value)}
                          min={0}
                          max={100}
                        />
                      </div>
                      {(parseInt(quickShelves) || 0) > 0 && (
                        <div className="col-span-12">
                          <p className="text-xs text-muted-foreground">
                            Will create{" "}
                            <strong>
                              {parseInt(quickShelves) || 0} shelves
                              {(parseInt(quickBays) || 0) > 0 &&
                                ` \u00d7 ${parseInt(quickBays)} bays`}
                              {(parseInt(quickSlots) || 0) > 0 &&
                                (parseInt(quickBays) || 0) > 0 &&
                                ` \u00d7 ${parseInt(quickSlots)} slots`}
                            </strong>
                            {" = "}
                            {(parseInt(quickShelves) || 0) *
                              Math.max(parseInt(quickBays) || 0, 1) *
                              Math.max(parseInt(quickSlots) || 0, 1)}{" "}
                            total slots
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Shelf / Bay / Slot */}
              {(level === "shelf" || level === "bay" || level === "slot") && (
                <>
                  <div className="col-span-6">
                    <Label>Position</Label>
                    <Input
                      type="number"
                      value={position}
                      onChange={(e) => setPosition(e.target.value)}
                      min={1}
                    />
                  </div>
                  <div className="col-span-6">
                    <Label>Label (optional)</Label>
                    <Input
                      value={label}
                      onChange={(e) => setLabel(e.target.value)}
                      placeholder="Auto-numbered if blank"
                    />
                  </div>
                </>
              )}

              {/* Slot address */}
              {level === "slot" && (
                <div className="col-span-12">
                  <Label>Address (optional)</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="e.g. WS-A-2-1-3 — auto-generated if blank"
                  />
                </div>
              )}

              {/* Shortcode */}
              {level === "zone" && (
                <div className="col-span-12">
                  <Label>Shortcode (optional)</Label>
                  <Input
                    value={nfcTagId}
                    onChange={(e) => setNfcTagId(e.target.value)}
                    placeholder='e.g. "OF" → OF-A-1-2-3'
                  />
                  <p className="text-xs text-muted-foreground mt-1">Used as a prefix when generating slot addresses</p>
                </div>
              )}
            </div>
          )}

          {progress && (
            <p className="text-xs text-muted-foreground">{progress}</p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            variant={isDelete ? "destructive" : "default"}
            disabled={
              saving ||
              (!isDelete &&
                ((level === "zone" && !name) ||
                  (level === "rack" && !name)))
            }
          >
            {saving
              ? "Saving..."
              : isDelete
              ? "Delete"
              : isNewRack
              ? "Create Rack"
              : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
