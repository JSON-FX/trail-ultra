# @trail-ultra/shared

Framework-agnostic TypeScript shared by every surface — mobile (Expo), web (Vite),
and Supabase Edge Functions (Deno). **Types and Zod validators only** (no React,
no Node/Deno APIs) so all three validate identically.

Consumed as a workspace package (`@trail-ultra/shared`). For Deno Edge Functions,
expose it via an import map (see `supabase/`).
