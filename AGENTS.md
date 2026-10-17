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
- `docs/OPEN_DECISIONS.md` — **the short list of what is still outstanding**: the
  decisions only the owner can make, the actions needing access an agent does not
  have, and optional engineering. Read this for the current to-do;
  `MASTER_CHECKLIST.md` is the full history behind it.
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
- `supabase/functions/_shared/publishDelivery.ts` — the single outbound webhook
  contract (envelope shape, per-platform truncation, `delivery_id`). Imported by
  both delivery functions; change it here, not at call sites.
- `supabase/functions/content-pipeline/` — OpenAI generation with cost controls.
- `tools/publish-e2e/`, `tools/stripe-e2e/` — the two harnesses above.
- `tools/webhook-receiver/` — a working reference receiver (signature
  verification, replay window, de-duplication, `articles` field mapping,
  dry-run by default). Run its self-test with
  `node tools/webhook-receiver/selftest.mjs`. Adapt `toArticleRow` for your own
  endpoint, or swap it for a Meta Graph API call.
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
  `articles` is the **live feed for novusexchange.com** (owner-confirmed, and
  verified in the separate site repo: `services/articleService.ts:116` is its only
  reader, and it never queries `posts`/`post_platforms`). But **no migration
  creates those tables and no code in `src/` or `supabase/functions/` reads or
  writes them** — they were created in the dashboard. The CMS's own `posts` table
  is closed to `anon` (RLS requires `auth.uid()`, and `has_role` EXECUTE is
  revoked from `anon`, so anon gets a hard `401 permission denied for function
  has_role` rather than an empty result). Two disconnected content systems; a
  bridge is planned but **`articles` has no status column, so any insert is live
  on the public site immediately** — it must be an explicit human action, never
  an automatic sync. See `docs/HEADLESS_CONSUMPTION.md`.
- **AI spend is enforced AND tier-aware, as of 2026-10-16.** Was: a flat
  per-user cap regardless of plan, and before that, enforcement was absent
  entirely. Both earlier versions of this bullet are superseded.
  - `supabase/functions/_shared/aiBudget.ts`, called before every paid call in
    `content-pipeline`, `novee-chat` and `generate-strategy`. Applies an
    instance-wide monthly ceiling (`project_settings.monthly_openai_budget`,
    default 50) **and a per-user monthly cap that now varies by the caller's
    row in `public.subscriptions`**: free $1, starter $5, pro/enterprise $15
    (`TIER_MONTHLY_AI_BUDGET` in that file — an internal OpenAI/Gemini cost
    ceiling, not the Stripe price the customer pays). A missing subscription
    row, a read error, or a stored tier whose `end_date` has passed all
    resolve to free — conservative by construction. `enterprise` exists in the
    `subscription_tier` enum but has no Stripe price wired up anywhere yet;
    treated the same as `pro`.
  - This was "the plan is decorative" until now — the only other gate is
    client-side (`Sidebar.tsx:140`). A free user can still call these
    functions, but is now actually refused at $1/month by entitlement, not
    just eventually rate-limited by a cap that didn't know about tiers.
  - `ai_usage_log` and `per_user_monthly_budget` were created in the
    dashboard, not by a migration — the same drift as `articles`/`authors`.
    Migration `20261016014921_add_ai_usage_tracking.sql` creates both, because on
    a fresh environment their absence made the check silently always pass.
    (An earlier parallel fix, `20261019000001_add_ai_usage_log.sql`, was deleted
    as a duplicate — confirmed never applied to production via
    `supabase_migrations.schema_migrations`.) `aiBudget.ts` logs read/write
    failures loudly and flags `degraded: true` on the result rather than
    swallowing them (fail-open deliberately, like the HIBP check — but never
    silently). The `per_user_monthly_budget` column itself is no longer read for
    enforcement (superseded by the tier map above) but is left in the schema
    rather than dropped.
