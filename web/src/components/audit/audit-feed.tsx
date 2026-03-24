import { History } from "lucide-react";
import type { AuditLogWithActor } from "@/lib/actions/audit";
import { AuditCard } from "./audit-card";

export function AuditFeed({ items }: { items: AuditLogWithActor[] }) {
  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 gap-1.5">
        <History className="size-10 text-muted-foreground/50" />
        <p className="text-base font-medium">No audit logs found</p>
        <p className="text-sm text-muted-foreground">
          Adjust your filters or check back later.
        </p>
      </div>
    );
  }

  return (
    <div className="relative p-4 md:p-6 before:content-[''] before:absolute before:left-[35px] md:before:left-[39px] before:top-8 before:bottom-8 before:w-0.5 before:bg-border">
      {items.map((log, idx) => (
        <AuditCard
          key={log.id}
          log={log}
          isLast={idx === items.length - 1}
        />
      ))}
    </div>
  );
}
