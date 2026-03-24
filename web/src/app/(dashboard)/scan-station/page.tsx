"use client";

import { useState, useEffect, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
          <Button onClick={() => setPairOpen(true)}>
            Pair Device
          </Button>
        }
      />

      {/* Pair Device Dialog */}
      <Dialog open={pairOpen} onOpenChange={(o) => { if (!o) setPairOpen(false); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Pair Scan Station</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-2">
            Enter the pairing code shown on your scan station&apos;s display.
          </p>
          {pairError && (
            <Alert variant="destructive" className="mb-2">
              <AlertDescription>{pairError}</AlertDescription>
            </Alert>
          )}
          <div className="space-y-1.5">
            <Label>Pairing Code</Label>
            <Input
              autoFocus
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.toUpperCase())}
              maxLength={6}
              placeholder="e.g. X3F7K2"
              className="text-center text-lg font-semibold tracking-widest"
            />
            <p className="text-xs text-muted-foreground">6-character code from the scan station screen</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPairOpen(false)}>Cancel</Button>
            <Button
              onClick={handlePair}
              disabled={pairingCode.length < 4 || pairing}
            >
              {pairing ? "Pairing..." : "Pair"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Station Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
        {stations.length === 0 && !loading && (
          <div className="col-span-full">
            <Card>
              <CardContent>
                <p className="text-center text-muted-foreground">
                  No scan stations paired yet. Power on your scan station, connect it
                  to WiFi, then click &quot;Pair Device&quot; and enter the code shown on the display.
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {stations.map((station) => (
          <Card key={station.id}>
            <CardContent>
              <div className="flex justify-between mb-1">
                <h3 className="text-lg font-semibold">{station.name}</h3>
                <Badge variant={station.isOnline ? "default" : "outline"}>
                  {station.isOnline ? "Online" : "Offline"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                ID: {station.hardwareId}
              </p>
              {station.lastSeenAt && (
                <p className="text-sm text-muted-foreground">
                  Last seen: {new Date(station.lastSeenAt).toLocaleString()}
                </p>
              )}
              <div className="mt-2 flex gap-1 flex-wrap">
                <Badge variant="outline">Weight</Badge>
                <Badge variant="outline">NFC</Badge>
                {station.hasColorSensor && <Badge variant="secondary">Color</Badge>}
                {station.hasTofSensor && <Badge variant="secondary">TOF</Badge>}
                {station.hasTurntable && <Badge variant="outline">Turntable</Badge>}
                {station.hasCamera && <Badge variant="outline">Camera</Badge>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Scans */}
      <h2 className="text-lg font-semibold mb-2">Recent Scans</h2>

      {loading ? (
        <div className="flex justify-center py-4">
          <Loader2 className="size-6 animate-spin text-muted-foreground" />
        </div>
      ) : recentScans.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-center text-muted-foreground">
              No scans yet. Place an object on the scan station platform to begin.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Time</TableHead>
              <TableHead>Weight</TableHead>
              <TableHead>Height</TableHead>
              <TableHead>NFC</TableHead>
              <TableHead>Color</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {recentScans.map((scan) => (
              <TableRow key={scan.id}>
                <TableCell>
                  {new Date(scan.createdAt).toLocaleTimeString()}
                </TableCell>
                <TableCell>
                  {scan.weightG != null ? `${scan.weightG.toFixed(1)}g` : "\u2014"}
                  {scan.weightStable && " \u2713"}
                </TableCell>
                <TableCell>
                  {scan.heightMm != null ? `${scan.heightMm.toFixed(1)}mm` : "\u2014"}
                </TableCell>
                <TableCell>
                  {scan.nfcPresent ? (
                    <Badge variant="outline">{scan.nfcUid ?? "Tag"}</Badge>
                  ) : (
                    "\u2014"
                  )}
                </TableCell>
                <TableCell>
                  {scan.colorHex ? (
                    <div
                      className="w-6 h-6 rounded border border-border"
                      style={{ backgroundColor: scan.colorHex }}
                    />
                  ) : (
                    "\u2014"
                  )}
                </TableCell>
                <TableCell>
                  <Badge variant={scan.identified ? "default" : "outline"}>
                    {scan.identified ? "Identified" : "Pending"}
                  </Badge>
                </TableCell>
                <TableCell>{scan.identifiedType ?? "\u2014"}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
