"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Cpu,
  Plus,
  Trash2,
  Printer,
  Check,
  Pencil,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import {
  listMyZones,
  listRacksByZone,
  getRackTopology,
  updateZone,
  updateRack,
  updateShelf,
  updateBay,
  updateSlot,
  createShelf,
  createBay,
  createSlot,
  removeShelf,
  removeBay,
  removeSlot,
} from "@/lib/actions/hardware";
import { moveItemToSlot, removeItemFromSlot } from "@/lib/actions/scan";
import { SlotDrawer } from "@/components/locations/slot-drawer";
import { LocationDialog } from "@/components/locations/location-dialog";
import {
  PrintLabelDialog,
  type PrintLabelItem,
} from "@/components/labels/print-label-dialog";
import {
  RackVisualizer,
  type RackVisualizerCallbacks,
} from "@/components/locations/rack-visualizer";

type SlotStatusData = { state: string; [key: string]: unknown };
type SlotData = { id: string; position: number; label?: string | null; address?: string | null; status?: SlotStatusData | null; [key: string]: unknown };
type BayData = { id: string; position: number; label?: string | null; slots: SlotData[]; [key: string]: unknown };
type ShelfData = { id: string; position: number; label?: string | null; bays: BayData[]; [key: string]: unknown };
type RackTopology = { id: string; name?: string; position?: number | null; shelves: ShelfData[]; [key: string]: unknown };
type ZoneSummary = { id: string; name: string; type?: string | null; description: string | null; [key: string]: unknown };

type ZoneWithRacks = { zone: ZoneSummary; racks: RackTopology[] };
type PrintDialogState = { open: boolean; items: PrintLabelItem[]; title?: string };
const closedPrint: PrintDialogState = { open: false, items: [] };

