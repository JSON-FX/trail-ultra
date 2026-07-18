# App Foundation (iOS) — Implementation Plan (Plan 2 of 4)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold the Expo (React Native) runner app in `apps/mobile` and deliver the **sign-in-first → org-first** shell against the local Supabase backend from Plan 1 — auth, organization selection, a tab shell, and the global profile — so a runner can sign in, choose *Run With Point*, land on an (empty) Events tab, and edit a profile that persists.

**Architecture:** Expo Router (file-based) app running in **Expo Go**. A `supabase-js` client (AsyncStorage-backed session) feeds two React contexts — `AuthProvider` (session) and `OrgProvider` (selected org, persisted). The root layout gates routing: no session → auth stack; session but no org → Choose Organization; both → tabs. Everything is TypeScript, styled per `DESIGN.md`.

**Tech Stack:** Expo SDK + Expo Router, TypeScript, `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `react-native-url-polyfill`, jest-expo + `@testing-library/react-native`, `@trail-ultra/shared` (via monorepo Metro).

## Global Constraints

- **Runs in Expo Go** — every dependency must be Expo-Go-compatible (no custom native modules this plan).
- **Storage = AsyncStorage** for the Supabase session and the selected `org_id`. *(Deviation from spec §6, which named MMKV/secure-store: MMKV needs a dev client and secure-store has a 2 KB limit that breaks Supabase sessions. Revisit in Plan 4 for offline tickets.)*
- **Auth = email/password** for local dev (`enable_confirmations=false` locally, so sign-up signs the user straight in). *(Spec's Apple/Google/Facebook need cloud OAuth config → deferred to Plan 5. The Sign-In screen shows disabled social buttons as placeholders.)*
- **Sign-in-first, org-first:** no route renders app content without a session; no Events without a selected org.
- **Env, never hard-coded:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`. Simulator → `http://127.0.0.1:54521`; physical device → `http://<host>.lan:54521`.
- **Backend is Plan 1 running locally** (`supabase start` + `functions serve`). The seeded org is *Run With Point* (`run-with-point`).
- **Money display** uses `formatPeso` from `@trail-ultra/shared`.
- **App tests use jest-expo** (separate from the root Vitest, which owns `packages/**` + `supabase/**`).

## File Structure

```
apps/mobile/
├── app/
│   ├── _layout.tsx            root: providers + routing gate
│   ├── index.tsx             entry redirect (session/org aware)
│   ├── (auth)/
│   │   ├── _layout.tsx
│   │   ├── sign-in.tsx
│   │   └── sign-up.tsx
│   ├── choose-org.tsx        organization picker
│   └── (tabs)/
│       ├── _layout.tsx        bottom tab bar
│       ├── events.tsx         placeholder (Plan 3 fills it)
│       ├── races.tsx          placeholder (Plan 4 fills it)
│       └── profile.tsx        edit global profile
├── lib/
│   ├── supabase.ts           client + AsyncStorage session + AppState refresh
│   ├── auth.tsx              AuthProvider / useAuth
│   ├── org.tsx               OrgProvider / useOrg
│   └── theme.ts              tokens derived from DESIGN.md
├── __tests__/                jest tests
├── DESIGN.md                 getdesign `apple` output
├── metro.config.js           monorepo config
├── babel.config.js
├── app.json
├── tsconfig.json
├── jest.setup.ts
├── .env                      EXPO_PUBLIC_* (gitignored)
├── .env.example
└── package.json
```

---

### Task 1: Scaffold the Expo app in the monorepo

**Files:** Create `apps/mobile/*` (via `create-expo-app`), then `apps/mobile/metro.config.js`, `apps/mobile/tsconfig.json`.

- [ ] **Step 1: Create the app** (from repo root)

```bash
pnpm create expo-app apps/mobile --template blank-typescript --no-install
```
Expected: an Expo TypeScript app under `apps/mobile`.

- [ ] **Step 2: Adopt Expo Router + required libs**

