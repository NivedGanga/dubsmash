# Dubsmash

Multiplayer web game where 1-4 friends dub a movie scene: each player voices a character, records
their lines in turn, then watches the scene performed by their 3D avatars with everyone's voices.
A rendered MP4 is produced in the background for download and sharing.

Two portals:

- **Game** (`/game`, `/play/:id`, `/friends`, `/profile`, `/settings`) — pick a scene, invite friends,
  lobby with 3D avatars, turn-based recording, live playback, results.
- **Admin** (`/admin/*`) — upload clips, trim, define characters, map the timeline (who speaks when),
  approval workflow, folders, user management, feature flags.

Runs entirely on free tiers: Vercel, Supabase, Firebase Auth, Cloudinary, GitHub Actions, SendGrid.

## Architecture

```
 Browser (Next.js pages, React 18, Tailwind, Zustand, Three.js, Web Audio)
   │  Firebase Auth SDK ── sign-in / SSO ──────────────► Firebase
   │  fetch /api/* (Bearer Firebase ID token)
   │  direct signed uploads (video/audio) ─────────────► Cloudinary
   │  Realtime: session:{id} / user:{id} / presence ◄──► Supabase Realtime
   ▼
 Vercel serverless API (pages/api, 57 routes)
   │  verifies ID tokens (firebase-admin) · zod validation · feature flags (5-min cache)
   │  service-role queries ────────────────────────────► Supabase Postgres (RLS on, no anon access)
   │  broadcasts state-change hints ───────────────────► Supabase Realtime
   │  enqueue render job ──────────────────────────────► video_processing_queue
   ▼
 GitHub Actions cron (*/5) → scripts/process-videos.ts
      claim job → download clip + takes → FFmpeg mix/render → upload MP4 → notify players
```

Game flow: `lobby → recording → playback → completed` (or `cancelled`). Lines are recorded in timeline
order; the last confirmed take queues the render (202, non-blocking). Playback starts immediately —
the browser mixes takes over the muted clip with Web Audio — while FFmpeg renders the MP4.

## Tech stack

| Concern | Choice |
|---|---|
| Framework | Next.js 14 (pages router), React 18, TypeScript strict |
| Styling | Tailwind CSS 3 |
| State | Zustand (session, toasts, persisted settings) |
| Auth | Firebase Auth (email/password, Google, GitHub, Discord via OIDC) + firebase-admin |
| DB | Supabase Postgres, 11 tables, RLS enabled, SQL RPCs for atomic ops |
| Realtime | Supabase Realtime broadcast + presence (see "Why not Socket.io") |
| Media | Cloudinary (signed direct uploads, chunked for big files, on-the-fly trimming) |
| Rendering | FFmpeg on GitHub Actions |
| 3D | Three.js, procedural avatars, lazy-loaded |
| Email | SendGrid (only when `email_notifications_enabled`) |
| Validation | zod |
| Tests | Jest (+ Testing Library, jsdom), PGlite for SQL |

**Why not Socket.io?** The spec asked for Socket.io, but Vercel serverless functions cannot hold
WebSocket connections. Supabase Realtime provides the same room/broadcast/presence model for free and
reconnects with exponential backoff. Event names follow the spec (`player:joined`, `player:ready`,
`recording:start`, `recording:complete`, `playback:start`, …; see `types/game.ts`).

## Feature flags

Managed at `/admin/feature-flags` (super admin). Changes are audit-logged in `flag_change_log`.

| Flag | Type | Default | Effect |
|---|---|---|---|
| `super_admin_approval_required` | boolean (critical) | on | Users must request admin-portal access; off = everyone gets access |
| `email_notifications_enabled` | boolean | on | Email super admins on new clip uploads |
| `clip_approval_workflow` | boolean (critical) | on | Configured clips wait for super admin approval; off = live immediately |
| `friend_system_enabled` | boolean | on | Friend requests and game invitations |
| `new_recording_ui` | percentage | off / 0% | Live waveform in the recording screen |
| `video_effects_beta` | user list | [] | Reserved for the video-effects beta |
| `premium_avatars` | percentage | 0% | Unlocks Robot and Blob avatars |

Evaluation (`lib/server/featureFlags.ts`): boolean → `is_enabled`; percentage → `is_enabled` and
`fnv1a(flag:user) % 100 < pct`; user list → `is_enabled` and user id listed. 5-minute in-memory cache,
cleared on change; restrictive defaults if the DB is unreachable.

## Local development

Requirements: Node 18.18+ (20 recommended), npm, and FFmpeg (only for the render worker/tests).

```bash
npm install
cp .env.example .env.local     # fill in credentials (see HANDOFF.md)
npm run dev                    # http://localhost:3000
```

Without credentials the landing page still renders and explains what's missing.

