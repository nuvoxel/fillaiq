"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Grid from "@mui/material/Grid";
import Tooltip from "@mui/material/Tooltip";
import AddIcon from "@mui/icons-material/Add";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MemoryIcon from "@mui/icons-material/Memory";
import { PageHeader } from "@/components/layout/page-header";
import { listRacks, getRackTopology } from "@/lib/actions/hardware";

type SlotStatusData = {
  state: string;
  [key: string]: unknown;
};

type SlotData = {
  id: string;
  position: number;
  status?: SlotStatusData | null;
  [key: string]: unknown;
};

type BayData = {
  id: string;
  position: number;
  slots: SlotData[];
  [key: string]: unknown;
};

type ShelfData = {
  id: string;
  position: number;
  bayCount: number | null;
  isOnline: boolean | null;
  bays: BayData[];
  [key: string]: unknown;
};

type RackTopology = {
  id: string;
  name: string;
  location: string | null;
  shelves: ShelfData[];
  [key: string]: unknown;
};

type RackSummary = {
  id: string;
  name: string;
  location: string | null;
  [key: string]: unknown;
};

const slotStateColors: Record<string, string> = {
  active: "#16A34A",
  empty: "#9CA3AF",
  error: "#DC2626",
  detecting: "#D97706",
  unknown_spool: "#7C3AED",
  removed: "#6B7280",
};

export default function HardwarePage() {
  const [racks, setRacks] = useState<RackSummary[]>([]);
  const [topologies, setTopologies] = useState<Record<string, RackTopology>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listRacks().then(async (result) => {
      if (result.data) {
        setRacks(result.data as RackSummary[]);
        const topos: Record<string, RackTopology> = {};
        await Promise.allSettled(
          (result.data as RackSummary[]).map(async (rack) => {
            const t = await getRackTopology(rack.id);
            if (t.data) topos[rack.id] = t.data as RackTopology;
          })
        );
        setTopologies(topos);
      }
      setLoading(false);
    });
  }, []);

  return (
    <div>
      <PageHeader
        title="Hardware"
        description="Manage racks, shelves, and bays."
        action={
          <Button variant="contained" startIcon={<AddIcon />}>
            Add Rack
          </Button>
        }
      />

      {loading ? (
        <Stack spacing={2}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={120} />
          ))}
        </Stack>
      ) : racks.length === 0 ? (
        <Box sx={{ textAlign: "center", py: 8 }}>
          <MemoryIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
          <Typography variant="subtitle1" fontWeight={500}>
            No racks configured
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Add your first rack to start monitoring hardware.
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2}>
          {racks.map((rack) => {
            const topo = topologies[rack.id];
            return (
              <Card key={rack.id}>
                <CardContent>
                  <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <MemoryIcon color="primary" />
                      <Typography variant="h6" fontWeight={600}>
                        {rack.name}
                      </Typography>
                      {rack.location && (
                        <Typography variant="body2" color="text.secondary">
                          {rack.location}
                        </Typography>
                      )}
                    </Box>
                    <Chip label="Online" size="small" color="success" />
                  </Box>

                  {topo?.shelves?.map((shelf) => (
                    <Accordion key={shelf.id} disableGutters sx={{ border: 1, borderColor: "divider", "&:before": { display: "none" } }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography fontWeight={500}>Shelf {shelf.position}</Typography>
                          <Chip
                            label={shelf.isOnline ? "Online" : "Offline"}
                            size="small"
                            color={shelf.isOnline ? "success" : "default"}
                            variant="outlined"
                          />
                          <Typography variant="caption" color="text.secondary">
                            {shelf.bays.length} bay{shelf.bays.length !== 1 ? "s" : ""}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails>
                        <Grid container spacing={1}>
                          {shelf.bays.map((bay) => (
                            <Grid key={bay.id} size={{ xs: 6, sm: 4, md: 3, lg: 2 }}>
                              <Box
                                sx={{
                                  border: 1,
                                  borderColor: "divider",
                                  borderRadius: 2,
                                  p: 1,
                                  textAlign: "center",
                                }}
                              >
                                <Typography variant="caption" color="text.secondary">
                                  Bay {bay.position}
                                </Typography>
                                <Box sx={{ display: "flex", gap: 0.5, justifyContent: "center", mt: 0.5 }}>
                                  {bay.slots.length > 0 ? (
                                    bay.slots.map((slot) => {
                                      const state = slot.status?.state ?? "empty";
                                      return (
                                        <Tooltip key={slot.id} title={state.replace("_", " ")} arrow>
                                          <Box
                                            sx={{
                                              width: 16,
                                              height: 16,
                                              borderRadius: "50%",
                                              bgcolor: slotStateColors[state] ?? "#9CA3AF",
                                            }}
                                          />
                                        </Tooltip>
                                      );
                                    })
                                  ) : (
                                    <Typography variant="caption" color="text.disabled">
                                      Empty
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </Stack>
      )}
    </div>
  );
}
