"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { RackVisualizer, type RackVisualizerCallbacks } from "@/components/locations/rack-visualizer";
import { getStorageTree } from "@/lib/actions/scan";

type Props = {
  selectedSlotId: string | null;
  onSelect: (slotId: string, address: string) => void;
};

export function SlotPicker({ selectedSlotId, onSelect }: Props) {
  const [tree, setTree] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStorageTree().then((result) => {
      if (result.data) setTree(result.data);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-3">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (tree.length === 0) {
    return (
      <div className="py-2 text-center">
        <p className="text-sm text-muted-foreground">
          No storage configured. Add zones and racks in Settings first.
        </p>
      </div>
    );
  }

  const callbacks: RackVisualizerCallbacks = {
    onSlotClick: (slot) => {
      const address = slot.address ?? slot.label ?? `Slot ${slot.position}`;
      onSelect(slot.id, address);
    },
  };

  return (
    <div>
      {tree.map((zone: any) => (
        <div key={zone.id} className="mb-3">
          <span className="text-xs font-semibold text-muted-foreground block mb-1">
            {zone.name}
          </span>
          {zone.racks?.map((rack: any) => (
            <div key={rack.id} className="mb-2">
              <span className="text-xs text-muted-foreground block mb-1 pl-1">
                {rack.name}
              </span>
              <RackVisualizer
                rack={{
                  id: rack.id,
                  name: rack.name,
                  columns: rack.columns,
                  displayStyle: rack.displayStyle,
                  shelves: rack.shelves?.map((shelf: any) => ({
                    id: shelf.id,
                    position: shelf.position,
                    label: shelf.label,
                    displayStyle: shelf.displayStyle,
                    bays: shelf.bays?.map((bay: any) => ({
                      id: bay.id,
                      position: bay.position,
                      label: bay.label,
                      displayStyle: bay.displayStyle,
                      slots: bay.slots?.map((slot: any) => ({
                        id: slot.id,
                        position: slot.position,
                        label: slot.label,
                        address: slot.address,
                        nfcTagId: slot.nfcTagId,
                        status: slot.status,
                        shape: slot.shape,
                        colSpan: slot.colSpan,
                        rowSpan: slot.rowSpan,
                      })) ?? [],
                    })) ?? [],
                  })) ?? [],
                }}
                displayStyle={rack.displayStyle ?? "shelf"}
                callbacks={callbacks}
                selectedSlotId={selectedSlotId}
              />
            </div>
          ))}
        </div>
      ))}

      {/* Legend */}
      <div className="flex gap-3 mt-2 pt-2 border-t border-border">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: "#94A3B8" }} />
          <span className="text-xs text-muted-foreground">Empty</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm border border-border" style={{ backgroundColor: "#00E676" }} />
          <span className="text-xs text-muted-foreground">Occupied</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-sm border-[3px]" style={{ backgroundColor: "#00D2FF", borderColor: "#00D2FF" }} />
          <span className="text-xs text-muted-foreground">Selected</span>
        </div>
      </div>
    </div>
  );
}
