import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import {
  brands,
  materials,
  filaments,
  variants,
  skuMappings,
  nfcTagPatterns,
  equivalenceGroups,
  filamentEquivalences,
} from "@/db/schema/central-catalog";
import { catalogSubmissions } from "@/db/schema/submissions";
import {
  users,
  spools,
  machines,
  machineToolHeads,
  machineWorkSurfaces,
  machineMaterialSlots,
  machineAccessories,
  userPrintProfiles,
  equipment,
  labelTemplates,
  userPreferences,
} from "@/db/schema/user-library";
import {
  racks,
  bridges,
  shelves,
  bays,
  slots,
  slotStatus,
} from "@/db/schema/hardware";
import {
  weightEvents,
  spoolMovements,
  usageSessions,
  dryingSessions,
  environmentalReadings,
} from "@/db/schema/events";
import { auditLogs } from "@/db/schema/audit";

const serverManaged = { id: true, createdAt: true, updatedAt: true } as const;
const serverManagedNoUpdate = { id: true, createdAt: true } as const;

// ── Central Catalog ─────────────────────────────────────────────────────────

export const insertBrandSchema = createInsertSchema(brands).omit(serverManaged);
export const updateBrandSchema = createUpdateSchema(brands).omit(serverManaged);

export const insertMaterialSchema = createInsertSchema(materials).omit(serverManaged);
export const updateMaterialSchema = createUpdateSchema(materials).omit(serverManaged);

export const insertFilamentSchema = createInsertSchema(filaments).omit(serverManaged);
export const updateFilamentSchema = createUpdateSchema(filaments).omit(serverManaged);

export const insertVariantSchema = createInsertSchema(variants).omit(serverManaged);
export const updateVariantSchema = createUpdateSchema(variants).omit(serverManaged);

export const insertSkuMappingSchema = createInsertSchema(skuMappings).omit(serverManaged);
export const updateSkuMappingSchema = createUpdateSchema(skuMappings).omit(serverManaged);

export const insertNfcTagPatternSchema = createInsertSchema(nfcTagPatterns).omit(serverManaged);
export const updateNfcTagPatternSchema = createUpdateSchema(nfcTagPatterns).omit(serverManaged);

export const insertEquivalenceGroupSchema = createInsertSchema(equivalenceGroups).omit(serverManaged);
export const updateEquivalenceGroupSchema = createUpdateSchema(equivalenceGroups).omit(serverManaged);

export const insertFilamentEquivalenceSchema = createInsertSchema(filamentEquivalences).omit(serverManaged);
export const updateFilamentEquivalenceSchema = createUpdateSchema(filamentEquivalences).omit(serverManaged);

// ── Submissions ─────────────────────────────────────────────────────────────

export const insertCatalogSubmissionSchema = createInsertSchema(catalogSubmissions).omit(serverManaged);
export const updateCatalogSubmissionSchema = createUpdateSchema(catalogSubmissions).omit(serverManaged);

// ── User Library ────────────────────────────────────────────────────────────

export const insertUserSchema = createInsertSchema(users).omit(serverManaged);
export const updateUserSchema = createUpdateSchema(users).omit(serverManaged);

export const insertSpoolSchema = createInsertSchema(spools).omit(serverManaged);
export const updateSpoolSchema = createUpdateSchema(spools).omit(serverManaged);

export const insertMachineSchema = createInsertSchema(machines).omit(serverManaged);
export const updateMachineSchema = createUpdateSchema(machines).omit(serverManaged);

export const insertUserPrintProfileSchema = createInsertSchema(userPrintProfiles).omit(serverManaged);
export const updateUserPrintProfileSchema = createUpdateSchema(userPrintProfiles).omit(serverManaged);

export const insertMachineToolHeadSchema = createInsertSchema(machineToolHeads).omit(serverManaged);
export const updateMachineToolHeadSchema = createUpdateSchema(machineToolHeads).omit(serverManaged);

export const insertMachineWorkSurfaceSchema = createInsertSchema(machineWorkSurfaces).omit(serverManaged);
export const updateMachineWorkSurfaceSchema = createUpdateSchema(machineWorkSurfaces).omit(serverManaged);

export const insertMachineMaterialSlotSchema = createInsertSchema(machineMaterialSlots).omit(serverManaged);
export const updateMachineMaterialSlotSchema = createUpdateSchema(machineMaterialSlots).omit(serverManaged);

export const insertMachineAccessorySchema = createInsertSchema(machineAccessories).omit(serverManaged);
export const updateMachineAccessorySchema = createUpdateSchema(machineAccessories).omit(serverManaged);

export const insertEquipmentSchema = createInsertSchema(equipment).omit(serverManaged);
export const updateEquipmentSchema = createUpdateSchema(equipment).omit(serverManaged);

export const insertLabelTemplateSchema = createInsertSchema(labelTemplates).omit(serverManaged);
export const updateLabelTemplateSchema = createUpdateSchema(labelTemplates).omit(serverManaged);

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit(serverManaged);
export const updateUserPreferencesSchema = createUpdateSchema(userPreferences).omit(serverManaged);

// ── Hardware ────────────────────────────────────────────────────────────────

export const insertRackSchema = createInsertSchema(racks).omit(serverManaged);
export const updateRackSchema = createUpdateSchema(racks).omit(serverManaged);

export const insertBridgeSchema = createInsertSchema(bridges).omit(serverManaged);
export const updateBridgeSchema = createUpdateSchema(bridges).omit(serverManaged);

export const insertShelfSchema = createInsertSchema(shelves).omit(serverManaged);
export const updateShelfSchema = createUpdateSchema(shelves).omit(serverManaged);

export const insertBaySchema = createInsertSchema(bays).omit(serverManaged);
export const updateBaySchema = createUpdateSchema(bays).omit(serverManaged);

export const insertSlotSchema = createInsertSchema(slots).omit(serverManaged);
export const updateSlotSchema = createUpdateSchema(slots).omit(serverManaged);

export const insertSlotStatusSchema = createInsertSchema(slotStatus).omit(serverManaged);

// ── Events ──────────────────────────────────────────────────────────────────

export const insertWeightEventSchema = createInsertSchema(weightEvents).omit(serverManagedNoUpdate);
export const insertSpoolMovementSchema = createInsertSchema(spoolMovements).omit(serverManagedNoUpdate);
export const insertEnvironmentalReadingSchema = createInsertSchema(environmentalReadings).omit(serverManagedNoUpdate);

export const insertUsageSessionSchema = createInsertSchema(usageSessions).omit(serverManagedNoUpdate);
export const updateUsageSessionSchema = createUpdateSchema(usageSessions).omit(serverManagedNoUpdate);

export const insertDryingSessionSchema = createInsertSchema(dryingSessions).omit(serverManagedNoUpdate);
export const updateDryingSessionSchema = createUpdateSchema(dryingSessions).omit(serverManagedNoUpdate);

// ── Audit ──────────────────────────────────────────────────────────────────

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit(serverManagedNoUpdate);