Edit `apps/mobile/package.json` `dependencies` to include (versions resolved by `expo install` next):
```json
"expo-router": "*",
"react-native-safe-area-context": "*",
"react-native-screens": "*",
"expo-linking": "*",
"expo-constants": "*",
"@supabase/supabase-js": "^2.110.7",
"@react-native-async-storage/async-storage": "*",
"react-native-url-polyfill": "*",
"@trail-ultra/shared": "workspace:*"
```
Then from repo root:
```bash
cd apps/mobile && pnpm install && npx expo install --fix && cd ../..
```
Set the entry + scheme in `apps/mobile/package.json` / `app.json`: `"main": "expo-router/entry"`, and in `app.json` add `"scheme": "trailultra"` and `"plugins": ["expo-router"]`.

- [ ] **Step 3: Monorepo Metro config**

Create `apps/mobile/metro.config.js`:
```js
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);

config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
```

- [ ] **Step 4: tsconfig extends the base**

Replace `apps/mobile/tsconfig.json`:
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "paths": { "@/*": ["./*"] }
  },
  "include": ["**/*.ts", "**/*.tsx", ".expo/types/**/*.ts", "expo-env.d.ts"]
}
```

- [ ] **Step 5: Verify it bundles**

```bash
cd apps/mobile && npx expo export --platform ios --output-dir /tmp/mobile-export >/dev/null 2>&1 && echo "bundles OK" ; cd ../..
```
Expected: `bundles OK` (a clean Metro bundle proves the scaffold + Metro config resolve).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile package.json pnpm-lock.yaml
git commit -m "feat(mobile): scaffold Expo Router app in the monorepo"
```

---

### Task 2: jest-expo test harness

**Files:** Modify `apps/mobile/package.json`; Create `apps/mobile/jest.setup.ts`, `apps/mobile/__tests__/smoke.test.tsx`.

- [ ] **Step 1: Add test deps** (from `apps/mobile`)

```bash
cd apps/mobile
pnpm add -D jest jest-expo @testing-library/react-native react-test-renderer @types/jest
cd ../..
```

- [ ] **Step 2: Configure jest** — add to `apps/mobile/package.json`:
```json
"scripts": { "test": "jest" },
"jest": {
  "preset": "jest-expo",
  "setupFilesAfterEnv": ["<rootDir>/jest.setup.ts"],
  "transformIgnorePatterns": [
    "node_modules/(?!(?:.pnpm/)?((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@supabase/.*|@trail-ultra/.*))"
  ]
}
```

- [ ] **Step 3: Jest setup**

Create `apps/mobile/jest.setup.ts`:
```ts
import "@testing-library/react-native/extend-expect";
```

- [ ] **Step 4: Failing smoke test**

Create `apps/mobile/__tests__/smoke.test.tsx`:
```tsx
import { render } from "@testing-library/react-native";
import { Text } from "react-native";

describe("harness", () => {
  it("renders", () => {
    const { getByText } = render(<Text>hello trail-ultra</Text>);
    expect(getByText("hello trail-ultra")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 5: Run — expect PASS**

```bash
cd apps/mobile && pnpm test 2>&1 | tail -8 ; cd ../..
```
Expected: 1 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile
git commit -m "test(mobile): add jest-expo + testing-library harness"
```

---

### Task 3: Supabase client + env

**Files:** Create `apps/mobile/lib/supabase.ts`, `apps/mobile/.env`, `apps/mobile/.env.example`, `apps/mobile/__tests__/supabase.test.ts`.

**Interfaces:** Produces `supabase` (a configured `SupabaseClient`).

- [ ] **Step 1: Env files**

Create `apps/mobile/.env.example`:
```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54521
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-local-anon-key
```
Create `apps/mobile/.env` with the real local values (copy `ANON_KEY` from repo-root `.env.local`):
```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54521
EXPO_PUBLIC_SUPABASE_ANON_KEY=<paste ANON_KEY from .env.local>
```
(`.env` is already git-ignored by the root rule; `.env.example` is committed.)

