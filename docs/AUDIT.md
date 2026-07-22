# Content Hub — Independent Technical Audit

**Auditor stance:** external takeover engineer. All claims below are verified against source unless explicitly marked "cannot verify".

---

## Addendum — Independent re-audit, 2026-07-22

A second, independent verification pass was run against this repo at commit `e2e086a` (branch `claude/project-completion-audit-o1xgt5`). Methodology: static source analysis, migration inspection, and a real `npm install` / `npm ci` attempt. **Live Supabase DB/advisor access was not available in this session** (MCP tool calls to inspect the live project were declined), so DB-runtime claims from the original audit (Section 1-6 below) are carried forward as **not re-verified this pass** — only what's checked against `supabase/migrations/*.sql` is newly confirmed. Everything in this addendum is evidence-backed with a file reference.

### New/corrected findings

| # | Finding | Severity | Evidence |
|---|---|---|---|
| 1 | **Fresh installs are broken.** `npm ci` and `npm install` both fail out of the box with `ERESOLVE`: `eslint@10.0.0` (declared in `package.json`) conflicts with `eslint-plugin-react-hooks@5.2.0`'s peer range (`^3‖^4‖^5‖^6‖^7‖^8‖^9`). Requires `--legacy-peer-deps` to install. No `.github/workflows` exist, so nothing catches this in CI — it will surface on the next clean deploy/clone. | **High** | Reproduced directly: `npm ci` → `ERESOLVE could not resolve … eslint-plugin-react-hooks@5.2.0`. |
| 2 | **Two lockfiles coexist** (`package-lock.json` and `bun.lock`), for a `package.json` whose scripts are npm-oriented. Different CI/deploy environments resolving from different lockfiles can silently diverge. | Medium | `bun.lock`, `package-lock.json` both present at repo root. |
| 3 | **i18n is effectively decorative.** `en.json`/`pt.json` define 112 leaf keys across 10 namespaces, but only **2 of 121** page/component `.tsx` files call `useTranslation` (`Sidebar.tsx`, `AppearanceSettings.tsx`). Every page body (Analytics, Reports, Automation, Calendar, etc.) is hardcoded English. The previous audit's "70%" i18n estimate is too high — it's closer to a nav-only language switcher. | Medium | `grep -rl useTranslation src --include=*.tsx` → 2 hits; `find src/pages src/components -name '*.tsx'` → 121 files. |
| 4 | **Dashboard widgets are more real than previously assessed.** `AudienceChart.tsx`, `PlatformPerformance.tsx`, `RecentPosts.tsx`, and `Analytics.tsx` all derive their charts directly from `usePosts()` (live DB query) with real empty-states — no mock arrays. The prior audit's "40%" for Analytics/Dashboard widgets was too pessimistic for these four; `StatsCard` itself is a pure presentational component fed by real data at the call site. | — (correction, upgrade) | Read in full: all four files, no `mock*` literals present. |
| 5 | **Reports module is confirmed placeholder**, not just "largely." `ReportPreviewDialog.tsx` hardcodes `mockChartData`, `mockBarData`, and `mockTableData` (fabricated revenue/conversion numbers) and renders them regardless of the `report` prop passed in. No code path connects this to real post/analytics data. | High (for Reports specifically) | `src/components/reports/ReportPreviewDialog.tsx:30-52`. |
| 6 | **`Platforms.tsx` and `Users.tsx` still source primary content from static seed files**, not the DB: `platformsData.ts` (`platforms, totalStats, recentActivity, availablePlatforms, overallPerformance, platformColors`) and `usersData.ts` (`roles, permissions, rolePermissions`). These aren't fallback/demo data — they're imported unconditionally into the page render path. | Medium | `src/pages/Platforms.tsx:24`, `src/pages/Users.tsx:36`. |
| 7 | **Correction (in the other direction):** `strategiesData.ts` is *not* fake content — it only supplies static config (`platformOptions`, `teamMemberOptions`, `statusConfig`), while `useStrategies.ts` performs a real Supabase query and `Strategies.tsx` renders from it. The original audit's grouping of `strategiesData.ts` alongside the other mock files overstates the gap here. | — (correction) | `src/hooks/useStrategies.ts:52-70`, `src/pages/Strategies.tsx:49`. |
| 8 | **RLS coverage confirmed at the migration level for all 20 tables** created in `supabase/migrations/`: `automation_runs, automations, invitations, media, notes, oauth_states, pipeline_runs, platform_oauth_tokens, post_platforms, posts, profiles, projects, reports, strategies, strategy_goals, subscriptions, tasks, user_platforms, user_roles, webhook_configs` all have an `ENABLE ROW LEVEL SECURITY` statement. (Policy *content* — whether each policy is correctly scoped — was not re-audited; that requires live DB inspection.) | — (positive, partial re-verification) | `grep` across all migrations, 20/20 tables matched. |
| 9 | **Cron setup is clean but a legacy job is still live.** Migration `20260601130235_...sql` correctly unschedules old duplicate jobs (`execute-automation-1min`, `run-scheduled-automations`, `run-scheduled-pipelines`, etc.) and installs 3 fresh ones via `pg_cron`+`pg_net`+Vault-stored secret: `schedule-content` (15m → `schedule-from-templates`), `publish-due-posts` (1m), and **`legacy-pipeline` (15m → `scheduled-pipeline`)**. The legacy function is still actively scheduled in parallel with the new pipeline, not retired — this is the dead-code risk the prior audit flagged, now confirmed as a *live, running* duplicate rather than just leftover code. | Medium | `supabase/migrations/20260601130235_3886e818-a9ab-4e65-84a5-e2fc8aff223c.sql:46-91`. |
| 10 | **SSRF guard on webhook publishing is solid**, contradicting nothing but worth confirming explicitly: `publish-due-posts/index.ts` requires `https:` and blocks loopback, `10.0.0.0/8`, `169.254.0.0/16`, `172.16.0.0/12`, `192.168.0.0/16`, and `localhost`/`::1` before allowing a webhook POST. No DNS-rebind protection (resolves at fetch time, not pre-validated), but reasonable for the stated scope. | — (positive) | `supabase/functions/publish-due-posts/index.ts:17-27`. |
| 11 | **No CI/CD pipeline at all.** No `.github/workflows`, no lint/typecheck/build gate on push or PR. Given finding #1, this means a broken install has no automated tripwire — it would only be caught by someone manually running `npm ci`. | Medium-High | `find .github` → nothing. |
| 12 | **No automated tests**, confirmed again this pass: zero `*.test.*`/`*.spec.*` files, no `vitest`/`jest`/`playwright` in `package.json`. Matches prior audit's "0%". | — (re-confirmed) | Full repo search, zero matches. |
| 13 | 5 leftover `console.log` calls across `src`/`supabase/functions`, no `TODO`/`FIXME`/`HACK` markers anywhere in the codebase (either genuinely clean or markers were stripped before commit). | Low | `grep -rc console.log`. |

