# Content Hub — Independent Technical Audit

**Auditor stance:** external takeover engineer. All claims below are verified against source or DB unless explicitly marked "cannot verify".

---

## 1. Overall Completion

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

**Aggregate project completion: ~65%.**

---

## 2. Pages (`src/pages/`)

| Page | Status | Notes |
|---|---|---|
| `AIAssistant.tsx` | Complete | Uses `novee-chat` edge function. |
| `Analytics.tsx` | Partially Complete | Widget data sources not fully verified — likely mixed real + mock. |
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
| `Platforms.tsx` | Partially Complete | Prioritizes Direct Publishing panel for connected accounts. Static `platformsData.ts` still referenced for card metadata. |
| `Pricing.tsx` | Complete | Tied to Stripe checkout. |
| `Privacy.tsx` / `Terms.tsx` | Complete | Static. |
| `Projects.tsx` | Complete | `useProjects` DB-backed. |
| `Reports.tsx` | Placeholder | Preview uses `mockChartData`; no real report generation. |
| `Settings.tsx` | Complete | Delegates to settings subcomponents. |
| `Strategies.tsx` | Partially Complete | `generate-strategy` edge function wired; `strategiesData.ts` still imported in places. |
| `Templates.tsx` | Partially Complete | Templates store present; sync depth not verified. |
| `Users.tsx` | Complete | Admin-gated, DB-backed. |
| `WorkflowTest.tsx` | Complete | Dev-only diagnostic. |

---

## 3. Edge Functions (`supabase/functions/`)

| Function | Status | Notes |
|---|---|---|
| `content-pipeline` | Complete | OpenAI generation, NOT NULL fallbacks, writes to `awaiting_review`. |
| `schedule-from-templates` | Complete | Reads inlined per-platform schedules, matches JSON source of truth, cron-auth via `x-cron-secret`. |
| `publish-due-posts` | Complete | Atomic claim, direct + webhook paths, SSRF-safe, Twitter refresh, cron-auth. |
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
| `scheduled-pipeline` | Unknown | Legacy path still invoked by `legacy-pipeline` cron. |

---

## 4. Database

- Tables: `posts`, `post_platforms`, `platform_oauth_tokens`, `oauth_states`, `pipeline_runs`, `automation_runs`, `automations`, `webhook_configs`, `subscribers`, `user_roles`, `profiles`, notes/projects/strategies/reports/templates, plus storage buckets `media` and `post-images`.
- RLS: enabled everywhere audited. Owner-scoped policies + admin overrides via `has_role`.
- Grants: `authenticated` + `service_role` on user-facing tables. `anon` restricted.
- Cron: `schedule-content` (15m), `publish-due-posts` (1m), `legacy-pipeline` (15m), all authenticated via `get_cron_secret()` header.
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

1. Reports module is largely placeholder (`mockChartData`).
2. Several dashboard widgets and static data files (`platformsData.ts`, `usersData.ts`, `notificationsData.ts`, `strategiesData.ts`, `reportsData.ts`, `automationData.ts`) are still referenced — mix of seed data vs. live queries not fully resolved.
3. No automated tests — refactors are unsafe.
4. Live publish (LinkedIn/X) has never been observed succeeding end-to-end in this audit.
5. Webhook publishing depends on the user configuring `webhook_configs`; nothing seeded.
6. Two legacy edge functions (`scheduled-pipeline`, `run-scheduled-automations`) coexist with the new pipeline — dead-code risk.
7. Mobile responsiveness, i18n coverage on new pages, and index/query performance not audited.

**Confidence in this audit: ~78%.** DB counts, cron state, file inventory, and static-data imports are verified from source. Not verified: per-widget data source on Analytics/Dashboard, mobile behaviour, index coverage, live OAuth provider config, MFA enrollment, password reset flow, and per-function validation/error handling depth. Anything marked "Unknown" above was not inspected in this pass.