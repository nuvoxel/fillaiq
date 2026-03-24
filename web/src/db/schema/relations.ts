import { relations } from "drizzle-orm";
import {
  brands,
  materials,
  products,
  filamentProfiles,
  skuMappings,
  nfcTagPatterns,
  productAliases,
  productResellerLinks,
  productPriceHistory,
  productPriceTiers,
} from "./central-catalog";
import { catalogSubmissions } from "./submissions";
import {
  users,
  userItems,
  machines,
  userPrinters,
  machineToolHeads,
  machineWorkSurfaces,
  machineMaterialSlots,
  machineAccessories,
  userPrintProfiles,
  equipment,
  labelTemplates,
  userPreferences,
} from "./user-library";
import {
  sessions,
  accounts,
  verifications,
  organizations,
  members,
  invitations,
  apikeys,
} from "./auth";
import {
  zones,
  racks,
  shelves,
  bays,
  slots,
  bayModules,
  slotStatus,
} from "./storage";
import {
  weightEvents,
  itemMovements,
  usageSessions,
  dryingSessions,
  environmentalReadings,
} from "./events";
import { scanStations, scanEvents, scanSessions, inventoryItems } from "./scan-stations";
import { hardwareModels, hardwareIdentifiers } from "./hardware";
import { auditLogs } from "./audit";

// ── Central Catalog Relations ───────────────────────────────────────────────

export const brandsRelations = relations(brands, ({ many }) => ({
  products: many(products),
}));

export const materialsRelations = relations(materials, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  brand: one(brands, {
    fields: [products.brandId],
    references: [brands.id],
  }),
  material: one(materials, {
    fields: [products.materialId],
    references: [materials.id],
  }),
  submittedBy: one(users, {
    fields: [products.submittedByUserId],
    references: [users.id],
  }),
  filamentProfile: one(filamentProfiles),
  skuMappings: many(skuMappings),
  nfcTagPatterns: many(nfcTagPatterns),
  userItems: many(userItems),
  aliases: many(productAliases, { relationName: "product" }),
  aliasedBy: many(productAliases, { relationName: "relatedProduct" }),
  resellerLinks: many(productResellerLinks),
}));

export const productResellerLinksRelations = relations(
  productResellerLinks,
  ({ one, many }) => ({
    product: one(products, {
      fields: [productResellerLinks.productId],
      references: [products.id],
    }),
    priceHistory: many(productPriceHistory),
    priceTiers: many(productPriceTiers),
  })
);

export const productPriceHistoryRelations = relations(
  productPriceHistory,
  ({ one }) => ({
    resellerLink: one(productResellerLinks, {
      fields: [productPriceHistory.resellerLinkId],
      references: [productResellerLinks.id],
    }),
  })
);

export const productPriceTiersRelations = relations(
  productPriceTiers,
  ({ one }) => ({
    resellerLink: one(productResellerLinks, {
      fields: [productPriceTiers.resellerLinkId],
      references: [productResellerLinks.id],
    }),
  })
);

export const filamentProfilesRelations = relations(
  filamentProfiles,
  ({ one }) => ({
    product: one(products, {
      fields: [filamentProfiles.productId],
      references: [products.id],
    }),
  })
);

export const skuMappingsRelations = relations(skuMappings, ({ one }) => ({
  product: one(products, {
    fields: [skuMappings.productId],
    references: [products.id],
  }),
}));

export const nfcTagPatternsRelations = relations(
  nfcTagPatterns,
  ({ one }) => ({
    product: one(products, {
      fields: [nfcTagPatterns.productId],
      references: [products.id],
    }),
  })
);

export const productAliasesRelations = relations(
  productAliases,
  ({ one }) => ({
    product: one(products, {
      fields: [productAliases.productId],
      references: [products.id],
      relationName: "product",
    }),
    relatedProduct: one(products, {
      fields: [productAliases.relatedProductId],
      references: [products.id],
      relationName: "relatedProduct",
    }),
  })
);

