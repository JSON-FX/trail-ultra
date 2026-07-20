# Marketplace — Orgs + Navigation Cleanup (Plan B of the redesign)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the marketplace redesign ([docs/specs/2026-07-20-marketplace-redesign.md](../specs/2026-07-20-marketplace-redesign.md)): add the **Orgs** tab + Facebook-style **Org page**, retire the **org-context** (choose-org gate, org switcher, `lib/org.tsx`), make **My Races global**, add the **ticket lifecycle banner**, and update the **PRD + iOS spec**.

**Architecture:** Builds on **Plan A** (which added `useOrgs`/`useOrg`/`useEventsByOrg`, `EventCard`, and `StatusBanner`). New Orgs list + Org page reuse those. Then the org-context is removed in dependency order — consumers first (races, profile), the `lib/org.tsx` module and choose-org screen **last** — so every task stays tsc-clean. My Races drops its org filter (RLS already restricts to own rows) and uses a single global cache key; the ticket reads the event's lifecycle fields to show a Cancelled/Rescheduled banner.

**Tech Stack:** Expo Router, `@tanstack/react-query`, `@supabase/supabase-js`, `@trail-ultra/shared`, jest-expo + `@testing-library/react-native`.

## Global Constraints

- **Requires Plan A merged.** Uses `useOrgs`/`useOrg`/`useEventsByOrg`/`EventRow.org_name` from `lib/events.ts` and `StatusBanner`/`EventCard` from `components/`.
- **Removal order keeps every task tsc-clean:** update `races.tsx` and `profile.tsx` off `useOrg` first; delete `lib/org.tsx` + `app/choose-org.tsx` and drop `OrgProvider`/the index gate **only after** no screen imports `useOrg`.
- **My Races is global.** `useMyRegistrations()` takes no org (RLS `registrations_read_own` already restricts to the signed-in user); the offline list cache uses a single key `myraces:all`. Offline ticket behavior from Plan 4 is preserved.
- **Ticket lifecycle banner is best-effort/online** — it renders from the live registration read; the cached (offline) ticket still renders without it.
- **getdesign `apple` theme** from `lib/theme.ts`. **Expo Go compatible** (no new native modules). Money is integer centavos.
- App tests use **jest-expo** (`mock`-prefixed `jest.mock` closure vars). Deleting `lib/org.tsx` means **no test may `jest.mock("../lib/org")`** afterward.

## File Structure

```
apps/mobile/
├── components/OrgHeader.tsx        NEW — FB-style banner + avatar + about
├── app/(tabs)/orgs.tsx             NEW — organizations list
├── app/org/[id].tsx                NEW — org page (header + org's events)
├── app/(tabs)/_layout.tsx          MODIFY — add Orgs tab
├── lib/registration.ts            MODIFY — useMyRegistrations() global + event lifecycle fields
├── lib/ticketCache.ts             MODIFY — single global myraces key
├── app/(tabs)/races.tsx           MODIFY — global (no org)
├── app/ticket/[registrationId].tsx MODIFY — lifecycle banner
├── app/(tabs)/profile.tsx         MODIFY — remove "Switch organization"
├── app/index.tsx                  MODIFY — remove choose-org gate
├── app/_layout.tsx                MODIFY — remove OrgProvider
├── lib/org.tsx                    DELETE
└── app/choose-org.tsx             DELETE
docs/
├── 00-product-overview.md         MODIFY — PRD reframe
└── 01-mobile-ios-mvp.md           MODIFY — nav/screens reframe
```

---

### Task 1: Orgs tab + Org page

**Files:**
- Create: `apps/mobile/components/OrgHeader.tsx`
- Create: `apps/mobile/app/(tabs)/orgs.tsx`
- Create: `apps/mobile/app/org/[id].tsx`
- Modify: `apps/mobile/app/(tabs)/_layout.tsx`
- Create: `apps/mobile/__tests__/orgs.test.tsx`, `apps/mobile/__tests__/org-page.test.tsx`

- [ ] **Step 1: OrgHeader**

