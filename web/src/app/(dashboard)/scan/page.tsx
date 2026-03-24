"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, ArrowRight, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/layout/page-header";
import {
  listMyScanSessions,
  abandonSession,
} from "@/lib/actions/scan";

/* -- Design tokens -- */
const FONT_DISPLAY = "var(--font-display), 'Space Grotesk', sans-serif";
const FONT_MONO = "var(--font-mono), 'DM Mono', monospace";

const STATUS_COLORS: Record<string, string> = {
  active: "#FF7A00",
  matched: "#00D2FF",
  resolved: "#00E676",
  failed: "#FF2A5F",
};

const STATUS_LABELS: Record<string, string> = {
  active: "Pending",
  matched: "Matched",
  resolved: "Completed",
  failed: "Failed",
};

/* -- Page -- */

export default function ScanPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await listMyScanSessions({ limit: 20, includeRecent: true });
      if (mounted && result.data) {
        setSessions(result.data);
      }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const handleAbandon = useCallback(
    async (sessionId: string) => {
      await abandonSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    },
    []
  );

  const visibleSessions = showCompleted
    ? sessions
    : sessions.filter((s: any) => s.status !== "resolved");
  const resolvedCount = sessions.filter((s: any) => s.status === "resolved").length;

  return (
    <div>
      <PageHeader
        title="Scan & Intake"
        description="Add spools to your inventory"
        action={
          <Button onClick={() => router.push("/scan/new")}>
            <Plus className="size-4 mr-1" />
            Start Manual Scan
          </Button>
        }
      />

      {/* Loading */}
      {loading && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-22 rounded-xl" />
          ))}
        </div>
      )}

      {/* Filter toggle */}
      {!loading && resolvedCount > 0 && (
        <div className="mb-2">
          <Badge
            variant={showCompleted ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setShowCompleted(!showCompleted)}
          >
            {showCompleted ? `Hide completed (${resolvedCount})` : `Show completed (${resolvedCount})`}
          </Badge>
        </div>
      )}

      {/* Sessions List */}
      {!loading && visibleSessions.length > 0 && (
        <div className="flex flex-col gap-3">
          {visibleSessions.map((session: any) => (
            <SessionCard
              key={session.id}
              session={session}
              onClick={() => router.push(`/scan/${session.id}`)}
              onDelete={session.status === "active" ? () => handleAbandon(session.id) : undefined}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && visibleSessions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 opacity-60">
          <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-2">
            <ScanLine className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-muted-foreground max-w-[280px] text-center">
            Place a spool on any scan station to begin automatic identification
          </p>
          {/* Animated dots */}
          <div className="flex gap-1 mt-3">
            {[1, 0.4, 0.4].map((op, i) => (
              <div
                key={i}
                className="w-2 h-2 rounded-full"
                style={{
                  backgroundColor: "#00D2FF",
                  opacity: op,
                  ...(i === 0 ? { animation: "pulse 1.5s ease-in-out infinite" } : {}),
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* -- Session Card -- */

function SessionCard({
  session,
  onClick,
  onDelete,
}: {
  session: any;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const isIdentified = !!session.matchedProductId;
  const isResolved = session.status === "resolved";
  const isPending = session.status === "active";
  const parsed = session.nfcParsedData as Record<string, any> | null;

  const statusColor = STATUS_COLORS[session.status] ?? STATUS_COLORS.active;
  const statusLabel = STATUS_LABELS[session.status] ?? session.status;

  const displayName = isIdentified
    ? `${session.brandName ? session.brandName + " " : ""}${session.productName}`
    : parsed?.name
      ? `${parsed.material ? parsed.material + " -- " : ""}${parsed.name}`
      : parsed?.material
        ? parsed.material
        : "Unidentified item";

  const nfcBadge = session.nfcTagFormat
    ? session.nfcTagFormat.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())
    : session.nfcUid
      ? "NFC"
      : null;

  return (
    <div
      onClick={onClick}
      className="relative p-4 rounded-xl cursor-pointer ring-1 ring-foreground/10 bg-card shadow-sm transition-colors hover:bg-muted/50 hover:shadow-md"
      style={{
        opacity: isResolved ? 0.7 : 1,
        borderLeft: isPending ? "4px solid #00D2FF" : "4px solid transparent",
      }}
    >
      <div className="flex items-center justify-between">
        {/* Left: color swatch + info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Large circular color swatch */}
          <div
            className="w-14 h-14 rounded-full shrink-0 border-4 border-muted"
            style={{
              backgroundColor: session.bestColorHex ?? "#E0E0E0",
              boxShadow: "inset 0 2px 6px rgba(0,0,0,0.12)",
            }}
          />

          {/* Center info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="font-bold text-[1.05rem] truncate"
                style={{ fontFamily: FONT_DISPLAY, letterSpacing: "-0.01em" }}
              >
                {displayName}
              </span>
              {nfcBadge && (
                <Badge variant="secondary" className="text-[0.6rem] font-bold uppercase tracking-wider h-5">
                  {nfcBadge}
                </Badge>
              )}
            </div>

            <div className="flex items-center gap-3 mt-1 flex-wrap">
              {session.bestWeightG != null && (
                <span
                  className="font-semibold text-[0.85rem] text-primary"
                  style={{ fontFamily: FONT_MONO }}
                >
                  {session.bestWeightG.toFixed(1)}g
                </span>
              )}
              {session.bestHeightMm != null && (
                <span className="text-sm font-medium text-muted-foreground">
                  {session.bestHeightMm.toFixed(0)}mm
                </span>
              )}
              {parsed?.nozzleTempMin && (
                <span className="text-sm font-medium text-muted-foreground">
                  {parsed.nozzleTempMin}&ndash;{parsed.nozzleTempMax}&deg;C
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Right: timestamp, status, action */}
        <div className="flex items-center gap-3 shrink-0 ml-2">
          <div className="text-right">
            <span className="text-[0.7rem] font-medium text-muted-foreground block">
              {new Date(session.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
            <div className="flex items-center justify-end gap-1.5 mt-0.5">
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: statusColor }}
              />
              <span
                className="text-[0.6rem] font-bold uppercase tracking-wider"
                style={{ color: statusColor }}
              >
                {statusLabel}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {onDelete && (
              <button
                className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="size-4" />
              </button>
            )}
            <button
              className="p-1.5 rounded-md bg-muted text-primary hover:bg-muted/80 transition-colors"
              onClick={(e) => { e.stopPropagation(); onClick(); }}
            >
              <ArrowRight className="size-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
