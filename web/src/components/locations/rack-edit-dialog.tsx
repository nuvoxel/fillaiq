"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
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
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  getRackTopology,
  updateRack,
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

type SlotEdit = { id?: string; position: number; label: string; _delete?: boolean };
type BayEdit = { id?: string; position: number; label: string; slots: SlotEdit[]; _delete?: boolean };
type ShelfEdit = { id?: string; position: number; label: string; bays: BayEdit[]; _delete?: boolean };

type Props = {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  rackId: string;
  rackName: string;
};

export function RackEditDialog({ open, onClose, onSaved, rackId, rackName }: Props) {
  const [name, setName] = useState(rackName);
  const [shelves, setShelves] = useState<ShelfEdit[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(rackName);
    setError(null);
    setSaving(false);
    setLoading(true);

    (async () => {
      const result = await getRackTopology(rackId);
      if (result.data) {
        const topo = result.data as any;
        setShelves(
          (topo.shelves ?? []).map((s: any) => ({
            id: s.id,
            position: s.position,
            label: s.label ?? "",
            bays: (s.bays ?? []).map((b: any) => ({
              id: b.id,
              position: b.position,
              label: b.label ?? "",
              slots: (b.slots ?? []).map((sl: any) => ({
                id: sl.id,
                position: sl.position,
                label: sl.label ?? "",
              })),
            })),
          }))
        );
      }
      setLoading(false);
    })();
  }, [open, rackId, rackName]);

  const addShelf = () => {
    const maxPos = shelves.filter((s) => !s._delete).reduce((m, s) => Math.max(m, s.position), 0);
    setShelves([...shelves, { position: maxPos + 1, label: "", bays: [] }]);
  };

  const updateShelfField = (idx: number, field: keyof ShelfEdit, value: any) => {
    setShelves(shelves.map((s, i) => (i === idx ? { ...s, [field]: value } : s)));
  };

  const markShelfDeleted = (idx: number) => {
    setShelves(shelves.map((s, i) => (i === idx ? { ...s, _delete: true } : s)));
  };

  const addBay = (shelfIdx: number) => {
    setShelves(shelves.map((s, si) => {
      if (si !== shelfIdx) return s;
      const maxPos = s.bays.filter((b) => !b._delete).reduce((m, b) => Math.max(m, b.position), 0);
      return { ...s, bays: [...s.bays, { position: maxPos + 1, label: "", slots: [] }] };
    }));
  };

  const updateBayField = (shelfIdx: number, bayIdx: number, field: keyof BayEdit, value: any) => {
    setShelves(shelves.map((s, si) => {
      if (si !== shelfIdx) return s;
      return { ...s, bays: s.bays.map((b, bi) => (bi === bayIdx ? { ...b, [field]: value } : b)) };
    }));
  };

  const markBayDeleted = (shelfIdx: number, bayIdx: number) => {
    setShelves(shelves.map((s, si) => {
      if (si !== shelfIdx) return s;
      return { ...s, bays: s.bays.map((b, bi) => (bi === bayIdx ? { ...b, _delete: true } : b)) };
    }));
  };

  const addSlot = (shelfIdx: number, bayIdx: number) => {
    setShelves(shelves.map((s, si) => {
      if (si !== shelfIdx) return s;
      return {
        ...s,
        bays: s.bays.map((b, bi) => {
          if (bi !== bayIdx) return b;
          const maxPos = b.slots.filter((sl) => !sl._delete).reduce((m, sl) => Math.max(m, sl.position), 0);
          return { ...b, slots: [...b.slots, { position: maxPos + 1, label: "" }] };
        }),
      };
    }));
  };

  const updateSlotField = (shelfIdx: number, bayIdx: number, slotIdx: number, field: keyof SlotEdit, value: any) => {
    setShelves(shelves.map((s, si) => {
      if (si !== shelfIdx) return s;
      return {
        ...s,
        bays: s.bays.map((b, bi) => {
          if (bi !== bayIdx) return b;
          return { ...b, slots: b.slots.map((sl, sli) => (sli === slotIdx ? { ...sl, [field]: value } : sl)) };
        }),
      };
    }));
  };

  const markSlotDeleted = (shelfIdx: number, bayIdx: number, slotIdx: number) => {
    setShelves(shelves.map((s, si) => {
      if (si !== shelfIdx) return s;
      return {
        ...s,
        bays: s.bays.map((b, bi) => {
          if (bi !== bayIdx) return b;
          return { ...b, slots: b.slots.map((sl, sli) => (sli === slotIdx ? { ...sl, _delete: true } : sl)) };
        }),
      };
    }));
  };

  const handleSave = async () => {
    setError(null);
    setSaving(true);

    try {
      if (name !== rackName) {
        const r = await updateRack(rackId, { name });
        if (r.error) { setError(r.error); setSaving(false); return; }
      }

      for (const shelf of shelves) {
        if (shelf._delete && shelf.id) {
          await removeShelf(shelf.id);
          continue;
        }

        let shelfId = shelf.id;
        if (!shelfId) {
          const r = await createShelf({ rackId, position: shelf.position, label: shelf.label || null });
          if (r.error) { setError(r.error); setSaving(false); return; }
          shelfId = r.data?.id;
        } else {
          await updateShelf(shelfId, { position: shelf.position, label: shelf.label || null });
        }

        if (!shelfId) continue;

        for (const bay of shelf.bays) {
          if (bay._delete && bay.id) {
            await removeBay(bay.id);
            continue;
          }

          let bayId = bay.id;
          if (!bayId) {
            const r = await createBay({ shelfId, position: bay.position, label: bay.label || null });
            if (r.error) continue;
            bayId = r.data?.id;
          } else {
            await updateBay(bayId, { position: bay.position, label: bay.label || null });
          }

          if (!bayId) continue;

          for (const slot of bay.slots) {
            if (slot._delete && slot.id) {
              await removeSlot(slot.id);
              continue;
            }

            if (!slot.id) {
              await createSlot({ bayId, position: slot.position, label: slot.label || null });
            } else {
              await updateSlot(slot.id, { position: slot.position, label: slot.label || null });
            }
          }
        }
      }

      setSaving(false);
      onSaved();
      onClose();
    } catch (e) {
      setError((e as Error).message);
      setSaving(false);
    }
  };

  const visibleShelves = shelves.filter((s) => !s._delete);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit Rack</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div>
                <Label>Rack Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <Separator />

              {visibleShelves.length === 0 && (
                <p className="text-sm text-muted-foreground">No shelves yet.</p>
              )}

              {shelves.map((shelf, si) => {
                if (shelf._delete) return null;
                const visibleBays = shelf.bays.filter((b) => !b._delete);

                return (
                  <div
                    key={shelf.id ?? `new-${si}`}
                    className="border border-border rounded-lg p-3"
                  >
                    {/* Shelf header */}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium min-w-[60px]">
                        Shelf {shelf.position}
                      </span>
                      <div className="flex-1">
                        <Input
                          value={shelf.label}
                          onChange={(e) => updateShelfField(si, "label", e.target.value)}
                          placeholder="Optional"
                        />
                      </div>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button variant="destructive" size="icon-xs" onClick={() => markShelfDeleted(si)} />
                          }
                        >
                          <Trash2 className="size-3.5" />
                        </TooltipTrigger>
                        <TooltipContent>Delete shelf</TooltipContent>
                      </Tooltip>
                    </div>

                    {/* Bays */}
                    {visibleBays.length > 0 && (
                      <div className="pl-4">
                        {shelf.bays.map((bay, bi) => {
                          if (bay._delete) return null;
                          const visibleSlots = bay.slots.filter((sl) => !sl._delete);

                          return (
                            <div
                              key={bay.id ?? `new-bay-${bi}`}
                              className="border border-border/50 rounded p-2 mb-2"
                            >
                              {/* Bay header */}
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-muted-foreground min-w-[50px]">
                                  Bay {bay.position}
                                </span>
                                <div className="flex-1">
                                  <Input
                                    value={bay.label}
                                    onChange={(e) => updateBayField(si, bi, "label", e.target.value)}
                                    placeholder="Optional"
                                  />
                                </div>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button variant="destructive" size="icon-xs" onClick={() => markBayDeleted(si, bi)} />
                                    }
                                  >
                                    <Trash2 className="size-3" />
                                  </TooltipTrigger>
                                  <TooltipContent>Delete bay</TooltipContent>
                                </Tooltip>
                              </div>

                              {/* Slots */}
                              {visibleSlots.length > 0 && (
                                <div className="flex flex-wrap gap-1 pl-4 mb-1">
                                  {bay.slots.map((slot, sli) => {
                                    if (slot._delete) return null;
                                    return (
                                      <div
                                        key={slot.id ?? `new-slot-${sli}`}
                                        className="flex items-center gap-0.5 border border-border/50 rounded px-1 py-0.5"
                                      >
                                        <span className="text-xs text-muted-foreground min-w-[16px]">
                                          {slot.position}
                                        </span>
                                        <input
                                          className="bg-transparent border-none outline-none text-xs w-20 p-0"
                                          value={slot.label}
                                          onChange={(e) => updateSlotField(si, bi, sli, "label", e.target.value)}
                                          placeholder={`Slot ${slot.position}`}
                                        />
                                        <button
                                          className="p-0 text-muted-foreground/50 hover:text-destructive"
                                          onClick={() => markSlotDeleted(si, bi, sli)}
                                        >
                                          <Trash2 className="size-3" />
                                        </button>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              <Button
                                variant="ghost"
                                size="xs"
                                onClick={() => addSlot(si, bi)}
                                className="ml-4"
                              >
                                <Plus className="size-3" data-icon="inline-start" />
                                Add Slot
                              </Button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <Button
                      variant="ghost"
                      size="xs"
                      onClick={() => addBay(si)}
                      className="ml-4"
                    >
                      <Plus className="size-3" data-icon="inline-start" />
                      Add Bay
                    </Button>
                  </div>
                );
              })}

              <Button
                variant="outline"
                size="sm"
                onClick={addShelf}
              >
                <Plus className="size-4" data-icon="inline-start" />
                Add Shelf
              </Button>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || loading || !name.trim()}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