export function RackTopologyTab({ editing = false }: { editing?: boolean } = {}) {
  const [zonesWithRacks, setZonesWithRacks] = useState<ZoneWithRacks[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [printDialog, setPrintDialog] = useState<PrintDialogState>(closedPrint);
  const [addDialog, setAddDialog] = useState<{ open: boolean; level: "zone" | "rack"; parentId?: string }>({ open: false, level: "zone" });
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; level: "zone" | "rack"; existing?: Record<string, any> | null }>({ open: false, level: "zone" });
  const [expandedRacks, setExpandedRacks] = useState<Set<string>>(new Set());
  const [expandedShelves, setExpandedShelves] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    const result = await listMyZones();
    if (result.data) {
      const zoneList = result.data as ZoneSummary[];
      const zwr: ZoneWithRacks[] = [];
      await Promise.allSettled(
        zoneList.map(async (zone) => {
          const racksResult = await listRacksByZone(zone.id);
          const rackSummaries = racksResult.data ?? [];
          const rackTopos: RackTopology[] = [];
          await Promise.allSettled(
            (rackSummaries as any[]).map(async (rack: any) => {
              const t = await getRackTopology(rack.id);
              if (t.data) {
                const topo = t.data as any;
                for (const shelf of topo.shelves ?? []) {
                  for (const bay of shelf.bays ?? []) {
                    for (const slot of bay.slots ?? []) {
                      const item = slot.items?.[0];
                      if (item && item.status === "active") {
                        slot.status = {
                          ...(slot.status ?? {}),
                          state: "active",
                          userItemId: item.id,
                          colorHex: item.measuredColorHex,
                          colorName: item.product?.colorName,
                          nfcUid: item.nfcUid,
                          weightStableG: item.currentWeightG,
                          percentRemaining: item.percentRemaining,
                          productName: item.product?.name,
                          brandName: item.product?.brand?.name,
                          brandLogoUrl: item.product?.brand?.logoUrl,
                          materialName: item.product?.material?.abbreviation ?? item.product?.material?.name,
                          packageType: item.packageType,
                          initialWeightG: item.initialWeightG,
                          purchasePrice: item.purchasePrice,
                          purchaseCurrency: item.purchaseCurrency,
                          purchasedAt: item.purchasedAt,
                          lotNumber: item.lotNumber,
                          serialNumber: item.serialNumber,
                          rating: item.rating,
                          nozzleTempMin: item.product?.filamentProfile?.nozzleTempMin,
                          nozzleTempMax: item.product?.filamentProfile?.nozzleTempMax,
                          bedTempMin: item.product?.filamentProfile?.bedTempMin,
                          bedTempMax: item.product?.filamentProfile?.bedTempMax,
                          dryingTemp: item.product?.filamentProfile?.dryingTemp,
                          dryingTimeMin: item.product?.filamentProfile?.dryingTimeMin,
                          flowRatio: item.product?.filamentProfile?.defaultFlowRatio,
                          td: item.product?.filamentProfile?.transmissionDistance,
                        };
                      }
                    }
                  }
                }
                rackTopos.push(topo as RackTopology);
              }
            })
          );
          zwr.push({ zone, racks: rackTopos });
        })
      );
      setZonesWithRacks(zwr);
      if (expandedRacks.size === 0) {
        const rIds = new Set<string>();
        const sIds = new Set<string>();
        zwr.forEach(({ racks }) => racks.forEach((r) => {
          rIds.add(r.id);
          r.shelves?.forEach((s) => sIds.add(s.id));
        }));
        setExpandedRacks(rIds);
        setExpandedShelves(sIds);
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaved = () => {
    setAddDialog({ open: false, level: "zone" });
    setDeleteDialog({ open: false, level: "zone" });
    loadData();
  };

  const toggleRack = (id: string) => setExpandedRacks((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
  const toggleShelf = (id: string) => setExpandedShelves((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const saveShelf = async (id: string, updates: { label?: string | null; position?: number }) => {
    await updateShelf(id, updates);
    loadData();
  };
  const saveBayLabel = async (id: string, label: string) => {
    await updateBay(id, { label: label || null });
    loadData();
  };
  const saveSlotLabel = async (id: string, label: string) => {
    await updateSlot(id, { label: label || null });
    loadData();
  };

  const addShelfToRack = async (rackId: string, currentShelves: ShelfData[]) => {
    const maxPos = (currentShelves ?? []).reduce((m, s) => Math.max(m, s.position), 0);
    await createShelf({ rackId, position: maxPos + 1 });
    loadData();
  };
  const addBayToShelf = async (shelfId: string, currentBays: BayData[]) => {
    const maxPos = (currentBays ?? []).reduce((m, b) => Math.max(m, b.position), 0);
    await createBay({ shelfId, position: maxPos + 1 });
    loadData();
  };
  const addSlotToBay = async (bayId: string, currentSlots: SlotData[]) => {
    const maxPos = (currentSlots ?? []).reduce((m, s) => Math.max(m, s.position), 0);
    await createSlot({ bayId, position: maxPos + 1 });
    loadData();
  };

  const deleteShelf = async (id: string) => { await removeShelf(id); loadData(); };
  const deleteBay = async (id: string) => { await removeBay(id); loadData(); };
  const deleteSlot = async (id: string) => { await removeSlot(id); loadData(); };

  const baySlotItems = (bay: BayData, shelfLabel: string | number, rackName: string): PrintLabelItem[] =>
    bay.slots.map((slot) => ({
      label: `Slot ${slot.label || slot.position}`,
      location: `${rackName} / Shelf ${shelfLabel} / Bay ${bay.label || bay.position} / Slot ${slot.label || slot.position}`,
      ...(slot.address ? { lotNumber: slot.address } : {}),
    }));

  const openRackPrint = (rack: RackTopology) => {
    const rackName = rack.name ?? rack.id.slice(0, 8);
    const items = (rack.shelves ?? []).flatMap((shelf) =>
      shelf.bays.flatMap((bay) => baySlotItems(bay, shelf.label || shelf.position, rackName))
    );
    if (items.length === 0) return;
    setPrintDialog({ open: true, items, title: `Print \u2014 Rack ${rackName} (${items.length} slots)` });
  };

  const openZonePrint = (zone: ZoneSummary, zoneRacks: RackTopology[]) => {
    const items = zoneRacks.flatMap((rack) => {
      const rackName = rack.name ?? rack.id.slice(0, 8);
      return (rack.shelves ?? []).flatMap((shelf) =>
        shelf.bays.flatMap((bay) => baySlotItems(bay, shelf.label || shelf.position, rackName))
      );
    });
    if (items.length === 0) return;
    setPrintDialog({ open: true, items, title: `Print \u2014 ${zone.name} (${items.length} slots)` });
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[120px] rounded-lg" />
        ))}
      </div>
    );
  }

  if (zonesWithRacks.length === 0) {
    return (
      <>
        <div className="text-center py-16">
          <Cpu className="size-12 text-muted-foreground/40 mx-auto mb-2" />
          <p className="font-medium">No locations configured</p>
          <p className="text-sm text-muted-foreground">Add your first zone to start organizing your storage layout.</p>
        </div>
        <LocationDialog
          open={addDialog.open}
          level={addDialog.level}
          parentId={addDialog.parentId}
          onClose={() => setAddDialog({ open: false, level: "zone" })}
          onSaved={handleSaved}
        />
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        {zonesWithRacks.map(({ zone, racks }) => (
          <div key={zone.id} className="rounded-lg border bg-card text-card-foreground shadow-sm">
            <div className="p-4">
              {/* Zone header */}
              <ZoneHeader
                zone={zone}
                editing={editing}
                onSave={async (updates) => { await updateZone(zone.id, updates); loadData(); }}
                onPrint={() => openZonePrint(zone, racks)}
                onDelete={() => setDeleteDialog({ open: true, level: "zone", existing: zone })}
              />

              {/* Racks */}
              {racks.map((rack) => {
                const rackExpanded = expandedRacks.has(rack.id);
                return (
                  <div key={rack.id} className="border border-border rounded-lg mb-2 overflow-hidden">
                    <RackHeader
                      rack={rack}
                      expanded={rackExpanded}
                      editing={editing}
                      onToggle={() => toggleRack(rack.id)}
                      onSave={async (updates) => { await updateRack(rack.id, updates); loadData(); }}
                      onPrint={() => openRackPrint(rack)}
                      onDelete={() => setDeleteDialog({ open: true, level: "rack", existing: rack })}
                    />

                    {rackExpanded && (
                      <div className="flex gap-4">
                        <div className="flex-1 px-3 py-2 min-w-0">
                          <RackVisualizer
                            rack={rack}
                            displayStyle="shelf"
                            editing={editing}
                            selectedSlotId={selectedSlotId}
                            callbacks={{
                              onSaveSlotLabel: saveSlotLabel,
                              onDeleteSlot: deleteSlot,
                              onAddSlotToBay: addSlotToBay,
                              onSaveBayLabel: saveBayLabel,
                              onDeleteBay: deleteBay,
                              onAddBayToShelf: addBayToShelf,
                              onSaveShelf: saveShelf,
                              onDeleteShelf: deleteShelf,
                              onAddShelfToRack: addShelfToRack,
                              onSlotClick: (slot) => {
                                setSelectedSlotId((prev) => prev === slot.id ? null : slot.id);
                              },
                              onDragMoveItem: async (itemId, _fromSlotId, toSlotId) => {
                                await moveItemToSlot(itemId, toSlotId);
                                loadData();
                              },
                              onPrintSlot: (slot, context) => {
                                const rackName = rack.name ?? rack.id.slice(0, 8);
                                setPrintDialog({
                                  open: true,
                                  items: [{
                                    label: `Slot ${slot.label || slot.position}`,
                                    location: `${rackName} / ${context} / Slot ${slot.label || slot.position}`,
                                    ...(slot.address ? { lotNumber: slot.address } : {}),
                                  }],
                                  title: `Print \u2014 Slot ${slot.label || slot.position}`,
                                });
                              },
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {editing && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setAddDialog({ open: true, level: "rack", parentId: zone.id })}
                  className="mt-1"
                >
                  <Plus className="size-4" data-icon="inline-start" />
                  Add Rack
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      <LocationDialog
        open={addDialog.open}
        level={addDialog.level}
        parentId={addDialog.parentId}
        onClose={() => setAddDialog({ open: false, level: "zone" })}
        onSaved={handleSaved}
      />

      <LocationDialog
        open={deleteDialog.open}
        level={deleteDialog.level}
        existing={deleteDialog.existing}
        deleteMode
        onClose={() => setDeleteDialog({ open: false, level: "zone" })}
        onSaved={handleSaved}
      />

      <PrintLabelDialog
        open={printDialog.open}
        items={printDialog.items}
        title={printDialog.title}
        onClose={() => setPrintDialog(closedPrint)}
      />

      <SlotDrawer
        key={selectedSlotId}
        slotId={selectedSlotId}
        onClose={() => setSelectedSlotId(null)}
        onUpdate={loadData}
        onPrintSlot={selectedSlotId ? () => {
          for (const { racks } of zonesWithRacks) {
            for (const rack of racks) {
              const rackName = rack.name ?? rack.id.slice(0, 8);
              for (const shelf of rack.shelves ?? []) {
                for (const bay of shelf.bays ?? []) {
                  const slot = bay.slots.find((s) => s.id === selectedSlotId);
                  if (slot) {
                    const st = slot.status as any;
                    const loc = `${rackName} / Shelf ${shelf.label || shelf.position} / Bay ${bay.label || bay.position} / Slot ${slot.label || slot.position}`;
                    const hasItem = st?.state === "active" && st.userItemId;
                    if (hasItem) {
                      const nozzleTemp = st.nozzleTempMin && st.nozzleTempMax
                        ? `${st.nozzleTempMin}-${st.nozzleTempMax}\u00b0C`
                        : st.nozzleTempMin ? `${st.nozzleTempMin}\u00b0C` : undefined;
                      const bedTemp = st.bedTempMin && st.bedTempMax
                        ? `${st.bedTempMin}-${st.bedTempMax}\u00b0C`
                        : st.bedTempMin ? `${st.bedTempMin}\u00b0C` : undefined;
                      setPrintDialog({
                        open: true,
                        items: [{
                          label: st.productName ?? "Item",
                          brand: st.brandName,
                          brandLogoUrl: st.brandLogoUrl,
                          material: st.materialName,
                          color: st.colorHex,
                          colorName: st.colorName,
                          nozzleTemp,
                          bedTemp,
                          dryingInfo: st.dryingTemp ? `${st.dryingTemp}\u00b0C / ${st.dryingTimeMin ? Math.round(st.dryingTimeMin / 60) + "h" : "?"}` : undefined,
                          flowRatio: st.flowRatio ? String(st.flowRatio) : undefined,
                          td: st.td ? String(st.td) : undefined,
                          weight: st.weightStableG ? `${Math.round(st.weightStableG)}g` : undefined,
                          location: loc,
                          lotNumber: st.lotNumber ?? (slot.address || undefined),
                          filamentId: st.userItemId?.slice(0, 8),
                          price: st.purchasePrice ? `${st.purchaseCurrency ?? "$"}${Number(st.purchasePrice).toFixed(2)}` : undefined,
                          purchaseDate: st.purchasedAt ? new Date(st.purchasedAt).toLocaleDateString() : undefined,
                        }],
                        title: `Print \u2014 ${st.brandName ? st.brandName + " " : ""}${st.productName ?? "Item"}`,
                      });
                    } else {
                      setPrintDialog({
                        open: true,
                        items: [{
                          label: `Slot ${slot.label || slot.position}`,
                          location: loc,
                          ...(slot.address ? { lotNumber: slot.address } : {}),
                        }],
                        title: `Print \u2014 Slot ${slot.label || slot.position}`,
                      });
                    }
                    return;
                  }
                }
              }
            }
          }
        } : undefined}
      />
    </>
  );
}

// ── Zone header with inline-expandable editing ──────────────────────────────

function ZoneHeader({
  zone,
  editing: pageEditing,
  onSave,
  onPrint,
  onDelete,
}: {
  zone: ZoneSummary;
  editing: boolean;
  onSave: (updates: { name?: string; description?: string | null; nfcTagId?: string | null }) => Promise<void>;
  onPrint: () => void;
  onDelete: () => void;
}) {
  const [editingState, setEditingState] = useState(false);
  const [name, setName] = useState(zone.name);
  const [description, setDescription] = useState(zone.description ?? "");
  const [shortcode, setShortcode] = useState((zone as any).nfcTagId ?? "");

  useEffect(() => {
    setName(zone.name);
    setDescription(zone.description ?? "");
    setShortcode((zone as any).nfcTagId ?? "");
  }, [zone]);

  const commit = async () => {
    const updates: Record<string, any> = {};
    if (name.trim() && name.trim() !== zone.name) updates.name = name.trim();
    if ((description || null) !== (zone.description || null)) updates.description = description || null;
    if ((shortcode || null) !== ((zone as any).nfcTagId || null)) updates.nfcTagId = shortcode || null;
    if (Object.keys(updates).length > 0) await onSave(updates);
    setEditingState(false);
  };

  if (editingState) {
    return (
      <div className="mb-3">
        <div className="flex items-center gap-2 mb-2">
          <Cpu className="size-5 text-primary" />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-transparent border-b border-input outline-none text-xl font-semibold flex-1"
            placeholder="Zone name"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditingState(false); }}
          />
          <div className="ml-auto flex gap-1">
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={commit} />}>
                <Check className="size-4 text-primary" />
              </TooltipTrigger>
              <TooltipContent>Save</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => setEditingState(false)} />}>
                <X className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Cancel</TooltipContent>
            </Tooltip>
          </div>
        </div>
        <div className="flex gap-3 pl-7">
          <textarea
            className="flex-1 bg-transparent border border-input rounded-lg px-2.5 py-1 text-sm outline-none focus-visible:border-ring min-h-[40px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            onKeyDown={(e) => { if (e.key === "Escape") setEditingState(false); }}
          />
          <div>
            <Input
              value={shortcode}
              onChange={(e) => setShortcode(e.target.value)}
              className="w-[120px]"
              placeholder="e.g. OF"
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditingState(false); }}
            />
            <p className="text-[10px] text-muted-foreground mt-0.5">Address prefix</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between mb-3">
      <div
        className={`flex items-center gap-3 ${pageEditing ? "cursor-pointer" : ""}`}
        onClick={pageEditing ? () => setEditingState(true) : undefined}
      >
        <Cpu className="size-5 text-primary" />
        <h3 className={`text-lg font-semibold ${pageEditing ? "hover:underline decoration-dashed" : ""}`}>
          {zone.name}
        </h3>
        {zone.description && (
          <span className="text-sm text-muted-foreground">{zone.description}</span>
        )}
        {(zone as any).nfcTagId && (
          <span className="text-xs text-muted-foreground/60 font-mono">
            [{(zone as any).nfcTagId}]
          </span>
        )}
      </div>
      <div className="flex items-center gap-1">
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={onPrint} />}>
            <Printer className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Print all labels</TooltipContent>
        </Tooltip>
        {pageEditing && (
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={onDelete} />}>
              <Trash2 className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Delete zone</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

// ── Rack header with inline-expandable editing ───────────────────────────────

function RackHeader({
  rack,
  expanded,
  editing: pageEditing,
  onToggle,
  onSave,
  onPrint,
  onDelete,
}: {
  rack: RackTopology;
  expanded: boolean;
  editing: boolean;
  onToggle: () => void;
  onSave: (updates: { name?: string; position?: number | null }) => Promise<void>;
  onPrint: () => void;
  onDelete: () => void;
}) {
  const [inlineEditing, setInlineEditing] = useState(false);
  const rackName = rack.name ?? rack.id.slice(0, 8);
  const [name, setName] = useState(rackName);
  const [position, setPosition] = useState(String(rack.position ?? ""));

  useEffect(() => {
    setName(rack.name ?? rack.id.slice(0, 8));
    setPosition(String(rack.position ?? ""));
  }, [rack]);

  const commit = async () => {
    const updates: Record<string, any> = {};
    if (name.trim() && name.trim() !== rackName) updates.name = name.trim();
    const newPos = position.trim() ? parseInt(position) : null;
    if (newPos !== (rack.position ?? null)) updates.position = newPos;
    if (Object.keys(updates).length > 0) await onSave(updates);
    setInlineEditing(false);
  };

  if (inlineEditing) {
    return (
      <div
        className="px-3 py-2 bg-muted/50"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2">
          {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="bg-transparent border-b border-input outline-none font-medium flex-1"
            placeholder="Rack name"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setInlineEditing(false); }}
          />
          <input
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            className="bg-transparent border-b border-input outline-none w-12 text-center"
            placeholder="Pos"
            type="number"
            onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setInlineEditing(false); }}
          />
          <div className="ml-auto flex gap-1">
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={commit} />}>
                <Check className="size-4 text-primary" />
              </TooltipTrigger>
              <TooltipContent>Save</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={() => setInlineEditing(false)} />}>
                <X className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Cancel</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted"
      onClick={onToggle}
    >
      {expanded ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
      <span
        className={`font-medium ${pageEditing ? "cursor-pointer hover:underline decoration-dashed" : ""}`}
        onClick={pageEditing ? (e) => { e.stopPropagation(); setInlineEditing(true); } : undefined}
      >
        {rackName}
      </span>
      {rack.position != null && (
        <span className="text-xs text-muted-foreground/60 font-mono">
          #{rack.position}
        </span>
      )}
      <span className="text-xs text-muted-foreground">
        {rack.shelves?.length ?? 0} {(rack.shelves?.length ?? 0) === 1 ? "shelf" : "shelves"}
      </span>
      <div className="ml-auto flex gap-1">
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); onPrint(); }} />}>
            <Printer className="size-4" />
          </TooltipTrigger>
          <TooltipContent>Print labels</TooltipContent>
        </Tooltip>
        {pageEditing && (
          <Tooltip>
            <TooltipTrigger render={<Button variant="ghost" size="icon-xs" onClick={(e) => { e.stopPropagation(); onDelete(); }} />}>
              <Trash2 className="size-4" />
            </TooltipTrigger>
            <TooltipContent>Delete rack</TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}
