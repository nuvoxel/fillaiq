"use client";

import { useState, useEffect } from "react";
import Box from "@mui/material/Box";
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
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import MemoryIcon from "@mui/icons-material/Memory";
import { listZones, listRacksByZone, getRackTopology } from "@/lib/actions/hardware";

type SlotStatusData = { state: string; [key: string]: unknown };
type SlotData = { id: string; position: number; status?: SlotStatusData | null; [key: string]: unknown };
type BayData = { id: string; position: number; slots: SlotData[]; [key: string]: unknown };
type ShelfData = { id: string; position: number; bayCount: number | null; hasTempHumiditySensor: boolean | null; bays: BayData[]; [key: string]: unknown };
type RackTopology = { id: string; name?: string; shelves: ShelfData[]; [key: string]: unknown };
type ZoneSummary = { id: string; name: string; description: string | null; [key: string]: unknown };

const slotStateColors: Record<string, string> = {
  active: "#16A34A",
  empty: "#9CA3AF",
  error: "#DC2626",
  detecting: "#D97706",
  unknown_spool: "#7C3AED",
  removed: "#6B7280",
};

type ZoneWithRacks = {
  zone: ZoneSummary;
  racks: RackTopology[];
};

export function RackTopologyTab() {
  const [zonesWithRacks, setZonesWithRacks] = useState<ZoneWithRacks[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listZones().then(async (result) => {
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
                if (t.data) rackTopos.push(t.data as RackTopology);
              })
            );
            zwr.push({ zone, racks: rackTopos });
          })
        );
        setZonesWithRacks(zwr);
      }
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <Stack spacing={2}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={120} />
        ))}
      </Stack>
    );
  }

  if (zonesWithRacks.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 8 }}>
        <MemoryIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
        <Typography variant="subtitle1" fontWeight={500}>
          No zones configured
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Add your first zone to start monitoring hardware.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={2}>
      {zonesWithRacks.map(({ zone, racks }) => (
        <Card key={zone.id}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                <MemoryIcon color="primary" />
                <Typography variant="h6" fontWeight={600}>{zone.name}</Typography>
                {zone.description && (
                  <Typography variant="body2" color="text.secondary">{zone.description}</Typography>
                )}
              </Box>
              <Chip label="Online" size="small" color="success" />
            </Box>

            {racks.map((rack) => (
              <Accordion key={rack.id} disableGutters sx={{ border: 1, borderColor: "divider", "&:before": { display: "none" }, mb: 1 }}>
                <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <Typography fontWeight={500}>Rack {rack.name ?? rack.id.slice(0, 8)}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {rack.shelves?.length ?? 0} {(rack.shelves?.length ?? 0) === 1 ? "shelf" : "shelves"}
                    </Typography>
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  {rack.shelves?.map((shelf) => (
                    <Accordion key={shelf.id} disableGutters sx={{ border: 1, borderColor: "divider", "&:before": { display: "none" }, mb: 0.5 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          <Typography variant="body2" fontWeight={500}>Shelf {shelf.position}</Typography>
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
                              <Box sx={{ border: 1, borderColor: "divider", borderRadius: 2, p: 1, textAlign: "center" }}>
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
                                    <Typography variant="caption" color="text.disabled">Empty</Typography>
                                  )}
                                </Box>
                              </Box>
                            </Grid>
                          ))}
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </AccordionDetails>
              </Accordion>
            ))}
          </CardContent>
        </Card>
      ))}
    </Stack>
  );
}
