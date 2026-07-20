# Marketplace — Data + Marketplace + Event Page (Plan A of the redesign)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the org-scoped Events tab into a cross-org **marketplace**, enrich the **event page** (image gallery, description, org header, lifecycle status), and add the data + seed to back it — per [docs/specs/2026-07-20-marketplace-redesign.md](../specs/2026-07-20-marketplace-redesign.md). This plan does **not** touch Orgs list / org page / org-context removal (that's Plan B); it leaves `lib/org.tsx` in place for the other screens that still use it.

**Architecture:** Additive Supabase migration (org profile + event content + `cancelled` enum) + a multi-org seed with demo cancelled/rescheduled events. The app's read layer (`lib/events.ts`) gains marketplace/org fetchers over `supabase-js` + TanStack Query. Three reusable components (`StatusBadge`, `EventCard`, `EventGallery`) render events consistently. The Events tab becomes the marketplace; the event page renders the gallery/description/org header/status banner.

**Tech Stack:** Supabase (Postgres migrations + seed), Expo Router, `@tanstack/react-query`, `@supabase/supabase-js`, `@trail-ultra/shared` (`formatPeso`), jest-expo + `@testing-library/react-native`, root Vitest (backend).

## Global Constraints

- **Additive, non-destructive DB changes.** Keep the existing seeded event `…e1` (*Apo Sky Ultra 2026*) + its categories/add-ons/form-fields **intact** — Plan 1–4 backend tests query them by id. Only extend.
- **Cross-org reads need no RLS change.** `events_read_published` (`status <> 'draft'`) already returns every org's non-draft events; `orgs_read_active` already exposes orgs; new columns ride the existing `grant select … to anon, authenticated`. Do **not** add or weaken any policy.
- **Event lifecycle:** `cancelled` is a `status` value (terminal); **rescheduled** is *derived* — `original_date` is non-null and `event_date` holds the new date. **Register is disabled** when the event is `cancelled` / `closed` / `completed`, or the category is sold out; enabled for `open` / `almost_full` (including rescheduled).
- **Expo Go compatible — no new native modules.** The gallery is a plain React Native paging `ScrollView` (+ `Image`); no `react-native-webview`/pager libs.
- **getdesign `apple` theme.** Style from `apps/mobile/lib/theme.ts` tokens (the legacy aliases `pine`/`line`/`inkSoft`/`stop`/`paper` map onto the apple palette — `theme.pine` === Action Blue). Money is integer **centavos**, rendered with `formatPeso`.
- App tests use **jest-expo** (mock the data hooks / `expo-router`; any `const` a `jest.mock` factory closes over must be `mock`-prefixed). Backend tests use root **Vitest** against the live local stack.

## File Structure

```
supabase/
├── migrations/20260720100000_marketplace_fields.sql   NEW — org/event content + cancelled enum
└── seed.sql                                            MODIFY — multi-org + content + demo states
apps/mobile/
├── lib/events.ts                 MODIFY — extend EventRow, add OrgRow + marketplace/org hooks
├── components/
│   ├── StatusBadge.tsx           NEW — event status pill + banner + label helper
│   ├── EventCard.tsx             NEW — marketplace/org-page event card
│   └── EventGallery.tsx          NEW — swipeable image carousel (RN ScrollView)
├── app/(tabs)/events.tsx         REPLACE — cross-org marketplace + search
├── app/event/[id].tsx            REPLACE — gallery + description + org header + status banner
└── __tests__/                    NEW/UPDATED tests
```

---

### Task 1: Migration — org/event content fields + `cancelled` status

**Files:**
- Create: `supabase/migrations/20260720100000_marketplace_fields.sql`

- [ ] **Step 1: Migration**

Create `supabase/migrations/20260720100000_marketplace_fields.sql`:
```sql
-- Marketplace redesign: organization profile + event content + event lifecycle.
-- Additive only. RLS/grants unchanged (existing table grants cover new columns;
-- 'cancelled' is <> 'draft' so events_read_published already exposes it).

-- 'cancelled' event status (terminal). ADD VALUE is idempotent and not used in this
-- migration, so it commits fine ahead of seed on PG12+ (local is PG15).
alter type event_status add value if not exists 'cancelled';

alter table organizations
  add column if not exists banner_url text,
  add column if not exists description text;

alter table events
  add column if not exists description text,
  add column if not exists gallery text[] not null default '{}',
  add column if not exists original_date date,   -- set on reschedule; present => "Rescheduled"
  add column if not exists status_note text;      -- optional org message for the banner
```

- [ ] **Step 2: Apply + verify existing backend suite still green**

