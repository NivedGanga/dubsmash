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
| 4 | Auth + admin access control (APIs, middleware, dashboard) | TODO |
| 5 | Admin clip management + timeline editor | TODO |
| 6 | Game sessions + lobby | TODO |
| 7 | Recording system | TODO |
| 8 | Video processing pipeline (FFmpeg + GitHub Actions) | TODO |
| 9 | 3D avatars, playback stage, results | TODO |
| 10 | Notifications, friends, profile, settings, feature-flags UI | TODO |
| 11 | Deployment config + README/DEVELOPMENT docs | TODO |
| 12 | Tests, typecheck, lint, build verification | TODO |
| 13 | Handoff (HANDOFF.md, deployment checklist) | TODO |

## In-progress notes

_(Write here what is half-done in the current phase, so the next person can pick it up.)_

- none

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
15. **Flag cache is per server instance** (5-min TTL, per spec). Changes are immediate on the instance
    that made them; other serverless instances converge within the TTL. `FLAG_CACHE_TTL_MS` overrides it.
    When the DB is unreachable, built-in restrictive defaults (`types/flags.ts`) are used.
16. **`server-only` package is not used** (breaks pages-router API routes and the worker script);
    the client/server boundary is enforced by ESLint instead.

## Known gaps / follow-ups

_(Things intentionally left for later, or blocked on credentials.)_