// ── Hardware Catalog Relations ───────────────────────────────────────────

export const hardwareModelsRelations = relations(
  hardwareModels,
  ({ one, many }) => ({
    brand: one(brands, {
      fields: [hardwareModels.brandId],
      references: [brands.id],
    }),
    identifiers: many(hardwareIdentifiers),
    userPrinters: many(userPrinters),
  })
);

export const hardwareIdentifiersRelations = relations(
  hardwareIdentifiers,
  ({ one }) => ({
    hardwareModel: one(hardwareModels, {
      fields: [hardwareIdentifiers.hardwareModelId],
      references: [hardwareModels.id],
    }),
  })
);

// ── Submissions Relations ───────────────────────────────────────────────────

export const catalogSubmissionsRelations = relations(
  catalogSubmissions,
  ({ one }) => ({
    user: one(users, {
      fields: [catalogSubmissions.userId],
      references: [users.id],
      relationName: "submitter",
    }),
    reviewer: one(users, {
      fields: [catalogSubmissions.reviewerId],
      references: [users.id],
      relationName: "reviewer",
    }),
  })
);

// ── User Library Relations ──────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  accounts: many(accounts),
  apikeys: many(apikeys),
  members: many(members),
  userItems: many(userItems),
  machines: many(machines),
  printers: many(userPrinters),
  printProfiles: many(userPrintProfiles),
  equipment: many(equipment),
  labelTemplates: many(labelTemplates),
  preferences: many(userPreferences),
  zones: many(zones),
  scanStations: many(scanStations),
  scanEvents: many(scanEvents),
  inventoryItems: many(inventoryItems),
  submissions: many(catalogSubmissions, { relationName: "submitter" }),
  reviews: many(catalogSubmissions, { relationName: "reviewer" }),
  auditLogs: many(auditLogs),
}));

export const userItemsRelations = relations(userItems, ({ one, many }) => ({
  user: one(users, {
    fields: [userItems.userId],
    references: [users.id],
  }),
  product: one(products, {
    fields: [userItems.productId],
    references: [products.id],
  }),
  currentSlot: one(slots, {
    fields: [userItems.currentSlotId],
    references: [slots.id],
  }),
  weightEvents: many(weightEvents),
  movements: many(itemMovements),
  usageSessions: many(usageSessions),
  dryingSessions: many(dryingSessions),
}));

export const userPrintersRelations = relations(
  userPrinters,
  ({ one }) => ({
    user: one(users, {
      fields: [userPrinters.userId],
      references: [users.id],
    }),
    hardwareModel: one(hardwareModels, {
      fields: [userPrinters.hardwareModelId],
      references: [hardwareModels.id],
    }),
    scanStation: one(scanStations, {
      fields: [userPrinters.scanStationId],
      references: [scanStations.id],
    }),
  })
);

export const machinesRelations = relations(machines, ({ one, many }) => ({
  user: one(users, {
    fields: [machines.userId],
    references: [users.id],
  }),
  toolHeads: many(machineToolHeads),
  workSurfaces: many(machineWorkSurfaces),
  materialSlots: many(machineMaterialSlots),
  accessories: many(machineAccessories),
  printProfiles: many(userPrintProfiles),
  usageSessions: many(usageSessions),
}));

export const machineToolHeadsRelations = relations(
  machineToolHeads,
  ({ one }) => ({
    machine: one(machines, {
      fields: [machineToolHeads.machineId],
      references: [machines.id],
    }),
  })
);

export const machineWorkSurfacesRelations = relations(
  machineWorkSurfaces,
  ({ one }) => ({
    machine: one(machines, {
      fields: [machineWorkSurfaces.machineId],
      references: [machines.id],
    }),
  })
);

export const machineMaterialSlotsRelations = relations(
  machineMaterialSlots,
  ({ one }) => ({
    machine: one(machines, {
      fields: [machineMaterialSlots.machineId],
      references: [machines.id],
    }),
    userItem: one(userItems, {
      fields: [machineMaterialSlots.userItemId],
      references: [userItems.id],
    }),
  })
);

