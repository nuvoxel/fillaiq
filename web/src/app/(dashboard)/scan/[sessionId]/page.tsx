"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import Typography from "@mui/material/Typography";
import Skeleton from "@mui/material/Skeleton";
import Button from "@mui/material/Button";
import Alert from "@mui/material/Alert";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { PageHeader } from "@/components/layout/page-header";
import { IntakeForm, type StationData } from "@/components/scan/intake-form";

type SessionResponse = {
  session: any;
  events: any[];
  matchedProduct: any;
};

export default function ScanSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const [data, setData] = useState<SessionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSession = useCallback(async () => {
    try {
      const res = await fetch(`/api/v1/scan/session/${sessionId}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || "Session not found");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={48} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={200} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={300} />
      </Box>
    );
  }

  if (error && !data) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => router.push("/scan")} sx={{ mb: 2 }}>
          Back to Scans
        </Button>
        <Card sx={{ textAlign: "center", py: 6 }}>
          <CardContent>
            <HelpOutlineIcon sx={{ fontSize: 48, color: "text.disabled", mb: 2 }} />
            <Typography variant="h6" gutterBottom>Session Not Found</Typography>
            <Typography variant="body2" color="text.secondary">{error}</Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  if (!data) return null;

  const { session, events, matchedProduct } = data;
  const isResolved = session.status === "resolved";

  // Find the event with NFC raw data and spectral data
  const nfcEvent = events.find((e: any) => e.nfcRawData);
  const spectralEvent = events.find((e: any) => e.spectralData);

  // Build station data for the intake form
  const stationData: StationData = {
    sessionId: session.id,
    weightG: session.bestWeightG,
    colorHex: session.bestColorHex,
    colorLabL: session.bestColorLabL,
    colorLabA: session.bestColorLabA,
    colorLabB: session.bestColorLabB,
    heightMm: session.bestHeightMm,
    nfcUid: session.nfcUid,
    nfcTagFormat: session.nfcTagFormat,
    nfcParsedData: session.nfcParsedData as Record<string, any> | null,
    nfcRawData: nfcEvent?.nfcRawData ?? null,
    nfcSectorsRead: nfcEvent?.nfcSectorsRead ?? null,
    spectralData: spectralEvent?.spectralData as Record<string, any> | null,
    matchedProduct: matchedProduct ?? undefined,
  };

  return (
    <Box>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => router.push("/scan")}
        sx={{ mb: 1, textTransform: "none" }}
      >
        Back to Scans
      </Button>

      <PageHeader
        title={
          isResolved
            ? "Scan Complete"
            : matchedProduct
              ? matchedProduct.name ?? "Identified Scan"
              : "New Scan"
        }
        description={
          isResolved
            ? "This scan has been saved to your inventory."
            : "Review scan data and add to inventory."
        }
      />

      {isResolved ? (
        <Alert severity="success" variant="filled" icon={<CheckCircleIcon />}>
          This session has been resolved and saved to inventory.
        </Alert>
      ) : (
        <IntakeForm stationData={stationData} />
      )}
    </Box>
  );
}