```bash
pnpm exec supabase db reset 2>&1 | tail -6   # re-applies all migrations + seed
pkill -f "supabase functions serve" 2>/dev/null; sleep 1
pnpm exec supabase functions serve --no-verify-jwt --env-file supabase/functions/.env > /tmp/trail-functions.log 2>&1 &
sleep 5
pnpm test 2>&1 | tail -14
```
Expected: all backend suites still pass (the migration is additive; seed changes come in Task 2). If `db reset` errors on the `ALTER TYPE … ADD VALUE`, split the enum change into its own earlier-timestamped migration file and re-run.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations
git commit -m "feat(db): org banner/description + event description/gallery/lifecycle fields + cancelled status"
```

---

### Task 2: Seed — multi-org marketplace + demo cancelled/rescheduled

**Files:**
- Modify: `supabase/seed.sql`

- [ ] **Step 1: Enrich the existing org/event and add two more orgs + demo events**

Replace `supabase/seed.sql` with (keeps every existing id/row, adds columns + new data):
```sql
-- Organizations (a1 kept; +logo/banner/description; a2/a3 new).
insert into organizations (id, name, slug, brand_color, commission_rate, logo_url, banner_url, description) values
  ('00000000-0000-0000-0000-0000000000a1', 'Run With Point', 'run-with-point', '#1F6248', 0.10,
   'https://picsum.photos/seed/rwp-logo/240/240', 'https://picsum.photos/seed/rwp-banner/1200/420',
   'Trail and ultra races across Davao and the Mt Apo highlands.'),
  ('00000000-0000-0000-0000-0000000000a2', 'Bukidnon Trails', 'bukidnon-trails', '#0066cc', 0.10,
   'https://picsum.photos/seed/bt-logo/240/240', 'https://picsum.photos/seed/bt-banner/1200/420',
   'Highland skyruns in the Kitanglad range, Bukidnon.'),
  ('00000000-0000-0000-0000-0000000000a3', 'Cotabato Skyrace', 'cotabato-skyrace', '#b8562f', 0.10,
   'https://picsum.photos/seed/cs-logo/240/240', 'https://picsum.photos/seed/cs-banner/1200/420',
   'Skyrace and night-trail events around Cotabato.');

-- Events. e1 kept (+description/gallery); e2..e5 new incl. one rescheduled (e3) and one cancelled (e5).
insert into events (id, org_id, name, place, region, event_date, status, elevation_gain_m, cutoff_hours, hero_image_url, description, gallery, original_date, status_note) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-0000000000a1',
   'Apo Sky Ultra 2026', 'Mt Apo', 'Davao', '2026-11-14', 'open', 4200, 20,
   'https://picsum.photos/seed/apo-hero/1200/700',
   'The flagship 100K around Mt Apo — technical ridgelines, mossy forest, and a summit sunrise.',
   array['https://picsum.photos/seed/apo1/1200/700','https://picsum.photos/seed/apo2/1200/700','https://picsum.photos/seed/apo3/1200/700'],
   null, null),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-0000000000a2',
   'Kitanglad Highland 50', 'Mt Kitanglad', 'Bukidnon', '2026-09-20', 'open', 2600, 14,
   'https://picsum.photos/seed/kit-hero/1200/700',
   'A fast 50K through pine ridges and cloud forest above Lantapan.',
   array['https://picsum.photos/seed/kit1/1200/700','https://picsum.photos/seed/kit2/1200/700'],
   null, null),
  ('00000000-0000-0000-0000-0000000000e3', '00000000-0000-0000-0000-0000000000a2',
   'Dulang-dulang Skyrun', 'Mt Dulang-dulang', 'Bukidnon', '2026-10-11', 'open', 3100, 16,
   'https://picsum.photos/seed/dd-hero/1200/700',
   'The second-highest peak in the Philippines, skyrun format.',
   array['https://picsum.photos/seed/dd1/1200/700','https://picsum.photos/seed/dd2/1200/700'],
   '2026-09-27', 'Moved one week later due to trail conditions.'),
  ('00000000-0000-0000-0000-0000000000e4', '00000000-0000-0000-0000-0000000000a3',
   'Cotabato Skyrace 42', 'Mt Apo (Cotabato side)', 'Cotabato', '2026-12-05', 'open', 2900, 15,
   'https://picsum.photos/seed/csr-hero/1200/700',
   'A 42K skyrace up the Cotabato approach to Apo.',
   array['https://picsum.photos/seed/csr1/1200/700','https://picsum.photos/seed/csr2/1200/700'],
   null, null),
  ('00000000-0000-0000-0000-0000000000e5', '00000000-0000-0000-0000-0000000000a3',
   'Ligawasan Night Trail', 'Ligawasan', 'Cotabato', '2026-08-30', 'cancelled', 900, 8,
   'https://picsum.photos/seed/lnt-hero/1200/700',
   'A 21K night trail along the marsh edge.',
   array['https://picsum.photos/seed/lnt1/1200/700'],
   null, 'Cancelled — special-use permit was not secured in time.');

-- Categories: e1 kept (c1..c4). New events get a couple each (c5..cc).
insert into categories (id, org_id, event_id, code, label, distance_km, base_price, slots_total, slots_taken) values
  ('00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','100k','100K Ultra',100,350000,100,0),
  ('00000000-0000-0000-0000-0000000000c2','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','50k','50K',50,250000,150,0),
  ('00000000-0000-0000-0000-0000000000c3','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','21k','21K',21,150000,200,0),
  ('00000000-0000-0000-0000-0000000000c4','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','10k','10K',10,100000,200,0),
  ('00000000-0000-0000-0000-0000000000c5','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000e2','50k','50K',50,220000,120,10),
  ('00000000-0000-0000-0000-0000000000c6','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000e2','21k','21K',21,140000,180,5),
  ('00000000-0000-0000-0000-0000000000c7','00000000-0000-0000-0000-0000000000a2','00000000-0000-0000-0000-0000000000e3','30k','30K Sky',30,180000,100,0),
  ('00000000-0000-0000-0000-0000000000c8','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000e4','42k','42K Sky',42,200000,150,20),
  ('00000000-0000-0000-0000-0000000000c9','00000000-0000-0000-0000-0000000000a3','00000000-0000-0000-0000-0000000000e5','21k','21K Night',21,120000,120,0);

