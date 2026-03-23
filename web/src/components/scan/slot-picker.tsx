"use client";

import { useState, useEffect, useMemo } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Tooltip from "@mui/material/Tooltip";
import CircularProgress from "@mui/material/CircularProgress";
import Chip from "@mui/material/Chip";
import { getAvailableSlots } from "@/lib/actions/scan";

type SlotOption = {
  id: string;
  address: string;
  label: string | null;
  zoneName: string;
  rackName: string;
  shelfPosition: number;
  bayPosition: number;
  slotPosition: number;
  occupied: boolean;
  itemColorHex: string | null;
};

type Props = {
  selectedSlotId: string | null;
  onSelect: (slotId: string, address: string) => void;
};

export function SlotPicker({ selectedSlotId, onSelect }: Props) {
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAvailableSlots().then((result) => {
      if (result.data) setSlots(result.data as SlotOption[]);
      setLoading(false);
    });
  }, []);

  // Group slots: zone → rack → shelf → slots
  const tree = useMemo(() => {
    const zones: Record<string, {
      name: string;
      racks: Record<string, {
        name: string;
        shelves: Record<number, SlotOption[]>;
      }>;
    }> = {};

    for (const slot of slots) {
      if (!zones[slot.zoneName]) zones[slot.zoneName] = { name: slot.zoneName, racks: {} };
      const zone = zones[slot.zoneName];
      if (!zone.racks[slot.rackName]) zone.racks[slot.rackName] = { name: slot.rackName, shelves: {} };
      const rack = zone.racks[slot.rackName];
      if (!rack.shelves[slot.shelfPosition]) rack.shelves[slot.shelfPosition] = [];
      rack.shelves[slot.shelfPosition].push(slot);
    }

    return zones;
  }, [slots]);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", py: 3 }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (slots.length === 0) {
    return (
      <Box sx={{ py: 2, textAlign: "center" }}>
        <Typography variant="body2" color="text.secondary">
          No storage slots configured. Add zones and racks in Settings first.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      {Object.entries(tree).map(([zoneName, zone]) => (
        <Box key={zoneName} sx={{ mb: 2 }}>
          <Typography variant="caption" fontWeight={600} color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
            {zoneName}
          </Typography>
          {Object.entries(zone.racks).map(([rackName, rack]) => (
            <Box key={rackName} sx={{ mb: 1.5, pl: 1 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
                {rackName}
              </Typography>
              {Object.entries(rack.shelves)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([shelfPos, shelfSlots]) => (
                  <Box key={shelfPos} sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5, pl: 1 }}>
                    <Typography variant="caption" color="text.disabled" sx={{ width: 24, flexShrink: 0, fontSize: "0.65rem" }}>
                      S{shelfPos}
                    </Typography>
                    <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                      {shelfSlots.map((slot) => {
                        const isSelected = slot.id === selectedSlotId;
                        const isEmpty = !slot.occupied;
                        return (
                          <Tooltip
                            key={slot.id}
                            title={`${slot.address}${slot.label ? ` (${slot.label})` : ""}${slot.occupied ? " — occupied" : " — empty"}`}
                            arrow
                          >
                            <Box
                              onClick={() => onSelect(slot.id, slot.address)}
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: 1,
                                border: isSelected ? 3 : 1,
                                borderColor: isSelected ? "primary.main" : "divider",
                                bgcolor: isSelected
                                  ? "primary.light"
                                  : isEmpty
                                    ? "success.light"
                                    : slot.itemColorHex ?? "grey.300",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.15s",
                                opacity: slot.occupied && !isSelected ? 0.6 : 1,
                                "&:hover": {
                                  borderColor: "primary.main",
                                  transform: "scale(1.15)",
                                },
                              }}
                            >
                              <Typography sx={{ fontSize: "0.55rem", fontWeight: 600, color: isSelected ? "primary.contrastText" : isEmpty ? "success.dark" : "white", textShadow: slot.occupied ? "0 0 2px rgba(0,0,0,0.5)" : "none" }}>
                                {slot.slotPosition}
                              </Typography>
                            </Box>
                          </Tooltip>
                        );
                      })}
                    </Box>
                  </Box>
                ))}
            </Box>
          ))}
        </Box>
      ))}

      {/* Legend */}
      <Box sx={{ display: "flex", gap: 1.5, mt: 1, pt: 1, borderTop: 1, borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: "success.light", border: 1, borderColor: "divider" }} />
          <Typography variant="caption" color="text.secondary">Empty</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: "grey.300", border: 1, borderColor: "divider" }} />
          <Typography variant="caption" color="text.secondary">Occupied</Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <Box sx={{ width: 12, height: 12, borderRadius: 0.5, bgcolor: "primary.light", border: 3, borderColor: "primary.main" }} />
          <Typography variant="caption" color="text.secondary">Selected</Typography>
        </Box>
      </Box>
    </Box>
  );
}
