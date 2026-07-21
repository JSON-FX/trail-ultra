# Admin — Event Images (featured + gallery upload & rendering) — Design Spec (Plan 11; M3)

- **Status:** Approved (brainstorm 2026-07-21)
- **Owner:** Product (jayson@voltcontent.com)
- **Feeds:** superpowers:writing-plans → implementation plan
- **Relates to:** [Plan 10 events management](2026-07-21-events-management-design.md) (the editor this extends; §9 deferred "real hero/gallery image upload → its own plan" — this is that plan); [Plan 09 admin foundation](2026-07-20-admin-foundation-design.md) (`auth_can_admin_org`); the Event editor + event page in the handover mockups.

## 1. Goal

Let org admins **upload a set of images** for an event and mark one as the **featured** image. In the **Expo mobile app (iOS + Android)**: the featured image is shown on the event's card in the dashboard event list (grouped by organizer), and tapping the card opens the event detail page where **all** of the event's uploaded images — the featured one included — appear in a **carousel**. Each uploaded image is **compressed client-side to ≤3MB** before it ever leaves the browser, keeping Storage small.

This is a **cross-surface** slice, not an admin-only tweak:

- **Storage is not configured today** (`config.toml` has the buckets block commented out; no storage migration). This plan stands up the bucket + policies.
- **The mobile app renders no real images today.** Both `EventCard` and the event detail page (`app/event/[id].tsx`) draw `ElevationHero` — a synthetic SVG elevation-profile placeholder. The `hero_image_url` and `gallery text[]` columns exist (Plan 5 marketplace fields) but nothing displays them. This plan wires real rendering with `ElevationHero` as the graceful fallback.

The Plan 10 editor currently exposes `hero_image_url` as a **pasted URL text field** and has no gallery input; this plan replaces that with real upload widgets.

## 2. Decisions (from brainstorm)

