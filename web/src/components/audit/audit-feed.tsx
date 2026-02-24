import Stack from "@mui/material/Stack";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import HistoryIcon from "@mui/icons-material/History";
import type { AuditLogWithActor } from "@/lib/actions/audit";
import { AuditCard } from "./audit-card";

export function AuditFeed({ items }: { items: AuditLogWithActor[] }) {
  if (items.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          py: 8,
          gap: 1.5,
        }}
      >
        <HistoryIcon sx={{ fontSize: 40, color: "text.disabled" }} />
        <Typography variant="subtitle1" fontWeight={500}>
          No audit logs found
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Adjust your filters or check back later.
        </Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5}>
      {items.map((log) => (
        <AuditCard key={log.id} log={log} />
      ))}
    </Stack>
  );
}
