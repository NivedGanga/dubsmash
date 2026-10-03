# AGENTS.md

Instructions for AI agents / engineers working on this repo.

- **Always read `WORK_TRACKER.md` first.** It records phase status, decisions and in-progress notes.
  Update it (and commit) after each phase or meaningful chunk of work.
- Product spec: `DUBSMASH_FINAL_COMPREHENSIVE_PROMPT.md`. Execution plan: `DUBSMASH_DEVIN_META_PROMPT.md`.
- Stack: Next.js 14 (pages router) + TypeScript (strict) + Tailwind, Supabase (Postgres + Realtime),
  Firebase Auth, Cloudinary, SendGrid, Three.js, Zustand, FFmpeg worker on GitHub Actions.

## Commands

- `npm run dev` — dev server on http://localhost:3000
- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint (next/core-web-vitals)
- `npm test` — Jest unit tests (`tests/`)
- `npm run build` — production build
- `npm run process-videos` — run the FFmpeg worker once (needs Supabase + Cloudinary env, ffmpeg on PATH)

Verify with: `npm run typecheck && npm run lint && npm test && npm run build`.

## Conventions

- API routes use `lib/server/handler.ts` (`createHandler`) for method routing, CORS, auth, and error handling.
  Throw `ApiError` (or `badRequest`/`forbidden`/`notFound`/`conflict`) for expected errors; validate input with zod.
- Server-only code lives in `lib/server/` and must never be imported from components/hooks/pages `.tsx`
  (enforced by an ESLint `no-restricted-imports` override). Browser code uses `lib/api.ts` to call the API.
- Pure logic shared by client and server (timeline, sequences, utils) lives in `lib/*.ts` and is unit tested.
- Feature flags: always check via `isFeatureEnabled()` from `lib/server/featureFlags.ts`.
- Real-time: Supabase Realtime broadcast channels (see `lib/realtime.ts`), not a Socket.io server.
