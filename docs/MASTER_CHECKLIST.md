# Content Hub CMS — Master Checklist

Single source of truth for project completion status. Supersedes `AUDIT.md`
and `PHASE_0_TESTING.md` (kept for history, not maintained going forward —
everything live gets updated here). Checkboxes are literal state, not
decoration: `[x]` means verified against source/live systems on the date
next to it, `[ ]` means still open, with a comment on what's blocking it and
what I'd do about it. No item stays vague — either it's checked with
evidence, or it's open with a next action.

**Last verified:** 2026-08-29 (Phase 10). Phase 10 recreated the disposable
E2E Supabase test project end-to-end (the old one, `myrtlspsinwurffceons`,
had been deleted — that's what was actually failing the E2E GitHub Actions
workflow, not any code change) and got the workflow green again after a few
rounds of secret-configuration troubleshooting with the user. Then completed
the light-theme re-enablement Phase 9 had left open: swept the remaining 9
files' hardcoded dark-only classes onto theme tokens, removed
`forcedTheme="dark"`, and re-enabled both theme-switching UIs. See the
"Light theme" bullet under Phase 9 below (updated in place) for full detail,
and "Phase 9" for the E2E project recreation.

**Previously last verified:** 2026-08-28 (Phase 9). Phase 9 found and fixed the actual
root cause of a recurring "the calendar has duplicate/wrong content no
matter how many times I wipe it" report: `schedule-content`, a `pg_cron`
job firing every 15 minutes forever, called an edge function
(`schedule-from-templates`) carrying its own separate hardcoded schedule
copy — still with the pre-Phase-8 broken weekly-only LinkedIn — plus two
active "scheduled" automations both matching nearly every platform, so
every cron tick did the work twice with no overlap protection. Fixed the
schedule copy, added an overlap guard, paused the duplicate automation,
and (separately) fixed a real Platforms-page bug where cards changed
height row-to-row. Then, re-auditing this file's own open items against
live state: confirmed the 🔴 OPENAI_API_KEY blocker from Phase 8 is very
likely resolved (`content-pipeline` — same secret store — has been
generating real AI content successfully every 15 minutes for 20 days
straight; `novee-chat` itself couldn't be directly re-tested, see Phase 8
note below for why), confirmed 5 of the 6 orphaned/dangerous edge
functions flagged in Phase 3 have since been formally deleted (only the
harmless `run-scheduled-automations` stub remains, unchanged), and found
one real regression the Phase 1 project-wide RLS performance sweep
couldn't have caught: `csp_reports` (added in Phase 4, after that sweep
ran) still had its `auth.uid()` re-evaluating per-row. Fixed directly
against prod, advisor re-run confirms 0 `auth_rls_initplan` warnings.
**At the user's explicit request, the `posts` table was wiped again and
both scheduled automations paused** — the calendar is intentionally empty
right now, not broken; re-enable "Weekly Content Schedule" (not the
"(templates)" duplicate) when ready for content to generate again. See
"Phase 9" section below for full detail.

**Previously last verified:** 2026-08-08 (Phase 8). Phase 8 (2026-08-08) is a
user-driven bug-fix pass across four separate reports in one day: the
Review Inbox redesigned from a modal into a persistent split-pane layout
plus a tag-contrast fix, a global dark-theme/glassmorphism contrast pass
(borders and panel edges were nearly invisible against the background),
the Calendar sidebar's three panels resized to match widths, and — the
two substantive ones — the AI Assistant (was failing on every message,
two composer buttons had no handler at all) and the Users page (Remove
and Deactivate were both silent no-ops that never touched the database).
See "Phase 8" section below for all of it, including **one item that
needs your action** — marked 🔴 in that section and in "Open, waiting on
you" below. Phase 7 (2026-08-08) added a new feature, not a bug fix: a
Review Inbox (`/review`, sidebar → Tools) giving
the AI content pipeline a real human-in-the-loop approval step — see
"Phase 7" section below. Phase 3 (2026-07-31) was a 5-agent
independent audit against live production Supabase
(`jvbucspwcjahqpoxskvr`), live GitHub CI/branch state, and source @
`9115c17`. Full report: `docs/PHASE_3_READINESS_REPORT.md`. Phase 4
(2026-08-01) found and fixed a real gap that Phase 3 missed: the Stripe
subscription webhook had never successfully written a subscription,
ever. Phase 5 (2026-08-06) was a user-driven UI/UX pass — real bugs
in the Billing page, the Calendar, and the light theme, found by the
user clicking around production, not by an audit. **Phase 6
(2026-08-08) is the actual end-to-end confirmation Phase 4 could only
claim, not verify: a real Stripe test payment now correctly lands as
`tier: "pro"` in the `subscriptions` table** — see "Phase 6" section
for the two real bugs that were still blocking this and how each was
confirmed fixed against live data, not log lines. See "Phase 5"
section below for what changed there and what's still open (light theme is
now disabled, not fixed — see that section for why).

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

**Open, waiting on you:** the calendar is currently empty and content
generation is paused — see Phase 9 — resume it by re-activating "Weekly
Content Schedule" in Automation whenever you're ready. ✅ The 🔴
`OPENAI_API_KEY` item from Phase 8 is fully closed out, not just
inferred: the user tested the AI Assistant directly across three rounds,
each surfacing a real bug (`getClaims` version mismatch, an oversized
system message hitting the request's own size cap, then generic 429
handling that hid a billing state behind "rate limit exceeded") — all
three fixed and deployed. **The user then confirmed directly: the OpenAI
account genuinely has zero usage credit right now, by choice** — that's
a billing decision, not a code problem, and the assistant will work as
soon as credit is added. ✅ **Stale-app caching found and fixed**: while
chasing the AI Assistant issue the user also hit the same stale theme
bug reappear on a second, different browser — traced to `vercel.json`
never setting an explicit `Cache-Control`, now fixed (see Phase 10).
After one hard refresh, the user's next screenshot showed light theme
genuinely broken on the Overview/Dashboard page specifically — traced to
that page never actually being swept despite an earlier claim that it
was; fully fixed, plus a repo-wide re-check afterward caught one more
real instance elsewhere (see Phase 10 for both). ✅ The E2E Supabase test
project was recreated (`amyzklcdwrspazveutqz`, see Phase 9), all three
GitHub Actions secrets (`E2E_SUPABASE_URL`, `E2E_SUPABASE_PUBLISHABLE_KEY`,
`E2E_SUPABASE_SERVICE_ROLE_KEY`) were set, and the E2E workflow is
confirmed green on the latest run (Phase 10) — no longer a blocker.
🔴 **Still open, needs your eyes**: a live visual pass toggling light/dark
theme on every remaining page (not just Overview) in your own browser —
the CSS conversions across all 11 files follow the same pattern now
proven correct on Overview, but haven't all been screenshotted
side-by-side, and this session has already been wrong once about a page
being "done." Beyond that, nothing else code-related is blocking core CMS
use — remaining items are GitHub/Supabase settings only you can change,
or decisions only you can make — see the "Open" sections below.