Create `apps/mobile/components/OrgHeader.tsx`:
```tsx
import { View, Text, Image, StyleSheet } from "react-native";
import type { OrgRow } from "../lib/events";
import { theme } from "../lib/theme";

export function OrgHeader({ org }: { org: OrgRow }) {
  return (
    <View>
      <Image source={org.banner_url ? { uri: org.banner_url } : undefined} style={styles.banner} resizeMode="cover" />
      <View style={styles.body}>
        <Image source={org.logo_url ? { uri: org.logo_url } : undefined} style={styles.avatar} />
        <Text style={styles.name}>{org.name}</Text>
        {org.description ? <Text style={styles.about}>{org.description}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { width: "100%", height: 150, backgroundColor: theme.parchment },
  body: { paddingHorizontal: 20, marginTop: -36 },
  avatar: { width: 72, height: 72, borderRadius: 36, borderWidth: 3, borderColor: theme.canvas, backgroundColor: theme.hairline },
  name: { fontSize: 24, fontWeight: "700", color: theme.ink, marginTop: 10 },
  about: { color: theme.inkMuted, marginTop: 6, fontSize: 14, lineHeight: 20 },
});
```

- [ ] **Step 2: Orgs list (tab)**

Create `apps/mobile/app/(tabs)/orgs.tsx`:
```tsx
import { View, Text, FlatList, Pressable, Image, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useOrgs } from "../../lib/events";
import { theme } from "../../lib/theme";

export default function Orgs() {
  const { data, isLoading, isError, refetch } = useOrgs();
  const router = useRouter();
  if (isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (isError) {
    return <View style={styles.center}><Pressable onPress={() => refetch()} accessibilityRole="button"><Text style={styles.err}>Couldn't load. Tap to retry.</Text></Pressable></View>;
  }
  return (
    <FlatList
      style={styles.list}
      data={data ?? []}
      keyExtractor={(o) => o.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      ListHeaderComponent={<Text style={styles.h}>Organizations</Text>}
      ListEmptyComponent={<Text style={styles.empty}>No organizations yet.</Text>}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/org/${item.id}`)} accessibilityRole="button">
          <Image source={item.logo_url ? { uri: item.logo_url } : undefined} style={styles.logo} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{item.name}</Text>
            {item.description ? <Text style={styles.meta} numberOfLines={1}>{item.description}</Text> : null}
          </View>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: theme.canvas },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  h: { fontSize: 28, fontWeight: "600", letterSpacing: -0.4, color: theme.ink, marginBottom: 12 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderColor: theme.hairline, borderRadius: theme.radius.lg, padding: 14, marginBottom: 12 },
  logo: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.hairline },
  name: { fontSize: 17, fontWeight: "600", color: theme.ink },
  meta: { color: theme.inkMuted, marginTop: 2, fontSize: 13 },
  chevron: { color: theme.inkFaint, fontSize: 20 },
  empty: { color: theme.inkMuted }, err: { color: theme.stop },
});
```

- [ ] **Step 3: Org page**

Create `apps/mobile/app/org/[id].tsx`:
```tsx
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useOrg, useEventsByOrg } from "../../lib/events";
import { OrgHeader } from "../../components/OrgHeader";
import { EventCard } from "../../components/EventCard";
import { theme } from "../../lib/theme";

