# apps/mobile — Expo (React Native)

The runner app for **iOS and Android**. TypeScript. See
[ADR-0001](../../docs/adr/0001-cross-platform-tech-stack.md).

**Not scaffolded yet.** Initialize with:

```bash
cd apps/mobile
npx create-expo-app@latest . --template
```

Then configure Metro for the monorepo (Expo's monorepo guide) and add the shared
package: `@trail-ultra/shared`. Key deps to expect: `expo-router`, `expo-camera`
(QR), `expo-secure-store`, `expo-sqlite` (offline tickets), `@supabase/supabase-js`.
