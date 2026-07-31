# Content Hub CMS — Final Readiness Assessment Report
### Phase 3 Audit — 5 independent parallel agents, verified against live source + live Supabase (`jvbucspwcjahqpoxskvr`) + live GitHub state

**Date:** 2026-07-31
**Baseline compared against:** `docs/AUDIT.md` (2026-07-12 + 2026-07-22) and `docs/MASTER_CHECKLIST.md` (2026-07-29) — neither was trusted; every claim was independently re-checked.
**Branch audited:** `claude/project-completion-audit-o1xgt5` @ `9115c17` (in sync with `main`).

---

## Executive Summary

**Verdict: CONDITIONAL GO.**

The core CMS is solid: build/lint/typecheck/tests are all clean, CI is green on both branches, the RLS performance and security fixes from earlier this session hold up under fresh advisor scans, production auth is working with no error signal, the CSP is syntactically sound, no secrets are exposed in source, and the content-publishing pipeline (cron jobs, Stripe billing functions) is live and running correctly.

Three real, previously-undocumented issues were found — none of them crash-the-app severity, but one is a genuinely broken user-facing feature in production today:

1. **Avatar upload is broken in production** — the storage bucket the code writes to (`avatars`) does not exist. Blocker for anyone using profile settings.
2. **The Automation dashboard shows 9-day-stale data** — the pipeline that actually runs today (`schedule-from-templates` + `publish-due-posts`) never writes to `automation_runs`; only the retired legacy pipeline did. The automation itself works; its reporting doesn't.
3. **Edge function drift** — 6 functions are deployed live but absent from the repo, including a "retired" legacy pipeline function a migration comment claims was removed but which is still ACTIVE in production.

None of these block the app from functioning for its primary job (creating, scheduling, and publishing content). They do block calling the automation/profile surfaces "done."

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
| Edge functions (repo vs. live) | D | **PARTIAL — drift** | 6 live functions missing from repo, incl. a supposedly-retired pipeline still ACTIVE |
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
- **Automation dashboard reporting is silently stale** (`automation_runs` last written 2026-07-22; current pipeline `schedule-from-templates` never updates it). Misleading, not crashing — but every "last run" / "success rate" figure on the Automation page and dashboard is wrong today. Still open — needs a decision on source of truth (see Recommended Next Actions).

## Remaining Non-Blockers

- Edge function / repo drift (6 live functions undocumented in repo, including the "retired" `scheduled-pipeline` still ACTIVE) — operational hygiene risk, not a live bug, but should be reconciled so the repo reflects reality.
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
2. **Reconnect automation reporting** — either have `schedule-from-templates`/`publish-due-posts` write to `automation_runs`, or repoint the dashboard/Automation page at a table the live pipeline actually updates. Needs a short design decision from you on which table is the source of truth going forward.
3. **Reconcile edge function drift** — pull the 6 undeployed-from-repo functions' source into `supabase/functions/`, and decide whether `scheduled-pipeline` should be formally deleted (not just unscheduled) now that it's confirmed orphaned.
4. **Confirm branch protection on `main`** — 10-second check in GitHub Settings → Branches, since tooling can't verify it.
5. **Your own browser, live Vercel preview:** confirm CSP shows zero console violations end-to-end, and click through authenticated pages (esp. Calendar) at mobile width.
