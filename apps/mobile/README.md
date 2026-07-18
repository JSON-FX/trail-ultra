# apps/mobile — Expo Router (React Native)

The runner app for iOS and Android. TypeScript, Expo Router navigation. See [ADR-0001](../../docs/adr/0001-cross-platform-tech-stack.md).

## Running

Requires:
- Local Supabase backend from Plan 1 (see `docs/01-mobile-ios-mvp.md`)
- `apps/mobile/.env` with `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`

```bash
cd apps/mobile && npx expo start
```

## Testing

```bash
cd apps/mobile && pnpm test
```
