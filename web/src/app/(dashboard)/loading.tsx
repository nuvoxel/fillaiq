import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export default function DashboardLoading() {
  return (
    <div>
      <Box sx={{ mb: 3 }}>
        <Skeleton variant="text" width={160} height={40} />
        <Skeleton variant="text" width={300} height={20} />
      </Box>

      <Grid container spacing={2} sx={{ mb: 4 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <Grid key={i} size={{ xs: 12, sm: 6, md: 3 }}>
            <Skeleton variant="rounded" height={100} />
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Skeleton variant="rounded" height={380} />
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Skeleton variant="rounded" height={380} />
        </Grid>
      </Grid>
    </div>
  );
}
