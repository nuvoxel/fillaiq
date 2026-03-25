"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  Printer,
  Search,
  BarChart3,
  AlertTriangle,
  Shapes,
  Circle,
  ChevronLeft,
  ChevronRight,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { PageHeader } from "@/components/layout/page-header";
import { AddItemSheet } from "@/components/intake/add-item-sheet";
import {
  PrintLabelDialog,
  type PrintLabelItem,
} from "@/components/labels/print-label-dialog";
import { listMyItems, type MyItem } from "@/lib/actions/user-library";

/* -- Design tokens -- */
const MAKER_CYAN = "#00D2FF";
const LIVE_GREEN = "#00E676";
const ALERT_ROSE = "#FF2A5F";

/* -- Status tab definitions -- */
type StatusTab = { label: string; value: string | null };
const STATUS_TABS: StatusTab[] = [
  { label: "All Items", value: null },
  { label: "Active", value: "active" },
  { label: "Empty", value: "empty" },
  { label: "Archived", value: "archived" },
];

const PAGE_SIZE = 10;

/* -- Helpers -- */
function formatRelativeTime(date: Date | string | null | undefined): string {
  if (!date) return "\u2014";
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

function statusDotColor(status: string): string {
  if (status === "active") return LIVE_GREEN;
  if (status === "empty") return ALERT_ROSE;
  return "#B0BEC5";
}

function progressBarColor(pct: number): string {
  if (pct > 50) return MAKER_CYAN;
  if (pct > 20) return "#FFB229";
  return ALERT_ROSE;
}

/* ================================================================ */

export default function SpoolsPage() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<string>("updatedAt");
  const [userItems, setMyItems] = useState<MyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MyItem | null>(null);
  const [printItem, setPrintItem] = useState<PrintLabelItem | null>(null);

  const loadItems = useCallback(() => {
    setLoading(true);
    listMyItems().then((result) => {
      if (result.data) setMyItems(result.data as MyItem[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  const handleOpenCreate = () => {
    setEditingItem(null);
    setDialogOpen(true);
  };

  const handleOpenEdit = (item: MyItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDialogClose = () => {
    setDialogOpen(false);
    setEditingItem(null);
  };

  const handleSaved = () => {
    loadItems();
  };

  /* -- Filtering, search, sort -- */
  const processed = useMemo(() => {
    let list = userItems;

    // status filter
    if (statusFilter) {
      list = list.filter((s) => s.status === statusFilter);
    }

    // search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          (s.brandName ?? "").toLowerCase().includes(q) ||
          (s.productName ?? "").toLowerCase().includes(q) ||
          (s.materialName ?? "").toLowerCase().includes(q) ||
          (s.colorName ?? "").toLowerCase().includes(q)
      );
    }

    // sort
    list = [...list].sort((a, b) => {
      if (sortBy === "updatedAt") {
        return (
          new Date(b.updatedAt ?? 0).getTime() -
          new Date(a.updatedAt ?? 0).getTime()
        );
      }
      if (sortBy === "weight") {
        return (b.currentWeightG ?? 0) - (a.currentWeightG ?? 0);
      }
      if (sortBy === "material") {
        return (a.materialName ?? "").localeCompare(b.materialName ?? "");
      }
      return 0;
    });

    return list;
  }, [userItems, statusFilter, searchQuery, sortBy]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [statusFilter, searchQuery, sortBy]);

  const totalPages = Math.max(1, Math.ceil(processed.length / PAGE_SIZE));
  const paginated = processed.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  /* -- Summary stats -- */
  const totalStockKg = useMemo(() => {
    const g = userItems.reduce((sum, s) => sum + (s.currentWeightG ?? 0), 0);
    return (g / 1000).toFixed(1);
  }, [userItems]);

  const lowInventoryCount = useMemo(
    () =>
      userItems.filter(
        (s) =>
          s.status === "active" &&
          s.percentRemaining != null &&
          s.percentRemaining <= 20
      ).length,
    [userItems]
  );

  const mostUsedMaterial = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of userItems) {
      const m = s.materialName ?? "Unknown";
      counts[m] = (counts[m] ?? 0) + 1;
    }
    let best = "\u2014";
    let max = 0;
    for (const [k, v] of Object.entries(counts)) {
      if (v > max) {
        best = k;
        max = v;
      }
    }
    return best;
  }, [userItems]);

  /* ================================================================ */

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="All your tracked items — spools, boxes, tools, and more."
        action={
          <Button
            onClick={handleOpenCreate}
            className="bg-[#00677F] hover:bg-[#005266]"
          >
            <Plus className="size-4" />
            Add Item
          </Button>
        }
      />

      {/* -- Filter tabs + toolbar -- */}
      <div className="flex flex-wrap items-center justify-between mb-8 gap-4">
        {/* Pill-style tabs */}
        <div className="flex p-1 bg-[#F4F6F8] rounded-xl w-fit">
          {STATUS_TABS.map((tab) => {
            const active = statusFilter === tab.value;
            return (
              <button
                key={tab.label}
                onClick={() => setStatusFilter(tab.value)}
                className={`px-6 py-2 rounded-lg text-[0.8125rem] font-medium transition-all ${
                  active
                    ? "bg-white text-[#00677F] font-bold shadow-sm"
                    : "text-muted-foreground hover:bg-black/[0.04]"
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Right side: search + sort + export */}
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
            <input
              type="text"
              placeholder="Search inventory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-60 h-9 pl-9 pr-3 rounded-xl bg-[#F4F6F8] border-none text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[0.625rem] uppercase tracking-widest font-bold text-muted-foreground">
              Sort by:
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="text-[0.8125rem] font-semibold text-[#00677F] bg-transparent border-none focus:outline-none cursor-pointer"
            >
              <option value="updatedAt">Last Updated</option>
              <option value="weight">Weight (High to Low)</option>
              <option value="material">Material Type</option>
            </select>
          </div>

          <Button variant="outline" size="sm">
            <Download className="size-3.5" />
            Export
          </Button>
        </div>
      </div>

      {/* -- Table -- */}
      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[52px] rounded-lg" />
          ))}
        </div>
      ) : processed.length === 0 ? (
        <div className="text-center py-16">
          <Circle className="size-12 text-muted-foreground/30 mx-auto mb-2" />
          <p className="font-medium">No spools found</p>
          <p className="text-sm text-muted-foreground">
            {statusFilter
              ? "Try a different filter."
              : "Add your first spool to get started."}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border shadow-sm overflow-hidden bg-white">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#F4F6F8]">
                <TableHead className="text-[0.625rem] uppercase tracking-widest font-bold px-6 py-4">Color</TableHead>
                <TableHead className="text-[0.625rem] uppercase tracking-widest font-bold px-6 py-4">Brand &amp; Product</TableHead>
                <TableHead className="text-[0.625rem] uppercase tracking-widest font-bold px-6 py-4">Material</TableHead>
                <TableHead className="text-[0.625rem] uppercase tracking-widest font-bold px-6 py-4">Status</TableHead>
                <TableHead className="text-[0.625rem] uppercase tracking-widest font-bold px-6 py-4">Remaining</TableHead>
                <TableHead className="text-[0.625rem] uppercase tracking-widest font-bold px-6 py-4">Weight Data</TableHead>
                <TableHead className="text-[0.625rem] uppercase tracking-widest font-bold px-6 py-4">Updated</TableHead>
                <TableHead className="text-[0.625rem] uppercase tracking-widest font-bold px-6 py-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TooltipProvider>
                {paginated.map((item) => {
                  const hex =
                    item.colorHex ?? (item as any).measuredColorHex ?? null;
                  const pct = item.percentRemaining ?? 0;
                  const currentG = item.currentWeightG
                    ? Math.round(item.currentWeightG)
                    : null;

                  return (
                    <TableRow
                      key={item.id}
                      onClick={() => router.push(`/spools/${item.id}`)}
                      className="cursor-pointer hover:bg-[#00D2FF]/[0.03] [&_td]:py-4 [&_td]:px-6 [&_td]:border-b [&_td]:border-gray-50"
                    >
                      {/* Color swatch */}
                      <TableCell>
                        {hex ? (
                          <div
                            className="w-6 h-6 rounded shadow-inner"
                            style={{
                              backgroundColor: hex,
                              border:
                                hex.toUpperCase() === "#FFFFFF" ||
                                hex.toUpperCase() === "#F4F4F4" ||
                                hex.toUpperCase() === "#FFF"
                                  ? "1px solid var(--border)"
                                  : "none",
                            }}
                          />
                        ) : (
                          <Circle className="size-6 text-muted-foreground/30" />
                        )}
                      </TableCell>

                      {/* Brand & Product */}
                      <TableCell>
                        <div>
                          <p className="text-sm font-bold text-foreground leading-tight">
                            {item.brandName ?? "\u2014"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {item.productName ?? "\u2014"}
                          </p>
                        </div>
                      </TableCell>

                      {/* Material chip */}
                      <TableCell>
                        {item.materialName ? (
                          <Badge
                            variant="secondary"
                            className="bg-[#F4F6F8] text-[#00677F] text-[0.625rem] uppercase font-bold h-6 rounded px-2"
                          >
                            {item.materialName}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground/50">
                            \u2014
                          </span>
                        )}
                      </TableCell>

                      {/* Status */}
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: statusDotColor(item.status) }}
                          />
                          <span
                            className={`text-xs font-medium capitalize ${
                              item.status === "active"
                                ? "text-foreground"
                                : "text-muted-foreground"
                            }`}
                          >
                            {item.status}
                          </span>
                        </div>
                      </TableCell>

                      {/* Remaining progress bar */}
                      <TableCell className="w-[180px]">
                        <div className="flex flex-col gap-1">
                          <div className="flex justify-between">
                            <span className="text-[0.625rem] font-mono text-muted-foreground">
                              {pct}%
                            </span>
                            <span className="text-[0.625rem] font-mono text-muted-foreground">
                              {currentG != null ? `${currentG}g` : "\u2014"}
                            </span>
                          </div>
                          <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${pct}%`,
                                backgroundColor: progressBarColor(pct),
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>

                      {/* Weight data */}
                      <TableCell>
                        <span className="text-xs font-mono text-muted-foreground">
                          {item.netFilamentWeightG
                            ? `${Math.round(item.netFilamentWeightG)}g Net`
                            : "\u2014"}
                        </span>
                      </TableCell>

                      {/* Updated */}
                      <TableCell>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(item.updatedAt)}
                        </span>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  className="p-1.5 rounded-md text-muted-foreground/50 hover:text-[#00677F] hover:bg-muted transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPrintItem({
                                      brand: item.brandName ?? undefined,
                                      material:
                                        item.materialName ??
                                        item.productName ??
                                        undefined,
                                      color:
                                        item.colorHex ??
                                        (item as any).measuredColorHex ??
                                        undefined,
                                      weight: item.currentWeightG
                                        ? `${Math.round(item.currentWeightG)}g`
                                        : undefined,
                                    });
                                  }}
                                />
                              }
                            >
                              <Printer className="size-4" />
                            </TooltipTrigger>
                            <TooltipContent>Print label</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <button
                                  className="p-1.5 rounded-md text-muted-foreground/50 hover:text-[#00677F] hover:bg-muted transition-colors"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEdit(item);
                                  }}
                                />
                              }
                            >
                              <Pencil className="size-4" />
                            </TooltipTrigger>
                            <TooltipContent>Edit</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TooltipProvider>
            </TableBody>
          </Table>

          {/* -- Pagination footer -- */}
          <div className="px-6 py-4 flex items-center justify-between border-t border-border bg-[#F4F6F8]/25">
            <span className="text-xs font-medium text-muted-foreground">
              Showing {page * PAGE_SIZE + 1}-
              {Math.min((page + 1) * PAGE_SIZE, processed.length)} of{" "}
              {processed.length} spools
            </span>
            <div className="flex gap-1">
              <button
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
                className="w-8 h-8 flex items-center justify-center border border-border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="size-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 5) }).map((_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i;
                } else if (page < 3) {
                  pageNum = i;
                } else if (page > totalPages - 4) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                const isActive = pageNum === page;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? "bg-[#00D2FF] text-[#0F1F23] font-bold shadow-sm"
                        : "border border-border text-muted-foreground hover:bg-white"
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
              <button
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
                className="w-8 h-8 flex items-center justify-center border border-border rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* -- Summary insight cards -- */}
      {!loading && userItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
          {/* Total Stock */}
          <div className="p-6 rounded-xl bg-[rgba(0,103,127,0.04)] border border-[rgba(0,103,127,0.10)] flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#00D2FF]/10 flex items-center justify-center text-[#00677F]">
              <BarChart3 className="size-5" />
            </div>
            <div>
              <p className="text-[0.625rem] uppercase tracking-widest font-bold text-muted-foreground">
                Total Stock
              </p>
              <p className="font-display font-bold text-2xl text-[#00677F]">
                {totalStockKg}{" "}
                <span className="text-sm font-normal text-muted-foreground">kg</span>
              </p>
            </div>
          </div>

          {/* Low Inventory */}
          <div className="p-6 rounded-xl bg-[#FF2A5F]/[0.03] border border-[#FF2A5F]/10 flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[#FF2A5F]/[0.08] flex items-center justify-center text-[#FF2A5F]">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <p className="text-[0.625rem] uppercase tracking-widest font-bold text-muted-foreground">
                Low Inventory
              </p>
              <p className="font-display font-bold text-2xl text-[#FF2A5F]">
                {lowInventoryCount}{" "}
                <span className="text-sm font-normal text-muted-foreground">spools</span>
              </p>
            </div>
          </div>

          {/* Most Used */}
          <div className="p-6 rounded-xl bg-[rgba(15,31,35,0.03)] border border-border flex items-center gap-4">
            <div className="w-12 h-12 rounded-lg bg-[rgba(15,31,35,0.08)] flex items-center justify-center text-foreground">
              <Shapes className="size-5" />
            </div>
            <div>
              <p className="text-[0.625rem] uppercase tracking-widest font-bold text-muted-foreground">
                Most Used
              </p>
              <p className="font-display font-bold text-2xl text-foreground">
                {mostUsedMaterial}
              </p>
            </div>
          </div>
        </div>
      )}

      <AddItemSheet
        open={dialogOpen && !editingItem}
        onClose={handleDialogClose}
        onSaved={handleSaved}
      />

      <PrintLabelDialog
        open={!!printItem}
        onClose={() => setPrintItem(null)}
        items={printItem ? [printItem] : []}
      />
    </div>
  );
}