insert into addons (id, org_id, event_id, name, price) values
  ('00000000-0000-0000-0000-0000000000d1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','Event Singlet',60000),
  ('00000000-0000-0000-0000-0000000000d2','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','Finisher Package',120000);

insert into form_fields (id, org_id, event_id, key, label, type, required, options, sort_order) values
  ('00000000-0000-0000-0000-0000000000f1','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','blood_type','Blood type','select',true, array['A','B','AB','O'],1),
  ('00000000-0000-0000-0000-0000000000f2','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','running_club','Running club','text',false,null,2),
  ('00000000-0000-0000-0000-0000000000f3','00000000-0000-0000-0000-0000000000a1','00000000-0000-0000-0000-0000000000e1','shirt_size','Shirt size','select',true, array['S','M','L','XL'],3);
```

- [ ] **Step 2: Reset + verify seed exposes the marketplace**

```bash
pnpm exec supabase db reset 2>&1 | tail -4
SVC=$(grep -E '^SERVICE_ROLE_KEY=' .env.local | cut -d= -f2- | tr -d '"')
curl -s "http://127.0.0.1:54521/rest/v1/events?select=name,status,org_id,original_date&order=event_date" -H "apikey: $SVC" -H "Authorization: Bearer $SVC" | python3 -m json.tool | head -40
pnpm test 2>&1 | tail -8
```
Expected: 5 events across 3 orgs incl. `Ligawasan Night Trail` (status `cancelled`) and `Dulang-dulang Skyrun` (`original_date` set); backend suite still green.

- [ ] **Step 3: Commit**

```bash
git add supabase/seed.sql
git commit -m "feat(db): multi-org marketplace seed with demo cancelled + rescheduled events"
```

---

### Task 3: Read layer — marketplace + org fetchers (`lib/events.ts`)

**Files:**
- Modify: `apps/mobile/lib/events.ts`
- Modify: `apps/mobile/__tests__/events-hooks.test.tsx`

**Interfaces:**
- Produces extended `EventRow` (+ `org_id`, `hero_image_url`, `description`, `gallery`, `original_date`, `status_note`, `org_name?`), new `OrgRow`, and hooks `useMarketplaceEvents()`, `useEventsByOrg(orgId)`, `useOrgs()`, `useOrg(id)`. Keeps `useEvent`/`useCategories`/`useCategory`/`useAddons`/`useFormFields`.

- [ ] **Step 1: Replace `lib/events.ts`**

```ts
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export type EventRow = {
  id: string; org_id: string; name: string; place: string | null; region: string | null;
  event_date: string | null; elevation_gain_m: number | null; cutoff_hours: number | null;
  status: string; hero_image_url: string | null; description: string | null;
  gallery: string[]; original_date: string | null; status_note: string | null;
  org_name?: string;
};
export type OrgRow = {
  id: string; name: string; slug: string;
  logo_url: string | null; banner_url: string | null; description: string | null; brand_color: string | null;
};
export type CategoryRow = {
  id: string; event_id: string; org_id: string; code: string; label: string;
  distance_km: number | null; base_price: number; slots_total: number; slots_taken: number;
};
export type AddonRow = { id: string; name: string; price: number };
export type FormFieldRow = {
  id: string; key: string; label: string;
  type: "text" | "number" | "select" | "checkbox" | "date" | "file";
  required: boolean; options: string[] | null; sort_order: number;
};

const EVENT_COLS =
  "id,org_id,name,place,region,event_date,elevation_gain_m,cutoff_hours,status,hero_image_url,description,gallery,original_date,status_note";
const ORG_COLS = "id,name,slug,logo_url,banner_url,description,brand_color";
const CAT_COLS = "id,event_id,org_id,code,label,distance_km,base_price,slots_total,slots_taken";

function mapEvent(r: any): EventRow {
  return { ...r, gallery: r.gallery ?? [], org_name: r.organizations?.name };
}

// Marketplace: every org's non-draft events (RLS enforces non-draft), with org name for the card.
export async function fetchMarketplaceEvents(): Promise<EventRow[]> {
  const { data, error } = await supabase.from("events").select(`${EVENT_COLS},organizations(name)`).order("event_date");
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}
export function useMarketplaceEvents() {
  return useQuery({ queryKey: ["marketplace-events"], queryFn: fetchMarketplaceEvents });
}

export async function fetchEventsByOrg(orgId: string): Promise<EventRow[]> {
  const { data, error } = await supabase.from("events").select(EVENT_COLS).eq("org_id", orgId).order("event_date");
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}
export function useEventsByOrg(orgId: string) {
  return useQuery({ queryKey: ["events-by-org", orgId], queryFn: () => fetchEventsByOrg(orgId), enabled: !!orgId });
}