export default function OrgPage() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const org = useOrg(id);
  const events = useEventsByOrg(id);
  if (org.isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (!org.data) return <View style={styles.center}><Text style={styles.meta}>Organization not found.</Text></View>;
  return (
    <FlatList
      style={styles.list}
      data={events.data ?? []}
      keyExtractor={(e) => e.id}
      contentContainerStyle={{ paddingBottom: 32 }}
      ListHeaderComponent={
        <View>
          <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable>
          <OrgHeader org={org.data} />
          <Text style={styles.section}>Events</Text>
        </View>
      }
      ListEmptyComponent={<Text style={styles.empty}>No events yet.</Text>}
      renderItem={({ item }) => (
        <View style={{ paddingHorizontal: 16 }}>
          <EventCard event={item} onPress={() => router.push(`/event/${item.id}`)} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: theme.canvas },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  back: { color: theme.pine, padding: 16, paddingBottom: 4, fontSize: 15 },
  section: { fontSize: 18, fontWeight: "700", color: theme.ink, paddingHorizontal: 16, marginTop: 20, marginBottom: 10 },
  meta: { color: theme.inkMuted }, empty: { color: theme.inkMuted, paddingHorizontal: 16 },
});
```

- [ ] **Step 4: Add the Orgs tab**

Replace `apps/mobile/app/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from "expo-router";
import { theme } from "../../lib/theme";

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: theme.primary }}>
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="orgs" options={{ title: "Orgs" }} />
      <Tabs.Screen name="races" options={{ title: "My Races" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
```

- [ ] **Step 5: Failing tests**

Create `apps/mobile/__tests__/orgs.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock("../lib/events", () => ({
  useOrgs: () => ({ data: [
    { id: "o1", name: "Run With Point", slug: "run-with-point", logo_url: null, banner_url: null, description: "Davao trails", brand_color: null },
    { id: "o2", name: "Bukidnon Trails", slug: "bukidnon-trails", logo_url: null, banner_url: null, description: "Kitanglad", brand_color: null },
  ], isLoading: false, isError: false, refetch: jest.fn() }),
}));

import Orgs from "../app/(tabs)/orgs";

describe("Orgs", () => {
  it("lists organizations and routes to an org page", () => {
    render(<Orgs />);
    expect(screen.getByText("Run With Point")).toBeOnTheScreen();
    expect(screen.getByText("Bukidnon Trails")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Bukidnon Trails"));
    expect(mockPush).toHaveBeenCalledWith("/org/o2");
  });
});
```

Create `apps/mobile/__tests__/org-page.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ id: "o2" }), useRouter: () => ({ push: mockPush, back: jest.fn() }) }));
jest.mock("../lib/events", () => ({
  useOrg: () => ({ data: { id: "o2", name: "Bukidnon Trails", slug: "bukidnon-trails", logo_url: null, banner_url: null, description: "Highland skyruns", brand_color: null }, isLoading: false }),
  useEventsByOrg: () => ({ data: [
    { id: "e2", org_id: "o2", name: "Kitanglad Highland 50", place: "Mt Kitanglad", region: "Bukidnon", event_date: "2026-09-20", status: "open", hero_image_url: null, gallery: [], original_date: null, status_note: null },
  ], isLoading: false }),
}));

import OrgPage from "../app/org/[id]";

describe("OrgPage", () => {
  it("shows the org header + its events and routes to an event", () => {
    render(<OrgPage />);
    expect(screen.getByText("Bukidnon Trails")).toBeOnTheScreen();
    expect(screen.getByText("Highland skyruns")).toBeOnTheScreen();
    expect(screen.getByText("Kitanglad Highland 50")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("Kitanglad Highland 50"));
    expect(mockPush).toHaveBeenCalledWith("/event/e2");
  });
});
```

- [ ] **Step 6: Run + commit**

```bash
cd apps/mobile && pnpm test orgs org-page 2>&1 | tail -12 ; cd ../..
git add apps/mobile && git commit -m "feat(mobile): Orgs tab + org page (FB-style header + org's events)"
```

---

### Task 2: My Races global (drop org filter + global cache)

**Files:**
- Modify: `apps/mobile/lib/registration.ts`
- Modify: `apps/mobile/lib/ticketCache.ts`
- Modify: `apps/mobile/app/(tabs)/races.tsx`
- Modify: `apps/mobile/__tests__/my-races.test.tsx`

- [ ] **Step 1: `useMyRegistrations()` global + event lifecycle fields**

In `apps/mobile/lib/registration.ts`:

Extend `RegistrationRow` — add the event lifecycle fields:
```ts
export type RegistrationRow = {
  id: string; status: string; total_amount: number; ticket_token: string | null; org_id: string;
  eventName: string; categoryLabel: string; checkoutUrl: string | null;
  eventStatus: string | null; eventDate: string | null; originalDate: string | null; statusNote: string | null;
};
```

Extend the select + mapper:
```ts
const REG_SELECT =
  "id,status,total_amount,ticket_token,org_id,events(name,status,event_date,original_date,status_note),categories(label,distance_km),payments(checkout_url)";

