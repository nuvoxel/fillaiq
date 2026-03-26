import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SpoolActions } from "@/components/spools/spool-actions";
import { ProgressRing } from "@/components/spools/progress-ring";
import { WeightChart } from "@/components/spools/weight-chart";
import { UserItemEventsTabs } from "@/components/spools/spool-events-tabs";
import { getUserItemWithRelations } from "@/lib/actions/user-library";
import {
  listWeightEventsByUserItemId,
  listUsageSessionsByUserItemId,
  listDryingSessionsByUserItemId,
  listItemMovementsByUserItemId,
} from "@/lib/actions/events";
import { getSlotPath } from "@/lib/services/storage-path";

/* -- Helpers -- */

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="mb-1">
      <p className="text-[0.625rem] uppercase tracking-widest font-bold text-muted-foreground mb-1">
        {label}
      </p>
      <p
        className={`text-sm ${
          mono
            ? "font-mono font-medium text-primary"
            : "font-semibold text-foreground"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function StatTile({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={`px-4 py-3 rounded-lg ${
        highlight
          ? "bg-[#F4F6F8]"
          : "bg-background border border-border"
      }`}
    >
      <p className="text-[0.5625rem] uppercase tracking-wider font-bold text-muted-foreground">
        {label}
      </p>
      <p
        className={`font-bold ${
          highlight
            ? "font-display text-primary text-base"
            : "text-foreground text-sm"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

/* -- Page -- */

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

  // Resolve slot path for human-readable location display
  const slotPath = userItem.currentSlotId
    ? await getSlotPath(userItem.currentSlotId)
    : null;

  // Compute remaining percentage: use stored value, or derive from weight vs product net weight
  const netWeight = (userItem.product as any)?.netWeightG as number | undefined;
  const spoolWeight = (userItem as any).spoolWeightG as number | undefined;
  const currentWeight = userItem.currentWeightG as number | undefined;
  let pct = userItem.percentRemaining ?? 0;
  if (pct === 0 && netWeight && netWeight > 0 && currentWeight && currentWeight > 0) {
    const filamentWeight = spoolWeight ? currentWeight - spoolWeight : currentWeight;
    pct = Math.max(0, Math.min(100, Math.round((filamentWeight / netWeight) * 100)));
  }
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
  const productName = product?.name ?? "Unknown Spool";

  const statusVariant =
    userItem.status === "active"
      ? "bg-green-500/10 text-green-600"
      : userItem.status === "empty"
        ? "bg-[#FF2A5F]/10 text-[#FF2A5F]"
        : "bg-slate-400/15 text-slate-400";

  return (
    <div className="flex flex-col gap-6">
      {/* -- Breadcrumb header -- */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" render={<Link href="/spools" />}>
            <ArrowLeft className="size-4" />
            Spools
          </Button>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-bold text-primary">
            {productName} {product?.colorName ? `\u2014 ${product.colorName}` : ""}
          </span>
        </div>
        <SpoolActions
          spool={userItem as any}
          product={product ?? null}
          brandName={brandName}
          materialName={materialName}
        />
      </div>

      {/* -- Hero: Info + Stats -- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Spool Info Card */}
        <div className="lg:col-span-8">
          <Card className="relative overflow-hidden p-0">
            {/* Left accent bar */}
            <div className="absolute left-0 top-0 w-1.5 h-full bg-primary rounded-l-xl" />
            <CardContent className="p-8 pl-10">
              {/* Header row */}
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h2 className="font-display font-bold text-xl mb-1">
                    {productName}
                  </h2>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="secondary"
                      className={`${statusVariant} text-[0.625rem] uppercase tracking-wider font-bold h-[22px]`}
                    >
                      {userItem.status}
                    </Badge>
                    {(userItem as any).sku && (
                      <span className="text-xs text-muted-foreground font-medium">
                        SKU: {(userItem as any).sku}
                      </span>
                    )}
                  </div>
                </div>
                {/* Color swatch */}
                {product?.colorHex && (
                  <div className="flex items-center gap-3 bg-[#F4F6F8] px-4 py-2 rounded-lg">
                    <div
                      className="w-6 h-6 rounded-full shadow-sm"
                      style={{ backgroundColor: product.colorHex }}
                    />
                    <span className="font-semibold text-sm">
                      {product.colorName ?? "\u2014"}
                    </span>
                  </div>
                )}
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-6">
                <InfoField label="NFC UID" value={userItem.nfcUid ?? "\u2014"} mono />
                <InfoField label="NFC Format" value={userItem.nfcTagFormat ?? "\u2014"} />
                <InfoField
                  label="Purchase Date"
                  value={userItem.purchasedAt ? new Date(userItem.purchasedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "\u2014"}
                />
                <InfoField
                  label="Opened Date"
                  value={userItem.openedAt ? new Date(userItem.openedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "\u2014"}
                />
                <InfoField label="Lot Number" value={userItem.lotNumber ?? "\u2014"} mono />
                <InfoField
                  label="Cost"
                  value={
                    userItem.purchasePrice != null
                      ? `$${userItem.purchasePrice.toFixed(2)}`
                      : "\u2014"
                  }
                />
              </div>

              {/* Notes */}
              {userItem.notes && (
                <div className="mt-8 pt-6 border-t border-border">
                  <p className="text-[0.625rem] uppercase tracking-widest font-bold text-muted-foreground mb-2">
                    Notes
                  </p>
                  <p className="text-sm text-muted-foreground italic">
                    &ldquo;{userItem.notes}&rdquo;
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right: Quick Stats */}
        <div className="lg:col-span-4">
          <Card className="h-full flex flex-col items-center text-center">
            <CardContent className="p-8 w-full flex flex-col items-center gap-4">
              {/* Progress ring */}
              <ProgressRing value={pct} />

              {/* Current Weight -- highlight tile */}
              <div className="w-full">
                <StatTile
                  label="Current Weight"
                  value={userItem.currentWeightG != null ? `${Math.round(userItem.currentWeightG)}g` : "\u2014"}
                  highlight
                />
              </div>

              {/* Net / Tare row */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <StatTile
                  label="Net Filament"
                  value={userItem.netFilamentWeightG != null ? `${Math.round(userItem.netFilamentWeightG)}g` : "\u2014"}
                />
                <StatTile
                  label="Spool Tare"
                  value={userItem.spoolWeightG != null ? `${Math.round(userItem.spoolWeightG)}g` : "\u2014"}
                />
              </div>

              {/* Location badge */}
              <div className="flex items-center gap-3 w-full p-4 bg-[#F4F6F8] rounded-xl text-left">
                <div className="bg-primary rounded-lg p-2 flex text-white">
                  <MapPin className="size-4" />
                </div>
                <div>
                  <p className="text-[0.625rem] uppercase tracking-widest font-bold text-muted-foreground">
                    Location
                  </p>
                  <p className="text-sm font-bold">
                    {userItem.storageLocation ??
                      slotPath ??
                      (userItem.currentSlotId
                        ? "Assigned"
                        : "Not assigned")}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* -- Weight Chart -- */}
      <WeightChart events={weightEvents as any} />

      {/* -- Event Tabs -- */}
      <UserItemEventsTabs
        usageSessions={usageSessions as any}
        dryingSessions={dryingSessions as any}
        movements={movements as any}
      />
    </div>
  );
}
