/**
 * Print job service — extracted from PATCH /api/v1/print/jobs.
 */

import { db } from "@/db";
import { printJobs } from "@/db/schema/user-library";
import { eq } from "drizzle-orm";

/**
 * Update print job status (called from device via MQTT or HTTP).
 */
export async function updatePrintJobStatus(
  jobId: string,
  status: string,
  errorMessage?: string
) {
  const validStatuses = ["sent", "printing", "done", "failed"];
  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  const updates: Record<string, any> = { status };
  if (errorMessage) updates.errorMessage = errorMessage;
  if (status === "done") updates.printedAt = new Date();

  const [updated] = await db
    .update(printJobs)
    .set(updates)
    .where(eq(printJobs.id, jobId))
    .returning();

  return updated;
}
