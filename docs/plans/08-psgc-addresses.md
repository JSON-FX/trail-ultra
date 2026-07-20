# PSGC Standardized Addresses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Standardize PH addresses to PSGC (Region → Province → City/Municipality) so users know exactly where an event is — implementing [docs/specs/2026-07-20-psgc-addresses-design.md](../specs/2026-07-20-psgc-addresses-design.md).

**Architecture:** Three `psgc_*` reference tables populated by a regenerable Node import (no runtime API dependency). Events + runner profile gain `city_psgc_code` + denormalized labels; events add a `venue` line. A cascading searchable picker feeds the profile now; the M3 admin reuses the same tables/component.

**Tech Stack:** Supabase (Postgres migrations + seed), Node ESM import script (global `fetch`), `@race-pace/shared` (types), Expo/React Native + TanStack Query (picker), jest-expo (mobile), Vitest (shared/backend).

## Global Constraints

- **Depth = City/Municipality + venue.** No barangay level.
- **PSGC API field maps (exact):** region `code, name, regionName→region_name, islandGroupCode→island_group_code`; province adds `regionCode→region_code`; city maps `isCity→is_city`, `provinceCode→province_code` **coercing the API's boolean `false`/`""` → SQL `null`**, `regionCode→region_code`. Endpoints: `https://psgc.gitlab.io/api/{regions,provinces,cities-municipalities}.json` (~17 / ~81 / ~1,634 rows).
- **No runtime dependency on the hobby API.** Data is generated → committed SQL → applied by `db reset`. Re-running the script refreshes it (idempotent upserts).
- **Load ordering:** `psgc_*` tables + data must apply **before** any `events`/`profiles` row sets `city_psgc_code`. Migration timestamps enforce this; `seed.sql` (runs after migrations) may reference codes.
- **`formatAddress` = "City, Province"** (null province → "City"; null city → ""). Region only on the event page's full chip.
- **Add a `venue` column** to events; keep legacy `place`/`region`/`city` columns (nullable, unused for display, never dropped).
- **PSGC fields nullable**; display always falls back to legacy free text when a code is absent.
- **RLS:** `psgc_*` are public reference data — anon `select` only, no client writes.
- **Theme:** trail-green tokens from `apps/mobile/lib/theme.ts`. No new colors.
- **Type gate:** `cd apps/mobile && npx tsc --noEmit` (NOT `pnpm -r typecheck` — pre-existing-broken: `packages/shared` has no tsconfig). Backend/shared: `pnpm vitest run <file>` from repo root.
- **Expo:** read https://docs.expo.dev/versions/v57.0.0/ before mobile code (`apps/mobile/AGENTS.md`).

## File Structure

- `supabase/migrations/20260720140000_psgc_tables.sql` — the 3 tables + RLS + indexes (hand-written)
- `scripts/import-psgc.mjs` — fetch + map + generate the data SQL (exported pure map fns + guarded `main()`)
- `supabase/migrations/20260720140100_psgc_data.sql` — **generated** idempotent upserts (committed)
- `supabase/migrations/20260720140200_events_psgc.sql` / `..140300_profiles_psgc.sql` — address columns
- `packages/shared/src/index.ts` — `PsgcAddress`, `formatAddress`
- `apps/mobile/lib/psgc.ts` — query hooks · `apps/mobile/components/PsgcAddressPicker.tsx` — the picker
- Modify: `apps/mobile/lib/events.ts`, `components/EventCard.tsx`, `app/event/[id].tsx`, `lib/profile.ts`, `app/(tabs)/profile.tsx`, `supabase/seed.sql`

Commands: mobile test `cd apps/mobile && pnpm test -- <pat>`; mobile tsc `cd apps/mobile && npx tsc --noEmit`; shared/backend `pnpm vitest run <file>`; migration apply `pnpm exec supabase db reset` (stack running). Backend tests need the stack (REST via Kong) — **not** functions-serve.

---

### Task 1: PSGC reference tables + RLS

**Files:** Create `supabase/migrations/20260720140000_psgc_tables.sql`

**Interfaces:** Produces tables `psgc_regions/psgc_provinces/psgc_cities` (code text PK; province.region_code FK; city.province_code nullable FK + city.region_code FK). Consumed by Tasks 2, 4, 6, 7.

- [ ] **Step 1: Write the migration** — `supabase/migrations/20260720140000_psgc_tables.sql`:

```sql
-- PSGC reference tables (Region → Province → City/Municipality). Public read-only.
create table psgc_regions (
  code text primary key, name text not null,
  region_name text, island_group_code text );
create table psgc_provinces (
  code text primary key, name text not null,
  region_code text not null references psgc_regions(code),
  island_group_code text );
create table psgc_cities (
  code text primary key, name text not null,
  is_city boolean not null default false,
  province_code text references psgc_provinces(code),  -- nullable: NCR / independent cities
  region_code text not null references psgc_regions(code),
  island_group_code text );
create index on psgc_provinces(region_code);
create index on psgc_cities(province_code);
create index on psgc_cities(region_code);

alter table psgc_regions   enable row level security;
alter table psgc_provinces enable row level security;
alter table psgc_cities    enable row level security;
create policy "psgc_regions_read"   on psgc_regions   for select using (true);
create policy "psgc_provinces_read" on psgc_provinces for select using (true);
create policy "psgc_cities_read"    on psgc_cities    for select using (true);
```

- [ ] **Step 2: Apply + verify the tables exist**

Run: `pnpm exec supabase db reset`
Expected: completes with no error. Confirm empty tables exist, e.g. `psql "postgresql://postgres:postgres@127.0.0.1:54522/postgres" -c "select count(*) from psgc_cities;"` → `0` (or Studio shows the 3 tables).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260720140000_psgc_tables.sql
git commit -m "feat(psgc): reference tables (regions/provinces/cities) + anon-read RLS"
```

---

### Task 2: Import script + generated data + mapping test

**Files:** Create `scripts/import-psgc.mjs`, generated `supabase/migrations/20260720140100_psgc_data.sql`; Test `supabase/tests/import-psgc.test.ts`; Modify root `package.json` (add `import:psgc` script)

**Interfaces:**
- Consumes: Task 1 tables.
- Produces: exported `mapRegion(r)`, `mapProvince(p)`, `mapCity(c)` pure fns; populated `psgc_*` tables (~1,732 rows).

- [ ] **Step 1: Write the failing mapping test** — `supabase/tests/import-psgc.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mapRegion, mapProvince, mapCity } from "../../scripts/import-psgc.mjs";

