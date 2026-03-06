import { notFound } from "next/navigation";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Chip from "@mui/material/Chip";
import Divider from "@mui/material/Divider";
import Grid from "@mui/material/Grid";
import LinearProgress from "@mui/material/LinearProgress";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { PageHeader } from "@/components/layout/page-header";
import { WeightChart } from "@/components/spools/weight-chart";
import { SpoolEventsTabs } from "@/components/spools/spool-events-tabs";
import { getSpoolWithRelations } from "@/lib/actions/user-library";
import {
  listWeightEventsBySpoolId,
  listUsageSessionsBySpoolId,
  listDryingSessionsBySpoolId,
  listSpoolMovementsBySpoolId,
} from "@/lib/actions/events";

const statusColors: Record<string, "success" | "warning" | "default"> = {
  active: "success",
  empty: "warning",
  archived: "default",
};

export default async function SpoolDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const [spoolResult, eventsResult, usageResult, dryingResult, movementsResult] =
    await Promise.allSettled([
      getSpoolWithRelations(id),
      listWeightEventsBySpoolId(id),
      listUsageSessionsBySpoolId(id),
      listDryingSessionsBySpoolId(id),
      listSpoolMovementsBySpoolId(id),
    ]);

  const spool =
    spoolResult.status === "fulfilled" && spoolResult.value.data
      ? spoolResult.value.data
      : null;
  if (!spool) notFound();

  const weightEvents =
    eventsResult.status === "fulfilled" && eventsResult.value.data
      ? eventsResult.value.data
      : [];
  const usageSessions =
    usageResult.status === "fulfilled" && usageResult.value.data
      ? usageResult.value.data
      : [];
  const dryingSessions =
    dryingResult.status === "fulfilled" && dryingResult.value.data
      ? dryingResult.value.data
      : [];
  const movements =
    movementsResult.status === "fulfilled" && movementsResult.value.data
      ? movementsResult.value.data
      : [];

  const pct = spool.percentRemaining ?? 0;
  const filament = spool.filament as
    | {
        name?: string;
        colorHex?: string;
        colorName?: string;
        brandId?: string;
      }
    | null
    | undefined;

  return (
    <div>
      <Box sx={{ mb: 2 }}>
        <Button
          href="/spools"
          startIcon={<ArrowBackIcon />}
          size="small"
        >
          Back to Spools
        </Button>
      </Box>
      <PageHeader title="Spool Details" />

      <Grid container spacing={3}>
        {/* Spool Info Card */}
        <Grid size={{ xs: 12, md: 8 }}>
          <Card>
            <CardHeader
              title="Spool Info"
              titleTypographyProps={{ fontWeight: 600, variant: "subtitle1" }}
            />
            <Divider />
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Filament
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                    {filament?.colorHex && (
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          bgcolor: filament.colorHex,
                          border: 1,
                          borderColor: "divider",
                        }}
                      />
                    )}
                    <Typography variant="body2" fontWeight={500}>
                      {filament?.name ?? "Unknown"}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Color
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {filament?.colorName ?? "—"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={spool.status}
                      size="small"
                      color={statusColors[spool.status] ?? "default"}
                    />
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    NFC UID
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {spool.nfcUid ?? "—"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    NFC Format
                  </Typography>
                  <Typography variant="body2">
                    {spool.nfcTagFormat ?? "—"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Purchased
                  </Typography>
                  <Typography variant="body2">
                    {spool.purchasedAt
                      ? new Date(spool.purchasedAt).toLocaleDateString()
                      : "—"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Opened
                  </Typography>
                  <Typography variant="body2">
                    {spool.openedAt
                      ? new Date(spool.openedAt).toLocaleDateString()
                      : "—"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Lot Number
                  </Typography>
                  <Typography variant="body2">
                    {spool.lotNumber ?? "—"}
                  </Typography>
                </Grid>
                {spool.notes && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">
                      Notes
                    </Typography>
                    <Typography variant="body2">{spool.notes}</Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Quick Stats Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card>
            <CardHeader
              title="Quick Stats"
              titleTypographyProps={{ fontWeight: 600, variant: "subtitle1" }}
            />
            <Divider />
            <CardContent>
              <Stack spacing={2}>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Remaining
                  </Typography>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mt: 0.5,
                    }}
                  >
                    <LinearProgress
                      variant="determinate"
                      value={pct}
                      sx={{
                        flex: 1,
                        height: 10,
                        borderRadius: 5,
                        bgcolor: "grey.200",
                        "& .MuiLinearProgress-bar": {
                          bgcolor:
                            pct > 50
                              ? "success.main"
                              : pct > 20
                                ? "warning.main"
                                : "error.main",
                        },
                      }}
                    />
                    <Typography variant="body2" fontWeight={600}>
                      {pct}%
                    </Typography>
                  </Box>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Current Weight
                  </Typography>
                  <Typography variant="h6" fontWeight={600}>
                    {spool.currentWeightG != null
                      ? `${Math.round(spool.currentWeightG)}g`
                      : "—"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Net Filament
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {spool.netFilamentWeightG != null
                      ? `${Math.round(spool.netFilamentWeightG)}g`
                      : "—"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Spool Weight
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {spool.spoolWeightG != null
                      ? `${Math.round(spool.spoolWeightG)}g`
                      : "—"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Cost
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {spool.purchasePrice != null
                      ? `$${spool.purchasePrice.toFixed(2)} ${spool.purchaseCurrency ?? ""}`
                      : "—"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Location
                  </Typography>
                  <Typography variant="body2">
                    {spool.storageLocation ?? (spool.currentSlotId ? `Slot ${spool.currentSlotId.slice(0, 8)}` : "Not assigned")}
                  </Typography>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Weight Chart */}
        <Grid size={{ xs: 12 }}>
          <WeightChart events={weightEvents as any} />
        </Grid>

        {/* Event Tabs */}
        <Grid size={{ xs: 12 }}>
          <SpoolEventsTabs
            usageSessions={usageSessions as any}
            dryingSessions={dryingSessions as any}
            movements={movements as any}
          />
        </Grid>
      </Grid>
    </div>
  );
}