- [ ] **Step 2: Client**

Create `apps/mobile/lib/supabase.ts`:
```ts
import "react-native-url-polyfill/auto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppState } from "react-native";
import { createClient } from "@supabase/supabase-js";

const url = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh tokens only while the app is foregrounded.
AppState.addEventListener("change", (state) => {
  if (state === "active") supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});
```

- [ ] **Step 3: Failing test**

Create `apps/mobile/__tests__/supabase.test.ts`:
```ts
import { supabase } from "../lib/supabase";

describe("supabase client", () => {
  it("is configured with auth + from()", () => {
    expect(typeof supabase.auth.getSession).toBe("function");
    expect(typeof supabase.from).toBe("function");
  });
});
```
Set the env for jest by adding to `apps/mobile/jest.setup.ts`:
```ts
process.env.EXPO_PUBLIC_SUPABASE_URL ||= "http://127.0.0.1:54521";
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||= "test-anon-key";
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/mobile && pnpm test supabase 2>&1 | tail -8 ; cd ../..
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): supabase client with AsyncStorage session"
```

---

### Task 4: Auth context

**Files:** Create `apps/mobile/lib/auth.tsx`, `apps/mobile/__tests__/auth.test.tsx`.

**Interfaces:** Produces `AuthProvider` and `useAuth(): { session, loading, signIn, signUp, signOut }`.

- [ ] **Step 1: Provider**

Create `apps/mobile/lib/auth.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthValue = {
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn: AuthValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { error: error.message } : {};
  };
  const signUp: AuthValue["signUp"] = async (email, password) => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? { error: error.message } : {};
  };
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <AuthContext.Provider value={{ session, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
```

- [ ] **Step 2: Failing test** (mock supabase)

Create `apps/mobile/__tests__/auth.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";
import { AuthProvider, useAuth } from "../lib/auth";

jest.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    },
  },
}));

function Probe() {
  const { loading, session } = useAuth();
  return <Text>{loading ? "loading" : session ? "in" : "out"}</Text>;
}

describe("AuthProvider", () => {
  it("resolves to signed-out when there is no session", async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText("out")).toBeOnTheScreen());
  });
});
```

- [ ] **Step 3: Run — expect PASS**

```bash
cd apps/mobile && pnpm test auth 2>&1 | tail -8 ; cd ../..
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): auth context (session + email sign in/up/out)"
```

---

### Task 5: Root layout, routing gate, and auth screens

