# Pay · Confirm · Ticket · Offline — Implementation Plan (Plan 4 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Plan 3 "registration created (pending payment)" stub with the real tail of the runner journey — open an in-app checkout WebView, confirm payment from the **server webhook** (never the client redirect), mint + cache a **signed QR ticket that renders fully offline**, and fill the **My Races** tab.

**Architecture:** The pending registration created in Plan 3 already returns a `checkout_url`. Plan 4 points the local `FakePaymentProvider` at a **real hosted sandbox-checkout page** served by a new `fake-checkout` Edge Function; opening it in `expo-web-browser`'s auth session lets the tester "pay", which calls the shared `confirmPayment` routine (the same one the PayMongo webhook uses) and deep-links back to the app. The app **does not trust the redirect** — it polls `registrations.status` (TanStack Query `refetchInterval`) until the webhook flips it to `paid`, then caches the ticket to AsyncStorage so the **Ticket** and **My Races** screens work with no network. When PayMongo is wired later, the only change is `getPaymentProvider()` returning a real provider — the app code is identical.

**Tech Stack:** Expo Router, `expo-web-browser` (auth session), `expo-linking` (deep-link return URL), `react-native-qrcode-svg` + `react-native-svg` (QR **display** only), `@react-native-async-storage/async-storage` (offline cache — already in use), `@tanstack/react-query`, Supabase Edge Functions (Deno), `@trail-ultra/shared` (`formatPeso`, `TicketPayload`).

## Global Constraints

- **Builds on Plans 1–3 running locally:** `supabase start` (local stack on 545xx) **and** `supabase functions serve --no-verify-jwt --env-file supabase/functions/.env` must be up. Seeded org *Run With Point*, event *Apo Sky Ultra 2026* (`…e1`), categories 100k/50k/21k/10k (`…c1`–`…c4`), add-ons (`…d1`,`…d2`), form fields `…f1`–`…f3`.
- **Payment status is NEVER trusted from the client redirect.** The app transitions to `paid` only when it observes `registrations.status = 'paid'` (set by the webhook / shared `confirmPayment`). Confirmation is by **polling** every ~3s with a ~90s timeout (realtime is a documented fast-follow, not in this plan).
- **A paid ticket renders fully offline.** On confirmation, cache the signed token + display fields to AsyncStorage; the Ticket and My Races screens read cache-first and never require network to show an existing paid ticket.
- **The runner app DISPLAYS a QR — it never scans.** No camera. `react-native-qrcode-svg` renders `registrations.ticket_token`.
- **Expo Go compatible — no new *native* modules beyond Expo's bundled set.** Allowed new deps: `expo-web-browser` (Expo module), `react-native-svg` (bundled in Expo Go), `react-native-qrcode-svg` (pure JS). **Do NOT** add `react-native-mmkv` or `react-native-webview` (both break Expo Go); the spec's "MMKV" is satisfied by the already-working AsyncStorage.
- **Money is integer centavos**; render with `formatPeso` from `@trail-ultra/shared`.
- **Deep-link return URL via `Linking.createURL(...)`** so it resolves correctly in Expo Go (`exp://…/--/…`) and standalone (`trailultra://…`). The app passes its return URL to the checkout page as a `return` query param; the page bounces back to it.
- **Swap-ready:** all PayMongo-specific behavior stays behind the Edge `PaymentProvider`. App code must not branch on "fake vs real".
- **Keep the existing backend test suite green.** Two existing assertions change *because the behavior intentionally changed* (checkout URL shape; Plan 3 register route) — update them, do not weaken them.
- App tests use **jest-expo** (mock Expo modules and the data hooks, like Plans 2–3); backend tests use root **Vitest** against the live local stack.

## File Structure

```
supabase/
├── migrations/
│   └── 20260720090000_payments_checkout_url.sql   NEW — add payments.checkout_url
├── functions/
│   ├── _shared/
│   │   ├── confirm.ts        NEW — confirmPayment(): mark paid + mint ticket + increment slot (shared)
│   │   └── payments.ts       MODIFY — FakePaymentProvider → hosted fake-checkout URL
│   ├── payments-webhook/index.ts     MODIFY — delegate to confirmPayment()
│   ├── registrations-checkout/index.ts  MODIFY — persist checkout_url on the payment row
│   └── fake-checkout/index.ts        NEW — dev-only hosted sandbox checkout page
└── tests/backend.test.ts     MODIFY — update checkout_url assertion; add fake-checkout e2e

apps/mobile/
├── lib/
│   ├── ticketCache.ts        NEW — AsyncStorage cache (tickets + my-races list + clear)
│   ├── registration.ts       MODIFY — add useRegistration()/useMyRegistrations() read hooks
│   └── auth.tsx              MODIFY — signOut clears the ticket cache
├── components/
│   └── TicketQR.tsx          NEW — QR display wrapper
├── app/
│   ├── pay/[registrationId].tsx      NEW — Pay → Pending → Confirmed (WebView + poll)
│   ├── ticket/[registrationId].tsx   NEW — offline QR ticket
│   ├── (tabs)/races.tsx      REPLACE placeholder — My Races list
│   ├── register/[categoryId].tsx     MODIFY — route to /pay/… instead of the stub
│   └── registration-created.tsx      DELETE — superseded by the pay screen
└── __tests__/                NEW tests per module/screen; UPDATE register-submit route assertion
```

---

### Task 1: Backend — hosted sandbox checkout + shared confirm + persist checkout_url

**Files:**
- Create: `supabase/migrations/20260720090000_payments_checkout_url.sql`
- Create: `supabase/functions/_shared/confirm.ts`
- Create: `supabase/functions/fake-checkout/index.ts`
- Modify: `supabase/functions/payments-webhook/index.ts`
- Modify: `supabase/functions/_shared/payments.ts`
- Modify: `supabase/functions/registrations-checkout/index.ts`
- Modify: `supabase/tests/backend.test.ts`
- Setup: append `PUBLIC_FUNCTIONS_URL` to `supabase/functions/.env` (+ `.env.example` if it exists)

**Interfaces:**
- Produces `confirmPayment(registrationId, method, raw?) → { ok:true, registration_id, already? } | { ok:false, error, status }` in `_shared/confirm.ts`.
- The fake checkout URL becomes `${PUBLIC_FUNCTIONS_URL}/fake-checkout?rid=<registration_id>` and is stored on `payments.checkout_url`.

- [ ] **Step 1: Migration — add `payments.checkout_url`**

