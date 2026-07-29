# Content Hub CMS — Master Checklist

Single source of truth for project completion status. Supersedes `AUDIT.md`
and `PHASE_0_TESTING.md` (kept for history, not maintained going forward —
everything live gets updated here). Checkboxes are literal state, not
decoration: `[x]` means verified against source/live systems on the date
next to it, `[ ]` means still open, with a comment on what's blocking it and
what I'd do about it. No item stays vague — either it's checked with
evidence, or it's open with a next action.

**Last verified:** 2026-07-29, against live production Supabase
(`jvbucspwcjahqpoxskvr`) and `main` at commit `30d27a4` (PR #2, merged).
RLS performance migration (`fix_rls_auth_initplan_performance`) applied
directly to prod same day, advisor-confirmed at 0 remaining warnings.

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
- [ ] **`has_role()` is callable by any authenticated user via
      `/rest/v1/rpc/has_role`.** Informational, not necessarily a problem —
      it's a read-only role check, commonly exposed on purpose so the
      frontend can ask "am I admin?" Confirm that's the intent; if so, no
      action needed. If not, revoke `EXECUTE` from `authenticated`.
- [ ] **15 unused indexes, 7 tables with overlapping permissive policies,
      3 unindexed foreign keys** — lower-priority performance items from
      the same advisor pass, not yet triaged individually. Flagging the
      count here so it's not lost; will itemize on request.

### Open — needs a decision only you can make

- [ ] **i18n: 56 files still hardcoded English** (115 total, 59 done).
      Mechanical but large — translating and wiring `useTranslation` across
      every remaining page/component. **Decision needed:** do this in one
      pass, or page-by-page as you touch each one? Either is fine, just
      pick one so it doesn't stay half-done indefinitely.
- [ ] **CSP header intentionally still missing** from `vercel.json`
      (flagged and deliberately deferred in commit `f339a41`) — needs to
      list every domain the app actually calls (Supabase project ref,
      Sentry, Stripe) and live-tested before shipping, since a wrong CSP
      silently breaks the app rather than erroring loudly.
      **Action for you or me:** give me the go-ahead and I'll draft it
      against the domains actually in use and we test it together before
      it ships.
- [ ] **`react-router` moderate open-redirect advisory** — fixing it is a
      v6→v7 major upgrade touching every route in the app (`f339a41`
      deferred this on purpose rather than doing a blind major-version
      bump). **Decision needed:** schedule a dedicated pass for this, since
      it's not a drop-in patch.
- [ ] **Live delivery never observed end-to-end**: LinkedIn/X direct
      publish, webhook publishing (IG/FB/TikTok/YouTube/Rumble/Podcast/
      Website), Stripe checkout/webhook against a live account. Code paths
      exist and are read-verified; none of this can be confirmed without
      either real connected accounts or you walking through it live.
      **Alternative if you want it verified without live accounts:** I can
      write integration tests against Stripe's/the platforms' sandbox/test
      modes where they offer one (Stripe does; most social platforms
      don't) — tell me which of these you want covered that way.
- [ ] **Mobile responsiveness** — not audited at all yet, no tool I have
      does a real device/viewport pass. **Alternative:** I can drive
      Playwright at a few common viewport sizes (390×844, 768×1024,
      1280×800) and screenshot the key pages so you can eyeball layout
      breaks, without needing a physical device. Say the word.

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
  `post-images` policy fix, and RLS `auth_rls_initplan` performance fix all
  landed on `main`. Vercel production deploy tracks `main`, so this is now
  live.
