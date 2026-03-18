import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";

export function Footer() {
  return (
    <Box
      component="footer"
      sx={{
        borderTop: 1,
        borderColor: "divider",
        py: 2,
        px: 3,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Typography variant="caption" color="text.secondary">
        &copy; {new Date().getFullYear()} FillaIQ &middot; v{process.env.NEXT_PUBLIC_APP_VERSION || "dev"}
      </Typography>
    </Box>
  );
}