function mapReg(r: any): RegistrationRow {
  const payment = Array.isArray(r.payments) ? r.payments[0] : r.payments;
  return {
    id: r.id, status: r.status, total_amount: r.total_amount, ticket_token: r.ticket_token ?? null, org_id: r.org_id,
    eventName: r.events?.name ?? "Event", categoryLabel: r.categories?.label ?? "",
    checkoutUrl: payment?.checkout_url ?? null,
    eventStatus: r.events?.status ?? null, eventDate: r.events?.event_date ?? null,
    originalDate: r.events?.original_date ?? null, statusNote: r.events?.status_note ?? null,
  };
}
```

Replace the org-scoped list fetch/hook with a global one:
```ts
export async function fetchMyRegistrations(): Promise<RegistrationRow[]> {
  const { data, error } = await supabase
    .from("registrations")
    .select(REG_SELECT)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapReg);
}

export function useMyRegistrations() {
  return useQuery({ queryKey: ["my-registrations"], queryFn: fetchMyRegistrations });
}
```
(`fetchRegistration`/`useRegistration` are unchanged except they now also return the added lifecycle fields via `REG_SELECT`/`mapReg`.)

- [ ] **Step 2: Single global myraces cache key**

In `apps/mobile/lib/ticketCache.ts`, change the myraces key + the two list functions (drop `orgId`):
```ts
const mKey = () => "myraces:all";
```
```ts
export async function cacheMyRaces(list: CachedTicket[]): Promise<void> {
  await AsyncStorage.setItem(mKey(), JSON.stringify(list));
  await Promise.all(list.filter((t) => t.status === "paid").map((t) => cacheTicket(t)));
}

export async function getCachedMyRaces(): Promise<CachedTicket[]> {
  const raw = await AsyncStorage.getItem(mKey());
  if (!raw) return [];
  try { return JSON.parse(raw) as CachedTicket[]; } catch { return []; }
}
```
(`clearTicketCache` already removes `myraces:`-prefixed keys — `myraces:all` still matches.)

- [ ] **Step 3: My Races screen — global**

Replace `apps/mobile/app/(tabs)/races.tsx`:
```tsx
import { useEffect, useState } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useMyRegistrations } from "../../lib/registration";
import { cacheMyRaces, getCachedMyRaces, type CachedTicket } from "../../lib/ticketCache";
import { theme } from "../../lib/theme";

type Row = { id: string; eventName: string; categoryLabel: string; status: string };

