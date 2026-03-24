"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, HelpCircle, CheckCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Card, CardContent } from "@/components/ui/card";
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
      <div>
        <Skeleton className="h-12 mb-2 rounded-lg" />
        <Skeleton className="h-48 mb-2 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div>
        <Button variant="ghost" onClick={() => router.push("/scan")} className="mb-2">
          <ArrowLeft className="size-4 mr-1" />
          Back to Scans
        </Button>
        <Card className="text-center py-6">
          <CardContent className="flex flex-col items-center gap-2">
            <HelpCircle className="size-12 text-muted-foreground" />
            <h3 className="text-lg font-semibold">Session Not Found</h3>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
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
    <div>
      <Button variant="ghost" onClick={() => router.push("/scan")} className="mb-1">
        <ArrowLeft className="size-4 mr-1" />
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
        <Alert className="bg-green-50 border-green-200">
          <CheckCircle className="size-4 text-green-600" />
          <AlertTitle className="text-green-800">Complete</AlertTitle>
          <AlertDescription className="text-green-700">
            This session has been resolved and saved to inventory.
          </AlertDescription>
        </Alert>
      ) : (
        <IntakeForm stationData={stationData} />
      )}
    </div>
  );
}
