# Dubsmash — Work Tracker

> **Purpose:** Single source of truth for build progress. If work is interrupted, any engineer
> (or any Devin session) should be able to read this file, see exactly where things stand,
> and continue. **Update this file at the end of every phase / meaningful chunk of work and
> commit it together with the code.**

Specs: `DUBSMASH_FINAL_COMPREHENSIVE_PROMPT.md` (product spec) and
`DUBSMASH_DEVIN_META_PROMPT.md` (execution plan, phases 1–13).

## How to resume

1. `git log --oneline` — every phase ends with a commit named `Phase N: ...`.
2. Read the **Status** table below; pick the first phase that is not `DONE`.
3. Read the **Decisions** section so you don't undo deliberate deviations from the spec.
4. Check **In-progress notes** for half-finished work in the current phase.
5. Verify the tree is healthy before continuing:
   `npm install && npm run typecheck && npm run lint && npm test && npm run build`
6. When you finish a chunk: update this file, then commit.

## Status

| Phase | Description | Status |
|------:|-------------|--------|
| 0 | Work tracker, AGENTS.md, git init | DONE |
| 1 | Project init: package.json, Next/TS/Tailwind config, types | DONE |
| 2 | DB migrations (11 tables) + seed flags | DONE (validated on PGlite/Postgres 17: apply, idempotent re-run, triggers, RPCs) |
| 3 | Core services (flags, supabase, auth, cloudinary, realtime, api client, utils, timeline) | DONE (31 unit tests) |
| 4 | Auth + admin access control (APIs, middleware, dashboard) | DONE |
| 5 | Admin clip management + timeline editor | DONE (incl. jsdom pointer-drag tests) |
| 6 | Game sessions + lobby | DONE (APIs + lobby + game page; `/play/[sessionId]` page is built in Phase 7) |
| 7 | Recording system | DONE (`lib/audio.ts`, `RecordingScreen`, `pages/play/[sessionId].tsx`) |
| 8 | Video processing pipeline (FFmpeg + GitHub Actions) | DONE (real ffmpeg render verified in tests; CI workflow added) |
| 9 | 3D avatars, playback stage, results | DONE (AvatarDisplay, PlaybackStage, ResultsScreen, VideoProcessing, synced `playback:start`) |
| 10 | Notifications, friends, profile, settings, feature-flags UI | DONE |
| 11 | Deployment config + README/DEVELOPMENT docs | DONE (`vercel.json`, README.md, DEVELOPMENT.md) |
| 12 | Tests, typecheck, lint, build verification | DONE (45 tests, migration validator, build OK, endpoint auth audit) |
| 13 | Handoff (HANDOFF.md, deployment checklist) | DONE |
| 14 | Cloud provisioning via MCP (Supabase, GitHub, Vercel, Firebase, Cloudinary) | IN PROGRESS — see Live infrastructure |

## In-progress notes

_(Write here what is half-done in the current phase, so the next person can pick it up.)_

- **Production is live and verified end-to-end.** The 500s were caused by `jose@6` (pulled by
  `jwks-rsa@4` ← firebase-admin): it is ESM-only and Vercel's serverless loader cannot `require()`
  ESM, so every route importing firebase-admin crashed at module load (HTML 500; in-handler errors
  return JSON). Fixed by an npm `overrides` pin to `jose@5` (CJS build; jwks-rsa only uses
  importJWK/exportSPKI/decodeJwt/decodeProtectedHeader). Vercel project nodeVersion set to 22.x.
  Verified live: landing 200; authed routes 401 JSON; `POST /api/auth/signup` created the first
  user as `super_admin` (`is_first_user: true`, flags served from Supabase); `GET /api/auth/me`
  OK. The test user was deleted from Firebase + Supabase afterwards, so the next signup becomes
  super_admin. The temporary `pages/api/_diag.ts` diagnostic was removed.