**Files:** Create `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`, `apps/mobile/app/(auth)/_layout.tsx`, `apps/mobile/app/(auth)/sign-in.tsx`, `apps/mobile/app/(auth)/sign-up.tsx`; Create `apps/mobile/__tests__/sign-in.test.tsx`. (Depends on Task 6's `OrgProvider`; create a minimal stub now, replaced in Task 6.)

**Interfaces:** Consumes `useAuth`, `useOrg`. Produces the gated route tree.

- [ ] **Step 1: Temporary org stub** (replaced in Task 6)

Create `apps/mobile/lib/org.tsx`:
```tsx
import { createContext, useContext, useState, type ReactNode } from "react";
type OrgValue = { selectedOrgId: string | null; loading: boolean; selectOrg: (id: string) => Promise<void>; clearOrg: () => Promise<void> };
const OrgContext = createContext<OrgValue | undefined>(undefined);
export function OrgProvider({ children }: { children: ReactNode }) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  return <OrgContext.Provider value={{ selectedOrgId, loading: false, selectOrg: async (id) => setSelectedOrgId(id), clearOrg: async () => setSelectedOrgId(null) }}>{children}</OrgContext.Provider>;
}
export function useOrg(): OrgValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
```

- [ ] **Step 2: Root layout with providers**

Create `apps/mobile/app/_layout.tsx`:
```tsx
import { Stack } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../lib/auth";
import { OrgProvider } from "../lib/org";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OrgProvider>
          <Stack screenOptions={{ headerShown: false }} />
        </OrgProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
```

- [ ] **Step 3: Entry redirect gate**

Create `apps/mobile/app/index.tsx`:
```tsx
import { Redirect } from "expo-router";
import { ActivityIndicator, View } from "react-native";
import { useAuth } from "../lib/auth";
import { useOrg } from "../lib/org";

export default function Index() {
  const { session, loading: authLoading } = useAuth();
  const { selectedOrgId, loading: orgLoading } = useOrg();

  if (authLoading || orgLoading) {
    return <View style={{ flex: 1, justifyContent: "center" }}><ActivityIndicator /></View>;
  }
  if (!session) return <Redirect href="/(auth)/sign-in" />;
  if (!selectedOrgId) return <Redirect href="/choose-org" />;
  return <Redirect href="/(tabs)/events" />;
}
```

- [ ] **Step 4: Auth stack + Sign In**

Create `apps/mobile/app/(auth)/_layout.tsx`:
```tsx
import { Stack } from "expo-router";
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
```

Create `apps/mobile/app/(auth)/sign-in.tsx`:
```tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";

export default function SignIn() {
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true); setError(null);
    const { error } = await signIn(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
    else router.replace("/");
  }

  return (
    <View style={styles.c}>
      <Text style={styles.h}>Sign in</Text>
      <TextInput style={styles.i} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} accessibilityLabel="Email" />
      <TextInput style={styles.i} placeholder="Password" secureTextEntry value={password} onChangeText={setPassword} accessibilityLabel="Password" />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable style={styles.btn} onPress={onSubmit} disabled={busy} accessibilityRole="button">
        <Text style={styles.btnT}>{busy ? "Signing in…" : "Sign in"}</Text>
      </Pressable>
      <Text style={styles.social}>Apple · Google · Facebook — coming soon</Text>
      <Link href="/(auth)/sign-up" style={styles.link}>Create an account</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  h: { fontSize: 28, fontWeight: "600", marginBottom: 8 },
  i: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 14, fontSize: 16 },
  btn: { backgroundColor: "#1F6248", borderRadius: 10, padding: 15, alignItems: "center", marginTop: 4 },
  btnT: { color: "#fff", fontWeight: "600", fontSize: 16 },
  err: { color: "#C1492C" },
  social: { color: "#8A968C", textAlign: "center", marginTop: 8, fontSize: 12 },
  link: { color: "#1F6248", textAlign: "center", marginTop: 8 },
});
```

Create `apps/mobile/app/(auth)/sign-up.tsx` (same shape, `signUp`):
```tsx
import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import { Link, useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";

export default function SignUp() {
  const { signUp } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    setBusy(true); setError(null);
    const { error } = await signUp(email.trim(), password);
    setBusy(false);
    if (error) setError(error);
    else router.replace("/");
  }

  return (
    <View style={styles.c}>
      <Text style={styles.h}>Create account</Text>
      <TextInput style={styles.i} placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} accessibilityLabel="Email" />
      <TextInput style={styles.i} placeholder="Password (min 6)" secureTextEntry value={password} onChangeText={setPassword} accessibilityLabel="Password" />
      {error ? <Text style={styles.err}>{error}</Text> : null}
      <Pressable style={styles.btn} onPress={onSubmit} disabled={busy} accessibilityRole="button">
        <Text style={styles.btnT}>{busy ? "Creating…" : "Create account"}</Text>
      </Pressable>
      <Link href="/(auth)/sign-in" style={styles.link}>I already have an account</Link>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, justifyContent: "center", padding: 24, gap: 12 },
  h: { fontSize: 28, fontWeight: "600", marginBottom: 8 },
  i: { borderWidth: 1, borderColor: "#ccc", borderRadius: 10, padding: 14, fontSize: 16 },
  btn: { backgroundColor: "#1F6248", borderRadius: 10, padding: 15, alignItems: "center", marginTop: 4 },
  btnT: { color: "#fff", fontWeight: "600", fontSize: 16 },
  err: { color: "#C1492C" },
  link: { color: "#1F6248", textAlign: "center", marginTop: 8 },
});
```

- [ ] **Step 5: Failing test — Sign In renders + validates**

Create `apps/mobile/__tests__/sign-in.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import SignIn from "../app/(auth)/sign-in";

const signIn = jest.fn().mockResolvedValue({ error: "Invalid login credentials" });
jest.mock("../lib/auth", () => ({ useAuth: () => ({ signIn }) }));
jest.mock("expo-router", () => ({
  useRouter: () => ({ replace: jest.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => children,
}));

describe("SignIn", () => {
  it("shows the error returned by signIn", async () => {
    render(<SignIn />);
    fireEvent.changeText(screen.getByLabelText("Email"), "jr@test.dev");
    fireEvent.changeText(screen.getByLabelText("Password"), "wrong");
    fireEvent.press(screen.getByRole("button"));
    await waitFor(() => expect(screen.getByText("Invalid login credentials")).toBeOnTheScreen());
  });
});
```

- [ ] **Step 6: Run — expect PASS**

```bash
cd apps/mobile && pnpm test sign-in 2>&1 | tail -8 ; cd ../..
```
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): routing gate + email auth screens"
```

---

### Task 6: Organization context + Choose Organization screen

**Files:** Replace `apps/mobile/lib/org.tsx`; Create `apps/mobile/app/choose-org.tsx`, `apps/mobile/__tests__/choose-org.test.tsx`.

**Interfaces:** Produces `useOrg(): { selectedOrgId, loading, orgs, selectOrg, clearOrg }`; persists `selectedOrgId` to AsyncStorage key `selected_org_id`.

- [ ] **Step 1: Real org provider**

Replace `apps/mobile/lib/org.tsx`:
```tsx
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";

