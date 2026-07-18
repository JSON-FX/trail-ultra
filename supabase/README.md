# supabase — database & server logic

Postgres **migrations**, **Row-Level Security** policies, and **Edge Functions**
(Deno/TS) for payment intents, webhooks, QR mint/verify, settlement, and
server-side custom-field validation.

**Not initialized yet.** Set up with:

```bash
supabase init
supabase functions new <name>
```

- Schema, RLS, and roles are specified in [PRD §6 & §8](../docs/00-product-overview.md).
- Multi-tenancy: every tenant table carries `org_id`; every RLS policy keys on it.
- Reuse `@trail-ultra/shared` (types + validators) in Deno via an import map.
