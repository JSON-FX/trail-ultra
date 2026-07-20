# Runner Profile — Core Details Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a runner fill stable details once (a "runner passport" on their Profile) so every registration prefills from them, via a shared known-key bridge — implementing [docs/specs/2026-07-20-runner-profile-core-details-design.md](../specs/2026-07-20-runner-profile-core-details-design.md).

**Architecture:** Additive migration adds two `profiles` columns. A shared `PROFILE_KEYS` vocabulary + option lists (in `@race-pace/shared`) is the single source of truth. The Profile screen gains a "Race details" section; the Register screen prefills a passport block from the profile, **suppresses** profile-key `form_fields` from the per-event question loop (Model B), and offers a snapshot save-back toggle. No Edge Function change — `registrations-checkout` already stores `custom_data` whole and `customDataSchema` is non-strict.

**Tech Stack:** Expo (React Native) SDK 57 + TypeScript, Expo Router, `@race-pace/shared` (Zod), Supabase (Postgres migration), jest-expo (mobile), Vitest (shared/backend).

## Global Constraints

- **Passport field set (exact):** `bib_name`, `date_of_birth`, `gender`, `shirt_size`, `blood_type`, `emergency_contact`. `PROFILE_KEYS` = those six.
- **Canonical option lists (exact, plain ASCII):** `BLOOD_TYPES = ["A+","A-","B+","B-","O+","O-","AB+","AB-","Unknown"]`; `SHIRT_SIZES = ["XS","S","M","L","XL","XXL"]`; `GENDERS = ["Male","Female","Non-binary","Prefer not to say"]`.
- **Model B suppression:** a `form_field` whose `key` satisfies `isProfileKey` is rendered in the passport block (prefilled) and **excluded** from the per-event `DynamicField` loop. Profile-key fields use the canonical option lists, **not** the form_field's own `options`, and are validated by passport rules — **not** by `customDataSchema` (whose enums may differ, e.g. seed `f1` options `["A","O"]`).
- **Save-back:** registration always writes a full passport **snapshot** into `custom_data`; a save-back toggle appears only when a passport field was filled-from-empty or edited; default **ON** iff something was filled-from-empty, else **OFF**. Save-back failure is caught and **never blocks** registration.
- **Waiver & `first_ultra` stay per-race.** Never persisted to the profile.
- **Backend-compatible:** do **not** change `supabase/functions/**`. Seed `form_field` IDs `f1`–`f3` and addon/category IDs stay stable (backend tests reference them).
- **Theme:** trail-green tokens from `apps/mobile/lib/theme.ts` (`theme.primary`, `theme.hairline`, `theme.inkMuted`, `theme.radius.pill`, …). No new colors.
- **Expo:** read https://docs.expo.dev/versions/v57.0.0/ before writing mobile code (see `apps/mobile/AGENTS.md`).

## File Structure

- `packages/shared/src/index.ts` — add `PROFILE_KEYS`, `ProfileKey`, `isProfileKey`, `BLOOD_TYPES`, `SHIRT_SIZES`, `GENDERS` (pure types/constants; no React).
- `supabase/migrations/20260720130000_runner_profile_core.sql` — add `date_of_birth`, `blood_type`.
- `apps/mobile/lib/profile.ts` — widen `Profile`, `getProfile` select, `upsertProfile` (accept partial).
- `apps/mobile/components/PillSelect.tsx` — small reusable pill selector (Profile + Register).
- `apps/mobile/app/(tabs)/profile.tsx` — "Race details" section.
- `apps/mobile/app/register/[categoryId].tsx` — passport block, suppression, validation, snapshot, save-back.

Test commands (run from the stated dir):
- Shared: `pnpm vitest run packages/shared/src/index.test.ts` (repo root)
- Mobile test: `cd apps/mobile && pnpm test -- <pattern>`
- Mobile typecheck: `cd apps/mobile && npx tsc --noEmit`
- Migration: `pnpm exec supabase db reset` (repo root; local stack running)

---

### Task 1: Shared vocabulary (`PROFILE_KEYS`, option lists, `isProfileKey`)

**Files:**
- Modify: `packages/shared/src/index.ts` (after the `FormField` block, ~line 33)
- Test: `packages/shared/src/index.test.ts`

**Interfaces:**
- Produces: `PROFILE_KEYS: readonly ProfileKey[]`, `type ProfileKey`, `isProfileKey(k: string): k is ProfileKey`, `BLOOD_TYPES`, `SHIRT_SIZES`, `GENDERS` (all `readonly string[]` / `as const`). Consumed by mobile `profile.tsx` and `register/[categoryId].tsx`.

- [ ] **Step 1: Write the failing tests** — append to `packages/shared/src/index.test.ts`:

```ts
import {
  customDataSchema, formatPeso, registrationInputSchema, type FormField,
  PROFILE_KEYS, isProfileKey, BLOOD_TYPES, SHIRT_SIZES, GENDERS,
} from "./index";

describe("profile vocabulary", () => {
  it("isProfileKey recognizes passport keys and rejects event keys", () => {
    expect(isProfileKey("blood_type")).toBe(true);
    expect(isProfileKey("shirt_size")).toBe(true);
    expect(isProfileKey("running_club")).toBe(false);
    expect(isProfileKey("bus_pickup_point")).toBe(false);
  });
  it("PROFILE_KEYS is the agreed set", () => {
    expect([...PROFILE_KEYS].sort()).toEqual(
      ["bib_name","blood_type","date_of_birth","emergency_contact","gender","shirt_size"]);
  });
  it("option lists are plain ASCII", () => {
    expect(BLOOD_TYPES).toContain("O-");
    expect(SHIRT_SIZES).toContain("XL");
    expect(GENDERS).toContain("Prefer not to say");
    expect(BLOOD_TYPES.join("")).not.toMatch(/[−–]/); // no unicode minus/en-dash
  });
});

describe("customDataSchema ignores non-declared keys (passport snapshot survives)", () => {
  it("validates event fields and leaves extra snapshot keys untouched", () => {
    const fields: FormField[] = [{ key: "running_club", label: "Club", type: "text", required: false }];
    // A passport snapshot rides along in custom_data; non-strict schema must accept it.
    expect(customDataSchema(fields).safeParse(
      { running_club: "Trailblazers", bib_name: "JR", blood_type: "O+" }).success).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm vitest run packages/shared/src/index.test.ts`
Expected: FAIL — `PROFILE_KEYS`/`isProfileKey`/`BLOOD_TYPES` are not exported.

- [ ] **Step 3: Implement** — insert into `packages/shared/src/index.ts` immediately after the `FormField` type (line 33):

```ts
/** Profile-owned attributes: prefill into registration + save back (Model B bridge). */
export const PROFILE_KEYS = ["bib_name","date_of_birth","gender","shirt_size","blood_type","emergency_contact"] as const;
export type ProfileKey = (typeof PROFILE_KEYS)[number];
export const isProfileKey = (k: string): k is ProfileKey => (PROFILE_KEYS as readonly string[]).includes(k);

/** Canonical option lists reused by Profile + Register selects. Store plain ASCII. */
export const BLOOD_TYPES = ["A+","A-","B+","B-","O+","O-","AB+","AB-","Unknown"] as const;
export const SHIRT_SIZES = ["XS","S","M","L","XL","XXL"] as const;
export const GENDERS     = ["Male","Female","Non-binary","Prefer not to say"] as const;
```

- [ ] **Step 4: Run to verify it passes**

Run: `pnpm vitest run packages/shared/src/index.test.ts`
Expected: PASS (all `customDataSchema`, `formatPeso`, `registrationInputSchema`, and new suites green).

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/index.ts packages/shared/src/index.test.ts
git commit -m "feat(shared): PROFILE_KEYS vocabulary + canonical option lists"
```

---

### Task 2: Migration + Profile data layer

**Files:**
- Create: `supabase/migrations/20260720130000_runner_profile_core.sql`
- Modify: `apps/mobile/lib/profile.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `Profile` widened to `{ id; full_name; bib_name; city; emergency_contact?; date_of_birth?; gender?; shirt_size?; blood_type? }` (all nullable). `getProfile(userId)` selects the new columns. `upsertProfile(row: Partial<Profile> & { id: string })` — partial upsert so callers pass only the fields they own.

- [ ] **Step 1: Write the migration** — `supabase/migrations/20260720130000_runner_profile_core.sql`:

```sql
-- Runner passport: date_of_birth + blood_type. gender/shirt_size/emergency_contact
-- already exist on profiles (20260718182546_init_orgs_profiles.sql).
alter table profiles
  add column if not exists date_of_birth date,
  add column if not exists blood_type text;
```

- [ ] **Step 2: Apply and verify the columns exist**

Run: `pnpm exec supabase db reset`
Expected: reset completes without error and re-applies the seed (a malformed `ALTER` would abort the reset). Optionally confirm in Studio (`profiles` table shows `date_of_birth`, `blood_type`).

- [ ] **Step 3: Widen the Profile data layer** — replace `apps/mobile/lib/profile.ts` entirely:

