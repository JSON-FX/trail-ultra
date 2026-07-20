# ADR-0001: Cross-platform tech stack for race-pace

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Jayson (solo developer / product owner)
**Related:** [00-product-overview.md](../00-product-overview.md) (PRD v0.4)

## Context

race-pace is a multi-tenant trail & ultra-trail event platform (see the PRD). The
MVP ships two surfaces — a **runner mobile app (iOS first, then Android)** and an
**admin web console** — with a public e-commerce web storefront deferred.

Decision-shaping constraints (gathered 2026-07-19):

- **Solo developer.** One person builds and maintains everything.
- **AI-authored.** Claude writes most of the code, so the stack should be one with
  deep, high-quality training coverage and stable conventions.
- **Existing skills:** React / TypeScript / React Native and Node / Postgres / SQL.
- **Priority:** speed to a working MVP.
- **Web is a separate codebase** (React) — deliberately not shared from the mobile framework.
- **Product forces:** offline-capable QR tickets + camera scanning, PH-native
  payments (Card / GCash / Maya), strict multi-tenant data isolation, realtime check-in.

The stack was already proposed in the PRD; this ADR records the decision, the
alternatives weighed, and the trade-offs, so the choice is deliberate and revisitable.

## Decision

Adopt a **TypeScript-end-to-end** stack:

| Layer | Choice |
| --- | --- |
| **Mobile (iOS + Android)** | **Expo (React Native) + TypeScript** — managed workflow, EAS Build, Expo Router |
| **Backend** | **Supabase** — Postgres, Auth, Row-Level Security, Realtime, Storage |
| **Server logic** | **Supabase Edge Functions** (Deno / TypeScript) |
| **Payments** | **PayMongo** (single platform account) via Edge Functions |
| **Web (separate)** | **React + Vite + TypeScript** — admin console first, storefront later |
| **Design language** | **getdesign `apple`** → a `DESIGN.md` Claude follows for consistent UI across RN + web |

The crux — *what to use for iOS and Android* — is **Expo / React Native**. The rest
of the stack is the natural, lowest-friction complement to that choice for a solo,
AI-assisted build.

## Options Considered (mobile / cross-platform framework)

### Option A: Expo (React Native) + TypeScript — CHOSEN
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low–Med — the managed workflow hides most native toolchain work |
| Cost | Low — free OSS; EAS Build free tier is ample for MVP |
| Scalability | High — proven at large app scale; native-module escape hatch |
| Team familiarity | High — you already know RN/TS; Claude is strongest here |

**Pros:**
- One codebase → both platforms; one language (TS) across mobile, web, and Edge Functions.
- Best-in-class AI coverage: Claude writes RN / TS / Supabase reliably and idiomatically.
- Expo managed + EAS Build removes Xcode / Android Studio config pain — decisive for a solo dev.
- First-class pieces for every MVP need: `expo-camera` (QR), `expo-secure-store`
  (tokens), `expo-sqlite` / MMKV (offline tickets), Supabase JS SDK, OTA updates.
- getdesign `DESIGN.md` applies directly (Claude styles RN from it).

**Cons:**
- Native performance ceiling below true native for very heavy graphics/animation (not a factor here).
- Some device features need a config plugin / custom dev client (manageable).

### Option B: Flutter + Dart
| Dimension | Assessment |
|-----------|------------|
| Complexity | Med |
| Cost | Low |
| Scalability | High |
| Team familiarity | Low — new language (Dart) for you |

**Pros:** excellent UI performance and consistency; single codebase; strong tooling.
**Cons:** Dart is a new language for a solo dev optimizing for speed; smaller Claude
training corpus than RN/TS → more review overhead; no sharing of TS types/validation
with the React web or Supabase Edge Functions.

### Option C: Native — Swift (iOS) + Kotlin (Android)
| Dimension | Assessment |
|-----------|------------|
| Complexity | High |
| Cost | High (2× build & maintenance) |
| Scalability | High |
| Team familiarity | Low |

**Pros:** maximum performance and platform fidelity.
**Cons:** two codebases for a solo dev — directly contradicts speed-to-MVP; no
code/skill reuse; slowest path to Android. Rejected.

### Option D: Kotlin Multiplatform / Compose Multiplatform
| Dimension | Assessment |
|-----------|------------|
| Complexity | High |
| Cost | Med |
| Scalability | Med–High |
| Team familiarity | Low |

**Pros:** shared business logic across platforms; native UI.
**Cons:** newer / less settled for full-app UI; steeper for a solo dev; weaker AI
coverage than RN/TS; no reuse with the React web. Overkill for this MVP.

## Trade-off Analysis

The dominant forces are **solo developer + AI-authored + speed-to-MVP**. These reward
*fewest languages and toolchains* and *maximum AI reliability* far more than squeezing
out native performance.

- **One language wins twice.** TypeScript across mobile (RN), web (React), and Edge
  Functions (Deno) means a single mental model, shared types, and shared validation
  (e.g., a Zod schema for custom registration fields reused everywhere). For a solo
  dev that cuts context-switching; for Claude it maximizes consistency.
- **AI coverage is a first-class constraint here.** RN + TS + Supabase are among the
  most heavily represented stacks in Claude's training — fewer hallucinated APIs, more
  idiomatic output, less review burden. Flutter/KMP trade this away for benefits
  (raw UI performance) this app doesn't need.
- **Expo removes the solo-dev tax.** Managed workflow + EAS Build means no native
  build-config wrangling; OTA updates mean fast iteration without app-store round-trips.
- **What we give up** — the native performance ceiling and instant access to every
  native API — is not on this app's critical path (registration + ticketing + QR scan),
  and RN's native-module escape hatch covers the rare exception.

## Consequences

**Easier**
- Ship iOS and Android from one codebase; iterate fast via OTA.
- Reuse types + validation across mobile, web, and server (one TS source of truth).
- Claude can implement most features end to end with high reliability.
- getdesign `DESIGN.md` gives consistent Apple-style UI across all surfaces.

**Harder**
- Deep native capabilities (should they arise) require config plugins / a custom dev client.
- Because web is a *separate* React codebase (by choice), some logic is duplicated
  between mobile and web — mitigate with a shared TS package (`packages/shared`:
  types, Zod validators, formatting).
- getdesign is guidance, not components — UI must still be built to match `DESIGN.md`;
  consistency depends on Claude following it (keep a review habit / checklist).

**Revisit if**
- A core feature needs native depth RN can't reach, or app performance becomes a real bottleneck.
- The web surface grows enough that sharing a framework (RN Web) would clearly pay off.

## Action Items
1. [ ] Scaffold the Expo app (TypeScript) with Expo Router; configure EAS Build for iOS + Android.
2. [ ] Run `npx getdesign@latest add apple`; commit `DESIGN.md`; have Claude read it before any UI.
3. [ ] Create the Supabase project; implement schema + RLS per PRD §6/§8; add Edge
   Functions (Deno/TS) for payment intents, webhooks, QR mint/verify, settlement, and custom-field validation.
4. [ ] Wire PayMongo sandbox through Edge Functions; implement the webhook-confirm + soft-hold-TTL flow.
5. [ ] Stand up a shared TS package (types + Zod validators) consumed by mobile, web, and Edge Functions.
6. [ ] Implement offline tickets (`expo-sqlite` / MMKV) and QR scanning (`expo-camera`) with offline signed-token verification.
7. [ ] (Next spec) Detail the iOS MVP build in `docs/01-mobile-ios-mvp.md`.