- **The migration set could not rebuild the database — the direct cause is now
  fixed, but this is not fully re-proven end to end.** `project_settings` and
  `subscribers` were policy'd and altered but never `CREATE TABLE`d, which is
  what made every later migration that touches either table (starting
  `20260323170000`) fail against an empty project. Migration
  `20260123000000_baseline_project_settings_subscribers.sql` (dated before all
  others) now creates both, with the column shapes introspected from
  production on 2026-10-16 and RLS enabled, no policies (later migrations
  already add those by name). Verified by applying it — and the separate
  `ai_usage_log` migration — to the `content-hub-cms-e2e-test` project; **not**
  verified by a full `supabase db push` from a truly empty project through the
  entire migration chain, so treat that as fixed-but-unconfirmed rather than
  closed. Two early cron-setup migrations (`20260323170000`, `20260429071001`)
  query `project_settings` with a key/value shape and a wide-column shape
  respectively, neither of which matches the real table — but both jobs
  (`run-scheduled-pipelines`, `run-scheduled-automations`) were unscheduled by
  `20260601130235_3886e818-a9ab-4e65-84a5-e2fc8aff223c.sql`, confirmed via live
  `cron.job` on 2026-10-17: only `publish-due-posts` and `schedule-content` are
  active, both vault-secret-authenticated and neither touching
  `project_settings`. The two old files are annotated (header comment only, SQL
  untouched — editing an applied migration is unsafe) rather than edited, since
  they're a historical record that already ran. Also note `invitations`
  404s live despite a migration creating it — migrations are **not** a
  faithful mirror of production either way.
- **`project_settings` is one global row** (`.select('*').single()`), so all
  config is instance-wide. The AI budget check now applies **both** an
  instance-wide ceiling and a per-user cap (see the enforcement bullet below), so
  a single heavy user can no longer 402 everyone — but the *settings themselves*
  are still global, with no tenant dimension.
- **`admin` is a global super-admin, not a tenant admin.** `has_role()` reads a
  global `user_roles` table with no tenant column, and ~30 tables use
  `auth.uid() = user_id OR has_role(auth.uid(),'admin')`. There is **no tenant /
  organization / workspace concept anywhere** — the app is single-tenant. Any
  customer granted `admin` can read and edit every other user's content, roles
  and billing. Multi-customer SaaS requires splitting the two.
- **Stripe price IDs live in ONE table, `supabase/functions/_shared/stripePrices.ts`**
  (corrected 2026-10-16 — this bullet used to say they were hardcoded in three
  files, and that *was* the bug). `create-checkout`, `check-subscription` and
  `stripe-webhook` all derive from it, so the three can no longer disagree.
  Previously updating two of the three left the third resolving a real price as
  unrecognised → `"free"`, silently downgrading a paying customer after taking
  their money. Overridable via `STRIPE_PRICE_STARTER_MONTHLY`,
  `STRIPE_PRICE_STARTER_YEARLY`, `STRIPE_PRICE_PRO_MONTHLY`,
  `STRIPE_PRICE_PRO_YEARLY`; unset means the built-in values, so behaviour is
  unchanged until someone opts in. Deliberately **not** memoised — a warm edge
  function caching a stale secret is a failure this project has already had. An
  unrecognised price is now logged with its `priceId`, and a duplicate mapping is
  reported. The UI's display prices now come from one place,
  `src/data/pricing.ts` (`Pricing.tsx` and `Landing.tsx` both import it —
  fixed 2026-10-17, they used to hardcode the same numbers twice
  independently), pinned against a `DISPLAY_AMOUNTS_USD` table in
  `_shared/stripePrices.ts` by `src/utils/pricingParity.test.ts`. Confirmed
  against live Stripe price objects on 2026-10-17: $10/$96/$20/$192 all
  matched, so this closed a structural risk rather than an active bug. There
  is still no live fetch from Stripe — a real price change means updating
  `PLAN_PRICING_USD` and `DISPLAY_AMOUNTS_USD` by hand, together, or the test
  fails.
- **There is no free trial, and the landing page no longer claims one** (fixed
  2026-10-16 — owner chose to drop the claim rather than implement it). The
  product has a free tier instead. If you're adding trial-related UI copy,
  don't — there's still no `trial_period_days` anywhere in the Stripe
  checkout flow to back it up.