```ts
import { supabase } from "./supabase";

export type Profile = {
  id: string;
  full_name: string | null;
  bib_name: string | null;
  city: string | null;
  emergency_contact?: string | null;
  date_of_birth?: string | null;
  gender?: string | null;
  shirt_size?: string | null;
  blood_type?: string | null;
};

const PROFILE_COLS = "id,full_name,bib_name,city,emergency_contact,date_of_birth,gender,shirt_size,blood_type";

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select(PROFILE_COLS).eq("id", userId).maybeSingle();
  return data as Profile | null;
}

/** Partial upsert: PostgREST merge-duplicates updates only the provided columns. */
export async function upsertProfile(row: Partial<Profile> & { id: string }): Promise<{ error?: string }> {
  const { error } = await supabase.from("profiles").upsert(row);
  return error ? { error: error.message } : {};
}
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: PASS (no type errors; existing `profile.tsx`/`register` still compile against the wider `Profile` and partial `upsertProfile`).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260720130000_runner_profile_core.sql apps/mobile/lib/profile.ts
git commit -m "feat(profiles): add date_of_birth + blood_type; widen Profile + partial upsert"
```

---

### Task 3: `PillSelect` component

**Files:**
- Create: `apps/mobile/components/PillSelect.tsx`
- Test: `apps/mobile/__tests__/pill-select.test.tsx`

**Interfaces:**
- Produces: `PillSelect({ label, value, options, onChange, accessibilityLabel? })` where `value: string | null`, `options: readonly string[]`, `onChange: (v: string) => void`. Each option is a `button` with `accessibilityState.selected`. Consumed by Profile + Register.

- [ ] **Step 1: Write the failing test** — `apps/mobile/__tests__/pill-select.test.tsx`:

```tsx
import { render, screen, fireEvent } from "@testing-library/react-native";
import { PillSelect } from "../components/PillSelect";

describe("PillSelect", () => {
  it("renders the label + options and reports the pressed value", () => {
    const onChange = jest.fn();
    render(<PillSelect label="BLOOD TYPE" value="O+" options={["A+", "O+", "B+"]} onChange={onChange} />);
    expect(screen.getByText("BLOOD TYPE")).toBeOnTheScreen();
    fireEvent.press(screen.getByText("B+"));
    expect(onChange).toHaveBeenCalledWith("B+");
  });
  it("marks the current value as selected", () => {
    render(<PillSelect label="SHIRT" value="M" options={["S", "M", "L"]} onChange={jest.fn()} />);
    expect(screen.getByRole("button", { name: "M", selected: true })).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "S", selected: false })).toBeOnTheScreen();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/mobile && pnpm test -- pill-select`
Expected: FAIL — `../components/PillSelect` cannot be found.

- [ ] **Step 3: Implement** — `apps/mobile/components/PillSelect.tsx`:

```tsx
import { View, Text, Pressable, StyleSheet } from "react-native";
import { theme } from "../lib/theme";

export function PillSelect({ label, value, options, onChange, accessibilityLabel }: {
  label: string; value: string | null; options: readonly string[];
  onChange: (v: string) => void; accessibilityLabel?: string;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label} accessibilityLabel={accessibilityLabel}>{label}</Text>
      <View style={styles.options}>
        {options.map((opt) => {
          const active = value === opt;
          return (
            <Pressable key={opt} onPress={() => onChange(opt)} style={[styles.opt, active && styles.optActive]}
              accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={opt}>
              <Text style={[styles.optText, active && styles.optTextActive]}>{opt}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 14 },
  label: { fontSize: 11, fontWeight: "600", letterSpacing: 0.4, color: theme.inkMuted, marginBottom: 8 },
  options: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  opt: { borderWidth: 1, borderColor: theme.hairline, borderRadius: theme.radius.pill, paddingVertical: 8, paddingHorizontal: 14 },
  optActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  optText: { color: theme.ink, fontSize: 14 },
  optTextActive: { color: "#fff", fontWeight: "600" },
});
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/mobile && pnpm test -- pill-select`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/components/PillSelect.tsx apps/mobile/__tests__/pill-select.test.tsx
git commit -m "feat(mobile): PillSelect component"
```

---

### Task 4: Profile "Race details" section

**Files:**
- Modify: `apps/mobile/app/(tabs)/profile.tsx`
- Test: `apps/mobile/__tests__/profile.test.tsx` (extend existing)

**Interfaces:**
- Consumes: `PillSelect` (Task 3); widened `Profile`/`upsertProfile` (Task 2); `BLOOD_TYPES`, `SHIRT_SIZES`, `GENDERS` (Task 1).
- Produces: none (screen).

- [ ] **Step 1: Write the failing test** — replace `apps/mobile/__tests__/profile.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const mockUpsert = jest.fn().mockResolvedValue({});
jest.mock("../lib/auth", () => ({ useAuth: () => ({ session: { user: { id: "u1", email: "jr@x.test" } }, signOut: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("../lib/profile", () => ({
  getProfile: jest.fn().mockResolvedValue({ id: "u1", full_name: "JR Dela Cruz", bib_name: "JR", city: "Davao", blood_type: "O+", shirt_size: "M", emergency_contact: "Jane 0917" }),
  upsertProfile: (...a: unknown[]) => mockUpsert(...a),
}));

import Profile from "../app/(tabs)/profile";

describe("Profile", () => {
  it("loads existing values incl. race details", async () => {
    render(<Profile />);
    await waitFor(() => expect(screen.getByDisplayValue("JR Dela Cruz")).toBeOnTheScreen());
    expect(screen.getByDisplayValue("Davao")).toBeOnTheScreen();
    expect(screen.getByDisplayValue("Jane 0917")).toBeOnTheScreen();
    expect(screen.getByRole("button", { name: "O+", selected: true })).toBeOnTheScreen();
  });
  it("saves the widened passport payload", async () => {
    render(<Profile />);
    await waitFor(() => expect(screen.getByDisplayValue("JR Dela Cruz")).toBeOnTheScreen());
    fireEvent.press(screen.getByRole("button", { name: "L" }));      // change shirt size
    fireEvent.press(screen.getByText("Save changes"));
    await waitFor(() => expect(mockUpsert).toHaveBeenCalled());
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({
      id: "u1", full_name: "JR Dela Cruz", bib_name: "JR", city: "Davao",
      blood_type: "O+", shirt_size: "L", emergency_contact: "Jane 0917",
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/mobile && pnpm test -- profile.test`
Expected: FAIL — no race-details fields / `O+` pill; `upsertProfile` payload lacks passport keys.

- [ ] **Step 3: Implement** — edit `apps/mobile/app/(tabs)/profile.tsx`:

3a. Update imports (add `PillSelect` + shared lists):
```tsx
import { PillSelect } from "../../components/PillSelect";
import { BLOOD_TYPES, SHIRT_SIZES, GENDERS } from "@race-pace/shared";
```

3b. Add state (after the `city` state, line 19):
```tsx
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [shirtSize, setShirtSize] = useState("");
  const [bloodType, setBloodType] = useState("");
  const [emergency, setEmergency] = useState("");
```

3c. Extend the prefill effect body (line 25) to also set the new fields:
```tsx
      if (p) {
        setFullName(p.full_name ?? ""); setBibName(p.bib_name ?? ""); setCity(p.city ?? "");
        setDob(p.date_of_birth ?? ""); setGender(p.gender ?? ""); setShirtSize(p.shirt_size ?? "");
        setBloodType(p.blood_type ?? ""); setEmergency(p.emergency_contact ?? "");
      }
```

3d. Widen the `save()` upsert payload (line 32):
```tsx
    const { error } = await upsertProfile({
      id: uid, full_name: fullName, bib_name: bibName, city,
      date_of_birth: dob || null, gender: gender || null, shirt_size: shirtSize || null,
      blood_type: bloodType || null, emergency_contact: emergency || null,
    });
```

3e. Insert the Race details block between the Identity group's closing `</View>` (line 54) and the Save button (line 55):
```tsx
        <Text style={[styles.section, { marginTop: 26 }]}>Race details</Text>
        <Text style={styles.hint}>Fill these once — we'll add them to every race you register for.</Text>
        <View style={{ gap: 12 }}>
          <View><Text style={styles.label}>DATE OF BIRTH</Text><TextInput style={styles.input} value={dob} onChangeText={setDob} placeholder="YYYY-MM-DD" placeholderTextColor={theme.inkFaint} autoCapitalize="none" accessibilityLabel="Date of birth" /></View>
          <PillSelect label="GENDER" value={gender} options={GENDERS} onChange={setGender} />
          <PillSelect label="SHIRT SIZE" value={shirtSize} options={SHIRT_SIZES} onChange={setShirtSize} />
          <PillSelect label="BLOOD TYPE" value={bloodType} options={BLOOD_TYPES} onChange={setBloodType} />
          <View><Text style={styles.label}>EMERGENCY CONTACT</Text><TextInput style={styles.input} value={emergency} onChangeText={setEmergency} placeholder="Name & mobile number" placeholderTextColor={theme.inkFaint} accessibilityLabel="Emergency contact" /></View>
        </View>
```

3f. Add the `hint` style to the StyleSheet (after `section`, line 76):
```tsx
  hint: { fontSize: 13, color: theme.inkMuted, marginTop: -6, marginBottom: 12, lineHeight: 18 },
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/mobile && pnpm test -- profile.test`
Expected: PASS (2 tests). Then `npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/(tabs)/profile.tsx" apps/mobile/__tests__/profile.test.tsx
git commit -m "feat(mobile): Profile Race details section (DOB, gender, shirt, blood, emergency)"
```

---

### Task 5: Register passport block — prefill, suppression, validation, snapshot

**Files:**
- Modify: `apps/mobile/app/register/[categoryId].tsx`
- Test: rework `apps/mobile/__tests__/register-submit.test.tsx`

**Interfaces:**
- Consumes: `isProfileKey`, `BLOOD_TYPES`, `SHIRT_SIZES`, `GENDERS` (Task 1); `PillSelect` (Task 3); `getProfile`/`Profile` (Task 2). Existing `useCategory`/`useFormFields`/`useAddons`, `startCheckout`, `customDataSchema`, `FormField`.
- Produces: passport block + suppression + snapshot. Save-back is added in Task 6 (this task leaves `saveBack` out).

**Suppression & validation rules (implement exactly):**
- `eventQuestions = fieldRows.filter(f => !isProfileKey(f.key))` — only these render as `DynamicField` and feed `values`.
- `requested = new Set(fieldRows.filter(f => isProfileKey(f.key)).map(f => f.key))` — gender/shirt_size/blood_type render in the passport block **only if** requested.
- Validation order: (1) `customDataSchema(eventQuestions as FormField[]).safeParse(values)`; (2) each **required** requested profile-key field has a non-empty passport value; (3) `bib_name` & `emergency_contact` non-empty; (4) `date_of_birth`, if present, matches `^\d{4}-\d{2}-\d{2}$`; (5) `waiver`.
- Snapshot `custom_data = { bib_name, date_of_birth, gender, shirt_size, blood_type, emergency_contact, first_ultra, ...values }`.

- [ ] **Step 1: Rework the failing test** — replace `apps/mobile/__tests__/register-submit.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const mockReplace = jest.fn();
const mockStartCheckout = jest.fn().mockResolvedValue({ registration_id: "r1", checkout_url: "http://x/dev/pay/r1" });
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ categoryId: "c3" }), useRouter: () => ({ replace: mockReplace, back: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../lib/auth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } } }) }));
// Profile supplies blood_type (a profile key) so it prefills the passport block instead of being asked.
jest.mock("../lib/profile", () => ({
  getProfile: jest.fn().mockResolvedValue({ id: "u1", bib_name: "JR", blood_type: "O+", emergency_contact: "Jane 0917 000 0000" }),
  upsertProfile: jest.fn().mockResolvedValue({}),
}));
jest.mock("../lib/registration", () => ({ startCheckout: (...a: unknown[]) => mockStartCheckout(...a) }));
jest.mock("../lib/events", () => ({
  useCategory: () => ({ data: { id: "c3", event_id: "e1", label: "21K", base_price: 150000 }, isLoading: false }),
  useFormFields: () => ({ data: [
    { id: "f1", key: "blood_type", label: "Blood type", type: "select", required: true, options: ["A", "O"], sort_order: 1 },
    { id: "f2", key: "running_club", label: "Club", type: "text", required: false, options: null, sort_order: 2 },
  ], isLoading: false }),
  useAddons: () => ({ data: [{ id: "d1", name: "Singlet", price: 60000 }], isLoading: false }),
}));

import Register from "../app/register/[categoryId]";

describe("Register submit", () => {
  it("suppresses the blood_type question (prefilled in passport) but keeps the event club question", async () => {
    render(<Register />);
    await waitFor(() => expect(screen.getByRole("button", { name: "O+", selected: true })).toBeOnTheScreen());
    expect(screen.getByText("Club")).toBeOnTheScreen();              // non-profile field still asked
  });

  it("submits a passport snapshot (blood_type from profile) to checkout", async () => {
    render(<Register />);
    await waitFor(() => expect(screen.getByDisplayValue("Jane 0917 000 0000")).toBeOnTheScreen());
    fireEvent.press(screen.getByText("Register"));                    // waiver not accepted yet
    await waitFor(() => expect(screen.getByText("You must accept the waiver.")).toBeOnTheScreen());
    fireEvent.press(screen.getByLabelText("Accept waiver"));
    fireEvent.press(screen.getByText("Register"));
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalled());
    const arg = mockStartCheckout.mock.calls[0][0];
    expect(arg).toMatchObject({
      event_id: "e1", category_id: "c3", waiver_accepted: true,
      custom_data: { bib_name: "JR", blood_type: "O+", emergency_contact: "Jane 0917 000 0000" },
    });
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: "/pay/[registrationId]",
      params: { registrationId: "r1", checkoutUrl: "http://x/dev/pay/r1" },
    });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/mobile && pnpm test -- register-submit`
Expected: FAIL — blood_type still renders as a question (no `O+` passport pill) / snapshot lacks passport keys.

- [ ] **Step 3: Implement** — edit `apps/mobile/app/register/[categoryId].tsx`:

3a. Imports:
```tsx
import { customDataSchema, formatPeso, isProfileKey, BLOOD_TYPES, SHIRT_SIZES, GENDERS, type FormField } from "@race-pace/shared";
import { PillSelect } from "../../components/PillSelect";
```

3b. Add passport state (after `emergency`, line 25 — keep `firstUltra` per-race):
```tsx
  const [gender, setGender] = useState("");
  const [shirtSize, setShirtSize] = useState("");
  const [bloodType, setBloodType] = useState("");
```

3c. Extend the prefill effect (line 35-39) to load the full passport:
```tsx
  useEffect(() => {
    if (session?.user.id) getProfile(session.user.id).then((p) => {
      if (p) {
        setBibName(p.bib_name ?? ""); setDob(p.date_of_birth ?? ""); setGender(p.gender ?? "");
        setShirtSize(p.shirt_size ?? ""); setBloodType(p.blood_type ?? ""); setEmergency(p.emergency_contact ?? "");
      }
    });
  }, [session?.user.id]);
```

3d. Replace the derived `fieldRows`/`asFormFields` (lines 49-50) with the suppression split:
```tsx
  const fieldRows = fields.data ?? [];
  const eventQuestions = fieldRows.filter((f) => !isProfileKey(f.key));
  const requested = new Set(fieldRows.filter((f) => isProfileKey(f.key)).map((f) => f.key));
  const eventFields: FormField[] = eventQuestions.map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required, options: f.options ?? undefined }));
```

3e. Replace the `submit()` validation + payload (lines 52-69):
```tsx
  async function submit() {
    const parsed = customDataSchema(eventFields).safeParse(values);
    if (!parsed.success) { setError("Please complete the required fields correctly."); return; }
    const passport: Record<string, string> = { bib_name: bibName, date_of_birth: dob, gender, shirt_size: shirtSize, blood_type: bloodType, emergency_contact: emergency };
    for (const f of fieldRows) {
      if (isProfileKey(f.key) && f.required && !passport[f.key]?.trim()) { setError(`${f.label} is required.`); return; }
    }
    if (!bibName.trim()) { setError("Bib name is required."); return; }
    if (!emergency.trim()) { setError("Emergency contact is required."); return; }
    if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) { setError("Date of birth must be YYYY-MM-DD."); return; }
    if (!waiver) { setError("You must accept the waiver."); return; }
    setError(null); setBusy(true);
    try {
      const res = await startCheckout({
        event_id: eventId, category_id: categoryId,
        addon_ids: Object.keys(selectedAddons).filter((id) => selectedAddons[id]),
        custom_data: { bib_name: bibName, date_of_birth: dob, gender, shirt_size: shirtSize, blood_type: bloodType, emergency_contact: emergency, first_ultra: firstUltra, ...values },
        waiver_accepted: true, idempotency_key: idempotencyKey,
      });
      router.replace({ pathname: "/pay/[registrationId]", params: { registrationId: res.registration_id, checkoutUrl: res.checkout_url } });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally { setBusy(false); }
  }
```

3f. In the JSX, insert the requested passport selects right after the emergency-contact field block (after line 82, before the first-ultra toggle):
```tsx
        {requested.has("gender") && <PillSelect label="GENDER" value={gender} options={GENDERS} onChange={setGender} />}
        {requested.has("shirt_size") && <PillSelect label="SHIRT SIZE" value={shirtSize} options={SHIRT_SIZES} onChange={setShirtSize} />}
        {requested.has("blood_type") && <PillSelect label="BLOOD TYPE" value={bloodType} options={BLOOD_TYPES} onChange={setBloodType} />}
```

3g. Change the dynamic loop (line 88-90) to iterate `eventQuestions` instead of `fieldRows`:
```tsx
        {eventQuestions.map((f) => (
          <DynamicField key={f.id} field={f} value={values[f.key]} onChange={(v) => setValues((s) => ({ ...s, [f.key]: v }))} />
        ))}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/mobile && pnpm test -- register-submit`
Expected: PASS (2 tests). Then `npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/register/[categoryId].tsx" apps/mobile/__tests__/register-submit.test.tsx
git commit -m "feat(mobile): Register passport block + Model B suppression + snapshot"
```

---

### Task 6: Register save-back toggle

**Files:**
- Modify: `apps/mobile/app/register/[categoryId].tsx`
- Test: `apps/mobile/__tests__/register-saveback.test.tsx`

**Interfaces:**
- Consumes: Task 5 register state; `upsertProfile` (Task 2).
- Produces: a save-back toggle (`accessibilityLabel="Save details to profile"`, `accessibilityRole="switch"`, `accessibilityState.checked`) that, on submit when ON, calls `upsertProfile(passport)` before `startCheckout` and swallows errors.

**Rules (implement exactly):**
- `filledFromEmpty` = any passport field where the loaded profile value was empty and the current value is non-empty.
- `editedExisting` = any passport field where the loaded profile had a value and the current value differs and is non-empty.
- Toggle row visible iff `filledFromEmpty || editedExisting`. Default `checked = filledFromEmpty` until the user toggles it (then their choice sticks).
- On submit (after validation passes, before/at checkout): if checked, `await upsertProfile({ id, ...passport })` inside `try/catch` (log + continue on failure) — must **not** block `startCheckout`.

- [ ] **Step 1: Write the failing test** — `apps/mobile/__tests__/register-saveback.test.tsx`:

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";

const mockStartCheckout = jest.fn().mockResolvedValue({ registration_id: "r1", checkout_url: "http://x/dev/pay/r1" });
const mockUpsert = jest.fn().mockResolvedValue({});
let mockProfile: any = null;
jest.mock("expo-router", () => ({ useLocalSearchParams: () => ({ categoryId: "c3" }), useRouter: () => ({ replace: jest.fn(), back: jest.fn() }) }));
jest.mock("react-native-safe-area-context", () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }) }));
jest.mock("../lib/auth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } } }) }));
jest.mock("../lib/profile", () => ({ getProfile: () => Promise.resolve(mockProfile), upsertProfile: (...a: unknown[]) => mockUpsert(...a) }));
jest.mock("../lib/registration", () => ({ startCheckout: (...a: unknown[]) => mockStartCheckout(...a) }));
jest.mock("../lib/events", () => ({
  useCategory: () => ({ data: { id: "c3", event_id: "e1", label: "21K", base_price: 150000 }, isLoading: false }),
  useFormFields: () => ({ data: [], isLoading: false }),
  useAddons: () => ({ data: [], isLoading: false }),
}));

import Register from "../app/register/[categoryId]";

beforeEach(() => { mockUpsert.mockClear(); mockStartCheckout.mockClear(); });

async function fillCoreAndSubmit() {
  fireEvent.changeText(screen.getByLabelText("Bib name"), "JR");
  fireEvent.changeText(screen.getByLabelText("Emergency contact"), "Jane 0917");
  fireEvent.press(screen.getByLabelText("Accept waiver"));
  fireEvent.press(screen.getByText("Register"));
}

describe("Register save-back", () => {
  it("empty profile: toggle shows ON, and submit upserts the passport then checks out", async () => {
    mockProfile = null;
    render(<Register />);
    fireEvent.changeText(screen.getByLabelText("Bib name"), "JR");
    await waitFor(() => expect(screen.getByLabelText("Save details to profile")).toBeOnTheScreen());
    expect(screen.getByRole("switch", { name: "Save details to profile", checked: true })).toBeOnTheScreen();
    await fillCoreAndSubmit();
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalled());
    expect(mockUpsert).toHaveBeenCalled();
    expect(mockUpsert.mock.calls[0][0]).toMatchObject({ id: "u1", bib_name: "JR", emergency_contact: "Jane 0917" });
  });

  it("editing an existing value defaults the toggle OFF (no upsert unless turned on)", async () => {
    mockProfile = { id: "u1", bib_name: "JR", emergency_contact: "Old 0900" };
    render(<Register />);
    await waitFor(() => expect(screen.getByDisplayValue("Old 0900")).toBeOnTheScreen());
    fireEvent.changeText(screen.getByLabelText("Emergency contact"), "New 0917");   // edit existing
    expect(screen.getByRole("switch", { name: "Save details to profile", checked: false })).toBeOnTheScreen();
    fireEvent.press(screen.getByLabelText("Accept waiver"));
    fireEvent.press(screen.getByText("Register"));
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalled());
    expect(mockUpsert).not.toHaveBeenCalled();
  });

  it("save-back failure never blocks checkout", async () => {
    mockProfile = null;
    mockUpsert.mockRejectedValueOnce(new Error("network"));
    render(<Register />);
    await fillCoreAndSubmit();
    await waitFor(() => expect(mockStartCheckout).toHaveBeenCalled());  // still reaches checkout
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/mobile && pnpm test -- register-saveback`
Expected: FAIL — no "Save details to profile" switch.

- [ ] **Step 3: Implement** — edit `apps/mobile/app/register/[categoryId].tsx`:

3a. Track the loaded profile + toggle state. Add `Profile` to the profile import and new state (near line 29):
```tsx
import { getProfile, type Profile } from "../../lib/profile";
```
```tsx
  const [loadedProfile, setLoadedProfile] = useState<Profile | null>(null);
  const [saveBack, setSaveBack] = useState(false);
  const [saveBackTouched, setSaveBackTouched] = useState(false);
```

3b. In the prefill effect, capture the profile: add `setLoadedProfile(p);` inside the `if (p) { … }` block.

3c. Add the diff + default logic (after the `requested` derivation, ~step 5's 3d block):
```tsx
  const passportPairs: [keyof Profile, string][] = [
    ["bib_name", bibName], ["date_of_birth", dob], ["gender", gender],
    ["shirt_size", shirtSize], ["blood_type", bloodType], ["emergency_contact", emergency],
  ];
  const prof = (k: keyof Profile) => (loadedProfile?.[k] as string | null) ?? "";
  const filledFromEmpty = passportPairs.some(([k, v]) => !prof(k) && v.trim() !== "");
  const editedExisting = passportPairs.some(([k, v]) => prof(k) !== "" && v.trim() !== "" && v !== prof(k));
  const showSaveBack = filledFromEmpty || editedExisting;

  useEffect(() => { if (!saveBackTouched) setSaveBack(filledFromEmpty); }, [filledFromEmpty, saveBackTouched]);
```

3d. In `submit()`, after validation passes and `setBusy(true)`, before `startCheckout`:
```tsx
      if (saveBack && session?.user.id) {
        try {
          await upsertProfile({ id: session.user.id, bib_name: bibName, date_of_birth: dob || null, gender: gender || null, shirt_size: shirtSize || null, blood_type: bloodType || null, emergency_contact: emergency || null });
        } catch (e) { console.warn("profile save-back failed", e); }
      }
```
Add `upsertProfile` to the import: `import { getProfile, upsertProfile, type Profile } from "../../lib/profile";`

3e. Render the toggle just above the waiver row (before line 103's waiver `Pressable`):
```tsx
        {showSaveBack && (
          <Pressable style={styles.toggleRow} onPress={() => { setSaveBackTouched(true); setSaveBack((v) => !v); }}
            accessibilityRole="switch" accessibilityState={{ checked: saveBack }} accessibilityLabel="Save details to profile">
            <Text style={styles.toggleText}>Save these details to my profile?</Text>
            <View style={[styles.track, saveBack && styles.trackOn]}><View style={[styles.knob, saveBack && styles.knobOn]} /></View>
          </Pressable>
        )}
```
(Reuses existing `toggleRow`/`toggleText`/`track`/`trackOn`/`knob`/`knobOn` styles.)

- [ ] **Step 4: Run to verify it passes**

Run: `cd apps/mobile && pnpm test -- register-saveback`
Expected: PASS (3 tests). Then re-run `pnpm test -- register-submit` (still green), and `npx tsc --noEmit` → PASS.

- [ ] **Step 5: Commit**

```bash
git add "apps/mobile/app/register/[categoryId].tsx" apps/mobile/__tests__/register-saveback.test.tsx
git commit -m "feat(mobile): Register save-back toggle (snapshot + smart default)"
```

---

## Final verification (after all tasks)

- [ ] Full mobile suite: `cd apps/mobile && pnpm test` → all green.
- [ ] Shared/backend suite: `pnpm vitest run` (repo root) → all green (existing `registrations-checkout`, `customDataSchema` unaffected).
- [ ] Typecheck: `cd apps/mobile && npx tsc --noEmit` and `pnpm -r typecheck` → clean.
- [ ] Manual smoke (simulator, local stack up): register for **Bukidnon Highland 50** (no profile fields requested → passport shows bib/DOB/emergency only) and for **Apo Sky Ultra 2026** (`f1` blood_type + `f3` shirt_size → passport shows blood/shirt prefilled, Club still asked). Confirm save-back toggle appears, and a saved profile prefills the next registration.
- [ ] Then use **superpowers:finishing-a-development-branch**.

## Notes / decisions baked in

- No `supabase/functions/**` change: `registrations-checkout/index.ts:43` persists `input.custom_data` verbatim; `customDataSchema` is non-strict, so passport snapshot keys validate and store cleanly.
- Seed unchanged: `f1` (blood_type) / `f3` (shirt_size) remain form_fields — the client routes them to the passport block, so backend tests referencing those IDs stay green. Their `options` (`["A","O"]`) are intentionally **not** used for validation of profile-key fields.
- `first_ultra` and `waiver` remain per-race (never persisted).
