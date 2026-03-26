import { ChevronDown } from "lucide-react";
import type { AuditLogWithActor } from "@/lib/actions/audit";
import type { AuditAction } from "@/lib/design-tokens";
import { colors } from "@/lib/design-tokens";
import { AuditMetadata } from "./audit-metadata";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";

const actionLabels: Record<string, string> = {
  create: "Created",
  update: "Updated",
  delete: "Deleted",
  review: "Reviewed",
  login: "Logged in",
  logout: "Logged out",
};

function formatResourceType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatTimestamp(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
    .format(date)
    .replace(",", "");
}

export function AuditCard({
  log,
  isLast,
}: {
  log: AuditLogWithActor;
  isLast?: boolean;
}) {
  const action = log.action as AuditAction;
  const actionColor = colors.action[action] ?? colors.action.logout;
  const label = actionLabels[action] ?? action;
  const resource = formatResourceType(log.resourceType);
  const description =
    action === "login" || action === "logout"
      ? label
      : `${label} ${resource.toLowerCase()}`;

  const initials =
    log.actorName?.[0]?.toUpperCase() ??
    log.actorEmail?.[0]?.toUpperCase() ??
    "?";

  return (
    <div
      className={`relative pl-6 flex items-start justify-between gap-2 group ${isLast ? "" : "pb-4"}`}
    >
      {/* Timeline dot */}
      <div
        className="absolute left-[14px] top-[4px] w-[18px] h-[18px] rounded-full z-[1] shadow-[0_0_0_4px_var(--background)]"
        style={{ backgroundColor: actionColor.DEFAULT }}
      />

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="font-mono text-[0.8125rem] text-muted-foreground/60">
            {formatTimestamp(new Date(log.createdAt))}
          </span>
          <span
            className="inline-flex items-center h-5 px-1.5 rounded-full text-[0.625rem] font-bold uppercase tracking-wider"
            style={{ backgroundColor: actionColor.bg, color: actionColor.DEFAULT }}
          >
            {label}
          </span>
        </div>

        <p className="font-bold text-base text-foreground">
          {description}
          {log.resourceId && (
            <span className="text-[#00677F] font-medium">
              {" "}
              {resource}
            </span>
          )}
        </p>

        {(() => {
          const meta = log.metadata as Record<string, any> | null;
          const name = meta?.name ?? meta?.resourceName;
          if (name) return <p className="text-sm text-muted-foreground mt-0.5">{name}</p>;
          return null;
        })()}

        {log.metadata != null &&
          Object.keys(log.metadata as object).length > 0 && (
            <Accordion className="mt-1">
              <AccordionItem value="metadata" className="border-none">
                <AccordionTrigger className="py-0 hover:no-underline">
                  <span className="text-xs text-muted-foreground">
                    View metadata
                  </span>
                </AccordionTrigger>
                <AccordionContent className="pt-1 pb-0">
                  <AuditMetadata
                    metadata={log.metadata as Record<string, unknown>}
                  />
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          )}
      </div>

      {/* Actor pill */}
      <div className="flex items-center gap-1.5 bg-muted px-2 py-1 rounded-lg border border-transparent group-hover:border-border transition-colors shrink-0">
        <div className="text-right">
          <p className="text-sm font-bold leading-tight">
            {log.actorName ?? log.actorEmail}
          </p>
        </div>
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-[0.8rem] text-white"
          style={{ backgroundColor: actionColor.DEFAULT }}
        >
          {initials}
        </div>
      </div>
    </div>
  );
}