Create `supabase/migrations/20260720090000_payments_checkout_url.sql`:
```sql
-- Persist the provider checkout URL so a pending registration can be resumed
-- (app relaunch / My Races "Resume") without re-deriving it. Table-level
-- `grant select ... to authenticated` (prior migration) already covers new columns.
alter table payments add column if not exists checkout_url text;
```

- [ ] **Step 2: Shared confirmation routine**

Create `supabase/functions/_shared/confirm.ts` (lifted verbatim from the current webhook body so behavior is identical):
```ts
import { serviceClient } from "./supabase.ts";
import { mintTicketToken } from "./ticket.ts";

export type ConfirmResult =
  | { ok: true; registration_id: string; already?: boolean }
  | { ok: false; error: string; status: number };

/** Mark a registration paid, mint its signed ticket, and increment the slot.
 *  Idempotent: a second call on an already-paid registration is a no-op. */
export async function confirmPayment(
  registrationId: string,
  method: string,
  raw: unknown = {},
): Promise<ConfirmResult> {
  const db = serviceClient();
  const { data: reg } = await db
    .from("registrations")
    .select("id,event_id,category_id,total_amount,status,organizations(commission_rate)")
    .eq("id", registrationId)
    .single();
  if (!reg) return { ok: false, error: "not_found", status: 404 };
  if (reg.status === "paid") return { ok: true, registration_id: reg.id, already: true };

  const rate = (reg.organizations as { commission_rate: number } | null)?.commission_rate ?? 0.10;
  const fee = Math.round(reg.total_amount * rate);
  const net = reg.total_amount - fee;

  const secret = Deno.env.get("TICKET_SIGNING_SECRET") ?? "dev-secret";
  const token = await mintTicketToken(
    { rid: reg.id, eid: reg.event_id, iat: Math.floor(Date.now() / 1000) },
    secret,
  );

  await db.from("payments").update({
    status: "paid", method, platform_fee: fee, net_to_org: net, raw,
  }).eq("registration_id", reg.id);
  await db.from("registrations").update({ status: "paid", ticket_token: token }).eq("id", reg.id);
  await db.rpc("increment_slot", { p_category_id: reg.category_id });

  return { ok: true, registration_id: reg.id };
}
```

- [ ] **Step 3: Thin the webhook to delegate**

Replace `supabase/functions/payments-webhook/index.ts`:
```ts
import { confirmPayment } from "../_shared/confirm.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

// Dev/fake webhook: confirms a payment by registration_id.
// When PayMongo is wired, this parses + verifies the provider signature, then calls confirmPayment.
Deno.serve(async (req) => {
  try {
    const body = await req.json();
    const registrationId = body.registration_id as string | undefined;
    if (!registrationId) return json({ error: "registration_id_required" }, 400);

    const r = await confirmPayment(registrationId, body.method ?? "gcash", body);
    if (!r.ok) return json({ error: r.error }, r.status);
    return json({ ok: true, registration_id: r.registration_id, already: r.already });
  } catch (e) {
    return json({ error: "server_error", details: String(e) }, 500);
  }
});
```

- [ ] **Step 4: Point the fake provider at the hosted page**

Replace `supabase/functions/_shared/payments.ts`:
```ts
export interface CheckoutInput { registrationId: string; amount: number; description: string }
export interface CheckoutResult { checkoutUrl: string; providerRef: string }
export interface PaymentProvider {
  readonly name: string;
  createCheckout(input: CheckoutInput): Promise<CheckoutResult>;
}

/** Dev/local provider — no real PayMongo. Serves a hosted sandbox checkout page. */
export class FakePaymentProvider implements PaymentProvider {
  readonly name = "fake";
  constructor(private functionsUrl: string) {}
  async createCheckout(input: CheckoutInput): Promise<CheckoutResult> {
    return {
      checkoutUrl: `${this.functionsUrl}/fake-checkout?rid=${input.registrationId}`,
      providerRef: `fake_${input.registrationId}`,
    };
  }
}

// Swap point when PayMongo is ready: return a PayMongoProvider when PAYMONGO_SECRET is set.
export function getPaymentProvider(): PaymentProvider {
  const base = Deno.env.get("PUBLIC_FUNCTIONS_URL") ?? "http://127.0.0.1:54521/functions/v1";
  return new FakePaymentProvider(base);
}
```

- [ ] **Step 5: Persist `checkout_url` at checkout**

In `supabase/functions/registrations-checkout/index.ts`, change the post-checkout payment update (currently only sets `provider_ref`):
```ts
await db.from("payments").update({
  provider_ref: checkout.providerRef,
  checkout_url: checkout.checkoutUrl,
}).eq("registration_id", reg.id);
```

- [ ] **Step 6: The hosted sandbox checkout page**

Create `supabase/functions/fake-checkout/index.ts`:
```ts
import { serviceClient } from "../_shared/supabase.ts";
import { confirmPayment } from "../_shared/confirm.ts";

function page(body: string, status = 200): Response {
  return new Response(
    `<!doctype html><html><head><meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width, initial-scale=1"><title>Sandbox checkout</title></head>` +
    `<body style="font-family:-apple-system,system-ui,sans-serif;margin:0;padding:32px;background:#f5f5f7;color:#1d1d1f">${body}</body></html>`,
    { status, headers: { "content-type": "text/html; charset=utf-8" } },
  );
}

// Navigating to the app's custom scheme closes the auth session and returns control to the app.
// The <script> auto-returns; the <a> is a manual fallback.
function bounce(returnUrl: string, status: string): Response {
  const target = returnUrl + (returnUrl.includes("?") ? "&" : "?") + "status=" + status;
  return page(
    `<h2>${status === "paid" ? "Payment complete" : "Payment cancelled"}</h2>` +
    `<p>Returning to the app…</p>` +
    `<p><a href="${target}">Tap here if it doesn't return automatically.</a></p>` +
    `<script>window.location.href=${JSON.stringify(target)}</script>`,
  );
}