const KEY = "selected_org_id";
export type Org = { id: string; name: string; slug: string; brand_color: string | null };

type OrgValue = {
  selectedOrgId: string | null;
  orgs: Org[];
  loading: boolean;
  refreshOrgs: () => Promise<void>;
  selectOrg: (id: string) => Promise<void>;
  clearOrg: () => Promise<void>;
};

const OrgContext = createContext<OrgValue | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((v) => {
      setSelectedOrgId(v);
      setLoading(false);
    });
  }, []);

  const refreshOrgs = async () => {
    const { data } = await supabase.from("organizations").select("id,name,slug,brand_color").order("name");
    setOrgs((data ?? []) as Org[]);
  };
  const selectOrg = async (id: string) => { await AsyncStorage.setItem(KEY, id); setSelectedOrgId(id); };
  const clearOrg = async () => { await AsyncStorage.removeItem(KEY); setSelectedOrgId(null); };

  return (
    <OrgContext.Provider value={{ selectedOrgId, orgs, loading, refreshOrgs, selectOrg, clearOrg }}>
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg(): OrgValue {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within OrgProvider");
  return ctx;
}
```

- [ ] **Step 2: Choose Organization screen**

Create `apps/mobile/app/choose-org.tsx`:
```tsx
import { useEffect } from "react";
import { View, Text, FlatList, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useOrg } from "../lib/org";

export default function ChooseOrg() {
  const { orgs, refreshOrgs, selectOrg } = useOrg();
  const router = useRouter();

  useEffect(() => { refreshOrgs(); }, []);

  async function pick(id: string) {
    await selectOrg(id);
    router.replace("/(tabs)/events");
  }

  return (
    <View style={styles.c}>
      <Text style={styles.h}>Choose an organization</Text>
      <FlatList
        data={orgs}
        keyExtractor={(o) => o.id}
        ListEmptyComponent={<Text style={styles.empty}>No organizations yet.</Text>}
        renderItem={({ item }) => (
          <Pressable style={[styles.card, { borderLeftColor: item.brand_color ?? "#1F6248" }]} onPress={() => pick(item.id)} accessibilityRole="button">
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.slug}>{item.slug}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, padding: 20, paddingTop: 72 },
  h: { fontSize: 24, fontWeight: "600", marginBottom: 16 },
  card: { borderWidth: 1, borderColor: "#E2DCCC", borderLeftWidth: 5, borderRadius: 12, padding: 16, marginBottom: 12 },
  name: { fontSize: 18, fontWeight: "600" },
  slug: { color: "#8A968C", marginTop: 2, fontFamily: "Courier" },
  empty: { color: "#8A968C" },
});
```

- [ ] **Step 3: Failing test — picking an org persists + navigates**

Create `apps/mobile/__tests__/choose-org.test.tsx`:
```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react-native";
import ChooseOrg from "../app/choose-org";

const selectOrg = jest.fn().mockResolvedValue(undefined);
const replace = jest.fn();
jest.mock("../lib/org", () => ({
  useOrg: () => ({
    orgs: [{ id: "org-1", name: "Run With Point", slug: "run-with-point", brand_color: "#1F6248" }],
    refreshOrgs: jest.fn(),
    selectOrg,
  }),
}));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace }) }));

