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

Two extra harnesses prove the paths that unit tests cannot reach. Neither runs
in CI (both need network and Deno), so run them by hand when you touch
publishing or billing:

```bash
npm run e2e:publish -- --receiver https://webhook.site/<uuid>  # real publish-due-posts vs a stub DB
npm run e2e:stripe                                             # real Stripe test-mode purchase
```

`e2e:stripe` needs `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `VERIFY_EMAIL`
and `VERIFY_PASSWORD` in the environment. See `tools/publish-e2e/README.md`.

## Where things live

- `docs/MASTER_CHECKLIST.md` — the single source of truth for completion
  status. `docs/AUDIT.md`, `PHASE_0_TESTING.md` and `PHASE_3_READINESS_REPORT.md`
  are historical; do not treat them as current.
- `docs/READINESS_GAP_ANALYSIS.md` — open-source and commercialization gap
  analysis (blockers, missing files, self-hosting hazards, multi-tenancy, two
  commercial paths with effort estimates).
- `docs/HEADLESS_CONSUMPTION.md` — whether/how the website can read CMS content,
  including the unmanaged public `articles` table.
- `docs/AUDIT_REPORT.md` — full audit at revision `59cdea98`. Its
  `scheduleMode` finding is partly wrong; Phase 15 in the checklist corrects it.
- `src/data/platforms/*.json` — per-platform publishing schedule (source of
  truth). Consumed by `src/utils/scheduling.ts`.
- `supabase/functions/schedule-from-templates/` — inlines its own copy of the
  schedule and generates pending posts. A parity test guards the duplicated
  website category map.
- `supabase/functions/publish-due-posts/` — runs every minute; delivers due posts.
- `supabase/functions/content-pipeline/` — OpenAI generation with cost controls.
- `tools/publish-e2e/`, `tools/stripe-e2e/` — the two harnesses above.
- `src/utils/scheduleMode.ts`, `src/utils/reviewTransitions.ts` — pure logic
  extracted so it can be tested; read the doc comments before changing them.

## Things that will bite you

- **"Merged" is NOT "deployed". There is no CI step that ships edge
  functions.** `publish-due-posts`, `demo-login`, `content-pipeline` and
  `schedule-from-templates` all ran stale source in production for months while
  `main` held newer code — `publish-due-posts`/`demo-login` since June 2026.
  They were brought current on 2026-10-14 (`content-pipeline` v32,
  `schedule-from-templates` v13). Every change under `supabase/functions/**`
  needs an explicit `supabase functions deploy <name>`, and **deployed versions
  cannot be read over the API** — you cannot verify from a session whether your
  change is live, so say so rather than assuming. New DB objects the functions
  depend on (e.g. the `claim_due_posts` RPC) must be applied to production
  before or with the deploy, or the function 500s on every tick.
- **Do not set `banned_until = 'infinity'`.** GoTrue can't parse it, so a banned
  user's login fails with `500 "Database error querying schema"` instead of a
  clean ban — which reads as an outage in logs. Use a far-future finite
  timestamp (the fix adopted here: `2099-12-31`).
- **The website's content is NOT managed by this CMS — do not assume otherwise.**
  Production exposes `articles` + `authors` over PostgREST **anonymously**, and
  `articles` holds real Novus Exchange articles. But **no migration creates those
  tables and no code in `src/` or `supabase/functions/` reads or writes them** —
  they were created in the dashboard. The CMS's own `posts` table is closed to
  `anon` (RLS requires `auth.uid()`, and `has_role` EXECUTE is revoked from
  `anon`, so anon gets a hard `401 permission denied for function has_role`
  rather than an empty result). Two disconnected content systems; whether
  `articles` is the intended store or a leftover is an **open owner decision**.
  See `docs/HEADLESS_CONSUMPTION.md`.
- **Billing is not enforced anywhere on the server.** No edge function ever
  *reads* `subscriptions` — only writes. The only tier gate is cosmetic and
  client-side (`Sidebar.tsx:140`). Any authenticated free user can call
  `content-pipeline` / `novee-chat` / `generate-strategy` directly and spend the
  owner's AI budget. Do not describe the app as having working plan gating.
- **The migration set cannot rebuild the database.** `project_settings` and
  `subscribers` are policy'd and altered but never `CREATE TABLE`d, and
  `project_settings` is queried as key/value in one migration and as wide columns
  in another. `supabase db push` onto an empty project fails. This is why the E2E
  project was rebuilt by introspecting live prod (Phase 9). Also note
  `invitations` 404s live despite a migration creating it — migrations are
  **not** a faithful mirror of production either way.
- **`project_settings` is one global row** (`.select('*').single()`), so all
  config and the AI budget are instance-wide. The budget check
  (`content-pipeline:110-115`) sums `cost_estimate` across **all** users with no
  `user_id` filter: one heavy user 402s everyone. `novee-chat` and
  `generate-strategy` have no budget check at all.
- **`admin` is a global super-admin, not a tenant admin.** `has_role()` reads a
  global `user_roles` table with no tenant column, and ~30 tables use
  `auth.uid() = user_id OR has_role(auth.uid(),'admin')`. There is **no tenant /
  organization / workspace concept anywhere** — the app is single-tenant. Any
  customer granted `admin` can read and edit every other user's content, roles
  and billing. Multi-customer SaaS requires splitting the two.
- **Stripe price IDs are hardcoded in three files** (`create-checkout`,
  `check-subscription`, `stripe-webhook`) and `resolveTier` falls through to
  `"free"` for unrecognised prices — so a second deployment that updates two of
  the three silently downgrades paying customers. The advertised **14-day trial
  is not implemented** anywhere (`trial_period_days` does not exist).
- **`/pipeline`'s webhook form cannot set auth headers** (name, URL and platform
  badges only), though `webhook_configs.headers` supports them — a custom-secret
  receiver needs a direct DB write today. The webhook payload has **no idempotency
  key and no shared secret**, and only ever fires `post.publish` (no update or
  unpublish event).
- **Only LinkedIn and X publish directly.** `publish-due-posts/index.ts:15`
  defines `DIRECT_PLATFORMS = {linkedin, twitter}`. Every other platform needs
  a matching active row in `webhook_configs` or the post fails with
  `No active webhook configured for {platform}`. A full-looking calendar does
  not mean deliverable content.
- **Proven-deliverable in production, as of 2026-10-14 — keep these two paths
  distinct, because they fail independently:**
  - **LinkedIn (direct/OAuth path).** A real post was published to the owner's
    feed. This exercises `platform_oauth_tokens` + the LinkedIn publish call. It
    says nothing about the webhook platforms.
  - **Website (webhook path).** A real delivery was received and logged. The
    mechanism is proven for every webhook platform because they share one code
    path — but only `website` has been exercised.
  - **Still never exercised in production:** `instagram`, `facebook`, `tiktok`,
    `youtube`. Do not claim these work.
- **As of 2026-10-14 there is no active `webhook_configs` row at all**, so no
  webhook platform currently delivers in production — the row used for the proof
  was retired. "LinkedIn publishes fine" is therefore *not* evidence that the
  calendar is deliverable: LinkedIn never needed a webhook row. Enabling the
  webhook platforms is a dashboard action, not a code change.
- **Webhooks are authored on `/pipeline`** (`src/pages/ContentPipeline.tsx`).
  Settings → Integrations only *lists* them.
- **`rumble` and `podcast` cannot be reached from the UI at all** — they are
  missing from both `ContentPipeline.tsx`'s `PLATFORM_OPTIONS` and
  `Automation.tsx`'s platform filter. Don't assume a schedule entry for them
  means anything is deliverable.
- **A webhook with an empty `platforms` array matches every platform.** Leaving
  all the badges unselected is not "no platforms" — it is "all of them".
- **Do not add a second schedule definition.** The schedule lives in
  `src/data/platforms/*.json`. Two copies of it caused the recurring
  duplicate/wrong-content bug (see `20260723000000_retire_legacy_pipeline.sql`).
- **`scheduled_at` is always a UTC instant.** Use `src/utils/scheduleTime.ts`
  to convert; never write a bare local wall-clock string.
- **Never inline a secret into a migration or commit.** Cron auth uses
  `x-cron-secret` checked against `get_cron_secret()` (service_role only).
  *Corrected 2026-10-14:* migration `20260323155000` did commit a credential,
  but only the **anon/publishable key**, project URL and project ID — all three
  already public in the client bundle by design, with no service-role key or
  real secret involved. The owner's decision is **not to rotate** it; the
  security boundary here is RLS, not key secrecy. Earlier notes calling this
  "the top launch blocker" are superseded — don't re-raise it.
- **`workflow_stage` and `review_requested_at` are trigger-maintained**
  (`sync_post_workflow_stage`, migration `20260430212700`). Don't hand-write
  them. `approved_at` exists but has no writer.
- **`handleBulkApprove`'s approve-all is deliberate — do not "fix" it.** The
  logic now lives in `src/utils/reviewTransitions.ts` as `bulkApproveTargets`,
  with the decision recorded in its doc comment and pinned by a test. The owner
  confirmed on 2026-10-14 that approving the whole queue when nothing is checked
  is intended; the button reads "Approve All" in that state.
- **`scheduleMode` has four values, not three:** `immediate`, `scheduled`,
  `draft` and `awaiting_review`. The list is duplicated in the edge functions
  (they cannot import from `src/`) and
  `src/utils/scheduleModeParity.test.ts` fails the build if the copies drift or
  if any call site sends something else.
- **Never commit `.env`.** Only `.env.example` is tracked.
- **A stale `vite` process from this repo will make `npm ci` fail with
  `EPERM` on a rollup native binary.** Find and kill repo-owned node processes
  before assuming the install itself is broken.

## Environments

`.env` holds `VITE_SUPABASE_PROJECT_ID`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_PUBLISHABLE_KEY` (public client values). Redis/other files not
in use. A dev server here is only reachable inside its own container; a
sandboxed `localhost` is not visible from a browser.
