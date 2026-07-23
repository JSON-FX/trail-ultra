# Org Branding Editor (Admin Web) + Mobile Rendering

**Status:** Approved, ready for implementation plan
**Scope:** `apps/web` (a Branding page + data layer), `apps/mobile` (render the uploaded images), Supabase (one storage-bucket + RLS migration). New admin-web dependency: `react-easy-crop`.
**Branch:** `worktree-org-branding-editor` (isolated worktree at `.claude/worktrees/org-branding-editor`)

## 1. Goals

Let an org `editor`/`admin` upload their organization's **avatar** and **cover photo** from the admin console, with a crop step, and have those images actually render on the mobile org profile (which today shows only generated placeholders).

## 2. Non-goals

- **No mobile editor** — editing is admin-web only in v1. Mobile only *renders* the result.
- **v1 edits avatar + cover only** — no `brand_color` / `name` / `description` editing yet (the RLS grant is scoped to `logo_url`, `banner_url` alone; broaden later).
- **No org creation / first-admin provisioning** — that's a separate super-admin flow (the admin web's "Organizations" page is still a placeholder). This feature assumes the org already exists and the user is its editor/admin.
- **No old-image cleanup** — replacing an image writes a new object and repoints the URL; the previous object is left orphaned in the bucket (acceptable for v1; a sweep can come later).
- **No image moderation.**

## 3. Storage — `org-images` bucket

New migration `supabase/migrations/20260724130000_org_images.sql`, a near-copy of `20260721110000_event_images_storage.sql`:

- **Bucket:** `insert into storage.buckets (id, name, public) values ('org-images','org-images', true) on conflict (id) do nothing;` — public read (mobile reads the public URL).
- **Write policies** (insert / update / delete) on `storage.objects` for `authenticated`, each checking `bucket_id = 'org-images' and auth_can_admin_org(((storage.foldername(name))[1])::uuid)`. Objects live at `{org_id}/{kind}-{uuid}.{ext}`, so the first path segment is the org id, gated by the existing `auth_can_admin_org` helper (editor/admin/super_admin).

## 4. Org write path — column-scoped RLS update on `organizations`

`organizations` has only `orgs_read_active` (select) + `grant select` today — no client write. In the **same migration**, add:

```sql
grant update (logo_url, banner_url) on organizations to authenticated;
create policy "organizations_update_branding_org_admin" on organizations
  for update using (auth_can_admin_org(id)) with check (auth_can_admin_org(id));
```

The **column grant** restricts what an authenticated user may update to exactly `logo_url` and `banner_url`; the **policy** restricts it to rows where they pass `auth_can_admin_org` (their own org). So an editor/admin can repoint their org's avatar/banner and nothing else — `id`, `slug`, `name`, etc. are not grantable through this path.

## 5. Admin web — Branding page

- **Route:** replace the `/settings` placeholder (`App.tsx` currently renders `<Placeholder title="Settings" />`) with a new `routes/Settings.tsx` Branding page. The Sidebar already has a "Settings" entry, and `RequireAdmin` (gated on `isAdmin`, which includes editors) is the right gate — editors manage branding.
- **Two uploaders** — Avatar (square, 1:1) and Cover (wide, 390/150 to match the mobile banner). Each: pick a file → **crop step** (`react-easy-crop`: drag/zoom at the fixed aspect) → produce the cropped blob → compress → upload → save the URL.
- **Crop → blob helper** (`lib/cropImage.ts`): `getCroppedBlob(imageSrc, croppedAreaPixels)` draws the selected region to a canvas and returns a `Blob`. *(Canvas isn't reliably testable in jsdom, so this helper is thin and reviewed, not unit-tested; the page test mocks it — see §7.)*
- **Data layer** (`lib/org.ts`):
  - `useMyOrg(orgId)` — reads `id, name, logo_url, banner_url` for the current org (`supabase.from("organizations").select(...).eq("id", orgId)`).
  - `uploadOrgImage(orgId, blob, kind)` — compresses (reuse `compressImage` from `imageUpload.ts`) and uploads to `org-images/{orgId}/{kind}-{uuid}.{ext}`, returns the public URL. (`kind` ∈ `avatar` | `cover`.)
  - `updateOrgBranding(orgId, patch)` — `supabase.from("organizations").update(patch).eq("id", orgId)` where `patch` is `{ logo_url? , banner_url? }` (via the §4 policy); returns `{ ok, error? }`.
- **Live preview** — show the current/just-uploaded avatar (circle) and cover (banner frame) so the editor sees what mobile will show. Invalidate `useMyOrg` on save.
- **`react-easy-crop`** added to `apps/web` dependencies.

## 6. Mobile rendering

Make the org profile show the uploaded images, falling back to today's placeholders:

- **`OrgAvatar`** — add an optional `logoUrl?: string | null` prop. When present, render `AvatarImage` (`@/components/ui/avatar`) with `source={{ uri: logoUrl }}`; the existing `AvatarFallback` initials stay as the fallback (also covers image-load failure). No `logoUrl` → unchanged behavior.
- **`OrgBanner`** — add an optional `bannerUrl?: string | null` prop. When present, render a full-bleed `Image` (`resizeMode="cover"`) at the given height; otherwise the current ridge SVG.
- **`OrgHeader`** — pass `logoUrl={org.logo_url}` to `OrgAvatar` and `bannerUrl={org.banner_url}` to `OrgBanner`. `org` already carries these (the org query uses `ORG_COLS`, which includes `logo_url`/`banner_url`).

No new mobile query — the fields are already fetched; they were just never rendered.

## 7. Testing

- **Migration:** SQL, no automated test (deferred `db push`). Bucket + policies reviewed.
- **`apps/web/src/lib/org.ts`** (Vitest, mock supabase): `useMyOrg` maps the row; `uploadOrgImage` uploads to the `org-images/{orgId}/{kind}-…` path and returns the public URL (mock `storage.from().upload`/`getPublicUrl` + `compressImage`); `updateOrgBranding` calls `.update({logo_url}).eq("id", orgId)` and surfaces errors.
- **Branding page** (Vitest, jsdom): mock `react-easy-crop`'s `Cropper` (render a stub that can fire `onCropComplete`), mock `lib/cropImage.getCroppedBlob` and `lib/org` — verify the flow: choose a file → crop UI shows → confirm → `uploadOrgImage` then `updateOrgBranding` called with the right args → preview reflects the new URL. Also the error path (upload/update fails → inline alert).
- **Mobile `OrgAvatar` / `OrgBanner`** (Jest): with a `logoUrl`/`bannerUrl` → renders the image; without → renders the initials/ridge fallback.
- **`cropImage.getCroppedBlob`**: not unit-tested (jsdom canvas limitation); kept thin, mocked in the page test, and verified by review — stated honestly, matching the repo's posture on untestable-in-CI code.

## 8. Rollout

Single branch in the isolated worktree, merged via PR.

**Deferred to merge (hosted, user-confirmed):**
- Apply the migration: `supabase db push` (creates the `org-images` bucket + the `organizations` branding-update policy on `ytwdrsmclwghwktpupqd`). Verify the bucket exists and the policy is present.
- The admin web runs locally (Docker) — rebuild/restart it to pick up the new Branding page. No hosted function to deploy.
- The mobile change ships with the next mobile build; no separate deploy.