describe("PSGC field mapping", () => {
  it("maps a region", () => {
    expect(mapRegion({ code: "010000000", name: "Ilocos Region", regionName: "Region I", islandGroupCode: "luzon" }))
      .toEqual({ code: "010000000", name: "Ilocos Region", region_name: "Region I", island_group_code: "luzon" });
  });
  it("maps a province with its region parent", () => {
    expect(mapProvince({ code: "012800000", name: "Ilocos Norte", regionCode: "010000000", islandGroupCode: "luzon" }))
      .toEqual({ code: "012800000", name: "Ilocos Norte", region_code: "010000000", island_group_code: "luzon" });
  });
  it("maps a city and coerces boolean provinceCode false → null", () => {
    expect(mapCity({ code: "012801000", name: "Adams", isCity: false, isMunicipality: true, provinceCode: "012800000", regionCode: "010000000", islandGroupCode: "luzon" }))
      .toEqual({ code: "012801000", name: "Adams", is_city: false, province_code: "012800000", region_code: "010000000", island_group_code: "luzon" });
    const ncr = mapCity({ code: "133900000", name: "City of Manila", isCity: true, provinceCode: false, regionCode: "130000000", islandGroupCode: "luzon" });
    expect(ncr.province_code).toBeNull();
    expect(ncr.is_city).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run supabase/tests/import-psgc.test.ts`
Expected: FAIL — `../../scripts/import-psgc.mjs` not found.

- [ ] **Step 3: Write the import script** — `scripts/import-psgc.mjs`:

```js
// Regenerable PSGC importer: fetch the API → write idempotent upserts as a committed
// migration. Run: `node scripts/import-psgc.mjs`. No runtime dependency on the API.
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const API = "https://psgc.gitlab.io/api";
const OUT = new URL("../supabase/migrations/20260720140100_psgc_data.sql", import.meta.url);

export const mapRegion = (r) => ({ code: r.code, name: r.name, region_name: r.regionName ?? null, island_group_code: r.islandGroupCode ?? null });
export const mapProvince = (p) => ({ code: p.code, name: p.name, region_code: p.regionCode, island_group_code: p.islandGroupCode ?? null });
export const mapCity = (c) => ({ code: c.code, name: c.name, is_city: !!c.isCity, province_code: c.provinceCode || null, region_code: c.regionCode, island_group_code: c.islandGroupCode ?? null });

const lit = (v) => v === null || v === undefined ? "null" : typeof v === "boolean" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

function upserts(table, cols, rows) {
  if (!rows.length) return "";
  const values = rows.map((r) => `  (${cols.map((c) => lit(r[c])).join(",")})`).join(",\n");
  const set = cols.filter((c) => c !== "code").map((c) => `${c}=excluded.${c}`).join(", ");
  return `insert into ${table} (${cols.join(",")}) values\n${values}\non conflict (code) do update set ${set};\n`;
}

async function main() {
  const [regions, provinces, cities] = await Promise.all([
    fetch(`${API}/regions.json`).then((r) => r.json()),
    fetch(`${API}/provinces.json`).then((r) => r.json()),
    fetch(`${API}/cities-municipalities.json`).then((r) => r.json()),
  ]);
  const sql = [
    "-- GENERATED by scripts/import-psgc.mjs — do not edit by hand. Re-run to refresh.",
    upserts("psgc_regions", ["code", "name", "region_name", "island_group_code"], regions.map(mapRegion)),
    upserts("psgc_provinces", ["code", "name", "region_code", "island_group_code"], provinces.map(mapProvince)),
    upserts("psgc_cities", ["code", "name", "is_city", "province_code", "region_code", "island_group_code"], cities.map(mapCity)),
  ].join("\n");
  writeFileSync(OUT, sql);
  console.log(`Wrote ${regions.length} regions, ${provinces.length} provinces, ${cities.length} cities → ${OUT.pathname}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
```

- [ ] **Step 4: Run the test (mapping passes)**

Run: `pnpm vitest run supabase/tests/import-psgc.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Generate the data + apply + verify counts**

Add to root `package.json` scripts: `"import:psgc": "node scripts/import-psgc.mjs"`.
Run: `pnpm import:psgc` → prints "Wrote 17 regions, 81 provinces, 1634 cities" and writes `supabase/migrations/20260720140100_psgc_data.sql`.
Run: `pnpm exec supabase db reset`
Verify: `psql "postgresql://postgres:postgres@127.0.0.1:54522/postgres" -c "select (select count(*) from psgc_regions) r, (select count(*) from psgc_provinces) p, (select count(*) from psgc_cities) c;"` → `17 | 81 | 1634`.

- [ ] **Step 6: Add the backend RLS/seed test** — append to `supabase/tests/backend.test.ts` a new describe:

```ts
describe("psgc reference data", () => {
  it("anon can read psgc tables and a known city resolves its parents", async () => {
    const a = anon();
    const regions = await a.from("psgc_regions").select("code", { count: "exact", head: true });
    expect(regions.count).toBeGreaterThan(0);
    const city = await a.from("psgc_cities").select("code,name,province_code,region_code").eq("code", "012801000").maybeSingle();
    expect(city.data?.region_code).toBe("010000000");         // Adams → Ilocos Region
    const prov = await a.from("psgc_provinces").select("region_code").eq("code", city.data!.province_code!).maybeSingle();
    expect(prov.data?.region_code).toBe("010000000");
  });
});
```
Run: `pnpm vitest run supabase/tests/backend.test.ts` (stack running) → all green incl. the new case.

- [ ] **Step 7: Commit**

```bash
git add scripts/import-psgc.mjs supabase/migrations/20260720140100_psgc_data.sql supabase/tests/import-psgc.test.ts supabase/tests/backend.test.ts package.json
git commit -m "feat(psgc): import script + generated reference data + backend read test"
```

---

### Task 3: Shared `PsgcAddress` + `formatAddress`

**Files:** Modify `packages/shared/src/index.ts`, `packages/shared/src/index.test.ts`

**Interfaces:** Produces `type PsgcAddress`, `formatAddress(a)`. Consumed by Tasks 5, 6, 7.

- [ ] **Step 1: Write the failing test** — append to `packages/shared/src/index.test.ts`:

```ts
import { formatAddress } from "./index";
describe("formatAddress", () => {
  it("City, Province; null province → City; null city → ''", () => {
    expect(formatAddress({ city_name: "Digos City", province_name: "Davao del Sur" })).toBe("Digos City, Davao del Sur");
    expect(formatAddress({ city_name: "City of Manila", province_name: null })).toBe("City of Manila");
    expect(formatAddress({ city_name: null, province_name: "X" })).toBe("");
  });
});
```
(Add `formatAddress` to the existing top `import { … } from "./index"` if you prefer a single import — either compiles.)

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/shared/src/index.test.ts`
Expected: FAIL — `formatAddress` not exported.

- [ ] **Step 3: Implement** — append to `packages/shared/src/index.ts`:

```ts
/** Standardized PH address (denormalized labels ride on events/profiles). */
export type PsgcAddress = {
  city_psgc_code: string | null;
  city_name: string | null;
  province_name: string | null;
  region_name: string | null;
};

/** "Digos City, Davao del Sur" — null province → just the city; null city → "". */
export function formatAddress(a: Pick<PsgcAddress, "city_name" | "province_name">): string {
  if (!a.city_name) return "";
  return a.province_name ? `${a.city_name}, ${a.province_name}` : a.city_name;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run packages/shared/src/index.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/index.ts packages/shared/src/index.test.ts
git commit -m "feat(shared): PsgcAddress type + formatAddress"
```

---

### Task 4: `lib/psgc` query hooks

**Files:** Create `apps/mobile/lib/psgc.ts`; Test `apps/mobile/__tests__/psgc-hooks.test.tsx`

**Interfaces:** Produces `usePsgcRegions()`, `usePsgcProvinces(regionCode?)`, `usePsgcCities({provinceCode?, regionCode?, search?})` returning `PsgcRow[]` (`{code,name}`). Consumed by Task 5.

- [ ] **Step 1: Write the failing test** — `apps/mobile/__tests__/psgc-hooks.test.tsx`:

```tsx
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockOrder = jest.fn();
const mockEq = jest.fn();
const mockIlike = jest.fn();
jest.mock("../lib/supabase", () => {
  const builder: any = {};
  builder.select = jest.fn(() => builder);
  builder.eq = (...a: unknown[]) => { mockEq(...a); return builder; };
  builder.ilike = (...a: unknown[]) => { mockIlike(...a); return builder; };
  builder.order = (...a: unknown[]) => { mockOrder(...a); return Promise.resolve({ data: [{ code: "x", name: "X" }], error: null }); };
  return { supabase: { from: jest.fn(() => builder) } };
});

import { usePsgcProvinces } from "../lib/psgc";

const wrap = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return ({ children }: { children: any }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("psgc hooks", () => {
  it("usePsgcProvinces filters by region_code and is disabled without one", async () => {
    const { result } = renderHook(() => usePsgcProvinces("010000000"), { wrapper: wrap() });
    await waitFor(() => expect(result.current.data).toEqual([{ code: "x", name: "X" }]));
    expect(mockEq).toHaveBeenCalledWith("region_code", "010000000");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/mobile && pnpm test -- psgc-hooks`
Expected: FAIL — `../lib/psgc` not found.

- [ ] **Step 3: Implement** — `apps/mobile/lib/psgc.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type PsgcRow = { code: string; name: string };

export function usePsgcRegions() {
  return useQuery({ queryKey: ["psgc-regions"], queryFn: async (): Promise<PsgcRow[]> => {
    const { data, error } = await supabase.from("psgc_regions").select("code,name").order("name");
    if (error) throw error; return (data ?? []) as PsgcRow[];
  }});
}

export function usePsgcProvinces(regionCode?: string) {
  return useQuery({ queryKey: ["psgc-provinces", regionCode], enabled: !!regionCode, queryFn: async (): Promise<PsgcRow[]> => {
    const { data, error } = await supabase.from("psgc_provinces").select("code,name").eq("region_code", regionCode!).order("name");
    if (error) throw error; return (data ?? []) as PsgcRow[];
  }});
}

export function usePsgcCities({ provinceCode, regionCode, search }: { provinceCode?: string; regionCode?: string; search?: string }) {
  return useQuery({ queryKey: ["psgc-cities", provinceCode, regionCode, search], enabled: !!(provinceCode || regionCode), queryFn: async (): Promise<PsgcRow[]> => {
    let q = supabase.from("psgc_cities").select("code,name");
    if (provinceCode) q = q.eq("province_code", provinceCode);
    else if (regionCode) q = q.eq("region_code", regionCode);
    if (search) q = q.ilike("name", `%${search}%`);
    const { data, error } = await q.order("name");
    if (error) throw error; return (data ?? []) as PsgcRow[];
  }});
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/mobile && pnpm test -- psgc-hooks` → PASS. Then `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/lib/psgc.ts apps/mobile/__tests__/psgc-hooks.test.tsx
git commit -m "feat(mobile): psgc query hooks (regions/provinces/cities)"
```

---

### Task 5: `PsgcAddressPicker` component

**Files:** Create `apps/mobile/components/PsgcAddressPicker.tsx`; Test `apps/mobile/__tests__/psgc-picker.test.tsx`

**Interfaces:** Consumes Task 4 hooks + Task 3 `PsgcAddress`/`formatAddress`. Produces `PsgcAddressPicker({ value, onChange, label? })`.

- [ ] **Step 1: Write the failing test** — `apps/mobile/__tests__/psgc-picker.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

let regions: any[] = [{ code: "r1", name: "Davao Region" }];
let provinces: any[] = [{ code: "p1", name: "Davao del Sur" }];
let cities: any[] = [{ code: "c1", name: "Digos City" }, { code: "c2", name: "Bansalan" }];
jest.mock("../lib/psgc", () => ({
  usePsgcRegions: () => ({ data: regions }),
  usePsgcProvinces: () => ({ data: provinces }),
  usePsgcCities: () => ({ data: cities }),
}));

import { PsgcAddressPicker } from "../components/PsgcAddressPicker";

describe("PsgcAddressPicker", () => {
  it("cascades region → province → city and emits the address", async () => {
    const onChange = jest.fn();
    render(<PsgcAddressPicker value={null} onChange={onChange} label="LOCATION" />);
    fireEvent.press(screen.getByLabelText("LOCATION"));                 // open
    fireEvent.press(screen.getByText("Davao Region"));                  // region
    fireEvent.press(await screen.findByText("Davao del Sur"));          // province
    fireEvent.press(await screen.findByText("Digos City"));             // city
    expect(onChange).toHaveBeenCalledWith({
      city_psgc_code: "c1", city_name: "Digos City", province_name: "Davao del Sur", region_name: "Davao Region",
    });
  });

  it("shows the current value via formatAddress", () => {
    render(<PsgcAddressPicker label="LOCATION" onChange={jest.fn()}
      value={{ city_psgc_code: "c1", city_name: "Digos City", province_name: "Davao del Sur", region_name: "Davao Region" }} />);
    expect(screen.getByText("Digos City, Davao del Sur")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/mobile && pnpm test -- psgc-picker`
Expected: FAIL — component not found.

- [ ] **Step 3: Implement** — `apps/mobile/components/PsgcAddressPicker.tsx`:

```tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { usePsgcRegions, usePsgcProvinces, usePsgcCities } from "../lib/psgc";
import { formatAddress, type PsgcAddress } from "@race-pace/shared";
import { theme } from "../lib/theme";

type Node = { code: string; name: string };

export function PsgcAddressPicker({ value, onChange, label = "LOCATION" }: {
  value: PsgcAddress | null; onChange: (a: PsgcAddress) => void; label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [region, setRegion] = useState<Node | null>(null);
  const [province, setProvince] = useState<Node | null>(null);
  const [search, setSearch] = useState("");

  const regions = usePsgcRegions();
  const provinces = usePsgcProvinces(region?.code);
  const noProvinces = !!region && (provinces.data?.length ?? 0) === 0;
  const cities = usePsgcCities({ provinceCode: province?.code, regionCode: noProvinces ? region?.code : undefined, search });

  function reset() { setRegion(null); setProvince(null); setSearch(""); }
  function pickCity(c: Node) {
    onChange({ city_psgc_code: c.code, city_name: c.name, province_name: province?.name ?? null, region_name: region?.name ?? null });
    setOpen(false); reset();
  }

  const atCity = !!province || noProvinces;

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={() => setOpen((v) => !v)} accessibilityRole="button" accessibilityLabel={label}>
        <Text style={value?.city_name ? styles.val : styles.placeholder}>
          {value?.city_name ? formatAddress(value) : "Select region → province → city"}
        </Text>
      </Pressable>

      {open && (
        <View style={styles.panel}>
          {!region ? (
            <>
              <Text style={styles.step}>Region</Text>
              {(regions.data ?? []).map((r) => (
                <Pressable key={r.code} style={styles.opt} onPress={() => setRegion(r)} accessibilityRole="button"><Text style={styles.optT}>{r.name}</Text></Pressable>
              ))}
            </>
          ) : !atCity ? (
            <>
              <Pressable onPress={reset} accessibilityRole="button"><Text style={styles.crumb}>‹ {region.name}</Text></Pressable>
              <Text style={styles.step}>Province</Text>
              {(provinces.data ?? []).map((p) => (
                <Pressable key={p.code} style={styles.opt} onPress={() => setProvince(p)} accessibilityRole="button"><Text style={styles.optT}>{p.name}</Text></Pressable>
              ))}
            </>
          ) : (
            <>
              <Pressable onPress={() => (province ? setProvince(null) : reset())} accessibilityRole="button"><Text style={styles.crumb}>‹ {province?.name ?? region.name}</Text></Pressable>
              <Text style={styles.step}>City / Municipality</Text>
              <TextInput style={styles.search} value={search} onChangeText={setSearch} placeholder="Search city…" placeholderTextColor={theme.inkFaint} accessibilityLabel="Search city" />
              {(cities.data ?? []).map((c) => (
                <Pressable key={c.code} style={styles.opt} onPress={() => pickCity(c)} accessibilityRole="button"><Text style={styles.optT}>{c.name}</Text></Pressable>
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, color: theme.inkMuted, marginBottom: 6 },
  field: { backgroundColor: theme.canvas, borderWidth: 1, borderColor: theme.hairline, borderRadius: theme.radius.md, paddingVertical: 13, paddingHorizontal: 14 },
  val: { fontSize: 15, color: theme.ink }, placeholder: { fontSize: 15, color: theme.inkFaint },
  panel: { borderWidth: 1, borderColor: theme.hairline, borderRadius: theme.radius.md, marginTop: 8, padding: 8, maxHeight: 320 },
  step: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, color: theme.inkMuted, paddingHorizontal: 6, paddingVertical: 6 },
  crumb: { color: theme.primary, fontSize: 14, fontWeight: "500", paddingHorizontal: 6, paddingVertical: 4 },
  search: { borderWidth: 1, borderColor: theme.hairline, borderRadius: theme.radius.sm, paddingVertical: 9, paddingHorizontal: 12, fontSize: 14, color: theme.ink, marginBottom: 6, marginHorizontal: 4 },
  opt: { paddingVertical: 11, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: theme.divider },
  optT: { fontSize: 14, color: theme.ink },
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/mobile && pnpm test -- psgc-picker` → PASS (2 tests). Then `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/PsgcAddressPicker.tsx apps/mobile/__tests__/psgc-picker.test.tsx
git commit -m "feat(mobile): PsgcAddressPicker cascading region/province/city picker"
```

---

### Task 6: Events — address model, display & seed

**Files:** Create `supabase/migrations/20260720140200_events_psgc.sql`; Modify `supabase/seed.sql`, `apps/mobile/lib/events.ts`, `apps/mobile/components/EventCard.tsx`, `apps/mobile/app/event/[id].tsx`; Test `apps/mobile/__tests__/event-address.test.tsx`

**Interfaces:** Consumes Task 1 (FK), Task 3 (`formatAddress`). `EventRow` gains `city_psgc_code, region_name, province_name, city_name, venue`.

- [ ] **Step 1: Write the migration** — `supabase/migrations/20260720140200_events_psgc.sql`:

```sql
-- Event PSGC address + venue. Legacy place/region kept (nullable, unused for display).
alter table events
  add column if not exists city_psgc_code text references psgc_cities(code),
  add column if not exists region_name text,
  add column if not exists province_name text,
  add column if not exists city_name text,
  add column if not exists venue text;
```

- [ ] **Step 2: Write the failing display test** — `apps/mobile/__tests__/event-address.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
jest.mock("../lib/format", () => ({ shortDate: () => "Nov 14", longDate: () => "November 14, 2026" }));
jest.mock("../components/ElevationHero", () => ({ ElevationHero: () => null }));
jest.mock("../components/StatusBadge", () => ({ StatusBadge: () => null, eventStatusKind: () => "open" }));
import { EventCard } from "../components/EventCard";

const base: any = { id: "e1", org_id: "o1", name: "Apo Sky Ultra 2026", event_date: "2026-11-14", gallery: [], status: "open" };

describe("Event address display", () => {
  it("card shows formatAddress when PSGC present", () => {
    render(<EventCard event={{ ...base, city_name: "Digos City", province_name: "Davao del Sur", place: "Mt Apo" }} onPress={() => {}} />);
    expect(screen.getByText("Digos City, Davao del Sur · Nov 14")).toBeOnTheScreen();
  });
  it("card falls back to legacy place when no PSGC", () => {
    render(<EventCard event={{ ...base, city_name: null, place: "Mt Apo" }} onPress={() => {}} />);
    expect(screen.getByText("Mt Apo · Nov 14")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/mobile && pnpm test -- event-address` → FAIL (card still shows only `place`).

- [ ] **Step 4a: Extend the events data layer** — `apps/mobile/lib/events.ts`:

Add the fields to `EventRow` (after `status_note`, line 8):
```ts
  city_psgc_code: string | null; region_name: string | null; province_name: string | null; city_name: string | null; venue: string | null;
```
Extend `EVENT_COLS` (line 27-28) to append `,city_psgc_code,region_name,province_name,city_name,venue`. (`mapEvent`'s `{...r}` carries them through — no change.)

- [ ] **Step 4b: Card display** — `apps/mobile/components/EventCard.tsx`:

Add import: `import { formatAddress } from "@race-pace/shared";`
Replace line 12:
```ts
  const meta = [formatAddress(event) || event.place, dateLabel].filter(Boolean).join(" · ");
```

- [ ] **Step 4c: Event page display** — `apps/mobile/app/event/[id].tsx`:

Add import: `import { formatPeso, formatAddress } from "@race-pace/shared";` (merge with the existing formatPeso import).
Replace the `meta` array's first entry (line 31) so the location chip prefers the structured address and a full "city · province · region" reads on the page, and add a venue chip:
```ts
  const fullAddress = [event.city_name, event.province_name, event.region_name].filter(Boolean).join(" · ");
  const meta = [
    (fullAddress || event.place) && `◎ ${fullAddress || [event.place, event.region].filter(Boolean).join(" · ")}`,
    event.venue && `🏁 ${event.venue}`,
    event.event_date && `⚑ ${longDate(event.event_date)}`,
    event.elevation_gain_m && `▲ ${event.elevation_gain_m.toLocaleString()}m gain`,
    event.cutoff_hours && `⏱ ${event.cutoff_hours}h cutoff`,
  ].filter(Boolean) as string[];
```
Update the org card sub-line (line 54) to prefer the structured province/region, falling back to legacy:
```tsx
              {(event.province_name || event.region) ? <Text style={styles.orgRegion}>{event.province_name ?? event.region}</Text> : null}
```

- [ ] **Step 5: Run the display test (passes)**

Run: `cd apps/mobile && pnpm test -- event-address` → PASS. Then `npx tsc --noEmit` → exit 0.

- [ ] **Step 6: Seed the events with real PSGC + venue** — `supabase/seed.sql`:

The psgc data is already loaded (migration `..140100`), so the events insert may reference city codes. Extend the events insert column list (line 18) with `, city_psgc_code, region_name, province_name, city_name, venue` and add matching values to each event row using **real codes** the implementer looks up after `db reset`, e.g.:
```sql
-- look up codes: select code,name from psgc_cities where name ilike '%digos%';  (etc.)
-- e1 Apo Sky Ultra 2026 → a Davao del Sur municipality near Mt Apo; e3 Bukidnon Highland 50 → Malaybalay City; e4 Davao River Trail 21 → Davao City.
```
For each of the 5 events pick an appropriate city (Davao del Sur / Cotabato / Bukidnon / Davao City) and set `city_psgc_code` + denormalized `region_name/province_name/city_name` + a `venue` string (e.g. 'Kapatagan Base Camp'). Then `pnpm exec supabase db reset` applies it.

- [ ] **Step 7: Verify seeded events carry codes**

Run: `psql "postgresql://postgres:postgres@127.0.0.1:54522/postgres" -c "select name, city_name, venue from events where city_psgc_code is not null;"` → shows the 5 events with city + venue.
Run the full mobile suite: `cd apps/mobile && pnpm test` → all green.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260720140200_events_psgc.sql supabase/seed.sql apps/mobile/lib/events.ts apps/mobile/components/EventCard.tsx "apps/mobile/app/event/[id].tsx" apps/mobile/__tests__/event-address.test.tsx
git commit -m "feat(psgc): event PSGC address + venue (schema, display, seed)"
```

---

### Task 7: Runner profile — PSGC picker adoption

**Files:** Create `supabase/migrations/20260720140300_profiles_psgc.sql`; Modify `apps/mobile/lib/profile.ts`, `apps/mobile/app/(tabs)/profile.tsx`, `apps/mobile/__tests__/profile.test.tsx`

**Interfaces:** Consumes Task 1 (FK), Task 3 (`PsgcAddress`/`formatAddress`), Task 5 (`PsgcAddressPicker`). `Profile` gains `city_psgc_code, city_name, province_name`.

- [ ] **Step 1: Write the migration** — `supabase/migrations/20260720140300_profiles_psgc.sql`:

```sql
-- Runner profile PSGC city. Legacy `city` kept (nullable, unused going forward).
alter table profiles
  add column if not exists city_psgc_code text references psgc_cities(code),
  add column if not exists city_name text,
  add column if not exists province_name text;
```

- [ ] **Step 2: Rework the profile test** — replace `apps/mobile/__tests__/profile.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const mockUpsert = jest.fn().mockResolvedValue({});
jest.mock("../lib/auth", () => ({ useAuth: () => ({ session: { user: { id: "u1", email: "jr@x.test" } }, signOut: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("../lib/profile", () => ({
  getProfile: jest.fn().mockResolvedValue({ id: "u1", full_name: "JR Dela Cruz", bib_name: "JR", blood_type: "O+", shirt_size: "M", emergency_contact: "Jane 0917", city_name: "Digos City", province_name: "Davao del Sur", city_psgc_code: "c1" }),
  upsertProfile: (...a: unknown[]) => mockUpsert(...a),
}));
// The picker is exercised in its own test; here assert the profile wires its value/onChange.
jest.mock("../components/PsgcAddressPicker", () => ({
  PsgcAddressPicker: ({ value, onChange }: any) => {
    const { Text, Pressable } = require("react-native");
    return (<>
      <Text>picked:{value?.city_name ?? "none"}</Text>
      <Pressable accessibilityLabel="set-city" onPress={() => onChange({ city_psgc_code: "c9", city_name: "Bansalan", province_name: "Davao del Sur", region_name: "Davao Region" })}><Text>set</Text></Pressable>
    </>);
  },
}));

import Profile from "../app/(tabs)/profile";

describe("Profile", () => {
  it("prefills the picker from the saved PSGC city and saves the address", async () => {
    render(<Profile />);
    await waitFor(() => expect(screen.getByText("picked:Digos City")).toBeOnTheScreen());
    fireEvent.press(screen.getByLabelText("set-city"));       // change city via the picker
    fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({
      id: "u1", city_psgc_code: "c9", city_name: "Bansalan", province_name: "Davao del Sur",
    });
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `cd apps/mobile && pnpm test -- profile.test` → FAIL (no picker; upsert lacks PSGC fields).

- [ ] **Step 4a: Widen the profile data layer** — `apps/mobile/lib/profile.ts`:

Add to the `Profile` type: `city_psgc_code?: string | null; city_name?: string | null; province_name?: string | null;`
Extend `PROFILE_COLS` to append `,city_psgc_code,city_name,province_name`.

- [ ] **Step 4b: Adopt the picker** — `apps/mobile/app/(tabs)/profile.tsx`:

Imports: add `import { PsgcAddressPicker } from "../../components/PsgcAddressPicker";` and `import { formatAddress, type PsgcAddress } from "@race-pace/shared";`
Replace the `city` string state (line 21) with an address object:
```tsx
  const [address, setAddress] = useState<PsgcAddress | null>(null);
```
In the prefill effect (line 33), replace `setCity(p.city ?? "")` with:
```tsx
        setAddress(p.city_psgc_code ? { city_psgc_code: p.city_psgc_code, city_name: p.city_name ?? null, province_name: p.province_name ?? null, region_name: null } : null);
```
In `save()` (line 43-47), replace `city,` with:
```tsx
      city_psgc_code: address?.city_psgc_code ?? null, city_name: address?.city_name ?? null, province_name: address?.province_name ?? null,
```
Header sub-line (line 60): replace `{city ? <Text style={styles.sub}>{city}</Text> : null}` with:
```tsx
        {address?.city_name ? <Text style={styles.sub}>{formatAddress(address)}</Text> : null}
```
Replace the free-text CITY `View` (line 68) with:
```tsx
          <PsgcAddressPicker label="CITY" value={address} onChange={setAddress} />
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd apps/mobile && pnpm test -- profile.test` → PASS. Then `npx tsc --noEmit` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260720140300_profiles_psgc.sql apps/mobile/lib/profile.ts "apps/mobile/app/(tabs)/profile.tsx" apps/mobile/__tests__/profile.test.tsx
git commit -m "feat(psgc): runner profile PSGC city picker"
```

---

## Final verification (after all tasks)

- [ ] `pnpm exec supabase db reset` clean; `psgc_*` counts 17/81/1634; 5 events carry `city_psgc_code`.
- [ ] Full mobile suite: `cd apps/mobile && pnpm test` → all green. `npx tsc --noEmit` → 0.
- [ ] Backend/shared: `pnpm vitest run` (stack up) → all green (incl. psgc read test + import mapping).
- [ ] Manual smoke (simulator): event card + event page show "City, Province" + venue; Profile → CITY opens the cascade (Region→Province→City with search), pick persists and re-reads as "City, Province".
- [ ] Then use **superpowers:finishing-a-development-branch**.

## Notes / decisions baked in

- No runtime dependency on `psgc.gitlab.io`: data is generated → committed migration → applied by `db reset`. Re-run `pnpm import:psgc` to refresh.
- Migration timestamps order psgc tables (`140000`) + data (`140100`) before the events (`140200`) / profiles (`140300`) FK columns, and `seed.sql` runs after all migrations.
- Legacy `place`/`region`/`city` columns are retained (display falls back to them); no data migration needed (no real data yet).
- Barangay, map pins/coordinates, and the M3 admin event-creation picker are out of scope (spec §10).