export default function MyRaces() {
  const { data, isLoading, isError, refetch } = useMyRegistrations();
  const router = useRouter();
  const [cached, setCached] = useState<CachedTicket[] | null>(null);

  useEffect(() => { getCachedMyRaces().then(setCached).catch(() => setCached([])); }, []);

  useEffect(() => {
    if (data) {
      cacheMyRaces(data.map((r) => ({
        rid: r.id, token: r.ticket_token, eventName: r.eventName, categoryLabel: r.categoryLabel,
        runnerName: "", status: r.status, orgId: r.org_id,
      })));
    }
  }, [data]);

  const rows: Row[] = data
    ? data.map((r) => ({ id: r.id, eventName: r.eventName, categoryLabel: r.categoryLabel, status: r.status }))
    : (cached ?? []).map((c) => ({ id: c.rid, eventName: c.eventName, categoryLabel: c.categoryLabel, status: c.status }));

  if (!data && (cached === null || isLoading)) return <View style={styles.center}><ActivityIndicator /></View>;
  if (isError && !data && rows.length === 0) {
    return <View style={styles.center}><Pressable onPress={() => refetch()} accessibilityRole="button"><Text style={styles.err}>Couldn't load. Tap to retry.</Text></Pressable></View>;
  }

  return (
    <FlatList
      style={styles.list}
      data={rows}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      ListHeaderComponent={<Text style={styles.h}>My Races</Text>}
      ListEmptyComponent={<Text style={styles.empty}>No registrations yet.</Text>}
      renderItem={({ item }) => {
        const paid = item.status === "paid";
        return (
          <Pressable style={styles.card} onPress={() => router.push(paid ? `/ticket/${item.id}` : `/pay/${item.id}`)} accessibilityRole="button">
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.eventName}</Text>
              <Text style={styles.meta}>{item.categoryLabel}</Text>
            </View>
            <View style={[styles.badge, paid ? styles.badgePaid : styles.badgePending]}>
              <Text style={[styles.badgeT, paid ? styles.badgeTPaid : styles.badgeTPending]}>{paid ? "Paid" : "Pending"}</Text>
            </View>
          </Pressable>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: theme.canvas },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  h: { fontSize: 28, fontWeight: "600", letterSpacing: -0.4, color: theme.ink, marginBottom: 12 },
  card: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: theme.hairline, borderRadius: theme.radius.lg, padding: 16, marginBottom: 12 },
  name: { fontSize: 17, fontWeight: "600", color: theme.ink },
  meta: { color: theme.inkMuted, marginTop: 3, fontSize: 13 },
  badge: { borderRadius: theme.radius.pill, paddingVertical: 5, paddingHorizontal: 12 },
  badgePaid: { backgroundColor: "#e7f3ff" }, badgePending: { backgroundColor: theme.parchment },
  badgeT: { fontSize: 12, fontWeight: "700" },
  badgeTPaid: { color: theme.primary }, badgeTPending: { color: theme.inkMuted },
  empty: { color: theme.inkMuted }, err: { color: theme.stop },
});
```

- [ ] **Step 4: Update the My Races test (drop the org mock)**

In `apps/mobile/__tests__/my-races.test.tsx`: **remove** `jest.mock("../lib/org", …)` and any `useOrg` reference; keep the `ticketCache` mock but its `getCachedMyRaces`/`cacheMyRaces` are now called with **no orgId** (the `jest.fn()` mocks already ignore args, and `getCachedMyRaces` mock stays `mockResolvedValue([])` with `mockResolvedValueOnce([...])` in the offline test). The `useMyRegistrations` mock factory takes no argument. No assertion changes.

- [ ] **Step 5: Run + commit**

```bash
cd apps/mobile && pnpm test my-races registration-hooks 2>&1 | tail -12 && npx tsc --noEmit 2>&1 | tail -8 && echo TSC_CLEAN ; cd ../..
git add apps/mobile && git commit -m "feat(mobile): My Races global (all orgs); event lifecycle on registration read; global cache key"
```

---

### Task 3: Ticket lifecycle banner

**Files:**
- Modify: `apps/mobile/app/ticket/[registrationId].tsx`
- Modify: `apps/mobile/__tests__/ticket-screen.test.tsx`

- [ ] **Step 1: Render the banner from the live registration**

In `apps/mobile/app/ticket/[registrationId].tsx`, import the banner and render it above the QR. Add:
```tsx
import { StatusBanner } from "../../components/StatusBadge";
```
Just under the event/category header (before the QR block), insert:
```tsx
{reg.data ? (
  <StatusBanner event={{
    status: reg.data.eventStatus ?? "open",
    original_date: reg.data.originalDate,
    event_date: reg.data.eventDate,
    status_note: reg.data.statusNote,
  }} />
) : null}
```
(The banner returns `null` unless the event is cancelled/rescheduled, so paid-and-unchanged tickets are unaffected. It reads live fields only; the offline cached ticket renders without it — acceptable.)

- [ ] **Step 2: Cover the cancelled banner**

Add a test to `apps/mobile/__tests__/ticket-screen.test.tsx` (the `useRegistration` mock's `data` needs the lifecycle fields). Add an entry where `eventStatus: "cancelled"` and assert `screen.getByText("This event was cancelled")` renders. Reuse the file's reassignable `mockRegData` pattern; extend the paid `data` object with `eventStatus`, `eventDate`, `originalDate`, `statusNote` (defaults null) so the existing tests still pass, then a new test sets `eventStatus: "cancelled"`, `statusNote: "…"`.

- [ ] **Step 3: Run + commit**

```bash
cd apps/mobile && pnpm test ticket-screen 2>&1 | tail -10 ; cd ../..
git add apps/mobile && git commit -m "feat(mobile): ticket shows Cancelled/Rescheduled banner"
```

---

### Task 4: Profile cleanup (remove "Switch organization")

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`

