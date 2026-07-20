# Marketplace Redesign — Design Spec (runner app)

- **Status:** Approved (brainstorm 2026-07-20)
- **Owner:** Product (jayson@voltcontent.com)
- **Feeds:** superpowers:writing-plans → implementation plans
- **Supersedes:** the org-first discovery model in the PRD ([00-product-overview.md](../00-product-overview.md) §5.2) and the iOS MVP nav ([01-mobile-ios-mvp.md](../01-mobile-ios-mvp.md) §4)

## 1. Goal

Replace the runner app's **org-first** navigation (sign in → choose one org → everything scoped to it) with a **cross-org marketplace**: browse all organizations' events, browse organizations, view Facebook-style organization pages, and see event **lifecycle** (rescheduled / cancelled) reflected everywhere. The org's reschedule/cancel *action* is deferred to the Admin web (M3); this effort **models and displays** those states.

This reverses two documented PRD decisions — §2.2 lists "cross-org unified discovery feed" as post-MVP, and §5.2 makes navigation org-first. RLS already permits a signed-in user to read any org's **published** events, so browsing needs **no security-model change**.

## 2. Decisions (from brainstorm)

1. **Full marketplace, replacing org-first.** No choose-org gate, no org switcher. Two browse tabs (Events, Orgs). One consistent apple design language — **no per-org theming**.
2. **Reschedule / cancel — model + display now; the org action is Admin web (M3).** For local/demo, states are set via seed/DB.
3. **Sign-in-first.** The marketplace lives behind sign-in; no anonymous browsing (fast-follow if wanted later).
4. **Event media:** a swipeable image **gallery** on the event page.
5. **Cancel = display-only, stays listed** with a badge. Registrations are untouched; refunds remain an admin action (deferred). Rescheduling updates the shown date everywhere.

## 3. Navigation & screens

```
Splash (restore session)
├─ no session → Auth (Sign in / Sign up / verify)
└─ session → App tabs
   ├─ Events (Marketplace)  → Event page → Register → Pay → Ticket
   ├─ Orgs                  → Org page → (that org's events) → Event page
   ├─ My Races (global)     → Ticket
   └─ Profile               → edit profile · sign out
```

**Removed:** the Choose-Organization gate and the org switcher.

| Screen | Change |
| --- | --- |
| **Events (Marketplace)** | Lists **all orgs'** non-draft events. Card = hero image, name, place · date, **org name at the bottom**, status badge (Open / Almost full / Cancelled / Rescheduled). Client-side search by name/place. Order by `event_date` ascending (upcoming first); cancelled events still listed. |
| **Event page** | Swipeable **image gallery**, **description**, event meta (place/region/date/elevation/cutoff), categories with live slots + prices, **Register CTA**; a tappable **org header** (photo + name) → Org page; a **status banner** when Cancelled/Rescheduled. Register **disabled** when cancelled/closed/completed. |
| **Orgs** *(new)* | Lists all active organizations. Row = org photo + name (+ region / event count). |
| **Org page** *(new)* | Facebook-style: **banner** + **org photo** + name + **about**, then a list of that org's events (event cards, org name hidden since it's redundant here). |
| **My Races** | Now **all** the runner's registrations across every org (drops the org filter). → Ticket. |
| **Ticket** | Adds a Cancelled / Rescheduled banner; rescheduled shows the updated date. |
| **Profile** | Removes "Switch organization"; keeps edit profile + sign out. |

## 4. Data model changes (additive migrations)

**`organizations`** — add (already has `logo_url` = org photo, `brand_color`, `commission_rate`, `is_active`):
- `banner_url text` — profile banner image
- `description text` — the "about" text

**`events`** — add (already has `hero_image_url` = card image, `event_date`, `flag_off`, `status`):
- `description text`
- `gallery text[]` — event-page gallery image URLs (empty array default)
- `original_date date` — set on reschedule; when non-null → "Rescheduled" (event stays registerable; shows the new `event_date` and "was `<original_date>`")
- `status_note text` — optional org message for the status banner
- **`event_status` enum + `cancelled`** — `alter type event_status add value 'cancelled'` (terminal; Register disabled)

No other tables change.

## 5. RLS & grants — no change required

