"use client";

import { useState, useEffect } from "react";
import { Plus, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { PageHeader } from "@/components/layout/page-header";
import { SubmissionDialog } from "@/components/submissions/submission-dialog";
import { listCatalogSubmissions } from "@/lib/actions/submissions";

type Submission = {
  id: string;
  type: string;
  status: string;
  targetTable: string | null;
  targetId: string | null;
  createdAt: Date;
  userId?: string;
  [key: string]: unknown;
};

const statusVariants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  pending: "outline",
  approved: "default",
  rejected: "destructive",
  duplicate: "secondary",
};

const typeVariants: Record<string, "default" | "secondary" | "outline"> = {
  new_product: "default",
  correction: "outline",
  alias: "secondary",
};

const filterOptions = [
  { value: null, label: "All" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "duplicate", label: "Duplicate" },
];

export default function SubmissionsPage() {
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [page, setPage] = useState(0);
  const pageSize = 10;

  const loadSubmissions = () => {
    setLoading(true);
    listCatalogSubmissions().then((result) => {
      if (result.data) setSubmissions(result.data as Submission[]);
      setLoading(false);
    });
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const filtered = statusFilter
    ? submissions.filter((s) => s.status === statusFilter)
    : submissions;

  const totalPages = Math.ceil(filtered.length / pageSize);
  const paged = filtered.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      <PageHeader
        title="Submissions"
        description="Review community catalog submissions."
        action={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="size-4 mr-1" />
            New Submission
          </Button>
        }
      />

      <div className="mb-2 flex gap-1 flex-wrap">
        {filterOptions.map((opt) => (
          <button
            key={opt.label}
            onClick={() => { setStatusFilter(opt.value); setPage(0); }}
            className={`px-3 py-1.5 text-sm font-semibold rounded-lg transition-colors ${
              statusFilter === opt.value
                ? "bg-foreground text-background"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[52px] rounded-lg" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-8">
          <Send className="size-12 text-muted-foreground/30 mx-auto mb-1" />
          <p className="text-base font-medium">No submissions found</p>
          <p className="text-sm text-muted-foreground">
            {statusFilter ? "Try a different filter." : "No catalog submissions yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="border rounded-xl">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Badge variant={typeVariants[s.type] ?? "secondary"}>
                        {s.type.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>{s.targetTable ?? "\u2014"}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariants[s.status] ?? "secondary"}>
                        {s.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {s.createdAt ? new Date(s.createdAt).toLocaleDateString() : "\u2014"}
                      </span>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-2">
              <p className="text-sm text-muted-foreground">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage(page - 1)}>
                  Previous
                </Button>
                <Button size="sm" variant="outline" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      <SubmissionDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSaved={loadSubmissions}
      />
    </div>
  );
}
