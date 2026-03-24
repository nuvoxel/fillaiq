# Design System: FillaIQ — Modern Maker
**Project ID:** 7103880446245820747

## 1. Visual Theme & Atmosphere

**Modern Maker** — a light, tactile, workshop-inspired interface for hardware enthusiasts and 3D printing farm operators. The aesthetic balances clean minimalism with maker-culture warmth: crisp white surfaces float above soft gray grounds, vivid cyan and neon-green accents signal live data and healthy status, and subtle card elevation creates a sense of physical depth — like well-organized tool drawers. The mood is **airy, precise, and approachable** — a visual command center that feels engineered yet inviting.

Typography mixes geometric display type with humanist body copy, grounding technical data in readability. Interactive elements respond with micro-animations and lift effects, reinforcing the "tactile" identity. A secondary OLED display motif (dark panels with monospaced retro type and cyan glow) appears on hardware-status components, bridging the digital UI with the physical devices it manages.

## 2. Color Palette & Roles

| Name | Hex | Role |
|------|-----|------|
| **Maker Cyan** | `#00D2FF` | Primary accent — buttons, active states, links, progress indicators, OLED glow |
| **Live Green** | `#00E676` | Success, online status, healthy readings, positive deltas |
| **Alert Rose** | `#FF2A5F` | Danger, offline status, low-stock warnings, destructive actions |
| **Workshop White** | `#FFFFFF` | Card surfaces, modal backgrounds, input fields |
| **Soft Ground** | `#F4F6F8` | Page background, table stripes, secondary panels |
| **Blueprint Slate** | `#1A2530` | Primary text, headings, high-contrast foreground, OLED panel background |
| **Tool Gray** | `#94A3B8` | Muted text, secondary labels, placeholders, scrollbar thumbs |
| **Deep Workshop** | `#0F1F23` | Dark-mode surfaces, OLED display backgrounds, sidebar accents |
| **Signal Orange** | `#FF7A00` | Warning state, featured/highlighted items, attention indicators |

**Usage notes:**
- Cyan is the signature brand color — use it sparingly for interactive and status elements, never as a large fill
- Green and Rose are reserved exclusively for semantic status (success/danger)
- The slate-to-gray text scale provides three clear contrast tiers: Blueprint Slate for primary, Tool Gray for secondary, Soft Ground for disabled/background

## 3. Typography Rules

| Role | Family | Weight | Tracking | Notes |
|------|--------|--------|----------|-------|
| **Display / Headings** | Space Grotesk | 600–700 | Tight (-0.02em) | Geometric, technical character; used for page titles, stat values, card headers |
| **Body / UI** | DM Sans | 400–500 | Normal | Humanist sans-serif; paragraphs, labels, table cells, form inputs |
| **Monospace / Data** | DM Mono | 400 | Normal | Technical values, sensor readings, IDs, code snippets |
| **OLED Retro** | VT323 | 400 | Normal | Used exclusively inside OLED-style hardware display panels for nostalgic CRT/LED feel |

**Hierarchy:** H1 uses Space Grotesk at 28–32px/700. H2 at 22–24px/600. Body at 14–16px DM Sans/400. Small labels at 12px DM Sans/500 uppercase with wider tracking for category chips.

## 4. Component Stylings

### Buttons
- **Primary:** Maker Cyan (`#00D2FF`) fill, white text, subtly rounded corners (8px). On hover: slight lift (-2px translateY) with deeper shadow. On press: scale(0.98).
- **Danger:** Alert Rose fill, white text, same shape language.
- **Ghost/Secondary:** Transparent with 1px Blueprint Slate border, slate text. Hover fills with Soft Ground.
- **Pill badges:** Full-round (9999px) for status tags and counts.

### Cards & Containers
- **Surface cards:** Workshop White background, 12px border radius, tactile shadow (`0 4px 12px rgba(26, 37, 48, 0.06)`). On hover: elevated shadow (`0 8px 16px rgba(0, 0, 0, 0.08)`) with subtle lift.
- **Inset border effect:** `inset 0 0 0 1px rgba(255, 255, 255, 0.8)` gives cards a beveled, physical-object feel.
- **Shelf/rack containers:** Dashed 2px borders for empty slots, solid 2px borders for occupied positions — emphasizing the physical-grid metaphor.

### Inputs & Forms
- White background, 1px solid `#E2E8F0` border, 8px radius.
- Focus state: 2px Maker Cyan ring, subtle cyan glow shadow.
- Labels in DM Sans 500, Tool Gray, positioned above the input.

### OLED Display Panels
- Deep Workshop (`#0F1F23`) or Blueprint Slate (`#1A2530`) background.
- VT323 monospaced type in Maker Cyan with `text-shadow: 0 0 4px rgba(0, 210, 255, 0.5)` glow.
- Used for hardware device status, sensor readouts, scan station displays.
- Subtle ping/pulse animations on live data indicators.

### Data Tables
- Alternating row stripes: Workshop White / Soft Ground.
- Header row: DM Sans 500, uppercase, Tool Gray, 12px.
- Row hover: very faint cyan tint.

### Progress & Status
- **Progress rings/bars:** Maker Cyan fill on Soft Ground track.
- **Status dots:** 8px circles — Live Green (online), Alert Rose (offline), Tool Gray (unknown).
- **Weight percentage bars:** Gradient from Maker Cyan to Live Green at full.

## 5. Layout Principles

- **Sidebar + content:** Collapsible dark sidebar (Deep Workshop) with icon + label nav. Content area fills remaining width on Soft Ground.
- **Card grid:** 16–24px gap between cards. Content sections use a responsive column grid (typically 2–4 columns at desktop).
- **Generous whitespace:** Cards have 20–24px internal padding. Sections separated by 32–40px vertical spacing. The design breathes — information density is managed through card grouping, not cramming.
- **Shelf metaphor:** The inventory grid maps directly to physical rack/bay/slot topology. Each shelf row is ~140px tall. Items sit in visually bounded slots, reinforcing the spatial-awareness model.
- **Stat panels:** Key metrics in compact cards at the top of dashboards — large Space Grotesk numbers with small DM Sans labels below.
- **Max content width:** ~1400px centered, with sidebar. Full-bleed backgrounds extend edge-to-edge.

## 6. Iconography & Graphics

- **Geometric line icons** — consistent 24px grid, 1.5–2px stroke, rounded caps.
- **FillaIQ logo:** Two parallel vertical pills representing the "ll" in FillaIQ.
- **Color swatches:** Circular or rounded-rect color samples appear inline next to filament/spool references — always with a subtle border for visibility on white backgrounds.
- **Machine thumbnails:** Rounded-rect image containers with 8px radius.

## 7. Animation & Interaction

- **Hover lift:** Cards and buttons translate -2px on Y axis with shadow deepening. Duration: 200ms ease.
- **Tactile press:** scale(0.98) on mousedown — 100ms ease.
- **Status ping:** `@keyframes ping` — expanding ring animation on live-status indicators.
- **Smooth transitions:** All interactive property changes use `transition: all 0.2s ease`.
- **Scrollbar styling:** 6px thin scrollbar, Tool Gray thumb with 3px radius, Soft Ground track.
