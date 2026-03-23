/**
 * Environment data service — extracted from POST /api/v1/environment.
 */

import { db } from "@/db";
import { environmentalReadings } from "@/db/schema/events";

/**
 * Insert an environmental reading for a station.
 */
export async function insertEnvironmentalReading(
  stationId: string,
  data: {
    temperatureC?: number;
    humidity?: number;
    pressureHPa?: number;
  }
) {
  await db.insert(environmentalReadings).values({
    stationId,
    temperatureC: data.temperatureC ?? null,
    humidity: data.humidity ?? null,
    pressureHPa: data.pressureHPa ?? null,
  });
}
