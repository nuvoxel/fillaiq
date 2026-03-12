import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { db } from "@/db";
import { printJobs } from "@/db/schema/user-library";
import { scanStations } from "@/db/schema/scan-stations";
import { eq, and, isNotNull } from "drizzle-orm";

/**
 * GET /api/v1/print/jobs?status=pending
 *
 * Called by scan stations to poll for pending print jobs.
 * Authenticates via X-Device-Token header (from pairing).
 * Returns pending jobs for this station.
 */
export async function GET(request: NextRequest) {
  const deviceToken = request.headers.get("x-device-token");
  if (!deviceToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [station] = await db
    .select()
    .from(scanStations)
    .where(
      and(
        eq(scanStations.deviceToken, deviceToken),
        isNotNull(scanStations.userId)
      )
    );

  if (!station) {
    return NextResponse.json(
      { error: "Invalid token or device not paired" },
      { status: 401 }
    );
  }

  // Verify hardware identity if provided
  const deviceSecret = request.headers.get("x-device-secret");
  if (station.deviceSecret && deviceSecret) {
    const secretHash = createHash("sha256").update(deviceSecret).digest("hex");
    if (station.deviceSecret !== secretHash) {
      return NextResponse.json(
        { error: "Device identity mismatch" },
        { status: 403 }
      );
    }
  }

  // Fetch pending jobs for this station (or unassigned jobs for this user)
  const jobs = await db
    .select()
    .from(printJobs)
    .where(
      and(
        eq(printJobs.userId, station.userId!),
        eq(printJobs.status, "pending")
      )
    );

  // Filter: return jobs assigned to this station, or unassigned ones
  const relevantJobs = jobs.filter(
    (j) => !j.stationId || j.stationId === station.id
  );

  return NextResponse.json({ jobs: relevantJobs });
}

/**
 * PATCH /api/v1/print/jobs
 *
 * Called by scan station to update job status.
 * Body: { jobId, status, errorMessage? }
 */
export async function PATCH(request: NextRequest) {
  const deviceToken = request.headers.get("x-device-token");
  if (!deviceToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [station] = await db
    .select()
    .from(scanStations)
    .where(
      and(
        eq(scanStations.deviceToken, deviceToken),
        isNotNull(scanStations.userId)
      )
    );

  if (!station) {
    return NextResponse.json(
      { error: "Invalid token or device not paired" },
      { status: 401 }
    );
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { jobId, status, errorMessage } = body;
  if (!jobId || !status) {
    return NextResponse.json(
      { error: "jobId and status are required" },
      { status: 400 }
    );
  }

  const validStatuses = ["sent", "printing", "done", "failed"];
  if (!validStatuses.includes(status)) {
    return NextResponse.json(
      { error: `Invalid status. Must be one of: ${validStatuses.join(", ")}` },
      { status: 400 }
    );
  }

  const [job] = await db
    .select()
    .from(printJobs)
    .where(eq(printJobs.id, jobId));

  if (!job || job.userId !== station.userId) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  const updates: Record<string, any> = { status };
  if (errorMessage) updates.errorMessage = errorMessage;
  if (status === "done") updates.printedAt = new Date();

  const [updated] = await db
    .update(printJobs)
    .set(updates)
    .where(eq(printJobs.id, jobId))
    .returning();

  return NextResponse.json({ job: updated });
}