- `events_read_published` is `status <> 'draft'`, so a **cancelled** event is automatically visible (matches "keep it listed"); rescheduled events stay `open`/`almost_full` and are already visible.
- `orgs_read_active` already exposes the org list and org pages to `anon`/`authenticated`.
- `categories_read_published` / `addons_read_published` / `form_fields_read_published` already gate on `e.status <> 'draft'`, so they resolve for cancelled/rescheduled events too (the event page shows categories with Register disabled).
- New columns ride the existing table-level `grant select … to anon, authenticated`.

**Tenancy is unaffected:** writes (`profiles`, `registrations`, `payments`) remain own-row RLS; the marketplace only broadens *reads of already-public event content*, which RLS already allowed.

## 6. Event lifecycle model

- **Cancelled** — a `status` value. Marketplace card + event page + existing tickets/My Races show a "Cancelled" badge/banner (with optional `status_note`). Register disabled. Nothing is deleted; registrations remain; refunds are a later admin action.
- **Rescheduled** — *derived*, not a status: `original_date` is set and `event_date` holds the new date. Event stays open/registerable; shows "Rescheduled — was `<original_date>`". Existing tickets show the updated date.
- **Register CTA rules:** enabled for `open` / `almost_full` (including rescheduled); disabled for `cancelled` / `closed` / `completed`.

The reschedule/cancel **write action** (an org admin changing these fields) is **out of scope here** — it belongs to the Admin web (M3). For this effort the states are populated by seed/DB.

## 7. Seed

So the marketplace and org list have believable cross-org content:
- **2–3 organizations** (Run With Point + Bukidnon Trails + Cotabato Skyrace) with `logo_url`, `banner_url`, `description`.
- **Several events across those orgs**, each with `description` + a small `gallery` (seeded with remote placeholder image URLs; real uploads arrive with Admin web).
- **One cancelled** event and **one rescheduled** event (with `original_date` + `status_note`) to demo the states.
- Keep the existing seeded event (*Apo Sky Ultra 2026*, categories, add-ons, form fields) intact so Plan 1–4 backend tests still pass.

## 8. Implementation surface (apps/mobile)

**Read layer — `lib/events.ts`:**
- Extend `EventRow`: `+ org_name` (joined), `hero_image_url`, `description`, `gallery`, `original_date`, `status_note` (`status` already present).
- New `OrgRow`: `id, name, slug, logo_url, banner_url, description, brand_color`.
- New hooks: `useMarketplaceEvents()` (all non-draft, join `organizations(name)`, order by date), `useOrgs()` (active orgs), `useOrg(id)`, `useEventsByOrg(orgId)`. Keep `useEvent` / `useCategories` / `useAddons` / `useFormFields`.

**New reusable components — `components/`:**
- `EventCard` — Marketplace (shows org name) and Org page (hides it); includes the status badge.
- `EventGallery` — swipeable carousel via a plain RN paging `ScrollView` (**no new native module** — Expo Go safe, per the Plan 4 constraint).
- `OrgHeader` — banner + avatar + name + about (FB-style).
- `StatusBadge` — Open / Almost full / Cancelled / Rescheduled (small pill on cards; full-width banner variant on the event page/ticket).

**Screens:**
| File | Change |
| --- | --- |
| `app/(tabs)/events.tsx` | → Marketplace (`useMarketplaceEvents`, org name on card, search) |
| `app/(tabs)/orgs.tsx` | **new** — org list (`useOrgs`) |
| `app/org/[id].tsx` | **new** — `OrgHeader` + `useEventsByOrg` |
| `app/event/[id].tsx` | + `EventGallery`, description, tappable org header → `/org/[id]`, status banner; Register disabled if cancelled |
| `app/(tabs)/_layout.tsx` | 4 tabs: Events · Orgs · My Races · Profile |
| `app/(tabs)/races.tsx` | global (`useMyRegistrations()` no org); cache key global |
| `app/ticket/[registrationId].tsx` | + Cancelled/Rescheduled banner (registration read joins event `status`/`event_date`/`original_date`) |
| `app/(tabs)/profile.tsx` | remove "Switch organization" |
| `app/index.tsx` | remove the choose-org gate (session → tabs) |

