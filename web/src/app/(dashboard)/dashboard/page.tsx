import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircleOutlinedIcon from "@mui/icons-material/CircleOutlined";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarehouseIcon from "@mui/icons-material/Warehouse";
import SendIcon from "@mui/icons-material/Send";
import { BarChart } from "@mui/x-charts/BarChart";
import { PageHeader } from "@/components/layout/page-header";
import { listAuditLogsFiltered } from "@/lib/actions/audit";
import { AuditFeed } from "@/components/audit/audit-feed";
import { listUserItems } from "@/lib/actions/user-library";
import { listZones } from "@/lib/actions/hardware";
import { listPendingSubmissions } from "@/lib/actions/submissions";
import { getUserItemWeightsByMaterial } from "@/lib/actions/dashboard";

const statCards = [
  {
    label: "Total Spools",
    icon: <CircleOutlinedIcon />,
    color: "#FF5C2E",
    bg: "#FFF0EB",
  },
  {
    label: "Active Spools",
    icon: <CheckCircleIcon />,
    color: "#16A34A",
    bg: "#F0FDF4",
  },
  {
    label: "Locations",
    icon: <WarehouseIcon />,
    color: "#2563EB",
    bg: "#EFF6FF",
  },
  {
    label: "Pending Submissions",
    icon: <SendIcon />,
    color: "#7C3AED",
    bg: "#EDE9FE",
  },
];

export default async function DashboardPage() {
  const [userItemsResult, zonesResult, pendingResult, auditResult, chartResult] =
    await Promise.allSettled([
      listUserItems(),
      listZones(),
      listPendingSubmissions(),
      listAuditLogsFiltered({ limit: 5 }),
      getUserItemWeightsByMaterial(),
    ]);

  const userItems =
    userItemsResult.status === "fulfilled" && userItemsResult.value.data
      ? userItemsResult.value.data
      : [];
  const zones =
    zonesResult.status === "fulfilled" && zonesResult.value.data
      ? zonesResult.value.data
      : [];
  const pending =
    pendingResult.status === "fulfilled" && pendingResult.value.data
      ? pendingResult.value.data
      : [];
  const auditItems =
    auditResult.status === "fulfilled" && auditResult.value.data
      ? auditResult.value.data.items
      : [];

  const materialWeights =
    chartResult.status === "fulfilled" && chartResult.value.data
      ? chartResult.value.data
      : [];

  const activeUserItems = userItems.filter((s) => s.status === "active");

  const counts = [userItems.length, activeUserItems.length, zones.length, pending.length];

  const chartLabels = materialWeights.map((m) => m.material);
  const chartData = materialWeights.map((m) => Math.round(m.totalWeightG));

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Overview of your filament monitoring system."
      />

      {/* Stat Cards */}
      <Grid container spacing={2} sx={{ mb: 4 }}>
        {statCards.map((card, i) => (
          <Grid key={card.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card
              sx={{
                borderLeft: 4,
                borderLeftColor: card.color,
              }}
            >
              <CardContent sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    borderRadius: 2,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    bgcolor: card.bg,
                    color: card.color,
                  }}
                >
                  {card.icon}
                </Box>
                <Box>
                  <Typography variant="h4" fontWeight={700}>
                    {counts[i]}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {card.label}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Weight Chart */}
        <Grid size={{ xs: 12, md: 7 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Filament by Material (g)
              </Typography>
              {chartLabels.length > 0 ? (
                <BarChart
                  xAxis={[{ scaleType: "band", data: chartLabels }]}
                  series={[
                    {
                      data: chartData,
                      color: "#FF5C2E",
                    },
                  ]}
                  height={300}
                />
              ) : (
                <Box
                  sx={{
                    height: 300,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Typography color="text.secondary">
                    No data yet. Add spools to see weight breakdown.
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Recent Activity */}
        <Grid size={{ xs: 12, md: 5 }}>
          <Card>
            <CardContent>
              <Typography variant="h6" fontWeight={600} sx={{ mb: 2 }}>
                Recent Activity
              </Typography>
              <AuditFeed items={auditItems} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </div>
  );
}
