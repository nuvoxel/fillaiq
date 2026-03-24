import { listAuditLogsFiltered } from "@/lib/actions/audit";
import { PageHeader } from "@/components/layout/page-header";
import { AuditFilters } from "@/components/audit/audit-filters";
import { AuditFeed } from "@/components/audit/audit-feed";
import { AuditPagination } from "./pagination";

const PAGE_SIZE = 25;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const actionRaw = params.action;
  const action = actionRaw
    ? Array.isArray(actionRaw)
      ? actionRaw
      : [actionRaw]
    : undefined;

  const resourceType =
    typeof params.resourceType === "string" ? params.resourceType : undefined;

  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const result = await listAuditLogsFiltered({
    action,
    resourceType,
    limit: PAGE_SIZE,
    offset,
  });

  const items = result.data?.items ?? [];
  const total = result.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const showingFrom = total > 0 ? offset + 1 : 0;
  const showingTo = Math.min(offset + PAGE_SIZE, total);

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Track every state change, resource movement, and operational event."
        badge={
          total > 0 ? (
            <span className="font-display font-light text-[1.75rem] text-muted-foreground/50 ml-1.5">
              {total.toLocaleString()}
            </span>
          ) : undefined
        }
      />

      <AuditFilters />

      <div className="bg-card rounded-xl shadow-sm overflow-hidden mt-1">
        <AuditFeed items={items} />

        {/* Pagination footer */}
        {total > 0 && (
          <div className="px-3 py-2 border-t border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground font-medium">
              Showing{" "}
              <span className="font-bold text-foreground">
                {showingFrom}-{showingTo}
              </span>{" "}
              of{" "}
              <span className="font-bold text-foreground">
                {total.toLocaleString()}
              </span>{" "}
              entries
            </p>

            {totalPages > 1 && (
              <AuditPagination totalPages={totalPages} currentPage={page} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