export const machineAccessoriesRelations = relations(
  machineAccessories,
  ({ one }) => ({
    machine: one(machines, {
      fields: [machineAccessories.machineId],
      references: [machines.id],
    }),
  })
);

export const userPrintProfilesRelations = relations(
  userPrintProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [userPrintProfiles.userId],
      references: [users.id],
    }),
    product: one(products, {
      fields: [userPrintProfiles.productId],
      references: [products.id],
    }),
    filamentProfile: one(filamentProfiles, {
      fields: [userPrintProfiles.filamentProfileId],
      references: [filamentProfiles.id],
    }),
    machine: one(machines, {
      fields: [userPrintProfiles.machineId],
      references: [machines.id],
    }),
  })
);

export const equipmentRelations = relations(equipment, ({ one, many }) => ({
  user: one(users, {
    fields: [equipment.userId],
    references: [users.id],
  }),
  dryingSessions: many(dryingSessions),
}));

export const labelTemplatesRelations = relations(
  labelTemplates,
  ({ one }) => ({
    user: one(users, {
      fields: [labelTemplates.userId],
      references: [users.id],
    }),
  })
);

export const userPreferencesRelations = relations(
  userPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userPreferences.userId],
      references: [users.id],
    }),
  })
);

// ── Auth Relations ─────────────────────────────────────────────────────────

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const apikeysRelations = relations(apikeys, ({ one }) => ({
  user: one(users, {
    fields: [apikeys.userId],
    references: [users.id],
  }),
}));

export const organizationsRelations = relations(
  organizations,
  ({ many }) => ({
    members: many(members),
    invitations: many(invitations),
  })
);

export const membersRelations = relations(members, ({ one }) => ({
  user: one(users, {
    fields: [members.userId],
    references: [users.id],
  }),
  organization: one(organizations, {
    fields: [members.organizationId],
    references: [organizations.id],
  }),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  organization: one(organizations, {
    fields: [invitations.organizationId],
    references: [organizations.id],
  }),
  inviter: one(users, {
    fields: [invitations.inviterId],
    references: [users.id],
  }),
}));

// ── Storage Relations ───────────────────────────────────────────────────────

export const zonesRelations = relations(zones, ({ one, many }) => ({
  user: one(users, {
    fields: [zones.userId],
    references: [users.id],
  }),
  racks: many(racks),
}));

export const racksRelations = relations(racks, ({ one, many }) => ({
  zone: one(zones, {
    fields: [racks.zoneId],
    references: [zones.id],
  }),
  shelves: many(shelves),
}));

export const shelvesRelations = relations(shelves, ({ one, many }) => ({
  rack: one(racks, {
    fields: [shelves.rackId],
    references: [racks.id],
  }),
  bays: many(bays),
  environmentalReadings: many(environmentalReadings),
}));

export const baysRelations = relations(bays, ({ one, many }) => ({
  shelf: one(shelves, {
    fields: [bays.shelfId],
    references: [shelves.id],
  }),
  slots: many(slots),
  bayModule: one(bayModules),
}));

export const slotsRelations = relations(slots, ({ one, many }) => ({
  bay: one(bays, {
    fields: [slots.bayId],
    references: [bays.id],
  }),
  status: one(slotStatus),
  items: many(userItems),
}));

export const bayModulesRelations = relations(bayModules, ({ one }) => ({
  bay: one(bays, {
    fields: [bayModules.bayId],
    references: [bays.id],
  }),
}));

export const slotStatusRelations = relations(slotStatus, ({ one }) => ({
  slot: one(slots, {
    fields: [slotStatus.slotId],
    references: [slots.id],
  }),
}));

// ── Audit Relations ─────────────────────────────────────────────────────────

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  actor: one(users, {
    fields: [auditLogs.actorId],
    references: [users.id],
  }),
}));

