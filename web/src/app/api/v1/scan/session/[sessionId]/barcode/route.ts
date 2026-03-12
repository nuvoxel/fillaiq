import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scanSessions } from "@/db/schema/scan-stations";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "@/lib/actions/auth";
import { addBarcodeToSession } from "@/lib/services/scan-session";

/**
 * POST /api/v1/scan/session/[sessionId]/barcode
 *
 * Links a phone-scanned barcode to an active scan session,
 * then re-runs catalog matching.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const auth = await requireAuth();
  if (auth.error !== null) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { sessionId } = await params;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { barcodeValue, barcodeFormat } = body;
  if (!barcodeValue) {
    return NextResponse.json(
      { error: "barcodeValue is required" },
      { status: 400 }
    );
  }

  // Verify session exists and belongs to user
  const [session] = await db
    .select()
    .from(scanSessions)
    .where(eq(scanSessions.id, sessionId));

  if (!session) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.status !== "active") {
    return NextResponse.json(
      { error: "Session is not active" },
      { status: 409 }
    );
  }

  const updated = await addBarcodeToSession(
    sessionId,
    barcodeValue,
    barcodeFormat ?? null
  );

  return NextResponse.json({
    sessionId: updated.id,
    barcodeValue: updated.barcodeValue,
    matchedProductId: updated.matchedProductId,
    matchConfidence: updated.matchConfidence,
    matchMethod: updated.matchMethod,
  });
}
