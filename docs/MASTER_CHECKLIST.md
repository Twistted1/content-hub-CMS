# Content Hub CMS — Master Checklist

Single source of truth for project completion status. Supersedes `AUDIT.md`
and `PHASE_0_TESTING.md` (kept for history, not maintained going forward —
everything live gets updated here). Checkboxes are literal state, not
decoration: `[x]` means verified against source/live systems on the date
next to it, `[ ]` means still open, with a comment on what's blocking it and
what I'd do about it. No item stays vague — either it's checked with
evidence, or it's open with a next action.

**Last verified:** 2026-07-31, via a 5-agent independent Phase 3 audit
against live production Supabase (`jvbucspwcjahqpoxskvr`), live GitHub
CI/branch state, and current source on `claude/project-completion-audit-o1xgt5`
@ `9115c17` (in sync with `main`). Full report:
`docs/PHASE_3_READINESS_REPORT.md`.

**On `main` (merged):** #2 E2E suite + dashboard crash fix, #3 RLS/FK/
policy advisor fixes, #4 i18n completion for the 9 files that actually
needed it, #5-#6 checklist doc updates, #7 CSP header, #8 react-router
v6→v7 upgrade (resolves 3 open-redirect advisories). RLS performance
migration (`fix_rls_auth_initplan_performance`) applied directly to
prod, advisor-confirmed at 0 remaining warnings. **Production email/
password login was found fully broken and fixed live** (Supabase Auth
"Enable email provider" toggle was off) — see Phase 1 for details.

**Phase 3 audit (2026-07-31) found 2 new live blockers — both fixed
same day.** Avatar upload (missing storage bucket) and the Automation
dashboard's 9-day-stale reporting (cron pipeline now writes
`automation_runs` on every pass) are both resolved and verified live.
Everything else re-checked (RLS, auth, CI, i18n, CSP, secrets) held up
with no regressions. See "Open — found in Phase 3 audit, today" below
for the remaining non-blocking cleanup item (edge function drift).

**Open, waiting on you:** nothing code-related is blocking core CMS use.
Remaining items are GitHub/Supabase settings only you can change, or
decisions only you can make — see the two "Open" sections below.

---

## Phase 0 — Testing Foundation

All done. This was blocking Phase 1's testing items ("run test suite",
"run E2E") from being real — they now are.

- [x] **0.1 Unit/component test setup** — Vitest + Testing Library +
      jest-dom installed, `vitest.config.ts` configured, `npm test` /
      `test:watch` / `test:coverage` all work.
- [x] **0.2 Supabase mocking** — `src/test/mockSupabase.ts` shared helper,
      used by hook tests instead of hitting live DB.
- [x] **0.3 First coverage pass** — 6 test files, 63 tests, covering the
      highest-risk pure logic first (`scheduling.ts`, `dashboardStats.ts`,
      `authValidation.ts`, `useTemplates`, `useDashboardStats`, i18n key
      parity check).
- [x] **0.4 E2E setup (Playwright)** — done this session. Disposable
      Supabase test project (`content-hub-cms-e2e-test`,
      `myrtlspsinwurffceons`) provisioned with the full schema so E2E never
      touches prod. 9 specs, all passing in CI as of PR #2: landing page,
      auth form validation, sign in/out, template creation. Caught a real
      bug in the process — see Phase 1 item below.
- [x] **0.5 CI** — `.github/workflows/ci.yml` (lint, typecheck, unit tests,
      build) and `e2e.yml` (Playwright against the test project), both
      green on `main`.
      - [ ] **Branch protection requiring CI to pass before merge** — this
        is a GitHub repo setting, not something I can flip via any tool I
        have. **Action for you:** repo Settings → Branches → add a rule on
        `main` requiring the `test` and `e2e` checks. Two minutes, one-time.
- [x] **0.6 Coverage baseline** — threshold set at 15% (lines/functions/
      branches/statements) in `vitest.config.ts`, matching the "low enough
      to pass, ratchet up later" plan.

