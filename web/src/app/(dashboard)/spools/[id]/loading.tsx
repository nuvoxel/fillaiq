import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";

export default function SpoolDetailLoading() {
  return (
    <div>
      <Skeleton variant="text" width={120} height={32} sx={{ mb: 2 }} />
      <Skeleton variant="text" width={200} height={40} sx={{ mb: 3 }} />

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 8 }}>
          <Skeleton variant="rounded" height={320} />
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Skeleton variant="rounded" height={320} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Skeleton variant="rounded" height={340} />
        </Grid>
        <Grid size={{ xs: 12 }}>
          <Skeleton variant="rounded" height={280} />
        </Grid>
      </Grid>
    </div>
  );
}
