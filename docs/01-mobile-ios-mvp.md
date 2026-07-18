# 01 · Mobile (iOS) MVP — trail-ultra runner app

- **Product:** trail-ultra — iOS runner app (first build)
- **Status:** Draft v0.1
- **Last updated:** 2026-07-19
- **Owner:** Product (jayson@voltcontent.com)
- **Related:** [00 · Product Overview PRD](./00-product-overview.md) · [ADR-0001 · Tech stack](./adr/0001-cross-platform-tech-stack.md) · [ADR-0002 · Repo structure](./adr/0002-repository-structure.md)

---

## 1. Summary

The iOS runner app is the first build of trail-ultra. A runner signs in, chooses an
organization, discovers one of its events, registers (core details + the org's custom
fields + waiver + add-ons), pays via PayMongo, and receives a **signed QR ticket that
works fully offline**. This spec covers the runner journey end to end on iOS, built on
Expo/React Native per [ADR-0001](./adr/0001-cross-platform-tech-stack.md).

The app is **sign-in first** and **org-first**: every screen runs in the context of one
signed-in runner and one selected organization, with all data scoped by `org_id` through
Supabase Row-Level Security.

## 2. Goals & non-goals

### 2.1 Goals
- Deliver the 8 MVP mobile features (PRD §4.3) end to end on iOS, against **one seeded
  organization** for the first real event, with the multi-org switcher present.
- A paid ticket renders **fully offline** on race morning.
- Custom registration fields are **defined server-side** (per org/event) and rendered +
  validated on the client using the shared schema — with identical validation on the server.
- Payment status is **never trusted from the client redirect**; the app waits for the
  webhook (via realtime, with a poll fallback).

### 2.2 Non-goals (this spec)
- Admin / marshal features, including **race-day check-in scanning** (that's Admin web —
  so the runner app **displays** a QR, it does not scan one).
- Client web storefront, Android-specific work (parity handled in M2 — this codebase is
  cross-platform but this spec verifies on iOS).
- Push notifications, results/timing, in-app refunds, self-serve org onboarding.

### 2.3 Success criteria (M1 gate)
Real registration + **GCash sandbox → offline ticket**, all under one org. Detailed
acceptance scenarios in §11.

## 3. Tech & dependencies

| Concern | Choice |
| --- | --- |
| Framework | Expo (React Native) + TypeScript, **Expo Router** (file-based nav) |
| UI / design | getdesign `apple` → `DESIGN.md`; themed per org (logo, brand colors) |
| Server state | **TanStack Query** + `@supabase/supabase-js` |
| Session storage | `expo-secure-store` (JWT), auto-refresh |
| Offline cache | **MMKV** (paid tickets + light read-only cache) |
| Payment redirect | **in-app WebView** via `expo-web-browser`, deep-link return |
| QR **display** | `react-native-qrcode-svg` (no camera in the runner app) |
| Shared logic | `@trail-ultra/shared` (types + Zod validators, incl. `customDataSchema()`) |

**Backend dependencies** (built in M0; interfaces this app relies on):
- **Supabase (RLS reads/writes):** `organizations`, `events`, `categories`, `addons`,
  `form_fields` (read); `profiles`, `registrations` (+`custom_data`), `payments` (own rows).
- **Edge Function `registrations/checkout`** — input `{event_id, category_id, addon_ids[],
  custom_data, waiver_accepted, idempotency_key}`; validates `custom_data` against
  `form_fields`, checks + **soft-holds the slot (TTL)**, upserts the pending `registration`
  (idempotent by `idempotency_key`/`registration_id`), creates a PayMongo checkout session,
  returns `{registration_id, checkout_url}`.
- **PayMongo webhook handler** (Edge) — server-side; verifies signature, marks
  `payment`/`registration` paid, computes `platform_fee`/`net_to_org`, mints the signed
  ticket token. The app only reads the token to render the QR.

## 4. Navigation & screen map

Bottom **tab bar** after auth + org selection (Expo Router).

