# AGENTS.md — repo orientation

Read this first. It exists so a new agent (or human) does not have to be
briefed from scratch. Keep it short and current; update it when facts change.

## What this project is

Headless CMS and content hub. React 18 + Vite 7 + TypeScript 5.8 + Supabase
(Postgres, Auth, Edge Functions). Content is created or AI-generated, held for
human review, scheduled, then published to social platforms.

Production: `https://content-cms-hub.vercel.app`, bound to `main` via Vercel's
GitHub integration. **Every push to `main` auto-deploys to production.** Work
on a branch and open a PR.

## Commands

```bash
npm ci                 # install (clean, no --legacy-peer-deps needed)
npx tsc --noEmit       # typecheck
npm run lint           # 0 errors expected; ~289 warnings are all no-explicit-any
npm run test -- --run  # unit tests (vitest)
npm run build          # production build
```

All four run in CI (`.github/workflows/ci.yml`). E2E specs self-skip without
`E2E_SUPABASE_SERVICE_ROLE_KEY`, so a green E2E run can mean nothing ran —
check whether specs were skipped, not just whether the job passed.

## Where things live

- `docs/MASTER_CHECKLIST.md` — the single source of truth for completion
  status. `docs/AUDIT.md`, `PHASE_0_TESTING.md` and `PHASE_3_READINESS_REPORT.md`
  are historical; do not treat them as current.
- `docs/AUDIT_REPORT.md` — full audit at revision `59cdea98`.
- `src/data/platforms/*.json` — per-platform publishing schedule (source of
  truth). Consumed by `src/utils/scheduling.ts`.
- `supabase/functions/schedule-from-templates/` — inlines its own copy of the
  schedule and generates pending posts. A parity test guards the duplicated
  website category map.
- `supabase/functions/publish-due-posts/` — runs every minute; delivers due posts.
- `supabase/functions/content-pipeline/` — OpenAI generation with cost controls.

## Things that will bite you

- **Only LinkedIn and X publish directly.** `publish-due-posts/index.ts:15`
  defines `DIRECT_PLATFORMS = {linkedin, twitter}`. Every other platform needs
  a matching active row in `webhook_configs` or the post fails with
  `No active webhook configured for {platform}`. A full-looking calendar does
  not mean deliverable content.
- **Webhooks are authored on `/pipeline`** (`src/pages/ContentPipeline.tsx`).
  Settings → Integrations only *lists* them.
- **Do not add a second schedule definition.** The schedule lives in
  `src/data/platforms/*.json`. Two copies of it caused the recurring
  duplicate/wrong-content bug (see `20260723000000_retire_legacy_pipeline.sql`).
- **`scheduled_at` is always a UTC instant.** Use `src/utils/scheduleTime.ts`
  to convert; never write a bare local wall-clock string.
- **Never inline a secret into a migration or commit.** An earlier migration
  committed a live JWT to git history. Cron auth uses `x-cron-secret` checked
  against `get_cron_secret()` (service_role only).
- **`workflow_stage` and `review_requested_at` are trigger-maintained**
  (`sync_post_workflow_stage`, migration `20260430212700`). Don't hand-write
  them. `approved_at` exists but has no writer.
- **`handleBulkApprove`** (`src/pages/Review.tsx:456`) approves the whole
  review queue when nothing is selected. Intentional or not, that is the
  current behaviour.
- **Never commit `.env`.** Only `.env.example` is tracked.

## Environments

`.env` holds `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` (public client values). Redis/other files not
in use. A dev server here is only reachable inside its own container; a
sandboxed `localhost` is not visible from a browser.
