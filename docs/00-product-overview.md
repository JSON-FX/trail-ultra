# race-pace — Product Overview PRD

- **Product:** race-pace — a **multi-organization** trail-run & ultra-trail event platform
- **Region / context:** Mindanao, Philippines (Davao, Bukidnon, Cotabato). Prices in ₱ (PHP).
- **Status:** Draft v0.4
- **Last updated:** 2026-07-19
- **Owner:** Product (jayson@voltcontent.com)

---

## 1. Summary

race-pace lets many race **organizations** run their own trail & ultra events on
one shared platform. A runner signs up **once** and uses a single account
everywhere; they enter **org-first** — choose an organization, then live inside
its branded world of events, register and pay in minutes, and carry a scannable
race ticket in their pocket. Each organization's race directors manage their own
events, registrations, payments, and start-line check-in from the web — and see
only their own data.

Everything an organization owns — events, registrations, money, staff, and
custom form fields — is **siloed by `org_id`** and never visible to another
organization. Payments are **collected centrally** through one platform PayMongo
account and **settled back to each organization** via payout statements.

The platform runs on **Supabase** (data, auth, realtime, row-level security) and
**PayMongo** (payments), with the UI built on the **getdesign** design system.
The MVP delivers the end-to-end runner journey on **iOS** first, then Android and
the two web faces.

This document covers the whole product. The first build — the iOS runner app —
is specified in detail in [01 · Mobile (iOS) MVP](./01-mobile-ios-mvp.md).

## 2. Goals & non-goals

### 2.1 Goals (MVP)

- A runner signs up once, **chooses an organization**, discovers one of its
  events, registers for a category, fills the org's registration form, pays via
  PayMongo, and receives a valid digital ticket (QR) — self-service on iOS.
- A race director manages **only their own organization**: create events, see
  registrations and payment status, define custom registration fields, and check
  runners in at the start line on race day.
- A **platform operator** can provision a new organization and its first admin;
  that organization's data is fully isolated from every other org from day one.
- **Strict tenant isolation:** no user, query, or API path can read or write
  another organization's data.
- Payments reconcile automatically: PayMongo is the payment authority; Supabase
  reflects status via webhooks. Each organization can see **what it is owed**
  through settlement statements.
- One runner codebase serves iOS first, Android next, with no rewrite; one web
  codebase serves both the public storefront and the admin console.

### 2.2 Non-goals (explicitly out of MVP)

- **Self-serve organization onboarding.** Organizations are **platform-provisioned**
  (a super-admin creates the org and its first admin). Self-serve org signup is a
  post-MVP path — the data model is built so it can be switched on without rework.
- **Automated payout disbursement.** The platform *tracks* what each org is owed
  and produces settlement statements, but MVP payouts are executed **off-platform**
  (bank transfer) and marked paid. Programmatic disbursement is post-MVP.
- **Cross-org unified discovery feed.** MVP is org-first and siloed; a global
  "browse all orgs' events" feed is post-MVP.
- **Per-org custom domains / subdomains.** MVP storefronts live at
  `/o/<org-slug>` paths; vanity domains are post-MVP.
- **Full drag-and-drop form builder** with conditional/branching logic. MVP
  supports a flat set of typed custom fields on the core registration form.
- Results & live timing / chip integration (finish times shown are historical
  placeholders only).
- Social features (following runners, comments, kudos).
- In-app messaging / push campaigns (transactional email only for MVP).
- Refund self-service by runners (refunds are admin-initiated in MVP).

### 2.3 Success metrics

| Metric | Target (first live event) |
| --- | --- |
| Registration completion rate (start → paid) | ≥ 70% |
| Median time to complete registration | ≤ 3 min |
| Payment success rate (attempt → captured) | ≥ 95% |
| Check-in throughput at start line | ≥ 6 runners/min per scanner |
| Ticket available offline on race morning | 100% of paid runners |
| **Cross-org data isolation incidents** | **0** |
| **Settlement statement accuracy vs PayMongo** | **100% reconciled** |

## 3. Personas

- **JR — the Runner (primary).** Registers on his phone. Picks an organization,
  wants a fast checkout with GCash, and a ticket that works even with no signal
  at a 4 AM mountain flag-off. Uses one account across every org he races with.
- **Alma — the Race Director (org admin).** Belongs to **one organization**. Runs
  its events operationally: opens registration, defines the sign-up form, watches
  fill rate and payments, resolves pending/failed payments, runs start-line
  check-in, and reviews what her org is owed. Sees nothing outside her org.