### Database setup

Run the SQL files in order in the Supabase SQL editor (or `psql`):

```
migrations/001_users_and_access.sql … migrations/007_indexes_and_triggers.sql
scripts/seed-flags.sql
```

All files are idempotent. Validate them locally without Docker: `npm run validate-migrations`.

The first account to sign up becomes **super admin**.

### Video worker

```bash
npm run process-videos   # processes up to 3 pending jobs, needs ffmpeg + Supabase/Cloudinary env
```

## Scripts

| Command | What |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint (incl. client/server import boundary) |
| `npm test` | Jest unit + component + FFmpeg render tests |
| `npm run validate-migrations` | Apply + check all SQL on in-process Postgres |
| `npm run process-videos` | Run the FFmpeg worker once |

## Deployment

See **HANDOFF.md** for the step-by-step checklist (credentials, Vercel env vars, GitHub secrets).
Short version: create the services, run the migrations, set env vars in Vercel, `vercel deploy --prod`,
add GitHub Actions secrets for the worker.

## API overview

All routes return JSON; errors are `{ error: { code, message, details? } }`. Auth: `Authorization:
Bearer <Firebase ID token>`.

- **Auth** — `POST /api/auth/signup` (create profile/username), `POST /api/auth/login`, `GET /api/auth/me`,
  `POST /api/auth/logout` (revokes tokens), `POST /api/auth/refresh-token`
- **Users** — `GET|PUT /api/users/:id|me`, `GET /api/users/check-username/:u`, `GET /api/users/search?q=`,
  `POST /api/users/heartbeat`
- **Admin** — `GET|POST /api/admin/access-requests`, `PATCH …/:id/approve|reject`, `GET /api/admin/stats`,
  `GET /api/admin/users`, `PATCH /api/admin/users/:id`, `GET /api/admin/feature-flags`,
  `GET …/:flag`, `PATCH …/:flag/toggle`, `PATCH …/:flag/value`
- **Clips** — `POST /api/uploads/sign`, `POST /api/clips/upload`, `GET /api/clips`, `GET /api/clips/playable`,
  `GET|PATCH|DELETE /api/clips/:id`, `PUT …/configure`, `PATCH …/approve|reject`, `GET …/sequences`,
  `GET|POST /api/folders`, `PATCH|DELETE /api/folders/:id`
- **Sessions** — `POST /api/sessions/create`, `GET /api/sessions/:id`, `POST …/join|leave|ready|invite|start|
  recording-start|recording-submit|complete|playback`, `PATCH …/assign`, `GET …/status`
- **Recordings** — `POST /api/recordings/upload`, `GET /api/recordings/:id`, `POST …/:id/replace`
- **Friends** — `POST /api/friends/request`, `GET /api/friends/requests`, `PATCH …/requests/:id/accept|reject`,
  `GET /api/friends/list`, `DELETE /api/friends/:friendId`
- **Notifications** — `GET /api/notifications`, `PATCH /api/notifications/read-all`, `PATCH …/:id/read`,
  `DELETE …/:id`
- **Webhooks** — `POST /api/webhooks/ffmpeg-complete` (header `x-worker-secret`)

## Security notes

- Every protected route verifies the Firebase ID token (with revocation check) and loads the profile.
- Admin routes check role + `super_admin_approval_required`; super-admin routes check role.
- All tables have RLS enabled with no policies; only the server's service-role key can access data.
- Inputs validated with zod; Supabase queries are parameterised; filter strings only interpolate UUIDs.
- Uploads: signed, folder-pinned, format allow-listed; asset size/format/duration re-verified server-side.
- CORS: same-origin plus `ALLOWED_ORIGINS`. Security headers set in `next.config.js`.
- The worker only downloads from `res.cloudinary.com`; FFmpeg is spawned without a shell.

## Troubleshooting

| Symptom | Fix |
|---|---|
| "Firebase is not configured" on the landing page | Set `NEXT_PUBLIC_FIREBASE_*` in `.env.local`, restart `npm run dev` |
| 401 on every API call | Server can't verify tokens: check `FIREBASE_CONFIG` / `FIREBASE_*` service account vars |
| 500 "Missing required environment variable …" | Set the named variable (see `.env.example`) |
| Lobby doesn't update live | Check `NEXT_PUBLIC_SUPABASE_URL/ANON_KEY`; the page falls back to polling every 4s |
| Video stuck "Queued" | GitHub Actions secrets missing or workflow disabled; run it manually (Actions → Process videos) |
| Upload fails with "not in your upload folder" | Don't change `CLOUDINARY_ROOT_FOLDER` between signing and registering |
| Microphone blocked | Allow mic for the site in browser settings; HTTPS is required (localhost is fine) |
