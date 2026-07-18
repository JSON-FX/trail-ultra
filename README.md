# trail-ultra

Multi-organization trail & ultra-trail event platform (Mindanao, Philippines).
**One runner account, many organizations, strictly isolated data.**

> **Status:** planning → scaffolding. See [`docs/`](./docs) for the PRD, ADRs, and visual flows.

## Monorepo layout

| Path | What |
| --- | --- |
| [`docs/`](./docs) | Planning — [PRD](./docs/00-product-overview.md), [ADRs](./docs/adr), [visual flows](./docs/trail-ultra-flows.html) |
| `apps/mobile/` | Expo (React Native) — iOS + Android *(to scaffold)* |
| `apps/web/` | React + Vite — admin console; storefront later *(to scaffold)* |
| `packages/shared/` | Shared TypeScript — types + Zod validators used across every surface |
| `supabase/` | Postgres migrations, RLS policies, Edge Functions (Deno/TS) *(to init)* |

## Stack

Expo / React Native · React + Vite · Supabase (Postgres · Auth · RLS · Realtime · Edge Functions) ·
PayMongo · getdesign `apple` → `DESIGN.md`. **TypeScript end-to-end.**

Decisions: **[ADR-0001 · tech stack](./docs/adr/0001-cross-platform-tech-stack.md)** ·
**[ADR-0002 · repo structure](./docs/adr/0002-repository-structure.md)**.

## Getting started

```bash
pnpm install     # after apps/ and packages/ are scaffolded
```

Immediate scaffolding steps are tracked in [`docs/README.md`](./docs/README.md).