- **Webhook deliveries are signed only if `WEBHOOK_SIGNING_SECRET` is set.** With
  it set, every delivery carries `X-Novus-Signature: sha256=<hex>` (HMAC over the
  exact raw body), plus `X-Novus-Delivery-Id` and `X-Novus-Timestamp`. **Unset,
  deliveries still go out but UNSIGNED** — the delivery result records
  `signed: false` so the gap is visible, but an unsigned receiver has to trust
  anything that reaches its URL. Verify against the **raw bytes**, never a
  re-serialised body; `tools/webhook-receiver/server.mjs` reads the buffer first
  for that reason. De-duplicate on `delivery_id`, which is stable across retries
  (the CMS retries with backoff, so ignoring it publishes up to 5 times).
- **`/pipeline`'s webhook form can set custom headers** (one `Key: Value` per
  line) as of 2026-10-19, so a receiver needing an auth token no longer requires
  a direct database write. Still missing on that path: **no per-webhook shared
  secret** (signing uses one deployment-wide `WEBHOOK_SIGNING_SECRET`), and it
  only ever fires `post.publish`, so an edit or an unpublish cannot be
  propagated to a receiver.
- **The webhook delivery contract is defined once, in
  `supabase/functions/_shared/publishDelivery.ts`**, and imported by both
  `publish-due-posts` (scheduled/cron path) and `content-pipeline` (immediate
  path). They previously sent *different* envelopes — `post.publish` with a
  top-level `platform` in one, `post.published` with a nested `platforms` array
  in the other — so a receiver written against one silently mishandled the other.
  Per-platform caption truncation also happens there (nothing truncated before: a
  long article hard-failed LinkedIn/Instagram while X was silently cut to 280).
  Change the shape in that one file, never at a call site.
  `src/utils/publishPayloadParity.test.ts` imports it directly and pins the
  envelope, the limits (against `src/utils/platformLimits.ts`) and the truncation
  behaviour.
- **LinkedIn, X, and now Facebook publish directly; everything else needs a
  webhook.** `publish-due-posts`/`publish-post` dispatch `facebook` on its own
  branch (checked before `DIRECT_PLATFORMS = {linkedin, twitter}`), added
  2026-10-17. Facebook is structurally different from LinkedIn/Twitter: it
  uses one **deployment-wide** Business Manager System User token
  (`META_SYSTEM_USER_TOKEN` + `META_PAGE_ID` edge function secrets), not a
  per-user row in `platform_oauth_tokens` — there is no "Connect Facebook"
  OAuth flow, and `isDirectPlatform()` in `usePlatformOAuth.ts` deliberately
  excludes it from that Connect-button UI while `DirectPlatform` (the type
  `publish-post` accepts) includes it. Both secrets unset is a configured,
  caught failure (`"Facebook publishing not configured"`), not a crash.
  Facebook posts text-only via `/{page}/feed`; a `cover_image_url` switches to
  `/{page}/photos` (by URL, no container/upload step — simpler than
  Instagram's two-call media flow). **Not yet exercised in production** — the
  two secrets are not yet set; see `docs/OPEN_DECISIONS.md`. Every platform
  besides linkedin/twitter/facebook still needs a matching active row in
  `webhook_configs` or the post fails with
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
- **`rumble` and `podcast` are now reachable from the UI** (fixed 2026-10-17 —
  added to `ContentPipeline.tsx`'s `PLATFORM_OPTIONS` and `Automation.tsx`'s
  platform whitelist). Reachable is not the same as deliverable: `rumble` still
  needs an active `webhook_configs` row like every other non-direct platform
  (none exists in production as of this writing — see `docs/OPEN_DECISIONS.md`
  B2), and `podcast` has no `src/data/platforms/*.json` entry, so it never
  appears in the templated weekly schedule — only direct/manual pipeline runs
  or automations can target it. Don't assume a schedule entry for either one
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
