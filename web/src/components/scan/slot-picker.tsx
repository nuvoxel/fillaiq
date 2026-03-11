"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import List from "@mui/material/List";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemText from "@mui/material/ListItemText";
import ListItemIcon from "@mui/material/ListItemIcon";
import TextField from "@mui/material/TextField";
import InputAdornment from "@mui/material/InputAdornment";
import CircularProgress from "@mui/material/CircularProgress";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import SearchIcon from "@mui/icons-material/Search";
import PlaceIcon from "@mui/icons-material/Place";
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
};

type Props = {
  selectedSlotId: string | null;
  onSelect: (slotId: string, address: string) => void;
};

export function SlotPicker({ selectedSlotId, onSelect }: Props) {
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    getAvailableSlots().then((result) => {
      if (result.data) setSlots(result.data);
      setLoading(false);
    });
  }, []);

  const filtered = filter
    ? slots.filter(
        (s) =>
          s.address.toLowerCase().includes(filter.toLowerCase()) ||
          s.label?.toLowerCase().includes(filter.toLowerCase()) ||
          s.zoneName.toLowerCase().includes(filter.toLowerCase())
      )
    : slots;

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
          No storage slots configured. Add zones/racks/shelves in Hardware settings first.
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <TextField
        fullWidth
        size="small"
        placeholder="Filter slots..."
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          },
        }}
        sx={{ mb: 1 }}
      />
      <List
        dense
        sx={{
          maxHeight: 240,
          overflow: "auto",
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
        }}
      >
        {filtered.map((slot) => (
          <ListItemButton
            key={slot.id}
            selected={slot.id === selectedSlotId}
            onClick={() => onSelect(slot.id, slot.address)}
          >
            <ListItemIcon sx={{ minWidth: 36 }}>
              {slot.id === selectedSlotId ? (
                <CheckCircleIcon color="primary" fontSize="small" />
              ) : (
                <PlaceIcon fontSize="small" color="action" />
              )}
            </ListItemIcon>
            <ListItemText
              primary={slot.address}
              secondary={slot.label ?? `${slot.zoneName} / ${slot.rackName}`}
            />
          </ListItemButton>
        ))}
        {filtered.length === 0 && (
          <Box sx={{ py: 2, textAlign: "center" }}>
            <Typography variant="body2" color="text.secondary">
              No matching slots
            </Typography>
          </Box>
        )}
      </List>
    </Box>
  );
}
