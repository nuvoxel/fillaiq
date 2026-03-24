"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import type { AuditAction } from "@/lib/design-tokens";
import { colors } from "@/lib/design-tokens";

const actionTypes: { value: AuditAction; label: string }[] = [
  { value: "create", label: "Create" },
  { value: "update", label: "Update" },
  { value: "delete", label: "Delete" },
  { value: "review", label: "Review" },
  { value: "login", label: "Login" },
  { value: "logout", label: "Logout" },
];

const resourceTypes = [
  "brand",
  "material",
  "product",
  "filament_profile",
  "sku_mapping",
  "nfc_tag_pattern",
  "product_alias",
  "submission",
  "user",
  "user_item",
  "machine",
  "print_profile",
  "equipment",
  "label_template",
  "zone",
  "rack",
  "shelf",
  "bay",
  "bay_module",
  "slot",
  "slot_status",
  "weight_event",
  "user_item_movement",
  "usage_session",
  "drying_session",
  "environmental_reading",
  "session",
];

export function AuditFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeActions = searchParams.getAll("action");
  const activeResourceType = searchParams.get("resourceType") ?? "";

  function toggleAction(action: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    const current = params.getAll("action");
    params.delete("action");
    if (current.includes(action)) {
      current
        .filter((a) => a !== action)
        .forEach((a) => params.append("action", a));
    } else {
      [...current, action].forEach((a) => params.append("action", a));
    }
    router.push(`?${params.toString()}`);
  }

  function setResourceType(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (value && value !== "all") {
      params.set("resourceType", value);
    } else {
      params.delete("resourceType");
    }
    router.push(`?${params.toString()}`);
  }

  function clearAll() {
    router.push("?");
  }

  const hasFilters = activeActions.length > 0 || activeResourceType;

  return (
    <div className="bg-card p-2.5 rounded-xl mb-3 shadow-sm flex flex-wrap items-end gap-3">
      {/* Action Type */}
      <div className="flex-1 min-w-60">
        <p className="text-[0.625rem] uppercase tracking-[0.1em] font-bold text-muted-foreground/60 mb-1.5 px-0.5">
          Action Type
        </p>
        <div className="flex flex-wrap gap-1">
          {actionTypes.map(({ value, label }) => {
            const actionColor = colors.action[value];
            const isActive = activeActions.includes(value);
            return (
              <button
                key={value}
                onClick={() => toggleAction(value)}
                className="px-2 py-1 text-[0.8125rem] font-semibold rounded-lg transition-colors"
                style={
                  isActive
                    ? { backgroundColor: actionColor.bg, color: actionColor.DEFAULT }
                    : { backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Resource Type */}
      <div className="min-w-[200px]">
        <p className="text-[0.625rem] uppercase tracking-[0.1em] font-bold text-muted-foreground/60 mb-1.5 px-0.5">
          Resource Type
        </p>
        <Select value={activeResourceType || "all"} onValueChange={(v) => setResourceType(v ?? "")}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Resources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Resources</SelectItem>
            {resourceTypes.map((rt) => (
              <SelectItem key={rt} value={rt}>
                {rt
                  .replace(/_/g, " ")
                  .replace(/\b\w/g, (c) => c.toUpperCase())}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Clear */}
      {hasFilters && (
        <Button
          size="sm"
          onClick={clearAll}
          className="bg-[#1A2530] text-white hover:bg-[#2c3e50]"
        >
          Clear Filters
        </Button>
      )}
    </div>
  );
}