// DEV ONLY. Stands in for a PayMongo-hosted checkout page while PayMongo is not wired.
Deno.serve(async (req) => {
  const u = new URL(req.url);
  const rid = u.searchParams.get("rid") ?? "";
  const ret = u.searchParams.get("return") ?? "";
  const action = u.searchParams.get("action");
  if (!rid || !ret) return page("<h2>Invalid checkout link</h2>", 400);

  if (action === "pay") {
    await confirmPayment(rid, "gcash", { source: "fake-checkout" });
    return bounce(ret, "paid");
  }
  if (action === "cancel") return bounce(ret, "cancel");

  const db = serviceClient();
  const { data: reg } = await db
    .from("registrations")
    .select("total_amount, events(name), categories(label)")
    .eq("id", rid)
    .maybeSingle();
  if (!reg) return page("<h2>Registration not found</h2>", 404);

  const ev = (reg.events as { name: string } | null)?.name ?? "Event";
  const cat = (reg.categories as { label: string } | null)?.label ?? "";
  const peso = "₱" + (reg.total_amount / 100).toLocaleString("en-US", { minimumFractionDigits: 2 });
  // Build the action links from the same env the provider used, so they don't depend on
  // how `functions serve` presents req.url's path.
  const fnBase = Deno.env.get("PUBLIC_FUNCTIONS_URL") ?? `${u.origin}/functions/v1`;
  const base = `${fnBase}/fake-checkout?rid=${encodeURIComponent(rid)}&return=${encodeURIComponent(ret)}`;
  return page(
    `<h1 style="font-size:22px;margin:0 0 4px">${ev}</h1>` +
    `<p style="color:#6e6e73;margin:0">${cat}</p>` +
    `<div style="font-size:34px;font-weight:700;margin:16px 0">${peso}</div>` +
    `<p style="color:#6e6e73;font-size:14px">GCash / Card / Maya — <b>sandbox</b>. No real charge.</p>` +
    `<a href="${base}&action=pay" style="display:block;text-align:center;background:#0066cc;color:#fff;padding:16px;border-radius:9999px;text-decoration:none;font-weight:600;margin:24px 0 12px">Pay ${peso}</a>` +
    `<a href="${base}&action=cancel" style="display:block;text-align:center;color:#0066cc;text-decoration:none">Cancel</a>`,
  );
});
```

- [ ] **Step 7: Local env var for the hosted page's base URL**

`PUBLIC_FUNCTIONS_URL` tells the fake provider where the page lives (must be reachable from the simulator, so `127.0.0.1`, not the Docker-internal `SUPABASE_URL`). Append to `supabase/functions/.env` (gitignored — local only):
```bash
printf '\nPUBLIC_FUNCTIONS_URL=http://127.0.0.1:54521/functions/v1\n' >> supabase/functions/.env
# If a committed example file exists, document it there too:
[ -f supabase/functions/.env.example ] && printf '\nPUBLIC_FUNCTIONS_URL=http://127.0.0.1:54521/functions/v1\n' >> supabase/functions/.env.example || true
```

- [ ] **Step 8: Update the checkout-URL assertion + add a fake-checkout e2e**

In `supabase/tests/backend.test.ts`, the `registrations-checkout` test asserts the old URL shape. Change that one line:
```ts
// was: expect(body.checkout_url).toContain(`/dev/pay/${body.registration_id}`);
expect(body.checkout_url).toContain(`/fake-checkout?rid=${body.registration_id}`);
```
Then append a new suite (after the existing `payment confirmation (fake) e2e` block):
```ts
describe("fake-checkout sandbox page", () => {
  it("action=pay confirms the registration and returns a bounce page", async () => {
    const svc = service();
    const user = await makeUser(`fc_${Date.now()}@test.dev`);
    const checkout = await fetch(`${FN}/registrations-checkout`, {
      method: "POST",
      headers: { "content-type": "application/json", Authorization: `Bearer ${user.token}` },
      body: JSON.stringify({
        event_id: "00000000-0000-0000-0000-0000000000e1",
        category_id: "00000000-0000-0000-0000-0000000000c4",
        custom_data: { blood_type: "A", shirt_size: "L" },
        waiver_accepted: true,
        idempotency_key: `idem-fc-${Date.now()}`,
      }),
    }).then((r) => r.json());

    const ret = "trailultra://pay-callback";
    const res = await fetch(
      `${FN}/fake-checkout?rid=${checkout.registration_id}&return=${encodeURIComponent(ret)}&action=pay`,
    );
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("Payment complete");

    const reg = await svc.from("registrations").select("status,ticket_token").eq("id", checkout.registration_id).single();
    expect(reg.data?.status).toBe("paid");
    expect(reg.data?.ticket_token).toContain(".");

    await svc.from("registrations").delete().eq("id", checkout.registration_id);
    await svc.auth.admin.deleteUser(user.id);
  });
});
```

- [ ] **Step 9: Apply the migration, restart functions serve, run the backend suite**

```bash
# apply the new migration to the running local DB
pnpm exec supabase migration up --local 2>&1 | tail -5
# restart the functions watcher so it picks up the new/edited functions
pkill -f "supabase functions serve" 2>/dev/null; sleep 1
pnpm exec supabase functions serve --no-verify-jwt --env-file supabase/functions/.env > /tmp/trail-functions.log 2>&1 &
sleep 4
# run the backend suite (root Vitest)
pnpm test 2>&1 | tail -20
```
Expected: all backend suites pass, including `registrations-checkout`, `payment confirmation (fake) e2e`, and the new `fake-checkout sandbox page`.

- [ ] **Step 10: Commit**

```bash
git add supabase
git commit -m "feat(backend): hosted sandbox checkout page + shared confirmPayment + persist checkout_url"
```

---

### Task 2: Offline ticket cache + clear-on-sign-out

**Files:**
- Create: `apps/mobile/lib/ticketCache.ts`
- Modify: `apps/mobile/lib/auth.tsx`
- Create: `apps/mobile/__tests__/ticket-cache.test.ts`

**Interfaces:**
- Produces `CachedTicket` and `cacheTicket`, `getCachedTicket`, `cacheMyRaces`, `getCachedMyRaces`, `clearTicketCache`.

- [ ] **Step 1: Cache module**

Create `apps/mobile/lib/ticketCache.ts`:
```ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export type CachedTicket = {
  rid: string;
  token: string | null;
  eventName: string;
  categoryLabel: string;
  runnerName: string;
  status: string;
  orgId: string;
};

const tKey = (rid: string) => `ticket:${rid}`;
const mKey = (orgId: string) => `myraces:${orgId}`;

export async function cacheTicket(t: CachedTicket): Promise<void> {
  await AsyncStorage.setItem(tKey(t.rid), JSON.stringify(t));
}

export async function getCachedTicket(rid: string): Promise<CachedTicket | null> {
  const raw = await AsyncStorage.getItem(tKey(rid));
  return raw ? (JSON.parse(raw) as CachedTicket) : null;
}

