# Event Images Implementation Plan (Plan 11; M3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let org admins upload a set of event images (one starred as the featured/card image) that the Expo app renders — featured on dashboard cards, the whole set in a carousel on the event detail page.

**Architecture:** A public Supabase Storage bucket (`event-images`) with org-admin-scoped write RLS. The web admin compresses each image client-side to ≤3MB and uploads it directly; the event row stores the featured URL in `hero_image_url` and the rest in `gallery text[]` (no schema change beyond the bucket). The mobile app reads those existing columns and renders them, falling back to the current `ElevationHero` placeholder when an event has no images.

**Tech Stack:** Supabase Storage + RLS (`auth_can_admin_org` security-definer helper); web = Vite 6 / React 19 / supabase-js / `browser-image-compression` / Vitest + RTL (jsdom); mobile = Expo SDK 57 / React Native / jest-expo + RTL.

**Spec:** [docs/specs/2026-07-21-event-images-design.md](../specs/2026-07-21-event-images-design.md)

## Global Constraints

Every task's requirements implicitly include this section.

- **Bucket:** `event-images`, `public = true`. Object path shape: `{org_id}/{uuid}.{ext}`.
- **Write RLS:** insert/update/delete on `storage.objects` allowed only `to authenticated` where `bucket_id = 'event-images' and auth_can_admin_org(((storage.foldername(name))[1])::uuid)`. Read is public (no policy). Reuse the existing Plan 09 helper `auth_can_admin_org(uuid)` — do not redefine it.
- **Compression:** `browser-image-compression` with exactly `{ maxSizeMB: 3, maxWidthOrHeight: 2000, useWebWorker: true }`. Accepted input types: `image/jpeg`, `image/png`, `image/webp`.
- **Data model:** featured → `events.hero_image_url` (single); the remaining images (in order) → `events.gallery text[]`. Both columns already exist. The detail carousel is `[hero_image_url, ...gallery]` de-duplicated. **No schema change beyond creating the bucket.**
- **Cap:** at most **8** images total per event.
- **Fallback:** whenever an event has no images, mobile renders the existing `ElevationHero` exactly as today.
- **Mobile image component:** use React Native's built-in `Image` (remote `uri`), **not** `expo-image`. Rationale: avoids adding a native module + dev-client rebuild + an extra jest mock; matches the app's dependency-light style (hand-rolled `ElevationHero`). The spec left this as "verify/adopt"; this plan deliberately chooses built-in `Image` for the MVP. `expo-image` (disk cache/transitions) is a later perf enhancement.
- **Web dep gotcha:** after `pnpm --filter web add <dep>`, host tests resolve it immediately, but the **running Docker dev app** needs `docker compose restart web` to re-`pnpm install` its named-volume `node_modules` (else Vite throws `Failed to resolve import`).
- **Money/versions:** unrelated to this plan; no money fields touched. Node 20, pnpm 9.7.0.
- **Test commands:**
  - Backend (root, needs local Supabase up + `.env.local`): `pnpm exec vitest run supabase/tests/<file>`
  - Web: `pnpm --filter web exec vitest run src/__tests__/<file>`
  - Mobile: `pnpm --filter mobile exec jest <pattern>`
  - Typecheck: `pnpm -r typecheck`

---

### Task 1: Storage bucket + org-admin write RLS

**Files:**
- Create: `supabase/migrations/20260721110000_event_images_storage.sql`
- Test: `supabase/tests/storage-event-images.test.ts`

**Interfaces:**
- Consumes: the Plan 09 helper `auth_can_admin_org(uuid)`; seeded orgs `…a1` (Race Pace) and `…a2`; the `user_roles` table.
- Produces: a public `event-images` bucket whose objects are writable only by an admin of the org named in the object's first path segment.

- [ ] **Step 1: Write the failing test**

Create `supabase/tests/storage-event-images.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import { loadEnv } from "../../test/env";

const { url, anonKey, serviceKey } = loadEnv();
const anon = () => createClient(url, anonKey, { auth: { persistSession: false } });
const service = () => createClient(url, serviceKey, { auth: { persistSession: false } });
const authed = (t: string) =>
  createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${t}` } }, auth: { persistSession: false } });

async function makeUser(email: string) {
  const svc = service();
  const c = await svc.auth.admin.createUser({ email, password: "password123", email_confirm: true });
  const s = await anon().auth.signInWithPassword({ email, password: "password123" });
  return { id: c.data.user!.id, token: s.data.session!.access_token };
}
const RWP = "00000000-0000-0000-0000-0000000000a1";
const APO = "00000000-0000-0000-0000-0000000000a2";

