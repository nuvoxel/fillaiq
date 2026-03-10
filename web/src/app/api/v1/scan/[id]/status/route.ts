import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { scanEvents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getApiKeyAuth } from "@/lib/actions/auth";

/**
 * GET /api/v1/scan/[id]/status
 *
 * Poll for identification result of a scan event.
 * Called by ESP32 after initial POST.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await getApiKeyAuth();
  if (!auth) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const [event] = await db
    .select()
    .from(scanEvents)
    .where(eq(scanEvents.id, id));

  if (!event) {
    return NextResponse.json({ error: "Scan not found" }, { status: 404 });
  }

  return NextResponse.json({
    scanId: event.id,
    identified: event.identified ?? false,
    confidence: event.confidence ?? 0,
    itemType: event.identifiedType ?? null,
    itemName: null, // TODO: resolve from identifiedProductId/identifiedUserItemId
    suggestion: null,
    needsCamera: !event.identified && !event.userConfirmed,
  });
}