export async function cacheMyRaces(orgId: string, list: CachedTicket[]): Promise<void> {
  await AsyncStorage.setItem(mKey(orgId), JSON.stringify(list));
  await Promise.all(list.filter((t) => t.status === "paid").map((t) => cacheTicket(t)));
}

export async function getCachedMyRaces(orgId: string): Promise<CachedTicket[]> {
  const raw = await AsyncStorage.getItem(mKey(orgId));
  return raw ? (JSON.parse(raw) as CachedTicket[]) : [];
}

export async function clearTicketCache(): Promise<void> {
  const keys = await AsyncStorage.getAllKeys();
  const mine = keys.filter((k) => k.startsWith("ticket:") || k.startsWith("myraces:"));
  if (mine.length) await AsyncStorage.multiRemove(mine);
}
```

- [ ] **Step 2: Clear cache on sign-out**

In `apps/mobile/lib/auth.tsx`, import the cache and clear it in `signOut`:
```ts
import { clearTicketCache } from "./ticketCache";
```
```ts
const signOut = async () => { await clearTicketCache(); await supabase.auth.signOut(); };
```

- [ ] **Step 3: Failing test**

Create `apps/mobile/__tests__/ticket-cache.test.ts`:
```ts
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"));

import { cacheTicket, getCachedTicket, cacheMyRaces, getCachedMyRaces, clearTicketCache, type CachedTicket } from "../lib/ticketCache";

const t: CachedTicket = { rid: "r1", token: "abc.def", eventName: "Apo Sky Ultra 2026", categoryLabel: "21K", runnerName: "Juan", status: "paid", orgId: "o1" };

describe("ticketCache", () => {
  beforeEach(async () => { await clearTicketCache(); });

  it("caches and reads a ticket", async () => {
    await cacheTicket(t);
    expect(await getCachedTicket("r1")).toEqual(t);
  });

  it("caches a my-races list and fans out paid tickets", async () => {
    await cacheMyRaces("o1", [t]);
    expect(await getCachedMyRaces("o1")).toEqual([t]);
    expect(await getCachedTicket("r1")).toEqual(t);
  });

  it("clearTicketCache removes ticket: and myraces: keys", async () => {
    await cacheTicket(t);
    await cacheMyRaces("o1", [t]);
    await clearTicketCache();
    expect(await getCachedTicket("r1")).toBeNull();
    expect(await getCachedMyRaces("o1")).toEqual([]);
  });
});
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/mobile && pnpm test ticket-cache 2>&1 | tail -10 ; cd ../..
```

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): offline ticket cache (AsyncStorage) + clear on sign-out"
```

---

### Task 3: Registration read hooks

**Files:**
- Modify: `apps/mobile/lib/registration.ts` (keep existing `startCheckout`; append reads)
- Create: `apps/mobile/__tests__/registration-hooks.test.tsx`

**Interfaces:**
- Consumes `supabase`, `@tanstack/react-query`.
- Produces `RegistrationRow`, `fetchRegistration`, `useRegistration(rid, { poll })`, `fetchMyRegistrations(orgId)`, `useMyRegistrations(orgId)`.

- [ ] **Step 1: Append read hooks to `registration.ts`**

Add these imports at the top of `apps/mobile/lib/registration.ts` (alongside the existing imports):
```ts
import { useQuery } from "@tanstack/react-query";
```
Append to the end of the file:
```ts
export type RegistrationRow = {
  id: string;
  status: string;
  total_amount: number;
  ticket_token: string | null;
  org_id: string;
  eventName: string;
  categoryLabel: string;
  checkoutUrl: string | null;
};

const REG_SELECT =
  "id,status,total_amount,ticket_token,org_id,events(name),categories(label,distance_km),payments(checkout_url)";

function mapReg(r: any): RegistrationRow {
  const payment = Array.isArray(r.payments) ? r.payments[0] : r.payments;
  return {
    id: r.id,
    status: r.status,
    total_amount: r.total_amount,
    ticket_token: r.ticket_token ?? null,
    org_id: r.org_id,
    eventName: r.events?.name ?? "Event",
    categoryLabel: r.categories?.label ?? "",
    checkoutUrl: payment?.checkout_url ?? null,
  };
}

export async function fetchRegistration(rid: string): Promise<RegistrationRow | null> {
  const { data, error } = await supabase.from("registrations").select(REG_SELECT).eq("id", rid).maybeSingle();
  if (error) throw error;
  return data ? mapReg(data) : null;
}

export function useRegistration(rid: string, opts?: { poll?: boolean }) {
  return useQuery({
    queryKey: ["registration", rid],
    queryFn: () => fetchRegistration(rid),
    refetchInterval: opts?.poll
      ? (query) => (query.state.data?.status === "paid" ? false : 3000)
      : false,
  });
}

export async function fetchMyRegistrations(orgId: string): Promise<RegistrationRow[]> {
  const { data, error } = await supabase
    .from("registrations")
    .select(REG_SELECT)
    .eq("org_id", orgId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapReg);
}

export function useMyRegistrations(orgId: string | null) {
  return useQuery({
    queryKey: ["my-registrations", orgId],
    queryFn: () => fetchMyRegistrations(orgId!),
    enabled: !!orgId,
  });
}
```
> RLS note: `registrations_read_own` already restricts rows to `auth.uid() = user_id`, so `fetchMyRegistrations` needs only the `org_id` filter — the user never sees another runner's rows. `events`/`categories`/`payments` are readable via their existing policies.

- [ ] **Step 2: Failing test**

Create `apps/mobile/__tests__/registration-hooks.test.tsx`:
```tsx
import { renderHook, waitFor } from "@testing-library/react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useRegistration } from "../lib/registration";

const maybeSingle = jest.fn().mockResolvedValue({
  data: {
    id: "r1", status: "paid", total_amount: 210000, ticket_token: "a.b", org_id: "o1",
    events: { name: "Apo Sky Ultra 2026" }, categories: { label: "21K", distance_km: 21 },
    payments: [{ checkout_url: "http://x/functions/v1/fake-checkout?rid=r1" }],
  },
  error: null,
});
const eq = jest.fn(() => ({ maybeSingle }));
const select = jest.fn(() => ({ eq }));
jest.mock("../lib/supabase", () => ({ supabase: { from: jest.fn(() => ({ select })) } }));

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useRegistration", () => {
  it("maps nested event/category/payment into a flat row", async () => {
    const { result } = renderHook(() => useRegistration("r1"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toMatchObject({
      id: "r1", status: "paid", ticket_token: "a.b",
      eventName: "Apo Sky Ultra 2026", categoryLabel: "21K",
      checkoutUrl: "http://x/functions/v1/fake-checkout?rid=r1",
    });
  });
});
```
> `gcTime: 0` prevents the QueryClient from holding a GC timer that hangs the test run (learned in Plan 3).

