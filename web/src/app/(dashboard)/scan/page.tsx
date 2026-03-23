"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Typography from "@mui/material/Typography";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Skeleton from "@mui/material/Skeleton";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";
import ScaleIcon from "@mui/icons-material/Scale";
import NfcIcon from "@mui/icons-material/Nfc";
import ThermostatIcon from "@mui/icons-material/Thermostat";
import { PageHeader } from "@/components/layout/page-header";
import {
  listMyScanSessions,
  abandonSession,
} from "@/lib/actions/scan";

export default function ScanPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const result = await listMyScanSessions({ limit: 20, includeRecent: true });
      if (mounted && result.data) {
        setSessions(result.data);
      }
      if (mounted) setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const handleAbandon = useCallback(
    async (sessionId: string) => {
      await abandonSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    },
    []
  );

  const visibleSessions = showCompleted
    ? sessions
    : sessions.filter((s: any) => s.status !== "resolved");
  const resolvedCount = sessions.filter((s: any) => s.status === "resolved").length;

  return (
    <Box>
      <PageHeader
        title="Scan & Intake"
        description="Add spools to your inventory"
      />

      {/* ── Start Manual Scan ────────────────────────────────────────── */}
      <Button
        variant="outlined"
        fullWidth
        size="large"
        startIcon={<AddCircleOutlineIcon />}
        onClick={() => router.push("/scan/new")}
        sx={{ mb: 3, textTransform: "none" }}
      >
        Start Manual Scan
      </Button>

      {/* ── Loading ──────────────────────────────────────────────────── */}
      {loading && (
        <Stack spacing={1.5}>
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={80} />
          ))}
        </Stack>
      )}

      {/* ── Filter ──────────────────────────────────────────────────── */}
      {!loading && resolvedCount > 0 && (
        <Box sx={{ mb: 1.5 }}>
          <Chip
            label={showCompleted ? `Hide completed (${resolvedCount})` : `Show completed (${resolvedCount})`}
            onClick={() => setShowCompleted(!showCompleted)}
            variant={showCompleted ? "filled" : "outlined"}
            size="small"
            color={showCompleted ? "success" : "default"}
          />
        </Box>
      )}

      {/* ── Sessions List ────────────────────────────────────────────── */}
      {!loading && visibleSessions.length > 0 && (
        <Stack spacing={1}>
          {visibleSessions.map((session: any) => (
            <SessionCard
              key={session.id}
              session={session}
              onClick={() => router.push(`/scan/${session.id}`)}
              onDelete={session.status === "active" ? () => handleAbandon(session.id) : undefined}
            />
          ))}
        </Stack>
      )}

      {/* ── Empty State ──────────────────────────────────────────────── */}
      {!loading && visibleSessions.length === 0 && (
        <Card sx={{ textAlign: "center", py: 6 }}>
          <CardContent>
            <QrCodeScannerIcon
              sx={{ fontSize: 48, color: "text.disabled", mb: 2 }}
            />
            <Typography variant="h6" gutterBottom>
              No Recent Scans
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Start a manual scan or use your scan station to add items to your inventory.
            </Typography>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

// ── Session Card ──────────────────────────────────────────────────────────────

function SessionCard({
  session,
  onClick,
  onDelete,
}: {
  session: any;
  onClick: () => void;
  onDelete?: () => void;
}) {
  const isIdentified = !!session.matchedProductId;
  const isResolved = session.status === "resolved";
  const parsed = session.nfcParsedData as Record<string, any> | null;

  // Build a display name from whatever we know — prefer parsed NFC data over raw UID
  const displayName = isIdentified
    ? `${session.brandName ? session.brandName + " " : ""}${session.productName}`
    : parsed?.name
      ? `${parsed.material ? parsed.material + " — " : ""}${parsed.name}`
      : parsed?.material
        ? parsed.material
        : "Unidentified item";

  // Build a subtitle from parsed NFC details
  const details: string[] = [];
  if (session.bestWeightG != null) details.push(`${session.bestWeightG.toFixed(1)}g`);
  if (session.bestHeightMm != null) details.push(`${session.bestHeightMm.toFixed(0)}mm`);
  if (parsed?.nozzleTempMin) details.push(`${parsed.nozzleTempMin}–${parsed.nozzleTempMax}°C`);
  if (session.nfcTagFormat) details.push(session.nfcTagFormat.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase()));
  else if (session.nfcUid) details.push("NFC");

  return (
    <Card
      variant="outlined"
      sx={{
        position: "relative",
        opacity: isResolved ? 0.7 : 1,
      }}
    >
      <CardActionArea onClick={onClick}>
        <CardContent sx={{ py: 1.5, pr: onDelete ? 5 : 2, "&:last-child": { pb: 1.5 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            {/* Color swatch or placeholder */}
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                bgcolor: session.bestColorHex ?? "grey.200",
                border: 1,
                borderColor: "divider",
                flexShrink: 0,
              }}
            />

            {/* Info */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Typography variant="body2" fontWeight={600} noWrap>
                  {displayName}
                </Typography>
                {isResolved && (
                  <Chip icon={<CheckCircleIcon />} label="Done" size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: "0.65rem" }} />
                )}
              </Box>
              <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mt: 0.25 }}>
                {session.bestWeightG != null && (
                  <Chip icon={<ScaleIcon sx={{ fontSize: "14px !important" }} />} label={`${session.bestWeightG.toFixed(1)}g`} size="small" variant="outlined" sx={{ height: 22, fontSize: "0.7rem" }} />
                )}
                {session.bestHeightMm != null && (
                  <Chip label={`${session.bestHeightMm.toFixed(0)}mm`} size="small" variant="outlined" sx={{ height: 22, fontSize: "0.7rem" }} />
                )}
                {parsed?.nozzleTempMin && (
                  <Chip icon={<ThermostatIcon sx={{ fontSize: "14px !important" }} />} label={`${parsed.nozzleTempMin}–${parsed.nozzleTempMax}°C`} size="small" variant="outlined" sx={{ height: 22, fontSize: "0.7rem" }} />
                )}
                {session.nfcUid && session.nfcTagFormat && session.nfcTagFormat !== "unknown" && (
                  <Chip icon={<NfcIcon sx={{ fontSize: "14px !important" }} />}
                    label={session.nfcTagFormat.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                    size="small" variant="outlined" color="primary" sx={{ height: 22, fontSize: "0.7rem" }}
                  />
                )}
              </Box>
            </Box>

            {/* Timestamp */}
            <Typography variant="caption" color="text.disabled" sx={{ flexShrink: 0 }}>
              {new Date(session.createdAt).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Typography>
          </Box>
        </CardContent>
      </CardActionArea>

      {onDelete && (
        <Tooltip title="Delete">
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            sx={{
              position: "absolute",
              top: "50%",
              right: 8,
              transform: "translateY(-50%)",
              color: "text.disabled",
              "&:hover": { color: "error.main" },
            }}
          >
            <DeleteOutlineIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      )}
    </Card>
  );
}
