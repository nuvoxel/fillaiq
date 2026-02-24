import Box from "@mui/material/Box";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export default function HardwareLoading() {
  return (
    <div>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 3 }}>
        <Box>
          <Skeleton variant="text" width={120} height={40} />
          <Skeleton variant="text" width={260} height={20} />
        </Box>
        <Skeleton variant="rounded" width={120} height={40} />
      </Box>
      <Stack spacing={2}>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} variant="rounded" height={140} />
        ))}
      </Stack>
    </div>
  );
}