---

## Phase 1 — Correctness & Launch Readiness

### Fixed this session

- [x] **Dashboard crash on every sign-in** — `src/pages/Index.tsx` referenced
      `completedRuns`, a variable that only existed inside a different
      file's function closure. Every authenticated user hit "Something went
      wrong" on `/dashboard`. Found by the new E2E suite, fixed in commit
      `5f2ed36`, confirmed green in CI. This was the single worst bug in the
      app — a 100%-reproducible crash on the main authenticated page — and
      it shipped silently because nothing exercised a real login before now.
- [x] **`post-images` storage bucket allowed listing all files** —
      Supabase's security linter flagged a public SELECT policy that let
      anyone enumerate every filename in the bucket via the Storage API
      (not just fetch by known URL, which the bucket's `public=true` flag
      already allows independent of RLS). No code path depended on the
      policy — `content-pipeline`'s uploads go through the service-role
      client, which bypasses RLS anyway. Dropped the policy directly on
      prod, migration applied and verified.
- [x] **Legacy duplicate cron job** — `AUDIT.md` (2026-07-22) flagged
      `legacy-pipeline` still running every 15 minutes alongside the new
      pipeline. Re-checked live on `jvbucspwcjahqpoxskvr` today: gone. Only
      `publish-due-posts` (1m) and `schedule-content` (15m) remain. Resolved
      sometime between the last audit and now, not by me — noting it here
      so it's not re-flagged as open.

### Re-verified today, already resolved (audit was stale)

The 2026-07-22 audit's "Known gaps/risks" section is out of date on several
items — re-checked directly against source and the live DB:

- [x] `npm ci` installs clean, no `--legacy-peer-deps` needed —
      `eslint-plugin-react-hooks` was bumped to `^7.1.1`, resolving the
      `eslint@10` peer conflict.
- [x] `bun.lock` no longer present — single lockfile (`package-lock.json`).
- [x] i18n coverage: **59/115** page/component files now call
      `useTranslation`, up from 2/121 at last audit. Still not 100% (see
      open item below) but no longer "effectively decorative."
- [x] Reports module is real: `ReportPreviewDialog.tsx`'s `trendData` and
      `platformData` are computed from live `posts` via `useMemo`, no
      `mockChartData`/`mockBarData`/`mockTableData` left. Confirmed by full
      read, not just grep — the mock literals are gone.
- [x] `Platforms.tsx` now uses a real `usePlatforms` hook instead of
      importing `platformsData.ts` for primary content.
- [x] `Users.tsx`'s `usersData.ts` import (`roles`, `permissions`,
      `rolePermissions`) is legitimate static config, not mock content —
      `useUsers.ts` does a real `profiles`/`user_roles` query. Same pattern
      as `strategiesData.ts`, correctly distinguished in the prior audit.
- [x] Console.log cleanup: zero left in `src`/`supabase/functions`.

### Open — live production findings, today

From `mcp__Supabase__get_advisors` against `jvbucspwcjahqpoxskvr`, just run:

- [x] **~~81 RLS policies re-evaluate `auth.uid()`/`auth.role()` per row~~
      — fixed.** Wrapped every bare `auth.uid()` call (including inside
      `has_role(...)` arguments) in `(select auth.uid())` across all 80
      affected policies (the advisor's "81" counted the fix as one more
      than distinct policies — one policy had two occurrences). Generated
      the `ALTER POLICY` statements directly from live `pg_policies`
      output rather than hand-transcribing, applied as one migration,
      re-ran the advisor: **0 `auth_rls_initplan` warnings remain**, and
      the security advisor pass is unchanged (no new findings, no access
      changes) — this was purely a query-planner fix, not a permissions
      change.
