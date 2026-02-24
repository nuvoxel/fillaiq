import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export default function AuditLoading() {
  return (
    <div>
      {/* Page header skeleton */}
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width={144} height={40} />
        <Skeleton variant="text" width={256} height={20} />
      </Box>

      {/* Filter pills skeleton */}
      <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton
            key={i}
            variant="rounded"
            width={64}
            height={32}
            sx={{ borderRadius: 9999 }}
          />
        ))}
      </Box>
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="rounded" width={200} height={40} />
      </Box>

      {/* Card skeletons */}
      <Stack spacing={1.5}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={96} />
        ))}
      </Stack>
    </div>
  );
}
