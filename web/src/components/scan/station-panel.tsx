"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Scale,
  Nfc,
  Palette,
  Ruler,
  Wifi,
  WifiOff,
  Radio,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { listMyStations, pollStationScan } from "@/lib/actions/scan";

export type StationScanData = {
  scanEventId: string;
  sessionId: string | null;
  // Weight
  weightG: number | null;
  weightStable: boolean | null;
  // NFC
  nfcPresent: boolean | null;
  nfcUid: string | null;
  nfcTagType: number | null;
  nfcTagFormat: string | null;
  nfcParsedData: Record<string, any> | null;
  // Color
  colorHex: string | null;
  colorLabL: number | null;
  colorLabA: number | null;
  colorLabB: number | null;
  spectralData: any;
  // Height
  heightMm: number | null;
  // Auto-identified product
  autoProduct: { product: any; brand: any } | null;
};

type StationOption = {
  id: string;
  name: string;
  hardwareId: string;
  isOnline: boolean | null;
  lastSeenAt: Date | null;
};

type Props = {
  onScanData: (data: StationScanData) => void;
  onStationChange: (station: StationOption | null) => void;
};

export function StationPanel({ onScanData, onStationChange }: Props) {
  const [stations, setStations] = useState<StationOption[]>([]);
  const [selectedStationId, setSelectedStationId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [polling, setPolling] = useState(false);
  const [lastScanId, setLastScanId] = useState<string | null>(null);
  const [currentScan, setCurrentScan] = useState<StationScanData | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load stations on mount
  useEffect(() => {
    listMyStations().then((result) => {
      if (result.data) {
        const s = result.data as StationOption[];
        setStations(s);
        const online = s.find((st) => st.isOnline);
        if (online) {
          setSelectedStationId(online.id);
          onStationChange(online);
        }
      }
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for new scans from selected station
  useEffect(() => {
    if (!selectedStationId) {
      if (pollRef.current) clearInterval(pollRef.current);
      setPolling(false);
      return;
    }

    setPolling(true);

    const poll = async () => {
      const result = await pollStationScan(
        selectedStationId,
        lastScanId ?? undefined
      );
      if (result.data) {
        const { scanEvent, autoIdentified, session } = result.data;

        const data: StationScanData = {
          scanEventId: scanEvent.id,
          sessionId: session?.id ?? scanEvent.sessionId ?? null,
          weightG: session?.bestWeightG ?? scanEvent.weightG,
          weightStable: scanEvent.weightStable,
          nfcPresent: scanEvent.nfcPresent,
          nfcUid: session?.nfcUid ?? scanEvent.nfcUid,
          nfcTagType: scanEvent.nfcTagType,
          nfcTagFormat: session?.nfcTagFormat ?? scanEvent.nfcTagFormat,
          nfcParsedData: (session?.nfcParsedData ?? scanEvent.nfcParsedData) as Record<string, any> | null,
          colorHex: session?.bestColorHex ?? scanEvent.colorHex,
          colorLabL: session?.bestColorLabL ?? scanEvent.colorLabL,
          colorLabA: session?.bestColorLabA ?? scanEvent.colorLabA,
          colorLabB: session?.bestColorLabB ?? scanEvent.colorLabB,
          spectralData: session?.bestSpectralData ?? scanEvent.spectralData,
          heightMm: session?.bestHeightMm ?? scanEvent.heightMm,
          autoProduct: autoIdentified ?? null,
        };

        setCurrentScan(data);
        setLastScanId(scanEvent.id);
        onScanData(data);
      }
    };

    poll(); // initial check
    pollRef.current = setInterval(poll, 2000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStationId]);

  const handleStationSelect = (id: string) => {
    setSelectedStationId(id);
    setLastScanId(null);
    setCurrentScan(null);
    const station = stations.find((s) => s.id === id) ?? null;
    onStationChange(station);
  };

  if (loading) return null;
  if (stations.length === 0) return null;

  const selectedStation = stations.find((s) => s.id === selectedStationId);

  return (
    <Card
      className={`${
        selectedStation?.isOnline
          ? "border-2 border-green-500"
          : "border border-border"
      }`}
    >
      <CardContent className="pb-3">
        {/* Station selector */}
        <div className="flex items-center gap-2 mb-3">
          <Radio
            className={`size-4 ${
              selectedStation?.isOnline
                ? "text-green-500"
                : "text-muted-foreground"
            }`}
          />
          <span className="text-xs font-semibold flex-1">Scan Station</span>
          {stations.length > 1 ? (
            <Select value={selectedStationId} onValueChange={(v) => v && handleStationSelect(v)}>
              <SelectTrigger className="min-w-[160px]">
                <SelectValue placeholder="Select station" />
              </SelectTrigger>
              <SelectContent>
                {stations.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <div className="flex items-center gap-1.5">
                      {s.isOnline ? (
                        <Wifi className="size-3.5 text-green-500" />
                      ) : (
                        <WifiOff className="size-3.5 text-muted-foreground" />
                      )}
                      {s.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Badge variant={selectedStation?.isOnline ? "default" : "outline"}>
              {selectedStation?.isOnline ? (
                <Wifi className="size-3 mr-1" />
              ) : (
                <WifiOff className="size-3 mr-1" />
              )}
              {selectedStation?.name ?? "No station"}
            </Badge>
          )}
        </div>

        {/* Polling indicator */}
        {polling && !currentScan && (
          <div className="mb-2">
            <p className="text-xs text-muted-foreground mb-1">
              Waiting for spool on station...
            </p>
            <Progress value={null} className="h-1" />
          </div>
        )}

        {/* Sensor readings */}
        {currentScan && (
          <div className="space-y-2 animate-in fade-in">
            <p className="text-[0.65rem] font-semibold text-muted-foreground uppercase tracking-wider">
              Station Readings
            </p>

            <div className="flex flex-wrap gap-1.5">
              {/* Weight */}
              <SensorChip
                icon={<Scale className="size-3.5" />}
                label={
                  currentScan.weightG != null
                    ? `${currentScan.weightG.toFixed(1)}g${currentScan.weightStable ? "" : " ~"}`
                    : "No weight"
                }
                active={currentScan.weightG != null}
                stable={currentScan.weightStable ?? false}
              />

              {/* NFC */}
              <SensorChip
                icon={<Nfc className="size-3.5" />}
                label={
                  currentScan.nfcPresent
                    ? currentScan.nfcUid
                      ? `NFC: ${currentScan.nfcUid.slice(0, 12)}...`
                      : "NFC detected"
                    : "No NFC"
                }
                active={currentScan.nfcPresent ?? false}
              />

              {/* Color */}
              <SensorChip
                icon={
                  currentScan.colorHex ? (
                    <div
                      className="size-4 rounded-full border border-border shrink-0"
                      style={{ backgroundColor: currentScan.colorHex }}
                    />
                  ) : (
                    <Palette className="size-3.5" />
                  )
                }
                label={currentScan.colorHex ?? "No color"}
                active={currentScan.colorHex != null}
              />

              {/* Height */}
              <SensorChip
                icon={<Ruler className="size-3.5" />}
                label={
                  currentScan.heightMm != null
                    ? `${currentScan.heightMm.toFixed(0)}mm`
                    : "No height"
                }
                active={currentScan.heightMm != null}
              />
            </div>

            {/* NFC parsed info */}
            {currentScan.nfcParsedData && (
              <div className="p-2 bg-muted/50 rounded font-mono text-xs max-h-20 overflow-auto">
                {Object.entries(currentScan.nfcParsedData).map(
                  ([key, value]) => (
                    <div key={key}>
                      <strong>{key}:</strong> {String(value)}
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function SensorChip({
  icon,
  label,
  active,
  stable,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  stable?: boolean;
}) {
  const colorClass = active
    ? stable === false
      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300"
      : "bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-300"
    : "bg-transparent text-muted-foreground border-border";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${colorClass} ${
        active ? "font-mono" : ""
      }`}
    >
      {icon}
      {label}
    </span>
  );
}