describe("ChooseOrg", () => {
  it("selects an org and routes to events", async () => {
    render(<ChooseOrg />);
    fireEvent.press(screen.getByText("Run With Point"));
    await waitFor(() => expect(selectOrg).toHaveBeenCalledWith("org-1"));
    expect(replace).toHaveBeenCalledWith("/(tabs)/events");
  });
});
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/mobile && pnpm test choose-org 2>&1 | tail -8 ; cd ../..
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): org context + Choose Organization screen"
```

---

### Task 7: Tab shell (Events / My Races / Profile placeholders)

**Files:** Create `apps/mobile/app/(tabs)/_layout.tsx`, `apps/mobile/app/(tabs)/events.tsx`, `apps/mobile/app/(tabs)/races.tsx`, `apps/mobile/app/(tabs)/profile.tsx` (placeholder replaced in Task 8); Create `apps/mobile/__tests__/events.test.tsx`.

- [ ] **Step 1: Tab layout**

Create `apps/mobile/app/(tabs)/_layout.tsx`:
```tsx
import { Tabs } from "expo-router";
export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ tabBarActiveTintColor: "#1F6248" }}>
      <Tabs.Screen name="events" options={{ title: "Events" }} />
      <Tabs.Screen name="races" options={{ title: "My Races" }} />
      <Tabs.Screen name="profile" options={{ title: "Profile" }} />
    </Tabs>
  );
}
```

- [ ] **Step 2: Placeholder screens**

Create `apps/mobile/app/(tabs)/events.tsx`:
```tsx
import { View, Text, StyleSheet } from "react-native";
export default function Events() {
  return (
    <View style={styles.c}>
      <Text style={styles.h}>Events</Text>
      <Text style={styles.sub}>Browsing arrives in Plan 3.</Text>
    </View>
  );
}
const styles = StyleSheet.create({ c: { flex: 1, justifyContent: "center", alignItems: "center", gap: 6 }, h: { fontSize: 22, fontWeight: "600" }, sub: { color: "#8A968C" } });
```

Create `apps/mobile/app/(tabs)/races.tsx` (same shape, title "My Races", "Tickets arrive in Plan 4.").

- [ ] **Step 3: Failing test — Events renders**

Create `apps/mobile/__tests__/events.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react-native";
import Events from "../app/(tabs)/events";

