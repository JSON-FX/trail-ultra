# apps/mobile — Expo (React Native)

The runner app for **iOS and Android**. TypeScript. See
[ADR-0001](../../docs/adr/0001-cross-platform-tech-stack.md).

**Not scaffolded yet.** Initialize with:

```bash
cd apps/mobile
npx create-expo-app@latest . --template
```

Then configure Metro for the monorepo (Expo's monorepo guide) and add the shared
package: `@trail-ultra/shared`. Key deps to expect: `expo-router`,
`expo-web-browser` (PayMongo checkout), `react-native-qrcode-svg` (ticket QR
**display** — the runner app shows a QR, it does not scan), `expo-secure-store`,
`react-native-mmkv` (offline ticket cache), `@tanstack/react-query`,
`@supabase/supabase-js`. See [docs/01-mobile-ios-mvp.md](../../docs/01-mobile-ios-mvp.md).
