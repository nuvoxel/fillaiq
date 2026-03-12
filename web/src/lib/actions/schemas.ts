import { createInsertSchema, createUpdateSchema } from "drizzle-zod";
import {
  brands,
  materials,
  products,
  filamentProfiles,
  skuMappings,
  nfcTagPatterns,
  productAliases,
} from "@/db/schema/central-catalog";
import { catalogSubmissions } from "@/db/schema/submissions";
import {
  users,
  userItems,
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
  zones,
  racks,
  shelves,
  bays,
  slots,
  bayModules,
  slotStatus,
} from "@/db/schema/storage";
import {
  weightEvents,
  itemMovements,
  usageSessions,
  dryingSessions,
  environmentalReadings,
} from "@/db/schema/events";
import { hardwareModels, hardwareIdentifiers } from "@/db/schema/hardware";
import { auditLogs } from "@/db/schema/audit";

const serverManaged = { id: true, createdAt: true, updatedAt: true } as const;
const serverManagedNoUpdate = { id: true, createdAt: true } as const;

// ── Central Catalog ─────────────────────────────────────────────────────────

export const insertBrandSchema = createInsertSchema(brands).omit(serverManaged);
export const updateBrandSchema = createUpdateSchema(brands).omit(serverManaged);

export const insertMaterialSchema = createInsertSchema(materials).omit(serverManaged);
export const updateMaterialSchema = createUpdateSchema(materials).omit(serverManaged);

export const insertProductSchema = createInsertSchema(products).omit(serverManaged);
export const updateProductSchema = createUpdateSchema(products).omit(serverManaged);

export const insertFilamentProfileSchema = createInsertSchema(filamentProfiles).omit(serverManaged);
export const updateFilamentProfileSchema = createUpdateSchema(filamentProfiles).omit(serverManaged);

export const insertSkuMappingSchema = createInsertSchema(skuMappings).omit(serverManaged);
export const updateSkuMappingSchema = createUpdateSchema(skuMappings).omit(serverManaged);

export const insertNfcTagPatternSchema = createInsertSchema(nfcTagPatterns).omit(serverManaged);
export const updateNfcTagPatternSchema = createUpdateSchema(nfcTagPatterns).omit(serverManaged);

export const insertProductAliasSchema = createInsertSchema(productAliases).omit(serverManaged);
export const updateProductAliasSchema = createUpdateSchema(productAliases).omit(serverManaged);

// ── Submissions ─────────────────────────────────────────────────────────────

export const insertCatalogSubmissionSchema = createInsertSchema(catalogSubmissions).omit(serverManaged);
export const updateCatalogSubmissionSchema = createUpdateSchema(catalogSubmissions).omit(serverManaged);

// ── User Library ────────────────────────────────────────────────────────────

export const insertUserSchema = createInsertSchema(users).omit(serverManaged);
export const updateUserSchema = createUpdateSchema(users).omit(serverManaged);

export const insertUserItemSchema = createInsertSchema(userItems).omit(serverManaged);
export const updateUserItemSchema = createUpdateSchema(userItems).omit(serverManaged);

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

// ── Storage ────────────────────────────────────────────────────────────────

export const insertZoneSchema = createInsertSchema(zones).omit(serverManaged);
export const updateZoneSchema = createUpdateSchema(zones).omit(serverManaged);

export const insertRackSchema = createInsertSchema(racks).omit(serverManaged);
export const updateRackSchema = createUpdateSchema(racks).omit(serverManaged);

export const insertShelfSchema = createInsertSchema(shelves).omit(serverManaged);
export const updateShelfSchema = createUpdateSchema(shelves).omit(serverManaged);

export const insertBaySchema = createInsertSchema(bays).omit(serverManaged);
export const updateBaySchema = createUpdateSchema(bays).omit(serverManaged);

export const insertSlotSchema = createInsertSchema(slots).omit(serverManaged);
export const updateSlotSchema = createUpdateSchema(slots).omit(serverManaged);

export const insertBayModuleSchema = createInsertSchema(bayModules).omit(serverManaged);
export const updateBayModuleSchema = createUpdateSchema(bayModules).omit(serverManaged);

export const insertSlotStatusSchema = createInsertSchema(slotStatus).omit(serverManaged);

// ── Hardware Catalog ────────────────────────────────────────────────────────

export const insertHardwareModelSchema = createInsertSchema(hardwareModels).omit(serverManaged);
export const updateHardwareModelSchema = createUpdateSchema(hardwareModels).omit(serverManaged);

export const insertHardwareIdentifierSchema = createInsertSchema(hardwareIdentifiers).omit(serverManaged);
export const updateHardwareIdentifierSchema = createUpdateSchema(hardwareIdentifiers).omit(serverManaged);

// ── Events ──────────────────────────────────────────────────────────────────

export const insertWeightEventSchema = createInsertSchema(weightEvents).omit(serverManagedNoUpdate);
export const insertItemMovementSchema = createInsertSchema(itemMovements).omit(serverManagedNoUpdate);
export const insertEnvironmentalReadingSchema = createInsertSchema(environmentalReadings).omit(serverManagedNoUpdate);

export const insertUsageSessionSchema = createInsertSchema(usageSessions).omit(serverManagedNoUpdate);
export const updateUsageSessionSchema = createUpdateSchema(usageSessions).omit(serverManagedNoUpdate);

export const insertDryingSessionSchema = createInsertSchema(dryingSessions).omit(serverManagedNoUpdate);
export const updateDryingSessionSchema = createUpdateSchema(dryingSessions).omit(serverManagedNoUpdate);

// ── Audit ──────────────────────────────────────────────────────────────────

export const insertAuditLogSchema = createInsertSchema(auditLogs).omit(serverManagedNoUpdate);