- [ ] **Leaked-password protection is off** in Supabase Auth (checks new
      passwords against HaveIBeenPwned). **Correction:** not actually a
      quick toggle — checked the dashboard directly (Authentication →
      Sign In/Providers → Email) and it's greyed out with "Only available
      on Pro plan and above." This project is on the Free plan. Stays open
      until either you upgrade to Pro, or you decide it's fine to leave off
      (reasonable call at this stage — it's a hardening item, not a live
      vulnerability).
- [ ] **Google Sign-In not configured.** App code already supports it
      (`signInWithGoogle` in `useAuth.ts`, wired into `Auth.tsx`) — just
      needs OAuth credentials from Google Cloud Console (Client ID +
      Secret), pasted into Authentication → Sign In/Providers → Google in
      the Supabase dashboard. Redirect URI to register on the Google side:
      `https://jvbucspwcjahqpoxskvr.supabase.co/auth/v1/callback`.
      In progress as of 2026-07-29 — you were mid-setup in Google Cloud
      Console. Email/password sign-in is unaffected either way; it already
      works today.
- [x] **`has_role()` callable by any authenticated user — resolved, not a
      gap.** Checked: `has_role(auth.uid(), 'admin')` is called directly
      inside the majority of this schema's RLS policies (posts, projects,
      templates, etc.), which run as the querying `authenticated` role.
      Revoking `EXECUTE` — the linter's generic suggestion — would break
      every one of those policies for every signed-in user. This function
      is load-bearing for RLS, not an accidental exposure. Leaving as-is.
- [x] **3 unindexed foreign keys — fixed.** Added covering indexes on
      `articles.author_id`, `oauth_states.user_id`, `pipeline_runs.post_id`.
      Purely additive, no behavior change.
- [x] **7 overlapping permissive SELECT policies — fixed.** `media` and
      `posts` each had two permissive SELECT policies stacking for the same
      role (owner/admin check + a public-visibility check), so Postgres
      evaluated both on every query. Consolidated each pair into one policy
      with the same OR'd condition — identical access outcome, one policy
      instead of two. Advisor re-check: 0 `multiple_permissive_policies`
      warnings remain.
- [ ] **15 unused indexes** (18 now, counting the 3 just added above) —
      deliberately left alone. "Unused" here just means this project has had
      almost no real traffic yet; every one of these matches an obvious
      query pattern (tasks by project, posts by automation, etc.) and
      dropping them now risks a regression the moment usage picks up, to
      save a trivial amount of write overhead today. Revisit once there's
      real production traffic to judge by — not before.

### Open — found in Phase 3 audit, today

Independently re-verified by 5 parallel agents against live source/live
Supabase/live GitHub state (full report: `docs/PHASE_3_READINESS_REPORT.md`).
Everything from earlier sections re-checked clean; these two are new:

- [x] **Avatar upload was broken in production — fixed.** The `avatars`
      bucket never existed (`storage.buckets` only had `media` and
      `post-images`). Created it directly on prod
      (`create_avatars_bucket` migration): public read (matches the
      `getPublicUrl` call in `ProfileSettings.tsx`), 5MB limit, image
      mime types only, owner-scoped INSERT/UPDATE/DELETE policies keyed
      on `auth.uid()` as the folder prefix (same pattern as `media`/
      `post-images`), admin override on update/delete. Verified live:
      bucket exists with correct config, security advisor re-run shows
      no new warnings.
