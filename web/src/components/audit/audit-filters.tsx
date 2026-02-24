"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Box from "@mui/material/Box";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";
import Button from "@mui/material/Button";
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
  "filament",
  "variant",
  "sku_mapping",
  "nfc_tag_pattern",
  "equivalence_group",
  "filament_equivalence",
  "submission",
  "user",
  "spool",
  "printer",
  "print_profile",
  "equipment",
  "label_template",
  "rack",
  "bridge",
  "shelf",
  "bay",
  "slot",
  "slot_status",
  "weight_event",
  "spool_movement",
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

  function handleActionsChange(
    _: React.MouseEvent<HTMLElement>,
    newActions: string[],
  ) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    params.delete("action");
    newActions.forEach((a) => params.append("action", a));
    router.push(`?${params.toString()}`);
  }

  function setResourceType(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("page");
    if (value) {
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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, mb: 3 }}>
      <ToggleButtonGroup
        value={activeActions}
        onChange={handleActionsChange}
        size="small"
      >
        {actionTypes.map(({ value, label }) => {
          const actionColor = colors.action[value];
          return (
            <ToggleButton
              key={value}
              value={value}
              sx={{
                textTransform: "none",
                fontWeight: 500,
                px: 2,
                "&.Mui-selected": {
                  bgcolor: actionColor.bg,
                  color: actionColor.DEFAULT,
                  borderColor: actionColor.DEFAULT,
                },
                "&.Mui-selected:hover": {
                  bgcolor: actionColor.bg,
                },
              }}
            >
              {label}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>

      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <TextField
          select
          size="small"
          value={activeResourceType}
          onChange={(e) => setResourceType(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="">All resource types</MenuItem>
          {resourceTypes.map((rt) => (
            <MenuItem key={rt} value={rt}>
              {rt
                .replace(/_/g, " ")
                .replace(/\b\w/g, (c) => c.toUpperCase())}
            </MenuItem>
          ))}
        </TextField>

        {hasFilters && (
          <Button variant="text" size="small" onClick={clearAll}>
            Clear all
          </Button>
        )}
      </Box>
    </Box>
  );
}
