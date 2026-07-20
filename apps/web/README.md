# Race Pace — Admin web console

Vite + React + TypeScript. Runs in Docker behind the shared Traefik proxy at
**https://admin.racepace.lan** (this Mac). dnsmasq resolves `*.lan`; Traefik
serves it with the mkcert `*.lan` cert — same convention as the other `.lan` sites.

## First-time setup
1. Bring up the shared infra (Traefik on `dev-net`): in `/Users/jsonse/Documents/development/infra` → `docker compose up -d`. And the Supabase stack: `pnpm exec supabase start`.
2. From this repo root: `docker compose up` (first run installs the workspace in-container — slow once).
3. Open **https://admin.racepace.lan** — no `/etc/hosts` needed (dnsmasq handles `.lan`), cert is locally trusted (mkcert).

## Local dev without Docker
`pnpm --filter web dev` → http://localhost:5173

## Tests / types
`cd apps/web && pnpm test` · `pnpm typecheck`