```
Splash (restore session)
├─ no session → Auth stack:  Sign In · Sign Up · Verify email · Forgot password
└─ session → Choose Organization  (auto-enter if only one; remembers last)
      └─ App tabs — scoped to the selected org:
         ├─ Events      → Event Detail → Category select
         │                 └─ Register (modal stack):
         │                      Form → Waiver → Review
         │                      → Pay (in-app WebView) → Pending → Confirmed → Ticket
         ├─ My Races    → Ticket (QR, offline)
         └─ Profile     → Edit profile · Switch org · Sign out
```

Query keys include `org_id`; switching orgs re-scopes every query. The selected `org_id`
is persisted (MMKV) and restored on launch.

## 5. Screen specifications

Every data screen implements four states: **loading** (skeleton), **empty**, **error**
(retry), **offline** (banner; cached read-only where available). Visuals follow `DESIGN.md`.

| Screen | Purpose | Key data / actions | Analytics |
| --- | --- | --- | --- |
| **Splash** | Restore session + last org | read secure-store session, MMKV org | — |
| **Sign In** | Authenticate | email+password, Apple, Google, Facebook | — |
| **Sign Up / Verify** | Create account, verify email | email verification **required** before entry | — |
| **Forgot password** | Reset | Supabase reset email | — |
| **Choose Organization** | Pick org context | list active orgs; tap → enter; remember last | `org_selected` |
| **Events** | Browse this org's events | search/list; status, distance, elevation, date | `event_viewed` (on open) |
| **Event Detail** | Event info + categories | hero, cutoff, elevation; category list w/ live slots | — |
| **Category select** | Choose distance | 100k/50k/21k/10k + price + remaining slots | `category_selected` |
| **Register — Form** | Collect entry data | core fields + **dynamic custom fields** + add-ons | `registration_started`, `addon_toggled` |
| **Register — Waiver** | Accept waiver | records `waiver_accepted_at` | `waiver_accepted` |
| **Register — Review** | Confirm total | line items + add-ons + total | — |
| **Pay (WebView)** | PayMongo checkout | open `checkout_url`; Card/GCash/Maya | `payment_started` |
| **Pending** | Await webhook | realtime sub + poll fallback; retry/cancel | — |
| **Confirmed** | Success | slot booked; CTA → Ticket | `payment_succeeded` / `payment_failed` |
| **Ticket** | Race pass | signed-token **QR**, runner+event info; **offline** | `ticket_viewed` |
| **My Races** | Current-org entries | list registrations → Ticket | — |
| **Profile** | Identity & settings | edit global profile; **Switch org**; sign out | — |

## 6. Data & offline architecture

- **Server state** via TanStack Query over `@supabase/supabase-js`; all reads/writes carry
  the user's JWT (RLS enforced). Query keys are namespaced by `org_id`.
- **Realtime:** a subscription on the pending `registration` (or its `payment`) flips
  **Pending → Confirmed** the moment the webhook lands.
- **Offline:**
  - **Guaranteed offline:** every **paid ticket** (signed token + display fields) is cached
    to MMKV at confirmation, so the **Ticket** and **My Races** list render with no network.
  - **Best-effort offline:** last-seen events list and profile cached read-only.
  - **Requires connectivity:** browse-fresh, register, and pay — these show the offline
    banner and disable the action when offline.
- **Session:** JWT in `expo-secure-store`; silent refresh; sign-out clears secure-store +
  MMKV caches.

## 7. Payment flow (client)

1. **Review → Pay.** App calls Edge `registrations/checkout` with an `idempotency_key`
   (stable per attempt). Function validates, soft-holds the slot, upserts the pending
   `registration`, returns `{registration_id, checkout_url}`.
2. **Checkout.** Open `checkout_url` in an in-app WebView (`expo-web-browser`). Runner pays
   via Card / GCash / Maya.
3. **Return.** Provider redirects to the deep link `trailultra://pay/return`; the app closes
   the WebView and shows **Pending** — it does **not** treat the redirect as success.
4. **Confirm.** App awaits the webhook via realtime (poll fallback every ~3s, timing out
   at ~90s with a "still processing" message). On `registration.status = paid`, transition
   to **Confirmed**, cache the ticket, offer Ticket.