- [ ] **Step 3: Run — expect PASS**

```bash
cd apps/mobile && pnpm test registration-hooks 2>&1 | tail -10 ; cd ../..
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): registration read hooks (useRegistration/useMyRegistrations)"
```

---

### Task 4: Pay screen (WebView checkout → Pending → Confirmed) + reroute register

**Files:**
- Create: `apps/mobile/app/pay/[registrationId].tsx`
- Modify: `apps/mobile/app/register/[categoryId].tsx` (route to `/pay/…`)
- Delete: `apps/mobile/app/registration-created.tsx`
- Modify: `apps/mobile/__tests__/register-submit.test.tsx` (route assertion)
- Create: `apps/mobile/__tests__/pay-screen.test.tsx`

**Interfaces:**
- Consumes `useRegistration`, `cacheTicket`, `startCheckout` output (`{ registration_id, checkout_url }`), `expo-web-browser`, `expo-linking`.

- [ ] **Step 1: Install the auth-session browser**

```bash
cd apps/mobile && npx expo install expo-web-browser && cd ../..
```

- [ ] **Step 2: Pay screen**

Create `apps/mobile/app/pay/[registrationId].tsx`:
```tsx
import { useEffect, useRef, useState } from "react";
import { View, Text, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { formatPeso } from "@trail-ultra/shared";
import { useRegistration } from "../../lib/registration";
import { cacheTicket } from "../../lib/ticketCache";
import { theme } from "../../lib/theme";

const TIMEOUT_MS = 90_000;
// Deliberately NOT "pay/return" — that would collide with this pay/[registrationId] route.
const RETURN_PATH = "pay-callback";

export default function Pay() {
  const { registrationId, checkoutUrl } = useLocalSearchParams<{ registrationId: string; checkoutUrl?: string }>();
  const router = useRouter();
  const [awaiting, setAwaiting] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reg = useRegistration(registrationId, { poll: awaiting });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const paid = reg.data?.status === "paid";
  const url = checkoutUrl ?? reg.data?.checkoutUrl ?? null;

  // Cache the ticket the instant payment confirms (guaranteed-offline).
  useEffect(() => {
    if (paid && reg.data) {
      cacheTicket({
        rid: reg.data.id, token: reg.data.ticket_token, eventName: reg.data.eventName,
        categoryLabel: reg.data.categoryLabel, runnerName: "", status: "paid", orgId: reg.data.org_id,
      });
      if (timer.current) clearTimeout(timer.current);
    }
  }, [paid, reg.data]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  async function pay() {
    if (!url) { setErr("No checkout link available. Go back and try again."); return; }
    setErr(null);
    const redirect = Linking.createURL(RETURN_PATH);
    const full = url + (url.includes("?") ? "&" : "?") + "return=" + encodeURIComponent(redirect);
    try {
      // We do NOT trust the result — confirmation comes from polling the webhook-set status.
      await WebBrowser.openAuthSessionAsync(full, redirect);
    } catch {
      // ignore; polling drives the outcome
    }
    setTimedOut(false);
    setAwaiting(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setTimedOut(true), TIMEOUT_MS);
  }

  if (paid) {
    return (
      <View style={styles.c}>
        <Text style={styles.big}>Payment confirmed</Text>
        <Text style={styles.sub}>{reg.data?.eventName} — {reg.data?.categoryLabel}</Text>
        <Pressable style={styles.btn} onPress={() => router.replace(`/ticket/${registrationId}`)} accessibilityRole="button">
          <Text style={styles.btnT}>View ticket</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.c}>
      <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable>
      <Text style={styles.h}>Payment</Text>
      {reg.data ? <Text style={styles.sub}>{reg.data.eventName} — {reg.data.categoryLabel}</Text> : null}
      {reg.data ? <Text style={styles.total}>{formatPeso(reg.data.total_amount)}</Text> : null}

      {awaiting ? (
        <View style={styles.pending}>
          <ActivityIndicator />
          <Text style={styles.sub}>Waiting for payment confirmation…</Text>
          {timedOut ? <Text style={styles.note}>Still processing. If you completed payment, tap Check again.</Text> : null}
          <Pressable style={styles.secondary} onPress={() => reg.refetch()} accessibilityRole="button"><Text style={styles.secondaryT}>Check again</Text></Pressable>
          <Pressable style={styles.secondary} onPress={pay} accessibilityRole="button"><Text style={styles.secondaryT}>Retry payment</Text></Pressable>
        </View>
      ) : (
        <Pressable style={styles.btn} onPress={pay} accessibilityRole="button">
          <Text style={styles.btnT}>Pay now</Text>
        </Pressable>
      )}
      {err ? <Text style={styles.err}>{err}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: "#fff", padding: 24, paddingTop: 60 },
  back: { color: theme.pine, marginBottom: 8, fontSize: 15 },
  h: { fontSize: 24, fontWeight: "700", color: theme.ink },
  big: { fontSize: 26, fontWeight: "700", color: theme.pine, textAlign: "center", marginTop: 40 },
  sub: { color: theme.inkSoft, marginTop: 6, fontSize: 15, textAlign: "center" },
  total: { fontSize: 34, fontWeight: "700", color: theme.ink, marginTop: 12, textAlign: "center" },
  pending: { alignItems: "center", gap: 12, marginTop: 32 },
  note: { color: theme.inkSoft, textAlign: "center", fontSize: 13 },
  btn: { backgroundColor: theme.pine, borderRadius: theme.radius.pill, padding: 16, alignItems: "center", marginTop: 32 },
  btnT: { color: "#fff", fontWeight: "600", fontSize: 16 },
  secondary: { paddingVertical: 10 },
  secondaryT: { color: theme.pine, fontSize: 15, fontWeight: "600" },
  err: { color: theme.stop, marginTop: 16, textAlign: "center" },
});
```

- [ ] **Step 3: Route register submit to the pay screen**

