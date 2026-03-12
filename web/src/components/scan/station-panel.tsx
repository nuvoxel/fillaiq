"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Chip from "@mui/material/Chip";
import LinearProgress from "@mui/material/LinearProgress";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Stack from "@mui/material/Stack";
import Fade from "@mui/material/Fade";
import ScaleIcon from "@mui/icons-material/Scale";
import NfcIcon from "@mui/icons-material/Nfc";
import PaletteIcon from "@mui/icons-material/Palette";
import HeightIcon from "@mui/icons-material/Height";
import WifiIcon from "@mui/icons-material/Wifi";
import WifiOffIcon from "@mui/icons-material/WifiOff";
import SensorsIcon from "@mui/icons-material/Sensors";
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
        // Auto-select first online station
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

        // Prefer session-level aggregated data when available
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
      variant="outlined"
      sx={{
        borderColor: selectedStation?.isOnline ? "success.main" : "divider",
        borderWidth: selectedStation?.isOnline ? 2 : 1,
      }}
    >
      <CardContent sx={{ pb: "12px !important" }}>
        {/* Station selector */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
          <SensorsIcon
            color={selectedStation?.isOnline ? "success" : "disabled"}
            fontSize="small"
          />
          <Typography variant="subtitle2" sx={{ flex: 1 }}>
            Scan Station
          </Typography>
          {stations.length > 1 ? (
            <FormControl size="small" sx={{ minWidth: 160 }}>
              <Select
                value={selectedStationId}
                onChange={(e) => handleStationSelect(e.target.value)}
                displayEmpty
              >
                <MenuItem value="" disabled>
                  Select station
                </MenuItem>
                {stations.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      {s.isOnline ? (
                        <WifiIcon fontSize="small" color="success" />
                      ) : (
                        <WifiOffIcon fontSize="small" color="disabled" />
                      )}
                      {s.name}
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          ) : (
            <Chip
              icon={
                selectedStation?.isOnline ? (
                  <WifiIcon fontSize="small" />
                ) : (
                  <WifiOffIcon fontSize="small" />
                )
              }
              label={selectedStation?.name ?? "No station"}
              size="small"
              color={selectedStation?.isOnline ? "success" : "default"}
              variant="outlined"
            />
          )}
        </Box>

        {/* Polling indicator */}
        {polling && !currentScan && (
          <Box sx={{ mb: 1 }}>
            <Typography variant="caption" color="text.secondary">
              Waiting for spool on station...
            </Typography>
            <LinearProgress
              sx={{ mt: 0.5, borderRadius: 1 }}
              color="primary"
            />
          </Box>
        )}

        {/* Sensor readings */}
        {currentScan && (
          <Fade in>
            <Stack spacing={1}>
              <Typography variant="caption" color="text.secondary" fontWeight={600}>
                STATION READINGS
              </Typography>

              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
                {/* Weight */}
                <SensorChip
                  icon={<ScaleIcon fontSize="small" />}
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
                  icon={<NfcIcon fontSize="small" />}
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
                      <Box
                        sx={{
                          width: 16,
                          height: 16,
                          borderRadius: "50%",
                          bgcolor: currentScan.colorHex,
                          border: "1px solid",
                          borderColor: "divider",
                        }}
                      />
                    ) : (
                      <PaletteIcon fontSize="small" />
                    )
                  }
                  label={currentScan.colorHex ?? "No color"}
                  active={currentScan.colorHex != null}
                />

                {/* Height */}
                <SensorChip
                  icon={<HeightIcon fontSize="small" />}
                  label={
                    currentScan.heightMm != null
                      ? `${currentScan.heightMm.toFixed(0)}mm`
                      : "No height"
                  }
                  active={currentScan.heightMm != null}
                />
              </Box>

              {/* NFC parsed info */}
              {currentScan.nfcParsedData && (
                <Box
                  sx={{
                    p: 1,
                    bgcolor: "action.hover",
                    borderRadius: 1,
                    fontFamily: "monospace",
                    fontSize: "0.75rem",
                    maxHeight: 80,
                    overflow: "auto",
                  }}
                >
                  {Object.entries(currentScan.nfcParsedData).map(
                    ([key, value]) => (
                      <Box key={key}>
                        <strong>{key}:</strong> {String(value)}
                      </Box>
                    )
                  )}
                </Box>
              )}
            </Stack>
          </Fade>
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
  return (
    <Chip
      icon={icon as any}
      label={label}
      size="small"
      variant={active ? "filled" : "outlined"}
      color={active ? (stable === false ? "warning" : "success") : "default"}
      sx={{ fontFamily: active ? "monospace" : undefined }}
    />
  );
}