### Revised completion estimate

Aggregate is still in the same band as the prior audit — **~65%** — but the composition shifted: **Dashboard/Analytics is materially more complete** than previously scored, while **i18n, build reproducibility, and CI/CD are materially less complete** than the "Unknown"/"70%" treatment implied. Reports remains the weakest functional module (confirmed placeholder). The single highest-leverage fix before any further feature work is **#1** (pin compatible `eslint`/`eslint-plugin-react-hooks` versions or drop one) — an unfixable install blocks everything downstream, including CI you don't yet have.

**Not re-verified this pass** (would require live DB/advisor access, which was unavailable): actual RLS policy scoping beyond "enabled," live cron execution history, Stripe webhook delivery, OAuth end-to-end publish success, MFA enrollment, password reset flow, index/query performance, mobile responsiveness.

---

## 1. Overall Completion (original pass, 2026-07-12)

| Area | % | Why |
|---|---|---|
| UI (pages/components) | **75%** | 27 pages routed, all render. Several rely on static seed data (`platformsData.ts`, `reportsData.ts`, `usersData.ts`, `notificationsData.ts`, `strategiesData.ts`, `automationData.ts`). |
| Auth | **85%** | Supabase Auth wired, demo-login edge function works, MFA UI uses real `supabase.auth.mfa` APIs, role check via `has_role` SECURITY DEFINER. Password reset flow not verified. |
| Database & RLS | **90%** | Tables have RLS, GRANTs, DELETE policies added on `pipeline_runs`/`automation_runs`, `subscribers` email validation + unique index. `search_path` pinned on trigger fn. |
| Automation pipeline | **70%** | Cron jobs live (`schedule-content` 15m, `publish-due-posts` 1m, `legacy-pipeline` 15m). `schedule-from-templates`, `content-pipeline`, `publish-due-posts` deployed. Real drafts generated into `awaiting_review`. Weekly activation via UI button seeds `automations` row. Not verified: full 7-day cycle in production. |
| Direct publishing (LinkedIn/X) | **60%** | OAuth init + callback + token refresh + `ugcPosts` / `/2/tweets` publish wired. Not verified: real end-to-end publish with connected accounts. |
| Webhook publishing (IG/FB/TikTok/YT/Rumble/Podcast/Website) | **50%** | Code path exists in `publish-due-posts`, SSRF-hardened. Requires user to configure `webhook_configs` per platform. No verification of real delivery. |
| Calendar | **80%** | Month view uses brand colors (X `bg-blue-500`, IG `bg-pink-500`, TikTok `bg-black`, LinkedIn `bg-blue-700`, YouTube `bg-red-600`). Per-platform char counters live. Template ghost slots render. |
| Schedule source of truth | **85%** | Corrected frequencies applied to all `src/data/platforms/*.json`; `schedule-from-templates` mirrors them. Website categories cycle Mon–Sun via `WEBSITE_CATEGORY_BY_DAY`. |
| Analytics / Dashboard widgets | **40%** | `AudienceChart`, `PlatformPerformance`, `RecentPosts`, `StatsCard` — data source per widget not audited this pass; some appear to still consume mock arrays. |
| Reports | **30%** | `ReportPreviewDialog` uses `mockChartData`. `CreateReportDialog` UI present. No real report generation pipeline. |
| Stripe billing | **80%** | `create-checkout`, `customer-portal`, `check-subscription`, `stripe-webhook` deployed. Origin allowlist added. Not verified against live Stripe. |
| i18n | **70%** | `en` + `pt` locales present; coverage across all new pages/components not audited. |
| Tests | **0%** | No test files found. |
| Mobile responsiveness | **Unknown** | Not audited this pass. |