// ── Event Relations ─────────────────────────────────────────────────────────

export const weightEventsRelations = relations(weightEvents, ({ one }) => ({
  userItem: one(userItems, {
    fields: [weightEvents.userItemId],
    references: [userItems.id],
  }),
  slot: one(slots, {
    fields: [weightEvents.slotId],
    references: [slots.id],
  }),
}));

export const itemMovementsRelations = relations(itemMovements, ({ one }) => ({
  userItem: one(userItems, {
    fields: [itemMovements.userItemId],
    references: [userItems.id],
  }),
  fromSlot: one(slots, {
    fields: [itemMovements.fromSlotId],
    references: [slots.id],
    relationName: "fromSlot",
  }),
  toSlot: one(slots, {
    fields: [itemMovements.toSlotId],
    references: [slots.id],
    relationName: "toSlot",
  }),
}));

export const usageSessionsRelations = relations(usageSessions, ({ one }) => ({
  userItem: one(userItems, {
    fields: [usageSessions.userItemId],
    references: [userItems.id],
  }),
  machine: one(machines, {
    fields: [usageSessions.machineId],
    references: [machines.id],
  }),
  removedFromSlot: one(slots, {
    fields: [usageSessions.removedFromSlotId],
    references: [slots.id],
    relationName: "removedFromSlot",
  }),
  returnedToSlot: one(slots, {
    fields: [usageSessions.returnedToSlotId],
    references: [slots.id],
    relationName: "returnedToSlot",
  }),
}));

export const dryingSessionsRelations = relations(
  dryingSessions,
  ({ one }) => ({
    userItem: one(userItems, {
      fields: [dryingSessions.userItemId],
      references: [userItems.id],
    }),
    equipment: one(equipment, {
      fields: [dryingSessions.equipmentId],
      references: [equipment.id],
    }),
  })
);

export const environmentalReadingsRelations = relations(
  environmentalReadings,
  ({ one }) => ({
    shelf: one(shelves, {
      fields: [environmentalReadings.shelfId],
      references: [shelves.id],
    }),
    station: one(scanStations, {
      fields: [environmentalReadings.stationId],
      references: [scanStations.id],
    }),
  })
);

// ── Scan Station Relations ────────────────────────────────────────────────

export const scanStationsRelations = relations(
  scanStations,
  ({ one, many }) => ({
    user: one(users, {
      fields: [scanStations.userId],
      references: [users.id],
    }),
    scanEvents: many(scanEvents),
    scanSessions: many(scanSessions),
    environmentalReadings: many(environmentalReadings),
    printers: many(userPrinters),
  })
);

export const scanEventsRelations = relations(scanEvents, ({ one }) => ({
  station: one(scanStations, {
    fields: [scanEvents.stationId],
    references: [scanStations.id],
  }),
  user: one(users, {
    fields: [scanEvents.userId],
    references: [users.id],
  }),
  session: one(scanSessions, {
    fields: [scanEvents.sessionId],
    references: [scanSessions.id],
  }),
  identifiedUserItem: one(userItems, {
    fields: [scanEvents.identifiedUserItemId],
    references: [userItems.id],
  }),
}));

export const scanSessionsRelations = relations(
  scanSessions,
  ({ one, many }) => ({
    user: one(users, {
      fields: [scanSessions.userId],
      references: [users.id],
    }),
    station: one(scanStations, {
      fields: [scanSessions.stationId],
      references: [scanStations.id],
    }),
    resolvedUserItem: one(userItems, {
      fields: [scanSessions.resolvedUserItemId],
      references: [userItems.id],
    }),
    scanEvents: many(scanEvents),
  })
);

export const inventoryItemsRelations = relations(
  inventoryItems,
  ({ one }) => ({
    user: one(users, {
      fields: [inventoryItems.userId],
      references: [users.id],
    }),
    lastScanEvent: one(scanEvents, {
      fields: [inventoryItems.lastScanEventId],
      references: [scanEvents.id],
    }),
  })
);