---

## Phase 9 — Recurring duplicate-content root cause, and a fresh full audit (2026-08-28)

Picked back up after a 20-day gap. Two things happened in this phase:
a user bug report (duplicate/wrong calendar content that survived
repeated database wipes) that turned out to have a real, previously
unknown root cause; and, once that was fixed, a fresh audit of every
open item in this file against live state rather than trusting the
Aug 8 snapshot.

- [x] **Root cause of "wiping the calendar never sticks" — found and
      fixed.** Not a data bug, a live infrastructure one: `pg_cron` job
      `schedule-content` calls `schedule-from-templates` every 15 minutes,
      forever, independent of anything in this repo's git history. That
      edge function carries its **own separate hardcoded copy** of the
      platform schedule (inlined from `src/data/platforms/*.json` at some
      point in the past, never kept in sync since) — it still had the
      pre-Phase-8 broken weekly-only LinkedIn (`Tuesday: ["09:00"]`)
      instead of daily. No matter how many times `posts` got wiped, this
      cron refilled it within 15 minutes using stale logic. On top of
      that: two automations (`Weekly Content Schedule`, run_count 815 at
      the time, and a duplicate `Weekly Schedule (templates)`) were both
      `status: active, trigger: scheduled` and both matched nearly every
      platform — every single cron tick processed both, and a slow tick
      (content-pipeline's OpenAI + DALL-E calls can each run long,
      especially right after a wipe when many slots are untaken at once)
      could overlap the next tick before either's insert committed,
      producing the exact-duplicate-pairs pattern found in the data
      (e.g. two identical "Twitter post for Sat, 08 Aug 2026 18:00"
      rows). Fixed: corrected the LinkedIn schedule inside
      `schedule-from-templates` to match `linkedin.json`, added an
      overlap guard (skip an automation if a run for it was marked
      "running" in the last 20 minutes), paused the duplicate automation,
      deployed (v12). Verified over real elapsed time, not just a
      one-shot check: 20 days later, 145 posts spanning Aug 8–29, every
      single day showing correct non-duplicated counts, cron healthy
      (last run 8 minutes before checking), zero recent failures.
- [x] **Platforms page: cards visibly changed size row to row — fixed.**
      `PlatformCard`'s "Latest Post" block only rendered for platforms
      with ≥1 post. A CSS grid only equalizes height *within* a row, not
      across the whole grid, so a row where every card had that block was
      taller than a row where none did. Now always renders, with a
      "No posts yet" placeholder state when empty, so every card has
      identical internal structure. `platforms.noPostsYet` added to both
      locale files.
- [x] **Calendar sidebar left/right gap imbalance — fixed.** The
      desktop sidebar column used uniform `p-8` padding, but the page's
      own outer layout padding stacks on top of the sidebar's left edge
      and not its right, so the gap to the mini-calendar card read wider
      on the left than the gap from the sidebar to the main grid on the
      right. Split into `pl-4 pr-8 py-8`.
