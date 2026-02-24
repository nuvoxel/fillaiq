import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import type { AuditLogWithActor } from "@/lib/actions/audit";
import type { AuditAction } from "@/lib/design-tokens";
import { colors } from "@/lib/design-tokens";
import { AuditMetadata } from "./audit-metadata";

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

function relativeTime(date: Date): string {
  const now = Date.now();
  const diff = now - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (days > 0) return rtf.format(-days, "day");
  if (hours > 0) return rtf.format(-hours, "hour");
  if (minutes > 0) return rtf.format(-minutes, "minute");
  return rtf.format(-seconds, "second");
}

export function AuditCard({ log }: { log: AuditLogWithActor }) {
  const action = log.action as AuditAction;
  const actionColor = colors.action[action] ?? colors.action.logout;
  const label = actionLabels[action] ?? action;
  const resource = formatResourceType(log.resourceType);
  const description =
    action === "login" || action === "logout"
      ? label
      : `${label} ${resource.toLowerCase()}`;

  return (
    <Card
      sx={{
        borderLeft: 4,
        borderColor: actionColor.DEFAULT,
        bgcolor: "background.paper",
      }}
    >
      <CardContent sx={{ py: 2, "&:last-child": { pb: 2 } }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 1.5,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, flexWrap: "wrap" }}>
            <Chip
              label={action}
              size="small"
              sx={{
                bgcolor: actionColor.bg,
                color: actionColor.DEFAULT,
                fontWeight: 600,
                fontSize: "0.75rem",
              }}
            />
            <Typography variant="body2" fontWeight={500}>
              {description}
            </Typography>
          </Box>
          <Typography variant="caption" color="text.disabled" noWrap>
            {relativeTime(new Date(log.createdAt))}
          </Typography>
        </Box>

        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {log.actorName ?? log.actorEmail}
          </Typography>
          {log.resourceId && (
            <>
              <Typography variant="caption" color="text.disabled">
                &middot;
              </Typography>
              <Typography
                variant="caption"
                color="text.disabled"
                sx={{
                  fontFamily: "monospace",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: 160,
                }}
                noWrap
              >
                {log.resourceId}
              </Typography>
            </>
          )}
        </Box>

        {log.metadata != null &&
          Object.keys(log.metadata as object).length > 0 && (
            <Accordion
              disableGutters
              elevation={0}
              sx={{
                mt: 1.5,
                "&:before": { display: "none" },
                bgcolor: "transparent",
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ fontSize: 16 }} />}
                sx={{
                  minHeight: 0,
                  p: 0,
                  "& .MuiAccordionSummary-content": { m: 0 },
                }}
              >
                <Typography variant="caption" color="text.secondary">
                  View metadata
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ p: 0, pt: 1 }}>
                <AuditMetadata
                  metadata={log.metadata as Record<string, unknown>}
                />
              </AccordionDetails>
            </Accordion>
          )}
      </CardContent>
    </Card>
  );
}
