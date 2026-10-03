# Developer guide

Read `WORK_TRACKER.md` (decisions + status) and `AGENTS.md` (conventions) first.

## Code map

```
pages/                 Next.js pages (UI) and pages/api (serverless API routes)
  api/                 thin route files: parse input -> call lib/server -> return JSON
components/
  Admin/               clip library: folder panel, upload modal
  Auth/                SSO buttons
  Common/              session provider, toasts, notification bell, UI primitives
  Game/                lobby, recording, playback stage, results, 3D AvatarDisplay
  Layout/              AppShell/Shell (navbar), AdminLayout (sidebar + guard)
  Timeline/            TimelineEditor, CharacterEditor, TrimControls
hooks/                 data + realtime hooks (useApi, useGameSession, useNotifications, …)
lib/                   browser-safe shared code
  api.ts               typed fetch client (token, 401 refresh-and-retry, friendly errors)
  auth.ts              Firebase client wrapper
  audio.ts             mic, MediaRecorder, level meter, scheduled playback helpers
  realtime.ts          Supabase Realtime subscriptions (session/user/presence)
  timeline.ts          pure pointer/section logic (shared with the server for validation)
  sequences.ts         timeline + players -> ordered recording plan
  ffmpeg.ts            pure FFmpeg argument builder
  three.ts             Three.js stage + procedural avatars
  upload.ts            signed/chunked direct Cloudinary uploads
  middleware/          requireAuth / requireAdmin / requireSuperAdmin
  server/              SERVER ONLY (service-role keys): supabase, firebaseAdmin, cloudinary,
                       featureFlags, gameFlow (session state machine), recordings, videoJobs, …
store/                 zustand stores
types/                 database rows, API shapes, game events, flags
migrations/            SQL schema (001-007), idempotent
scripts/               seed-flags.sql, process-videos.ts (worker), validate-migrations.mjs
tests/                 Jest tests (+ helpers/fakeSupabase.ts)
```

## Adding an API endpoint

```ts
// pages/api/things/[id].ts
import { z } from 'zod';
import { createHandler, parseBody, queryParam, notFound } from '@/lib/server/handler';
import { requireAuth } from '@/lib/middleware/requireAuth';

const schema = z.object({ name: z.string().trim().min(1).max(80) });

export default createHandler(
  {
    PATCH: async (req) => {
      const { name } = parseBody(schema, req);         // ZodError -> 400 automatically
      const id = queryParam(req, 'id');
      // req.user is the authenticated UserRow
      // throw notFound('Thing') / forbidden() / conflict('…') for expected errors
      return { ok: true, id, name };                    // JSON 200 (res.status(201) first to change)
    },
  },
  { auth: requireAuth },                                // or requireAdmin / requireSuperAdmin
);
```

Rules:
- Put logic in `lib/server/*` so it can be unit tested (see `tests/gameFlow.test.ts`).
- Never interpolate unvalidated input into PostgREST `.or()` strings; validate UUIDs first.
- Mutating a game session? Use `updateSession()` (optimistic concurrency) and then
  `broadcastSession()` so clients refetch.
- Create notifications with `notify()` (it also pushes the realtime hint).

## Adding a page / component

- Wrap pages in `<Shell>` (game) or `<AdminLayout requirement=…>` (admin; guard included).
- Guard game pages with `const { me, allowed } = useRequireAuth('user')`.
- Fetch with `useApi<T>(path, query)` or `api<T>(path, opts)`; show `ErrorBox`/`Spinner`.
- Never import from `lib/server/*` in client code (ESLint enforces this).
- Heavy libraries (Three.js) are loaded with dynamic `import()` to keep first-load JS small.

## Adding a feature flag

1. Add the name to `FLAG_NAMES` and a restrictive default to `FLAG_DEFAULTS` in `types/flags.ts`.
2. Add an `insert … on conflict do nothing` row to `scripts/seed-flags.sql` and run it.
3. Server: `await isFeatureEnabled('my_flag', user.id)`. Client: `me.flags.my_flag` (from `/api/auth/me`).
4. If toggling it is risky, set `is_critical = true` (UI + API require confirmation).

## Testing

```bash
npm test                    # all Jest tests
npx jest tests/timeline     # one file
npm run validate-migrations # SQL against PGlite (in-process Postgres)
```

- Pure logic: `tests/timeline.test.ts`, `sequences`, `utils`, `featureFlags`.
- Components: `tests/TimelineEditor.test.tsx` (jsdom, pointer events).
- Server state machine: `tests/gameFlow.test.ts` with `tests/helpers/fakeSupabase.ts`.
- FFmpeg: `tests/ffmpeg.test.ts` renders a real MP4 when `ffmpeg` is installed (skipped otherwise).

### Validating migrations

`scripts/validate-migrations.mjs` applies every migration twice (idempotency) on PGlite and checks
the important constraints, triggers and RPCs. Add assertions there when you change the schema.

## Performance notes

- First-load JS ≈ 187 kB; Three.js is split into its own chunk.
- Avatars share geometries/materials; pixel ratio is capped and shadows disabled on low-power devices;
  rendering pauses when the tab is hidden.
- Feature flags are cached 5 min per instance; DB queries use the indexes in `007_indexes_and_triggers.sql`.
- Realtime events trigger at most one coalesced refetch at a time (`useGameSession`).
- Video rendering never blocks a request: jobs are queued (202) and processed by the worker.