describe("Events tab", () => {
  it("renders the placeholder", () => {
    render(<Events />);
    expect(screen.getByText("Events")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/mobile && pnpm test events 2>&1 | tail -8 ; cd ../..
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): tab shell with Events/My Races/Profile"
```

---

### Task 8: Profile screen (global profile)

**Files:** Replace `apps/mobile/app/(tabs)/profile.tsx`; Create `apps/mobile/lib/profile.ts`, `apps/mobile/__tests__/profile.test.tsx`.

**Interfaces:** Produces `getProfile(userId)` / `upsertProfile(row)`; the Profile screen reads/writes `profiles` and offers Switch org + Sign out.

- [ ] **Step 1: Profile data helpers**

Create `apps/mobile/lib/profile.ts`:
```ts
import { supabase } from "./supabase";

export type Profile = {
  id: string;
  full_name: string | null;
  bib_name: string | null;
  city: string | null;
};

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data } = await supabase.from("profiles").select("id,full_name,bib_name,city").eq("id", userId).maybeSingle();
  return data as Profile | null;
}

export async function upsertProfile(row: Profile): Promise<{ error?: string }> {
  const { error } = await supabase.from("profiles").upsert(row);
  return error ? { error: error.message } : {};
}
```

- [ ] **Step 2: Profile screen**

Replace `apps/mobile/app/(tabs)/profile.tsx`:
```tsx
import { useEffect, useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../lib/auth";
import { useOrg } from "../../lib/org";
import { getProfile, upsertProfile } from "../../lib/profile";

export default function Profile() {
  const { session, signOut } = useAuth();
  const { clearOrg } = useOrg();
  const router = useRouter();
  const uid = session?.user.id;
  const [fullName, setFullName] = useState("");
  const [bibName, setBibName] = useState("");
  const [city, setCity] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!uid) return;
    getProfile(uid).then((p) => {
      if (p) { setFullName(p.full_name ?? ""); setBibName(p.bib_name ?? ""); setCity(p.city ?? ""); }
    });
  }, [uid]);

  async function save() {
    if (!uid) return;
    setBusy(true);
    const { error } = await upsertProfile({ id: uid, full_name: fullName, bib_name: bibName, city });
    setBusy(false);
    Alert.alert(error ? "Save failed" : "Saved", error ?? "Your profile was updated.");
  }

  async function switchOrg() { await clearOrg(); router.replace("/choose-org"); }
  async function doSignOut() { await signOut(); router.replace("/(auth)/sign-in"); }

  return (
    <View style={styles.c}>
      <Text style={styles.h}>Profile</Text>
      <TextInput style={styles.i} placeholder="Full name" value={fullName} onChangeText={setFullName} accessibilityLabel="Full name" />
      <TextInput style={styles.i} placeholder="Bib name" value={bibName} onChangeText={setBibName} accessibilityLabel="Bib name" />
      <TextInput style={styles.i} placeholder="City" value={city} onChangeText={setCity} accessibilityLabel="City" />
      <Pressable style={styles.btn} onPress={save} disabled={busy} accessibilityRole="button"><Text style={styles.btnT}>{busy ? "Saving…" : "Save"}</Text></Pressable>
      <Pressable onPress={switchOrg} accessibilityRole="button"><Text style={styles.link}>Switch organization</Text></Pressable>
      <Pressable onPress={doSignOut} accessibilityRole="button"><Text style={styles.signout}>Sign out</Text></Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, padding: 20, paddingTop: 60, gap: 12 },
  h: { fontSize: 24, fontWeight: "600", marginBottom: 8 },
  i: { borderWidth: 1, borderColor: "#E2DCCC", borderRadius: 10, padding: 14, fontSize: 16 },
  btn: { backgroundColor: "#1F6248", borderRadius: 10, padding: 15, alignItems: "center" },
  btnT: { color: "#fff", fontWeight: "600", fontSize: 16 },
  link: { color: "#1F6248", textAlign: "center", marginTop: 8 },
  signout: { color: "#C1492C", textAlign: "center", marginTop: 4 },
});
```

- [ ] **Step 3: Failing test — profile loads existing values**

Create `apps/mobile/__tests__/profile.test.tsx`:
```tsx
import { render, screen, waitFor } from "@testing-library/react-native";
import Profile from "../app/(tabs)/profile";

jest.mock("../lib/auth", () => ({ useAuth: () => ({ session: { user: { id: "u1" } }, signOut: jest.fn() }) }));
jest.mock("../lib/org", () => ({ useOrg: () => ({ clearOrg: jest.fn() }) }));
jest.mock("expo-router", () => ({ useRouter: () => ({ replace: jest.fn() }) }));
jest.mock("../lib/profile", () => ({
  getProfile: jest.fn().mockResolvedValue({ id: "u1", full_name: "JR Dela Cruz", bib_name: "JR", city: "Davao" }),
  upsertProfile: jest.fn(),
}));

