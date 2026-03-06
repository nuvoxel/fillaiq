import { faker } from "@faker-js/faker";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import * as schema from "../src/db/schema";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

const USER_ID = "4a80cd34-fb8e-4582-9d41-2ebfed6badde"; // Mike DeLuca

// ─── Realistic filament data ───────────────────────────────────────────────

const BRANDS_DATA = [
  { name: "Bambu Lab", slug: "bambu-lab", website: "https://bambulab.com" },
  { name: "Hatchbox", slug: "hatchbox", website: "https://hatchbox3d.com" },
  { name: "Polymaker", slug: "polymaker", website: "https://polymaker.com" },
  { name: "Prusament", slug: "prusament", website: "https://prusament.com" },
  { name: "eSUN", slug: "esun", website: "https://esun3d.com" },
  { name: "Overture", slug: "overture", website: "https://overture3d.com" },
  { name: "Inland", slug: "inland", website: "https://inland3d.com" },
];

const MATERIALS_DATA = [
  { name: "PLA", abbreviation: "PLA", category: "Standard", density: 1.24, materialClass: "fff" as const, nozzleMin: 190, nozzleMax: 220, bedMin: 45, bedMax: 60, dryTemp: 45, dryTime: 240, hygroscopic: false },
  { name: "PLA+", abbreviation: "PLA+", category: "Enhanced", density: 1.24, materialClass: "fff" as const, nozzleMin: 200, nozzleMax: 230, bedMin: 50, bedMax: 65, dryTemp: 45, dryTime: 240, hygroscopic: false },
  { name: "PETG", abbreviation: "PETG", category: "Standard", density: 1.27, materialClass: "fff" as const, nozzleMin: 220, nozzleMax: 250, bedMin: 70, bedMax: 85, dryTemp: 65, dryTime: 300, hygroscopic: true },
  { name: "ABS", abbreviation: "ABS", category: "Standard", density: 1.04, materialClass: "fff" as const, nozzleMin: 230, nozzleMax: 260, bedMin: 95, bedMax: 110, dryTemp: 60, dryTime: 240, hygroscopic: true },
  { name: "TPU", abbreviation: "TPU", category: "Flexible", density: 1.21, materialClass: "fff" as const, nozzleMin: 210, nozzleMax: 240, bedMin: 40, bedMax: 60, dryTemp: 50, dryTime: 300, hygroscopic: true },
  { name: "ASA", abbreviation: "ASA", category: "Engineering", density: 1.07, materialClass: "fff" as const, nozzleMin: 240, nozzleMax: 260, bedMin: 95, bedMax: 110, dryTemp: 60, dryTime: 240, hygroscopic: true },
  { name: "Nylon (PA6)", abbreviation: "PA6", category: "Engineering", density: 1.14, materialClass: "fff" as const, nozzleMin: 250, nozzleMax: 280, bedMin: 80, bedMax: 100, dryTemp: 80, dryTime: 480, hygroscopic: true },
  { name: "PC", abbreviation: "PC", category: "Engineering", density: 1.20, materialClass: "fff" as const, nozzleMin: 260, nozzleMax: 300, bedMin: 100, bedMax: 120, dryTemp: 80, dryTime: 360, hygroscopic: true },
];

const COLORS = [
  { name: "White", hex: "#FFFFFF", r: 255, g: 255, b: 255 },
  { name: "Black", hex: "#1A1A1A", r: 26, g: 26, b: 26 },
  { name: "Red", hex: "#E53935", r: 229, g: 57, b: 53 },
  { name: "Blue", hex: "#1E88E5", r: 30, g: 136, b: 229 },
  { name: "Green", hex: "#43A047", r: 67, g: 160, b: 71 },
  { name: "Yellow", hex: "#FDD835", r: 253, g: 216, b: 53 },
  { name: "Orange", hex: "#FF5C2E", r: 255, g: 92, b: 46 },
  { name: "Grey", hex: "#757575", r: 117, g: 117, b: 117 },
  { name: "Natural", hex: "#F5F0E8", r: 245, g: 240, b: 232 },
  { name: "Purple", hex: "#8E24AA", r: 142, g: 36, b: 170 },
  { name: "Jade Green", hex: "#00897B", r: 0, g: 137, b: 123 },
  { name: "Light Blue", hex: "#42A5F5", r: 66, g: 165, b: 245 },
];

