# Mobile UI migration to React Native Reusables — design

- **Product:** Race Pace — mobile runner app (iOS + Android), `apps/mobile`
- **Status:** Draft v0.1 (approved to plan)
- **Last updated:** 2026-07-22
- **Owner:** Product (jayson@voltcontent.com)
- **Related:** [01 · Mobile (iOS) MVP](./../01-mobile-ios-mvp.md) · [ADR-0001 · Tech stack](./../adr/0001-cross-platform-tech-stack.md) · mobile `DESIGN.md`, `lib/theme.ts`

---

## 1. Summary

Migrate the `apps/mobile` UI from hand-rolled `StyleSheet` components to a real
component library — **[React Native Reusables (RNR)](https://reactnativereusables.com)**,
the shadcn/ui-style copy-in library for React Native — driven by **NativeWind**. We
re-create the entire runner UI (14 routes, 12 components) on RNR primitives while keeping
the Race Pace brand (trail-green `#159A55`, getdesign `apple` structure) and **adding full
light + dark theming**.

The app already works and has **49 passing tests** across the auth, register, pay, ticket,
and PSGC flows. The migration is **incremental and test-guarded**: the app stays runnable
and the suite stays green at every step. The register → pay → ticket "money path" is
migrated last and most carefully.

RNR is a **copy-in** library (components live in our repo under `components/ui/`, added via
its CLI), not a runtime dependency we're locked to — so we own every component after it
lands.

## 2. Goals & non-goals

### 2.1 Goals
- Replace `StyleSheet`/inline styling with **NativeWind** (Tailwind classes) and **RNR
  primitives** as the component foundation for iOS **and** Android.
- Preserve the Race Pace visual language: trail-green `#159A55` accent, pill CTAs, hairline
  surfaces, getdesign `apple` structure.
- Add **light + dark** theming: define both palettes the RNR way (semantic CSS-variable
  tokens) and make all screens correct in both schemes.
- Keep the app **runnable** and the **49 tests green** throughout; no regressions in the
  money path.
- Adopt RNR conventions so future components are `npx …/cli add <name>` away.

### 2.2 Non-goals (this spec)
- No new product features, screens, or flow changes — this is a **UI/styling migration**.
- No backend, data-layer, `@race-pace/shared`, or Supabase changes.
- No custom font program (SF Pro → Inter). System fonts stay; Inter is optional later.
- No Uniwind (we chose NativeWind). No admin-web (`apps/web`) changes.

### 2.3 Success criteria
- Every route and component renders on RNR primitives, brand-correct, in **both light and
  dark**.
- `npm test` (49 tests) passes; iOS simulator smoke passes; one Android smoke passes.
- `lib/theme.ts` is deleted; nothing imports it. `DESIGN.md` regenerated to the real palette.

## 3. Decisions locked (from brainstorming)

| Decision | Choice | Why |
| --- | --- | --- |
| Styling engine | **NativeWind** (not Uniwind) | Mature, RNR's default, largest community/docs, safest jest path for a solo dev |
| Theming scope | **Light + dark** | Requested; RNR ships both by default |
| Migration strategy | **Foundation-first, incremental, tests-green** | Protects the money path and the test suite; never a broken app |
| Money path | Migrated **last**, most carefully | Highest-risk surface (register/pay/ticket) |
| Dark palette | **Derived here** as canonical, tuned in QA | No prior dark spec exists |

## 4. Current state (what we're migrating)

- **Stack:** Expo SDK 57 (RN 0.86, React 19.2), Expo Router. `AGENTS.md` warns SDK 57 is new
  — read the versioned Expo docs before writing code.
- **Styling today:** `StyleSheet.create` + inline, every value read from a central
  `lib/theme.ts` token object. **No NativeWind/Tailwind present.**
- **Surface:** 14 routes (`app/`), 12 components (`components/`), ~2,100 LOC + 49 tests (27
  files).
- **Design docs:** `DESIGN.md` is **stale** — it still names Action Blue `#0066cc` as
  primary; the real primary is trail-green `#159A55` (`theme.ts` + design memory). We fix
  this in cleanup.

### 4.1 Compatibility findings (de-risking)
- Expo SDK 57 = RN 0.86 + React 19.2, **explicitly non-breaking** over SDK 56 / 0.85 →
  NativeWind's standard Expo setup applies.
- **Two risks, both handled by sequencing:**
  1. SDK 57 is new enough that NativeWind on RN 0.86 isn't *explicitly* certified →
     **Phase 0 spike gates the migration.**
  2. Known [jest-expo peer-dep wrinkle on SDK 57](https://github.com/expo/expo/issues/47435);
     this repo already fought jest-expo once (commit `4b7501c`) → **the spike proves tests
     stay green before any screen is touched.**

## 5. Architecture & foundation

### 5.1 Phase 0 — spike (gate)
Before any screen work: install NativeWind + `lucide-react-native`, wire
babel/metro/`global.css`/`tailwind.config`, add one RNR `Button`, and confirm **both**:
(a) it renders on the iOS simulator, and (b) `npm test` stays green. If either fails, stop
and resolve before continuing. Pin exact NativeWind / Tailwind / reanimated versions here.

### 5.2 Tooling setup (Phase 1)
- **NativeWind v4** (Tailwind `3.4.x`). `react-native-reanimated` and
  `react-native-safe-area-context` (already present) are peers.
- `babel.config.js`: `babel-preset-expo` with `jsxImportSource: "nativewind"` +
  `"nativewind/babel"` preset.
- `metro.config.js`: wrap Expo's config with `withNativeWind({ input: "./global.css" })`.
- `global.css`: Tailwind directives + `:root` (light) and `.dark` (dark) token blocks.
- `tailwind.config.js`: `presets: [require("nativewind/preset")]`, `darkMode: "class"`,
  colors mapped to the CSS variables (§6), content globs for `app/**` + `components/**`.
- `nativewind-env.d.ts` for `className` typing.

### 5.3 RNR conventions adopted
- Components live in **`components/ui/*`**, added via `npx @react-native-reusables/cli@latest
  add <name>`. Imported via the **`@/` alias** → project root (add to `tsconfig.json`
  `paths` + `babel-plugin-module-resolver` or Expo's built-in alias support).
- **`cn()`** helper (`clsx` + `tailwind-merge`) in `lib/utils.ts`.
- **`<PortalHost/>`** mounted once in `app/_layout.tsx` — **required** for `select`,
  `dialog`, `alert-dialog`, `popover`, `dropdown-menu`, `context-menu`, `tooltip` on native.
- **Icons:** Lucide via RNR's `<Icon as={SomeIcon} />` (`components/ui/icon` +
  `lucide-react-native`), replacing today's emoji glyphs (`⌕`, notification bell, chevrons).
- **React Navigation theme:** provide a `NAV_THEME` (light/dark) so Expo Router's
  navigator, headers, and the bottom tab bar pick up brand colors, matching RNR's template.

### 5.4 Testing
- Keep the **`jest-expo`** preset. Extend the babel/jest config so NativeWind's transform
  runs under tests (NativeWind compiles via `babel-preset-expo`, which `jest-expo` already
  uses). Watch the SDK-57 `jest-preset` peer wrinkle flagged in §4.1.
- Component render tests that only restyle should **not** change; behavior tests (hooks,
  checkout, cache) are styling-agnostic and must stay green untouched.

### 5.5 Fonts
System fonts for MVP: SF Pro on iOS, Roboto on Android. DESIGN.md's SF Pro → **Inter**
substitution is deferred (optional later polish), out of scope here.

## 6. Theming — light + dark

`lib/theme.ts` values become CSS variables in `global.css`, mapped onto RNR's semantic
token model (`:root` = light, `.dark` = dark), **plus extra brand vars** for the status
language RNR doesn't model. The exact var format (hex vs HSL channels) matches RNR's current
`init` template, settled in Phase 1; values below are canonical regardless of format.

### 6.1 Semantic tokens

| RNR token | Light | Dark (derived — tune in QA) | Source |
| --- | --- | --- | --- |
| `--primary` | `#159A55` | `#2FB56A` | trail-green; lightened on dark for AA |
| `--primary-foreground` | `#FFFFFF` | `#06120B` | |
| `--background` | `#FFFFFF` | `#0B0F0D` | forest-tinted near-black |
| `--foreground` | `#1D1D1F` | `#F5F5F7` | |
| `--card` / `--card-foreground` | `#FFFFFF` / `#1D1D1F` | `#141916` / `#F5F5F7` | |
| `--popover` / `--popover-foreground` | `#FFFFFF` / `#1D1D1F` | `#141916` / `#F5F5F7` | |
| `--muted` / `--muted-foreground` | `#F5F5F7` / `#7A7A7A` | `#1B211D` / `#A1A1A6` | parchment |
| `--secondary` / `--secondary-foreground` | `#EAF3EE` / `#0F7A42` | `#13251C` / `#7FE0A6` | green tint |
| `--accent` / `--accent-foreground` | `#EAF3EE` / `#0F7A42` | `#13251C` / `#7FE0A6` | |
| `--border` / `--input` | `#E0E0E0` | `#262B28` | hairline |
| `--ring` | `#159A55` | `#2FB56A` | focus |
| `--destructive` | `#FF3B30` | `#FF453A` | |
| `--destructive-foreground` | `#FFFFFF` | `#FFFFFF` | |

### 6.2 Brand-extra tokens (status language + brand surfaces)
Added as CSS vars + Tailwind colors so `StatusBadge` and brand surfaces map by name:

| Var | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paid` / `--paid-tint` | `#0F7A42` / `#EAF3EE` | `#35C06E` / `#13251C` | paid |
| `--info` / `--info-tint` | `#0066CC` / `#E8F0FB` | `#0A84FF` / `#10233A` | rescheduled |
| `--amber` / `--amber-tint` | `#B45309` / `#FBEFE3` | `#E0A345` / `#2A2113` | almost full / offline |
| `--forest` | `#0F2A20` | `#0F2A20` | ticket pass, org/profile banner |
| `--primary-focus` | `#0F7A42` | `#1E9E5C` | pressed |

### 6.3 Radii & shape
- Radius tokens from `theme.radius` (`sm 8`, `md 11`, `card 14`, `lg 18`, `xl 22`,
  `pill 9999`) → Tailwind `borderRadius` scale.
- **Pill CTAs** via `rounded-full`. Cards `rounded-[14px]` (`card`). This preserves the
  getdesign `apple` grammar.
- Dark primary `#2FB56A` and status colors chosen to clear **WCAG AA** contrast on dark
  surfaces (a11y requirement, mobile MVP §10); verified during QA.

### 6.4 Bridge & cleanup
`lib/theme.ts` **stays temporarily** as a bridge so un-migrated files keep compiling.
It is **deleted in the final phase** once nothing imports it.

## 7. Component mapping

RNR ships 30+ UI primitives (verified against the registry) incl. `select`, `radio-group`,
`checkbox`, `textarea`, `switch`, `toggle-group`, `card`, `badge`, `avatar`, `icon`.

| Current component | RNR target |
| --- | --- |
| `StatusBadge` | `badge` — variants: open / almost_full / cancelled / rescheduled / paid |
| `EventCard` | `card` + `text` + `badge` + `avatar` |
| `PillSelect` | `toggle-group` |
| `PsgcAddressPicker` | `select` ×3 (cascading region → province → city) |
| `OrgAvatar` | `avatar` |
| `DynamicField` | `input` / `textarea` / `select` / `checkbox` + `label`; **`date` & `file` custom** (§7.1) |
| `BrandHeader` | custom, restyled with `className` + Lucide bell icon |
| `OrgHeader` / `OrgBanner` | custom + `avatar`, restyled |
| `ElevationHero` | custom visual (SVG), restyled |
| `EventGallery` | custom carousel (keep logic; `aspect-ratio` for framing) |
| `TicketQR` | keep `react-native-qrcode-svg`, wrap in `card` |

### 7.1 Gap: date & file inputs (RNR has neither)
- **`date`** (`DynamicField` date fields + any native date entry): thin custom control on
  `@react-native-community/datetimepicker`, styled to match `input`.
- **`file`** (`DynamicField` file uploads): thin custom control on
  `expo-document-picker` / `expo-image-picker` → Supabase Storage (already in the mobile
  spec §8). Store the path in `custom_data`.
- Both are small, isolated, and get their own unit tests.

## 8. Auth screens via RNR blocks

RNR ships pre-composed auth **blocks**: `sign-in-form`, `sign-up-form`, `verify-email-form`,
`forgot-password-form`, `social-connections`. We adopt their **UI**, rewired to the existing
**Supabase** `lib/auth.tsx` (the blocks ship Clerk-oriented; we drop Clerk, keep Supabase).
Auth logic and its tests (`__tests__/auth.test.tsx`, `sign-in.test.tsx`) are untouched.
`social-connections` maps onto the spec's Apple / Google / Facebook providers.

## 9. Screen migration order (bottom-up, tests green each step)

1. **Primitives** — add RNR components to `components/ui/` (Phase 2).
2. **Leaf components** (§7) — one at a time, keeping each component's test green (Phase 3).
3. **Screens** (Phase 4), in this order:
   - **Auth** — `sign-in`, `sign-up` (+ verify) via blocks
   - **Tabs** — `events`, `orgs`, `races`, `profile`
   - **Detail** — `event/[id]`, `org/[id]`
   - **Money path (last, careful)** — `register/[categoryId]` → `pay/[registrationId]` →
     `ticket/[registrationId]`
   - **Splash** — `index`
4. Each screen's existing tests must pass before moving on. A restyle-only screen shouldn't
   need test changes; where a testID or accessible label must move, update the test in the
   same commit.

## 10. Testing, risk & rollback

- **Guardrail:** full `npm test` green after **every phase**; iOS simulator smoke throughout;
  one Android smoke before done.
- **Risks & mitigations:**
  - SDK 57 + NativeWind unknowns → **Phase 0 spike gates everything**.
  - Portal-based primitives (`select`, `dialog`, `popover`) blank on native → `<PortalHost/>`
    in foundation (§5.3).
  - Dark-palette contrast → AA check in QA (§6.3).
  - jest-expo peer wrinkle → proven in the spike (§5.4).
- **Rollback:** each phase is its own commit/PR on a feature branch; the bridge (`theme.ts`)
  keeps un-migrated code compiling, so any phase can be reverted without breaking the app.

## 11. Cleanup (final phase)

- Delete `lib/theme.ts` once no imports remain.
- **Regenerate `DESIGN.md`** to the real trail-green palette + the §6 dark spec (remove the
  stale Action Blue `#0066cc` primary; keep `#0066cc` only as the `info` status).
- Remove dead emoji-glyph helpers and any leftover `StyleSheet` blocks.

## 12. Phased implementation outline

The detailed step-by-step plan is produced next (writing-plans). High-level phases:

- **Phase 0** — NativeWind + RNR spike; gate on iOS render + green tests.
- **Phase 1** — Theming foundation: `global.css` light/dark tokens, `tailwind.config`,
  `cn()`, `@/` alias, `PortalHost`, Lucide, `NAV_THEME`.
- **Phase 2** — Add RNR primitives + brand wrappers (Button/Text/Input/Card/Badge/Avatar/
  Select/Checkbox/Textarea/Label/ToggleGroup/Dialog).
- **Phase 3** — Migrate leaf components (§7), incl. custom `date`/`file` controls.
- **Phase 4** — Migrate screens (§9 order); money path last.
- **Phase 5** — Cleanup (§11); full test + iOS/Android smoke.

## 13. Dependencies & open items

- **New deps (pinned in Phase 0):** `nativewind`, `tailwindcss@^3.4`, `lucide-react-native`,
  `clsx`, `tailwind-merge`, `@react-native-community/datetimepicker`, `expo-document-picker`
  (or `expo-image-picker`). `react-native-reanimated` if not already transitive.
- **Confirm in Phase 0/1:** exact NativeWind version vs RN 0.86; RNR CLI `init`/`add` output
  format for `global.css` + `tailwind.config` (match their current template).
- **Verify in Phase 1:** `@/` alias resolves under both Metro and jest.

---

*Next: implementation plan (writing-plans) once this spec is approved.*