In `apps/mobile/app/register/[categoryId].tsx`, the submit handler currently routes to `/registration-created`. Change the success navigation to carry both ids to the pay screen:
```ts
router.replace({
  pathname: "/pay/[registrationId]",
  params: { registrationId: res.registration_id, checkoutUrl: res.checkout_url },
});
```

- [ ] **Step 4: Delete the superseded stub**

```bash
git rm apps/mobile/app/registration-created.tsx
```

- [ ] **Step 5: Update the Plan 3 route assertion**

In `apps/mobile/__tests__/register-submit.test.tsx`, the mock resolves `{ registration_id: "r1", checkout_url: "http://x/dev/pay/r1" }` and asserts the old stub route. Update the final assertion:
```ts
// was: expect(replace).toHaveBeenCalledWith({ pathname: "/registration-created", params: { rid: "r1" } });
expect(replace).toHaveBeenCalledWith({
  pathname: "/pay/[registrationId]",
  params: { registrationId: "r1", checkoutUrl: "http://x/dev/pay/r1" },
});
```

- [ ] **Step 6: Failing test — pay screen**

Create `apps/mobile/__tests__/pay-screen.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const replace = jest.fn();
const openAuth = jest.fn().mockResolvedValue({ type: "dismiss" });
jest.mock("expo-web-browser", () => ({ openAuthSessionAsync: (...a: unknown[]) => openAuth(...a) }));
jest.mock("expo-linking", () => ({ createURL: (p: string) => `trailultra://${p}` }));
jest.mock("../lib/ticketCache", () => ({ cacheTicket: jest.fn() }));

let regData: any = {
  id: "r1", status: "pending", total_amount: 210000, ticket_token: null, org_id: "o1",
  eventName: "Apo Sky Ultra 2026", categoryLabel: "21K", checkoutUrl: "http://x/functions/v1/fake-checkout?rid=r1",
};
jest.mock("../lib/registration", () => ({ useRegistration: () => ({ data: regData, refetch: jest.fn() }) }));
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ registrationId: "r1" }),
  useRouter: () => ({ replace, back: jest.fn() }),
}));

import Pay from "../app/pay/[registrationId]";

describe("Pay screen", () => {
  it("opens the sandbox checkout with the return url appended, without trusting the result", async () => {
    render(<Pay />);
    fireEvent.press(screen.getByText("Pay now"));
    await waitFor(() => expect(openAuth).toHaveBeenCalled());
    const [full, redirect] = openAuth.mock.calls[0];
    expect(full).toContain("http://x/functions/v1/fake-checkout?rid=r1");
    expect(full).toContain("return=");
    expect(redirect).toBe("trailultra://pay-callback");
    // still shows the pending state (not "confirmed") because status is still pending
    expect(screen.getByText("Waiting for payment confirmation…")).toBeOnTheScreen();
  });

  it("shows Confirmed + View ticket when the registration is paid", () => {
    regData = { ...regData, status: "paid", ticket_token: "a.b" };
    render(<Pay />);
    expect(screen.getByText("Payment confirmed")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("View ticket"));
    expect(replace).toHaveBeenCalledWith("/ticket/r1");
  });
});
```

- [ ] **Step 7: Run — expect PASS (both the updated Plan 3 test and the new one)**

```bash
cd apps/mobile && pnpm test pay-screen register-submit 2>&1 | tail -14 ; cd ../..
```

- [ ] **Step 8: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): pay screen (WebView checkout + poll-to-confirm), route register to it"
```

---

### Task 5: Offline QR ticket screen

**Files:**
- Create: `apps/mobile/components/TicketQR.tsx`
- Create: `apps/mobile/app/ticket/[registrationId].tsx`
- Create: `apps/mobile/__tests__/ticket-screen.test.tsx`

**Interfaces:**
- Consumes `useRegistration`, `getCachedTicket`/`cacheTicket`, `react-native-qrcode-svg`.

- [ ] **Step 1: Install the QR renderer**

```bash
cd apps/mobile && npx expo install react-native-svg && pnpm add react-native-qrcode-svg && cd ../..
```
> `react-native-svg` is bundled in Expo Go; `react-native-qrcode-svg@^6.3` is pure JS and ships its own types.

- [ ] **Step 2: QR wrapper**

Create `apps/mobile/components/TicketQR.tsx`:
```tsx
import QRCode from "react-native-qrcode-svg";

export function TicketQR({ value, size = 220 }: { value: string; size?: number }) {
  return <QRCode value={value} size={size} backgroundColor="#ffffff" color="#000000" />;
}
```

- [ ] **Step 3: Ticket screen (cache-first, offline-capable)**

Create `apps/mobile/app/ticket/[registrationId].tsx`:
```tsx
import { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useRegistration } from "../../lib/registration";
import { getCachedTicket, cacheTicket, type CachedTicket } from "../../lib/ticketCache";
import { TicketQR } from "../../components/TicketQR";
import { theme } from "../../lib/theme";

export default function Ticket() {
  const { registrationId } = useLocalSearchParams<{ registrationId: string }>();
  const router = useRouter();
  const [cached, setCached] = useState<CachedTicket | null>(null);
  const [cacheLoaded, setCacheLoaded] = useState(false);
  const reg = useRegistration(registrationId);

  // Offline-first: paint from cache immediately.
  useEffect(() => {
    getCachedTicket(registrationId).then((c) => { setCached(c); setCacheLoaded(true); });
  }, [registrationId]);

  // Refresh the cache when fresh server data confirms paid.
  useEffect(() => {
    if (reg.data?.status === "paid" && reg.data.ticket_token) {
      const t: CachedTicket = {
        rid: reg.data.id, token: reg.data.ticket_token, eventName: reg.data.eventName,
        categoryLabel: reg.data.categoryLabel, runnerName: cached?.runnerName ?? "", status: "paid", orgId: reg.data.org_id,
      };
      cacheTicket(t);
      setCached(t);
    }
  }, [reg.data]);

  const token = reg.data?.ticket_token ?? cached?.token ?? null;
  const eventName = reg.data?.eventName ?? cached?.eventName ?? "";
  const categoryLabel = reg.data?.categoryLabel ?? cached?.categoryLabel ?? "";

  if (!cacheLoaded && reg.isLoading) return <View style={styles.center}><ActivityIndicator /></View>;

  return (
    <View style={styles.c}>
      <Pressable onPress={() => router.back()} accessibilityRole="button"><Text style={styles.back}>‹ Back</Text></Pressable>
      <Text style={styles.event}>{eventName}</Text>
      <Text style={styles.cat}>{categoryLabel}</Text>
      {token ? (
        <View style={styles.qrWrap}>
          <TicketQR value={token} />
          <Text style={styles.ref}>Ref {registrationId.slice(0, 8).toUpperCase()}</Text>
          <Text style={styles.note}>Show this QR at check-in. Works offline.</Text>
        </View>
      ) : (
        <Text style={styles.note}>No ticket yet — complete payment to get your race pass.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: "#fff", padding: 24, paddingTop: 60, alignItems: "center" },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  back: { color: theme.pine, alignSelf: "flex-start", marginBottom: 8, fontSize: 15 },
  event: { fontSize: 22, fontWeight: "700", color: theme.ink, textAlign: "center", marginTop: 8 },
  cat: { fontSize: 16, color: theme.inkSoft, marginTop: 2 },
  qrWrap: { alignItems: "center", gap: 12, marginTop: 32, padding: 24, borderWidth: 1, borderColor: theme.line, borderRadius: theme.radius.lg },
  ref: { fontFamily: "Courier", color: theme.ink, fontSize: 15, marginTop: 8 },
  note: { color: theme.inkSoft, textAlign: "center", fontSize: 13, marginTop: 24 },
});
```

