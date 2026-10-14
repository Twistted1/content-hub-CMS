# Readiness gap analysis — open-source release & commercialization

**Scope:** read-only audit. Nothing was modified to produce this document.
**Revision:** `77d1f3b` (branch `go-live/phase-15-gap-closure`), 302 tracked files,
41 migrations, 15 edge functions, 197 files under `src/`.
**Method:** static analysis of source, migrations, workflows and docs.

**Provenance convention.** Findings are marked:
- **[V]** — independently re-verified by the author of this document against the
  files cited (a second pair of eyes, not a repeat of the same claim).
- **[A]** — reported by the automated audit pass and not separately re-verified.
  Treat as a strong lead, not as established fact.

Two claims the audit explicitly could not settle are listed under
"Not determined" at the end. Do not act on those without checking the live
project.

---

## Verdict

**Open-source: not ready, but close (~1–2 weeks).** The engineering itself is in
good shape — CI runs four real gates, RLS is consistently owner-scoped, no
secrets are committed, and the delivery path is now proven. What is missing is
packaging and *reproducibility*, and two of those gaps are hard blockers rather
than cosmetic: **the migration set cannot be replayed onto a fresh Supabase
project**, and **`vercel.json` pins the CSP to the original Supabase host**,
which would break every self-hosted deployment's API calls.

**Commercialization: not ready. ~2–3 weeks for a sell-the-software /
per-customer deployment model; ~6–10 weeks for genuine multi-customer hosted
SaaS.** The decisive finding is that this is a **single-tenant, global-admin**
data model, and that **billing has zero server-side enforcement**.

**Important reframe, so the sequencing is right:** single-tenancy blocks
*multi-customer hosted SaaS* only. It does **not** block open-source
self-hosting, nor per-customer dedicated deployments. The existing architecture
already fits the cheap path.

---

## Critical blockers

### 1. [V] The migration set cannot rebuild the database

`project_settings` and `subscribers` are referenced by policies, `ALTER TABLE`
and `CREATE INDEX` statements, but **no migration ever `CREATE TABLE`s them**.
Verified: a search of all 41 migrations for `CREATE TABLE … project_settings`
or `… subscribers` returns nothing.

Consequence: `supabase db push` onto an empty project fails partway through,
and the schema cannot be reproduced from the repository. There is also a live
contradiction about the shape of `project_settings` — one migration queries it
as key/value (`WHERE key = 'supabase_url'`, `20260323170000:31`) while another
treats it as wide columns (`config.supabase_url`, `20260429071001:10`). One of
those must be chosen before the table can be written down correctly.

This is consistent with the project's own history: `docs/MASTER_CHECKLIST.md`
(Phase 9) records that the disposable E2E Supabase project was rebuilt by
**introspecting live production** rather than by replaying migrations, because
the migration set contained a conflict (`automations` is `CREATE TABLE`'d twice
with different column sets). That workaround was applied to the test project and
never to the repository, so the underlying defect is still here.

**Nothing else on this list matters until this is fixed** — every other
self-hosting step depends on being able to build the schema.

### 2. [V] CSP pins the original Supabase host

`vercel.json:18` sets `connect-src 'self' https://jvbucspwcjahqpoxskvr.supabase.co
wss://…`. On any other deployment, the browser blocks **every** request to the
self-hoster's own Supabase project. The app loads and is completely
non-functional. `vercel.json:17` additionally sends CSP reports to the original
project.

### 3. [V] Cron jobs hardcode the original project URL

`20260601130235:51,66,81` schedule three `pg_cron` jobs whose
`net.http_post(url := …)` values point at
`https://jvbucspwcjahqpoxskvr.supabase.co/…`. On a self-hosted instance the
scheduled pipeline would **POST to someone else's project and silently never
run** — with no error surfaced in the UI. One of the three also targets
`scheduled-pipeline`, a function that no longer exists.

The `x-cron-secret` half of this pattern is already correct (read from Vault at
run time); only the URL needs the same treatment.

