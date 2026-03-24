"use client";

import { useState, useEffect, useTransition } from "react";
import { Trash2, Plus, Monitor } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle, CardAction, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from "@/components/ui/table";
import { listMyStations, revokeDevice, updateStationChannel, claimDevice } from "@/lib/actions/scan";

type Station = {
  id: string;
  name: string;
  hardwareId: string;
  firmwareVersion: string | null;
  firmwareChannel: string | null;
  ipAddress: string | null;
  isOnline: boolean | null;
  lastSeenAt: string | null;
  createdAt: string;
};

export function PairedDevicesCard() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [pairOpen, setPairOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState("");
  const [pairError, setPairError] = useState("");

  const fetchStations = async () => {
    const result = await listMyStations();
    if (result.data) setStations(result.data as unknown as Station[]);
    setLoading(false);
  };

  useEffect(() => {
    fetchStations();
  }, []);

  const handleRevoke = (id: string, name: string) => {
    if (!confirm(`Revoke access for "${name}"? The device will need to be re-paired.`)) return;
    startTransition(async () => {
      const result = await revokeDevice(id);
      if (!result.error) {
        fetchStations();
      }
    });
  };

  const handlePair = () => {
    setPairError("");
    startTransition(async () => {
      const result = await claimDevice(pairingCode.trim().toUpperCase());
      if (result.error) {
        setPairError(result.error);
      } else {
        setPairOpen(false);
        setPairingCode("");
        fetchStations();
      }
    });
  };

  const handleChannelChange = (id: string, channel: string) => {
    startTransition(async () => {
      const result = await updateStationChannel(id, channel);
      if (!result.error) {
        fetchStations();
      }
    });
  };

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle className="font-semibold">Devices</CardTitle>
        <CardAction>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setPairOpen(true); setPairError(""); setPairingCode(""); }}
          >
            <Plus className="size-4 mr-1" />
            Pair Device
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="p-0">
        {loading ? (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">Loading...</p>
          </div>
        ) : stations.length === 0 ? (
          <div className="text-center py-8">
            <Monitor className="mx-auto size-10 text-muted-foreground/50 mb-2" />
            <p className="text-sm text-muted-foreground">
              No devices paired. Power on a device and enter the pairing code to connect it.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="font-semibold">Name</TableHead>
                <TableHead className="font-semibold">Hardware ID</TableHead>
                <TableHead className="font-semibold">Firmware</TableHead>
                <TableHead className="font-semibold">Channel</TableHead>
                <TableHead className="font-semibold">IP Address</TableHead>
                <TableHead className="font-semibold">Status</TableHead>
                <TableHead className="font-semibold">Last Seen</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {stations.map((station) => (
                <TableRow key={station.id}>
                  <TableCell>{station.name}</TableCell>
                  <TableCell>
                    <span className="text-sm font-mono text-muted-foreground">
                      {station.hardwareId}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-mono text-muted-foreground">
                      {station.firmwareVersion ?? "\u2014"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Select
                      value={station.firmwareChannel ?? "stable"}
                      onValueChange={(val) => val && handleChannelChange(station.id, val)}
                      disabled={isPending}
                    >
                      <SelectTrigger className="min-w-[90px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="stable">Stable</SelectItem>
                        <SelectItem value="beta">Beta</SelectItem>
                        <SelectItem value="dev">Dev</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm font-mono text-muted-foreground">
                      {station.ipAddress ?? "\u2014"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant={station.isOnline ? "default" : "outline"}>
                      {station.isOnline ? "Online" : "Offline"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {station.lastSeenAt
                      ? new Date(station.lastSeenAt).toLocaleString()
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => handleRevoke(station.id, station.name)}
                      disabled={isPending}
                      title="Revoke device access"
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={pairOpen} onOpenChange={(o) => { if (!o) setPairOpen(false); }}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle>Pair Device</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enter the 6-character pairing code shown on your device.
            </p>
            {pairError && (
              <Alert variant="destructive">
                <AlertDescription>{pairError}</AlertDescription>
              </Alert>
            )}
            <Input
              autoFocus
              value={pairingCode}
              onChange={(e) => setPairingCode(e.target.value.toUpperCase().slice(0, 6))}
              onKeyDown={(e) => { if (e.key === "Enter" && pairingCode.length === 6) handlePair(); }}
              maxLength={6}
              className="font-mono text-2xl text-center tracking-[0.3em]"
              placeholder="ABC123"
            />
          </div>
          <DialogFooter>
            <DialogClose render={<Button variant="outline" />}>
              Cancel
            </DialogClose>
            <Button onClick={handlePair} disabled={isPending || pairingCode.length !== 6}>
              {isPending ? "Pairing..." : "Pair"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