- [ ] **Step 1: Drop the org switcher**

In `apps/mobile/app/(tabs)/profile.tsx`: remove `import { useOrg }`, the `const { clearOrg } = useOrg()`, the `switchOrg` function, and the "Switch organization" `Pressable`. Change sign-out to not touch org:
```ts
async function doSignOut() { await signOut(); router.replace("/(auth)/sign-in"); }
```
Leave edit-profile + Sign out intact. `profile.test.tsx` mocks `../lib/org` — **remove that mock** (the screen no longer imports it).

- [ ] **Step 2: Run + commit**

```bash
cd apps/mobile && pnpm test profile 2>&1 | tail -10 && npx tsc --noEmit 2>&1 | tail -8 && echo TSC_CLEAN ; cd ../..
git add apps/mobile && git commit -m "feat(mobile): remove Switch organization from Profile"
```

---

### Task 5: Remove the org-context (delete `lib/org.tsx`)

**Files:**
- Modify: `apps/mobile/app/index.tsx`, `apps/mobile/app/_layout.tsx`
- Delete: `apps/mobile/lib/org.tsx`, `apps/mobile/app/choose-org.tsx`

> By now no screen imports `useOrg` (races/profile updated in Tasks 2/4). This task removes the last two consumers (index gate + provider) and deletes the module.

- [ ] **Step 1: Simplify the routing gate**

Replace `apps/mobile/app/index.tsx`:
```tsx
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/auth";

export default function Index() {
  const { session, loading } = useAuth();
  if (loading) return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  return <Redirect href="/(tabs)/events" />;
}
```

- [ ] **Step 2: Drop OrgProvider**

