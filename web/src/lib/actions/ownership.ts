import { db } from "@/db";
import { eq } from "drizzle-orm";
import { racks, shelves, bays, slots } from "@/db/schema/hardware";
import { spools } from "@/db/schema/user-library";

export async function getOwnerByRackId(
  rackId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: racks.userId })
    .from(racks)
    .where(eq(racks.id, rackId));
  return row?.userId ?? null;
}

export async function getOwnerByShelfId(
  shelfId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: racks.userId })
    .from(shelves)
    .innerJoin(racks, eq(shelves.rackId, racks.id))
    .where(eq(shelves.id, shelfId));
  return row?.userId ?? null;
}

export async function getOwnerByBayId(
  bayId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: racks.userId })
    .from(bays)
    .innerJoin(shelves, eq(bays.shelfId, shelves.id))
    .innerJoin(racks, eq(shelves.rackId, racks.id))
    .where(eq(bays.id, bayId));
  return row?.userId ?? null;
}

export async function getOwnerBySlotId(
  slotId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: racks.userId })
    .from(slots)
    .innerJoin(bays, eq(slots.bayId, bays.id))
    .innerJoin(shelves, eq(bays.shelfId, shelves.id))
    .innerJoin(racks, eq(shelves.rackId, racks.id))
    .where(eq(slots.id, slotId));
  return row?.userId ?? null;
}

export async function getOwnerBySpoolId(
  spoolId: string
): Promise<string | null> {
  const [row] = await db
    .select({ userId: spools.userId })
    .from(spools)
    .where(eq(spools.id, spoolId));
  return row?.userId ?? null;
}