describe("Profile", () => {
  it("loads existing profile values", async () => {
    render(<Profile />);
    await waitFor(() => expect(screen.getByDisplayValue("JR Dela Cruz")).toBeOnTheScreen());
    expect(screen.getByDisplayValue("Davao")).toBeOnTheScreen();
  });
});
```

- [ ] **Step 4: Run — expect PASS**

```bash
cd apps/mobile && pnpm test profile 2>&1 | tail -8 ; cd ../..
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): profile screen (read/write global profile)"
```

---

### Task 9: DESIGN.md, theme, and end-to-end verification

**Files:** Create `apps/mobile/DESIGN.md` (via getdesign), `apps/mobile/lib/theme.ts`.

- [ ] **Step 1: Generate the design language**

```bash
cd apps/mobile && npx getdesign@latest add apple && cd ../..
```
Expected: `apps/mobile/DESIGN.md` written. Commit it; Claude reads it before future UI work.

- [ ] **Step 2: Minimal shared tokens** (mirror `DESIGN.md` accent so screens stop hard-coding hex)

Create `apps/mobile/lib/theme.ts`:
```ts
// Base tokens; refine to match DESIGN.md.
export const theme = {
  pine: "#1F6248",
  ink: "#1C2A22",
  inkSoft: "#8A968C",
  line: "#E2DCCC",
  stop: "#C1492C",
  paper: "#FBF8F0",
};
```

- [ ] **Step 3: Full app run (manual acceptance)**

Ensure Plan 1's backend is up (`supabase start` + `functions serve`). Then:
```bash
cd apps/mobile && npx expo start
```
On the iOS simulator (press `i`), verify the acceptance flow:
1. App opens on **Sign in** (no session).
2. Create an account (email + password ≥ 6) → lands on **Choose Organization**.
3. Pick **Run With Point** → lands on the **Events** tab (placeholder).
4. Go to **Profile**, enter a name/city, **Save**, force-quit and reopen → still signed in, same org, saved values load.
5. **Switch organization** returns to the picker; **Sign out** returns to Sign in.

- [ ] **Step 4: Full test suite green**

```bash
cd apps/mobile && pnpm test 2>&1 | tail -8 ; cd ../..
```
Expected: all jest tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): DESIGN.md + theme tokens; foundation verified end-to-end"
```

---

## Self-Review

**Spec coverage** (against `01-mobile-ios-mvp.md` §4, §5, §9 — the foundation subset):
- Sign-in-first auth (email; social deferred) → Tasks 4–5. ✓
- Choose/switch organization, persisted → Tasks 6, 8. ✓
- Tab shell (Events / My Races / Profile) → Task 7. ✓
- Global profile read/write → Task 8. ✓
- Supabase client + session + realtime-ready → Task 3. ✓
- getdesign `DESIGN.md` → Task 9. ✓
- **Deferred (documented):** event browsing (Plan 3), tickets/offline (Plan 4), social login + MMKV/secure-store + push (Plan 5 / dev client).

**Placeholder scan:** Every step has real code/commands and expected output. The `(tabs)` Events/Races screens are intentionally placeholder *screens* (their content is Plan 3/4), not plan placeholders.

**Type consistency:** `useAuth`, `useOrg`, `Org`, `getProfile`/`upsertProfile`, `Profile`, `supabase`, route hrefs (`/(auth)/sign-in`, `/choose-org`, `/(tabs)/events`) match across tasks. The Task 5 `OrgProvider` stub is explicitly replaced by Task 6's real one with the same `useOrg` shape (superset).

---

## Execution Handoff

Plan 2 of 4. Requires Plan 1's backend running locally (`supabase start` + `functions serve`). On completion, Plan 3 (browse & register) fills the Events tab and adds the dynamic registration form against the same backend.