- [ ] **Step 4: Failing test**

Create `apps/mobile/__tests__/ticket-screen.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react-native";

jest.mock("expo-router", () => ({
  useLocalSearchParams: () => ({ registrationId: "r1abc999" }),
  useRouter: () => ({ back: jest.fn() }),
}));
jest.mock("react-native-qrcode-svg", () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => {
    const { Text } = require("react-native");
    return <Text>QR:{value}</Text>;
  },
}));
jest.mock("../lib/ticketCache", () => ({ getCachedTicket: jest.fn().mockResolvedValue(null), cacheTicket: jest.fn() }));
jest.mock("../lib/registration", () => ({
  useRegistration: () => ({
    data: { id: "r1abc999", status: "paid", ticket_token: "tok.sig", eventName: "Apo Sky Ultra 2026", categoryLabel: "21K", org_id: "o1" },
    isLoading: false,
  }),
}));

import Ticket from "../app/ticket/[registrationId]";

describe("Ticket screen", () => {
  it("renders the event, category, and a QR of the ticket token", async () => {
    render(<Ticket />);
    expect(await screen.findByText("Apo Sky Ultra 2026")).toBeOnTheScreen();
    expect(screen.getByText("21K")).toBeOnTheScreen();
    expect(screen.getByText("QR:tok.sig")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 5: Run — expect PASS**

```bash
cd apps/mobile && pnpm test ticket-screen 2>&1 | tail -10 ; cd ../..
```

- [ ] **Step 6: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): offline QR ticket screen"
```

---

### Task 6: My Races tab

**Files:**
- Replace: `apps/mobile/app/(tabs)/races.tsx`
- Create: `apps/mobile/__tests__/my-races.test.tsx`

- [ ] **Step 1: My Races list**

Replace `apps/mobile/app/(tabs)/races.tsx`:
```tsx
import { useEffect } from "react";
import { View, Text, FlatList, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useOrg } from "../../lib/org";
import { useMyRegistrations } from "../../lib/registration";
import { cacheMyRaces } from "../../lib/ticketCache";
import { theme } from "../../lib/theme";

export default function MyRaces() {
  const { selectedOrgId } = useOrg();
  const { data, isLoading, isError, refetch } = useMyRegistrations(selectedOrgId);
  const router = useRouter();

  // Write-through cache so the list survives going offline.
  useEffect(() => {
    if (selectedOrgId && data) {
      cacheMyRaces(selectedOrgId, data.map((r) => ({
        rid: r.id, token: r.ticket_token, eventName: r.eventName, categoryLabel: r.categoryLabel,
        runnerName: "", status: r.status, orgId: r.org_id,
      })));
    }
  }, [data, selectedOrgId]);

  if (isLoading) return <View style={styles.center}><ActivityIndicator /></View>;
  if (isError) {
    return (
      <View style={styles.center}>
        <Pressable onPress={() => refetch()} accessibilityRole="button"><Text style={styles.err}>Couldn't load. Tap to retry.</Text></Pressable>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={data ?? []}
      keyExtractor={(r) => r.id}
      contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
      ListHeaderComponent={<Text style={styles.h}>My Races</Text>}
      ListEmptyComponent={<Text style={styles.empty}>No registrations yet.</Text>}
      renderItem={({ item }) => {
        const paid = item.status === "paid";
        return (
          <Pressable
            style={styles.card}
            onPress={() => router.push(paid ? `/ticket/${item.id}` : `/pay/${item.id}`)}
            accessibilityRole="button"
          >
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
  badgePaid: { backgroundColor: "#e7f3ff" },
  badgePending: { backgroundColor: theme.parchment },
  badgeT: { fontSize: 12, fontWeight: "700" },
  badgeTPaid: { color: theme.primary },
  badgeTPending: { color: theme.inkMuted },
  empty: { color: theme.inkMuted },
  err: { color: theme.stop },
});
```

- [ ] **Step 2: Failing test**

Create `apps/mobile/__tests__/my-races.test.tsx`:
```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";

const push = jest.fn();
jest.mock("expo-router", () => ({ useRouter: () => ({ push }) }));
jest.mock("../lib/org", () => ({ useOrg: () => ({ selectedOrgId: "o1" }) }));
jest.mock("../lib/ticketCache", () => ({ cacheMyRaces: jest.fn() }));
jest.mock("../lib/registration", () => ({
  useMyRegistrations: () => ({
    data: [
      { id: "r1", status: "paid", ticket_token: "a.b", eventName: "Apo Sky Ultra 2026", categoryLabel: "21K", org_id: "o1", total_amount: 150000 },
      { id: "r2", status: "pending", ticket_token: null, eventName: "Apo Sky Ultra 2026", categoryLabel: "10K", org_id: "o1", total_amount: 100000 },
    ],
    isLoading: false, isError: false, refetch: jest.fn(),
  }),
}));

import MyRaces from "../app/(tabs)/races";

describe("My Races", () => {
  it("lists entries with status and routes to ticket (paid) or pay (pending)", () => {
    render(<MyRaces />);
    expect(screen.getByText("Paid")).toBeOnTheScreen();
    expect(screen.getByText("Pending")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("21K"));
    expect(push).toHaveBeenCalledWith("/ticket/r1");
    fireEvent.press(screen.getByText("10K"));
    expect(push).toHaveBeenCalledWith("/pay/r2");
  });
});
```