**Edge cases (specced):**
- **User backs out / closes WebView** → stays Pending; **Retry** reuses the same
  `registration_id` (idempotent — no double charge).
- **Payment fails** → Failed state with Retry.
- **Slot lost during pending** (soft-hold TTL expired, category filled) → clear message;
  registration not confirmed; runner returned to Category select.
- **App killed mid-flow** → on relaunch, any Pending registration is resumed from server
  state (My Races shows it as Pending with Resume).
- **Duplicate submit** → guarded by `idempotency_key`.

## 8. Custom registration fields (client)

- On entering **Register — Form**, fetch the event/org `form_fields` (ordered).
- Render one control per field type: `text` · `number` · `select` · `checkbox` · `date` ·
  `file` (file uploads to Supabase Storage, storing the path in `custom_data`).
- Validate with **`customDataSchema(fields)` from `@trail-ultra/shared`** — the **same**
  builder the Edge Function uses server-side, so client and server enforce identical rules.
- Submit answers as the `registrations.custom_data` JSONB object.

## 9. Auth & session

- Supabase Auth: email (**verification required**), Sign in with Apple (App Store
  requirement), Google, Facebook.
- Sign-in-first: no app content is reachable without a verified session.
- On first successful sign-in with no `profiles` row, prompt to complete the **global
  profile** (name, bib name, gender, shirt size, emergency contact, city) before Events.

## 10. Cross-cutting requirements

- **State conventions:** loading/empty/error/offline on every data screen (§5).
- **Analytics:** emit the PRD taxonomy events tagged with `org_id` (§5 column). Provider
  TBD (PRD open item) — instrument behind a thin wrapper so the provider can be swapped.
- **Accessibility:** WCAG AA contrast, Dynamic Type, VoiceOver labels on all controls,
  ≥44pt targets (PRD §9).
- **Performance:** cold start < 2.5s; events list first paint < 1s on 4G; screen
  interactions < 100ms (PRD §9).
- **Localization:** ₱ currency, PH date/time, English at MVP.

## 11. Acceptance criteria & test scenarios

**Gate:** a real registration paid via **GCash sandbox** yields a valid **offline** ticket,
end to end, under one seeded org.

Scenarios that must pass:
1. **Happy path:** sign in → choose org → browse → pick 21k → fill core + custom fields +
   add-on → accept waiver → pay (sandbox) → Pending → webhook → Confirmed → Ticket.
2. **Offline ticket:** with a paid registration, enable airplane mode → Ticket + My Races
   still render the QR and details from cache.
3. **Validation parity:** a `custom_data` payload rejected by the client is also rejected by
   the Edge Function, and vice-versa.
4. **Back-out / retry:** close the WebView before paying → Pending → Retry → completes with
   no duplicate charge (same `registration_id`).
5. **Payment failure:** sandbox failure → Failed → Retry recovers.
6. **Slot lost:** category fills during pending → clear message, no confirmation.
7. **App relaunch mid-payment:** kill app on Pending → relaunch → My Races shows Pending
   with Resume.
8. **Org switch:** switch org in Profile → Events, My Races, and Ticket all re-scope; no
   other org's data is ever visible.
9. **Email verification gate:** unverified email cannot reach app content.

## 12. Out of scope / deferred

Admin/marshal (incl. check-in scanning), client web, Android-specific polish, push
notifications, results/timing, in-app refunds, self-serve org onboarding, cross-org
"my races" (current-org only in MVP).

## 13. Dependencies to resolve before/with implementation

- **M0 backend** must provide: schema + RLS (PRD §6/§8), the `registrations/checkout` Edge
  Function, the PayMongo webhook handler + ticket-token minting, and a seeded org + event.
- **`DESIGN.md`** generated via `npx getdesign@latest add apple`.
- **Analytics provider** selection (PRD open item).
- **Deep-link scheme** `trailultra://` registered in the Expo config.

---

*Next: implementation plan (writing-plans) once this spec is approved.*
