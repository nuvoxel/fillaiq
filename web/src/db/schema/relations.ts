import { relations } from "drizzle-orm";
import {
  brands,
  materials,
  filaments,
  variants,
  skuMappings,
  nfcTagPatterns,
  equivalenceGroups,
  filamentEquivalences,
} from "./central-catalog";
import { catalogSubmissions } from "./submissions";
import {
  users,
  spools,
  printers,
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
  racks,
  bridges,
  shelves,
  bays,
  slots,
  slotStatus,
} from "./hardware";
import {
  weightEvents,
  spoolMovements,
  usageSessions,
  dryingSessions,
  environmentalReadings,
} from "./events";
import { auditLogs } from "./audit";

// ── Central Catalog Relations ───────────────────────────────────────────────

export const brandsRelations = relations(brands, ({ many }) => ({
  filaments: many(filaments),
}));

export const materialsRelations = relations(materials, ({ many }) => ({
  filaments: many(filaments),
}));

export const filamentsRelations = relations(filaments, ({ one, many }) => ({
  brand: one(brands, {
    fields: [filaments.brandId],
    references: [brands.id],
  }),
  material: one(materials, {
    fields: [filaments.materialId],
    references: [materials.id],
  }),
  submittedBy: one(users, {
    fields: [filaments.submittedByUserId],
    references: [users.id],
  }),
  variants: many(variants),
  equivalences: many(filamentEquivalences),
  spools: many(spools),
}));

export const variantsRelations = relations(variants, ({ one, many }) => ({
  filament: one(filaments, {
    fields: [variants.filamentId],
    references: [filaments.id],
  }),
  submittedBy: one(users, {
    fields: [variants.submittedByUserId],
    references: [users.id],
  }),
  skuMappings: many(skuMappings),
  nfcTagPatterns: many(nfcTagPatterns),
  spools: many(spools),
}));

export const skuMappingsRelations = relations(skuMappings, ({ one }) => ({
  variant: one(variants, {
    fields: [skuMappings.variantId],
    references: [variants.id],
  }),
}));

export const nfcTagPatternsRelations = relations(
  nfcTagPatterns,
  ({ one }) => ({
    variant: one(variants, {
      fields: [nfcTagPatterns.variantId],
      references: [variants.id],
    }),
  })
);

export const equivalenceGroupsRelations = relations(
  equivalenceGroups,
  ({ many }) => ({
    filamentEquivalences: many(filamentEquivalences),
  })
);

export const filamentEquivalencesRelations = relations(
  filamentEquivalences,
  ({ one }) => ({
    equivalenceGroup: one(equivalenceGroups, {
      fields: [filamentEquivalences.equivalenceGroupId],
      references: [equivalenceGroups.id],
    }),
    filament: one(filaments, {
      fields: [filamentEquivalences.filamentId],
      references: [filaments.id],
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
  spools: many(spools),
  printers: many(printers),
  printProfiles: many(userPrintProfiles),
  equipment: many(equipment),
  labelTemplates: many(labelTemplates),
  preferences: many(userPreferences),
  racks: many(racks),
  submissions: many(catalogSubmissions, { relationName: "submitter" }),
  reviews: many(catalogSubmissions, { relationName: "reviewer" }),
  auditLogs: many(auditLogs),
}));

export const spoolsRelations = relations(spools, ({ one, many }) => ({
  user: one(users, {
    fields: [spools.userId],
    references: [users.id],
  }),
  variant: one(variants, {
    fields: [spools.variantId],
    references: [variants.id],
  }),
  filament: one(filaments, {
    fields: [spools.filamentId],
    references: [filaments.id],
  }),
  currentSlot: one(slots, {
    fields: [spools.currentSlotId],
    references: [slots.id],
  }),
  weightEvents: many(weightEvents),
  movements: many(spoolMovements),
  usageSessions: many(usageSessions),
  dryingSessions: many(dryingSessions),
}));

export const printersRelations = relations(printers, ({ one, many }) => ({
  user: one(users, {
    fields: [printers.userId],
    references: [users.id],
  }),
  printProfiles: many(userPrintProfiles),
  usageSessions: many(usageSessions),
}));

export const userPrintProfilesRelations = relations(
  userPrintProfiles,
  ({ one }) => ({
    user: one(users, {
      fields: [userPrintProfiles.userId],
      references: [users.id],
    }),
    variant: one(variants, {
      fields: [userPrintProfiles.variantId],
      references: [variants.id],
    }),
    filament: one(filaments, {
      fields: [userPrintProfiles.filamentId],
      references: [filaments.id],
    }),
    printer: one(printers, {
      fields: [userPrintProfiles.printerId],
      references: [printers.id],
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

// ── Hardware Relations ──────────────────────────────────────────────────────

export const racksRelations = relations(racks, ({ one, many }) => ({
  user: one(users, {
    fields: [racks.userId],
    references: [users.id],
  }),
  bridges: many(bridges),
  shelves: many(shelves),
}));

export const bridgesRelations = relations(bridges, ({ one }) => ({
  rack: one(racks, {
    fields: [bridges.rackId],
    references: [racks.id],
  }),
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
}));

export const slotsRelations = relations(slots, ({ one }) => ({
  bay: one(bays, {
    fields: [slots.bayId],
    references: [bays.id],
  }),
  status: one(slotStatus),
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
  spool: one(spools, {
    fields: [weightEvents.spoolId],
    references: [spools.id],
  }),
  slot: one(slots, {
    fields: [weightEvents.slotId],
    references: [slots.id],
  }),
}));

export const spoolMovementsRelations = relations(
  spoolMovements,
  ({ one }) => ({
    spool: one(spools, {
      fields: [spoolMovements.spoolId],
      references: [spools.id],
    }),
    fromSlot: one(slots, {
      fields: [spoolMovements.fromSlotId],
      references: [slots.id],
      relationName: "fromSlot",
    }),
    toSlot: one(slots, {
      fields: [spoolMovements.toSlotId],
      references: [slots.id],
      relationName: "toSlot",
    }),
  })
);

export const usageSessionsRelations = relations(usageSessions, ({ one }) => ({
  spool: one(spools, {
    fields: [usageSessions.spoolId],
    references: [spools.id],
  }),
  printer: one(printers, {
    fields: [usageSessions.printerId],
    references: [printers.id],
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
    spool: one(spools, {
      fields: [dryingSessions.spoolId],
      references: [spools.id],
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
  })
);
