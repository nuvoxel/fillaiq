"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardActionArea from "@mui/material/CardActionArea";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Chip from "@mui/material/Chip";
import Stack from "@mui/material/Stack";
import Button from "@mui/material/Button";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Alert from "@mui/material/Alert";
import ScaleIcon from "@mui/icons-material/Scale";
import NfcIcon from "@mui/icons-material/Nfc";
import PaletteIcon from "@mui/icons-material/Palette";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import CloseIcon from "@mui/icons-material/Close";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import QrCodeScannerIcon from "@mui/icons-material/QrCodeScanner";

type ScanSession = {
  id: string;
  stationId: string;
  status: string;
  bestWeightG: number | null;
  bestHeightMm: number | null;
  bestColorHex: string | null;
  nfcUid: string | null;
  nfcTagFormat: string | null;
  nfcParsedData: Record<string, any> | null;
  matchedProductId: string | null;
  matchConfidence: number | null;
  matchMethod: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function ScanQueuePage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<ScanSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissing, setDismissing] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);

  const fetchSessions = useCallback(async () => {
    try {
      const res = await fetch("/api/v1/scan/sessions");
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      if (!res.ok) {
        setError("Failed to load scan sessions");
        return;
      }
      const data: ScanSession[] = await res.json();
      // Filter out abandoned sessions
      setSessions(data.filter((s) => s.status !== "abandoned"));
    } catch {
      setError("Failed to load scan sessions");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  const handleDismiss = async (sessionId: string) => {
    setDismissing(sessionId);
    try {
      const res = await fetch(`/api/v1/scan/session/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setSessions((prev) => prev.filter((s) => s.id !== sessionId));
      }
    } catch {
      // Ignore
    } finally {
      setDismissing(null);
    }
  };

  const handleClearAll = async () => {
    if (!confirm("Dismiss all scan sessions?")) return;
    setClearingAll(true);
    try {
      await Promise.all(
        sessions.map((s) =>
          fetch(`/api/v1/scan/session/${s.id}`, { method: "DELETE" })
        )
      );
      setSessions([]);
    } catch {
      // Ignore
    } finally {
      setClearingAll(false);
    }
  };

  const unidentifiedCount = sessions.filter((s) => !s.matchedProductId).length;

  if (loading) {
    return (
      <Box sx={{ minHeight: "100vh", bgcolor: "background.default", p: 2 }}>
        <Box sx={{ maxWidth: 600, mx: "auto" }}>
          <Skeleton variant="rounded" height={64} sx={{ mb: 2 }} />
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" height={100} sx={{ mb: 1.5 }} />
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", pb: 4 }}>
      {/* Header */}
      <Box
        sx={{
          bgcolor: "primary.main",
          color: "white",
          px: 2,
          py: 2.5,
        }}
      >
        <Box sx={{ maxWidth: 600, mx: "auto" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                bgcolor: "rgba(255,255,255,0.2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <QrCodeScannerIcon sx={{ fontSize: 22 }} />
            </Box>
            <Box sx={{ flex: 1 }}>
              <Typography variant="subtitle1" fontWeight={600}>
                Scan Queue
              </Typography>
              <Typography variant="caption" sx={{ opacity: 0.85 }}>
                {sessions.length === 0
                  ? "No recent scans"
                  : `${sessions.length} recent scan${sessions.length !== 1 ? "s" : ""}${unidentifiedCount > 0 ? ` \u00b7 ${unidentifiedCount} need attention` : ""}`}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      <Box sx={{ maxWidth: 600, mx: "auto", px: 2, mt: 2 }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {/* Clear All button */}
        {sessions.length > 1 && (
          <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1.5 }}>
            <Button
              size="small"
              color="error"
              startIcon={<DeleteSweepIcon />}
              onClick={handleClearAll}
              disabled={clearingAll}
              sx={{ textTransform: "none" }}
            >
              {clearingAll ? "Clearing..." : "Clear All"}
            </Button>
          </Box>
        )}

        {/* Empty state */}
        {sessions.length === 0 && !error && (
          <Card sx={{ textAlign: "center", py: 6 }}>
            <CardContent>
              <QrCodeScannerIcon
                sx={{ fontSize: 48, color: "text.disabled", mb: 2 }}
              />
              <Typography variant="h6" gutterBottom>
                No Recent Scans
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Scan sessions from your devices will appear here. Scans from the last 24 hours are shown.
              </Typography>
            </CardContent>
          </Card>
        )}

        {/* Session cards */}
        <Stack spacing={1.5}>
          {sessions.map((session) => {
            const isIdentified = !!session.matchedProductId;
            const parsed = session.nfcParsedData;

            return (
              <Card
                key={session.id}
                sx={{
                  position: "relative",
                  border: isIdentified ? undefined : 2,
                  borderColor: isIdentified ? undefined : "warning.main",
                }}
              >
                {/* Dismiss button */}
                <Tooltip title="Dismiss">
                  <IconButton
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDismiss(session.id);
                    }}
                    disabled={dismissing === session.id}
                    sx={{
                      position: "absolute",
                      top: 8,
                      right: 8,
                      zIndex: 1,
                      bgcolor: "background.paper",
                      boxShadow: 1,
                      "&:hover": { bgcolor: "error.light", color: "white" },
                    }}
                  >
                    <CloseIcon sx={{ fontSize: 16 }} />
                  </IconButton>
                </Tooltip>

                <CardActionArea
                  onClick={() => router.push(`/scan/${session.id}`)}
                >
                  <CardContent sx={{ pr: 5 }}>
                    {/* Status + timestamp row */}
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      {isIdentified ? (
                        <Chip
                          icon={<CheckCircleIcon />}
                          label={`Identified${session.matchConfidence != null ? ` (${Math.round(session.matchConfidence * 100)}%)` : ""}`}
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      ) : (
                        <Chip
                          icon={<HelpOutlineIcon />}
                          label="Needs Identification"
                          size="small"
                          color="warning"
                        />
                      )}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ ml: "auto" }}
                      >
                        {new Date(session.createdAt).toLocaleString()}
                      </Typography>
                    </Box>

                    {/* Data chips */}
                    <Box
                      sx={{
                        display: "flex",
                        gap: 0.75,
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      {session.bestWeightG != null && (
                        <Chip
                          icon={<ScaleIcon sx={{ fontSize: "16px !important" }} />}
                          label={`${session.bestWeightG.toFixed(1)}g`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      {session.bestColorHex && (
                        <Chip
                          icon={
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: "50%",
                                bgcolor: session.bestColorHex,
                                border: 1,
                                borderColor: "divider",
                                flexShrink: 0,
                              }}
                            />
                          }
                          label={session.bestColorHex}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      {session.nfcUid && (
                        <Chip
                          icon={<NfcIcon sx={{ fontSize: "16px !important" }} />}
                          label={
                            session.nfcTagFormat
                              ? session.nfcTagFormat
                                  .replace(/_/g, " ")
                                  .replace(/\b\w/g, (c) => c.toUpperCase())
                              : "NFC Tag"
                          }
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      )}
                      {session.bestHeightMm != null && (
                        <Chip
                          label={`${session.bestHeightMm.toFixed(0)}mm`}
                          size="small"
                          variant="outlined"
                        />
                      )}
                      {parsed?.material && (
                        <Chip
                          label={parsed.material}
                          size="small"
                          variant="outlined"
                          color="secondary"
                        />
                      )}
                      {session.matchMethod && (
                        <Chip
                          label={`via ${session.matchMethod}`}
                          size="small"
                          variant="outlined"
                          color="success"
                        />
                      )}
                    </Box>
                  </CardContent>
                </CardActionArea>
              </Card>
            );
          })}
        </Stack>
      </Box>
    </Box>
  );
}
