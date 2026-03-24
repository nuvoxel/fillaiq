"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";

type UsageSession = {
  id: string;
  filamentUsedG: number | null;
  weightBeforeG: number | null;
  weightAfterG: number | null;
  printJobId: string | null;
  removedAt: string | Date | null;
  returnedAt: string | Date | null;
  createdAt: string | Date;
};

type DryingSession = {
  id: string;
  temperatureC: number | null;
  durationMinutes: number | null;
  weightBeforeG: number | null;
  weightAfterG: number | null;
  moistureLostG: number | null;
  startedAt: string | Date | null;
  completedAt: string | Date | null;
  createdAt: string | Date;
};

type UserItemMovement = {
  id: string;
  weightAtMoveG: number | null;
  createdAt: string | Date;
  fromSlotId: string | null;
  toSlotId: string | null;
};

const fmtDate = (v: string | Date | null) =>
  v ? new Date(v).toLocaleString() : "\u2014";

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-8">
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function PaginatedTable<T extends { id: string }>({
  data,
  pageSize,
  renderHeader,
  renderRow,
}: {
  data: T[];
  pageSize: number;
  renderHeader: () => React.ReactNode;
  renderRow: (item: T) => React.ReactNode;
}) {
  const [page, setPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const paginated = data.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow>{renderHeader()}</TableRow>
        </TableHeader>
        <TableBody>
          {paginated.map((item) => (
            <TableRow key={item.id}>{renderRow(item)}</TableRow>
          ))}
        </TableBody>
      </Table>
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-2 border-t text-xs text-muted-foreground">
          <span>
            {page * pageSize + 1}-{Math.min((page + 1) * pageSize, data.length)} of {data.length}
          </span>
          <div className="flex gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="px-2 py-1 rounded border border-border disabled:opacity-50 hover:bg-muted"
            >
              Prev
            </button>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="px-2 py-1 rounded border border-border disabled:opacity-50 hover:bg-muted"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function UserItemEventsTabs({
  usageSessions,
  dryingSessions,
  movements,
}: {
  usageSessions: UsageSession[];
  dryingSessions: DryingSession[];
  movements: UserItemMovement[];
}) {
  return (
    <Card>
      <Tabs defaultValue="usage">
        <div className="px-4 pt-2">
          <TabsList>
            <TabsTrigger value="usage">
              Usage Sessions
              <Badge variant="outline" className="ml-1">{usageSessions.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="drying">
              Drying
              <Badge variant="outline" className="ml-1">{dryingSessions.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="movements">
              Movements
              <Badge variant="outline" className="ml-1">{movements.length}</Badge>
            </TabsTrigger>
          </TabsList>
        </div>
        <CardContent>
          <TabsContent value="usage">
            {usageSessions.length === 0 ? (
              <EmptyState text="No usage sessions recorded." />
            ) : (
              <PaginatedTable
                data={usageSessions}
                pageSize={5}
                renderHeader={() => (
                  <>
                    <TableHead>Print Job</TableHead>
                    <TableHead>Used (g)</TableHead>
                    <TableHead>Before (g)</TableHead>
                    <TableHead>After (g)</TableHead>
                    <TableHead>Removed</TableHead>
                    <TableHead>Returned</TableHead>
                  </>
                )}
                renderRow={(row) => (
                  <>
                    <TableCell>{row.printJobId ?? "\u2014"}</TableCell>
                    <TableCell>{row.filamentUsedG != null ? `${row.filamentUsedG.toFixed(1)}g` : "\u2014"}</TableCell>
                    <TableCell>{row.weightBeforeG != null ? `${Math.round(row.weightBeforeG)}g` : "\u2014"}</TableCell>
                    <TableCell>{row.weightAfterG != null ? `${Math.round(row.weightAfterG)}g` : "\u2014"}</TableCell>
                    <TableCell>{fmtDate(row.removedAt)}</TableCell>
                    <TableCell>{fmtDate(row.returnedAt)}</TableCell>
                  </>
                )}
              />
            )}
          </TabsContent>
          <TabsContent value="drying">
            {dryingSessions.length === 0 ? (
              <EmptyState text="No drying sessions recorded." />
            ) : (
              <PaginatedTable
                data={dryingSessions}
                pageSize={5}
                renderHeader={() => (
                  <>
                    <TableHead>Temp (C)</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Moisture (g)</TableHead>
                    <TableHead>Before (g)</TableHead>
                    <TableHead>After (g)</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                  </>
                )}
                renderRow={(row) => (
                  <>
                    <TableCell>{row.temperatureC != null ? `${row.temperatureC}\u00B0C` : "\u2014"}</TableCell>
                    <TableCell>{row.durationMinutes != null ? `${Math.floor(row.durationMinutes / 60)}h ${row.durationMinutes % 60}m` : "\u2014"}</TableCell>
                    <TableCell>{row.moistureLostG != null ? `${row.moistureLostG.toFixed(1)}g` : "\u2014"}</TableCell>
                    <TableCell>{row.weightBeforeG != null ? `${Math.round(row.weightBeforeG)}g` : "\u2014"}</TableCell>
                    <TableCell>{row.weightAfterG != null ? `${Math.round(row.weightAfterG)}g` : "\u2014"}</TableCell>
                    <TableCell>{fmtDate(row.startedAt)}</TableCell>
                    <TableCell>{fmtDate(row.completedAt)}</TableCell>
                  </>
                )}
              />
            )}
          </TabsContent>
          <TabsContent value="movements">
            {movements.length === 0 ? (
              <EmptyState text="No movements recorded." />
            ) : (
              <PaginatedTable
                data={movements}
                pageSize={5}
                renderHeader={() => (
                  <>
                    <TableHead>From Slot</TableHead>
                    <TableHead>To Slot</TableHead>
                    <TableHead>Weight (g)</TableHead>
                    <TableHead>Date</TableHead>
                  </>
                )}
                renderRow={(row) => (
                  <>
                    <TableCell>{row.fromSlotId ? row.fromSlotId.slice(0, 8) : "\u2014"}</TableCell>
                    <TableCell>{row.toSlotId ? row.toSlotId.slice(0, 8) : "\u2014"}</TableCell>
                    <TableCell>{row.weightAtMoveG != null ? `${Math.round(row.weightAtMoveG)}g` : "\u2014"}</TableCell>
                    <TableCell>{fmtDate(row.createdAt)}</TableCell>
                  </>
                )}
              />
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

/** @deprecated Use UserItemEventsTabs instead */
export const SpoolEventsTabs = UserItemEventsTabs;
