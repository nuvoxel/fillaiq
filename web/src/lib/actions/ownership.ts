import { db } from "@/db";
import { eq } from "drizzle-orm";
import { zones, racks, shelves, bays, slots } from "@/db/schema/storage";
import { userItems } from "@/db/schema/user-library";

export async function getOwnerByZoneId(
  zoneId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: zones.userId })
    .from(zones)
    .where(eq(zones.id, zoneId));
  return row?.userId ?? null;
}

export async function getOwnerByRackId(
  rackId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: zones.userId })
    .from(racks)
    .innerJoin(zones, eq(racks.zoneId, zones.id))
    .where(eq(racks.id, rackId));
  return row?.userId ?? null;
}

export async function getOwnerByShelfId(
  shelfId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: zones.userId })
    .from(shelves)
    .innerJoin(racks, eq(shelves.rackId, racks.id))
    .innerJoin(zones, eq(racks.zoneId, zones.id))
    .where(eq(shelves.id, shelfId));
  return row?.userId ?? null;
}

export async function getOwnerByBayId(
  bayId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: zones.userId })
    .from(bays)
    .innerJoin(shelves, eq(bays.shelfId, shelves.id))
    .innerJoin(racks, eq(shelves.rackId, racks.id))
    .innerJoin(zones, eq(racks.zoneId, zones.id))
    .where(eq(bays.id, bayId));
  return row?.userId ?? null;
}

export async function getOwnerBySlotId(
  slotId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: zones.userId })
    .from(slots)
    .innerJoin(bays, eq(slots.bayId, bays.id))
    .innerJoin(shelves, eq(bays.shelfId, shelves.id))
    .innerJoin(racks, eq(shelves.rackId, racks.id))
    .innerJoin(zones, eq(racks.zoneId, zones.id))
    .where(eq(slots.id, slotId));
  return row?.userId ?? null;
}

export async function getOwnerByUserItemId(
  userItemId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: userItems.userId })
    .from(userItems)
    .where(eq(userItems.id, userItemId));
  return row?.userId ?? null;
}
