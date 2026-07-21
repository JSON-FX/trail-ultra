# Admin — Event Editor Structured Inputs (PSGC address + date/time) — Design Spec (Plan 12; M3)

- **Status:** Approved (brainstorm 2026-07-21)
- **Owner:** Product (jayson@voltcontent.com)
- **Feeds:** superpowers:writing-plans → implementation plan
- **Relates to:** [Plan 11 event images](2026-07-21-event-images-design.md) (the sibling half of the same editor request; its §9/§2.6 explicitly deferred "PSGC pickers + real date/time/number inputs → Plan 12"); [Plan 10 events management](2026-07-21-events-management-design.md) (the editor this modifies); [Plan 8 PSGC addresses](2026-07-20-psgc-addresses-design.md) (the `psgc_*` tables + `events` PSGC columns this reuses).

## 1. Goal

Replace the admin event editor's **free-text address** and **plain-text date/time** fields with structured inputs:

- **PSGC location** — three cascading **Region → Province → City/Municipality** dropdowns (replacing the free-text `PLACE` / `REGION` boxes), plus a free-text **Venue** field for the exact spot.
- **Real date input** for the event date (replacing the `YYYY-MM-DD` text box).
- **Real time input** for flag-off (replacing the `HH:MM` text box).

The events table already has the structured columns (`city_psgc_code`, `region_name`, `province_name`, `city_name`, `venue` — from Plan 8's `20260720140200_events_psgc.sql`), the `psgc_*` reference tables are seeded and readable, and the mobile app already **consumes** these fields (marketplace search + event page). This plan is the missing **admin write path** for them. It is **web-only** — no backend, migration, RLS, or mobile change.

## 2. Decisions (from brainstorm)

1. **Cascading native `<select>`s**, not a ported mobile drill-down panel — idiomatic for a web form, keyboard-friendly with built-in type-ahead, and matches the editor's existing Status `<select>`.
2. **City/Municipality depth — no barangay** (unchanged from Plan 8/11; barangay stays out of scope).
3. **No schema/RLS/backend change.** `psgc_regions/provinces/cities` are already `select using (true)` + granted to `authenticated` (`20260720140000_psgc_tables.sql`); the `events` PSGC + `venue` columns already exist; all are nullable, so a structured address is **optional**.
4. **Legacy `place` / `region` are retired from the editor UI** but left in the DB untouched (old events keep them; mobile `formatAddress` already prefers the PSGC fields and falls back to `place`/`region`). The editor stops reading/writing `place`/`region`.
5. **Reuse the shared `PsgcAddress` type + `formatAddress`** (`@race-pace/shared`) and mirror the mobile PSGC query hooks on web (don't invent a new address shape).

## 3. PSGC data hooks (web)

New `apps/web/src/lib/psgc.ts`, mirroring `apps/mobile/lib/psgc.ts` (supabase-js + TanStack Query v5):

```ts
type PsgcRow = { code: string; name: string };
usePsgcRegions(): rows of psgc_regions (code,name order name)
usePsgcProvinces(regionCode?): psgc_provinces where region_code = regionCode (enabled when regionCode)
usePsgcCities({ provinceCode?, regionCode? }): psgc_cities where province_code = provinceCode,
    else region_code = regionCode (enabled when either); order name
usePsgcCity(code?): the single psgc_cities row {code,name,province_code,region_code} for edit-seed (enabled when code)
```

`psgc_cities.province_code` is nullable (NCR / independent cities); `region_code` is `not null`. These hooks need no auth beyond the anon/authenticated `select` grant already in place.

## 4. `PsgcAddressField` component (web)

New `apps/web/src/components/PsgcAddressField.tsx`. Contract mirrors the mobile picker:

```ts
PsgcAddressField({ value: PsgcAddress | null; onChange: (a: PsgcAddress) => void })
// PsgcAddress = { city_psgc_code, city_name, province_name, region_name } (all string | null)
```

Three dependent selects:

- **Region** — options from `usePsgcRegions()`. Includes a blank "— Select region —" option. Changing it resets province + city.
- **Province** — options from `usePsgcProvinces(regionCode)`; **disabled** until a region is chosen. If the chosen region has **no provinces** (`provinces.data.length === 0`, e.g. NCR), the Province select is hidden/disabled and City filters by region directly. Changing it resets city.
- **City / Municipality** — options from `usePsgcCities({ provinceCode, regionCode: <only when the region has no provinces> })`; **disabled** until a province is chosen (or, for province-less regions, until the region is chosen).

**Progressive emit** (each select change emits the current partial `PsgcAddress`, so partial addresses can be saved):
- Region → `{ city_psgc_code: null, city_name: null, province_name: null, region_name }`
- Province → `{ …null city, province_name, region_name }`
- City → `{ city_psgc_code, city_name, province_name, region_name }`
- Clearing the region → `{ null, null, null, null }`

Region/province **names** for the emit come from the loaded region/province option rows (lookup by code).

**Edit-mode seeding:** the field holds local `regionCode` / `provinceCode` state that drives the option queries. On mount, if `value.city_psgc_code` is set, `usePsgcCity(value.city_psgc_code)` recovers `region_code` + `province_code`; a **seed-once** guard sets `regionCode`/`provinceCode` from it so all three selects show the current value. (The stored `region_name`/`province_name`/`city_name` render as the selected option labels once the code-driven option lists load.)

## 5. Editor changes (`EventEditor.tsx`)

Left "Event details" card:

| Was | Becomes |
| --- | --- |
| `PLACE` / `REGION` (two text inputs) | **`PsgcAddressField`** (spans the row) + a **`VENUE`** text input |
| `DATE` — `<input placeholder="YYYY-MM-DD">` | `<input type="date">` (native value is `YYYY-MM-DD`, matches `event_date`) |
| `FLAG-OFF` — `<input placeholder="HH:MM">` | `<input type="time">` (native value is `HH:MM`, matches `flag_off`) |
| `ELEVATION` / `CUTOFF` | unchanged (already `type="number"`) |

Thread the structured columns through the write/read/validation layers exactly as `gallery` was threaded in Plan 11:

- **`EventDraft`** (`eventWrites.ts`): drop `place`/`region`; add `city_psgc_code`, `region_name`, `province_name`, `city_name`, `venue` (all `string | null`). **`EVENT_COLS`**: same swap (so the editor stops writing `place`/`region` and writes the 5 new columns on both insert and update).
- **`EditorEvent`** + `useEventForEditor` select (`events.ts`): drop `place`/`region`, add the 5 columns to the select string.
- **`eventInputSchema`** (`validation.ts`): drop `place`/`region`; add the 5 as `z.string().nullable()`. `event_date` (`YYYY-MM-DD`) and `flag_off` (`HH:MM`) regex validators are unchanged — the native `date`/`time` inputs already emit those formats.
- **`blank`** default + edit seed (`EventEditor.tsx`): initialize the 5 fields to `null`; wire `PsgcAddressField value={{ city_psgc_code, city_name, province_name, region_name }} onChange={(a) => set(a)}` and `VENUE` → `set({ venue })`.

## 6. Events list display (small adjacent fix)

`useOrgEvents` currently selects `place` and the list row shows it; new events have no `place`, so they'd show blank. Add `city_name`, `province_name` to `AdminEventRow` + the `useOrgEvents` select, and render `formatAddress({ city_name, province_name }) || place` (PSGC first, legacy fallback). Keeps the list location column populated for both old and new events.

## 7. Edge cases & error handling

| Case | Behavior |
| --- | --- |
| No address chosen | Allowed — all PSGC columns null (address is optional) |
| Region chosen, no province/city yet | Saves `region_name` only; `formatAddress` shows "" (city-less) until a city is set |
| NCR / province-less region | Province step skipped; City filters by `region_code`; `province_name` stays null |
| Edit an event with a legacy `place`/`region` but no PSGC | The picker starts empty (nothing to seed from a city code); the list still shows the legacy `place` via the fallback; saving sets PSGC and leaves the stale `place` untouched |
| Edit an event that has `city_psgc_code` | `usePsgcCity` seeds all three selects to the current value |
| Change region on an existing address | Province + city reset; emit clears city fields; admin re-picks down the chain |
| Invalid date/time | Native `date`/`time` inputs constrain input; the `YYYY-MM-DD` / `HH:MM` regexes remain the backstop |
| `psgc_*` query fails | Selects render empty (loading/empty state); Save not blocked (address optional) |

## 8. Testing (web only — no backend change)

- **PSGC hooks** (`psgc.ts`) — mock supabase: each hook queries the right table/filters, `enabled` gates on its parent code.
- **`PsgcAddressField`** — mock the hooks: selecting Region enables Province; selecting Province enables City; picking City emits the full `PsgcAddress`; a province-less region skips Province and filters City by region; edit-seed (`value` with a `city_psgc_code` → `usePsgcCity` stub) pre-selects all three; changing Region resets Province/City and emits cleared city fields.
- **Editor integration** (`event-editor.test.tsx` additions) — the editor renders `PsgcAddressField` + `Venue` + a `type="date"` and `type="time"` input (and no longer the `PLACE`/`REGION`/hero-URL fields); a save carries `city_psgc_code`/`region_name`/`province_name`/`city_name`/`venue`/`event_date`/`flag_off`; the validation gate still blocks an empty name.
- **Validation** (`validation.test.ts`) — `eventInputSchema` accepts the new nullable PSGC/venue fields and still enforces the date/time formats.
- **Events list** (`events.test.tsx` / actions) — a row with PSGC fields shows `formatAddress`; a legacy-only row falls back to `place`.

## 9. Out of scope (later)

- **Barangay** (City/Municipality depth stays).
- **Searchable city combobox** (native `<select>` type-ahead suffices for MVP).
- **Backfilling** existing `place`/`region` events into PSGC codes.
- **Any mobile change** — the mobile editor/`PsgcAddressPicker` already exists; this plan only brings the web admin to parity.
- **Dropping the `place`/`region` columns** — left in place for backward-compatible display.

## 10. File touch-list (for writing-plans)

- **Create (web):** `apps/web/src/lib/psgc.ts` (4 hooks) · `apps/web/src/components/PsgcAddressField.tsx` (cascading selects + edit-seed) · web tests (`psgc-hooks`, `psgc-address-field`).
- **Modify (web):** `apps/web/src/routes/EventEditor.tsx` (swap PLACE/REGION → `PsgcAddressField` + Venue; DATE → `type="date"`; FLAG-OFF → `type="time"`; thread the 5 fields into `blank`/seed) · `apps/web/src/lib/eventWrites.ts` (`EventDraft` + `EVENT_COLS`: −place/region +5 cols) · `apps/web/src/lib/events.ts` (`EditorEvent` + editor `select`; `AdminEventRow` + `useOrgEvents` select add `city_name`/`province_name`) · `apps/web/src/lib/validation.ts` (`eventInputSchema`: −place/region +5 nullable) · `apps/web/src/routes/Events.tsx` (row shows `formatAddress` || place) · `apps/web/src/__tests__/*` (event-editor, validation, events).
- **Reuse (no change):** `@race-pace/shared` `PsgcAddress` + `formatAddress`; `psgc_*` tables; the `events` PSGC + `venue` columns.
- **Docs:** add Plan 12 to `docs/README.md` roadmap (already renumbered there).