const AUDIT_RESOURCES = ["spool", "rack", "filament", "brand", "user"] as const;
const AUDIT_ACTIONS = ["create", "update", "delete"] as const;

async function seed() {
  console.log("Seeding database...\n");

  // ── Brands ─────────────────────────────────────────────────────────────
  console.log("Creating brands...");
  const brandRows = await db
    .insert(schema.brands)
    .values(
      BRANDS_DATA.map((b) => ({
        name: b.name,
        slug: b.slug,
        website: b.website,
        validationStatus: "validated" as const,
      }))
    )
    .returning();
  console.log(`  ${brandRows.length} brands`);

  // ── Materials ──────────────────────────────────────────────────────────
  console.log("Creating materials...");
  const materialRows = await db
    .insert(schema.materials)
    .values(
      MATERIALS_DATA.map((m) => ({
        name: m.name,
        abbreviation: m.abbreviation,
        category: m.category,
        materialClass: m.materialClass,
        density: m.density,
        defaultNozzleTempMin: m.nozzleMin,
        defaultNozzleTempMax: m.nozzleMax,
        defaultBedTempMin: m.bedMin,
        defaultBedTempMax: m.bedMax,
        defaultDryingTemp: m.dryTemp,
        defaultDryingTimeMin: m.dryTime,
        hygroscopic: m.hygroscopic,
      }))
    )
    .returning();
  console.log(`  ${materialRows.length} materials`);

  // ── Filaments (30+) ────────────────────────────────────────────────────
  console.log("Creating filaments...");
  const filamentValues = [];
  for (const brand of brandRows) {
    const count = faker.number.int({ min: 4, max: 6 });
    for (let i = 0; i < count; i++) {
      const material = faker.helpers.arrayElement(materialRows);
      const color = faker.helpers.arrayElement(COLORS);
      const matData = MATERIALS_DATA.find((m) => m.name === material.name)!;
      const netWeight = faker.helpers.arrayElement([250, 500, 750, 1000, 1000, 1000]);
      filamentValues.push({
        brandId: brand.id,
        materialId: material.id,
        name: `${brand.name} ${material.abbreviation} ${color.name}`,
        colorName: color.name,
        colorHex: color.hex,
        colorR: color.r,
        colorG: color.g,
        colorB: color.b,
        diameter: 1.75,
        netWeightG: netWeight,
        spoolWeightG: faker.number.float({ min: 140, max: 260, fractionDigits: 0 }),
        nozzleTempMin: matData.nozzleMin,
        nozzleTempMax: matData.nozzleMax,
        bedTempMin: matData.bedMin,
        bedTempMax: matData.bedMax,
        dryingTemp: matData.dryTemp,
        dryingTimeMin: matData.dryTime,
        validationStatus: "validated" as const,
      });
    }
  }
  const filamentRows = await db
    .insert(schema.filaments)
    .values(filamentValues)
    .returning();
  console.log(`  ${filamentRows.length} filaments`);

  // ── Spools (15 owned by user) ──────────────────────────────────────────
  console.log("Creating spools...");
  const spoolValues = [];
  const selectedFilaments = faker.helpers.arrayElements(filamentRows, 15);
  for (const fil of selectedFilaments) {
    const netWeight = fil.netWeightG ?? 1000;
    const spoolWeight = fil.spoolWeightG ?? 200;
    const usedPercent = faker.number.float({ min: 0, max: 0.85, fractionDigits: 2 });
    const currentNet = Math.round(netWeight * (1 - usedPercent));
    const status =
      currentNet < 20 ? ("empty" as const) : faker.helpers.weightedArrayElement([
        { value: "active" as const, weight: 8 },
        { value: "archived" as const, weight: 2 },
      ]);
    spoolValues.push({
      userId: USER_ID,
      filamentId: fil.id,
      initialWeightG: netWeight + spoolWeight,
      currentWeightG: currentNet + spoolWeight,
      netFilamentWeightG: currentNet,
      spoolWeightG: spoolWeight,
      percentRemaining: Math.round((1 - usedPercent) * 100),
      status,
      purchasePrice: faker.number.float({ min: 15, max: 40, fractionDigits: 2 }),
      purchaseCurrency: "USD",
      purchasedAt: faker.date.past({ years: 1 }),
      openedAt: faker.date.recent({ days: 90 }),
      nfcUid: faker.string.hexadecimal({ length: 14, casing: "upper", prefix: "" }),
      nfcTagFormat: faker.helpers.arrayElement(["bambu_mifare", "filla_iq"] as const),
      notes: faker.helpers.maybe(() => faker.lorem.sentence(), { probability: 0.3 }) ?? null,
    });
  }
  const spoolRows = await db
    .insert(schema.spools)
    .values(spoolValues)
    .returning();
  console.log(`  ${spoolRows.length} spools`);

  // ── Racks & hardware ───────────────────────────────────────────────────
  console.log("Creating hardware...");
  const [rack1, rack2] = await db
    .insert(schema.racks)
    .values([
      { userId: USER_ID, name: "Main Rack", location: "Workshop", shelfCount: 2 },
      { userId: USER_ID, name: "Storage Rack", location: "Storage Room", shelfCount: 1 },
    ])
    .returning();
  console.log("  2 racks");

  // Bridges
  const [bridge1, bridge2] = await db
    .insert(schema.bridges)
    .values([
      {
        rackId: rack1.id,
        hardwareId: "FIQ-BR-001",
        firmwareVersion: "1.2.0",
        ipAddress: "192.168.1.50",
        hostname: "fillaiq-bridge-01",
        connectionType: "wifi" as const,
        lastSeenAt: new Date(),
        isOnline: true,
      },
      {
        rackId: rack2.id,
        hardwareId: "FIQ-BR-002",
        firmwareVersion: "1.2.0",
        ipAddress: "192.168.1.51",
        hostname: "fillaiq-bridge-02",
        connectionType: "wifi" as const,
        lastSeenAt: faker.date.recent({ days: 1 }),
        isOnline: true,
      },
    ])
    .returning();
  console.log("  2 bridges");

  // Shelves
  const shelfValues = [
    { rackId: rack1.id, position: 1, hardwareId: "FIQ-SH-001", bayCount: 4, hasTempHumiditySensor: true, isOnline: true, lastSeenAt: new Date() },
    { rackId: rack1.id, position: 2, hardwareId: "FIQ-SH-002", bayCount: 4, hasTempHumiditySensor: true, isOnline: true, lastSeenAt: new Date() },
    { rackId: rack2.id, position: 1, hardwareId: "FIQ-SH-003", bayCount: 4, hasTempHumiditySensor: false, isOnline: true, lastSeenAt: faker.date.recent({ days: 1 }) },
  ];
  const shelfRows = await db.insert(schema.shelves).values(shelfValues).returning();
  console.log(`  ${shelfRows.length} shelves`);

  // Bays & Slots
  const allSlotIds: string[] = [];
  for (const shelf of shelfRows) {
    const bayCount = shelf.bayCount ?? 4;
    for (let b = 0; b < bayCount; b++) {
      const [bay] = await db
        .insert(schema.bays)
        .values({ shelfId: shelf.id, position: b + 1 })
        .returning();
      for (let s = 0; s < 2; s++) {
        const [slot] = await db
          .insert(schema.slots)
          .values({
            bayId: bay.id,
            position: s + 1,
            hx711Channel: s,
            nfcReaderIndex: s,
            displayIndex: s,
            ledIndex: b * 2 + s,
            calibrationFactor: faker.number.float({ min: -430, max: -420, fractionDigits: 2 }),
            lastCalibratedAt: faker.date.recent({ days: 30 }),
          })
          .returning();
        allSlotIds.push(slot.id);
      }
    }
  }
  console.log(`  ${allSlotIds.length} slots`);

  // ── Assign active spools to slots ──────────────────────────────────────
  console.log("Creating slot statuses...");
  const activeSpools = spoolRows.filter((s) => s.status === "active");
  const slotsToFill = faker.helpers.arrayElements(
    allSlotIds,
    Math.min(activeSpools.length, allSlotIds.length)
  );

  for (let i = 0; i < slotsToFill.length && i < activeSpools.length; i++) {
    const spool = activeSpools[i];
    const slotId = slotsToFill[i];

    await db.insert(schema.slotStatus).values({
      slotId,
      state: "active",
      spoolId: spool.id,
      nfcUid: spool.nfcUid,
      nfcPresent: true,
      weightRawG: spool.currentWeightG,
      weightStableG: spool.currentWeightG,
      weightIsStable: true,
      percentRemaining: spool.percentRemaining,
      temperatureC: faker.number.float({ min: 20, max: 26, fractionDigits: 1 }),
      humidityPercent: faker.number.float({ min: 30, max: 55, fractionDigits: 1 }),
      stateEnteredAt: faker.date.recent({ days: 7 }),
      lastReportAt: new Date(),
    });

    await db
      .update(schema.spools)
      .set({ currentSlotId: slotId })
      .where(eq(schema.spools.id, spool.id));
  }

  const emptySlots = allSlotIds.filter((id) => !slotsToFill.includes(id));
  if (emptySlots.length > 0) {
    await db.insert(schema.slotStatus).values(
      emptySlots.map((slotId) => ({
        slotId,
        state: "empty" as const,
        nfcPresent: false,
        weightIsStable: true,
        lastReportAt: new Date(),
      }))
    );
  }
  console.log(`  ${slotsToFill.length} active + ${emptySlots.length} empty slot statuses`);

  // ── Weight events (historical) ─────────────────────────────────────────
  console.log("Creating weight events...");
  let eventCount = 0;
  for (const spool of spoolRows) {
    const numEvents = faker.number.int({ min: 5, max: 20 });
    const eventValues = [];
    let weight = spool.initialWeightG ?? 1200;
    for (let e = 0; e < numEvents; e++) {
      const eventType = faker.helpers.weightedArrayElement([
        { value: "reading" as const, weight: 6 },
        { value: "usage" as const, weight: 3 },
        { value: "placed" as const, weight: 1 },
      ]);
      const delta =
        eventType === "usage"
          ? -faker.number.float({ min: 5, max: 80, fractionDigits: 1 })
          : eventType === "reading"
            ? faker.number.float({ min: -2, max: 2, fractionDigits: 1 })
            : 0;
      const prevWeight = weight;
      weight = Math.max(weight + delta, (spool.spoolWeightG ?? 200));
      eventValues.push({
        spoolId: spool.id,
        eventType,
        weightG: Math.round(weight * 10) / 10,
        previousWeightG: Math.round(prevWeight * 10) / 10,
        deltaG: Math.round(delta * 10) / 10,
        nfcUid: spool.nfcUid,
        createdAt: faker.date.between({
          from: spool.purchasedAt ?? faker.date.past({ years: 1 }),
          to: new Date(),
        }),
      });
    }
    await db.insert(schema.weightEvents).values(eventValues);
    eventCount += eventValues.length;
  }
  console.log(`  ${eventCount} weight events`);

  // ── Audit logs ─────────────────────────────────────────────────────────
  console.log("Creating audit logs...");
  const auditValues = [];
  for (let i = 0; i < 50; i++) {
    const resource = faker.helpers.arrayElement(AUDIT_RESOURCES);
    const action = faker.helpers.arrayElement(AUDIT_ACTIONS);
    auditValues.push({
      actorId: USER_ID,
      actorType: "session" as const,
      action,
      resourceType: resource,
      resourceId: faker.helpers.arrayElement(spoolRows).id,
      metadata: { ip: faker.internet.ipv4(), userAgent: faker.internet.userAgent() },
      createdAt: faker.date.recent({ days: 30 }),
    });
  }
  await db.insert(schema.auditLogs).values(auditValues);
  console.log(`  ${auditValues.length} audit logs`);

  // ── Machines (FDM) ─────────────────────────────────────────────────────
  console.log("Creating machines...");
  const machineRows = await db
    .insert(schema.machines)
    .values([
      {
        userId: USER_ID,
        name: "X1 Carbon",
        machineType: "fdm",
        manufacturer: "Bambu Lab",
        model: "X1 Carbon",
        firmwareVersion: "01.09.00.15",
        hasFilamentChanger: true,
        filamentChangerSlotCount: 4,
        filamentChangerModel: "AMS",
        nozzleDiameterMm: 0.4,
        buildVolumeX: 256,
        buildVolumeY: 256,
        buildVolumeZ: 256,
        ipAddress: "192.168.1.100",
        toolHeadType: "standard",
        nozzleSwapSystem: "bambu_h1c",
        filamentChangerUnitCount: 1,
        enclosureType: "stock",
      },
      {
        userId: USER_ID,
        name: "P1S",
        machineType: "fdm",
        manufacturer: "Bambu Lab",
        model: "P1S",
        firmwareVersion: "01.07.00.12",
        hasFilamentChanger: true,
        filamentChangerSlotCount: 4,
        filamentChangerModel: "AMS Lite",
        nozzleDiameterMm: 0.4,
        buildVolumeX: 256,
        buildVolumeY: 256,
        buildVolumeZ: 256,
        ipAddress: "192.168.1.101",
        toolHeadType: "standard",
        nozzleSwapSystem: "bambu_h1c",
        filamentChangerUnitCount: 1,
        enclosureType: "stock",
      },
      {
        userId: USER_ID,
        name: "Prusa MK4S",
        machineType: "fdm",
        manufacturer: "Prusa Research",
        model: "MK4S",
        firmwareVersion: "6.1.3",
        hasFilamentChanger: false,
        nozzleDiameterMm: 0.4,
        buildVolumeX: 250,
        buildVolumeY: 210,
        buildVolumeZ: 220,
        toolHeadType: "standard",
        nozzleSwapSystem: "e3d_v6",
        filamentChangerUnitCount: 0,
        enclosureType: "none",
      },
      // CNC machine
      {
        userId: USER_ID,
        name: "Carvera",
        machineType: "cnc",
        manufacturer: "Makera",
        model: "Carvera",
        firmwareVersion: "3.6.2",
        hasFilamentChanger: false,
        buildVolumeX: 200,
        buildVolumeY: 150,
        buildVolumeZ: 80,
        ipAddress: "192.168.1.110",
        spindleMaxRpm: 12000,
        spindlePowerW: 300,
        enclosureType: "stock",
      },
      // Laser machine
      {
        userId: USER_ID,
        name: "xTool D1 Pro",
        machineType: "laser",
        manufacturer: "xTool",
        model: "D1 Pro",
        firmwareVersion: "40.30.009.01",
        hasFilamentChanger: false,
        buildVolumeX: 432,
        buildVolumeY: 406,
        laserPowerW: 10,
        laserWavelengthNm: 455,
      },
    ])
    .returning();
  console.log(`  ${machineRows.length} machines`);

  const x1c = machineRows[0];
  const p1s = machineRows[1];
  const mk4s = machineRows[2];
  const carvera = machineRows[3];
  const xtool = machineRows[4];

  // ── Equipment ──────────────────────────────────────────────────────────
  console.log("Creating equipment...");
  await db.insert(schema.equipment).values([
    {
      userId: USER_ID,
      type: "drybox",
      name: "Sunlu S2",
      manufacturer: "Sunlu",
      model: "S2",
      capacity: 2,
      maxTemp: 70,
      hasHumidityControl: true,
    },
    {
      userId: USER_ID,
      type: "storage_bin",
      name: "Cereal Container Storage",
      manufacturer: "Generic",
      capacity: 4,
    },
  ]);
  console.log("  2 equipment items");

  // ── Tool Heads (FDM nozzles) ──────────────────────────────────────────
  console.log("Creating tool heads...");
  await db.insert(schema.machineToolHeads).values([
    // X1C nozzles
    { machineId: x1c.id, toolCategory: "nozzle" as const, diameterMm: 0.4, nozzleMaterial: "copper_alloy" as const, nozzleType: "chc" as const, isInstalled: true, wearLevel: "good" as const, installCount: 3, lastInstalledAt: faker.date.recent({ days: 14 }) },
    { machineId: x1c.id, toolCategory: "nozzle" as const, diameterMm: 0.6, nozzleMaterial: "hardened_steel" as const, nozzleType: "chc" as const, isInstalled: false, wearLevel: "new" as const, installCount: 0 },
    { machineId: x1c.id, toolCategory: "nozzle" as const, diameterMm: 0.2, nozzleMaterial: "stainless_steel" as const, nozzleType: "standard" as const, isInstalled: false, wearLevel: "good" as const, installCount: 1 },
    // P1S nozzles
    { machineId: p1s.id, toolCategory: "nozzle" as const, diameterMm: 0.4, nozzleMaterial: "brass" as const, nozzleType: "standard" as const, isInstalled: true, wearLevel: "good" as const, installCount: 1, lastInstalledAt: faker.date.recent({ days: 30 }) },
    { machineId: p1s.id, toolCategory: "nozzle" as const, diameterMm: 0.4, nozzleMaterial: "hardened_steel" as const, nozzleType: "standard" as const, isInstalled: false, wearLevel: "new" as const, installCount: 0 },
    // MK4S nozzles
    { machineId: mk4s.id, toolCategory: "nozzle" as const, diameterMm: 0.4, nozzleMaterial: "brass" as const, nozzleType: "standard" as const, isInstalled: true, wearLevel: "worn" as const, installCount: 5, lastInstalledAt: faker.date.recent({ days: 60 }) },
    { machineId: mk4s.id, toolCategory: "nozzle" as const, diameterMm: 0.6, nozzleMaterial: "brass" as const, nozzleType: "standard" as const, isInstalled: false, wearLevel: "new" as const, installCount: 0 },
    { machineId: mk4s.id, toolCategory: "nozzle" as const, diameterMm: 0.25, nozzleMaterial: "hardened_steel" as const, nozzleType: "standard" as const, isInstalled: false, wearLevel: "good" as const, installCount: 2 },
    // Carvera spindle bits
    { machineId: carvera.id, toolCategory: "spindle_bit" as const, name: "1/8\" Flat End Mill", bitDiameterMm: 3.175, bitType: "flat_end_mill", fluteCount: 2, bitMaterial: "carbide", isInstalled: true, wearLevel: "good" as const, installCount: 8 },
    { machineId: carvera.id, toolCategory: "spindle_bit" as const, name: "1/16\" Ball Nose", bitDiameterMm: 1.5875, bitType: "ball_nose", fluteCount: 2, bitMaterial: "carbide", isInstalled: false, wearLevel: "new" as const, installCount: 0 },
    { machineId: carvera.id, toolCategory: "spindle_bit" as const, name: "V-Bit 60°", bitDiameterMm: 6.0, bitType: "v_bit", fluteCount: 1, bitMaterial: "carbide", isInstalled: false, wearLevel: "good" as const, installCount: 3 },
    // xTool laser module
    { machineId: xtool.id, toolCategory: "laser_module" as const, name: "10W Diode Module", laserPowerW: 10, laserWavelengthNm: 455, focalLengthMm: 40, isInstalled: true, wearLevel: "good" as const, installCount: 1 },
  ]);
  console.log("  12 tool heads");

  // ── Work Surfaces ─────────────────────────────────────────────────────
  console.log("Creating work surfaces...");
  await db.insert(schema.machineWorkSurfaces).values([
    // X1C plates
    { machineId: x1c.id, name: "Bambu Cool Plate", type: "cool_plate" as const, isInstalled: false, surfaceCondition: "good" as const },
    { machineId: x1c.id, name: "Bambu Textured PEI", type: "textured_pei" as const, isInstalled: true, surfaceCondition: "good" as const },
    { machineId: x1c.id, name: "Bambu Engineering Plate", type: "engineering_plate" as const, isInstalled: false, surfaceCondition: "new" as const },
    // P1S plates
    { machineId: p1s.id, name: "Bambu Cool Plate", type: "cool_plate" as const, isInstalled: true, surfaceCondition: "good" as const },
    { machineId: p1s.id, name: "Bambu Textured PEI", type: "textured_pei" as const, isInstalled: false, surfaceCondition: "worn" as const },
    // MK4S plates
    { machineId: mk4s.id, name: "Prusa Satin Sheet", type: "textured_pei" as const, isInstalled: true, surfaceCondition: "good" as const },
    { machineId: mk4s.id, name: "Prusa Smooth Sheet", type: "cool_plate" as const, isInstalled: false, surfaceCondition: "good" as const },
    // Carvera wasteboard
    { machineId: carvera.id, name: "MDF Wasteboard", type: "wasteboard" as const, isInstalled: true, surfaceCondition: "worn" as const },
    // xTool honeycomb bed
    { machineId: xtool.id, name: "Honeycomb Panel", type: "honeycomb_bed" as const, isInstalled: true, surfaceCondition: "good" as const },
  ]);
  console.log("  9 work surfaces");

  // ── Material Slots ────────────────────────────────────────────────────
  console.log("Creating material slots...");
  const activeSpoolsForSlots = spoolRows.filter((s) => s.status === "active");
  const materialSlotValues = [];

  // X1C: AMS, 1 unit, 4 slots
  for (let slot = 1; slot <= 4; slot++) {
    const spool = slot <= activeSpoolsForSlots.length ? activeSpoolsForSlots[slot - 1] : null;
    materialSlotValues.push({
      machineId: x1c.id,
      changerType: "ams" as const,
      unitNumber: 1,
      slotPosition: slot,
      spoolId: spool?.id ?? null,
      loadedAt: spool ? faker.date.recent({ days: 7 }) : null,
    });
  }

  // P1S: AMS Lite, 1 unit, 4 slots
  for (let slot = 1; slot <= 4; slot++) {
    const idx = 4 + slot - 1;
    const spool = idx < activeSpoolsForSlots.length ? activeSpoolsForSlots[idx] : null;
    materialSlotValues.push({
      machineId: p1s.id,
      changerType: "ams_lite" as const,
      unitNumber: 1,
      slotPosition: slot,
      spoolId: spool?.id ?? null,
      loadedAt: spool ? faker.date.recent({ days: 14 }) : null,
    });
  }

  await db.insert(schema.machineMaterialSlots).values(materialSlotValues);
  console.log(`  ${materialSlotValues.length} material slots`);

  // ── Accessories ─────────────────────────────────────────────────────────
  console.log("Creating accessories...");
  await db.insert(schema.machineAccessories).values([
    // FDM accessories
    { machineId: x1c.id, type: "smoke_extractor" as const, name: "Bambu Air Purifier", manufacturer: "Bambu Lab", model: "Air Purifier", isActive: true },
    { machineId: x1c.id, type: "camera" as const, name: "Built-in Camera", manufacturer: "Bambu Lab", isActive: true },
    { machineId: p1s.id, type: "camera" as const, name: "Built-in Camera", manufacturer: "Bambu Lab", isActive: true },
    { machineId: p1s.id, type: "enclosure" as const, name: "P1S Enclosure", manufacturer: "Bambu Lab", model: "P1S Stock", isActive: true },
    // xTool accessories
    { machineId: xtool.id, type: "air_assist" as const, name: "Air Assist Pump", manufacturer: "xTool", model: "Air Assist", isActive: true },
    { machineId: xtool.id, type: "rotary_module" as const, name: "RA2 Pro Rotary", manufacturer: "xTool", model: "RA2 Pro", isActive: false },
    // Carvera accessories
    { machineId: carvera.id, type: "dust_collector" as const, name: "Dust Shoe + Shop Vac", manufacturer: "Generic", isActive: true },
    { machineId: carvera.id, type: "camera" as const, name: "Built-in Camera", manufacturer: "Makera", isActive: true },
  ]);
  console.log("  8 accessories");

  console.log("\nSeed complete!");
  await client.end();
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
