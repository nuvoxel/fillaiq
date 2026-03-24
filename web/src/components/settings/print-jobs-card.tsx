"use client";

import { useState, useEffect, useCallback } from "react";
import { Ban, Trash2, Printer, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { listMyPrintJobs, cancelPrintJob, deletePrintJob } from "@/lib/actions/user-library";

type PrintJob = {
  id: string;
  status: string;
  stationId: string | null;
  labelData: Record<string, any>;
  copies: number;
  errorMessage: string | null;
  printedAt: Date | null;
  createdAt: Date;
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  sent: "secondary",
  printing: "default",
  done: "default",
  failed: "destructive",
  cancelled: "outline",
};

function formatDate(date: Date | string) {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelSummary(data: Record<string, any>): string {
  const parts: string[] = [];
  if (data.brand) parts.push(data.brand);
  if (data.material) parts.push(data.material);
  if (data.colorName || data.color) parts.push(data.colorName ?? data.color);
  return parts.length > 0 ? parts.join(" / ") : "Label";
}

export function PrintJobsCard() {
  const [jobs, setJobs] = useState<PrintJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    listMyPrintJobs({ limit: 50 }).then((result) => {
      if (result.data) setJobs(result.data as PrintJob[]);
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleCancel = async (id: string) => {
    setBusy(id);
    const result = await cancelPrintJob(id);
    setBusy(null);
    if (!result.error) {
      loadData();
    }
  };

  const handleDelete = async (id: string) => {
    setBusy(id);
    const result = await deletePrintJob(id);
    setBusy(null);
    if (!result.error) {
      loadData();
    }
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="font-semibold">Print Jobs</CardTitle>
        <CardAction>
          <Button variant="ghost" size="icon-sm" onClick={loadData} title="Refresh">
            <RefreshCw className="size-4" />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full rounded" />
            ))}
          </div>
        ) : jobs.length === 0 ? (
          <div className="text-center py-8">
            <Printer className="mx-auto size-12 text-muted-foreground/50 mb-2" />
            <p className="text-sm font-medium">No print jobs</p>
            <p className="text-sm text-muted-foreground">
              Print jobs will appear here when you print labels from the Spools page.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Copies</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Printed</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <Badge variant={statusVariants[job.status] ?? "outline"} className="capitalize">
                      {job.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {labelSummary(job.labelData as Record<string, any>)}
                    </span>
                    {job.errorMessage && (
                      <span className="block text-xs text-destructive">
                        {job.errorMessage}
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{job.copies}</TableCell>
                  <TableCell>
                    <span className="text-sm">{formatDate(job.createdAt)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {job.printedAt ? formatDate(job.printedAt) : "\u2014"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-0.5">
                      {job.status === "pending" && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          title="Cancel"
                          disabled={busy === job.id}
                          onClick={() => handleCancel(job.id)}
                        >
                          <Ban className="size-4 text-amber-500" />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        title="Delete"
                        disabled={busy === job.id}
                        onClick={() => handleDelete(job.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
