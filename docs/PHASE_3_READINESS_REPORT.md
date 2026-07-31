# Content Hub CMS — Final Readiness Assessment Report
### Phase 3 Audit — 5 independent parallel agents, verified against live source + live Supabase (`jvbucspwcjahqpoxskvr`) + live GitHub state

**Date:** 2026-07-31
**Baseline compared against:** `docs/AUDIT.md` (2026-07-12 + 2026-07-22) and `docs/MASTER_CHECKLIST.md` (2026-07-29) — neither was trusted; every claim was independently re-checked.
**Branch audited:** `claude/project-completion-audit-o1xgt5` @ `9115c17` (in sync with `main`).

---

## Executive Summary

**Verdict: GO.** (Was CONDITIONAL GO at audit time; both blockers below were fixed and verified live same day.)

The core CMS is solid: build/lint/typecheck/tests are all clean, CI is green on both branches, the RLS performance and security fixes from earlier this session hold up under fresh advisor scans, production auth is working with no error signal, the CSP is syntactically sound, no secrets are exposed in source, and the content-publishing pipeline (cron jobs, Stripe billing functions) is live and running correctly.

Four real, previously-undocumented issues were found — all fixed same day:

1. ~~**Avatar upload is broken in production**~~ — **fixed 2026-07-31.** The `avatars` storage bucket didn't exist; created it live with owner-scoped policies, verified.
2. ~~**The Automation dashboard shows 9-day-stale data**~~ — **fixed 2026-07-31.** `schedule-from-templates` now writes `automation_runs` on every cron pass instead of only the retired legacy pipeline; verified a fresh run row landing live.
3. ~~**Edge function drift**~~ — **investigated and neutralized 2026-07-31.** What started as "6 functions live but missing from the repo" turned out to include 3 real, currently-exploitable authorization gaps (see below) — not just stale duplicates. All 6 confirmed to have zero live callers (no cron, no frontend code) and redeployed as inert 410 stubs.

---

## Module-by-Module Scorecard

