-- Defensive least-privilege fix. The hosted `organizations` table carried a
-- TABLE-level UPDATE grant to `authenticated` that predates the migrations (drift,
-- not created by any migration). It was dormant until 20260724130000 added the
-- branding UPDATE policy — which then let an org admin update ANY column
-- (commission_rate, is_active, name, slug, …), not just branding.
--
-- Re-assert least-privilege: revoke the table-wide UPDATE, then re-grant UPDATE on
-- only the two branding columns. Idempotent and safe on a clean DB (a fresh DB built
-- from migrations never had the table-level grant, so the revoke is a no-op there).
revoke update on organizations from authenticated;
grant update (logo_url, banner_url) on organizations to authenticated;
