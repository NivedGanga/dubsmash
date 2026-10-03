# Handoff: deploying Dubsmash

The code is complete: typecheck, lint, 45 tests (including a real FFmpeg render), the migration
validator and the production build all pass. What's left is creating the cloud accounts and wiring
up credentials. Nothing below requires code changes.

## What's built

- Admin portal: signed direct (chunked) uploads, trim, characters, timeline mapping with pointer
  spawn/move/merge, approval workflow, per-user folders, search/filter/sort, access requests, user and
  role management, feature flags with an audit log.
- Game: clip browser, lobby with 3D avatars, ready/start, host role assignment, friend invitations
  (expire after 1h), turn-based recording with countdown, re-record, review, live in-browser
  playback, synced "play for everyone", results, download/share.
- Background FFmpeg render on GitHub Actions with retries; in-app and realtime notifications; friends;
  profile with avatar editor; settings with mic test.

## Deployment checklist

### 1. Supabase (database + realtime)
1. Create a project at https://supabase.com (free tier).
2. In the **SQL editor**, run `migrations/001_…sql` through `migrations/007_…sql` in order, then
   `scripts/seed-flags.sql`.
3. **Project settings → API**: copy the Project URL, the `anon` key and the `service_role` key.
4. **Realtime settings**: make sure public channels are allowed (the app uses public broadcast and
   presence channels; data itself is protected by RLS).

### 2. Firebase (auth)
1. Create a project at https://console.firebase.google.com, add a **Web app** and copy its config
   (`apiKey`, `authDomain`, `projectId`, `appId`).
2. **Authentication → Sign-in method**: enable Email/Password, and optionally Google and GitHub.
   Discord needs Identity Platform with an OIDC provider (id e.g. `oidc.discord`).
3. **Authentication → Settings → Authorized domains**: add your Vercel domain.
4. **Project settings → Service accounts → Generate new private key**: download the JSON (server
   token verification).

### 3. Cloudinary (media)
1. Create an account at https://cloudinary.com, then copy the Cloud name, API key and API secret from the dashboard.

### 4. SendGrid (optional, admin emails)
1. Create an API key with "Mail Send" permission and verify a sender address.

### 5. Vercel
1. Import the GitHub repo into Vercel (framework auto-detected; `vercel.json` included).
2. Add these environment variables (Production + Preview):

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` |
| `ALLOWED_ORIGINS` | `https://<your-domain>` |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service_role key (secret) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` / `_AUTH_DOMAIN` / `_PROJECT_ID` / `_APP_ID` | Firebase web config |
| `NEXT_PUBLIC_FIREBASE_SSO_PROVIDERS` | e.g. `google,github` |
| `FIREBASE_CONFIG` | Service-account JSON on one line (secret) |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloud name |
| `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary keys (secret) |
| `SENDGRID_API_KEY` / `SENDGRID_FROM_EMAIL` | Optional |
| `WORKER_WEBHOOK_SECRET` | Long random string (only if using the webhook) |

3. Deploy: `vercel deploy --prod` (or push to `main`).

### 6. GitHub Actions (video worker)
1. **Repo → Settings → Secrets and variables → Actions**, add the secrets `SUPABASE_URL`,
   `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET`.
2. **Actions → Process videos → Run workflow** once to check it (it should log "no pending jobs").
   It then runs every 5 minutes. Scheduled workflows only run on the default branch.

## Verify the deployment

1. Sign up: the **first account becomes super admin** (toast confirms it). Choose a username.
2. Admin → Clips → Upload a short MP4, then configure it: trim, name the characters, Start mapping,
   drag the end pointer to split, assign every section, and submit. It goes live immediately
   (super admins skip approval).
3. Sign up a second account in a private window and request admin access; approve it from the first
   account (Access requests). Toggle `super_admin_approval_required` in Feature flags and check
   that new users get access immediately.
4. Make the two accounts friends (Friends page), create a lobby from Play, invite, ready up, start.
5. Record each line, then watch the live playback. Within about 5-10 minutes the MP4 appears with
   download/share buttons and a "video ready" notification.

## Known limitations and follow-ups

- **Next.js 14** was required by the spec; `npm audit` reports advisories that are fixed only in Next 15+.
  Upgrading to Next 15 (pages router is supported) is recommended.
- Realtime channels are public: anyone who knows a session UUID could listen to or send hint events.
  Clients treat events only as "refetch" hints (and clamp `playback:start`), so state can't be forged.
  Hardening option: Supabase third-party auth with Firebase plus private channels and RLS policies.
- The feature-flag cache is per serverless instance, so other instances can lag by up to 5 minutes
  (`FLAG_CACHE_TTL_MS` changes this).
- There is no API rate limiting yet (consider Vercel Firewall or Upstash rate limiting).
- Email verification isn't enforced at signup.
- UI translations aren't implemented; the language setting is stored for later.
- Monitoring (Sentry/PostHog) isn't wired up yet.