| Module | Agent | Result | Notes |
|---|---|---|---|
| Build / Lint / Typecheck / Tests | A | **PASS** | Build clean, lint 0 errors, `tsc --noEmit` clean, 63/63 tests pass |
| CI (GitHub Actions) | A | **PASS** | `ci.yml` + `e2e.yml` green on `main` and current branch at HEAD |
| Dependency audit | A / E | **PARTIAL** | 1 known HIGH advisory (react-router RSC-CSRF), inapplicable (no RSC usage), no non-breaking fix exists |
| Branch protection on `main` | A | **UNVERIFIABLE** | No GitHub tool exposes ruleset/branch-protection state — needs manual UI confirmation |
| RLS / security advisors | B / E | **PASS** | 0 `auth_rls_initplan`, 0 `multiple_permissive_policies`; only 2 accepted WARNs remain (documented) |
| Migrations applied to prod | B | **PASS** | All 3 claimed migrations present and verified live |
| Storage `post-images` policy | B | **PASS** | No public listing policy; direct-GET via `public=true` bucket flag only (expected) |
| Auth (email/password) | B / E | **PASS** | Live logs clean, no `email_provider_disabled` errors, successful logins observed |
| Auth (Google OAuth) | E | **UNVERIFIABLE** | No tool exposes provider config; user setup still in progress per prior session |
| Schema drift (live vs. code) | B | **PARTIAL** | `avatars` bucket missing (broken feature); `invitations` table missing (gracefully degraded, not broken) |
| CSP header | E | **PASS (syntax)** | Valid, consistent directives; "zero violations" claim unverifiable — no CSP reporting endpoint configured |
| Secrets exposure | E | **PASS** | No hardcoded credentials found; `.env*` correctly gitignored |
| Dashboard crash bug fix | C | **PASS** | `completedAutomationRunsCount` correctly in-scope, semantically correct, no similar bugs found elsewhere |
| i18n key parity | C | **PASS** | Own parity test suite passes 3/3; all 12 session-added keys verified in both locales |
| i18n hardcoded-string sweep | C | **PARTIAL** | Minor only: 2 aria-labels (Calendar), 3 placeholder examples — no egregious untranslated sections |
| Mobile responsiveness | C | **PARTIAL / UNVERIFIABLE** | Static-only (sandbox can't reach live auth); Calendar grid flagged as likely cramped on narrow viewports |
| Edge functions (repo vs. live) | D | **FIXED — was drift, found live auth gaps** | 6 orphaned functions found; 3 had real authz gaps (unauthenticated cost-drain, cross-user publish, cross-user webhook leak); all stubbed |
| Cron jobs | D | **PASS** | Live state matches migrations; legacy duplicate job correctly unscheduled |
| Automation feature (data pipeline) | D | **FAIL** | Real pipeline runs correctly; its reporting table (`automation_runs`) is frozen at 9-day-old data |
| Billing (Stripe edge functions) | D | **PASS** | `check-subscription`, `create-checkout`, `customer-portal`, `stripe-webhook` all deployed, match code |
| Leaked-password protection | E | **PASS (unchanged)** | Confirmed still off, matches known Free-plan billing decision, no surprise |

---

## Resolved Since Baseline (confirmed, not assumed)

- Dashboard crash bug (`completedRuns` scope bug) — verified fixed and semantically correct.
- 81 RLS `auth_rls_initplan` performance warnings — verified 0 remain, `(select auth.uid())` pattern confirmed on all 84 policies.
- `post-images` public listing policy — verified removed.
- Unindexed FKs (3) and overlapping SELECT policies (7) — verified fixed, 0 `multiple_permissive_policies` warnings remain.
- i18n gap (9 real files) — verified complete, parity test passing, no regressions.
- Production email/password login (`email_provider_disabled`) — verified fixed, clean logs since.
- CSP header — verified syntactically sound, live on production.
- react-router v6→v7 — verified low-risk (classic API only), 3 original advisories resolved.
- Legacy duplicate cron job — verified unscheduled, matches migration.

- ~~**Avatar upload broken in production**~~ — **fixed 2026-07-31**, same day as this audit. `avatars` bucket created directly on prod (`create_avatars_bucket` migration) with owner-scoped INSERT/UPDATE/DELETE policies matching the `media`/`post-images` pattern; verified live, no new advisor warnings.
- ~~**Automation dashboard reporting is silently stale**~~ — **fixed 2026-07-31**. `schedule-from-templates` reworked to iterate per-automation and write `automation_runs` (+ bump `automations.run_count`/`last_run`) on every cron pass, reusing the same insert-then-complete shape the manual "Run Now" path already used. Deployed and verified live: a fresh run row landed with real `created`/`skipped` counts.
- ~~**6 orphaned edge functions, 3 with live authorization gaps**~~ — **fixed 2026-07-31**. Confirmed via live `cron.job` + a repo-wide grep that none of `scheduled-pipeline`, `run-scheduled-automations`, `fire-webhooks`, `publish-twitter`, `execute-automation`, `generate-broadcast-script` had any live caller. Reading their source surfaced 3 real gaps that were reachable in production right now: `generate-broadcast-script` had `verify_jwt: false` (callable by anyone on the internet, no auth, burning the `GEMINI_API_KEY` budget); `execute-automation` required login but did no ownership check (any signed-in user could trigger publishing of every user's due posts); `fire-webhooks` looked up posts with no ownership check (any signed-in user could leak another user's post content through their own webhook by guessing a `postId`). Redeployed all 6 as inert 410 stubs — no delete-function tool was available, so a stub is the closest equivalent to deletion. Verified via a fresh `list_edge_functions` pull that all 20 live functions are accounted for and only these 6 changed.

## Remaining Non-Blockers

- Formal deletion of the 6 stubbed edge functions via the Supabase dashboard (Edge Functions → select → Delete) — cosmetic cleanup only; the stubs already close the exposure, so there's no urgency.
- 1 unresolved HIGH npm advisory (react-router RSC-CSRF) — confirmed inapplicable, no action needed until a patched v8 exists.
- Branch protection on `main` — status unconfirmed by tooling; likely already set up per prior session, needs a 10-second manual check.
- Google OAuth — setup in progress, no code blocker, email/password unaffected.
- Leaked-password protection — Free-plan limitation, deliberate deferral.
- Minor hardcoded strings (2 aria-labels, 3 placeholder examples) — cosmetic.
- Mobile responsiveness on authenticated pages — needs live verification in your own browser (sandbox network policy blocks it here); Calendar view specifically flagged as a likely trouble spot.
- `invitations` table missing — Users page invite feature silently non-functional but doesn't crash (already defensively coded).

## Confidence Statement

High confidence in the security/RLS/auth/build/CI findings — these were verified directly against live Supabase advisor output, live auth logs, and live CI run results, not inferred from docs. Medium confidence on "zero CSP violations" and "clean mobile rendering" — both are structurally unverifiable from this sandbox (no CSP reporting endpoint configured; no live-browser access to authenticated pages) and need your own browser to close out. The two new blockers (avatar bucket, stale automation data) were found by direct schema/table inspection against actual frontend code paths, not guessed — high confidence both are real and currently affecting production.

## Recommended Next Actions

1. ~~**Fix avatar upload**~~ — done, 2026-07-31.
2. ~~**Reconnect automation reporting**~~ — done, 2026-07-31.
3. ~~**Reconcile edge function drift**~~ — done, 2026-07-31 (stubbed, see above). Optional: formally delete the 6 stubs via the dashboard whenever convenient.
4. **Confirm branch protection on `main`** — 10-second check in GitHub Settings → Branches, since tooling can't verify it.
5. **Your own browser, live Vercel preview:** confirm CSP shows zero console violations end-to-end, and click through authenticated pages (esp. Calendar) at mobile width.
