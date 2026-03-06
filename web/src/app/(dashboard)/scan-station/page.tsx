"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import { PageHeader } from "@/components/layout/page-header";

type ScanEvent = {
  id: string;
  stationId: string;
  weightG: number | null;
  weightStable: boolean | null;
  heightMm: number | null;
  nfcPresent: boolean | null;
  nfcUid: string | null;
  nfcTagType: number | null;
  colorHex: string | null;
  identified: boolean | null;
  identifiedType: string | null;
  confidence: number | null;
  createdAt: string;
};

type ScanStation = {
  id: string;
  name: string;
  hardwareId: string;
  isOnline: boolean | null;
  lastSeenAt: string | null;
  hasTurntable: boolean | null;
  hasColorSensor: boolean | null;
  hasTofSensor: boolean | null;
  hasCamera: boolean | null;
};

export default function ScanStationPage() {
  const [stations, setStations] = useState<ScanStation[]>([]);
  const [recentScans, setRecentScans] = useState<ScanEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      // TODO: Replace with actual server actions
      setLoading(false);
    } catch {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div>
      <PageHeader
        title="Scan Station"
        description="Place objects on the scan station to identify and catalog them."
      />

      {/* Station Status Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stations.length === 0 && !loading && (
          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="body1" color="text.secondary" align="center">
                  No scan stations registered yet. Power on your scan station and
                  configure it with your API key to get started.
                </Typography>
                <Box sx={{ mt: 2, textAlign: "center" }}>
                  <Typography variant="body2" color="text.secondary">
                    Serial commands on scan station:
                  </Typography>
                  <Typography
                    variant="body2"
                    component="code"
                    sx={{ fontFamily: "monospace", display: "block", mt: 1 }}
                  >
                    wifi &lt;ssid&gt; &lt;password&gt;
                    <br />
                    apiurl https://your-app.com
                    <br />
                    apikey &lt;your-api-key&gt;
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {stations.map((station) => (
          <Grid size={{ xs: 12, md: 6 }} key={station.id}>
            <Card>
              <CardContent>
                <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
                  <Typography variant="h6">{station.name}</Typography>
                  <Chip
                    label={station.isOnline ? "Online" : "Offline"}
                    color={station.isOnline ? "success" : "default"}
                    size="small"
                  />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  ID: {station.hardwareId}
                </Typography>
                {station.lastSeenAt && (
                  <Typography variant="body2" color="text.secondary">
                    Last seen: {new Date(station.lastSeenAt).toLocaleString()}
                  </Typography>
                )}
                <Box sx={{ mt: 1, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                  <Chip label="Weight" size="small" color="primary" variant="outlined" />
                  <Chip label="NFC" size="small" color="primary" variant="outlined" />
                  {station.hasColorSensor && (
                    <Chip label="Color" size="small" color="secondary" variant="outlined" />
                  )}
                  {station.hasTofSensor && (
                    <Chip label="TOF" size="small" color="secondary" variant="outlined" />
                  )}
                  {station.hasTurntable && (
                    <Chip label="Turntable" size="small" color="info" variant="outlined" />
                  )}
                  {station.hasCamera && (
                    <Chip label="Camera" size="small" color="info" variant="outlined" />
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recent Scans */}
      <Typography variant="h6" sx={{ mb: 2 }}>
        Recent Scans
      </Typography>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress />
        </Box>
      ) : recentScans.length === 0 ? (
        <Card>
          <CardContent>
            <Typography variant="body1" color="text.secondary" align="center">
              No scans yet. Place an object on the scan station platform to begin.
            </Typography>
          </CardContent>
        </Card>
      ) : (
        <TableContainer component={Paper}>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell>Time</TableCell>
                <TableCell>Weight</TableCell>
                <TableCell>Height</TableCell>
                <TableCell>NFC</TableCell>
                <TableCell>Color</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Type</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {recentScans.map((scan) => (
                <TableRow key={scan.id}>
                  <TableCell>
                    {new Date(scan.createdAt).toLocaleTimeString()}
                  </TableCell>
                  <TableCell>
                    {scan.weightG != null ? `${scan.weightG.toFixed(1)}g` : "—"}
                    {scan.weightStable && " ✓"}
                  </TableCell>
                  <TableCell>
                    {scan.heightMm != null ? `${scan.heightMm.toFixed(1)}mm` : "—"}
                  </TableCell>
                  <TableCell>
                    {scan.nfcPresent ? (
                      <Chip label={scan.nfcUid ?? "Tag"} size="small" />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    {scan.colorHex ? (
                      <Box
                        sx={{
                          width: 24,
                          height: 24,
                          borderRadius: 1,
                          bgcolor: scan.colorHex,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      />
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={scan.identified ? "Identified" : "Pending"}
                      color={scan.identified ? "success" : "warning"}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{scan.identifiedType ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </div>
  );
}