describe("event-images storage bucket", () => {
  it("exists and is public", async () => {
    const { data, error } = await service().storage.getBucket("event-images");
    expect(error).toBeNull();
    expect(data?.public).toBe(true);
  });

  it("an org admin writes only under their own org folder; anyone can read", async () => {
    const svc = service();
    const admin = await makeUser(`img_adm_${Date.now()}@test.dev`);
    await svc.from("user_roles").insert({ user_id: admin.id, role: "admin", org_id: RWP });
    const other = await makeUser(`img_oth_${Date.now()}@test.dev`);
    await svc.from("user_roles").insert({ user_id: other.id, role: "admin", org_id: APO });
    const runner = await makeUser(`img_run_${Date.now()}@test.dev`);

    const body = new Blob(["hello"], { type: "text/plain" });
    const okPath = `${RWP}/${crypto.randomUUID()}.txt`;

    const up = await authed(admin.token).storage.from("event-images").upload(okPath, body);
    expect(up.error).toBeNull();

    const hack = await authed(other.token).storage.from("event-images").upload(`${RWP}/${crypto.randomUUID()}.txt`, body);
    expect(hack.error).not.toBeNull();

    const rup = await authed(runner.token).storage.from("event-images").upload(`${RWP}/${crypto.randomUUID()}.txt`, body);
    expect(rup.error).not.toBeNull();

    const publicUrl = svc.storage.from("event-images").getPublicUrl(okPath).data.publicUrl;
    const res = await fetch(publicUrl);
    expect(res.status).toBe(200);

    await svc.storage.from("event-images").remove([okPath]);
    await svc.from("user_roles").delete().in("user_id", [admin.id, other.id]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm exec vitest run supabase/tests/storage-event-images.test.ts`
Expected: FAIL — `getBucket("event-images")` returns an error / null (bucket doesn't exist yet).

(Prereq: local stack up — `pnpm exec supabase start` — and `.env.local` present: `pnpm exec supabase status -o env > .env.local`.)

- [ ] **Step 3: Write the migration**

Create `supabase/migrations/20260721110000_event_images_storage.sql`:

```sql
-- Event marketing images: a public-read bucket with org-admin-scoped writes.
-- Objects live at {org_id}/{uuid}.{ext}; the write policies check the first path
-- segment (org_id) against auth_can_admin_org (Plan 09 security-definer helper).

insert into storage.buckets (id, name, public)
values ('event-images', 'event-images', true)
on conflict (id) do nothing;

create policy "event_images_insert_org_admin" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'event-images'
    and auth_can_admin_org(((storage.foldername(name))[1])::uuid)
  );

create policy "event_images_update_org_admin" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'event-images'
    and auth_can_admin_org(((storage.foldername(name))[1])::uuid)
  )
  with check (
    bucket_id = 'event-images'
    and auth_can_admin_org(((storage.foldername(name))[1])::uuid)
  );

create policy "event_images_delete_org_admin" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'event-images'
    and auth_can_admin_org(((storage.foldername(name))[1])::uuid)
  );
```

- [ ] **Step 4: Apply the migration**

Run: `pnpm exec supabase db reset`
Expected: all migrations apply (including the new one) and the seed runs, with no errors.

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm exec vitest run supabase/tests/storage-event-images.test.ts`
Expected: PASS (both tests).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260721110000_event_images_storage.sql supabase/tests/storage-event-images.test.ts
git commit -m "feat(backend): event-images storage bucket + org-admin write RLS" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Web image compress + upload helper

**Files:**
- Modify: `apps/web/package.json` (add `browser-image-compression`)
- Create: `apps/web/src/lib/imageUpload.ts`
- Test: `apps/web/src/__tests__/image-upload.test.ts`

**Interfaces:**
- Consumes: the `supabase` client from `apps/web/src/lib/supabase.ts`; the `event-images` bucket from Task 1.
- Produces:
  - `compressImage(file: File): Promise<File>`
  - `uploadEventImage(orgId: string, file: File): Promise<string>` — returns the public URL; throws on a non-image type or an upload error.

- [ ] **Step 1: Add the dependency**

Run: `pnpm --filter web add browser-image-compression`
Expected: `browser-image-compression` appears in `apps/web/package.json` dependencies; host `node_modules` updated.
(For the live Docker app to see it later: `docker compose restart web`. Not needed for host tests.)

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/__tests__/image-upload.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const compressMock = vi.fn((file: File, _opts: unknown) => Promise.resolve(file));
vi.mock("browser-image-compression", () => ({ default: (file: File, opts: unknown) => compressMock(file, opts) }));

const uploadMock = vi.fn(() => Promise.resolve({ error: null }));
const getPublicUrlMock = vi.fn(() => ({ data: { publicUrl: "https://cdn.test/event-images/a1/x.png" } }));
vi.mock("../lib/supabase", () => ({
  supabase: { storage: { from: () => ({ upload: uploadMock, getPublicUrl: getPublicUrlMock }) } },
}));

import { compressImage, uploadEventImage } from "../lib/imageUpload";

function pngFile(name = "a.png") {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/png" });
}

beforeEach(() => { compressMock.mockClear(); uploadMock.mockClear(); });

describe("imageUpload", () => {
  it("compressImage passes the 3MB / 2000px worker options", async () => {
    await compressImage(pngFile());
    expect(compressMock).toHaveBeenCalledWith(expect.any(File), { maxSizeMB: 3, maxWidthOrHeight: 2000, useWebWorker: true });
  });

  it("uploadEventImage uploads under {orgId}/… and returns the public URL", async () => {
    const url = await uploadEventImage("a1", pngFile());
    expect(uploadMock).toHaveBeenCalled();
    const path = uploadMock.mock.calls[0]![0] as string;
    expect(path).toMatch(/^a1\/.+\.png$/);
    expect(url).toBe("https://cdn.test/event-images/a1/x.png");
  });

  it("rejects a non-image file before compressing", async () => {
    const txt = new File(["x"], "a.txt", { type: "text/plain" });
    await expect(uploadEventImage("a1", txt)).rejects.toThrow(/JPG, PNG, or WebP/);
    expect(compressMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/image-upload.test.ts`
Expected: FAIL — cannot resolve `../lib/imageUpload` (module not created yet).

- [ ] **Step 4: Write the implementation**

Create `apps/web/src/lib/imageUpload.ts`:

```ts
import imageCompression from "browser-image-compression";
import { supabase } from "./supabase";

const BUCKET = "event-images";
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

/** Compress an image to <=3MB and <=2000px on its longest edge, in a Web Worker. */
export async function compressImage(file: File): Promise<File> {
  return imageCompression(file, { maxSizeMB: 3, maxWidthOrHeight: 2000, useWebWorker: true });
}

/** Compress `file`, upload it under {orgId}/{uuid}.{ext}, and return its public URL. */
export async function uploadEventImage(orgId: string, file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type)) throw new Error("Please choose a JPG, PNG, or WebP image.");
  const compressed = await compressImage(file);
  const ext = EXT[compressed.type] ?? EXT[file.type] ?? "jpg";
  const path = `${orgId}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
    contentType: compressed.type || file.type,
    upsert: false,
  });
  if (error) throw new Error(error.message);
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/image-upload.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/src/lib/imageUpload.ts apps/web/src/__tests__/image-upload.test.ts
git commit -m "feat(web): image compress + upload helper (browser-image-compression)" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: EventImagesEditor component (web)

**Files:**
- Create: `apps/web/src/components/EventImagesEditor.tsx`
- Test: `apps/web/src/__tests__/event-images-editor.test.tsx`

**Interfaces:**
- Consumes: `uploadEventImage(orgId, file)` from Task 2 (mocked in the test).
- Produces:
  - `type EventImagesValue = { hero_image_url: string | null; gallery: string[] }`
  - `EventImagesEditor(props: { orgId: string; heroUrl: string | null; gallery: string[]; onChange: (next: EventImagesValue) => void })`
  - The component derives its display list from `[heroUrl, ...gallery]` (featured leads) and, on every mutation, emits `{ hero_image_url: <starred>, gallery: <the rest, in order> }`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/__tests__/event-images-editor.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { EventImagesEditor } from "../components/EventImagesEditor";

const uploadMock = vi.fn();
vi.mock("../lib/imageUpload", () => ({ uploadEventImage: (...a: unknown[]) => uploadMock(...a) }));

function png(name: string) { return new File([new Uint8Array([1])], name, { type: "image/png" }); }

beforeEach(() => uploadMock.mockReset());

it("uploads a picked file and reports it as the featured image", async () => {
  uploadMock.mockResolvedValueOnce("https://cdn/a1/one.png");
  const onChange = vi.fn();
  render(<EventImagesEditor orgId="a1" heroUrl={null} gallery={[]} onChange={onChange} />);
  fireEvent.change(screen.getByLabelText("Add images"), { target: { files: [png("one.png")] } });
  await waitFor(() =>
    expect(onChange).toHaveBeenCalledWith({ hero_image_url: "https://cdn/a1/one.png", gallery: [] }));
});

it("renders a grid and, on star, splits featured vs the rest", () => {
  const onChange = vi.fn();
  render(<EventImagesEditor orgId="a1" heroUrl="https://cdn/hero.png"
    gallery={["https://cdn/g1.png", "https://cdn/g2.png"]} onChange={onChange} />);
  expect(screen.getAllByRole("img")).toHaveLength(3);
  // Non-featured tiles carry the "Set as featured" label; the 2nd is g2.
  fireEvent.click(screen.getAllByLabelText("Set as featured")[1]!);
  expect(onChange).toHaveBeenCalledWith({
    hero_image_url: "https://cdn/g2.png",
    gallery: ["https://cdn/hero.png", "https://cdn/g1.png"],
  });
});

it("removing the featured promotes the next image", () => {
  const onChange = vi.fn();
  render(<EventImagesEditor orgId="a1" heroUrl="https://cdn/hero.png"
    gallery={["https://cdn/g1.png"]} onChange={onChange} />);
  fireEvent.click(screen.getAllByLabelText("Remove image")[0]!); // remove the hero (first tile)
  expect(onChange).toHaveBeenCalledWith({ hero_image_url: "https://cdn/g1.png", gallery: [] });
});

it("hides the picker at the 8-image cap", () => {
  const g = Array.from({ length: 7 }, (_, i) => `https://cdn/g${i}.png`);
  render(<EventImagesEditor orgId="a1" heroUrl="https://cdn/hero.png" gallery={g} onChange={vi.fn()} />);
  expect(screen.queryByLabelText("Add images")).toBeNull(); // 1 + 7 = 8 → full
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter web exec vitest run src/__tests__/event-images-editor.test.tsx`
Expected: FAIL — cannot resolve `../components/EventImagesEditor`.

- [ ] **Step 3: Write the implementation**

Create `apps/web/src/components/EventImagesEditor.tsx`:

```tsx
import { useRef, useState } from "react";
import { uploadEventImage } from "../lib/imageUpload";

export type EventImagesValue = { hero_image_url: string | null; gallery: string[] };
const MAX = 8;

const card = { background: "var(--canvas)", border: "1px solid var(--hairline)", borderRadius: "var(--radius-card)", padding: 22 } as const;
const tile = { position: "relative" as const, width: "100%", aspectRatio: "4 / 3", borderRadius: 10, overflow: "hidden" as const, border: "1px solid var(--hairline)", background: "var(--parchment)" };
const round = (bg: string) => ({ position: "absolute" as const, border: 0, borderRadius: 999, width: 26, height: 26, cursor: "pointer", color: "#fff", background: bg, fontSize: 13, lineHeight: "26px", textAlign: "center" as const, padding: 0 });

/** One image set for an event; the starred image is the featured (card) image.
 *  Controlled: on change it emits { hero_image_url: starred, gallery: the rest in order }. */
export function EventImagesEditor({ orgId, heroUrl, gallery, onChange }: {
  orgId: string;
  heroUrl: string | null;
  gallery: string[];
  onChange: (next: EventImagesValue) => void;
}) {
  const [pending, setPending] = useState(0);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const urls: string[] = [...(heroUrl ? [heroUrl] : []), ...gallery];
  const featured = heroUrl ?? gallery[0] ?? null;

  const emit = (nextUrls: string[], nextFeatured: string | null) => {
    const hero = nextFeatured && nextUrls.includes(nextFeatured) ? nextFeatured : (nextUrls[0] ?? null);
    onChange({ hero_image_url: hero, gallery: nextUrls.filter((u) => u !== hero) });
  };

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setErr(null);
    const room = MAX - urls.length - pending;
    const chosen = Array.from(files).slice(0, Math.max(0, room));
    // Accumulate locally: props don't update until React re-renders, so reading
    // `urls` after the first emit would be stale and clobber earlier uploads.
    let acc = [...urls];
    let feat = featured;
    for (const file of chosen) {
      setPending((n) => n + 1);
      try {
        const url = await uploadEventImage(orgId, file);
        acc = [...acc, url];
        if (!feat) feat = url;
        emit(acc, feat);
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        setPending((n) => n - 1);
      }
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  const remove = (url: string) => {
    const next = urls.filter((u) => u !== url);
    emit(next, url === featured ? (next[0] ?? null) : featured);
  };
  const star = (url: string) => emit(urls, url);

  const full = urls.length + pending >= MAX;

  return (
    <div style={card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>Images</span>
        <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>{urls.length}/{MAX} · ★ = featured</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginTop: 14 }}>
        {urls.map((url) => (
          <div key={url} style={tile}>
            <img src={url} alt="Event image" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <button type="button" aria-label={url === featured ? "Featured image" : "Set as featured"}
              onClick={() => star(url)} style={{ ...round(url === featured ? "var(--primary)" : "rgba(0,0,0,0.5)"), top: 6, left: 6 }}>★</button>
            <button type="button" aria-label="Remove image"
              onClick={() => remove(url)} style={{ ...round("rgba(0,0,0,0.5)"), top: 6, right: 6, fontSize: 15 }}>×</button>
            {url === featured ? (
              <span style={{ position: "absolute", bottom: 6, left: 6, background: "var(--primary)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>FEATURED</span>
            ) : null}
          </div>
        ))}
        {Array.from({ length: pending }).map((_, i) => (
          <div key={`p${i}`} style={{ ...tile, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span aria-label="Uploading" style={{ fontSize: 12, color: "var(--ink-muted)" }}>Uploading…</span>
          </div>
        ))}
      </div>

      {!full ? (
        <label style={{ display: "inline-block", marginTop: 12, fontSize: 13, fontWeight: 600, color: "var(--primary)", cursor: "pointer" }}>
          + Add images
          <input ref={fileRef} type="file" accept="image/*" multiple aria-label="Add images"
            style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
        </label>
      ) : null}
      {err ? <div style={{ color: "var(--danger)", fontSize: 12, marginTop: 8 }}>{err}</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter web exec vitest run src/__tests__/event-images-editor.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/EventImagesEditor.tsx apps/web/src/__tests__/event-images-editor.test.tsx
git commit -m "feat(web): EventImagesEditor grid (upload, remove, feature-star, cap)" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Wire EventImagesEditor into the editor + persist gallery

**Files:**
- Modify: `apps/web/src/lib/eventWrites.ts` (add `gallery` to `EventDraft` + `EVENT_COLS`)
- Modify: `apps/web/src/lib/events.ts` (add `gallery` to `EditorEvent` + the editor select)
- Modify: `apps/web/src/lib/validation.ts` (add `gallery` to `eventInputSchema`)
- Modify: `apps/web/src/routes/EventEditor.tsx` (blank default; replace the hero URL field with `EventImagesEditor`)
- Test: `apps/web/src/__tests__/validation.test.ts` (append), `apps/web/src/__tests__/event-editor.test.tsx` (update fixtures + add a carry-through test)

**Interfaces:**
- Consumes: `EventImagesEditor` + `EventImagesValue` (Task 3).
- Produces: `EventDraft.gallery: string[]` and `EditorEvent.gallery: string[]`; `saveEvent` persists `gallery`; the editor's `event` state carries `hero_image_url` + `gallery`.

- [ ] **Step 1: Add `gallery` to the write types (failing at typecheck)**

In `apps/web/src/lib/eventWrites.ts`, extend `EventDraft` and `EVENT_COLS`:

```ts
export type EventDraft = {
  id?: string; org_id: string; name: string; place: string | null; region: string | null;
  event_date: string | null; flag_off: string | null; status: string;
  elevation_gain_m: number | null; cutoff_hours: number | null; description: string | null;
  hero_image_url: string | null; gallery: string[];
};
```

```ts
const EVENT_COLS = (e: EventDraft) => ({
  org_id: e.org_id, name: e.name, place: e.place, region: e.region, event_date: e.event_date,
  flag_off: e.flag_off, status: e.status, elevation_gain_m: e.elevation_gain_m, cutoff_hours: e.cutoff_hours,
  description: e.description, hero_image_url: e.hero_image_url, gallery: e.gallery,
});
```

In `apps/web/src/lib/events.ts`, extend `EditorEvent` and the editor select:

```ts
export type EditorEvent = {
  id: string; org_id: string; name: string; place: string | null; region: string | null;
  event_date: string | null; flag_off: string | null; status: string;
  elevation_gain_m: number | null; cutoff_hours: number | null; description: string | null;
  hero_image_url: string | null; gallery: string[];
};
```

```ts
      const ev = await supabase.from("events")
        .select("id,org_id,name,place,region,event_date,flag_off,status,elevation_gain_m,cutoff_hours,description,hero_image_url,gallery")
        .eq("id", id!).single();
```

In `apps/web/src/lib/validation.ts`, add `gallery` to `eventInputSchema` (a safe default keeps existing callers valid):

```ts
export const eventInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  place: z.string().nullable(),
  region: z.string().nullable(),
  event_date: dateStr,
  flag_off: timeStr,
  status: z.enum(EVENT_STATUSES),
  elevation_gain_m: intNonNeg.nullable(),
  cutoff_hours: intNonNeg.nullable(),
  description: z.string().nullable(),
  hero_image_url: z.string().nullable(),
  gallery: z.array(z.string()).default([]),
});
```

- [ ] **Step 2: Append the validation test**

Add to the end of `apps/web/src/__tests__/validation.test.ts`:

```ts
it("accepts a gallery array and defaults it when omitted", () => {
  expect(eventInputSchema.safeParse({ ...validEvent, gallery: ["https://cdn/a.png"] }).success).toBe(true);
  expect(eventInputSchema.parse(validEvent).gallery).toEqual([]);
  expect(eventInputSchema.safeParse({ ...validEvent, gallery: [1, 2] }).success).toBe(false);
});
```

- [ ] **Step 3: Run the validation test (passes) + typecheck (still failing on EventEditor)**

Run: `pnpm --filter web exec vitest run src/__tests__/validation.test.ts`
Expected: PASS.

Run: `pnpm --filter web typecheck`
Expected: FAIL — `EventEditor.tsx`'s `blank` is missing `gallery`, and `event-editor.test.tsx` fixtures are missing `gallery`. Fixed next.

- [ ] **Step 4: Wire `EventImagesEditor` into the editor**

In `apps/web/src/routes/EventEditor.tsx`:

(a) Add the import next to the other component imports:

```ts
import { EventImagesEditor } from "../components/EventImagesEditor";
```

(b) Add `gallery: []` to the `blank` default:

```ts
const blank: EventDraft = { org_id: "", name: "", place: null, region: null, event_date: null, flag_off: null, status: "draft", elevation_gain_m: null, cutoff_hours: null, description: null, hero_image_url: null, gallery: [] };
```

(c) Delete the hero-URL field row (the `<div>` labelled `HERO IMAGE URL`):

```tsx
            <div><span style={label}>HERO IMAGE URL</span><input aria-label="Hero image URL" placeholder="https://…" style={input} value={event.hero_image_url ?? ""} onChange={(e) => set({ hero_image_url: e.target.value || null })} /></div>
```

(d) Add `EventImagesEditor` to the top of the right-hand column (above `CategoryEditor`):

```tsx
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <EventImagesEditor orgId={orgId} heroUrl={event.hero_image_url} gallery={event.gallery} onChange={(v) => set(v)} />
          <CategoryEditor rows={cats} onChange={setCats} />
          <AddonEditor rows={addons} onChange={setAddons} />
        </div>
```

- [ ] **Step 5: Update the editor test fixtures + add a carry-through test**

In `apps/web/src/__tests__/event-editor.test.tsx`:

(a) Add a mock for the upload helper at the top (so rendering the editor never loads the real `browser-image-compression`), next to the other `vi.mock` calls:

```ts
vi.mock("../lib/imageUpload", () => ({ uploadEventImage: vi.fn() }));
```

(b) In the "allows saving a cancelled event…" test, add `gallery: []` to the fixture event object:

```ts
      event: {
        id: "e1", org_id: "a1", name: "Apo Sky Ultra", place: null, region: null,
        event_date: null, flag_off: null, status: "cancelled",
        elevation_gain_m: null, cutoff_hours: null, description: null, hero_image_url: null, gallery: [],
      },
```

(c) Add a new test at the end of the file:

```tsx
it("carries hero_image_url + gallery through to save", async () => {
  mockUseParams.mockReturnValue({ id: "e1" });
  mockUseEventForEditor.mockReturnValue({
    data: {
      event: {
        id: "e1", org_id: "a1", name: "Apo", place: null, region: null,
        event_date: null, flag_off: null, status: "open",
        elevation_gain_m: null, cutoff_hours: null, description: null,
        hero_image_url: "https://cdn/hero.png", gallery: ["https://cdn/g1.png"],
      },
      categories: [],
      addons: [],
    },
    isLoading: false,
  });
  render(<MemoryRouter><EventEditor /></MemoryRouter>);
  fireEvent.click(await screen.findByText("Save event"));
  await waitFor(() => expect(mockSave).toHaveBeenCalled());
  expect(mockSave.mock.calls[0]![0].event).toMatchObject({
    hero_image_url: "https://cdn/hero.png",
    gallery: ["https://cdn/g1.png"],
  });
});
```

- [ ] **Step 6: Run web tests + typecheck to verify all pass**

Run: `pnpm --filter web exec vitest run src/__tests__/event-editor.test.tsx src/__tests__/validation.test.ts`
Expected: PASS.

Run: `pnpm --filter web typecheck`
Expected: PASS (no type errors).

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/eventWrites.ts apps/web/src/lib/events.ts apps/web/src/lib/validation.ts apps/web/src/routes/EventEditor.tsx apps/web/src/__tests__/validation.test.ts apps/web/src/__tests__/event-editor.test.tsx
git commit -m "feat(web): wire EventImagesEditor into the event editor; persist gallery" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Featured image on mobile event cards

**Files:**
- Modify: `apps/mobile/components/EventCard.tsx`
- Test: `apps/mobile/__tests__/event-card.test.tsx`

**Interfaces:**
- Consumes: `EventRow.hero_image_url` (already on the type + already selected by the queries).
- Produces: an `<Image testID="event-card-image">` when `hero_image_url` is set; otherwise the existing `<ElevationHero>`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/__tests__/event-card.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
// ElevationHero renders react-native-svg; stub it so the fallback is assertable by testID.
jest.mock("../components/ElevationHero", () => ({
  ElevationHero: () => { const { View } = require("react-native"); return <View testID="elevation-hero" />; },
}));
import { EventCard } from "../components/EventCard";
import type { EventRow } from "../lib/events";

const base: EventRow = {
  id: "e1", org_id: "o1", name: "Highland Trail Run", place: null, region: null,
  event_date: "2026-11-14", elevation_gain_m: null, cutoff_hours: null, status: "open",
  hero_image_url: null, description: null, gallery: [], original_date: null, status_note: null,
  city_psgc_code: null, region_name: null, province_name: null, city_name: null, venue: null,
  org_name: "Race Pace", org_color: "#159A55",
};

it("renders the featured image when hero_image_url is set", () => {
  render(<EventCard event={{ ...base, hero_image_url: "https://cdn/hero.png" }} onPress={() => {}} />);
  expect(screen.getByTestId("event-card-image")).toBeOnTheScreen();
  expect(screen.queryByTestId("elevation-hero")).toBeNull();
});

it("falls back to the elevation hero when there is no image", () => {
  render(<EventCard event={base} onPress={() => {}} />);
  expect(screen.getByTestId("elevation-hero")).toBeOnTheScreen();
  expect(screen.queryByTestId("event-card-image")).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mobile exec jest event-card`
Expected: FAIL — no element with testID `event-card-image` (card still always renders `ElevationHero`).

- [ ] **Step 3: Write the implementation**

In `apps/mobile/components/EventCard.tsx`, add `Image` to the react-native import and replace the hero block.

Import line — add `Image`:

```tsx
import { View, Text, Pressable, Image, StyleSheet } from "react-native";
```

Replace:

```tsx
      <View>
        <ElevationHero height={132} />
        <View style={styles.badge}><StatusBadge event={event} /></View>
      </View>
```

with:

```tsx
      <View>
        {event.hero_image_url ? (
          <Image testID="event-card-image" source={{ uri: event.hero_image_url }} style={{ height: 132, width: "100%" }} resizeMode="cover" />
        ) : (
          <ElevationHero height={132} />
        )}
        <View style={styles.badge}><StatusBadge event={event} /></View>
      </View>
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter mobile exec jest event-card`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/EventCard.tsx apps/mobile/__tests__/event-card.test.tsx
git commit -m "feat(mobile): featured image on event cards (ElevationHero fallback)" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: EventGallery carousel on the event page

**Files:**
- Create: `apps/mobile/components/EventGallery.tsx`
- Modify: `apps/mobile/app/event/[id].tsx` (replace the hero `ElevationHero` with `EventGallery`)
- Test: `apps/mobile/__tests__/event-gallery.test.tsx`

**Interfaces:**
- Consumes: `EventRow.hero_image_url` + `EventRow.gallery` (already available on the detail page's `event`).
- Produces: `EventGallery(props: { images: (string | null | undefined)[]; height: number })` — de-dupes + drops falsy urls, renders one full-width paging slide per image (`testID="gallery-image"`) with a dots indicator, and falls back to `<ElevationHero>` when empty.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/__tests__/event-gallery.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react-native";
jest.mock("../components/ElevationHero", () => ({
  ElevationHero: () => { const { View } = require("react-native"); return <View testID="elevation-hero" />; },
}));
import { EventGallery } from "../components/EventGallery";

it("renders one slide per unique image and drops falsy entries", () => {
  render(<EventGallery images={["https://cdn/hero.png", "https://cdn/g1.png", null]} height={250} />);
  expect(screen.getAllByTestId("gallery-image")).toHaveLength(2);
  expect(screen.queryByTestId("elevation-hero")).toBeNull();
});

it("de-dupes a url that appears twice (featured also in gallery)", () => {
  render(<EventGallery images={["https://cdn/a.png", "https://cdn/a.png"]} height={250} />);
  expect(screen.getAllByTestId("gallery-image")).toHaveLength(1);
});

it("falls back to the elevation hero when there are no images", () => {
  render(<EventGallery images={[null, undefined]} height={250} />);
  expect(screen.getByTestId("elevation-hero")).toBeOnTheScreen();
  expect(screen.queryByTestId("gallery-image")).toBeNull();
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter mobile exec jest event-gallery`
Expected: FAIL — cannot resolve `../components/EventGallery`.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/components/EventGallery.tsx`:

```tsx
import { useState } from "react";
import { View, Image, ScrollView, StyleSheet, useWindowDimensions } from "react-native";
import type { NativeSyntheticEvent, NativeScrollEvent } from "react-native";
import { ElevationHero } from "./ElevationHero";

/** Horizontal paging carousel of an event's images with a dots indicator.
 *  Falls back to the ElevationHero placeholder when there are no images. */
export function EventGallery({ images, height }: { images: (string | null | undefined)[]; height: number }) {
  const urls = Array.from(new Set(images.filter((u): u is string => !!u)));
  const { width } = useWindowDimensions();
  const [idx, setIdx] = useState(0);

  if (urls.length === 0) return <ElevationHero height={height} />;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setIdx(width > 0 ? Math.round(e.nativeEvent.contentOffset.x / width) : 0);
  };

  return (
    <View style={{ height }}>
      <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} scrollEventThrottle={16}>
        {urls.map((uri) => (
          <Image key={uri} testID="gallery-image" source={{ uri }} style={{ width, height }} resizeMode="cover" />
        ))}
      </ScrollView>
      {urls.length > 1 ? (
        <View style={styles.dots} pointerEvents="none">
          {urls.map((uri, i) => (
            <View key={uri} style={[styles.dot, i === idx ? styles.dotOn : styles.dotOff]} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  dots: { position: "absolute", bottom: 12, left: 0, right: 0, flexDirection: "row", justifyContent: "center", gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotOn: { backgroundColor: "#fff" },
  dotOff: { backgroundColor: "rgba(255,255,255,0.5)" },
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `pnpm --filter mobile exec jest event-gallery`
Expected: PASS (3 tests).

- [ ] **Step 5: Wire it into the event detail page**

In `apps/mobile/app/event/[id].tsx`:

(a) Replace the import:

```tsx
import { ElevationHero } from "../../components/ElevationHero";
```

with:

```tsx
import { EventGallery } from "../../components/EventGallery";
```

(b) Replace the hero render:

```tsx
          <ElevationHero height={250} />
```

with:

```tsx
          <EventGallery images={[event.hero_image_url, ...(event.gallery ?? [])]} height={250} />
```

- [ ] **Step 6: Run the mobile suite to confirm the page still renders**

Run: `pnpm --filter mobile test`
Expected: PASS (all suites, including the new `event-gallery` + `event-card` and the unchanged `event-address`).

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/components/EventGallery.tsx apps/mobile/app/event/[id].tsx apps/mobile/__tests__/event-gallery.test.tsx
git commit -m "feat(mobile): EventGallery carousel on the event page" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Full verification + roadmap doc

**Files:**
- Modify: `docs/README.md` (add a Plan 11 roadmap entry)

**Interfaces:**
- Consumes: everything above.
- Produces: a green three-suite run and an updated roadmap.

- [ ] **Step 1: Run every suite + typecheck**

```bash
pnpm exec vitest run                 # backend + shared (needs local Supabase up)
pnpm --filter web test               # web
pnpm --filter mobile test            # mobile
pnpm -r typecheck                    # all packages
```

Expected: all green. If anything fails, fix it before committing (re-run the specific suite).

- [ ] **Step 2: Update the roadmap**

In `docs/README.md`, add a Plan 11 entry to the roadmap list/table immediately after the Plan 10 entry, mirroring its format, e.g.:

```markdown
- **Plan 11 — Event images** (M3): featured + gallery upload (Supabase Storage, client-side compression) and mobile rendering (event cards + detail carousel). See [docs/plans/11-event-images.md](plans/11-event-images.md).
```

- [ ] **Step 3: Commit**

```bash
git add docs/README.md
git commit -m "docs: add Plan 11 (event images) to the roadmap" \
  -m "Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 4: Manual smoke (optional, recommended)**

Restart the web container so it picks up the new dep, then create/edit an event in the admin app and confirm upload works end-to-end:

```bash
docker compose restart web
```

Open https://admin.racepace.lan → Events → Create/Edit → add images, star one, Save. Then confirm the mobile app shows the featured image on the card and the carousel on the event page.

---

## Self-Review

**Spec coverage:**
- Storage bucket + write RLS → Task 1. ✓
- Client-side compression (≤3MB/2000px) + upload helper → Task 2. ✓
- Single-grid `EventImagesEditor` with featured star + 8 cap + save-split → Tasks 3 & 4. ✓
- `hero_image_url`/`gallery` persistence, no schema change → Task 4. ✓
- Mobile card featured image + `ElevationHero` fallback → Task 5. ✓
- Mobile detail carousel `[hero, ...gallery]` deduped + fallback → Task 6. ✓
- Edge cases (no images, only one image, non-image rejected, other-org/runner rejected) → covered by Task 1/2/3/5/6 tests. ✓
- Out of scope (orphan GC, EXIF, reorder, PSGC/date/time, `banner_url`) → not implemented, as intended. ✓

**Placeholder scan:** none — every code/test block is complete; the only soft step is the `docs/README.md` roadmap line (Task 7 Step 2), which gives the exact line to add.

**Type consistency:** `EventImagesValue = { hero_image_url: string | null; gallery: string[] }` is produced by Task 3 and consumed by Task 4's `onChange={(v) => set(v)}` (`set` accepts `Partial<EventDraft>`, and `EventDraft` now has both fields). `EventDraft.gallery` (eventWrites) and `EditorEvent.gallery` (events) are both `string[]`, matching the `gallery text[]` column and the editor `blank`/seed. `uploadEventImage(orgId, file): Promise<string>` (Task 2) is the signature mocked and called in Task 3.
