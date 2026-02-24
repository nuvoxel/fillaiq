import type { ReactNode } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        mb: 3,
      }}
    >
      <Box>
        <Typography variant="h4" fontWeight={600}>
          {title}
        </Typography>
        {description && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {description}
          </Typography>
        )}
      </Box>
      {action && <Box>{action}</Box>}
    </Box>
  );
}