### 4. [V] Four Stripe price IDs hardcoded across three files

- `create-checkout/index.ts:13-18`
- `check-subscription/index.ts:12-15`
- `stripe-webhook/index.ts:115-118`

**[V] The dangerous part:** `stripe-webhook`'s `resolveTier` falls through to
`"free"` for any unrecognised price. A second deployment that updates two of the
three files **silently downgrades paying customers to free** — the payment
succeeds, the webhook returns 200, and the customer has no entitlement. There is
no `STRIPE_PRICE_*` env indirection and no shared map.

---

## Security & commercial findings

### [V] Billing has zero server-side enforcement

No edge function ever **reads** the `subscriptions` table. A search across all
15 functions finds only **writes**: `stripe-webhook:95` and
`demo-login:158` (both upserts).

The only tier gate in the entire codebase is cosmetic and client-side
(`src/components/layout/Sidebar.tsx:140`, `tier !== "pro"`). Consequence: **any
authenticated free user can call `content-pipeline`, `novee-chat` or
`generate-strategy` directly and consume the owner's OpenAI/Gemini budget.** The
tier is decoration, not an entitlement boundary. This must be fixed before any
paid offering exists, and it is the single highest-value security fix on this
list.

### [V] A 14-day free trial is advertised but not implemented

`src/i18n/locales/en.json:1992` ("14-day free trial"), `:1888` (FAQ: "After your
14-day trial, you'll be moved to the Free plan…") and `src/pages/Landing.tsx:231`
all promise a trial. A search of the whole repository finds **no
`trial_period_days`** — `create-checkout/index.ts:98-109` sets no trial, and no
trial state is tracked anywhere.

This is a false-advertising and chargeback exposure, and it predates any
commercial ambition. Either implement it or remove the claim before charging
anyone.

### [V] Broad and inconsistent cost controls

The one pre-flight budget check (`content-pipeline/index.ts:104-130`) has three
problems:

1. **It is instance-global, not per-user.** `:110-113` sums `cost_estimate`
   across **all** users (no `.eq('user_id', …)`) against one shared limit from
   `project_settings.monthly_openai_budget`. One heavy user exhausts the budget
   and **402s everyone else** — accidental cross-customer denial of service.
2. **Two of the three AI call sites have no check at all.** `monthly_openai_budget`
   appears only in `content-pipeline:120`. `novee-chat` calls OpenAI with no
   budget guard, and `generate-strategy` calls Gemini with none.
3. The estimate is a hardcoded guess (`:209-234`: ~$0.01 GPT-4o + $0.04 DALL·E),
   not real token accounting.

### [V] `admin` is a global super-admin — a cross-tenant exposure for SaaS

`has_role()` (`20260123023329:45-58`) is a `SECURITY DEFINER` lookup against a
**global** `user_roles` table with no tenant column, and ~30 tables use
`USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'))`. The policies
are explicit: "Admins can view all profiles/roles/subscriptions"
(`20260123023329:111-113,136-142,149-155`), and `src/hooks/useUsers.ts:29` lists
all `user_roles` unfiltered while `:124-131` rewrites any user's role.

So on a shared deployment, **any customer granted `admin` can read and edit
every other customer's content, roles and billing.** Multi-tenant SaaS requires
splitting "instance super-admin" (you) from "per-tenant admin" (customer).

`project_settings` is likewise a single global row (`.select('*').single()` at
`content-pipeline:116`; `SELECT * INTO config … LIMIT 1` at
`20260429071001:10`; admin-only RLS at `20260501003435:5-27`; no `user_id`
column anywhere), and `invitations` (`20260222000002:7-16`) is global with
`UNIQUE(email)` and no tenant column.

---

## Self-hosting blockers

| Item | file:line | Severity | Provenance |
|---|---|---|---|
| Migration set cannot replay (`project_settings`, `subscribers`) | see #1 above | **CRITICAL** | [V] |
| CSP `connect-src` pins the original Supabase host | `vercel.json:18` | **CRITICAL** | [V] |
| 3 `pg_cron` URLs hardcode the original project | `20260601130235:51,66,81` | **CRITICAL** | [V] |
| Stripe price IDs hardcoded ×3 files, silent `free` fallthrough | see #4 above | **CRITICAL** for a 2nd deployment | [V] |
| **`customer-portal` still uses a dead Lovable preview host as both allowed origin and fallback** — with `SITE_URL` unset, a paying customer's portal return lands on a dead page. Note: Phase 6 fixed *exactly this bug* in `create-checkout` and **missed this instance**. | `customer-portal/index.ts:56,62` | High | [V] |
| CSP report URIs point at the original project | `vercel.json:17-18` | High | [V] |
| Production Vercel URL as allowed origin + redirect fallback | `create-checkout:88,90,95` | Medium | [A] |
| Legacy Stripe product IDs hardcoded | `check-subscription:19`, `stripe-webhook:121` | Medium | [A] |
| Owner's social accounts + `contact@novusexchange.com` rendered in the footer of every page | `src/components/layout/Footer.tsx:6-10,30,122,126` | Trivial but user-visible in every fork | [V] |
| `VITE_SUPABASE_PROJECT_ID` exists in `.env` but is **never used in `src/`**; the one place needing it hardcodes the owner's dashboard link instead | `src/pages/Auth.tsx:307` | Low | [V] |
| `project_id` pinned to the owner's project | `supabase/config.toml:1` | Trivial (1 line) | [A] |
| Brand strings + emails hardcoded in ~20 lines × 2 locale files; rebrand = editing two large JSON files | `src/i18n/locales/en.json`, `pt.json` | Awkward | [A] |
| Supabase CLI scratch state committed to version control | `supabase/.temp/cli-latest` | Hygiene | [V] |
| **Four conflicting product names:** `package.json` + README say "Content Stream"; UI and docs say "Content Hub"; directory is `content-hub-CMS`; host is `content-cms-hub` | — | Trivial but confusing | [A] |

**Deliberately not a blocker:** the anon/publishable key in git history
(`20260323155000`). The owner has decided not to rotate — only already-public
values were exposed, the boundary is RLS, and the project ref is already public
via the client bundle. Recorded in `AGENTS.md`. **Do not re-raise.**

---

## Secret & credential audit (full history)

**Method:** all **1244 blobs across 625 commits on all refs** scanned
(`git cat-file --batch-all-objects`), 1233 text-decodable; the 10 binaries are
images/video plus `bun.lockb`, which was byte-inspected and contains only npm
registry URLs. `git fsck --unreachable` was empty and there were no stashes, so
nothing is outside the scan.

**[V] Verdict: no server-side secret exists in the working tree or anywhere in
history.** No `service_role` key, no Stripe/OpenAI/OAuth secret, no database
password, no cloud or GitHub token. **Credential leakage does not block
publishing the repository.** The blocking item is legal, not security — there is
no `LICENSE` (see below).

What *is* in history, and why each is acceptable or actionable:

| Value | Where | Assessment |
|---|---|---|
| Supabase **anon/publishable** JWT (`role: "anon"`, `exp` 2036) | `20260323155000…:9` (added `112999e`, sanitised `5ceb45e`); also `client.ts` and `.env` blobs historically | **Public by design — already in every production bundle.** Not service_role. Owner decision: no rotation. |
| **Sentry ingest DSN** (org/project IDs + 32-char key) | `.env` blob, added `ed49b76`, removed `b1685bc` | History only; ingest-only key. Cheap hygiene to rotate. Current value is `""`. |
| **E2E test password** (`E2E-test-password-1`, 18 chars) | [`.env.e2e.example:20`](../.env.e2e.example#L20) — **tracked today** | ⚠️ **Actionable.** Real value for the disposable E2E project `amyzklcdwrspazveutqz`, which **[V] still exists and answers on the network**. See below. |
| Stripe `sk_live_xxx…` / `sk_test_xxx…` | `IntegrationsSettings.tsx:62,70` | Placeholders, all `x`. Not real keys. |
| `stub-cron-secret` | `tools/publish-e2e/run.mjs:35` | Harness stub. The real cron secret is randomly generated in Vault (`20260601130235:12`) and never committed. |
| HIBP SHA-1 vector | `pwnedPassword.test.ts:5,6` | Test data. |

**Absent everywhere, zero hits:** `service_role` JWT, `sb_secret_`, `sbp_`, real
`sk_live_`/`sk_test_`/`whsec_`, `OPENAI_API_KEY` literals (only `Deno.env.get`),
`TWITTER_CLIENT_SECRET`/`LINKEDIN_CLIENT_SECRET` literals, `AKIA`,
`ghp_`/`gho_`/`github_pat_`, `postgres://` with a password, private keys, and
`DEMO_LOGIN` credentials.

**Workflow secrets:** every workflow uses `${{ secrets.* }}` with **no literal
values**. Only `e2e.yml` needs any — `E2E_SUPABASE_URL`,
`E2E_SUPABASE_PUBLISHABLE_KEY`, `E2E_SUPABASE_SERVICE_ROLE_KEY`. `ci.yml` needs
none. A self-hoster additionally needs the `.env.example` values plus the edge
secrets and the Vault `cron_secret` (see the self-host guide item in the
roadmap).

**`.env` was tracked historically** (`e7c3075` → untracked at `b1685bc`) and its
blobs remain in history; it never held a service_role key. It is ignored today.

**History rewrite is NOT required.** Nothing secret leaked, and a rewrite would
desynchronise every existing clone and CI checkout for no security gain.

### The one live credential item

⚠️ **[V] `.env.e2e.example:20` commits a real password, and the project it
belongs to is still live.** `https://amyzklcdwrspazveutqz.supabase.co/auth/v1/health`
answers `401 {"message":"No API key found in request"}` — a deleted project would
not respond at all. So the pair (project ref, which is also public in
`docs/MASTER_CHECKLIST.md`, plus this password) points at a real, reachable
project.

**I could not test whether the login actually works**, and that is the correct
outcome: the E2E project's anon key lives only in GitHub Actions secrets and was
accurately kept out of the repository, so there is no way to attempt an
authentication from here. **Treat the password as live until proven otherwise.**

Impact if it works: low — it is a disposable test project with no production
data. But it is a working credential in a repository you intend to publish.
**Fix:** change that user's password in the E2E project, and replace the literal
in `.env.e2e.example` with a placeholder (the file's other two values already are
placeholders, so this one is an outlier).

Note `has_role` EXECUTE remaining revoked from `anon` was independently
re-confirmed during this audit — the anonymous `articles` exposure is read-only
and cannot be written (see [HEADLESS_CONSUMPTION.md](./HEADLESS_CONSUMPTION.md)).

---

## Documentation inventory

| File | Status | Purpose |
|---|---|---|
| `README.md` | Current | Install, env, secrets table, Stripe webhook, layout, roles, testing. **Never mentions applying migrations or deploying edge functions.** Titled "Content Stream". References the removed `scheduled-pipeline` at `:62`. |
| `AGENTS.md` | Current | The best orientation doc in the repo — gotchas, deploy-gap warning, proven-deliverable status. |
| `docs/MASTER_CHECKLIST.md` | **Current — source of truth** | Completion status with per-item evidence. |
| `docs/READINESS_GAP_ANALYSIS.md` | Current | This document. |
| `docs/AUDIT_REPORT.md` | Stale (rev `59cdea98`) | Lifecycle audit; its `scheduleMode` finding is partly wrong (corrected in Phase 15). |
| `docs/AUDIT.md` | Superseded | Historical; banner in file. |
| `docs/PHASE_0_TESTING.md` | Superseded | Historical; "all items below are done". |
| `docs/PHASE_3_READINESS_REPORT.md` | Historical | 2026-07-31 "GO" report against the owner's live project. |
| `docs/YOUR_ACTION_ITEMS.md` | Stale | Owner-only tasks; still lists live delivery as never observed and recommends the Pro-only password toggle (superseded by the free HIBP implementation). |
| `tools/publish-e2e/README.md` | Current | Webhook-delivery harness docs. |

**Zero prior art:** a case-insensitive search for
`licen[cs]e|open-source|self-host|multi-tenant|white-label|SaaS` across every
`.md` file returns **no matches**. Licensing, self-hosting and tenancy have never
been discussed in this repository.

**Could a stranger get it running from the README alone? No.** Missing:
how to apply migrations (step zero — and it currently *fails*); how to deploy the
15 edge functions (a README-follower gets a frontend with no backend);
`GEMINI_API_KEY` (required by `generate-strategy:38-41`, reachable from the live
UI at `Automation.tsx:183`, and [V] **absent from `.env.example`** — the file
documents OpenAI, Stripe, Twitter and LinkedIn keys but not this one); OAuth
redirect-URI registration; that `pg_cron`/`pg_net` must be enabled; that Stripe
price IDs must be edited in source; Vercel deployment; and `SITE_URL`'s failure
mode.

---

## Missing standard files

- [ ] **`LICENSE`** — absent, and **never present in git history**.
  `package.json` is `"private": true` with no `license` field. Without a license
  the code is legally all-rights-reserved: **nobody may self-host or contribute.**
  Hardest blocker to an open-source release, and it is a *decision* more than
  work.
- [ ] `CONTRIBUTING.md`, `CODE_OF_CONDUCT.md`, `SECURITY.md` (a real gap given
  this handles OAuth tokens and Stripe webhooks), `CHANGELOG.md`
- [ ] `.github/ISSUE_TEMPLATE/*`, `.github/PULL_REQUEST_TEMPLATE.md`,
  `CODEOWNERS`, `dependabot.yml`
- [x] `.github/workflows/` — `ci.yml`, `e2e.yml`
- [ ] `.nvmrc` / `engines` — both absent; Node 22 is pinned only inside the
  workflows, so local contributors get no signal
- [ ] `.editorconfig`; no `seed.sql`; no local-dev (`supabase start`) story

---

## Quality gates

`.github/workflows/ci.yml` runs exactly four commands: `npx tsc --noEmit`,
`npm run lint`, `npm run test` (vitest), `npm run build`. No `npm audit`, no
coverage gate (the 15% thresholds in `vitest.config.ts` only apply to the
separately-invoked `test:coverage`), no migration validation, no function-deploy
check.

**E2E** is a separate workflow. Per `AGENTS.md`, and now [A] confirmed in source:
`e2e/global-setup.ts:26-40` sets `authAvailable = Boolean(url && serviceRoleKey)`,
and `e2e/authenticated.spec.ts:7-10` then self-skips the entire valuable block
while the job still reports success. The audit further reports that on a fresh
fork the *unauthenticated* specs **fail rather than skip**, because
`src/integrations/supabase/client.ts:11` calls `createClient("")` and supabase-js
throws `supabaseUrl is required.` — meaning an open-source fork's E2E job cannot
go green without provisioning a whole disposable Supabase project. That specific
behaviour is [A] and worth reproducing before relying on it.

---

## Roadmap

### (a) Credible open-source release — ~1–2 weeks

| # | Item | Effort |
|---|---|---|
| 1 | **Choose and add `LICENSE`**; set `package.json` `license`; drop `"private": true`. Permissive (MIT/Apache-2.0) vs AGPL vs open-core — this decision gates the rest. | 2h + a business decision |
| 2 | **Make migrations replayable** — add real `CREATE TABLE`s for `project_settings` and `subscribers`, resolve the EAV/wide-column contradiction, and **verify `supabase db push` onto a genuinely empty project**. | 2–3 days |
| 3 | **De-hardcode infrastructure** — cron URLs to Vault/config, templated CSP, unpin `project_id`, drop the Lovable fallback in `customer-portal`. | 1 day |
| 4 | **Rewrite the README as a self-host guide** — project creation → migrations → secrets (incl. `GEMINI_API_KEY`) → deploy all 15 functions → OAuth redirect URIs → Stripe products + webhook → cron verification → Vercel. | 1–2 days |
| 5 | `SECURITY.md`, `CONTRIBUTING.md`, CoC, issue/PR templates, changelog. | 1 day |
| 6 | `.nvmrc`, `engines`, `.editorconfig`; untrack `supabase/.temp`. | 1h |
| 7 | Make E2E fail loudly (or report a clear skip) when secrets are absent. | 0.5 day |
| 8 | Collapse the four product names to one; move brand strings/emails into a single config so forks can rebrand without editing two large locale files. | 1 day |
| 9 | **Env-driven Stripe price IDs**, one shared map — removes the 3-file sync footgun and the silent-downgrade path. Do this before a second deployment exists. | 0.5 day |
| 10 | **Server-side entitlement enforcement** (see Security findings) — arguably belongs in (a), not (b): it is a live cost leak today, not just a commercial gap. | 3–5 days |
| 11 | **Close the one live credential item:** change the E2E test user's password and replace the literal in `.env.e2e.example` with a placeholder. Add a **gitleaks-style secret scan to CI** so this cannot recur — the full-history audit found nothing else, so a scan now starts from a clean baseline. | 1h |

### (b) Commercial — two very different paths

**Path 1 — sell self-hosted licences / per-customer deployments (~2–3 weeks on
top of (a)).** Exploits the existing single-tenant design instead of fighting it.
Do items 1–10 and stop. Fastest route to revenue. Note that licence-key
enforcement in a self-hosted JS app is trivially bypassable, so price and
contract for it rather than attempting DRM.

**Path 2 — hosted multi-customer SaaS (~6–10 weeks minimum).** This is a
data-model rewrite, not packaging:

| # | Item | Effort |
|---|---|---|
| 1 | `organizations` + membership table; add `org_id` to ~30 tables; rewrite ~40 migrations of RLS from owner-or-admin to org-membership | **3–5 weeks** |
| 2 | **Split global super-admin from per-org admin** — today's cross-tenant exposure | 1 week |
| 3 | Server-side entitlement enforcement across all AI/publish functions | 3–5 days |
| 4 | Per-org budgets; add the missing checks to `novee-chat` / `generate-strategy` | 2–3 days |
| 5 | Per-org Stripe customers, seats; implement or remove the trial claim | 3–5 days |
| 6 | Tenant-isolation test suite (the thing that proves #1 actually holds) | 1 week |
| 7 | Per-tenant observability, backup/restore, DPA/privacy posture (the i18n privacy policy is boilerplate written for a single operator) | 1–2 weeks |

**Recommended sequencing:** do (a) 1–10 now — it unblocks both open-source
credibility and Path 1 revenue. Then choose Path 1 (ship) or Path 2 (only if the
hosted business case justifies the RLS surgery). **Do not start Path 2 before
(a)#2** — refactoring RLS on a schema that cannot be rebuilt is how you lose a
month.

---

## Not determined

Neither of these was resolvable from a read-only session. Confirm against the
live project before acting:

1. **Whether `project_settings` and `subscribers` actually exist in production.**
   They must, since policies reference them, but the `CREATE TABLE` is absent
   from the repository. This is **repo-side schema drift**, which is not the same
   as a broken production — do not treat it as an outage.
2. **Deployed edge-function versions vs. repository source.** `AGENTS.md` records
   that deployed versions cannot be read over the API, and a branch is not proof
   of what is live. As of 2026-10-14: `publish-due-posts` v11,
   `content-pipeline` v32, `schedule-from-templates` v13, `demo-login` v32 — all
   operator-confirmed, none machine-verified.
