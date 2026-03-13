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
import { SpoolActions } from "@/components/spools/spool-actions";
import { WeightChart } from "@/components/spools/weight-chart";
import { UserItemEventsTabs } from "@/components/spools/spool-events-tabs";
import { getUserItemWithRelations } from "@/lib/actions/user-library";
import {
  listWeightEventsByUserItemId,
  listUsageSessionsByUserItemId,
  listDryingSessionsByUserItemId,
  listItemMovementsByUserItemId,
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

  const [userItemResult, eventsResult, usageResult, dryingResult, movementsResult] =
    await Promise.allSettled([
      getUserItemWithRelations(id),
      listWeightEventsByUserItemId(id),
      listUsageSessionsByUserItemId(id),
      listDryingSessionsByUserItemId(id),
      listItemMovementsByUserItemId(id),
    ]);

  const userItem =
    userItemResult.status === "fulfilled" && userItemResult.value.data
      ? userItemResult.value.data
      : null;
  if (!userItem) notFound();

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

  const pct = userItem.percentRemaining ?? 0;
  const product = userItem.product as
    | {
        name?: string;
        colorHex?: string;
        colorName?: string;
        brandId?: string;
        brand?: { name?: string } | null;
        material?: { name?: string } | null;
      }
    | null
    | undefined;

  const brandName = product?.brand?.name ?? undefined;
  const materialName = product?.material?.name ?? undefined;

  return (
    <div>
      <Box
        sx={{
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Button
          href="/spools"
          startIcon={<ArrowBackIcon />}
          size="small"
        >
          Back to Spools
        </Button>
        <SpoolActions
          spool={userItem as any}
          product={product ?? null}
          brandName={brandName}
          materialName={materialName}
        />
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
                    Product
                  </Typography>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.5 }}>
                    {product?.colorHex && (
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          bgcolor: product.colorHex,
                          border: 1,
                          borderColor: "divider",
                        }}
                      />
                    )}
                    <Typography variant="body2" fontWeight={500}>
                      {product?.name ?? "Unknown"}
                    </Typography>
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Color
                  </Typography>
                  <Typography variant="body2" fontWeight={500}>
                    {product?.colorName ?? "—"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Status
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip
                      label={userItem.status}
                      size="small"
                      color={statusColors[userItem.status] ?? "default"}
                    />
                  </Box>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    NFC UID
                  </Typography>
                  <Typography variant="body2" fontFamily="monospace">
                    {userItem.nfcUid ?? "—"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    NFC Format
                  </Typography>
                  <Typography variant="body2">
                    {userItem.nfcTagFormat ?? "—"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Purchased
                  </Typography>
                  <Typography variant="body2">
                    {userItem.purchasedAt
                      ? new Date(userItem.purchasedAt).toLocaleDateString()
                      : "—"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Opened
                  </Typography>
                  <Typography variant="body2">
                    {userItem.openedAt
                      ? new Date(userItem.openedAt).toLocaleDateString()
                      : "—"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6, sm: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    Lot Number
                  </Typography>
                  <Typography variant="body2">
                    {userItem.lotNumber ?? "—"}
                  </Typography>
                </Grid>
                {userItem.notes && (
                  <Grid size={{ xs: 12 }}>
                    <Typography variant="caption" color="text.secondary">
                      Notes
                    </Typography>
                    <Typography variant="body2">{userItem.notes}</Typography>
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
                    {userItem.currentWeightG != null
                      ? `${Math.round(userItem.currentWeightG)}g`
                      : "—"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Net Filament
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {userItem.netFilamentWeightG != null
                      ? `${Math.round(userItem.netFilamentWeightG)}g`
                      : "—"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Spool Weight
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {userItem.spoolWeightG != null
                      ? `${Math.round(userItem.spoolWeightG)}g`
                      : "—"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Cost
                  </Typography>
                  <Typography variant="body1" fontWeight={500}>
                    {userItem.purchasePrice != null
                      ? `$${userItem.purchasePrice.toFixed(2)} ${userItem.purchaseCurrency ?? ""}`
                      : "—"}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">
                    Location
                  </Typography>
                  <Typography variant="body2">
                    {userItem.storageLocation ?? (userItem.currentSlotId ? `Slot ${userItem.currentSlotId.slice(0, 8)}` : "Not assigned")}
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
          <UserItemEventsTabs
            usageSessions={usageSessions as any}
            dryingSessions={dryingSessions as any}
            movements={movements as any}
          />
        </Grid>
      </Grid>
    </div>
  );
}
