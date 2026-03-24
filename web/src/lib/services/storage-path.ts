/**
 * Builds a human-readable path for a storage slot.
 *
 * The storage hierarchy is: Zone → Rack → Shelf → Bay → Slot.
 * This helper joins the slot back to its zone via the FK chain and
 * returns a slash-separated label string, e.g. "Workshop / Rack A / Shelf 2 / Bay 3".
 */

import { db } from "@/db";
import { slots, bays, shelves, racks, zones } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function getSlotPath(slotId: string): Promise<string | null> {
  const rows = await db
    .select({
      slotLabel: slots.label,
      slotPosition: slots.position,
      bayLabel: bays.label,
      bayPosition: bays.position,
      shelfLabel: shelves.label,
      shelfPosition: shelves.position,
      rackName: racks.name,
      zoneName: zones.name,
    })
    .from(slots)
    .innerJoin(bays, eq(slots.bayId, bays.id))
    .innerJoin(shelves, eq(bays.shelfId, shelves.id))
    .innerJoin(racks, eq(shelves.rackId, racks.id))
    .innerJoin(zones, eq(racks.zoneId, zones.id))
    .where(eq(slots.id, slotId))
    .limit(1);

  if (rows.length === 0) return null;

  const r = rows[0];

  // Build segments, using labels where available, falling back to position numbers
  const segments: string[] = [];

  if (r.zoneName) segments.push(r.zoneName);
  if (r.rackName) segments.push(r.rackName);
  segments.push(r.shelfLabel ?? `Shelf ${r.shelfPosition}`);
  segments.push(r.bayLabel ?? `Bay ${r.bayPosition}`);

  // Only append slot label if there are multiple slots per bay (i.e. label is meaningful)
  if (r.slotLabel) {
    segments.push(r.slotLabel);
  }

  return segments.join(" / ");
}
