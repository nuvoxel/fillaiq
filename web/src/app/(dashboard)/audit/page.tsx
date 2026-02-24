import Box from "@mui/material/Box";
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

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Track all actions across the platform."
      />
      <AuditFilters />
      <AuditFeed items={items} />
      {totalPages > 1 && (
        <Box sx={{ mt: 3, display: "flex", justifyContent: "center" }}>
          <AuditPagination totalPages={totalPages} currentPage={page} />
        </Box>
      )}
    </div>
  );
}
