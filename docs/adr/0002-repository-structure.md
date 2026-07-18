# ADR-0002: Repository & monorepo structure

**Status:** Accepted
**Date:** 2026-07-19
**Deciders:** Jayson (solo developer / product owner)
**Related:** [ADR-0001 · Cross-platform tech stack](./0001-cross-platform-tech-stack.md), [PRD](../00-product-overview.md)

## Context

trail-ultra spans several code surfaces — an Expo / React Native mobile app, a
React + Vite web app, Supabase Edge Functions (Deno/TS), and a shared TypeScript
package of types + Zod validators (ADR-0001) — plus planning docs (PRD, ADRs,
flows). It's a solo, AI-assisted build optimizing for speed to MVP, and the goal
is to keep planning and development versioned together, cleanly.

## Decision

Use a **single GitHub repository — a monorepo** — managed with **pnpm workspaces**:

```
trail-ultra/
├── docs/            planning — PRD, ADRs, visual flows
├── apps/
│   ├── mobile/      Expo (React Native) — iOS + Android
│   └── web/         React + Vite — admin console (storefront later)
├── packages/
│   └── shared/      TypeScript types + Zod validators (used everywhere)
├── supabase/        migrations, RLS policies, Edge Functions (Deno/TS)
├── DESIGN.md        getdesign `apple` output
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── package.json
```

Planning docs live in the same repo as the code they describe.

## Options Considered

### Option A: Single monorepo (pnpm workspaces) — CHOSEN
| Dimension | Assessment |
|-----------|------------|
| Complexity | Low–Med — one workspace config; minor Expo Metro setup |
| Code sharing | Trivial — `packages/shared` imported as a workspace |
| Atomic changes | Yes — one commit spans mobile + web + backend |
| Solo / AI fit | High — all context in one place |

**Pros:** effortless shared code; cross-surface changes in one commit; one set of
tooling (tsconfig, lint, CI); planning + code versioned together.
**Cons:** slight monorepo setup — Expo Metro config for workspace symlinks, and an
import map to share `shared` into Deno Edge Functions.

### Option B: Polyrepo (mobile / web / backend / docs separate)
**Pros:** independent history and access per surface.
**Cons:** sharing the TS package means publishing to npm or juggling git
submodules — high friction for a solo dev; cross-surface changes span multiple
PRs; four places to keep in sync. Rejected.

### Option C: Hybrid — docs repo + code monorepo
**Pros:** planning separable from code.
**Cons:** fragments planning from the code it describes; an extra repo to manage
for no solo-dev benefit. Rejected (a folder can be split out later if ever needed).

## Trade-off Analysis

The shared TS package is the deciding factor: it's consumed by mobile, web, and
Edge Functions, so it must be trivially importable — which a monorepo gives for
free and a polyrepo makes painful. For a solo, AI-assisted build, keeping every
surface (and the planning docs) in one place also maximizes the context Claude
can see and keeps changes atomic. The only real cost — a little Expo/Metro and
Deno import-map wiring — is one-time and small.

## Consequences

**Easier:** shared types/validation across all surfaces; atomic cross-surface
commits; single CI and tooling; planning versioned with code.
**Harder:** Expo needs Metro configured for workspace packages; sharing `shared`
into Deno Edge Functions needs an import map; CI should path-filter per app so it
doesn't rebuild everything on every change.
**Revisit if:** a surface needs separate ownership/access or open-sourcing — a
folder can be extracted into its own repo later (the easy direction).

## Action Items
1. [x] Create the monorepo skeleton (`apps/`, `packages/`, `supabase/`, `docs/`) with pnpm workspaces.
2. [ ] Scaffold `apps/mobile` (Expo) and `apps/web` (Vite); configure Expo Metro for the monorepo.
3. [ ] `supabase init`; add an import map so Edge Functions can use `@trail-ultra/shared`.
4. [ ] Add CI (`.github/workflows`) — typecheck / lint / test across workspaces, path-filtered deploys.