**Aggregate project completion: ~65%.** *(See addendum above — Dashboard/Analytics should be scored materially higher, i18n and CI/CD materially lower.)*

---

## 2. Pages (`src/pages/`)

| Page | Status | Notes |
|---|---|---|
| `AIAssistant.tsx` | Complete | Uses `novee-chat` edge function. |
| `Analytics.tsx` | Complete | *(Corrected 2026-07-22: fully DB-backed via `usePosts()`, no mock data — see addendum #4.)* |
| `Articles.tsx` | Partially Complete | Reads posts from DB; article-specific fields depend on `content-pipeline` output. |
| `Auth.tsx` | Complete | Sign in / sign up / demo login working. |
| `Automation.tsx` | Partially Complete | Weekly Activate button seeds automation; per-platform view exists. Not tested end-to-end in prod. |
| `Calendar.tsx` | Partially Complete | Month view + brand colors + char counters done; week/day views not re-audited this pass. |
| `ContentModel.tsx` / `ContentModels.tsx` | Partially Complete | CRUD present; unclear how deeply used downstream. |
| `ContentPipeline.tsx` | Partially Complete | Reads `pipeline_runs`; review inbox path works. |
| `GanttChart.tsx` | Complete | Standardized title, renders from posts. |
| `ImportData.tsx` | Complete | CSV/JSON wizard, maps to `posts`. |
| `Index.tsx` | Complete | Landing/dashboard root. |
| `Landing.tsx` | Complete | Marketing page. |
| `NotFound.tsx` | Complete | 404. |
| `Notes.tsx` | Complete | `useNotes` hook backed by DB. |
| `Platforms.tsx` | Partially Complete | *(Confirmed 2026-07-22: `platformsData.ts` supplies primary card metadata/stats, not just fallback — see addendum #6.)* |
| `Pricing.tsx` | Complete | Tied to Stripe checkout. |
| `Privacy.tsx` / `Terms.tsx` | Complete | Static. |
| `Projects.tsx` | Complete | `useProjects` DB-backed. |
| `Reports.tsx` | Placeholder | *(Confirmed 2026-07-22: preview dialog hardcodes fabricated revenue/conversion numbers — see addendum #5.)* |
| `Settings.tsx` | Complete | Delegates to settings subcomponents. |
| `Strategies.tsx` | Complete | *(Corrected 2026-07-22: `useStrategies.ts` is real DB-backed; `strategiesData.ts` only supplies static config lists — see addendum #7.)* |
| `Templates.tsx` | Partially Complete | Templates store present; sync depth not verified. |
| `Users.tsx` | Partially Complete | *(Corrected 2026-07-22: `usersData.ts` supplies role/permission definitions used directly in render — see addendum #6.)* |
| `WorkflowTest.tsx` | Complete | Dev-only diagnostic. |

---

## 3. Edge Functions (`supabase/functions/`)

| Function | Status | Notes |
|---|---|---|
| `content-pipeline` | Complete | OpenAI generation, NOT NULL fallbacks, writes to `awaiting_review`. |
| `schedule-from-templates` | Complete | Reads inlined per-platform schedules, matches JSON source of truth, cron-auth via `x-cron-secret`. |
| `publish-due-posts` | Complete | Atomic claim, direct + webhook paths, SSRF-safe (confirmed 2026-07-22, see addendum #10), Twitter refresh, cron-auth. |
| `publish-post` | Complete | Manual publish per post; LinkedIn + X only. |
| `linkedin-oauth-callback` | Complete | HTML-escaped error reflection; stores tokens. |
| `twitter-oauth-callback` | Complete | PKCE, HTML-escaped errors, stores tokens. |
| `oauth-init` | Complete | Returns provider auth URLs with state/PKCE. |
| `demo-login` | Complete | Seeds/impersonates demo user. |
| `novee-chat` | Complete | AI assistant. |
| `generate-strategy` | Complete | Input-validated, sanitized, 500-char cap. |
| `create-checkout` / `customer-portal` | Complete | Origin allowlist, Stripe wired. |
| `check-subscription` | Complete | Reads subscription state. |
| `stripe-webhook` | Complete | Handles subscription lifecycle. |
| `run-scheduled-automations` | Unknown | Present but overlaps with new pipeline; may be legacy. |
| `scheduled-pipeline` | **Confirmed live legacy** | *(2026-07-22: still actively cron-scheduled every 15m as `legacy-pipeline`, running in parallel with `schedule-from-templates` — see addendum #9. Not dead code, but arguably should be.)* |

---

## 4. Database

- Tables: `posts`, `post_platforms`, `platform_oauth_tokens`, `oauth_states`, `pipeline_runs`, `automation_runs`, `automations`, `webhook_configs`, `subscribers`, `user_roles`, `profiles`, notes/projects/strategies/reports/templates, plus storage buckets `media` and `post-images`.
- RLS: enabled everywhere audited, **re-confirmed at the migration level for all 20 tables on 2026-07-22** (see addendum #8). Owner-scoped policies + admin overrides via `has_role`.
- Grants: `authenticated` + `service_role` on user-facing tables. `anon` restricted.
- Cron: `schedule-content` (15m), `publish-due-posts` (1m), `legacy-pipeline` (15m), all authenticated via `get_cron_secret()` header. **`legacy-pipeline` confirmed still active, not retired (addendum #9).**
- Security: `update_updated_at_column` pinned to `search_path=public`. `subscribers` has unique lower(email) index + email format check.

---

## 5. Integrations

| Integration | Status |
|---|---|
| Supabase (Auth, DB, Edge, Storage) | Complete |
| OpenAI (content-pipeline, novee-chat, generate-strategy) | Complete |
| LinkedIn OAuth + publish | Partially Complete — end-to-end not verified with a real connected account |
| X (Twitter) OAuth + publish | Partially Complete — same |
| Stripe (subscriptions + portal) | Complete — not verified against live account |
| Instagram / Facebook / TikTok / YouTube / Rumble / Podcast / Website | Placeholder — webhook path exists; direct APIs not implemented |
| Sentry (referenced in README) | Unknown — not verified in code this pass |

---

## 6. Known gaps / risks

1. Reports module is placeholder (`mockChartData`) — **confirmed, not just "largely," on 2026-07-22.**
2. `platformsData.ts` and `usersData.ts` still supply primary render content on `Platforms.tsx`/`Users.tsx` — **confirmed 2026-07-22**. `strategiesData.ts` is legitimate static config, not mock content — **corrected 2026-07-22**.
3. No automated tests — refactors are unsafe. **Re-confirmed 2026-07-22.**
4. Live publish (LinkedIn/X) has never been observed succeeding end-to-end in this audit.
5. Webhook publishing depends on the user configuring `webhook_configs`; nothing seeded.
6. `scheduled-pipeline` (`legacy-pipeline` cron) coexists with the new pipeline — **confirmed still actively scheduled every 15 minutes on 2026-07-22**, not just dead code risk.
7. Mobile responsiveness, i18n coverage (**confirmed materially incomplete 2026-07-22 — 2/121 files use `useTranslation`**), and index/query performance not fully audited.
8. **New (2026-07-22): fresh `npm ci`/`npm install` fails without `--legacy-peer-deps`** due to an `eslint`/`eslint-plugin-react-hooks` version conflict, and there is no CI to catch it.
9. **New (2026-07-22): two lockfiles present** (`package-lock.json` + `bun.lock`) for an npm-scripted project — risk of divergent dependency resolution across environments.

**Confidence in original audit: ~78%.** DB counts, cron state, file inventory, and static-data imports are verified from source. Not verified: per-widget data source on Analytics/Dashboard, mobile behaviour, index coverage, live OAuth provider config, MFA enrollment, password reset flow, and per-function validation/error handling depth. Anything marked "Unknown" above was not inspected in that pass.

**Confidence in 2026-07-22 addendum: static-analysis findings (items 1-3, 5-9, 11-13) are high-confidence — reproduced directly or grep-verified with file:line references. Items 4, 6, 7, 10 are full-file reads, also high-confidence. DB-runtime items (live RLS policy behavior, cron execution history, OAuth/Stripe live delivery) were not re-verified — live Supabase tool access was unavailable this session.**