1. **Client-side compression + direct-to-Storage upload** — the admin picks a file → [`browser-image-compression`](https://www.npmjs.com/package/browser-image-compression) shrinks it to ≤3MB in a Web Worker → the compressed blob uploads straight to a **public** Supabase Storage bucket via `supabase-js` → we store the returned public URL on the event row. Rejected: an Edge-Function / Supabase image-transformation resize (transformation isn't enabled locally, and the oversized original still transits/stores first — more infra, no MVP benefit); and size-cap-only with no compression (rejects virtually every modern phone photo).
2. **Public-read bucket `event-images`.** Event photos are public marketing content shown to all runners; the mobile `<Image>`/`expo-image` loads a plain public URL with no auth header. Writes (insert/update/delete) are gated by RLS to org admins.
3. **Objects are keyed by org, not event** — path `{org_id}/{uuid}.{ext}`. A new event has no id at upload time (the editor is one form); org-keyed paths remove that dependency and let the write policy check the path's first segment against `auth_can_admin_org`.
4. **One image set in the editor; the admin stars one as featured.** On save it splits into the existing columns: the starred image → `hero_image_url` (the card image), the rest (in order) → `gallery text[]`. So the detail carousel is `[hero_image_url, ...gallery]` = the whole uploaded set. Both columns already exist — **no schema change** beyond creating the bucket. `banner_url` stays unused.
5. **Mobile falls back to `ElevationHero`** whenever an event has no featured image / no gallery, so events without photos look exactly as they do today.
6. **Address / date / time / number inputs are NOT in this plan** — they're **Plan 12** (editor structured inputs: PSGC Region→Province→City pickers + a free-text Venue, real `date`/`time` inputs, number inputs). No barangay (stays City/Municipality depth). Confirmed in brainstorm.

## 3. Backend — Storage bucket + RLS

New migration (additive). Reuses the Plan 09 `security definer` helper `auth_can_admin_org(uuid)`. `storage.objects` has RLS enabled by default.

```sql
-- Public-read bucket for event marketing images.
insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

-- Write access: only where the path's first segment (org_id) is an org the caller admins.
-- Path shape: {org_id}/{uuid}.{ext}  →  (storage.foldername(name))[1] = org_id
create policy "event_images_insert_org_admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-images'
    and auth_can_admin_org(((storage.foldername(name))[1])::uuid)
  );
create policy "event_images_update_org_admin" on storage.objects
  for update to authenticated
  using  (bucket_id = 'event-images' and auth_can_admin_org(((storage.foldername(name))[1])::uuid))
  with check (bucket_id = 'event-images' and auth_can_admin_org(((storage.foldername(name))[1])::uuid));
create policy "event_images_delete_org_admin" on storage.objects
  for delete to authenticated
  using  (bucket_id = 'event-images' and auth_can_admin_org(((storage.foldername(name))[1])::uuid));
```

- **Read** needs no policy: `public = true` serves objects via the `/object/public/event-images/...` URL, bypassing RLS. That public URL is what we persist and what mobile loads.
- A malformed (non-UUID) first segment fails the `::uuid` cast and the write is rejected — acceptable, since the client always uploads under a real `org_id`.

## 4. Compression + upload helper (web)

New `apps/web/src/lib/imageUpload.ts` — framework-neutral, unit-testable:

```ts
// compressImage: shrink to ≤3MB and bound the longest edge, in a worker.
compressImage(file: File): Promise<File>
//   browser-image-compression: { maxSizeMB: 3, maxWidthOrHeight: 2000, useWebWorker: true }

// uploadEventImage: compress → upload under {orgId}/{uuid}.{ext} → return the public URL.
uploadEventImage(orgId: string, file: File): Promise<string>
//   name = `${orgId}/${crypto.randomUUID()}.${ext}`  (ext from the compressed blob's type)
//   supabase.storage.from('event-images').upload(name, blob, { contentType, upsert: false })
//   return supabase.storage.from('event-images').getPublicUrl(name).data.publicUrl
```

- New web dependency `browser-image-compression` → after adding it, **`docker compose restart web`** (the container re-runs `pnpm install` against its named-volume `node_modules`; a host-side install alone throws Vite `Failed to resolve import`).
- Accepted types: `image/jpeg|png|webp`. Rejects non-images before compressing.

## 5. Admin upload UI (EventEditor)

In `apps/web/src/routes/EventEditor.tsx`, replace the old hero URL text field with **one** widget — **`EventImagesEditor`** (its own component, alongside the existing `CategoryEditor`/`AddonEditor`):

- A **single thumbnail grid** of the event's images plus an **Add images** picker (multi-select). Up to **8** images total; the picker is hidden once 8 are present. Each upload runs `uploadEventImage(orgId, file)` with a per-tile spinner until its URL resolves.
- Each tile has **Remove** and a **featured star** (a radio — exactly one image is featured). The featured defaults to the first image; removing the featured promotes the next one. An empty grid = no featured.
- The component works over one ordered list of `{ url, featured }` in the editor's form state. **On save it splits**: the starred url → `hero_image_url`; the remaining urls, in order → `gallery`. **On load (edit)** it reconstructs the grid as `[hero_image_url, ...gallery]` with the hero starred.

This saves through the existing `saveEvent` path — no change to the save/reconcile logic, just the two values (`hero_image_url`, `gallery`) it already persists. Removing an image or re-starring **orphans** the old Storage object (no GC yet — see §9).

## 6. Mobile rendering

- **`EventCard`** (`apps/mobile/components/EventCard.tsx`): render `event.hero_image_url` as the card image via **`expo-image`** (caching/`contentFit`, per the v57 docs — verify/adopt the dependency), at the current `ElevationHero` height (132). **`hero_image_url == null` → keep `ElevationHero`.** Nothing else on the card changes.
- **Event page** (`apps/mobile/app/event/[id].tsx`): a new **`EventGallery`** component — a horizontal, `pagingEnabled` `ScrollView` with a dots indicator (hand-rolled, dependency-light, matching `ElevationHero`'s style) — showing **`[hero_image_url, ...gallery]`** (deduped, nulls dropped) at height 250. **No images → render `ElevationHero`** exactly as today.
- `EventRow`/`EventDetail` types already carry `hero_image_url` and `gallery`; no query change needed (marketplace + detail selects already return them).

## 7. Edge cases & error handling

| Case | Behavior |
| --- | --- |
| Event with no images | Card renders `ElevationHero` (unchanged look) |
| Event with no images | Event-page hero renders `ElevationHero` |
| Only one image uploaded | It is the featured; card shows it; carousel shows one slide (no dots) |
| Admin uploads for another org (crafted path) | Storage RLS `with check` rejects the insert |
| Non-admin (runner) attempts upload | No write policy matches → rejected |
| Oversized / huge-dimension photo | Compressed to ≤3MB and ≤2000px before upload |
| Non-image file picked | Rejected client-side before compression, with a message |
| Compression or upload fails | Tile shows an error state; the field keeps its prior value; Save not blocked by a failed tile |
| Remove an image / change which is featured | List updated in form state (removing the featured promotes the next image); old Storage object orphaned (no GC yet) |
| Broken/removed remote URL on mobile | `expo-image` fails quietly; `EventGallery` still renders remaining slides |

## 8. Testing

- **Backend (root Vitest, live stack):** the migration applies; the `event-images` bucket exists and is public; the three write policies exist on `storage.objects` (`pg_policies`). (Full storage-RLS enforcement via the storage API is exercised manually — the harness asserts the bucket + policy rows are present.)
- **Web (Vitest + RTL, jsdom), mocking `browser-image-compression` + `supabase.storage`:**
  - `compressImage` calls the library with `{ maxSizeMB: 3, maxWidthOrHeight: 2000, useWebWorker: true }`.
  - `uploadEventImage` uploads under a `{orgId}/…` path and returns the public URL; rejects a non-image file.
  - `EventImagesEditor`: adding files calls upload and shows thumbnails; enforces the **8-image cap** (picker hidden at 8); Remove drops the right tile; the **star** moves featured to the chosen tile; removing the featured promotes the next; and its save-split yields the starred url as `hero_image_url` + the rest as `gallery`.
- **Mobile (jest-expo + RTL):**
  - `EventCard` renders an image when `hero_image_url` is set; renders `ElevationHero` when null.
  - `EventGallery` renders N slides + N dots for `[hero, ...gallery]`; falls back to `ElevationHero` when there are no images.

## 9. Out of scope (later plans)

- **Orphaned-image garbage collection** (deleting Storage objects when a URL is replaced/removed or a draft event is deleted). Acceptable orphan accrual for MVP.
- **Editor structured inputs** — PSGC Region→Province→City pickers + free-text Venue, real `date`/`time`/number inputs → **Plan 12**. (No barangay.)
- **EXIF stripping, drag-to-reorder gallery, per-image alt text, a cropper.**
- **`banner_url` usage**, and any non-event image surfaces (org logos, etc.).

## 10. File touch-list (for writing-plans)

- **Create (backend):** migration `supabase/migrations/<ts>_event_images_storage.sql` (bucket + 3 write policies) · a backend test asserting bucket + policies exist (extend the admin-events test suite or a new `storage-event-images.test.ts`).
- **Create (web):** `apps/web/src/lib/imageUpload.ts` (compress + upload) · `apps/web/src/components/EventImagesEditor.tsx` (grid + add/remove + featured star + save-split) · web tests. **Dep:** add `browser-image-compression` to `apps/web` (+ `docker compose restart web`).
- **Modify (web):** `apps/web/src/routes/EventEditor.tsx` (swap the hero URL text field for `EventImagesEditor`; pass `orgId`; feed `hero_image_url`/`gallery` in on load and split them back out on save).
- **Create (mobile):** `apps/mobile/components/EventGallery.tsx` (paging carousel + dots) · mobile tests. **Dep:** adopt `expo-image` per v57 docs if not already present.
- **Modify (mobile):** `apps/mobile/components/EventCard.tsx` (featured image + `ElevationHero` fallback) · `apps/mobile/app/event/[id].tsx` (use `EventGallery` in place of the standalone `ElevationHero` hero).
- **Backend config:** none expected — the local stack already runs Storage and the bucket is created by the migration (the commented `[storage.buckets.*]` declarative block in `config.toml` is a separate mechanism we don't need). Verify the bucket appears after `supabase db reset`.
- **Docs:** add Plan 11 to `docs/plans/` and to the `docs/README.md` roadmap.
