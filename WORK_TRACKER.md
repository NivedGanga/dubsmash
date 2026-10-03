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
| 1 | Project init: package.json, Next/TS/Tailwind config, types | TODO |
| 2 | DB migrations (11 tables) + seed flags | TODO |
| 3 | Core services (flags, supabase, auth, cloudinary, realtime, api client, utils, timeline) | TODO |
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

## Known gaps / follow-ups

_(Things intentionally left for later, or blocked on credentials.)_
