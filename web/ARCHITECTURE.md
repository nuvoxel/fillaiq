# Filla IQ Web — Architecture

## Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.1.6 |
| Language | TypeScript | 5.x |
| UI | React | 19.2.3 |
| Styling | Tailwind CSS | 4.x |
| ORM | Drizzle ORM | 0.45.1 |
| Validation | Zod (v4) + drizzle-zod | 4.3.6 / 0.8.3 |
| Database | PostgreSQL | local |
| DB Driver | postgres (porsager) | 3.4.8 |
| Auth | Better Auth | latest |

## Authentication

Uses [Better Auth](https://www.better-auth.com) with email/password sign-in and four plugins:

| Plugin | Purpose |
|--------|---------|
| **admin** | Adds `role` field to users, admin-only endpoints |
| **username** | Adds `username` field to users, unique constraint |
| **organization** | Multi-tenant orgs with members, invitations, roles |
| **apiKey** | API key generation, rate limiting, permissions |

### Config Files

- `src/lib/auth.ts` — server-side Better Auth instance (Drizzle adapter, `usePlural: true`, `generateId: false`)
- `src/lib/auth-client.ts` — React client with matching plugin set
- `src/app/api/auth/[...all]/route.ts` — catch-all Next.js API handler

### Auth Tables (7)

All defined in `src/db/schema/auth.ts`:

| Table | Purpose |
|-------|---------|
| **sessions** | Active user sessions (token, expiry, IP, user agent, active org) |
| **accounts** | Provider accounts (email/password, OAuth tokens) |
| **verifications** | Email verification / password reset tokens |
| **organizations** | Multi-tenant organizations (name, slug, logo, metadata) |
| **members** | Organization membership (userId, orgId, role) |
| **invitations** | Pending org invitations (email, role, status, expiry) |
| **apikeys** | API keys (hashed key, rate limiting, permissions, expiry) |

### Session Flow

1. User signs up/in via `/api/auth/sign-up/email` or `/api/auth/sign-in/email`
2. Better Auth creates a session + sets an HTTP-only cookie (via `nextCookies()` plugin)
3. Server components/actions read session via `auth.api.getSession()`
4. Client components use `authClient.useSession()`

### No Custom Server Actions for Auth Tables

Auth tables (sessions, accounts, verifications, organizations, members, invitations, apikeys) have **no custom server actions**. All auth operations go through Better Auth's built-in API:

| Domain | Client Usage | Server Usage |
|--------|-------------|--------------|
| **Sessions** | `authClient.useSession()` | `auth.api.getSession()` |
| **Sign-up/in** | `authClient.signUp.email()` / `authClient.signIn.email()` | — |
| **Organizations** | `authClient.organization.create()`, `.list()`, `.setActive()` | `auth.api.listOrganizations()` |
| **Members** | `authClient.organization.inviteMember()`, `.removeMember()` | — |
| **API Keys** | `authClient.apiKey.create()`, `.list()`, `.revoke()` | `auth.api.verifyApiKey()` |
| **Admin** | `authClient.admin.listUsers()`, `.banUser()` | — |

### Environment Variables

| Variable | Description |
|----------|-------------|
| `BETTER_AUTH_SECRET` | Signs session cookies (base64, 32 bytes) |
| `BETTER_AUTH_URL` | App base URL (`http://localhost:3000` in dev) |

## Directory Structure

```
web/
├── src/
│   ├── app/                    # Next.js App Router pages
│   │   ├── api/auth/[...all]/route.ts  # Better Auth catch-all handler
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── globals.css
│   │   └── favicon.ico
│   ├── db/
│   │   ├── index.ts            # Drizzle client (postgres.js + relational schema)
│   │   └── schema/
│   │       ├── index.ts        # Barrel re-export
│   │       ├── enums.ts        # 17 PostgreSQL enums
│   │       ├── central-catalog.ts  # 8 tables: brands → filamentEquivalences
│   │       ├── submissions.ts  # 1 table: catalogSubmissions
│   │       ├── user-library.ts # 6 tables: users → labelTemplates
│   │       ├── auth.ts         # 7 tables: sessions → apikeys (Better Auth)
│   │       ├── hardware.ts     # 6 tables: racks → slotStatus
│   │       ├── events.ts       # 5 tables: weightEvents → environmentalReadings
│   │       └── relations.ts    # All Drizzle relation definitions
│   └── lib/
│       ├── auth.ts             # Better Auth server config
│       ├── auth-client.ts      # Better Auth React client
│       └── actions/
│           ├── index.ts        # Barrel re-export
│           ├── utils.ts        # ActionResult type, CRUD/append-only/upsert factories
│           ├── schemas.ts      # All drizzle-zod insert/update schemas
│           ├── central-catalog.ts  # 53 server actions
│           ├── submissions.ts  # 8 server actions
│           ├── user-library.ts # 37 server actions
│           ├── hardware.ts     # 34 server actions
│           └── events.ts       # 21 server actions
├── drizzle.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── tailwind.config.ts
```

---

## Database Layer

### Connection

`src/db/index.ts` creates a single Drizzle client using `postgres` (porsager's driver) with the full relational schema attached. Connection string comes from `DATABASE_URL` env var.

```ts
import { db } from "@/db";
```

### Enums (17)

Defined in `src/db/schema/enums.ts`. All are PostgreSQL native enums.

| Enum | Values | Used By |
|------|--------|---------|
| `validation_status` | draft, submitted, validated, deprecated | brands, materials, filaments, variants, skuMappings, nfcTagPatterns, equivalenceGroups |
| `submission_type` | new_filament, new_variant, correction, equivalence | catalogSubmissions |
| `submission_status` | pending, approved, rejected, duplicate | catalogSubmissions |
| `spool_status` | active, empty, archived | spools |
| `slot_state` | empty, detecting, active, unknown_spool, removed, error | slotStatus |
| `weight_event_type` | placed, removed, reading, usage, drying | weightEvents |
| `equipment_type` | drybox, enclosure, storage_bin, other | equipment |
| `spool_material_type` | plastic, cardboard, metal, unknown | filaments |
| `finish_type` | matte, glossy, satin, silk | filaments |
| `pattern_type` | solid, marble, sparkle, galaxy, wood_grain, gradient | filaments |
| `fill_type` | none, carbon_fiber, glass_fiber, wood, ceramic, kevlar, metal, glow | materials |
| `multi_color_direction` | coaxial, longitudinal | filaments |
| `nfc_tag_format` | bambu_mifare, creality, open_print_tag, open_spool, open_tag_3d, tiger_tag, ntag, filla_iq, unknown | nfcTagPatterns, spools |
| `bed_temp_type` | cool_plate, textured_pei, engineering_plate, high_temp_plate | filaments |
| `label_format` | labelife_image, labelife_native, png, pdf | labelTemplates |
| `material_class` | fff, sla | materials |
| `connection_type` | wifi, ethernet | bridges |

### Tables (33)

All tables use UUID primary keys (`id` with `defaultRandom()`), `createdAt` with `defaultNow()`, and most include `updatedAt` with `defaultNow()`. Event tables omit `updatedAt`.

#### Central Catalog (8 tables)

The shared filament database — brands, materials, filament definitions, packaging variants, retail SKUs, NFC tag identification patterns, and equivalence grouping.

| Table | Key Columns | Unique Indexes | Relations |
|-------|-------------|----------------|-----------|
| **brands** | name, slug, website, logoUrl, validationStatus | `brands_slug_idx` (slug) | has many filaments |
| **materials** | name, abbreviation, category, materialClass, density, default temps/drying, fill properties, hardness | — | has many filaments |
| **filaments** | brandId, materialId, name, color (hex/RGB/LAB/Pantone/RAL), multi-color, appearance (finish/translucent/glow/pattern), transmission distance, diameter, weights, spool dimensions, print settings, Bambu-specific fields, external IDs, commerce links, validationStatus | — | belongs to brand + material, has many variants + equivalences + spools |
| **variants** | filamentId, name, oemSupplier, batchCode, override settings (temps/weight/density), validationStatus | — | belongs to filament, has many skuMappings + nfcTagPatterns + spools |
| **skuMappings** | variantId, sku, barcode, barcodeFormat, gtin, retailer, productUrl, price, validationStatus | `sku_mappings_sku_idx` (sku) | belongs to variant |
| **nfcTagPatterns** | variantId, tagFormat, Bambu IDs, TigerTag IDs, OpenPrintTag UUIDs, generic pattern fields, validationStatus | — | belongs to variant |
| **equivalenceGroups** | name, description, validationStatus | — | has many filamentEquivalences |
| **filamentEquivalences** | equivalenceGroupId, filamentId, isPrimary, notes | — | belongs to equivalenceGroup + filament |

#### Submissions (1 table)

Community contribution workflow for adding/correcting catalog data.

| Table | Key Columns | Relations |
|-------|-------------|-----------|
| **catalogSubmissions** | userId, type, status, targetTable, targetId, payload (JSONB), originalPayload (JSONB), reviewerId, reviewNotes, reviewedAt, sourceNfcUid | belongs to user (submitter) + user (reviewer) |

#### User Library (6 tables)

Per-user data — accounts, spool inventory, printers, tuned print profiles, drying equipment, and label templates.

| Table | Key Columns | Unique Indexes | Relations |
|-------|-------------|----------------|-----------|
| **users** | email, name, image, emailVerified, username, role, banned, banReason, banExpires | `users_email_idx` (email), `users_username_idx` (username) | has many sessions, accounts, apikeys, members, spools, printers, printProfiles, equipment, labelTemplates, racks, submissions |
| **spools** | userId, variantId, filamentId, nfcUid, nfcTagFormat, bambuTrayUid, weights (initial/current/net/spool), percentRemaining, cost, status, lifecycle dates, drying state, currentSlotId, lot/serial numbers | — | belongs to user + variant + filament + currentSlot, has many weightEvents + movements + sessions |
| **printers** | userId, name, manufacturer, model, firmware, serial, AMS info, nozzle diameter, build volume, network config | — | belongs to user, has many printProfiles + usageSessions |
| **userPrintProfiles** | userId, variantId, filamentId, printerId, name, temps, speed/flow, retraction, advanced settings (JSONB) | — | belongs to user + variant + filament + printer |
| **equipment** | userId, type, name, manufacturer, model, capacity, dryer-specific fields | — | belongs to user, has many dryingSessions |
| **labelTemplates** | userId, name, labelFormat, dimensions, content flags (10 booleans), qrCodeBaseUrl, customCss, isDefault | — | belongs to user |

#### Hardware (6 tables)

Physical rack infrastructure — from rack down to individual slot sensor assignments.

| Table | Key Columns | Unique Indexes | Relations |
|-------|-------------|----------------|-----------|
| **racks** | userId, name, location, shelfCount | — | belongs to user, has many bridges + shelves |
| **bridges** | rackId, hardwareId, firmwareVersion, ipAddress, hostname, connectionType, lastSeenAt, isOnline, config (JSONB) | `bridges_hardware_id_idx` (hardwareId) | belongs to rack |
| **shelves** | rackId, position, hardwareId, canAddress, firmwareVersion, bayCount, hasTempHumiditySensor, lastSeenAt, isOnline | — | belongs to rack, has many bays + environmentalReadings |
| **bays** | shelfId, position | — | belongs to shelf, has many slots |
| **slots** | bayId, position, hx711Channel, nfcReaderIndex, displayIndex, ledIndex, phoneNfcUrl, calibrationFactor, lastCalibratedAt | — | belongs to bay, has one slotStatus |
| **slotStatus** | slotId, state, spoolId, nfcUid, nfcPresent, weightRawG, weightStableG, weightIsStable, percentRemaining, temperatureC, humidityPercent, stateEnteredAt, lastReportAt | `slot_status_slot_id_idx` (slotId) | belongs to slot |

#### Events (5 tables)

Time-series and session data. Append-only tables have `createdAt` only; session tables have `createdAt` and support update (no `updatedAt` column, no delete).

| Table | Pattern | Key Columns | Relations |
|-------|---------|-------------|-----------|
| **weightEvents** | append-only | spoolId, slotId, eventType, weightG, previousWeightG, deltaG, percentRemaining, nfcUid, metadata (JSONB) | belongs to spool + slot |
| **spoolMovements** | append-only | spoolId, fromSlotId, toSlotId, weightAtMoveG | belongs to spool + fromSlot + toSlot |
| **usageSessions** | create + update | spoolId, userId, printerId, removedFromSlotId, returnedToSlotId, weights before/after, filament used, cost, timestamps, printJobId | belongs to spool + printer + slots |
| **dryingSessions** | create + update | spoolId, userId, equipmentId, temperatureC, durationMinutes, weights before/after, moistureLostG, timestamps | belongs to spool + equipment |
| **environmentalReadings** | append-only | shelfId, temperatureC, humidityPercent | belongs to shelf |

---

## Server Actions Layer

### Architecture

All actions live in `src/lib/actions/` and are importable from `@/lib/actions`.

**Return type** — every action returns `Promise<ActionResult<T>>`:

```ts
type ActionResult<T> =
  | { data: T; error: null }    // success
  | { data: null; error: string } // failure
```

**Validation** — input is validated with drizzle-zod schemas before reaching the database. Server-managed fields (`id`, `createdAt`, `updatedAt`) are omitted from input schemas.

**updatedAt** — set to `new Date()` in the action layer on mutations. Event/session tables without `updatedAt` columns skip this.

### Factory Patterns

Three factories in `utils.ts` generate standard operations from a Drizzle table + Zod schemas:

| Factory | Generated Operations | Used For |
|---------|---------------------|----------|
| `createCrudActions` | create, getById, list, update, remove | Most tables (20) |
| `createAppendOnlyActions` | create, list | weightEvents, spoolMovements, environmentalReadings |
| `createUpsertActions` | upsert, getByKey | slotStatus |

Session tables (usageSessions, dryingSessions) use `createCrudActions` with `setUpdatedAt: false` and only expose create + getById + update (no list/remove).

### All Actions by Domain (152 total)

#### central-catalog.ts (53 actions)

**brands** (6)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createBrand` | `(input) => ActionResult<Brand>` | |
| `getBrandById` | `(id) => ActionResult<Brand>` | |
| `listBrands` | `(params? & { search? }) => ActionResult<Brand[]>` | ilike search on name |
| `updateBrand` | `(id, input) => ActionResult<Brand>` | |
| `removeBrand` | `(id) => ActionResult<{ id }>` | |
| `getBrandBySlug` | `(slug) => ActionResult<Brand>` | Lookup by unique slug |

**materials** (5)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createMaterial` | `(input) => ActionResult<Material>` | |
| `getMaterialById` | `(id) => ActionResult<Material>` | |
| `listMaterials` | `(params? & { search?, materialClass? }) => ActionResult<Material[]>` | Search + enum filter |
| `updateMaterial` | `(id, input) => ActionResult<Material>` | |
| `removeMaterial` | `(id) => ActionResult<{ id }>` | |

**filaments** (6)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createFilament` | `(input) => ActionResult<Filament>` | |
| `getFilamentById` | `(id) => ActionResult<Filament>` | |
| `listFilaments` | `(params? & { brandId?, materialId?, search? }) => ActionResult<Filament[]>` | Multi-filter |
| `updateFilament` | `(id, input) => ActionResult<Filament>` | |
| `removeFilament` | `(id) => ActionResult<{ id }>` | |
| `getFilamentWithRelations` | `(id) => ActionResult<Filament & { brand, material, variants }>` | Eager-loads brand + material + variants |

**variants** (7)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createVariant` | `(input) => ActionResult<Variant>` | |
| `getVariantById` | `(id) => ActionResult<Variant>` | |
| `listVariants` | `(params?) => ActionResult<Variant[]>` | |
| `updateVariant` | `(id, input) => ActionResult<Variant>` | |
| `removeVariant` | `(id) => ActionResult<{ id }>` | |
| `listVariantsByFilament` | `(filamentId, params?) => ActionResult<Variant[]>` | Filter by parent |
| `getVariantWithRelations` | `(id) => ActionResult<Variant & { filament, skuMappings, nfcTagPatterns }>` | Eager-loads children |

**skuMappings** (7)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createSkuMapping` | `(input) => ActionResult<SkuMapping>` | |
| `getSkuMappingById` | `(id) => ActionResult<SkuMapping>` | |
| `listSkuMappings` | `(params?) => ActionResult<SkuMapping[]>` | |
| `updateSkuMapping` | `(id, input) => ActionResult<SkuMapping>` | |
| `removeSkuMapping` | `(id) => ActionResult<{ id }>` | |
| `getSkuByCode` | `(sku) => ActionResult<SkuMapping>` | Lookup by unique SKU code |
| `listSkusByVariant` | `(variantId, params?) => ActionResult<SkuMapping[]>` | Filter by parent |

**nfcTagPatterns** (10)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createNfcTagPattern` | `(input) => ActionResult<NfcTagPattern>` | |
| `getNfcTagPatternById` | `(id) => ActionResult<NfcTagPattern>` | |
| `listNfcTagPatterns` | `(params?) => ActionResult<NfcTagPattern[]>` | |
| `updateNfcTagPattern` | `(id, input) => ActionResult<NfcTagPattern>` | |
| `removeNfcTagPattern` | `(id) => ActionResult<{ id }>` | |
| `lookupByBambu` | `(bambuVariantId, bambuMaterialId) => ActionResult<NfcTagPattern[]>` | Identify spool from Bambu NFC |
| `lookupByTigerTag` | `(tigerTagProductId) => ActionResult<NfcTagPattern[]>` | Identify spool from TigerTag |
| `lookupByOpenPrintTag` | `(optPackageUuid) => ActionResult<NfcTagPattern[]>` | Identify spool from OpenPrintTag |
| `listPatternsByVariant` | `(variantId, params?) => ActionResult<NfcTagPattern[]>` | Filter by parent |

**equivalenceGroups** (6)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createEquivalenceGroup` | `(input) => ActionResult<EquivalenceGroup>` | |
| `getEquivalenceGroupById` | `(id) => ActionResult<EquivalenceGroup>` | |
| `listEquivalenceGroups` | `(params?) => ActionResult<EquivalenceGroup[]>` | |
| `updateEquivalenceGroup` | `(id, input) => ActionResult<EquivalenceGroup>` | |
| `removeEquivalenceGroup` | `(id) => ActionResult<{ id }>` | |
| `getGroupWithFilaments` | `(id) => ActionResult<Group & { filamentEquivalences: [{ filament }] }>` | Deep eager load |

**filamentEquivalences** (7)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createFilamentEquivalence` | `(input) => ActionResult<FilamentEquivalence>` | |
| `getFilamentEquivalenceById` | `(id) => ActionResult<FilamentEquivalence>` | |
| `listFilamentEquivalences` | `(params?) => ActionResult<FilamentEquivalence[]>` | |
| `updateFilamentEquivalence` | `(id, input) => ActionResult<FilamentEquivalence>` | |
| `removeFilamentEquivalence` | `(id) => ActionResult<{ id }>` | |
| `listEquivalencesByGroup` | `(groupId) => ActionResult<FilamentEquivalence[]>` | All filaments in a group |
| `listEquivalencesByFilament` | `(filamentId) => ActionResult<FilamentEquivalence[]>` | All groups a filament belongs to |

---

#### submissions.ts (8 actions)

| Action | Signature | Notes |
|--------|-----------|-------|
| `createCatalogSubmission` | `(input) => ActionResult<CatalogSubmission>` | |
| `getCatalogSubmissionById` | `(id) => ActionResult<CatalogSubmission>` | |
| `listCatalogSubmissions` | `(params?) => ActionResult<CatalogSubmission[]>` | |
| `updateCatalogSubmission` | `(id, input) => ActionResult<CatalogSubmission>` | |
| `removeCatalogSubmission` | `(id) => ActionResult<{ id }>` | |
| `listSubmissionsByUser` | `(userId, params?) => ActionResult<CatalogSubmission[]>` | User's own submissions |
| `listPendingSubmissions` | `(params?) => ActionResult<CatalogSubmission[]>` | Admin review queue |
| `reviewSubmission` | `(id, reviewerId, status, reviewNotes?) => ActionResult<CatalogSubmission>` | Sets reviewer, status, notes, reviewedAt |

---

#### user-library.ts (36 actions)

**users** (6)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createUser` | `(input) => ActionResult<User>` | |
| `getUserById` | `(id) => ActionResult<User>` | |
| `listUsers` | `(params?) => ActionResult<User[]>` | |
| `updateUser` | `(id, input) => ActionResult<User>` | |
| `removeUser` | `(id) => ActionResult<{ id }>` | |
| `getUserByEmail` | `(email) => ActionResult<User>` | Auth lookup |

**spools** (7)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createSpool` | `(input) => ActionResult<Spool>` | |
| `getSpoolById` | `(id) => ActionResult<Spool>` | |
| `listSpools` | `(params?) => ActionResult<Spool[]>` | |
| `updateSpool` | `(id, input) => ActionResult<Spool>` | |
| `removeSpool` | `(id) => ActionResult<{ id }>` | |
| `listSpoolsByUser` | `(userId, params? & { status? }) => ActionResult<Spool[]>` | Filter by user + spool status |
| `getSpoolWithRelations` | `(id) => ActionResult<Spool & { variant, filament, currentSlot }>` | Eager-loads variant + filament + slot |

**printers** (6)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createPrinter` | `(input) => ActionResult<Printer>` | |
| `getPrinterById` | `(id) => ActionResult<Printer>` | |
| `listPrinters` | `(params?) => ActionResult<Printer[]>` | |
| `updatePrinter` | `(id, input) => ActionResult<Printer>` | |
| `removePrinter` | `(id) => ActionResult<{ id }>` | |
| `listPrintersByUser` | `(userId, params?) => ActionResult<Printer[]>` | Filter by owner |

**userPrintProfiles** (7)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createUserPrintProfile` | `(input) => ActionResult<UserPrintProfile>` | |
| `getUserPrintProfileById` | `(id) => ActionResult<UserPrintProfile>` | |
| `listUserPrintProfiles` | `(params?) => ActionResult<UserPrintProfile[]>` | |
| `updateUserPrintProfile` | `(id, input) => ActionResult<UserPrintProfile>` | |
| `removeUserPrintProfile` | `(id) => ActionResult<{ id }>` | |
| `listProfilesByUser` | `(userId, params?) => ActionResult<UserPrintProfile[]>` | User's saved profiles |
| `listProfilesByFilament` | `(filamentId, params?) => ActionResult<UserPrintProfile[]>` | Community profiles for a filament |

**equipment** (6)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createEquipment` | `(input) => ActionResult<Equipment>` | |
| `getEquipmentById` | `(id) => ActionResult<Equipment>` | |
| `listEquipment` | `(params?) => ActionResult<Equipment[]>` | |
| `updateEquipment` | `(id, input) => ActionResult<Equipment>` | |
| `removeEquipment` | `(id) => ActionResult<{ id }>` | |
| `listEquipmentByUser` | `(userId, params?) => ActionResult<Equipment[]>` | User's equipment |

**labelTemplates** (7)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createLabelTemplate` | `(input) => ActionResult<LabelTemplate>` | |
| `getLabelTemplateById` | `(id) => ActionResult<LabelTemplate>` | |
| `listLabelTemplates` | `(params?) => ActionResult<LabelTemplate[]>` | |
| `updateLabelTemplate` | `(id, input) => ActionResult<LabelTemplate>` | |
| `removeLabelTemplate` | `(id) => ActionResult<{ id }>` | |
| `listTemplatesByUser` | `(userId, params?) => ActionResult<LabelTemplate[]>` | User's templates |
| `getDefaultTemplate` | `(userId) => ActionResult<LabelTemplate>` | User's default template |

---

#### hardware.ts (34 actions)

**racks** (7)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createRack` | `(input) => ActionResult<Rack>` | |
| `getRackById` | `(id) => ActionResult<Rack>` | |
| `listRacks` | `(params?) => ActionResult<Rack[]>` | |
| `updateRack` | `(id, input) => ActionResult<Rack>` | |
| `removeRack` | `(id) => ActionResult<{ id }>` | |
| `listRacksByUser` | `(userId, params?) => ActionResult<Rack[]>` | User's racks |
| `getRackTopology` | `(id) => ActionResult<Rack & { shelves: [{ bays: [{ slots: [{ status }] }] }] }>` | Full tree: rack -> shelves -> bays -> slots -> status |

**bridges** (7)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createBridge` | `(input) => ActionResult<Bridge>` | |
| `getBridgeById` | `(id) => ActionResult<Bridge>` | |
| `listBridges` | `(params?) => ActionResult<Bridge[]>` | |
| `updateBridge` | `(id, input) => ActionResult<Bridge>` | |
| `removeBridge` | `(id) => ActionResult<{ id }>` | |
| `listBridgesByRack` | `(rackId, params?) => ActionResult<Bridge[]>` | Bridges in a rack |
| `getBridgeByHardwareId` | `(hardwareId) => ActionResult<Bridge>` | Lookup by ESP32 hardware ID |

**shelves** (6)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createShelf` | `(input) => ActionResult<Shelf>` | |
| `getShelfById` | `(id) => ActionResult<Shelf>` | |
| `listShelves` | `(params?) => ActionResult<Shelf[]>` | |
| `updateShelf` | `(id, input) => ActionResult<Shelf>` | |
| `removeShelf` | `(id) => ActionResult<{ id }>` | |
| `listShelvesByRack` | `(rackId, params?) => ActionResult<Shelf[]>` | Shelves in a rack |

**bays** (6)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createBay` | `(input) => ActionResult<Bay>` | |
| `getBayById` | `(id) => ActionResult<Bay>` | |
| `listBays` | `(params?) => ActionResult<Bay[]>` | |
| `updateBay` | `(id, input) => ActionResult<Bay>` | |
| `removeBay` | `(id) => ActionResult<{ id }>` | |
| `listBaysByShelf` | `(shelfId, params?) => ActionResult<Bay[]>` | Bays in a shelf |

**slots** (6)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createSlot` | `(input) => ActionResult<Slot>` | |
| `getSlotById` | `(id) => ActionResult<Slot>` | |
| `listSlots` | `(params?) => ActionResult<Slot[]>` | |
| `updateSlot` | `(id, input) => ActionResult<Slot>` | |
| `removeSlot` | `(id) => ActionResult<{ id }>` | |
| `listSlotsByBay` | `(bayId, params?) => ActionResult<Slot[]>` | Slots in a bay |

**slotStatus** (2) — upsert pattern
| Action | Signature | Notes |
|--------|-----------|-------|
| `upsertSlotStatus` | `(input) => ActionResult<SlotStatus>` | Insert or update on slotId conflict |
| `getSlotStatusBySlotId` | `(slotId) => ActionResult<SlotStatus>` | Current status for a slot |

---

#### events.ts (21 actions)

**weightEvents** — append-only (4)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createWeightEvent` | `(input) => ActionResult<WeightEvent>` | |
| `listWeightEvents` | `(params?) => ActionResult<WeightEvent[]>` | |
| `listWeightEventsBySpoolId` | `(spoolId, params? & { from?, to? }) => ActionResult<WeightEvent[]>` | Time-range filter |
| `listWeightEventsBySlotId` | `(slotId, params? & { from?, to? }) => ActionResult<WeightEvent[]>` | Time-range filter |

**spoolMovements** — append-only (3)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createSpoolMovement` | `(input) => ActionResult<SpoolMovement>` | |
| `listSpoolMovements` | `(params?) => ActionResult<SpoolMovement[]>` | |
| `listSpoolMovementsBySpoolId` | `(spoolId, params?) => ActionResult<SpoolMovement[]>` | Movement history |

**usageSessions** — create + update (5)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createUsageSession` | `(input) => ActionResult<UsageSession>` | |
| `getUsageSessionById` | `(id) => ActionResult<UsageSession>` | |
| `updateUsageSession` | `(id, input) => ActionResult<UsageSession>` | No updatedAt, no delete |
| `listUsageSessionsBySpoolId` | `(spoolId, params?) => ActionResult<UsageSession[]>` | |
| `listUsageSessionsByUser` | `(userId, params?) => ActionResult<UsageSession[]>` | |

**dryingSessions** — create + update (5)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createDryingSession` | `(input) => ActionResult<DryingSession>` | |
| `getDryingSessionById` | `(id) => ActionResult<DryingSession>` | |
| `updateDryingSession` | `(id, input) => ActionResult<DryingSession>` | No updatedAt, no delete |
| `listDryingSessionsBySpoolId` | `(spoolId, params?) => ActionResult<DryingSession[]>` | |
| `listDryingSessionsByUser` | `(userId, params?) => ActionResult<DryingSession[]>` | |

**environmentalReadings** — append-only (3)
| Action | Signature | Notes |
|--------|-----------|-------|
| `createEnvironmentalReading` | `(input) => ActionResult<EnvironmentalReading>` | |
| `listEnvironmentalReadings` | `(params?) => ActionResult<EnvironmentalReading[]>` | |
| `listEnvironmentalReadingsByShelfId` | `(shelfId, params? & { from?, to? }) => ActionResult<EnvironmentalReading[]>` | Time-range filter |

---

## Validation Schemas

All schemas are centralized in `src/lib/actions/schemas.ts` using `createInsertSchema` and `createUpdateSchema` from drizzle-zod. Server-managed fields are omitted.

| Schema | Source Table | Omitted Fields |
|--------|-------------|----------------|
| `insertBrandSchema` / `updateBrandSchema` | brands | id, createdAt, updatedAt |
| `insertMaterialSchema` / `updateMaterialSchema` | materials | id, createdAt, updatedAt |
| `insertFilamentSchema` / `updateFilamentSchema` | filaments | id, createdAt, updatedAt |
| `insertVariantSchema` / `updateVariantSchema` | variants | id, createdAt, updatedAt |
| `insertSkuMappingSchema` / `updateSkuMappingSchema` | skuMappings | id, createdAt, updatedAt |
| `insertNfcTagPatternSchema` / `updateNfcTagPatternSchema` | nfcTagPatterns | id, createdAt, updatedAt |
| `insertEquivalenceGroupSchema` / `updateEquivalenceGroupSchema` | equivalenceGroups | id, createdAt, updatedAt |
| `insertFilamentEquivalenceSchema` / `updateFilamentEquivalenceSchema` | filamentEquivalences | id, createdAt, updatedAt |
| `insertCatalogSubmissionSchema` / `updateCatalogSubmissionSchema` | catalogSubmissions | id, createdAt, updatedAt |
| `insertUserSchema` / `updateUserSchema` | users | id, createdAt, updatedAt |
| `insertSpoolSchema` / `updateSpoolSchema` | spools | id, createdAt, updatedAt |
| `insertPrinterSchema` / `updatePrinterSchema` | printers | id, createdAt, updatedAt |
| `insertUserPrintProfileSchema` / `updateUserPrintProfileSchema` | userPrintProfiles | id, createdAt, updatedAt |
| `insertEquipmentSchema` / `updateEquipmentSchema` | equipment | id, createdAt, updatedAt |
| `insertLabelTemplateSchema` / `updateLabelTemplateSchema` | labelTemplates | id, createdAt, updatedAt |
| `insertRackSchema` / `updateRackSchema` | racks | id, createdAt, updatedAt |
| `insertBridgeSchema` / `updateBridgeSchema` | bridges | id, createdAt, updatedAt |
| `insertShelfSchema` / `updateShelfSchema` | shelves | id, createdAt, updatedAt |
| `insertBaySchema` / `updateBaySchema` | bays | id, createdAt, updatedAt |
| `insertSlotSchema` / `updateSlotSchema` | slots | id, createdAt, updatedAt |
| `insertSlotStatusSchema` | slotStatus | id, createdAt, updatedAt |
| `insertWeightEventSchema` | weightEvents | id, createdAt |
| `insertSpoolMovementSchema` | spoolMovements | id, createdAt |
| `insertEnvironmentalReadingSchema` | environmentalReadings | id, createdAt |
| `insertUsageSessionSchema` / `updateUsageSessionSchema` | usageSessions | id, createdAt |
| `insertDryingSessionSchema` / `updateDryingSessionSchema` | dryingSessions | id, createdAt |

---

## Usage

All actions are importable from the barrel export:

```ts
import { createBrand, listFilaments, upsertSlotStatus } from "@/lib/actions";
```

Or from individual domain files:

```ts
import { getRackTopology } from "@/lib/actions/hardware";
```

Standard call pattern:

```ts
const result = await createBrand({ name: "Bambu Lab", slug: "bambu-lab" });

if (result.error) {
  console.error(result.error);
  return;
}

console.log(result.data); // Brand object
```

Pagination:

```ts
const result = await listFilaments({ limit: 20, offset: 40, brandId: "..." });
```

Time-range queries (events):

```ts
const result = await listWeightEventsBySlotId(slotId, {
  from: new Date("2026-01-01"),
  to: new Date("2026-02-01"),
  limit: 100,
});
```