- [x] **Re-audited every open item in this file against live state**
      (not assumed from the Aug 8 snapshot):
      - 🔴 `OPENAI_API_KEY` (Phase 8's flagged blocker) — **downgraded
        from confirmed-broken to very-likely-fixed.** `content-pipeline`
        reads the exact same project-wide secret and has been
        successfully generating real AI-written content every 15 minutes
        for 20 consecutive days (145 posts, real generated text, not
        error fallbacks) — that's strong indirect evidence the key is
        set and working. Could not directly re-test `novee-chat` itself:
        no real chat traffic in the last 24h (the log tool's window cap)
        to confirm from, and this sandbox's network policy still blocks
        reaching the Supabase project directly (confirmed again today —
        same `403` on the outbound proxy noted in earlier phases), so an
        edge-function call can't be driven from here either. If the AI
        Assistant still fails on a real message, tell me and I'll dig
        further with a live repro instead of inferring.
      - **Edge function drift (Phase 3) — mostly resolved since.** Of
        the 6 orphaned/dangerous functions stubbed out in Phase 3, 5
        (`scheduled-pipeline`, `fire-webhooks`, `publish-twitter`,
        `execute-automation`, `generate-broadcast-script`) are gone from
        `list_edge_functions` entirely — formally deleted at some point,
        closing out that "nice-to-have cleanup" note. Only
        `run-scheduled-automations` remains, confirmed still the exact
        inert 410 stub from Phase 3, unchanged (`updated_at` matches the
        2026-07-31 stubbing exactly) — not a new gap, just not yet
        deleted.
      - **New finding, not in any prior phase**: `csp_reports`' RLS
        policy (`Admins can view CSP reports`) was still re-evaluating
        `auth.uid()` per row — the Phase 1 project-wide fix swept every
        policy that existed *at the time*, but `csp_reports` wasn't
        created until Phase 4, three days later, so it was never covered.
        Fixed directly (`alter policy ... using (has_role((select
        auth.uid()), 'admin'))`), advisor re-run confirms 0
        `auth_rls_initplan` warnings project-wide, still.
      - Security/performance advisors otherwise unchanged from prior
        phases: `has_role()` definer-function and leaked-password-
        protection warnings are the same previously-accepted items
        (Free tier, no live exposure); the 18 unused-index INFO items are
        the same deliberately-deferred set (still no real production
        traffic to judge "unused" by).
- [x] **At the user's explicit request: `posts`/`post_platforms`/`media`/
      `pipeline_runs` wiped, and both scheduled automations paused** (not
      just the duplicate one this time) — the calendar is deliberately
      empty right now, a decision, not a bug. Resume by re-activating
      "Weekly Content Schedule" (`8b5334b4-...`) in the Automation page
      when ready; leave "Weekly Schedule (templates)" (`1728f488-...`)
      paused, it's the duplicate.
- [x] **E2E workflow was failing on every push — root cause found, test
      project recreated.** A GitHub Actions failure notification ("E2E:
      All jobs have failed", ~43s) turned out to predate today's changes
      entirely — even a docs-only commit (this file, no app code) failed
      the same way, ruling out a code regression. The actual cause: the
      disposable Supabase project E2E tests run against
      (`content-hub-cms-e2e-test`, PR #2) had become unreachable -
      `global-setup.ts`'s `admin.auth.admin.listUsers()` call threw a bare
      `fetch failed` (not an auth error - the request never reached the
      project), and the project no longer appeared in this session's
      Supabase project list at all, consistent with the free-tier project
      having been deleted after weeks of no traffic. Not hardcoded
      anywhere in the repo, only in GitHub Actions secrets, so nothing in
      source needed changing.
      **Fix:** provisioned a fresh disposable project
      (`amyzklcdwrspazveutqz`, same org, $0/month, user confirmed) and
      rebuilt its schema - but *not* by replaying the 38 files in
      `supabase/migrations/`, which turned out to contain a real conflict
      (`automations` is `CREATE TABLE`'d twice with different column sets
      across two migration files; live production's actual table matches
      only the first - the second migration never successfully ran, or
      its table was later replaced, and mechanically replaying both would
      have errored or silently diverged from reality). Instead, introspected
      the live production schema directly (`pg_attribute`, `pg_constraint`,
      `pg_policy`, `pg_proc`, `pg_trigger`, `storage.buckets`) and built one
      clean script from what's actually there today: all 25 tables, RLS
      policies (already carrying the Phase 1 `(select auth.uid())`
      optimization, for free), the 4 functions, 15 triggers, and all 3
      storage buckets with their policies. Deliberately excluded
      `pg_cron`/`get_cron_secret` - no E2E spec exercises the cron
      pipeline and this project has no edge functions deployed to call.
      Verified: all 25 tables present with RLS enabled, security advisor
      shows only the same accepted `has_role`/`handle_new_user`
      definer-function pattern already accepted on production, no new
      findings. 🔴 **One step only you can do:** GitHub Actions secrets
      need updating to point at the new project -
      `E2E_SUPABASE_URL=https://amyzklcdwrspazveutqz.supabase.co`,
      `E2E_SUPABASE_PUBLISHABLE_KEY` (the new project's anon key, already
      fetched, ask if you need it restated), and
      `E2E_SUPABASE_SERVICE_ROLE_KEY` (Project Settings → API on the new
      project - no tool available here can read or set secrets).
- Verified: `npx tsc --noEmit` clean, `npx eslint` on all changed files
  clean (no new warnings), full unit suite (63/63) still passing.

---

## Phase 8 — Four user-reported bugs in one pass (2026-08-08)

- [x] **Review Inbox redesigned: modal → persistent split-pane.** The
      first cut of Phase 7 opened the per-post editor as a centered modal
      over the list; the user wanted a Gmail-style layout with the list
      and editor both on screen at once. Rebuilt as list (left) + editor
      (right), auto-advancing to the next post after Approve/Reject/Send
      to draft, Select-all/Approve-all moved into the page header. Then a
      follow-up fix: the "TWITTER" platform tag was rendering unreadable
      (white text on `platformColors.twitter`'s near-white `#F8FAFC` fill)
      — added a luminance-based contrast check so tags pick black or
      white text off their actual fill color, plus squared the tag
      corners off (`rounded-sm`, not `rounded-full`) per an established
      no-rounded-corners preference.
- [x] **Dark theme / glassmorphism contrast — fixed globally.** Report:
      "the app is too dark and the lines are invisible." Root cause was
      two-fold: `--background`/`--card`/`--border` were packed within ~11
      points of HSL lightness (4/6/15), and ~90 hardcoded
      `border-white/[0.0X]` / `bg-white/[0.0X]` classes across Sidebar,
      Calendar, Index, Platforms, Settings, Articles, and ContentPipeline
      were tuned for the old near-black background (some as low as 1-2%
      opacity). Widened the CSS variable ladder and ran one consistent
      opacity remap across all of them. Spot-checked via a local preview
      build + Playwright screenshot of Landing/Auth (the only pages this
      sandbox can reach without live Supabase auth) — borders that were
      flush with the background are now clearly visible.
- [x] **Calendar sidebar panel widths — fixed.** The mini calendar card
      was the only one of the sidebar's three panels capped at
      `max-w-[272px] mx-auto`; Filter Stream and Live Queue had no width
      constraint and stretched to fill the column, reading as
      misaligned edges. Applied the same cap to all three.
- [x] **AI Assistant was failing on every message; Enhance/Insert
      Template did nothing — fixed what's fixable, one item needs you.**
      `novee-chat` now returns a stable `code` plus the real failure
      reason (including OpenAI's own truncated error text) in every
      error response instead of a generic "AI service temporarily
      unavailable" — this project's Supabase log viewer only shows HTTP
      status lines, not thrown error text (same limitation hit during
      the Stripe webhook debugging in Phase 6), so the response body is
      the only place that detail can live. `useChat` now shows that real
      reason inline in the chat bubble and toast instead of a hardcoded
      apology. Deployed (`novee-chat` v40). "Enhance prompt" now actually
      rewrites the draft via the assistant; "Insert template" is a
      dropdown of the user's saved templates — both were dead buttons
      with no `onClick` at all. Added voice input (mic → Web Speech
      Recognition into the composer) and voice output (auto-read toggle
      + per-message play/stop via Speech Synthesis), both gracefully
      disabled with a tooltip where the browser doesn't implement the
      API. 🔴 **What's still open:** every observed failure was a fast
      500 with the OpenAI stream never starting — the signature of
      `OPENAI_API_KEY` being missing or invalid in this Supabase
      project's Edge Function secrets. No tool available in this session
      can read or write Supabase project secrets (confirmed by search —
      the Supabase MCP surface here covers DB migrations, SQL, edge
      function *code* deploy, and logs, but not secrets management), so
      this is a check/fix only doable from the Supabase dashboard
      (Project Settings → Edge Functions → Secrets) or `supabase secrets
      set OPENAI_API_KEY=...` via CLI. A redeploy after setting it isn't
      required (secrets are read fresh per invocation, unlike the warm-
      instance caching issue hit with `STRIPE_WEBHOOK_SECRET` in Phase 6)
      but doesn't hurt. Once set, the improved error handling above will
      immediately show if the real problem is something else instead.
- [x] **Users page: Remove and Deactivate were both silent no-ops —
      fixed.** `deleteUser` only ever handled pending invitations; for
      any real team member it just showed a fake "User deactivated"
      toast and touched nothing, so the row was still there on refresh.
      Full Supabase Auth account deletion needs the service role key
      (not available client-side); "Remove" now does what a Team Members
      list actually needs — deletes their `user_roles` and `profiles`
      rows so they disappear from every admin view (the underlying login
      itself is untouched, and removing your own account is blocked).
      Activate/Deactivate had the identical shape of bug: `updateUser`
      never read `updates.status` at all. Added a real `profiles.status`
      column (migration `add_status_to_profiles`; RLS already let admins
      write other users' profile rows, so no policy change was needed)
      and wired the write. Also removed a page-level "User removed" toast
      that fired unconditionally *before* the mutation resolved — it made
      a genuine failure (e.g. the new self-removal guard) look identical
      to success.
- Verified throughout: `npx tsc --noEmit` clean, `npx eslint` clean
  (pre-existing-style `any` warnings only), `npx vite build` clean.

## Phase 7 — Review Inbox: human-in-the-loop approval (2026-08-08)

New feature, explicitly requested — not a bug fix. The `posts` table
already carried AI-pipeline fields (`review_requested_at`, `reviewed_at`,
`workflow_stage`, `is_ai_generated`, status `awaiting_review`) that no UI
ever surfaced, so AI-generated content had no real approval gate before
going out. This phase builds that gate.

- **New route `/review`** (protected), new sidebar entry under **Tools**
  (`nav.reviewInbox`, `Inbox` icon), first item in the list.
- **Three tabs**, each backed by the existing `usePosts()` query filtered
  by status: **Needs Review** (`awaiting_review`), **Drafts** (`draft`),
  **Scheduled** (`scheduled`). Tab labels show live counts.
- **Per-post editor** (opens on row click): title input, content textarea
  with **live per-platform character limits** — a progress bar + over-limit
  warning per platform actually attached to that post, reusing the same
  limits table the Calendar's event editor uses (see next point), cover
  image preview with upload/replace via the existing `useMedia` storage
  hook, and a date/time picker for scheduling.
- **`src/utils/platformLimits.ts`** — extracted the per-platform character/
  hashtag limits that used to live only inside `Calendar.tsx` (non-exported,
  so Review couldn't reuse it) into a shared module. `Calendar.tsx` now
  imports from here too — one table, not two that can drift.
- **Four actions in the editor** + **bulk approve** in the Needs Review
  list:
  - *Approve & schedule* — `status: "scheduled"`, sets `scheduled_at` from
    the date/time picker, stamps `reviewed_at`.
  - *Save changes* — persists title/content/cover image without touching
    status.
  - *Send back to draft* — `status: "draft"`, clears `scheduled_at` (a
    draft shouldn't carry a stale future timestamp).
  - *Reject* — `status: "rejected"`, stamps `reviewed_at`. This needed a
    **new DB enum value**: `post_status` had no rejected state distinct
    from `draft` (migration `add_rejected_post_status`, applied directly to
    prod: `ALTER TYPE post_status ADD VALUE 'rejected'`). TS types
    regenerated from the live schema afterward. Checked every existing
    `post_status`/`PostStatus` consumer in the codebase for exhaustive
    switches that a new enum member could break — none exist, all are
    plain `===` comparisons or the `t(\`calendar.status${...}\`, {
    defaultValue })` fallback pattern, so this was a safe additive change.
  - *Bulk approve* — checkbox per row + "Approve Selected (n)" in the
    Needs Review tab only (per the request). Goes straight through
    `supabase.from("posts").update(...)` per selected row instead of the
    `usePosts().updatePost` mutation, specifically to avoid an N-toast
    spam from that hook's per-call success toast — one bulk action gets
    one summary toast.
- `publish-due-posts` (the cron that actually fires posts live) only ever
  selects `status = "scheduled"` rows — confirmed by reading the function
  before relying on it, not assumed — so nothing here can accidentally
  cause an un-reviewed post to publish.
- i18n: full `review.*` namespace + `nav.reviewInbox` +
  `calendar.statusRejected/Failed/Generating` added to both `en.json` and
  `pt.json`.
- Verified: `npx tsc --noEmit` clean, `npx eslint` on all changed files
  (0 errors, pre-existing-style `any` warnings only, same pattern already
  used elsewhere in `Calendar.tsx`/`PostCard.tsx`), `npx vite build` clean.

## Phase 6 — Stripe billing chain, actually confirmed end-to-end (2026-08-08)

Phase 4 fixed a real bug (broken user lookup in `stripe-webhook`) and
called the revenue path fixed, but explicitly flagged it as **unverified**
against a real completed purchase. This phase is that verification —
done with the user running real test-mode Stripe payments while checking
the database directly after each one, not trusting a "looks fixed" log
line. Two more real bugs surfaced in the process, both now fixed and
confirmed:

- [x] **`current_period_end` moved off the top-level Stripe `Subscription`
      object.** Root cause of every `stripe-webhook`/`check-subscription`
      500 in this phase. Stripe's flexible-billing-intervals rollout moved
      `current_period_end`/`current_period_start` from the Subscription
      object onto each subscription item. Both functions read the
      now-`undefined` top-level field, `undefined * 1000` is `NaN`, and
      `new Date(NaN).toISOString()` throws `RangeError: Invalid time
      value` — crashing the handler *after* finding the real Stripe data
      but *before* writing anything or returning a real response. Found
      by reading the actual response body via browser DevTools (the
      Supabase log viewer only shows HTTP status lines, not the thrown
      error — a real tooling gap worth remembering for future debugging
      here). Fixed in 3 places (1 in `check-subscription`, 2 in
      `stripe-webhook`): read `subscription.items.data[0].current_period_end`
      first, fall back to the old top-level field for older data.
- [x] **`STRIPE_WEBHOOK_SECRET` was set to the wrong endpoint's signing
      secret.** This Stripe sandbox has two registered webhook
      destinations ("playful-oasis", unrelated to this app, and
      "brilliant-jubilee", the real one) — the secret in Supabase had
      been copied from the wrong one, so every real webhook delivery
      failed signature verification (`400`, "No signatures found").
      Also worth remembering: Supabase Edge Functions do not reliably
      hot-reload a changed secret into already-warm instances — a
      **redeploy after any secret change** is what actually made the
      corrected secret take effect, even though the value itself had
      been correct for a while before that.
- [x] **False positive caught before being trusted**: a `stripe-webhook`
      delivery returned `200` and looked fixed from the log line alone,
      but the `subscriptions` table showed zero rows updated anywhere —
      the handler had silently hit its "no matching Supabase user, skip"
      branch, which returns the same `{"received": true}` as a real
      write. Added an explicit `outcome` field to the webhook's response
      body (`wrote:user=X:tier=Y` / `skipped_no_user:...` / etc.), logged
      and returned on every request, so this exact silent-skip failure
      mode is visible directly in Stripe's Workbench without needing log
      access at all.
- [x] **Real end-to-end confirmation, not a log line**: a genuine Stripe
      test payment now correctly produces `tier: "pro"`, the right
      `end_date`, and a live `updated_at` timestamp in the `subscriptions`
      table. Checked directly via SQL against the actual row, not
      inferred from a webhook response.
- [x] **`create-checkout`'s post-payment redirect URL** had a hardcoded
      Lovable preview host baked in as both an allowlisted origin and the
      ultimate fallback — real successful payments were redirecting to a
      dead, unrelated page instead of back into the app. Fixed to use the
      real production domain.
- [x] **Profile identity was hardcoded** to `"Admin User" /
      "admin@company.com"` everywhere outside the Settings page itself
      until a user manually saved their profile once — `ProfileSettings.tsx`
      loaded the real data correctly but only wrote it into the shared
      app-wide store on save, never on initial load. Added a sync-on-login
      bridge (same pattern as the existing dark-theme sync).
- [x] **Sidebar "Upgrade Now" button had no `onClick` handler at all** —
      wired to `/pricing`. Same card also now hides itself for accounts
      already on Pro instead of showing an upsell to someone who's already
      paying.
- [x] **Platforms page**: TikTok/Instagram cards rendered with zero color
      (dynamically-built Tailwind classes `bg-tiktok`/`bg-instagram` were
      never defined in `tailwind.config.ts` — only `tiktok-cyan/pink` and
      `instagram-orange/pink/purple` exist). Switched to the existing
      `getPlatformColor()` helper. Also fixed the connected-platforms grid
      stretching every card to match its tallest neighbor (`items-start`),
      which was producing the oversized/half-empty cards reported.

**Not done / explicitly out of scope this phase**: sending an email
confirmation on successful subscription. No email provider (Resend,
SendGrid, etc.) is wired into this app at all right now — Supabase Auth's
built-in emails work, nothing custom does. Needs a provider account + API
key before it can be built.

---

## Phase 5 — User-driven UI/UX pass (2026-08-06)

Not an audit — the user walked through production themselves and reported
real, reproducible bugs one at a time. All merged to `main`, live on
`content-cms-hub.vercel.app`.

- [x] **Billing page was fully mocked.** `currentPlan` was hardcoded to
      `"pro"` in component state, completely disconnected from the real
      `subscriptions` table or Stripe — every account saw "Pro" regardless
      of actual subscription status. Payment methods/invoices were fake
      local state; "Cancel Subscription" just fired a toast with no real
      effect. Rewired the whole page onto `useSubscription()` and real
      Stripe Checkout/Customer Portal. Removed the fake hand-rolled
      card-entry form (was collecting raw card numbers into React state).
- [x] **"Novee" branding removed** from Landing/Pricing copy (en + pt) —
      replaced with "AI Assistant", matching what's actually in the app.
      Also fixed LinkedIn URL and contact email to the real
      novusexchange.com domain.
- [x] **Demo login / Supabase debug info** on the Auth page was rendering
      unconditionally, including on production. Gated behind the same
      `isPreviewHost` check already used elsewhere.
- [x] **Calendar was always showing fake data.** A recurring weekly
      "posting template" overlay (`scheduleTemplateEvents` in
      `Calendar.tsx`) injected synthetic events into every month
      regardless of real data — so the calendar never looked empty even
      with zero real posts. This was mistaken for "the calendar is full of
      content" when it was actually always-on filler. Removed entirely;
      calendar now renders only real posts from the DB.
- [x] **All 40 real posts in the live DB deleted at the user's explicit
      request** (confirmed via `AskUserQuestion` before running the
      delete — this was a real, irreversible `DELETE FROM posts`, not a
      UI change). DB is now genuinely empty of posts, as intended.
- [x] **Calendar UI redesign**, from a marked-up screenshot: mini calendar
      sidebar widget was oversized/unevenly padded — shrunk and centered.
      Event chips changed from rounded pills to square corners
      (`rounded-none`). Platform chip colors (Twitter/X, Facebook,
      LinkedIn, Instagram, YouTube) moved from bright Tailwind 500/600/700
      shades to deeper 800/900 tones — same per-platform hue, less
      saturated/primary-looking.
- [x] **Light theme was fundamentally broken, then disabled — now fully
      re-enabled (Phase 10, 2026-08-29).** Root cause: the `.glass`/
      `.glass-card` utility classes (used app-wide) tint themselves with a
      literal white overlay assuming a dark page behind them, and headings
      throughout use hardcoded `text-white` — both totally reasonable
      *while light theme never actually rendered* (the `.light` CSS block
      didn't exist until Phase 4/5 added it). The moment light mode
      started working, all of that surfaced as broken: cards
      near-invisible, text unreadable. Phase 9 fixed the root
      `.glass-card` tint and swept the Sidebar + Overview/Dashboard page;
      Phase 10 swept the remaining 9 files (Articles, Automation,
      ContentModel, Platforms, ContentPipeline, Settings, AIAssistant,
      ScheduleCalendar, Calendar.tsx — WorkflowTest.tsx needed no change,
      its one `bg-black/60 text-white` is a legitimate always-dark
      image-caption overlay) converting every hardcoded `text-white` /
      `bg-black/X` / `border-white/X` / `bg-white/[0.0x]` occurrence tied
      to page chrome onto theme tokens (`text-foreground`,
      `bg-foreground/X`, `border-foreground/X`, `text-primary-foreground`
      on `bg-primary` surfaces), while deliberately leaving three
      categories unchanged as correctly theme-independent: solid
      brand-color platform badges/cards (fixed saturated backgrounds like
      TikTok's black or YouTube's red — white text stays legible against
      them in either theme), modal scrims and image-caption overlays
      (dimming/legibility overlays on top of arbitrary photo content or
      the whole page, not tied to the page background), and colored
      action buttons (e.g. the `bg-emerald-600` "Activate Weekly" button)
      whose white text contrasts the button's own fixed color. Also caught
      and fixed a hardcoded `bg-[#0a0d1a]` header background and stray
      `text-gray-*` classes in Calendar's week/day/agenda views that the
      original `text-white`-only grep had missed. Removed `ThemeProvider
      forcedTheme="dark"` from `App.tsx` (the `.light` CSS block was
      already complete) and re-enabled both UI paths: the Settings >
      Appearance theme radio group (light/dark/system, wired to
      `useUserPreferencesStore`) and the header dropdown's dark-mode
      quick-toggle switch (reads `next-themes` `resolvedTheme`, writes
      back through the same store). Verified: `tsc --noEmit` clean,
      `eslint` 0 errors (pre-existing `no-explicit-any`/effect warnings
      only, nothing new), `vitest` 63/63 passing, production build
      succeeds. Not yet done: a live visual pass toggling both themes on
      each page in a real browser — the conversions follow the exact
      idiom already proven correct in the Phase 9 `.glass-card`/
      Sidebar/Overview fix, but haven't been screenshotted side-by-side.
- [x] **AI Assistant was crashing on every message — real bug, not the
      Phase 8 OpenAI key concern (Phase 10, 2026-08-29).** User tested
      it directly, screenshotted the actual error: "Oops! My circuits
      got a bit tangled there. (`supabase.auth.getClaims is not a
      function`)". Root cause: both `novee-chat` and `generate-strategy`
      edge functions call `supabase.auth.getClaims(token)` to validate
      the caller's session, but pin `@supabase/supabase-js@2.45.0` and
      `@2.57.2` respectively — versions whose auth client has no
      `getClaims()` method at all (it's a newer addition that also
      requires asymmetric JWT signing keys this project doesn't have
      configured). Every chat message threw a `TypeError` before the
      request ever reached OpenAI — nothing to do with the API key.
      Fixed by swapping both to `supabase.auth.getUser(token)`, which
      has always existed on the client and validates a bearer JWT the
      same way with no extra project configuration. Confirmed the
      deployed source matched the repo exactly before touching it (no
      drift to reconcile), then deployed both to production
      (`novee-chat` v43, `generate-strategy` v41). Also fixed a smaller
      bug found in the same screenshot: the mic button's error path was
      silent — a failed voice-input start (permission denied, no
      microphone, browser hiccup) just flipped the button back off with
      no feedback, looking like a "double toggle" that did nothing.
      `useSpeechRecognition` now takes an `onError` callback (wired
      through the Web Speech API's `onerror` event plus a `try/catch`
      around `.start()`) and the AI Assistant page surfaces it as a
      toast with a reason-specific message. New i18n keys added to both
      `en.json`/`pt.json`, parity test passing. Verified: `tsc --noEmit`
      clean, `eslint` 0 new errors, `vitest` 63/63 passing.
- [x] **Two more real bugs found on retest, both fixed (Phase 10,
      2026-08-29).** The `getClaims` fix above worked — but the user's
      retest (different browser, DevTools console open) surfaced two
      more things the console made diagnosable directly, no guessing:
      1. **Microphone showed "not allowed" despite the browser
         permission being granted.** `vercel.json` sends
         `Permissions-Policy: camera=(), microphone=(), geolocation=()`
         on every response — `microphone=()` disables the feature for
         the whole document at the HTTP-header level, overriding
         whatever the user allowed in the browser's own per-site
         permission UI. Changed to `microphone=(self)`; camera/
         geolocation stay locked since nothing uses them.
      2. **Every chat message, any content, failed with a 400 "Invalid
         message entry."** Console showed the request payload being
         rejected before reaching OpenAI. `novee-chat`'s validation caps
         every message at 8000 characters — meant to stop a
         runaway/abusive *user* message, but applied uniformly to the
         *system* message too. The client's system prompt
         (`useChat.ts`) embeds the full `CONTENT_SCHEDULE` JSON so
         Novee always works off the real schedule instead of inventing
         one — measured it directly, that JSON alone is ~14.6KB.
         Every single request was rejected regardless of what the user
         typed. Gave the system role its own 50000-char ceiling instead
         of sharing the 8000 cap meant for user input. Deployed as
         `novee-chat` v44.

      **Also clarified a real point of confusion**: the user asked
      whether "Novee" was a separate floating chatbot widget they
      remembered removing, now somehow back. Traced it — it never was:
      "Novee" is purely this same AI Assistant's internal backend name
      (the edge function slug, the system-prompt persona, log-line
      prefixes); confirmed zero occurrences in any user-facing text or
      i18n key. What *was* real dead code: `src/hooks/useNoveeChat.ts`,
      a near-duplicate of `useChat.ts` with zero imports anywhere in the
      app — a genuine leftover from an earlier iteration. Deleted it.

      Verified: `tsc --noEmit` clean, `vitest` 63/63 passing.
- [x] **AI Assistant fully root-caused end to end — chain closed on a
      billing state, not a bug (Phase 10, 2026-08-29).** User retested
      again and hit a third failure: every message now returned 429
      "Rate limit exceeded." Two real problems in how that was handled:
      (1) OpenAI returns the same 429 status for a genuine transient
      rate limit *and* for an account with zero usage credit —
      distinguishable only by the response body's `error.code`, not the
      status — and `novee-chat` was showing identical generic text for
      both, which would hide a real billing problem behind something
      that sounds temporary; now reads OpenAI's actual error body and
      returns a distinct "out of usage credit, fix this in the OpenAI
      billing dashboard" message when that's what it is. (2) the
      client's retry loop retried on *any* non-ok response including
      4xx, so a 429 got hammered twice more a second apart — useless
      against a rate limit and actively harmful, burning further into
      the same window. Retry now only fires on a network exception or a
      5xx. Deployed as `novee-chat` v45. **User confirmed directly: the
      OpenAI account genuinely has zero credit right now, by their own
      choice, not something to fix in code** — this closes the AI
      Assistant investigation. All three bugs found along the way
      (`getClaims` version mismatch, the 8000-char system-message cap,
      generic 429 messaging + retry-hammering) are fixed and deployed;
      the assistant will work as soon as credit is added, no further
      code changes needed.
- [x] **Stale-app caching fixed — explicit `Cache-Control` in
      `vercel.json` (Phase 10, 2026-08-29).** User hit the same
      "old dark/light theme behavior" bug reappear on a *different*
      browser (Chrome) after already confirming it fixed on Opera — the
      document itself was being served stale, not a per-browser quirk.
      `vercel.json` never set an explicit `Cache-Control`, so how long
      the HTML document (served by every route through the SPA rewrite)
      stayed cached was left to Vercel's implicit default — exactly the
      kind of thing that produces "different browser, same stale build"
      symptoms after every deploy. Now explicit: the document response
      gets `no-cache, must-revalidate` (always checks for a new version
      before using a cached one — the next deploy is visible without a
      hard refresh), while the actual JS/CSS bundles under `/assets/`
      (Vite content-hashes them, so a new build gets a new filename) get
      `public, max-age=31536000, immutable` — safe to cache forever
      since a stale copy can never be served under an old build's
      filename. **User action needed once**: this only prevents *future*
      staleness — the copy already cached in your Chrome tab predates
      this fix, so it still needs one hard refresh (Ctrl+Shift+R) or a
      fresh tab to pick it up; every deploy after that should be clean
      automatically.
- [x] **Overview/Dashboard page fixed for light theme — never actually
      swept, unlike the other 10 files (Phase 10, 2026-08-29).** After
      the hard refresh cleared the caching issue, the user's next
      screenshot showed light theme "looking awful" specifically on
      Overview: a solid near-black greeting banner sitting on an
      otherwise white page, a barely-visible "Platform Health" empty
      state, washed-out chart text. Traced it: `src/pages/Index.tsx` was
      never actually touched by the earlier sweep despite this file's
      own Phase 9 entry claiming Overview was covered — it still had
      ~40 occurrences of the exact hardcoded `text-white`/
      `bg-white/[0.0x]`/`border-white/[0.0x]` pattern fixed everywhere
      else. Swept it the same way: the greeting banner (was
      `bg-zinc-950/80`, opaque near-black regardless of theme) now uses
      the same `.glass-card` idiom every other panel on that exact page
      already uses; ~15 more glass-panel occurrences (nav-arrow buttons,
      goal cards, automation rows, heatmap empty-cell color) converted
      to `bg-foreground`/`border-foreground` equivalents; 5 empty-state
      icon+text combos that stacked `text-muted-foreground/30` with
      `opacity-10` (nearly invisible against white, was a subtle
      "ghost" hint against near-black) normalized to the
      opacity-60-text/opacity-20-icon pattern already proven legible in
      both themes elsewhere (e.g. `Automation.tsx`'s empty states); the
      activity chart's axis labels and tooltip used hardcoded colors
      (`fill: "#6b7280"`, `background: "hsl(222 47% 6%)"`) — the tooltip
      in particular would've popped up as a dark box floating over an
      otherwise light page — switched to the same
      `--muted-foreground`/`--popover`/`--popover-foreground`/`--border`
      tokens used everywhere else. A repo-wide re-check afterward (every
      page and component, not just the original file list) found one
      more real instance: `AutomationCard.tsx`'s dropdown menu overrode
      its base component's already-theme-aware `bg-popover` default with
      a literal `bg-[#0a0c10]/95` (always near-black) — fixed to
      `bg-popover/95`. Everything else that re-check flagged (platform
      brand-color badges in Calendar/Automation, a code-viewer block and
      an image-caption overlay in WorkflowTest, the Sidebar's
      white-tinted overlays — the sidebar stays on its own
      permanently-dark rail in both themes by design, LinkedIn's actual
      brand blue, a gray status badge matching the same
      amber/blue/emerald status-color convention used everywhere) is a
      legitimate theme-independent exception under this session's
      already-established pattern, not a bug. Verified: `tsc --noEmit`
      clean, `eslint` 0 new errors, `vitest` 63/63 passing, production
      build succeeds.
- [x] **Production deploy pipeline confirmed working end-to-end**: this
      branch → GitHub push → Vercel auto-deploy (GitHub integration
      already wired up, no action needed) → `content-cms-hub.vercel.app`
      (bound to `main`). Merged this branch into `main` twice during this
      session to get changes live for the user to review in their own
      browser — see "How to reach a running instance" below, which this
      phase's work supersedes for the "how do I see this" question.

---

## Phase 4 — Revenue path + CSP reporting (2026-08-01)

**This corrects a false "PASS" in the 2026-07-31 Phase 3 report.** That
report's scorecard says Stripe billing functions are "live and running
correctly." They were not — see below. Nobody re-read the actual
`stripe-webhook` logic against the live schema in Phase 3; it was passed on
the strength of "the function deploys and the cron/webhook registrations
exist," not on tracing what happens when a real event arrives.

- [x] **`stripe-webhook` has never successfully recorded a subscription,
      ever — found and fixed.** Two independent bugs, either one alone would
      have been fatal:
      1. `getUserIdByEmail` queried `profiles.eq("email", ...)` — the
         `profiles` table has no `email` column at all. Every lookup threw,
         `upsertSubscription` never ran, for every event since this function
         was written.
      2. The product-ID → tier mapping only recognized old/stale Stripe
         price IDs, so even a working lookup would have written `tier:
         "free"` regardless of what the customer actually purchased.
      **Fix:** `create-checkout` now finds-or-creates the Stripe customer
      explicitly and tags it with `metadata.supabase_user_id`;
      `stripe-webhook` reads that directly instead of matching by email
      (falls back to matching `auth.users` by email for pre-existing
      customers created before this change). Tier mapping updated to match
      `check-subscription`'s current starter/pro price IDs. Both functions
      deployed to production (`stripe-webhook` v26, `create-checkout` v30).
      **Verified:** all 4 live Stripe price IDs checked against the new
      mapping (correct amounts/tiers), webhook endpoint confirmed
      registered for exactly the 5 events the code handles.
      **Not yet verified: an actual live/test-mode purchase completing
      end-to-end.** The Stripe MCP tool blocks creating checkout
      sessions/subscriptions programmatically (an intentional guardrail
      against an agent initiating financial transactions). Confirming this
      fully requires either you running one real test-mode purchase, or you
      authorizing me to drive a browser through Stripe's hosted test
      Checkout with a test card. **This is the single highest-priority
      remaining item** — it's the revenue path, and until someone completes
      a purchase and watches a `subscriptions` row update, "billing works"
      is still an inference, not an observation.
- [x] **CSP reporting endpoint — added.** The Phase 3 report flagged CSP as
      "PASS (syntax)" but unverifiable — no reporting mechanism meant "zero
      violations" couldn't be distinguished from "reports go nowhere."
      Added: `csp_reports` table (RLS: admin-only SELECT, written only by
      the edge function's service-role client), a `csp-report` edge
      function handling both the legacy `report-uri` shape and the modern
      batched Reporting API (`report-to`) shape, and `vercel.json` now sends
      `report-uri` + `report-to` + a `Reporting-Endpoints` header.
      **Fully verified end-to-end, 2026-08-01:** you triggered a real
      `eval("1")` CSP violation from a real browser against the PR #10
      Vercel preview (blocked by `script-src`, no `unsafe-eval`); the
      resulting report landed in `csp_reports` seconds later —
      `blocked_uri: "eval"`, `violated_directive: "script-src"`,
      `disposition: "enforce"`, `document_uri` matching the preview URL.
      The full pipeline (browser → report → edge function → table) is
      confirmed live, not just structurally verified.

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
      - [x] **Branch protection requiring CI to pass before merge — done,
        2026-07-31.** Rule existed but silently applied to 0 branches
        (pattern was `Main`, capital M — GitHub patterns are
        case-sensitive, actual branch is lowercase `main`). Fixed the
        pattern and confirmed `test`/`e2e` required checks are attached;
        you verified the page now shows "Currently applies to 1 branch."
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
- [x] **Leaked-password protection — decided, staying off.** Requires
      Supabase Pro (project's on Free); greyed out in the dashboard
      (Authentication → Sign In/Providers → Email). **2026-07-31: you
      decided not to upgrade for now.** Not a live vulnerability, just
      a hardening item — revisit if/when the project moves to Pro.
- [x] **Google Sign-In — configured and working.** Was mid-setup as of
      2026-07-29; confirmed done by direct evidence, not just a config
      check: `auth.identities` has a real `google`-provider row, created
      `2026-07-31 19:03:20`, a genuine completed Google sign-in. This
      note was stale for two days after you actually finished it.
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
- [x] **Edge function drift — investigated and neutralized, 2026-07-31.**
      The 6 functions live but not in `supabase/functions/`
      (`scheduled-pipeline`, `run-scheduled-automations`, `fire-webhooks`,
      `publish-twitter`, `execute-automation`, `generate-broadcast-script`)
      turned out to be more than stale drift — pulling their source
      turned up 3 real, currently-exploitable authorization gaps that
      were live in production:
      - **`generate-broadcast-script`** had `verify_jwt: false` — callable
        by anyone on the internet with zero authentication, burning the
        project's `GEMINI_API_KEY` budget on every call.
      - **`execute-automation`** required login but did no ownership
        check — any signed-in user calling it would trigger publishing
        of every user's due posts, not just their own.
      - **`fire-webhooks`** looked up a post by id with no ownership
        check — any signed-in user could pass another user's `postId`
        and get that post's content fired through their own configured
        webhook, leaking private content cross-account.
      - `publish-twitter` also let any signed-in user post to a single
        shared X/Twitter account via static credentials. `scheduled-
        pipeline` and `run-scheduled-automations` were confirmed dead
        duplicate automation-runner logic (checked live `cron.job` —
        only `schedule-content`/`schedule-from-templates` and
        `publish-due-posts` are actually scheduled; grepped `src/` and
        all migrations for the other 6 slugs — zero references).
      Redeployed all 6 as inert 410 stubs (couldn't find a delete-
      function tool in the available Supabase MCP tools, so a stub is
      the closest thing to deletion available). Confirmed via a fresh
      `list_edge_functions` pull that all 20 live functions are
      accounted for and only these 6 changed. Did not commit their old
      source into the repo — they're dead, re-introducing them as repo
      files would just resurrect the confusion. **Formal deletion via
      the Supabase dashboard (Edge Functions → select → Delete) is a
      nice-to-have cleanup whenever convenient — the stubs already
      close the exposure, so there's no urgency.**

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
- [x] **Mobile responsiveness — confirmed clean, on-device (2026-08-29).**
      Drove Playwright at 390×844 (mobile) and 768×1024 (tablet) against
      the unauthenticated pages in Phase 9: **Landing and Auth sign-in are
      clean** at both sizes — single-column stacking, full-width buttons,
      no overflow or cramped text. Couldn't check the authenticated pages
      from this sandbox — its network policy blocks the headless browser
      from reaching Supabase, so sign-in fails here and every authenticated
      route redirects to `/auth`; not a code finding, an environment
      limitation. The user closed that gap directly: signed in on a real
      iPhone against production (`content-cms-hub.vercel.app`) and walked
      Landing, Platforms, Calendar (month view), and Review Inbox.
      Screenshots confirm single-column stacking, full-width stat cards,
      no horizontal overflow, and the dark theme rendering correctly
      end-to-end on-device.

---

## How to reach a running instance

- **Production, no setup — https://content-cms-hub.vercel.app** — bound to
  `main` via Vercel's GitHub integration (auto-redeploys on every push to
  `main`, no manual deploy step). This is the real answer as of Phase 5.
- **Branch preview** —
  https://content-cms-hub-git-claude-project-c-8508cb-twistted1s-projects.vercel.app
  tracks `claude/project-completion-audit-o1xgt5` specifically, useful for
  reviewing this branch's work before it's merged to `main`.
- **A sandboxed session's dev server** (`localhost:5173` inside that
  session's container) is never reachable from your browser — not a
  choice, a `localhost` inside a container is only visible to processes in
  that same container. The two URLs above are the actual way to see
  anything running.

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
- Phase 9 + Phase 10 work: merged directly to `main` (no-ff merge commits,
  bypassing the PR-review gate at the user's standing direction for this
  branch) — `74c8329` (Phase 9: recurring duplicate-content fix, E2E
  project recreation) and `503b364` (Phase 10: light theme
  re-enablement). Both live on production now.