- [ ] **Step 3: Run — expect PASS**

```bash
cd apps/mobile && pnpm test my-races 2>&1 | tail -10 ; cd ../..
```

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): My Races tab (list → ticket/pay, offline write-through)"
```

---

### Task 7: Full suites, typecheck, and manual acceptance (offline-ticket gate)

- [ ] **Step 1: Full mobile suite + typecheck**

```bash
cd apps/mobile && pnpm test 2>&1 | tail -12 ; cd ../..
```
Expected: all suites pass (Plans 2–3 + the five new Plan 4 suites; the updated `register-submit` passes with the new route).

```bash
pnpm -r exec tsc --noEmit 2>&1 | tail -20
```
Expected: no type errors across `packages/shared`, `apps/mobile`, and `supabase` (Deno files excluded per their own tsconfig; if `supabase/functions` are checked separately, they are Deno-typed and not part of the app tsc).

- [ ] **Step 2: Backend suite (local stack + functions serve up)**

```bash
pnpm test 2>&1 | tail -20
```
Expected: backend suites green, including the new `fake-checkout sandbox page` e2e.

- [ ] **Step 3: Manual acceptance — the M1 gate** (`supabase start` + `functions serve` up; `cd apps/mobile && npx expo start`, press `i`)

Signed in with an org selected:
1. **Happy path:** Events → *Apo Sky Ultra 2026* → **21K** → fill fields + toggle an add-on + accept waiver → **Register** → lands on **Payment** showing the total.
2. Tap **Pay now** → the in-app browser opens the **sandbox checkout** page (event, category, ₱ total, "Pay ₱…"). Tap **Pay ₱…** → the browser bounces back and the screen flips to **Payment confirmed** (poll observed `status = paid`).
3. Tap **View ticket** → the **Ticket** shows the event, category, **QR**, and a Ref.
4. **Offline ticket:** enable Airplane Mode → open **My Races** → the entry shows **Paid**; tap it → the **Ticket** + QR still render (from cache). Kill and reopen the app in airplane mode → the ticket still renders.
5. **My Races** lists the paid entry (badge **Paid**); a still-pending registration shows **Pending** and tapping it reopens **Payment** (Resume).
6. **Back-out / retry:** start another registration → on **Payment** tap **Pay now** → **Cancel** on the sandbox page → returns to **Pending**; **Retry payment** → **Pay** → confirms (no duplicate row — same `registration_id`).
7. **Sign out** (Profile) → sign back in → My Races re-fetches from server (cache was cleared on sign-out).
8. Studio (`http://127.0.0.1:54523`): the `registrations` row is `status = paid` with a `ticket_token`; `payments` row is `paid` with `platform_fee`/`net_to_org` set and `checkout_url` populated.

- [ ] **Step 4: Commit any wire-up fixes**

```bash
git add -A
git commit -m "chore(mobile): Plan 4 pay/ticket/offline verified end-to-end"
```

---

## Self-Review

**Spec coverage** (against `01-mobile-ios-mvp.md` §5 rows 8–13, §6, §7):
- Pay (in-app WebView, `checkout_url`) → Task 4 (`expo-web-browser` auth session). ✓
- Pending (await webhook; **never trust the redirect**; poll ~3s, ~90s timeout) → Task 4 (`useRegistration` poll). ✓
- Confirmed (slot booked; CTA → Ticket) → Task 4. ✓ (Backend increments the slot in `confirmPayment`, Task 1.)
- Ticket (signed-token **QR**, offline) → Task 5 (`react-native-qrcode-svg`, cache-first). ✓
- My Races (current-org entries → Ticket; Pending → Resume) → Task 6. ✓
- Offline: paid ticket cached at confirmation; Ticket + My Races render with no network → Tasks 2/4/5/6. ✓
- Session sign-out clears caches → Task 2. ✓
- Edge cases: back-out/retry (idempotent, same `registration_id`), app-relaunch resume, duplicate-submit guard (Plan 3 `idempotency_key`) → Tasks 4/6 + manual §Step 3. ✓
- **Swap-ready** payments behind the Edge `PaymentProvider`; app never branches on fake/real → Task 1. ✓

**Documented deviations / deferrals (MVP):**
- **Realtime** confirmation is deferred; **polling** is primary (spec allowed poll as the fallback; realtime is a fast-follow that needs the `supabase_realtime` publication + channel wiring).
- **Analytics** events (`payment_started`, `payment_succeeded`, `ticket_viewed`, …) are **not** instrumented — consistent with Plans 2–3; the provider is still a PRD open item. Instrument behind a thin wrapper when chosen.
- **`file` custom-field** type remains out of scope (Plan 3).
- The local **fake-checkout** page is dev-only scaffolding; production uses the real provider's hosted page + a signature-verifying webhook (the app + `confirmPayment` are unchanged).
- Runner **name** on the ticket is left blank in the cache write (kept minimal); event + category + QR + Ref are shown. A follow-up can populate it from `profiles.bib_name`.

**Placeholder scan:** No TBD/TODO. The only conditional step (Task 1 Step 7 `.env.example`) is a guarded shell one-liner, not a placeholder.

**Type consistency:** `RegistrationRow` (+ `mapReg`, `fetchRegistration`, `useRegistration`, `fetchMyRegistrations`, `useMyRegistrations`), `CachedTicket` (+ `cacheTicket`/`getCachedTicket`/`cacheMyRaces`/`getCachedMyRaces`/`clearTicketCache`), `TicketQR`, `confirmPayment` → `ConfirmResult`, and route hrefs (`/pay/[registrationId]`, `/ticket/[registrationId]`, and the `RETURN_PATH = "pay-callback"` deep link) are used consistently across tasks. `startCheckout` still returns `{ registration_id, checkout_url }` (unchanged); the register screen now forwards both to `/pay/…`.

---

## Execution Handoff

Plan 4 of 4 — the final iOS MVP slice. Requires Plans 1–3 running locally (Supabase stack **and** `functions serve`). On completion, the runner journey is end-to-end: sign in → choose org → browse → register → **pay (sandbox) → confirmed → offline QR ticket**, with **My Races** listing entries and resuming pending ones. Remaining beyond this plan (out of MVP scope): realtime confirmation, analytics instrumentation, Android/web parity, and the Admin web check-in **scanner** that verifies these tickets.
