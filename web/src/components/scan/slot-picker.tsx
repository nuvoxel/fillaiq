"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
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
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (tree.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          No storage configured. Add zones and racks in Settings first.
        </Typography>
      </Box>
    );
  }

  const callbacks: RackVisualizerCallbacks = {
    onSlotClick: (slot) => {
      const address = slot.address ?? slot.label ?? `Slot ${slot.position}`;
      onSelect(slot.id, address);
    },
  };

  return (
    <Box>
      {tree.map((zone: any) => (
        <Box key={zone.id} sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ mb: 0.5, display: "block" }}>
            {zone.name}
          </Typography>
          {zone.racks?.map((rack: any) => (
            <Box key={rack.id} sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: "block", pl: 1 }}>
                {rack.name}
              </Typography>
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
            </Box>
          ))}
        </Box>
      ))}

      {/* Legend */}
      <Box sx={{ display: "flex", gap: 1.5, mt: 1, pt: 1, borderTop: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: "#9CA3AF", border: 1, borderColor: "divider" }} />
          <Typography variant="caption" color="text.secondary">Empty</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: "#16A34A", border: 1, borderColor: "divider" }} />
          <Typography variant="caption" color="text.secondary">Occupied</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: "#1976d2", border: 3, borderColor: "#1976d2" }} />
          <Typography variant="caption" color="text.secondary">Selected</Typography>
        </Box>
      </Box>
    </Box>
  );
}
