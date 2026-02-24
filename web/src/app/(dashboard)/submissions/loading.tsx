import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export default function SubmissionsLoading() {
  return (
    <div>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Skeleton variant="text" width={140} height={40} />
          <Skeleton variant="text" width={280} height={20} />
        </Box>
        <Skeleton variant="rounded" width={150} height={40} />
      </Box>
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={80} height={36} sx={{ borderRadius: 2 }} />
        ))}
      </Box>
      <Stack spacing={1}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={52} />
        ))}
      </Stack>
    </div>
  );
}