- **Marshal — Check-in staff (operational).** A volunteer with the `marshal`
  role, scoped to one org (usually one event); scans tickets at the start line
  and can look up a runner's entry, but sees nothing financial.
- **Pat — the Platform Operator (super_admin).** Runs race-pace itself.
  Provisions organizations and their first admins, sets each org's commission,
  runs payouts/settlement, and owns global settings. The only role that can see
  across organizations.

## 4. Scope & platform sequencing

### 4.1 Surfaces

| # | Surface | Audience | Build order | MVP? |
| - | --- | --- | --- | --- |
| 1 | **Mobile — iOS** | Runner | 1st | ✅ Core MVP |
| 2 | **Mobile — Android** | Runner | 2nd | ✅ (same codebase) |
| 3 | **Web — Admin + Platform console** | Race director, volunteers, platform operator | 3rd | ✅ (operational subset) |
| 4 | **Web — Client (e-commerce storefront)** | Public / runners on desktop | 4th | ⏳ Post-MVP-core |

Web surfaces 3 and 4 are **one codebase, two faces**: a public per-org storefront
at `/o/<org-slug>` and a role-gated admin/platform console behind login.

### 4.2 Feature scope by surface (MVP)

| Capability | iOS | Android | Admin web | Client web |
| --- | :-: | :-: | :-: | :-: |
| Choose / switch organization | ✅ | ✅ | — | ⏳ |
| Browse / search an org's events | ✅ | ✅ | — | ⏳ |
| Event detail + category select | ✅ | ✅ | — | ⏳ |
| Register + custom fields + waiver + add-ons | ✅ | ✅ | — | ⏳ |
| Pay (Card/GCash/Maya) | ✅ | ✅ | — | ⏳ |
| Digital ticket (QR, offline) | ✅ | ✅ | — | — |
| My races (current org) / profile | ✅ | ✅ | — | — |
| Create / edit events | — | — | ✅ | — |
| Define custom registration fields | — | — | ✅ | — |
| Registrations table + filters | — | — | ✅ | — |
| Payment status + refund | — | — | ✅ | — |
| Race-day check-in (scan) | — | — | ✅ | — |
| Dashboard KPIs | — | — | ✅ | — |
| Provision orgs · commission · payouts (super_admin) | — | — | ✅ | — |

### 4.3 MVP feature list (surfaces shipping first)

