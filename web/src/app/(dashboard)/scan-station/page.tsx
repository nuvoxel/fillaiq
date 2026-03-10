"use client";

import { useState, useEffect, useCallback } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Chip from "@mui/material/Chip";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";
import CircularProgress from "@mui/material/CircularProgress";
import Alert from "@mui/material/Alert";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import { PageHeader } from "@/components/layout/page-header";
import { listMyStations, listMyRecentScans, claimDevice } from "@/lib/actions/scan";

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
  const [pairOpen, setPairOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [pairError, setPairError] = useState("");
  const [pairing, setPairing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [stationsRes, scansRes] = await Promise.all([
        listMyStations(),
        listMyRecentScans(20),
      ]);
      if (stationsRes.data) setStations(stationsRes.data as unknown as ScanStation[]);
      if (scansRes.data) setRecentScans(scansRes.data as unknown as ScanEvent[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handlePair = async () => {
    setPairError("");
    setPairing(true);
    try {
      const result = await claimDevice(pairingCode);
      if (result.error) {
        setPairError(result.error);
      } else {
        setPairOpen(false);
        setPairingCode("");
        fetchData();
      }
    } finally {
      setPairing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Scan Stations"
        description="Manage your scan stations and view recent scans."
        action={
          <Button variant="contained" onClick={() => setPairOpen(true)}>
            Pair Device
          </Button>
        }
      />

      {/* Pair Device Dialog */}
      <Dialog open={pairOpen} onClose={() => setPairOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Pair Scan Station</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Enter the pairing code shown on your scan station&apos;s display.
          </Typography>
          <TextField
            autoFocus
            fullWidth
            label="Pairing Code"
            placeholder="e.g. X3F7K2"
            value={pairingCode}
            onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
            inputProps={{ maxLength: 6, style: { letterSpacing: "0.3em", fontWeight: 600, fontSize: "1.2em", textAlign: "center" } }}
            error={!!pairError}
            helperText={pairError || "6-character code from the scan station screen"}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPairOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handlePair}
            disabled={pairingCode.length < 4 || pairing}
          >
            {pairing ? "Pairing..." : "Pair"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Station Status Cards */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        {stations.length === 0 && !loading && (
          <Grid size={12}>
            <Card>
              <CardContent>
                <Typography variant="body1" color="text.secondary" align="center">
                  No scan stations paired yet. Power on your scan station, connect it
                  to WiFi, then click &quot;Pair Device&quot; and enter the code shown on the display.
                </Typography>
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
