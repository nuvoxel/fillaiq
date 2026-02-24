import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export default function CatalogLoading() {
  return (
    <div>
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width={120} height={40} />
        <Skeleton variant="text" width={280} height={20} />
      </Box>
      <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={90} height={36} />
        ))}
      </Box>
      <Skeleton variant="rounded" width={320} height={40} sx={{ mb: 2 }} />
      <Stack spacing={1}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={52} />
        ))}
      </Stack>
    </div>
  );
}