The MVP is **two surfaces** — the runner's mobile app and the admin web — which
together can run a real event end to end. The client web storefront (§4.1 #4) is
deferred.

**Mobile — runner app** (iOS first, Android parity):

1. One global account — email (verified), Apple, Google, Facebook
2. Choose & switch organization — org-first, branded per org
3. Browse & search an organization's events
4. Event detail + category select (100k / 50k / 21k / 10k, live slots)
5. Register — core details + org custom fields + waiver + add-ons
6. Pay — Card / GCash / Maya, webhook-confirmed
7. Digital QR ticket — renders fully offline
8. My races (current org) + global profile

**Admin web — console** (race directors, marshals, platform operator):

- *Event content (editor+):*
  1. Create & edit events, categories, add-ons
  2. Define custom registration fields (typed, validated)
- *Operations (admin):*
  3. Registrations table + filters
  4. Payment status + refunds (admin-initiated)
  5. Race-day check-in — QR scan (marshal), offline-capable
  6. Dashboard KPIs — fill rate, revenue, sign-ups over time
- *Platform (super_admin):*
  7. Provision organizations (org + first admin)
  8. Set per-org commission
  9. Payout statements + mark-as-paid (settlement)

**Deferred to later:** client web storefront (`/o/<slug>`), self-serve org
onboarding, cross-org discovery, vanity subdomains, automated disbursement.

## 5. System architecture

```
        ┌── Organizations (tenants) ─────────────────────────────────┐
        │  Run With Point · Bukidnon Trails · Cotabato Skyrace · …    │
        └────────────────────────────────────────────────────────────┘
                     ▲  org-scoped data  (org_id + Row-Level Security)
┌───────────────┐   ┌───────────────┐        ┌──────────────────────────┐
│ iOS / Android  │   │  Web           │        │        Supabase           │
│ (Expo / RN)    │   │ (React + Vite) │        │  Postgres · Auth · RLS    │
│ org switcher   │   │ /o/<slug> +    │        │  Realtime · Storage       │
│ getdesign UI   │   │ admin console  │        │  Edge Functions           │
└──────┬─────────┘   └──────┬─────────┘        └───────────┬──────────────┘
       │   Supabase JS SDK   │                             │
       └──────────┬──────────┘                             │ webhooks
                  ▼                                          ▼
        ┌────────────────────┐  intent / status / refund  ┌──────────────┐
        │  Edge Functions     │◄──────────────────────────►│  PayMongo     │
        │  payments · QR ·    │                            │  (single      │
        │  form validation ·  │                            │   platform    │
        │  settlement          │                            │   account)    │
        └────────────────────┘                            └──────────────┘
```

### 5.1 Stack — *confirmed*

| Layer | Choice | Why |
| --- | --- | --- |
| **Mobile** | **Expo (React Native) + TypeScript** (latest) | One codebase for iOS+Android; reuses our React/TS work and design tokens; first-class Supabase JS SDK; `expo-camera` for QR scan, offline ticket via local storage; OTA updates. |
| **Design language** | **getdesign — `apple` spec** (`npx getdesign@latest add apple`) | Writes a `DESIGN.md` (Apple-style tokens, type scale, component patterns) that Claude reads before generating UI — framework-agnostic, so one design language drives both the React Native app and the React web. Themed per organization (logo, brand colors). |
| **Admin + Client web** | React + Vite + TypeScript | One app serving the per-org storefront and the role-gated admin/platform console. (Consider Next.js at surface #4 if SEO on public event pages matters.) |
| **Backend** | Supabase (managed Postgres) | Relational data, row-level security for tenant isolation, realtime for check-in feed, storage for event/org images. |
| **Payments** | PayMongo (single platform account) | PH-native Card, GCash, Maya; webhook-driven status; platform collects and settles to orgs. |
| **Server logic** | Supabase Edge Functions (Deno/TS) | Create payment intents, verify webhooks, validate custom form data, mint/verify ticket tokens, compute settlement — secrets never touch the client. |

> **Alternative considered:** native Swift (iOS) + Kotlin (Android). Rejected for
> MVP — two codebases, no reuse, slower to two platforms. Revisit only if a
> native-only capability becomes core.
>
> **Stack rationale & alternatives (Flutter, KMP, native):** recorded in
> [ADR-0001 · Cross-platform tech stack](./adr/0001-cross-platform-tech-stack.md).

### 5.2 Multi-tenancy model — *confirmed*

- **Shared database, shared schema, `org_id` discriminator + RLS.** Every
  tenant-owned row carries an `org_id`; Row-Level Security guarantees a query can
  only ever touch its own org's rows. This is your "same database, different data
  per organization."
- **Alternatives considered:** schema-per-org and database-per-org. Rejected for
  MVP — heavier ops and migrations, no benefit at this scale. Revisit only if a
  very large org needs physical isolation.
- **One global runner identity.** A `profiles` row is not org-scoped; a runner's
  organizations and "events attended" are **derived from their registrations**.
- **Org-first navigation.** The runner selects an organization (an org switcher);
  all browsing, registration, tickets, and "my races" are scoped to it, themed
  with that org's branding.

### 5.3 Key architectural rules

- The client **never** holds PayMongo secret keys or writes payment status
  directly. Intent creation, webhook handling, and settlement live in Edge
  Functions.
- Ticket QR encodes a **signed token** (not a raw bib number), verifiable offline
  by the scanner against a cached event key — tickets can't be forged and
  check-in works without connectivity.
- All data access goes through **Row-Level Security** using the user's JWT (never
  a service role). Every tenant policy is keyed on `org_id`; **cross-org access
  is impossible by construction**, and covered by a dedicated tenancy test suite.
- Custom registration data is **validated server-side** in an Edge Function
  against the org's field definitions before a registration is created.

## 6. Data model (Supabase / Postgres)

Core entities (sketch — full DDL in the mobile MVP doc's dependencies). New and
changed tables for multi-tenancy are marked **⊕**.

| Table | Key fields | Notes |
| --- | --- | --- |
| **⊕ `organizations`** | id, name, slug, logo, brand_colors, contact, status, commission_rate, payout_account, created_at | one row per tenant; `slug` drives `/o/<slug>` |
| `profiles` | id (=auth.uid), full_name, bib_name, gender, shirt_size, emergency_contact, city | **global**, 1:1 with `auth.users`; not org-scoped |
| **⊕ `events`** | id, **org_id**, name, place, region, date, flag_off, elevation_gain, cutoff, status, hero_image | status: draft/open/almost_full/closed/completed |
| **⊕ `categories`** | id, **org_id**, event_id, code (100k/50k/21k/10k), label, distance_km, base_price, slots_total, slots_taken | |
| **⊕ `addons`** | id, **org_id**, event_id, name, price | singlet, vest, finisher package |
| **⊕ `form_fields`** | id, **org_id**, event_id, key, label, type, required, options, validation, sort_order, active | custom registration fields; type ∈ text/number/select/checkbox/date/file |
| **⊕ `registrations`** | id, **org_id**, event_id, category_id, user_id, bib_number, wave, waiver_accepted_at, status, total_amount, **custom_data (JSONB)** | status: pending/paid/refunded/cancelled; `custom_data` holds field answers |
| `registration_addons` | registration_id, addon_id, price | selected add-ons snapshot |
| **⊕ `payments`** | id, **org_id**, registration_id, provider (paymongo), intent_id, method, amount, **platform_fee**, **net_to_org**, status, raw | webhook-updated |
| **⊕ `checkins`** | id, **org_id**, registration_id, event_id, checked_in_at, checked_in_by | one per registration |
| **⊕ `payout_statements`** | id, **org_id**, period, gross, fees, refunds, net_owed, status, paid_at, paid_by | per-org settlement; status: open/paid |
| **⊕ `user_roles`** | user_id, role, **org_id**, event_scope | `org_id` null = platform-wide (super_admin); otherwise org-scoped |

Derived/aggregate views power the admin dashboard (registrations over time,
category breakdown, revenue, fill rate) and the platform console (per-org gross,
fees, net owed).

## 7. Payments & settlement (PayMongo)

- **Methods (MVP):** Card, GCash, Maya. Currency ₱ (PHP).
- **Collection model:** a **single platform PayMongo account** collects every
  registration across all organizations. The platform is the merchant of record;
  organizations do not connect their own PayMongo keys.
- **Flow:** app requests checkout → Edge Function creates a PayMongo Payment
  Intent / Checkout Session for the registration total → app opens the provider
  redirect/WebView → on return, app shows a pending state and **waits for webhook
  confirmation** (never trusts the client redirect alone).
- **Webhooks:** PayMongo → Edge Function verifies signature → updates
  `payments.status` and `registrations.status`, computes `platform_fee` and
  `net_to_org` from the org's `commission_rate` → realtime pushes the runner to
  the Confirmed screen and increments `slots_taken`.
- **Commission:** a **configurable per-organization percentage** taken from each
  paid registration; stored on `organizations.commission_rate`, snapshotted onto
  each `payment`.
- **Settlement:** `payout_statements` aggregate each org's `net_to_org` minus
  refunds over a period. Organizations see what they are owed in the admin
  console. **MVP payouts are executed off-platform** (bank transfer) and marked
  paid by a super_admin; automated disbursement is post-MVP.
- **Idempotency:** intent creation keyed by `registration_id` to prevent double
  charges on retry; slot is soft-held during a pending payment with a TTL.
- **Refunds (MVP):** admin-initiated from the Registrations table via a PayMongo
  refund call in an Edge Function; status flows back to `refunded` and the amount
  is deducted from the org's next statement. **Open question:** which party
  absorbs the platform fee on a refund — flagged for legal/finance (§12).

## 8. Auth, roles & security

- **Provider:** Supabase Auth.
- **Runner methods (confirmed MVP):** email with **verification required**,
  **Sign in with Apple** (required by App Store when offering third-party login),
  Google, and Facebook. One account works across every organization.
- **Admin/staff:** email/password, provisioned; a `user_roles` row grants the
  role **and** binds it to an organization (`org_id`).
- **Roles** — **platform scope** vs **org scope**:
  - **user** — default; the runner. Global identity; all client-side features.
    Their registrations/tickets are org-scoped by the org they registered under.
  - **marshal** *(org-scoped)* — race-day check-in only: scan tickets, mark
    check-ins, look up an entry for their org's event. Nothing editable, nothing
    financial.
  - **editor** *(org-scoped)* — create & manage their org's event content
    (events, categories, add-ons, custom fields); view its registrations.
  - **admin** *(org-scoped)* — the above + manage registrations, payments/refunds,
    check-in, and view their org's settlement statements.
  - **super_admin** *(platform-wide)* — everything across **all** organizations:
    provision orgs and their first admin, set commission, run payouts, manage
    roles, and own global settings.
- **Scope:** editor/admin/marshal grants are bound to one `org_id` (and may be
  further narrowed to an event via `event_scope`). `super_admin` has `org_id`
  null, meaning platform-wide.
- **RLS:** users read published events of any org and read/write only their own
  `profiles`, `registrations`, `payments`, `checkins`. Staff access is gated by
  org-aware helpers — `can_checkin_event()` / `can_edit_org()` / `can_admin_org()`
  / `is_super_admin()` over `user_roles` — every one keyed on `org_id`.
- **Tenant isolation:** cross-org access is impossible by construction and
  verified by an automated tenancy test suite (attempt every cross-org read/write
  and assert denial).
- **PII / privacy:** emergency contact, custom form data, and personal data
  protected under the PH Data Privacy Act; stored encrypted at rest (Supabase
  default), access-logged.

## 9. Non-functional requirements

- **Performance:** app cold start < 2.5s; event list first paint < 1s on 4G;
  registration screen interactions < 100ms.
- **Offline:** a paid ticket (QR + runner info) must render fully offline; the
  check-in scanner must validate signed tokens offline and sync when back online.
- **Reliability:** payment status is eventually consistent via webhooks with a
  client poll fallback; no lost registrations on flaky mobile networks.
- **Multi-tenancy:** per-org theming (logo, brand colors via getdesign tokens)
  applied at the org switcher; tenant isolation enforced in RLS and covered by
  tests; settlement math reconciles exactly to PayMongo.
- **Accessibility:** WCAG AA contrast, Dynamic Type / scalable text, VoiceOver
  labels on all controls, min 44pt tap targets.
- **Localization:** ₱ currency formatting, PH date/time, English at MVP
  (Filipino copy post-MVP).
- **Observability:** structured logs on Edge Functions; payment, settlement, and
  check-in events traced end-to-end.

## 10. Analytics (event taxonomy)

Track the funnel, **tagged with `org_id`**: `org_selected`, `event_viewed`,
`category_selected`, `registration_started`, `custom_field_completed`,
`waiver_accepted`, `addon_toggled`, `payment_started`, `payment_succeeded`,
`payment_failed`, `ticket_viewed`, `checked_in`. Operator-side: `org_provisioned`,
`payout_marked_paid`. One analytics provider TBD; events defined now so
instrumentation lands with each screen.

## 11. Release plan / milestones

| Milestone | Deliverable | Gate |
| --- | --- | --- |
| **M0 — Foundations** | Supabase schema + **org-scoped RLS**, Auth, seed one real **organization** + event, platform PayMongo sandbox + commission/settlement ledger, custom-field engine, all wired via Edge Functions | Test payment succeeds sandbox → ticket issued → net_to_org booked to statement |
| **M1 — iOS runner MVP** | Full runner journey ([doc 01](./01-mobile-ios-mvp.md)) on TestFlight: org switcher → org-first browse → custom registration form → pay | Real registration + GCash sandbox → offline ticket, all under one org |
| **M2 — Android** | Same app on Android (Play internal testing) | Parity with iOS |
| **M3 — Admin + platform web** | Events CRUD, custom-field editor, registrations, refunds, race-day check-in; super_admin org provisioning, commission, payout statements | Live check-in of M1 tickets; provision a 2nd org, confirm isolation |
| **M4 — Client web storefront** | Public per-org discovery + web registration at `/o/<slug>` | Web registration → same ticket |
| **M5 — Live event** | One real organization runs one real event end-to-end | Runners register, pay, race, check in; org sees correct settlement |

## 12. Risks & open questions

| Risk / question | Impact | Mitigation / needed decision |
| --- | --- | --- |
| **Platform holds funds** (money transmitter / BSP, tax) | Legal/regulatory exposure | Legal review before go-live; confirm merchant-of-record model with PayMongo; document tax treatment of commission |
| **Refund fee absorption** | Revenue/dispute | Decide who eats the platform fee on refund; encode in settlement math |
| **Cross-org data leakage** (RLS bug) | Data breach / trust | Every policy keyed on `org_id`; automated tenancy test suite; deny-by-default |
| PayMongo GCash/Maya redirect UX in-app | Checkout drop-off | Prototype WebView + webhook wait early in M0 |
| Offline ticket forgery | Fraudulent entry | Signed QR tokens verified against cached event key |
| Slot oversell during pending payments | Overbooked categories | Soft-hold slot with TTL; confirm on webhook |
| Per-org theming complexity | Inconsistent UX | Constrain to getdesign tokens (logo + brand colors), not arbitrary layouts |
| Custom form data quality | Bad/unsafe data | Server-side validation against field defs; typed fields only |
| App Store review (Apple sign-in, payments) | Launch delay | Include Apple sign-in; physical event tickets are not IAP-eligible digital goods — confirm review guidance |
| Data Privacy Act compliance | Legal | Privacy policy, consent at sign-up, data retention policy |

---

*Next: [01 · Mobile (iOS) MVP](./01-mobile-ios-mvp.md) — the detailed spec for the first build.*