export async function fetchEvent(eventId: string): Promise<EventRow | null> {
  const { data, error } = await supabase.from("events").select(EVENT_COLS).eq("id", eventId).maybeSingle();
  if (error) throw error;
  return data ? mapEvent(data) : null;
}
export function useEvent(eventId: string) {
  return useQuery({ queryKey: ["event", eventId], queryFn: () => fetchEvent(eventId) });
}

export async function fetchOrgs(): Promise<OrgRow[]> {
  const { data, error } = await supabase.from("organizations").select(ORG_COLS).order("name");
  if (error) throw error;
  return (data ?? []) as OrgRow[];
}
export function useOrgs() {
  return useQuery({ queryKey: ["orgs"], queryFn: fetchOrgs });
}

export async function fetchOrg(id: string): Promise<OrgRow | null> {
  const { data, error } = await supabase.from("organizations").select(ORG_COLS).eq("id", id).maybeSingle();
  if (error) throw error;
  return data as OrgRow | null;
}
export function useOrg(id: string) {
  return useQuery({ queryKey: ["org", id], queryFn: () => fetchOrg(id), enabled: !!id });
}

export async function fetchCategories(eventId: string): Promise<CategoryRow[]> {
  const { data, error } = await supabase.from("categories").select(CAT_COLS).eq("event_id", eventId).order("base_price", { ascending: false });
  if (error) throw error;
  return (data ?? []) as CategoryRow[];
}
export function useCategories(eventId: string) {
  return useQuery({ queryKey: ["categories", eventId], queryFn: () => fetchCategories(eventId) });
}

export async function fetchCategory(categoryId: string): Promise<CategoryRow | null> {
  const { data, error } = await supabase.from("categories").select(CAT_COLS).eq("id", categoryId).maybeSingle();
  if (error) throw error;
  return data as CategoryRow | null;
}
export function useCategory(categoryId: string) {
  return useQuery({ queryKey: ["category", categoryId], queryFn: () => fetchCategory(categoryId) });
}

export async function fetchAddons(eventId: string): Promise<AddonRow[]> {
  const { data, error } = await supabase.from("addons").select("id,name,price").eq("event_id", eventId).order("price");
  if (error) throw error;
  return (data ?? []) as AddonRow[];
}
export function useAddons(eventId: string) {
  return useQuery({ queryKey: ["addons", eventId], queryFn: () => fetchAddons(eventId) });
}

export async function fetchFormFields(eventId: string): Promise<FormFieldRow[]> {
  const { data, error } = await supabase.from("form_fields")
    .select("id,key,label,type,required,options,sort_order").eq("event_id", eventId).eq("is_active", true).order("sort_order");
  if (error) throw error;
  return (data ?? []) as FormFieldRow[];
}
export function useFormFields(eventId: string) {
  return useQuery({ queryKey: ["form_fields", eventId], queryFn: () => fetchFormFields(eventId) });
}
```
> `useEvents(orgId)`/`fetchEvents` (org-scoped) are **removed** — the marketplace + `useEventsByOrg` replace them and nothing else imports them.

- [ ] **Step 2: Update the hooks test to cover `useMarketplaceEvents`**

Replace `apps/mobile/__tests__/events-hooks.test.tsx`:
```tsx
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMarketplaceEvents } from "../lib/events";

