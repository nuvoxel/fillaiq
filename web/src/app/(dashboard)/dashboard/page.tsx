import Link from "next/link";
import { Circle, CheckCircle, Warehouse, Send } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
    href: "/spools",
    icon: <Circle className="size-5" />,
    color: "text-primary",
    bgColor: "bg-primary/5",
    hoverBg: "group-hover:bg-primary group-hover:text-white",
  },
  {
    label: "Active Spools",
    href: "/spools",
    icon: <CheckCircle className="size-5" />,
    color: "text-primary",
    bgColor: "bg-primary/5",
    hoverBg: "group-hover:bg-primary group-hover:text-white",
  },
  {
    label: "Locations",
    href: "/locations",
    icon: <Warehouse className="size-5" />,
    color: "text-primary",
    bgColor: "bg-primary/5",
    hoverBg: "group-hover:bg-primary group-hover:text-white",
  },
  {
    label: "Pending Submissions",
    href: "/submissions",
    icon: <Send className="size-5" />,
    color: "text-[#FF2A5F]",
    bgColor: "bg-[#FF2A5F]/5",
    hoverBg: "group-hover:bg-[#FF2A5F] group-hover:text-white",
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

  const maxWeight =
    materialWeights.length > 0
      ? Math.max(...materialWeights.map((m) => m.totalWeightG))
      : 1;

  return (
    <div>
      <PageHeader
        title="Factory Overview"
        description="Real-time inventory telemetry for your additive manufacturing hub."
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {statCards.map((card, i) => (
          <Link key={card.label} href={card.href} className="no-underline group">
            <Card className="p-6 cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              <CardContent className="p-0">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[0.625rem] uppercase tracking-widest font-bold text-muted-foreground mb-1">
                      {card.label}
                    </p>
                    <p className="font-display text-4xl font-extrabold leading-tight text-foreground">
                      {counts[i]}
                    </p>
                  </div>
                  <div
                    className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${card.color} ${card.bgColor} ${card.hoverBg}`}
                  >
                    {card.icon}
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Filament by Material -- Horizontal Bar Chart */}
        <div className="md:col-span-7">
          <Card className="p-8">
            <CardContent className="p-0">
              <div className="flex justify-between items-center mb-8">
                <h3 className="font-display font-bold text-xl flex items-center gap-2">
                  <span className="w-1 h-5 bg-primary rounded-full shrink-0" />
                  Filament by Material
                </h3>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-3 py-1 rounded-full">
                  Weight in Grams (g)
                </span>
              </div>

              {materialWeights.length > 0 ? (
                <div className="flex flex-col gap-6">
                  {materialWeights.map((m) => {
                    const weight = Math.round(m.totalWeightG);
                    const pct = Math.round((weight / maxWeight) * 100);
                    return (
                      <div key={m.material}>
                        <div className="flex justify-between mb-1.5">
                          <span className="text-xs font-semibold text-foreground">
                            {m.material}
                          </span>
                          <span className="text-xs font-mono font-semibold text-foreground">
                            {weight.toLocaleString()}g
                          </span>
                        </div>
                        <div className="h-3 rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center">
                  <p className="text-muted-foreground">
                    No data yet. Add spools to see weight breakdown.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Activity */}
        <div className="md:col-span-5">
          <Card className="p-8 flex flex-col">
            <CardContent className="p-0 flex flex-col flex-1">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-display font-bold text-xl flex items-center gap-2">
                  <span className="w-1 h-5 bg-[#00677F] rounded-full shrink-0" />
                  Recent Activity
                </h3>
                <Link
                  href="/dashboard?tab=audit"
                  className="text-xs font-semibold text-[#00677F] hover:underline no-underline"
                >
                  View All
                </Link>
              </div>

              <div className="flex-1">
                <AuditFeed items={auditItems} />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