Replace `apps/mobile/app/_layout.tsx`:
```tsx
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "../lib/auth";

const queryClient = new QueryClient();

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <AuthProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProvider>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Delete the module + screen; confirm no stragglers**

```bash
git rm apps/mobile/lib/org.tsx apps/mobile/app/choose-org.tsx
grep -rn "lib/org\"\|useOrg\|OrgProvider\|choose-org" apps/mobile/app apps/mobile/lib apps/mobile/__tests__ || echo "NO org-context references remain"
```
Expected: no matches (fix any that appear).

- [ ] **Step 4: Full suite + tsc + commit**

```bash
cd apps/mobile && pnpm test 2>&1 | tail -12 && npx tsc --noEmit 2>&1 | tail -12 && echo TSC_CLEAN ; cd ../..
git add -A && git commit -m "refactor(mobile): remove org-context (choose-org, lib/org.tsx, org switcher, index gate)"
```

---

### Task 6: PRD + iOS spec doc updates

**Files:**
- Modify: `docs/00-product-overview.md`
- Modify: `docs/01-mobile-ios-mvp.md`

- [ ] **Step 1: PRD (`docs/00-product-overview.md`)**

- §1 Summary + §2.1 Goals: replace "enter **org-first** — choose an organization, then live inside its branded world" with "browse a **marketplace** of events across organizations, open an event, register and pay".
- §2.2 Non-goals: **delete** the "Cross-org unified discovery feed" bullet (it is now MVP).
- §4.2 feature table: replace the "Choose / switch organization" row with "**Browse marketplace** (all orgs' events)" and add "**Browse organizations + org page**"; keep "Event detail + category select"; add an Admin-web row "**Reschedule / cancel events**".
- §4.3 mobile list: replace item 2 ("Choose & switch organization") with "Marketplace — browse all orgs' events" and add "Organizations list + org page"; under Admin-web add "Reschedule / cancel events (reflected in the app)".
- §5.2 Multi-tenancy: change the "**Org-first navigation**" bullet to "**Marketplace navigation** — the runner browses all organizations' published events; data is still siloed by `org_id` + RLS, and published-event reads are cross-org **by design**. Registrations/tickets/My Races remain the runner's own rows."
- §6 data model: `events` += `description`, `gallery`, `original_date`, `status_note`, and `cancelled` in the status set; `organizations` += `banner_url`, `description`.

- [ ] **Step 2: iOS MVP spec (`docs/01-mobile-ios-mvp.md`)**

- §4 nav map: replace the org-first tree (`Choose Organization → App tabs`) with the marketplace tree (`session → tabs: Events(marketplace) · Orgs · My Races · Profile`), matching [docs/specs/2026-07-20-marketplace-redesign.md](../specs/2026-07-20-marketplace-redesign.md) §3.
- §5 screen table: replace "Choose Organization" + "Events (this org)" rows with "Events (Marketplace)", "Orgs", "Org page"; note the event page's gallery/description/org-header/status-banner; note event lifecycle (cancelled/rescheduled) display.
- Add a short note that the reschedule/cancel **action** is Admin web (M3); the app displays the states.

- [ ] **Step 3: Commit**

```bash
git add docs
git commit -m "docs: PRD + iOS spec reframed org-first → marketplace"
```

---

### Task 7: Full suites, typecheck, acceptance

- [ ] **Step 1: Full mobile suite + tsc**

```bash
cd apps/mobile && pnpm test 2>&1 | tail -14 && npx tsc --noEmit 2>&1 | tail -12 && echo TSC_CLEAN ; cd ../..
```
Expected: all suites pass (Plan A's + new orgs/org-page + updated my-races/profile/ticket + Plan 2–4), tsc clean, no `lib/org` references.

- [ ] **Step 2: Backend suite**

```bash
pnpm test 2>&1 | tail -10
```
Expected: green (Plan B is app-only; no backend change).

- [ ] **Step 3: Manual acceptance (sim)** — stack + functions serve up; `cd apps/mobile && npx expo start`, press `i`.

Sign in → land directly on the **marketplace** (no choose-org). Open the **Orgs** tab → tap an org → **org page** (banner + photo + about + its events) → open an event. From an event page, tap the **org header** → same org page. **My Races** lists registrations across **all** orgs. Register + pay a still-open event → ticket. Open a ticket for a cancelled event (set one of your registrations' event to cancelled via Studio) → **Cancelled banner**. Confirm **Profile** has no "Switch organization".

- [ ] **Step 4: Commit any wire-up fixes**

```bash
git add -A && git commit -m "chore(mobile): Plan B orgs + cleanup verified"
```

---

## Self-Review

**Spec coverage** (against [2026-07-20-marketplace-redesign.md](../specs/2026-07-20-marketplace-redesign.md) §3, §8–§10):
- Orgs tab + FB-style Org page → Task 1. ✓
- My Races global (drop org filter, global cache) → Task 2. ✓
- Ticket lifecycle banner → Task 3. ✓
- Profile "Switch organization" removed → Task 4. ✓
- Org-context removed (choose-org, `lib/org.tsx`, index gate, OrgProvider) → Task 5. ✓
- PRD + iOS spec reframed → Task 6. ✓

**Ordering:** consumers updated before deletion — `races.tsx` (Task 2) and `profile.tsx` (Task 4) drop `useOrg` before `lib/org.tsx` is deleted (Task 5); every task ends tsc-clean.

**Placeholder scan:** none. Test edits name the exact mock to remove (`jest.mock("../lib/org")` in my-races + profile tests) so the suite doesn't reference a deleted module.

**Type consistency:** `useOrgs`/`useOrg`/`useEventsByOrg`/`OrgRow`/`EventCard`/`StatusBanner` (from Plan A), `useMyRegistrations()` (no arg) + extended `RegistrationRow` (eventStatus/eventDate/originalDate/statusNote), `cacheMyRaces(list)`/`getCachedMyRaces()` (no orgId), and routes `/org/[id]`, `/ticket/[id]`, `/pay/[id]` are consistent. The `/org/[id]` route created here satisfies the event-header link added in Plan A.

---

## Execution Handoff

Plan B of 2 — completes the marketplace redesign. Requires Plan A merged. On completion the runner app is fully marketplace-based: sign in → browse all orgs' events + organizations → org pages → register/pay/ticket, My Races across all orgs, event lifecycle shown throughout; no org-first remnants. The reschedule/cancel **action** remains Admin web (M3, separate).