- Vercel MCP intermittently drops its connection ("Failed to connect"). `create_deployment` needs
  args wrapped in `requestBody`; `update_project` likewise. Runtime logs/errors tools return 403
  for this personal-scope project — debug via a temporary diagnostic endpoint instead.
- Still outstanding for full product verification: real clip upload → game session → FFmpeg
  render through GitHub Actions (needs an actual video file + a game played through).
- Vercel project is NOT git-linked, so pushes do not auto-deploy — link GitHub in Vercel project
  settings, or redeploy via `create_deployment` MCP each push.
- SendGrid: SendGrid domain-authentication DNS records (CNAME/TXT for *.dubsmash.vercel.app)
  CANNOT be created — vercel.app is a shared domain, no user DNS control. Options: (a) SendGrid
  Single Sender Verification (no DNS needed), or (b) custom domain. SENDGRID_FROM_EMAIL is set;
  without SENDGRID_API_KEY the app logs a warning and skips emails (lib/server/email.ts).
- `SUPABASE_URL` (server-only alias) is read before `NEXT_PUBLIC_SUPABASE_URL` — both work.

## Live infrastructure

| Service | Resource | Value / ID |
|---------|----------|------------|
| Supabase | Project `dubsmash`, region ap-south-1 | ref `snklblypezylwdnpdolq`, https://snklblypezylwdnpdolq.supabase.co |
| GitHub | Public repo | https://github.com/NivedGanga/dubsmash |
| Vercel | Project (framework: nextjs, region iad1) | `prj_QqBCF5jU6048RR47sod9GukVpDNB`, https://dubsmash.vercel.app |
| Cloudinary | Existing free-plan env (user's account) | cloud name `dlba8afnl`, API key `332968182961976` |
| Firebase | Project `dubsmash-game` + web app + providers + admin SA verified | project number 157762387371 |
| SendGrid | Optional; `SENDGRID_FROM_EMAIL` set, `SENDGRID_API_KEY` unset — code skips email gracefully | — |

DB state: migrations 001–008 applied via Supabase MCP `apply_migration`; 7 feature flags seeded.
Advisor lints: `rls_enabled_no_policy` is intentional (all access via service role); the
`function_search_path_mutable` and `unindexed_foreign_keys` findings were fixed by migration 008.
Note: Vercel `ssoProtection` is ON for non-custom-domain deployments — visitors to the *.vercel.app
URL need Vercel login until it is disabled (update_project → ssoProtection).

## Decisions (deviations / clarifications of the spec)

_(Append-only. Each decision: what, why.)_

1. **Real-time uses Supabase Realtime (broadcast + presence), not a Socket.io server.** Vercel
   serverless functions cannot hold WebSocket connections, so a Socket.io server there would not work.
   Supabase Realtime is free, already part of the stack, and gives rooms (channels), broadcast,
   presence (online status) and automatic reconnection. The event names from the spec are kept
   (`player:joined`, `player:ready`, `recording:start`, `recording:complete`, `playback:start`) —
   see `types/game.ts`. Server routes broadcast via the service-role client after DB writes; clients
   treat events as "something changed" hints and refetch authoritative state from the API.
2. **Auth: Firebase client SDK signs users in; the API verifies Firebase ID tokens with firebase-admin.**
   `/api/auth/signup` creates the DB profile (username) for an already-created Firebase user;
   `/api/auth/login` records the login and returns the profile. Password hashing/JWT expiry are handled
   by Firebase. `/api/auth/refresh-token` proxies Firebase's secure-token endpoint.
3. **Uploads go directly from the browser to Cloudinary using a server-generated signature**
   (`/api/uploads/sign`), then the client registers the asset (`/api/clips/upload`,
   `/api/recordings/upload`). Vercel functions have a 4.5MB body limit, so proxying 500MB videos
   through the API is impossible. Server validates resource type, folder and public_id ownership.
4. **Next.js pages router, code at repo root** (`pages/`, `lib/`, `components/`...) as laid out in the meta prompt.
5. **Dependencies were installed with `npm install --before=2026-09-25`** so no package version is younger
   than ~7 days (supply-chain safety).
6. **RLS enabled on every table with no policies.** Only the server (service-role key) touches tables;
   the browser anon key is used solely for Realtime broadcast/presence. Most restrictive by default.
7. **First super admin = first registration while no super_admin exists**, done atomically in the
   `register_user` SQL function under an advisory lock (no race between concurrent first signups).
8. **Clip statuses are `pending | active | rejected | archived`.** The spec's `approved` state is folded
   into `active` (approval makes a clip playable). `is_configured` tracks whether the timeline is mapped.
9. **Friend requests are one row (requester -> recipient); rejection deletes the row** so rejected
   requests leave no history (spec requirement). A unique unordered-pair index blocks A->B + B->A.
10. **Game session `players` JSON is updated with optimistic concurrency** (`version` column) to avoid
    lost updates when several players ready up at the same moment.
11. **Video jobs are claimed with `claim_next_video_job()`** (`FOR UPDATE SKIP LOCKED`); jobs stuck in
    `processing` > 30 min are reclaimed (crashed worker).
12. **Migrations can be validated without Docker**: see "Validating migrations" in DEVELOPMENT.md (PGlite).
13. **Timeline pointer semantics** (`lib/timeline.ts`): dragging an *edge* pointer (0 or end) inward
    spawns a new boundary at the drop point while the edge stays (matches the spec's 20s->7s example);
    dragging an *inner* pointer moves that boundary. Double-click a boundary to remove it. Adjacent
    same-character sections are merged on assignment. Min section 0.5s, pointers cannot cross.
14. **Percentage rollout bucket = FNV-1a(`flag_name:user_id`) % 100.** Including the flag name keeps
    different rollouts independent. Percentage/user_list flags also respect `is_enabled` as a master switch.
16. **`server-only` package is not used** (breaks pages-router API routes and the worker script);
    the client/server boundary is enforced by ESLint instead.
15. **Flag cache is per server instance** (5-min TTL, per spec). Changes are immediate on the instance
    that made them; other serverless instances converge within the TTL. `FLAG_CACHE_TTL_MS` overrides it.
    When the DB is unreachable, built-in restrictive defaults (`types/flags.ts`) are used.
17. **Access requests are created explicitly by the user** ("Request access" button on
    `/admin/request-access`), as in the product spec, rather than automatically on signup (meta prompt).
    This avoids flooding the super admin with requests from people who only want to play.
    Signup with the approval flag OFF gives role `admin`; with it ON, role `user`. While the flag is OFF,
    every active user has admin-portal access (`hasAdminAccess`).
18. **Client state** uses zustand stores in `store/` (session, toast, settings). Settings persist to
    localStorage (device-local, applies across sessions on that device).
19. **Clip trimming is non-destructive**: trim_start/trim_end are stored; players get a Cloudinary
    on-the-fly trimmed URL (`so_/eo_` transformation). The timeline is relative to the trimmed clip.
    Changing trim after mapping refits the timeline (`fitToDuration`).
20. **Super admins' own clips skip the approval queue** (they are the approver). Clips can't be
    reconfigured/deleted while a lobby/recording session uses them (409).
21. **Playable clips endpoint** is separate (`/api/clips/playable`, any signed-in user, active +
    configured only, no timeline/dialogue exposed). `/api/clips` is the admin library.
22. **Max clip length 15 min, 500MB**; uploads > 20MB are sent in 20MB chunks with retry (`lib/upload.ts`).
23. **Session flow** (`lib/server/gameFlow.ts`): lobby -> recording -> playback -> completed (or cancelled).
    Only invited friends can join (max 4). Characters are auto-dealt round-robin on join (solo player
    voices everyone); the host can re-assign. Any line-up change resets everyone's ready flag. Host is
    implicitly ready; Start requires all *other* players ready. Lines are recorded in timeline order;
    the owner of `current_sequence_index` records, re-records freely (`/api/recordings/upload` replaces
    the take), then `recording-submit` advances the turn (see 32). The last submit moves to `playback`, queues
    the render job and returns 202. Host leaving cancels the game; another player leaving mid-game hands
    their lines to the host.
24. **3D avatars are procedural** (Three.js primitives, shared geometries/materials) rather than GLB
    files: zero download size and no binary assets to author. Models: casual_m, formal_m, casual_f,
    formal_f, robot*, blob* (*premium, gated by `premium_avatars` flag). Three.js is lazy-loaded.
25. **Takes are recorded as Opus/WebM (or AAC/MP4 on Safari), not MP3.** Browsers cannot encode MP3
    natively; Opus is better quality per bit. Bitrate adapts to the connection (48/64/128 kbps).
    Recording auto-stops at line length + 0.75s; a muted video plays as a timing guide.
26. **Playback is mixed live in the browser** (Web Audio, sample-accurate scheduling, peak-normalised)
    so players watch immediately; the FFmpeg MP4 renders in the background for download/share.
    Host can trigger synchronised playback for all (`POST /api/sessions/:id/playback` -> `playback:start`
    with a wall-clock start time 2s ahead).
27. **FFmpeg render** (`lib/ffmpeg.ts`): per-take atrim (line + 0.75s) -> loudnorm -> adelay to its
    line start; amix (normalize=0) -> alimiter -> apad; video trimmed by input seek; H.264/AAC MP4,
    faststart; `-shortest` bounds output to the video. The original clip audio is muted (a quiet bed
    is supported via `originalAudioVolume` but off). Worker only downloads from res.cloudinary.com.
    Output is uploaded to `<root>/renders/<session_id>`; the session becomes `completed`.
28. **Worker runs up to 3 jobs per Actions run** (`MAX_JOBS_PER_RUN`), 15-min ffmpeg timeout; retry
    up to 3 attempts (`retry_count`), then `failed`. `/api/webhooks/ffmpeg-complete` (header
    `x-worker-secret`) lets an external renderer report results instead.
29. **Critical flags** (`is_critical`: super_admin_approval_required, clip_approval_workflow) need
    `confirm: true` on the toggle API (428 otherwise) and a confirm dialog in the UI.
30. **Profile avatars are 3D-only** (model/colour/outfit). Custom image avatars were dropped (YAGNI;
    the `avatar_url` column stays for future use). The `avatar` Cloudinary upload kind was removed.
31. **Language setting** is stored (en/es/fr/de) but the UI is English-only for now (no i18n framework).
32. **Turns are strictly sequential** (fix found by `tests/gameFlow.test.ts`): takes/re-takes are only
    accepted for the line at `current_sequence_index`, and submit always advances to index + 1. An
    earlier version skipped lines that had an *uploaded but unconfirmed* take.
33. **Broadcast payloads are untrusted** (public channels): clients only refetch on events; the
    `playback:start` delay is clamped to 0.1-10s.

## Known gaps / follow-ups

_(Things intentionally left for later, or blocked on credentials. Mirrored in HANDOFF.md.)_

- Supabase is live with all migrations; GitHub + Vercel are provisioned and the first deploy is
  building. Still missing real Firebase credentials, the Supabase service-role key and the
  Cloudinary API secret, so auth/uploads/video-rendering are untested end-to-end. See In-progress
  notes for the exact values needed.
- Next.js 14 has upstream advisories fixed only in 15+; upgrade recommended.
- Realtime channels are public (hardening: Supabase third-party auth with Firebase + private channels).
- No API rate limiting; no email-verification requirement; no i18n; no Sentry/analytics.
- No Cypress E2E suite (meta prompt mentions Cypress); would need real services or full mocks.