- [x] **Automation dashboard was showing 9-day-stale data — fixed.**
      `schedule-from-templates` now writes to `automation_runs` on every
      cron pass (every 15 min), using the same insert-then-complete
      shape the manual "Run Now" button already used — reworked its
      loop from grouped-by-user-platform to per-automation so each
      active scheduled automation gets its own run row (status,
      `result: {created, skipped, platforms}`), and bumps
      `automations.run_count`/`last_run`. Deployed (v5, `verify_jwt`
      preserved as `false` to match the cron job's header-only auth).
      Verified live: manually triggered the same `net.http_post` the
      cron job uses, confirmed a fresh `automation_runs` row landed
      (`2026-07-31 17:09`, `status: success`, real `created`/`skipped`
      counts) and `automations.last_run`/`run_count` both updated. Will
      keep updating every 15 min going forward — no more silent staleness.
- [ ] **Edge function drift between repo and live deploy.** 6 functions
      are ACTIVE on prod but not in `supabase/functions/` in this repo:
      `scheduled-pipeline`, `run-scheduled-automations`, `fire-webhooks`,
      `publish-twitter`, `execute-automation`, `generate-broadcast-script`.
      Notably, `scheduled-pipeline` — the legacy pipeline a migration
      comment (`20260723000000_retire_legacy_pipeline.sql`) says was
      "removed from the repo" — is still deployed and ACTIVE, just
      unscheduled. Not causing a live bug (nothing triggers it since its
      cron job was removed), but it's undocumented drift and should
      either be pulled into the repo or formally deleted, not left
      orphaned. Non-blocking, cleanup item.

### Open — needs a decision only you can make

- [x] **i18n: "56 files still hardcoded English" — done, but the real
      number was much smaller than the metric suggested.** Checked all 56
      before converting anything: 52 were generic shadcn/ui primitives
      (`button.tsx`, `input.tsx`, `table.tsx`, `card.tsx`, etc.) that
      structurally contain zero hardcoded text — their content always comes
      from props the calling page passes in, which is already translated.
      Wiring `useTranslation` into them would've been dead code. The actual
      gap was 9 files with real hardcoded strings shown to users regardless
      of language: `ErrorBoundary.tsx` (the app-wide crash screen —
      "Something went wrong", "Try Again", "Go Home"), `ErrorState.tsx` and
      `LoadingState.tsx` (default title/message text used across many
      pages), and 6 shadcn primitives with hardcoded sr-only/aria-label
      accessibility text (`breadcrumb`, `carousel`, `dialog`, `pagination`,
      `sheet`, `sidebar` — plus `pagination.tsx`'s visible "Previous"/"Next"
      labels). All 9 fixed, English + Portuguese keys added to both locale
      files, i18n parity test still passes (63/63 unit tests), build clean.
      `useTranslation` file-count (59/115) is no longer a meaningful metric
      going forward — most of the remaining 106 files are primitives that
      will never need it.
- [x] **Production email/password login was fully broken — found and
      fixed 2026-07-29.** While verifying PR #7's CSP against a live
      session, discovered `POST /auth/v1/token` returning `422:
      email_provider_disabled` on every password-grant request — not
      caused by the CSP (the request reached Supabase fine, proving
      `connect-src` was correct all along). Auth logs showed this
      rejecting every login attempt for at least the prior 5+ hours;
      production only appeared to work because one existing browser
      session was refreshing a still-valid token, not actually logging
      in. **Root cause: the "Enable email provider" toggle in Supabase
      Auth was off.** Fixed by toggling it on and saving. Re-verified via
      fresh auth logs immediately after: real password logins now
      succeeding (`login_method: password`, status 200) for two different
      accounts, zero `email_provider_disabled` errors since. **This was
      the actual production-blocking bug this whole investigation was
      chasing** — every new user was locked out until this fix.
- [x] **CSP header — merged (PR #7).** User confirmed the console was
      clean on the live preview (signed in, no CSP violations) and
      merged. Live on production now.
- [x] **`react-router` v6→v7 upgrade — done, merged (PR #8).** `f339a41` deferred this
      pending a real audit rather than a blind major-version bump. Checked
      first: all 20 files importing `react-router-dom` use only the
      classic API (`BrowserRouter`, `Routes`/`Route`, `Link`, `Navigate`,
      `useNavigate`, `useLocation`, `useSearchParams`) — zero usage of v6's
      data-router APIs (`createBrowserRouter`, loaders, actions), which is
      where v7's real breaking changes live. Installed `react-router-dom@7`
      (resolved to `7.18.2`): `npx tsc --noEmit` clean with zero errors,
      full unit suite (63 tests) passing, build clean, and the E2E suite
      run locally against the disposable test project — critically, both
      navigation-dependent specs pass (`Link` client-side nav, and
      `Navigate`-based protected-route redirect), exactly the behavior a
      router upgrade could break. All 3 original advisories
      (`GHSA-wrjc-x8rr-h8h6`, `GHSA-337j-9hxr-rhxg`, `GHSA-jjmj-jmhj-qwj2`)
      were scoped `<7.18.0` and are now resolved. One new "high" advisory
      appeared post-upgrade (`GHSA-qwww-vcr4-c8h2`, RSC-mode CSRF bypass)
      — confirmed inapplicable: this app has zero React Server Components/
      server-action usage (pure client-side Vite SPA), and no patched
      version exists yet regardless (fix lands in an unreleased v8).
- [ ] **Live delivery never observed end-to-end**: LinkedIn/X direct
      publish, webhook publishing (IG/FB/TikTok/YouTube/Rumble/Podcast/
      Website), Stripe checkout/webhook against a live account. Code paths
      exist and are read-verified; none of this can be confirmed without
      either real connected accounts or you walking through it live.
      **Alternative if you want it verified without live accounts:** I can
      write integration tests against Stripe's/the platforms' sandbox/test
      modes where they offer one (Stripe does; most social platforms
      don't) — tell me which of these you want covered that way.
- [ ] **Mobile responsiveness — partially checked, blocked on the rest.**
      Drove Playwright at 390×844 (mobile) and 768×1024 (tablet) against
      the unauthenticated pages: **Landing and Auth sign-in are clean** at
      both sizes — single-column stacking, full-width buttons, no overflow
      or cramped text. Could not check Dashboard/Templates/Calendar/Notes/
      Projects/Settings — this sandbox's network policy blocks the headless
      browser from reaching Supabase directly, so sign-in fails here and
      every authenticated page just redirects to `/auth`. Not a code
      finding, an environment limitation. **To finish this:** open the live
      Vercel preview in your own browser, toggle the device toolbar
      (Ctrl+Shift+M in Chrome DevTools), sign in, and click through the
      authenticated pages — takes about 2 minutes since your browser isn't
      sandboxed the way this session is.

---

## How to reach a running instance of this branch

- **Your browser, right now, no setup:** the Vercel preview for this PR
  redeploys on every push —
  https://content-cms-hub-git-claude-project-c-8508cb-twistted1s-projects.vercel.app
  This is the real, live way to click through what's in PR #2.
- **My sandbox's dev server:** running on `localhost:5173` inside this
  session's container. That's not reachable from your browser — it's not a
  choice, it's that a `localhost` inside my container is only visible to
  processes inside that same container (same reason `localhost` on your
  laptop isn't visible to your phone). The Vercel URL above is the actual
  answer to "let me see it running."

---

## Where things live

- This file: canonical status, updated as items complete — not scattered
  across chat.
- `docs/AUDIT.md`: original + first re-audit (2026-07-12, 2026-07-22).
  Historical record, superseded by this file for anything it disagrees with.
- `docs/PHASE_0_TESTING.md`: original Phase 0 plan. All items now checked
  above; not maintained further as a separate file.
- PR #2 (`claude/project-completion-audit-o1xgt5` → `main`): **merged**
  2026-07-29 (squash, `30d27a4`). E2E suite, dashboard crash fix,
  `post-images` policy fix, and RLS `auth_rls_initplan` performance fix.
- PR #3: **merged** 2026-07-29 (squash, `60101e7`). Unindexed FK indexes,
  consolidated overlapping RLS policies, `has_role()` finding resolved.
- PR #4: **merged** 2026-07-29 (squash, `34549d9`). i18n completion for
  the 9 files with real hardcoded text.
- All three are on `main`; Vercel production deploy tracks `main`, so
  everything above is live.