const mockOrder = jest.fn().mockResolvedValue({
  data: [{ id: "e1", org_id: "o1", name: "Apo Sky Ultra 2026", status: "open", gallery: null, organizations: { name: "Run With Point" } }],
  error: null,
});
const mockSelect = jest.fn(() => ({ order: mockOrder }));
jest.mock("../lib/supabase", () => ({ supabase: { from: jest.fn(() => ({ select: mockSelect })) } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useMarketplaceEvents", () => {
  it("fetches all events and flattens the org name + gallery default", async () => {
    const { result } = renderHook(() => useMarketplaceEvents(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]).toMatchObject({ id: "e1", org_name: "Run With Point", gallery: [] });
  });
});
```

- [ ] **Step 3: Run + typecheck**

```bash
cd apps/mobile && pnpm test events-hooks 2>&1 | tail -10 && npx tsc --noEmit 2>&1 | tail -8 && echo TSC_CLEAN ; cd ../..
```
Expected: PASS + clean tsc. (tsc will fail to compile `(tabs)/events.tsx` until Task 5 — acceptable; run the focused test now, full tsc after Task 5.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): marketplace + org read hooks; extend EventRow, add OrgRow"
```

---

### Task 4: Components — `StatusBadge`, `EventCard`, `EventGallery`

**Files:**
- Create: `apps/mobile/components/StatusBadge.tsx`
- Create: `apps/mobile/components/EventCard.tsx`
- Create: `apps/mobile/components/EventGallery.tsx`
- Create: `apps/mobile/__tests__/event-card.test.tsx`

**Interfaces:**
- `eventStatusLabel(event)` → `"Open" | "Almost full" | "Closed" | "Completed" | "Cancelled" | "Rescheduled"`.
- `StatusBadge({ event })` (pill) · `StatusBanner({ event })` (full-width) · `EventCard({ event, showOrg, onPress })` · `EventGallery({ images })`.

- [ ] **Step 1: StatusBadge**

Create `apps/mobile/components/StatusBadge.tsx`:
```tsx
import { View, Text, StyleSheet } from "react-native";
import type { EventRow } from "../lib/events";
import { theme } from "../lib/theme";

export type StatusKind = "open" | "almost_full" | "closed" | "completed" | "cancelled" | "rescheduled";

export function eventStatusKind(event: Pick<EventRow, "status" | "original_date">): StatusKind {
  if (event.status === "cancelled") return "cancelled";
  if (event.original_date) return "rescheduled";
  return (["almost_full", "closed", "completed"].includes(event.status) ? event.status : "open") as StatusKind;
}
const LABEL: Record<StatusKind, string> = {
  open: "Open", almost_full: "Almost full", closed: "Closed",
  completed: "Completed", cancelled: "Cancelled", rescheduled: "Rescheduled",
};
export function eventStatusLabel(event: Pick<EventRow, "status" | "original_date">): string {
  return LABEL[eventStatusKind(event)];
}
const TINT: Record<StatusKind, { bg: string; fg: string }> = {
  open: { bg: "#eef1f4", fg: theme.inkMuted },
  almost_full: { bg: "#fff4e5", fg: "#b8560f" },
  closed: { bg: "#eef1f4", fg: theme.inkMuted },
  completed: { bg: "#eef1f4", fg: theme.inkMuted },
  cancelled: { bg: "#ffe9e7", fg: theme.danger },
  rescheduled: { bg: "#e7f3ff", fg: theme.primary },
};

export function StatusBadge({ event }: { event: Pick<EventRow, "status" | "original_date"> }) {
  const kind = eventStatusKind(event);
  const t = TINT[kind];
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeT, { color: t.fg }]}>{LABEL[kind]}</Text>
    </View>
  );
}

export function StatusBanner({ event }: { event: Pick<EventRow, "status" | "original_date" | "event_date" | "status_note"> }) {
  const kind = eventStatusKind(event);
  if (kind !== "cancelled" && kind !== "rescheduled") return null;
  const t = TINT[kind];
  const headline = kind === "cancelled"
    ? "This event was cancelled"
    : `Rescheduled to ${event.event_date ?? "a new date"}${event.original_date ? ` (was ${event.original_date})` : ""}`;
  return (
    <View style={[styles.banner, { backgroundColor: t.bg }]}>
      <Text style={[styles.bannerH, { color: t.fg }]}>{headline}</Text>
      {event.status_note ? <Text style={styles.bannerNote}>{event.status_note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: "flex-start", borderRadius: theme.radius.pill, paddingVertical: 4, paddingHorizontal: 10 },
  badgeT: { fontSize: 12, fontWeight: "700" },
  banner: { borderRadius: theme.radius.md, padding: 14, marginVertical: 12 },
  bannerH: { fontSize: 15, fontWeight: "700" },
  bannerNote: { color: theme.inkMuted, marginTop: 4, fontSize: 13 },
});
```

- [ ] **Step 2: EventGallery**

Create `apps/mobile/components/EventGallery.tsx`:
```tsx
import { useState } from "react";
import { View, Image, ScrollView, Text, StyleSheet, useWindowDimensions } from "react-native";
import { theme } from "../lib/theme";

export function EventGallery({ images }: { images: string[] }) {
  const { width } = useWindowDimensions();
  const [page, setPage] = useState(0);
  if (!images.length) return null;
  return (
    <View>
      <ScrollView
        horizontal pagingEnabled showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
      >
        {images.map((uri, i) => (
          <Image key={`${uri}:${i}`} source={{ uri }} style={{ width, height: width * 0.62 }} resizeMode="cover" accessibilitylabel={`Event image ${i + 1}`} />
        ))}
      </ScrollView>
      {images.length > 1 ? (
        <View style={styles.dots}>
          {images.map((_, i) => (
            <View key={i} style={[styles.dot, i === page && styles.dotActive]} />
          ))}
          <Text style={styles.count}>{page + 1}/{images.length}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { flexDirection: "row", alignItems: "center", gap: 6, justifyContent: "center", paddingVertical: 8 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: theme.inkFaint },
  dotActive: { backgroundColor: theme.primary },
  count: { marginLeft: 6, color: theme.inkMuted, fontSize: 12 },
});
```

- [ ] **Step 3: EventCard**

Create `apps/mobile/components/EventCard.tsx`:
```tsx
import { View, Text, Image, Pressable, StyleSheet } from "react-native";
import type { EventRow } from "../lib/events";
import { StatusBadge } from "./StatusBadge";
import { theme } from "../lib/theme";

export function EventCard({ event, showOrg, onPress }: { event: EventRow; showOrg?: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.card} onPress={onPress} accessibilityRole="button">
      {event.hero_image_url ? (
        <Image source={{ uri: event.hero_image_url }} style={styles.hero} resizeMode="cover" />
      ) : null}
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.name} numberOfLines={2}>{event.name}</Text>
          <StatusBadge event={event} />
        </View>
        <Text style={styles.meta}>
          {[event.place, event.region].filter(Boolean).join(" · ")}{event.event_date ? ` · ${event.event_date}` : ""}
        </Text>
        {showOrg && event.org_name ? <Text style={styles.org}>{event.org_name}</Text> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: theme.hairline, borderRadius: theme.radius.lg, overflow: "hidden", marginBottom: 14, backgroundColor: theme.canvas },
  hero: { width: "100%", height: 150, backgroundColor: theme.parchment },
  body: { padding: 14 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  name: { flex: 1, fontSize: 18, fontWeight: "600", color: theme.ink },
  meta: { color: theme.inkMuted, marginTop: 4, fontSize: 13 },
  org: { color: theme.primary, marginTop: 8, fontSize: 13, fontWeight: "600" },
});
```

- [ ] **Step 4: Failing test — EventCard + status label**

Create `apps/mobile/__tests__/event-card.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { EventCard } from "../components/EventCard";
import { eventStatusLabel } from "../components/StatusBadge";

const base = {
  id: "e1", org_id: "o1", name: "Apo Sky Ultra 2026", place: "Mt Apo", region: "Davao",
  event_date: "2026-11-14", elevation_gain_m: 4200, cutoff_hours: 20, status: "open",
  hero_image_url: "http://x/a.jpg", description: "d", gallery: [], original_date: null, status_note: null,
  org_name: "Run With Point",
};

describe("EventCard + status", () => {
  it("shows the org name when showOrg and routes on press", () => {
    const onPress = jest.fn();
    render(<EventCard event={base as any} showOrg onPress={onPress} />);
    expect(screen.getByText("Apo Sky Ultra 2026")).toBeOnTheScreen();
    expect(screen.getByText("Run With Point")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Apo Sky Ultra 2026"));
    expect(onPress).toHaveBeenCalled();
  });
  it("derives Cancelled and Rescheduled labels", () => {
    expect(eventStatusLabel({ status: "cancelled", original_date: null })).toBe("Cancelled");
    expect(eventStatusLabel({ status: "open", original_date: "2026-09-27" })).toBe("Rescheduled");
    expect(eventStatusLabel({ status: "open", original_date: null })).toBe("Open");
  });
});
```

- [ ] **Step 5: Run**

```bash
cd apps/mobile && pnpm test event-card 2>&1 | tail -10 ; cd ../..
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): StatusBadge/StatusBanner, EventGallery, EventCard components"
```

---

### Task 5: Marketplace screen (Events tab)

**Files:**
- Replace: `apps/mobile/app/(tabs)/events.tsx`
- Create: `apps/mobile/__tests__/marketplace.test.tsx`

- [ ] **Step 1: Marketplace**

Replace `apps/mobile/app/(tabs)/events.tsx`:
```tsx
import { useMemo, useState } from "react";
import { View, Text, TextInput, FlatList, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useMarketplaceEvents } from "../../lib/events";
import { EventCard } from "../../components/EventCard";
import { theme } from "../../lib/theme";

export default function Marketplace() {
  const { data, isLoading, isError, refetch } = useMarketplaceEvents();
  const router = useRouter();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const list = data ?? [];
    const needle = q.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((e) =>
      [e.name, e.place, e.region, e.org_name].filter(Boolean).some((s) => s!.toLowerCase().includes(needle)));
  }, [data, q]);

  if (isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (isError) {
    return (
      <View style={styles.center}>
        <Pressable onPress={() => refetch()} accessibilityRole="button"><Text style={styles.err}>Couldn't load events. Tap to retry.</Text></Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={rows}
      keyExtractor={(e) => e.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      ListHeaderComponent={
        <View>
          <Text style={styles.h}>Events</Text>
          <TextInput
            style={styles.search} value={q} onChangeText={setQ}
            placeholder="Search events, places, organizations" placeholderTextColor={theme.inkMuted}
            autoCapitalize="none" accessibilityLabel="Search events"
          />
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>{q ? "No matches." : "No events yet."}</Text>}
      renderItem={({ item }) => <EventCard event={item} showOrg onPress={() => router.push(`/event/${item.id}`)} />}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: theme.canvas },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  h: { fontSize: 28, fontWeight: "600", letterSpacing: -0.4, color: theme.ink, marginBottom: 12 },
  search: { borderWidth: 1, borderColor: theme.hairline, borderRadius: theme.radius.pill, paddingVertical: 11, paddingHorizontal: 16, fontSize: 15, color: theme.ink, marginBottom: 16 },
  empty: { color: theme.inkMuted }, err: { color: theme.stop },
});
```

- [ ] **Step 2: Failing test**

Create `apps/mobile/__tests__/marketplace.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../lib/events", () => ({
  useMarketplaceEvents: () => ({
    data: [
      { id: "e1", org_id: "o1", name: "Apo Sky Ultra 2026", place: "Mt Apo", region: "Davao", event_date: "2026-11-14", status: "open", hero_image_url: null, gallery: [], original_date: null, status_note: null, org_name: "Run With Point" },
      { id: "e5", org_id: "o3", name: "Ligawasan Night Trail", place: "Ligawasan", region: "Cotabato", event_date: "2026-08-30", status: "cancelled", hero_image_url: null, gallery: [], original_date: null, status_note: null, org_name: "Cotabato Skyrace" },
    ],
    isLoading: false, isError: false, refetch: jest.fn(),
  }),
}));

import Marketplace from "../app/(tabs)/events";

describe("Marketplace", () => {
  it("lists cross-org events with org name + status, filters by search, and routes", () => {
    render(<Marketplace />);
    expect(screen.getByText("Run With Point")).toBeOnTheScreen();
    expect(screen.getByText("Cotabato Skyrace")).toBeOnTheScreen();
    expect(screen.getByText("Cancelled")).toBeOnTheScreen();
    fireEvent.changeText(screen.getByLabelText("Search events"), "apo");
    expect(screen.queryByText("Ligawasan Night Trail")).toBeNull();
    fireEvent.press(screen.getByText("Apo Sky Ultra 2026"));
    expect(mockPush).toHaveBeenCalledWith("/event/e1");
  });
});
```

- [ ] **Step 3: Run**

```bash
cd apps/mobile && pnpm test marketplace 2>&1 | tail -10 ; cd ../..
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): cross-org marketplace (Events tab) with search"
```

---

### Task 6: Event page — gallery, description, org header, status banner

**Files:**
- Replace: `apps/mobile/app/event/[id].tsx`
- Create: `apps/mobile/__tests__/event-detail.test.tsx` (replaces the Plan 3 version)

- [ ] **Step 1: Event page**

Replace `apps/mobile/app/event/[id].tsx`:
```tsx
import { View, Text, ScrollView, Pressable, Image, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { formatPeso } from "@trail-ultra/shared";
import { useEvent, useCategories, useOrg } from "../../lib/events";
import { EventGallery } from "../../components/EventGallery";
import { StatusBanner, eventStatusKind } from "../../components/StatusBadge";
import { theme } from "../../lib/theme";

export default function EventDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const ev = useEvent(id);
  const cats = useCategories(id);
  const org = useOrg(ev.data?.org_id ?? "");

  if (ev.isLoading || cats.isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  const event = ev.data;
  if (!event) return <View style={styles.center}><Text style={styles.meta}>Event not found.</Text></View>;

  const registerable = !["cancelled", "closed", "completed"].includes(event.status);

  return (
    <ScrollView style={styles.c} contentContainerStyle={{ paddingBottom: 40 }}>
      <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable>
      <EventGallery images={event.gallery} />
      <View style={styles.pad}>
        <Text style={styles.h}>{event.name}</Text>

        {org.data ? (
          <Pressable style={styles.orgRow} onPress={() => router.push(`/org/${event.org_id}`)} accessibilityRole="button">
            {org.data.logo_url ? <Image source={{ uri: org.data.logo_url }} style={styles.orgLogo} /> : null}
            <Text style={styles.orgName}>{org.data.name}</Text>
            <Text style={styles.orgChevron}>›</Text>
          </Pressable>
        ) : null}

        <StatusBanner event={event} />

        <Text style={styles.meta}>
          {[event.place, event.region].filter(Boolean).join(" · ")}{event.event_date ? ` · ${event.event_date}` : ""}
          {event.elevation_gain_m ? ` · ${event.elevation_gain_m} m gain` : ""}
        </Text>
        {event.description ? <Text style={styles.desc}>{event.description}</Text> : null}

        <Text style={styles.section}>Pick a distance</Text>
        {(cats.data ?? []).length === 0 ? <Text style={styles.meta}>No categories open.</Text> : null}
        {(cats.data ?? []).map((item) => {
          const left = item.slots_total - item.slots_taken;
          const disabled = !registerable || left <= 0;
          return (
            <Pressable
              key={item.id}
              style={[styles.cat, disabled && styles.catDisabled]}
              disabled={disabled}
              onPress={() => router.push(`/register/${item.id}`)}
              accessibilityRole="button"
            >
              <View>
                <Text style={styles.catLabel}>{item.label}</Text>
                <Text style={styles.meta}>{!registerable ? "Registration closed" : left <= 0 ? "Sold out" : `${left} slots left`}</Text>
              </View>
              <Text style={styles.price}>{formatPeso(item.base_price)}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.canvas },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  back: { color: theme.pine, padding: 16, paddingBottom: 4, fontSize: 15 },
  pad: { padding: 20, paddingTop: 8 },
  h: { fontSize: 24, fontWeight: "700", color: theme.ink },
  orgRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },
  orgLogo: { width: 28, height: 28, borderRadius: 14, backgroundColor: theme.parchment },
  orgName: { color: theme.primary, fontWeight: "600", fontSize: 15 },
  orgChevron: { color: theme.inkFaint, fontSize: 18 },
  meta: { color: theme.inkSoft, marginTop: 8, fontSize: 13 },
  desc: { color: theme.ink, marginTop: 12, fontSize: 15, lineHeight: 22 },
  section: { fontSize: 16, fontWeight: "600", marginTop: 20, marginBottom: 10, color: theme.ink },
  cat: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderWidth: 1, borderColor: theme.line, borderRadius: 12, padding: 16, marginBottom: 10 },
  catDisabled: { opacity: 0.45 },
  catLabel: { fontSize: 17, fontWeight: "600", color: theme.ink },
  price: { fontSize: 16, fontWeight: "700", color: theme.pine },
});
```

- [ ] **Step 2: Failing test**

Replace `apps/mobile/__tests__/event-detail.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ id: "e5" }), useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock("react-native/Libraries/Image/Image", () => "Image");

let mockEvent: any = {
  id: "e5", org_id: "o3", name: "Ligawasan Night Trail", place: "Ligawasan", region: "Cotabato",
  event_date: "2026-08-30", elevation_gain_m: 900, status: "cancelled", description: "Night trail.",
  gallery: [], original_date: null, status_note: "Cancelled — no permit.",
};
jest.mock("../lib/events", () => ({
  useEvent: () => ({ data: mockEvent, isLoading: false }),
  useCategories: () => ({ data: [{ id: "c9", label: "21K Night", base_price: 120000, slots_total: 120, slots_taken: 0 }], isLoading: false }),
  useOrg: () => ({ data: { id: "o3", name: "Cotabato Skyrace", logo_url: null } }),
}));

import EventDetail from "../app/event/[id]";

describe("EventDetail", () => {
  it("shows a cancelled banner, the org header, and disables the category", () => {
    render(<EventDetail />);
    expect(screen.getByText("This event was cancelled")).toBeOnTheScreen();
    expect(screen.getByText("Cancelled — no permit.")).toBeOnTheScreen();
    expect(screen.getByText("Registration closed")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Cotabato Skyrace"));
    expect(mockPush).toHaveBeenCalledWith("/org/o3");
    // cancelled → category press does nothing (disabled)
    fireEvent.press(screen.getByText("21K Night"));
    expect(mockPush).not.toHaveBeenCalledWith("/register/c9");
  });
});
```

- [ ] **Step 3: Run**

```bash
cd apps/mobile && pnpm test event-detail 2>&1 | tail -10 ; cd ../..
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): event page — gallery, description, org header, status banner, register rules"
```

---

### Task 7: Full suites, typecheck, acceptance

- [ ] **Step 1: Full mobile suite + tsc**

```bash
cd apps/mobile && pnpm test 2>&1 | tail -12 && npx tsc --noEmit 2>&1 | tail -12 && echo TSC_CLEAN ; cd ../..
```
Expected: all suites pass (updated marketplace/event-detail/events-hooks + new event-card + prior Plan 2–4 suites), tsc clean.

> The Plan 3 test `apps/mobile/__tests__/events-screen.test.tsx` tested the old org-scoped Events list and will fail (screen replaced). Delete it — its coverage is superseded by `marketplace.test.tsx`: `git rm apps/mobile/__tests__/events-screen.test.tsx`.

- [ ] **Step 2: Backend suite (stack + functions serve up)**

```bash
pnpm test 2>&1 | tail -12
```
Expected: green (additive migration + seed; existing assertions unaffected).

- [ ] **Step 3: Manual acceptance (sim)** — `supabase start` + `functions serve` up; `cd apps/mobile && npx expo start`, press `i`.

Signed in: the **Events** tab now lists events from **multiple organizations**, each card showing the **org name** and a status badge (incl. a **Cancelled** and a **Rescheduled** one). Open *Apo Sky Ultra 2026* → the event page shows the **image gallery**, **description**, a tappable **org header**, and the category list. Open *Ligawasan Night Trail* → **Cancelled banner**, categories show "Registration closed". Open *Dulang-dulang Skyrun* → **Rescheduled** banner with the new date; categories still registerable.

- [ ] **Step 4: Commit any wire-up fixes**

```bash
git add -A && git commit -m "chore(mobile): Plan A marketplace + event page verified"
```

---

## Self-Review

**Spec coverage** (against [2026-07-20-marketplace-redesign.md](../specs/2026-07-20-marketplace-redesign.md) §3–§8):
- Marketplace card with org name + status badge → Tasks 4–5. ✓
- Event page gallery + description + org header + status banner + Register rules → Task 6. ✓
- Data-model additions + `cancelled` enum, no RLS change → Task 1. ✓
- Multi-org seed with cancelled + rescheduled demos → Task 2. ✓
- Read layer (`useMarketplaceEvents`/`useOrgs`/`useOrg`/`useEventsByOrg`, extended `EventRow`, `OrgRow`) → Task 3. ✓
- **Deferred to Plan B (documented):** Orgs tab, Org page, org-context removal (`lib/org.tsx`, choose-org, index gate), My Races global, ticket lifecycle banner, profile cleanup, PRD/iOS-spec doc edits. `useOrg(id)` is added here (event header uses it) and reused by Plan B.

**Placeholder scan:** none. `useEvents`/`fetchEvents` (org-scoped) removed with its only consumer replaced; `events-screen.test.tsx` removed in Task 7 with a note.

**Type consistency:** `EventRow`(+org_id/hero_image_url/description/gallery/original_date/status_note/org_name), `OrgRow`, `eventStatusKind/eventStatusLabel/StatusBadge/StatusBanner`, `EventCard`, `EventGallery`, and route hrefs (`/event/[id]`, `/org/[id]`, `/register/[categoryId]`) are used consistently. `/org/[id]` is created in Plan B — the event header links to it; until Plan B lands the link resolves to a missing route (acceptable within Plan A; Plan B adds the screen).

---

## Execution Handoff

Plan A of 2. On completion, **Plan B — Orgs + navigation cleanup** adds the Orgs tab + Org page (consuming `useOrgs`/`useOrg`/`useEventsByOrg` from Task 3), removes the org-context (`choose-org`, `lib/org.tsx`, the index gate, the org switcher), makes My Races global, adds the ticket lifecycle banner, and updates the PRD + iOS spec.