**Removed:**
- `app/choose-org.tsx` (deleted).
- `lib/org.tsx` — the `OrgProvider` / `useOrg` context, and its use in `app/_layout.tsx`.
- The `orgId` parameter on `useMyRegistrations` / `fetchMyRegistrations` (RLS already restricts to own rows).
- Per-org `myraces:<orgId>` cache key → a single global key (e.g. `myraces:all`) in `lib/ticketCache.ts`.

## 9. Out of scope / deferred

- **Org reschedule/cancel *action*** and any admin write UI → **Admin web (M3)**.
- **Image upload** (event gallery, org banner/photo) → Admin web; seeded URLs for now.
- **Public (pre-sign-in) browsing** → fast-follow; app stays sign-in-first.
- **Per-org theming** (brand colors/logo re-skinning inside org/event pages) → not now.
- **Refund automation** on cancel → unchanged (admin-initiated, deferred).
- **Search/filter beyond simple name/place client search** (region/date facets, sort options) → later.

## 10. Documentation updates (implementation tasks)

- **PRD `docs/00-product-overview.md`:** reframe §1/§2.1 org-first → marketplace; **remove** "cross-org unified discovery feed" from §2.2 non-goals; update §4.2/§4.3 mobile features (Marketplace + Orgs/org page; drop choose/switch-org; add event reschedule/cancel as **Admin web M3**); §5.2 "org-first navigation" → "marketplace navigation" (data still siloed by `org_id`+RLS; published-event reads are cross-org by design); §6 data-model additions (event `description`/`gallery`/`original_date`/`status_note`/`cancelled`; org `banner_url`/`description`).
- **iOS MVP spec `docs/01-mobile-ios-mvp.md`:** update the §4 nav map + §5 screen table to the marketplace model.

## 11. Decomposition — two implementation plans

- **Plan A — Data + Marketplace + Event page:** additive migration (org/event fields + `cancelled` enum) + multi-org seed with demo cancelled/rescheduled + `lib/events.ts` read layer + `EventCard`/`EventGallery`/`StatusBadge` + Marketplace (Events tab) + Event-page enrichment (gallery, description, org header, status banner, Register rules).
- **Plan B — Orgs + navigation cleanup:** Orgs tab + Org page (`OrgHeader`) + remove org-context (`choose-org`, `lib/org.tsx`, index gate) + My Races global + ticket lifecycle banner + profile cleanup + PRD/iOS-spec doc edits + tests.

writing-plans finalizes the exact task breakdown; this is the intended shape.

## 12. Testing & acceptance

**Component (jest-expo):** Marketplace renders cross-org events with org name + status badge; `EventCard`; `EventGallery` paging; Orgs list; Org page (header + events); Event page cancelled → Register disabled + banner; rescheduled → new date; My Races global (no org filter); ticket cancelled/rescheduled banner.

**Backend (vitest, live local stack):** RLS still returns cross-org published events + **cancelled visible** + **draft hidden**; org list readable; new columns readable. Seed exposes ≥2 orgs plus the cancelled + rescheduled demo events.

**Live acceptance (iOS Simulator):** sign in → browse the marketplace across orgs → open an event (gallery + description) → tap the org header → org page → back → register a still-open event → pay → ticket. Verify a **cancelled** event shows the badge + disabled Register, and a **rescheduled** event shows the new date; My Races lists races across multiple orgs.

## 13. Acceptance criteria

1. After sign-in the runner lands on the **marketplace** (no choose-org step); every event card shows its **organization name**.
2. Opening an event shows the **gallery + description + categories/slots + Register CTA**; the org header navigates to the **org page**.
3. The **Orgs** tab lists organizations; an org page shows **banner + photo + about + that org's events**.
4. A **cancelled** event is still listed with a Cancelled badge/banner and a disabled Register; a **rescheduled** event shows its new date (and "was …") everywhere including existing tickets.
5. **My Races** shows the runner's registrations across **all** orgs; tickets still render offline (Plan 4 behavior preserved).
6. No org-first remnants remain (no choose-org screen, no switcher, no `lib/org.tsx`); tenant isolation on writes is unchanged and still covered by the backend suite.
