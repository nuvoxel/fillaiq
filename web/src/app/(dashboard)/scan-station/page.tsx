"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Trash2,
  ArrowRight,
  ScanLine,
  PackagePlus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { PageHeader } from "@/components/layout/page-header";
import { FillaIqTab } from "../hardware/filla-iq-tab";
import { AddItemSheet } from "@/components/intake/add-item-sheet";
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
  resolved: "Added",
  failed: "Failed",
};

/* -- Page -- */

export default function StationsPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  // AddItemSheet state
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addItemSessionId, setAddItemSessionId] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    const result = await listMyScanSessions({ limit: 30, includeRecent: true });
    if (result.data) setSessions(result.data);
    setLoading(false);
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleAbandon = useCallback(
    async (sessionId: string) => {
      await abandonSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    },
    []
  );

  const handleAddItem = useCallback((sessionId: string) => {
    setAddItemSessionId(sessionId);
    setAddItemOpen(true);
  }, []);

  const handleAddItemSaved = useCallback(() => {
    setAddItemOpen(false);
    setAddItemSessionId(null);
    loadSessions(); // Refresh to show updated status
  }, [loadSessions]);

  const handleAddItemClose = useCallback(() => {
    setAddItemOpen(false);
    setAddItemSessionId(null);
  }, []);

  const visibleSessions = showCompleted
    ? sessions
    : sessions.filter((s: any) => s.status !== "resolved");
  const resolvedCount = sessions.filter((s: any) => s.status === "resolved").length;

  return (
    <div>
      <PageHeader
        title="Stations"
        description="Manage scan stations and intake scanned items."
        action={
          <Button onClick={() => { setAddItemSessionId(null); setAddItemOpen(true); }}>
            <Plus className="size-4 mr-1" />
            Add Item
          </Button>
        }
      />

      {/* ── Recent Scans ── */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Recent Scans
          </h3>
          {!loading && resolvedCount > 0 && (
            <Badge
              variant={showCompleted ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setShowCompleted(!showCompleted)}
            >
              {showCompleted ? `Hide added (${resolvedCount})` : `Show added (${resolvedCount})`}
            </Badge>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-22 rounded-xl" />
            ))}
          </div>
        )}

        {/* Sessions List */}
        {!loading && visibleSessions.length > 0 && (
          <div className="flex flex-col gap-3">
            {visibleSessions.map((session: any) => (
              <SessionCard
                key={session.id}
                session={session}
                onAddItem={() => handleAddItem(session.id)}
                onDelete={session.status !== "resolved" ? () => handleAbandon(session.id) : undefined}
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
      </section>

      <Separator className="mb-8" />

      {/* ── Hardware ── */}
      <section>
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Hardware
        </h3>
        <FillaIqTab />
      </section>

      {/* ── Add Item Sheet ── */}
      <AddItemSheet
        open={addItemOpen}
        sessionId={addItemSessionId}
        onClose={handleAddItemClose}
        onSaved={handleAddItemSaved}
      />
    </div>
  );
}

/* -- Session Card -- */

function SessionCard({
  session,
  onAddItem,
  onDelete,
}: {
  session: any;
  onAddItem: () => void;
  onDelete?: () => void;
}) {
  const isIdentified = !!session.matchedProductId;
  const isResolved = session.status === "resolved";
  const parsed = session.nfcParsedData as Record<string, any> | null;

  const statusColor = STATUS_COLORS[session.status] ?? STATUS_COLORS.active;
  const statusLabel = STATUS_LABELS[session.status] ?? session.status;

  const displayName = isIdentified
    ? `${session.brandName ? session.brandName + " " : ""}${session.productName}`
    : parsed?.name
      ? `${parsed.material ? parsed.material + " – " : ""}${parsed.name}`
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
      className="relative p-4 rounded-xl ring-1 ring-foreground/10 bg-card shadow-sm transition-colors hover:bg-muted/50 hover:shadow-md"
      style={{
        opacity: isResolved ? 0.7 : 1,
        borderLeft: !isResolved ? "4px solid #00D2FF" : "4px solid transparent",
      }}
    >
      <div className="flex items-center justify-between">
        {/* Left: color swatch + info */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div
            className="w-14 h-14 rounded-full shrink-0 border-4 border-muted"
            style={{
              backgroundColor: session.bestColorHex ?? "#E0E0E0",
              boxShadow: "inset 0 2px 6px rgba(0,0,0,0.12)",
            }}
          />

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

        {/* Right: timestamp, status, actions */}
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
                title="Delete scan"
              >
                <Trash2 className="size-4" />
              </button>
            )}
            {!isResolved && (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={(e) => { e.stopPropagation(); onAddItem(); }}
              >
                <PackagePlus className="size-4 mr-1" />
                Add
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
