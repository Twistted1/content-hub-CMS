# Content Hub CMS — Master Checklist

Single source of truth for project completion status. Supersedes `AUDIT.md`
and `PHASE_0_TESTING.md` (kept for history, not maintained going forward —
everything live gets updated here). Checkboxes are literal state, not
decoration: `[x]` means verified against source/live systems on the date
next to it, `[ ]` means still open, with a comment on what's blocking it and
what I'd do about it. No item stays vague — either it's checked with
evidence, or it's open with a next action.

**Last verified:** 2026-10-19 (Phase 21). A second agent worked this branch on
2026-10-16; I reviewed its three commits rather than assuming they were fine,
rebased my work on top (nothing overwritten), and confirmed its most consequential
change actually works: **AI spend limits are enforced on all three paid-API call
sites**, with a per-user cap as well as the instance ceiling — which corrects
Phase 18's "billing has zero server-side enforcement" for *spend* (plan/tier
gating from `subscriptions` is still absent). I verified the table and column it
depends on exist in production by probing them (a missing table gives `404
PGRST205`, a missing column `42703`; neither appeared), then fixed the latent bug
that check exposed: **both existed only in the dashboard and in no migration**, so
any fresh environment would have silently lost the enforcement entirely. New
migration `20261019000001_add_ai_usage_log.sql` plus loud error handling and a
`degraded` flag in `aiBudget.ts`. Also recorded: their fix to my webhook receiver
was correct and **my receiver had a real deployment flaw** (it bound `127.0.0.1`,
unreachable behind a cloud proxy).

**Previously last verified:** 2026-10-19 (Phase 20). **Webhook deliveries are now
authenticated and there is a working reference receiver.**
`supabase/functions/_shared/publishDelivery.ts` signs every delivery with
HMAC-SHA256 (`X-Novus-Signature`, over the exact raw body) plus a stable
`X-Novus-Delivery-Id` and a timestamp, so a receiver can refuse anything that did
not come from this CMS instead of trusting whatever reaches its URL.
`tools/webhook-receiver/` is a runnable receiver that verifies the signature,
enforces a replay window, de-duplicates on `delivery_id`, and maps a delivery
onto the site's `articles` row **in dry-run by default** — because `articles` has
no status column, so an insert is live on the public site immediately. Custom
webhook headers can now be set from `/pipeline`. Verified: `publish-e2e` 26/26
(the harness recomputes the digest over the body it received), receiver self-test
10/10, 139 unit tests passing. **Set `WEBHOOK_SIGNING_SECRET` and redeploy
`publish-due-posts` + `content-pipeline`,** or deliveries stay unsigned.

**Previously last verified:** 2026-10-14 (Phase 19). **The outbound webhook contract is now
unified** — one envelope defined in `supabase/functions/_shared/publishDelivery.ts`
and imported by both delivery paths, with a stable `delivery_id` for
de-duplication, a content `type` (Instagram needs it), and per-platform caption
truncation enforced at publish time for the first time. A long article used to
hard-fail LinkedIn and Instagram while X was silently cut to 280. Verified on the
wire against a live receiver (23/23 harness checks) and by 18 new unit tests.
`customer-portal`'s dead Lovable fallback — the same bug Phase 6 fixed in
`create-checkout` and missed here — is fixed too. **Requires redeploying
`publish-due-posts`, `content-pipeline` and `customer-portal`** (all three, since
they now share a module). Still missing on that path: a shared secret/signature,
update/unpublish events, and auth-header UI.

**Previously last verified:** 2026-10-14 (Phase 18). Three read-only audits answered the
owner's questions about remaining code work, feeding `novusexchange.com`,
open-sourcing and commercialization; findings are recorded in
`docs/READINESS_GAP_ANALYSIS.md` and `docs/HEADLESS_CONSUMPTION.md` with
verified-vs-reported provenance marked per item. **Four findings matter most.**
(1) **Production exposes an anonymously readable `articles` table with 4 real
Novus Exchange articles that this CMS neither creates nor writes** — the site's
content and the CMS are two disconnected systems, and whether `articles` is the
real public store is an open owner decision. (2) **Billing has zero server-side
enforcement** — no function ever reads `subscriptions`, so a free user can spend
the owner's AI budget. (3) **The migration set cannot rebuild the database**
(`project_settings`/`subscribers` are never `CREATE TABLE`d), which is why the
E2E project had to be rebuilt by introspecting production. (4) **The advertised
14-day trial is not implemented.** Open-source release needs ~1–2 weeks
(chiefly a `LICENSE` decision, replayable migrations, and de-hardcoding the CSP
and cron URLs); hosted multi-customer SaaS is a 6–10 week data-model rewrite,
while selling self-hosted/per-customer deployments is ~2–3 weeks and fits the
existing single-tenant design.

**Previously last verified:** 2026-10-14 (Phase 17). **LinkedIn publishing is now
confirmed live in production** — a real post reached the owner's feed through the app,
exercising the OAuth token chain end to end (owner-reported, with a screenshot;
not independently verifiable from a session). **This does not change go-live
status**, because LinkedIn is a *direct* platform and never needed a webhook:
**no active `webhook_configs` row exists, so the six webhook platforms are still
undeliverable in production.** That single operational step remains the gap.
Everything else from Phases 15–16 stands: both critical objectives are done and
evidence-backed, the `scheduleMode` fix is live (`content-pipeline` v32 /
`schedule-from-templates` v13), and the Stripe purchase is verified through to
the `stripe-webhook` database write.

**Previously last verified:** 2026-10-14 (Phase 16). Follow-up after the owner's status
replies. All three follow-up items are now closed, and one of my own
conclusions was wrong and is corrected below. **The deploy gap is fixed:**
`publish-due-posts` and `demo-login` had been running June-2026 source — merged
code was never shipped — and `content-pipeline`/`schedule-from-templates` were
stale the same way; all four are now redeployed
(`content-pipeline` **v32**, `schedule-from-templates` **v13**), so Phase 15's
`scheduleMode` fix is **live**. The `banned_until = 'infinity'` diagnosis was
confirmed right (fixed by using `2099-12-31`; `'infinity'` is unsafe there).
**My DELETE-hang diagnosis was wrong:** the suggested lock check returned zero
blocked rows, the hang is isolated to the owner's SQL tool, and the app's own
delete paths are unaffected. The leaked-anon-key item is **closed as won't-fix
by the owner's decision** (only already-public values were exposed; the boundary
is RLS) — do not re-raise it as a blocker. One item remains genuinely open:
**no active `webhook_configs` row exists**, so no webhook platform currently
delivers in production, though the mechanism is proven.

**Last verified:** 2026-10-14 (Phase 15). Go-live gap closure ahead of the
2026-10-18 deadline. The headline: **a webhook-only platform now genuinely
delivers — proven both locally against the real `publish-due-posts` source
(20/20 checks) and in production end-to-end, with the receiver's own log read
back as evidence.** A real Stripe test-mode purchase through the app's own
checkout is verified through to the `stripe-webhook` database write
(`tier: pro`). The `scheduleMode` union drift is fixed with a mutation-tested
guard against recurrence, and review-status transitions went from zero tests to
15. The one item that needed a human rather than code — `handleBulkApprove` —
was decided by the owner (keep "Approve All"), not silently changed.

**Previously last verified:** 2026-09-18 (Phase 12). Phase 12 is an independent
re-audit of the whole repo — structure/deps, Supabase migrations, RLS
and security, frontend hooks/state/i18n, and cron/deployment readiness —
which found and fixed one unauthenticated session-minting backdoor, a
live production JWT committed to a migration, two enum/schema values the
app writes that no migration created, a publish queue that made every
transient failure permanent, a UI that reported undelivered posts as
published, an undefined timezone contract for `scheduled_at`, and 6 edge
functions missing their `config.toml` entries. Full detail below. One
item still needs your action: **rotate the Supabase anon key** that
leaked into git history.

**Previously last verified:** 2026-08-29 (Phase 10). Phase 10 recreated the disposable
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
✅ **Light/dark theme visual pass — user-confirmed working (2026-08-30)**:
user did the live browser pass across the app and reported both themes
fixed and working. Closes the last open item from the theme-rework
chain. Nothing else code-related is blocking core CMS
use — remaining items are GitHub/Supabase settings only you can change,
or decisions only you can make — see the "Open" sections below.

---

## Phase 15 — Go-live gap closure (2026-10-14)

Deadline: **2026-10-18**. Runway at start: 4 days. The gap was operational, not
code quality — all four gates were already green (`npm ci` 0, `tsc --noEmit` 0,
`eslint` 0 errors / 289 warnings, `vitest` 85 passed / 1 skipped, `vite build`
0) before any change, and again after.

Priority order came from the brief. Objective 2 needed a human decision, so it
was asked before any code was touched; objectives 1 and 3 needed live
credentials, so those were asked at the same time to avoid a second round trip.

- [x] **OBJECTIVE 1 (CRITICAL) — a webhook-only platform now genuinely
      delivers, proven twice over.** The fact that mattered most is that six of
      eight platforms had no delivery path at all without an active
      `webhook_configs` row. Both halves are now evidenced, not asserted:
      - **Mechanism, locally:** new `tools/publish-e2e/` runs the **real,
        unmodified** `supabase/functions/publish-due-posts/index.ts` under Deno
        (the same runtime Supabase uses) against a local PostgREST stub, with
        its delivery pointed at a receiver over the public internet. **20/20
        checks pass**, covering: a `website` post actually delivering; the
        receiver getting the exact `post.publish` envelope plus a custom header;
        the post and its `post_platforms` row flipping to `published`; *no*
        webhook producing the loud
        `No active webhook configured for {platform}` failure with the post kept
        retryable rather than dropped; retries exhausting into `failed`; the
        SSRF guard refusing a loopback target; cron auth reading the secret from
        the database and rejecting a wrong one; and an unauthenticated call
        getting 401 before any claim is attempted. Run with
        `npm run e2e:publish -- --receiver <url>`.
      - **Production, end to end:** a real post created through the Calendar
        (platform `website`) was delivered by the deployed function. The
        receiver's own log — read independently of the harness — shows a single
        `POST` at `2026-10-14T01:15:06Z` from a Supabase edge IP carrying
        `{"event":"post.publish","platform":"website","post":{"id":
        "baa44b0d-64a4-449e-96ff-8978e44a8721",...}}`. That `post.id` is a live
        database UUID, not a fixture, which is what distinguishes this from the
        local run.
      - **Proven vs. still unproven, stated exactly:** **`website` is proven
        deliverable.** `instagram`, `facebook`, `tiktok`, `youtube`, `rumble`
        and `podcast` are **still unproven in production** — the mechanism is
        proven and identical for all of them, but no real row/receiver was
        exercised for those six, so nobody should claim they work.
      - **Finding worth acting on:** `rumble` and `podcast` are not offered by
        *either* platform picker (`ContentPipeline.tsx:29` `PLATFORM_OPTIONS`,
        `Automation.tsx:415`), so those two cannot be reached from the UI at
        all. The actionable webhook-only set is therefore **five**, not six:
        `instagram`, `facebook`, `tiktok`, `youtube`, `website`. Leaving a
        webhook's platform badges all unselected stores `platforms: []`, which
        matches *every* platform — one row then covers the whole calendar if the
        endpoint handles all of them.
- [x] **OBJECTIVE 2 (CRITICAL) — `handleBulkApprove` decision obtained, not
      guessed. 🔴 Owner-confirmed 2026-10-14: keep the current behaviour.**
      Approving the entire needs-review queue when nothing is checked is
      **intentional**, and the button already reads "Approve All" in that state
      (`Review.tsx`). No behaviour was changed. The decision is now recorded in
      executable form — `src/utils/reviewTransitions.ts` `bulkApproveTargets`
      carries the rationale in its doc comment, and
      `reviewTransitions.test.ts` pins it, so a future reader finds the decision
      instead of "fixing" it. This is the single highest-value thing to have
      closed, because it was the one item that could not be settled by code.
- [x] **OBJECTIVE 3 (HIGH) — a real, non-test transaction is verified, and
      specifically the part that had broken before.** New
      `tools/stripe-e2e/run.mjs` (`npm run e2e:stripe`) drives the app's **own**
      checkout path: signs in, calls `create-checkout`, pays the Stripe-hosted
      page with the `4242` test card in a real browser, and waits for the
      redirect back into the app. **7/7 checks pass.** The pass condition is
      deliberately *not* `check-subscription`'s reply — that function reads its
      answer from Stripe, so it would report success even if the webhook never
      wrote anything. The assertion is the `subscriptions` row itself, read back
      through the user's own session (RLS policy `Users can view their own
      subscription`). Confirmed: `tier` went `free` → **`pro`**,
      `end_date` = `2026-11-14T02:39:07+00:00`, and `updated_at` moved past
      `created_at`. That is the `stripe-webhook` write landing — the exact step
      that silently did nothing for the whole life of the project before
      Phase 4/6.
- [x] **OBJECTIVE 4 (HIGH) — `scheduleMode` type-union drift fixed, and guarded
      against recurrence.** The union is now
      `"immediate" | "scheduled" | "draft" | "awaiting_review"`, defined once in
      `src/utils/scheduleMode.ts` and mirrored in the two edge functions that
      cannot import it. The gate in `content-pipeline` was replaced with a
      **total, explicit** condition (`mode === "immediate"`), and an unrecognised
      mode now resolves to a *held* post rather than an immediate one — a typo
      can no longer publish.
      **One correction to `docs/AUDIT_REPORT.md`:** its claim that
      `schedule-from-templates`' `"awaiting_review"` "gets silently treated as
      immediate" is not accurate for the real path. That cron always sends a
      `scheduledAt`, so the old
      `!scheduledAt && scheduleMode !== "draft"` fallback evaluated false and
      nothing was published early. The genuine defects were (a) the type contract
      excluding a value the code actually wrote, and (b) the fallback publishing
      immediately for any *other* non-draft mode that arrived without a
      `scheduledAt`. Both are fixed; the second is now covered by a test that
      asserts `"scheduled"` and `"awaiting_review"` hold with or without a
      timestamp.
      A new `scheduleModeParity.test.ts` **fails the build** if the edge
      function's list, the cron's mode, or *any* `scheduleMode: "..."` literal
      anywhere in the repo stops matching the union. The guard was
      mutation-tested three ways (edge array widened; cron mode typo'd; a call
      site inventing `"instantly"`) and each one failed the test as intended —
      a green test that cannot fail would have proved nothing.
- [x] **OBJECTIVE 5 (MEDIUM) — tests for the stage that had none.** Of the three
      untested stages, "content generation" and "publishing" were both reached
      by the work above, so the budget went to **review-status transitions**,
      which had *zero* coverage despite being the only part of `/review` that
      writes to the database. The four transitions were extracted into
      `src/utils/reviewTransitions.ts` and pinned by **15 tests** — most
      importantly that *saving* never writes `status`/`scheduled_at`/
      `reviewed_at` (so saving a draft cannot approve it), and that sending a
      post back to draft clears `scheduled_at` rather than leaving a stale
      future timestamp that the Calendar would render as scheduled. Plus **12
      tests** for `scheduleMode`. The extraction is behaviour-preserving: the
      produced patches are byte-for-byte what the inline objects wrote.
      Recorded as **documented, not endorsed**: `rejected()` leaves
      `scheduled_at` alone while `sentBackToDraft()` clears it. Preserved
      as-shipped and asserted, so changing it is a decision rather than an
      accident; it is inert either way, since `publish-due-posts` only selects
      `status = 'scheduled'`.
- [ ] **OBJECTIVE 6 (LOW) — deliberately cut, with the specifics recorded.**
      Short on runway and explicitly ranked last by the brief, so none of the
      three was started:
      - *`podcast` schedule reconciliation* — not done. `schedule-from-templates`
        still carries a `podcast` entry with no `src/data/platforms/podcast.json`
        counterpart. Lower risk than it sounds: nothing can reach `podcast`
        anyway (previous bullet).
      - *Deleting the 6 inert stub edge functions* — not done, and **not
        doable from this environment**: it needs the Supabase dashboard. Per
        Phase 9, 5 of the original 6 are already gone from
        `list_edge_functions`; only `run-scheduled-automations` remains, still
        the same inert 410 stub.
      - *`has_role()` RPC exposure* — not decided, and it is **not mine to
        decide**. Supabase's security advisor flags it as a `SECURITY DEFINER`
        function reachable over the API. It is used in RLS policies
        (`csp_reports`, `subscriptions`, `user_roles`), so removing or revoking
        it needs a policy review, not a one-line revoke. Carried forward as open,
        with the recommendation that it be scoped to `authenticated` rather than
        `anon` if nothing else breaks.

**Verified after every change:** `npx tsc --noEmit` clean, `eslint` 0 errors
(289 pre-existing `any` warnings — unchanged), `vitest` **112 passed / 1
skipped** (was 85/1; +27 new), `vite build` clean. CI runs exactly these four
gates.

**Cleanup from this session — status as of the owner's 2026-10-14 reply:**

1. ✅ **Resolved.** The `/pipeline` webhook row pointing at the temporary
   `webhook.site` receiver was deactivated (`is_active: false`) and renamed
   `[RETIRED] …` by the owner. It is left in place rather than deleted (see the
   item-2 note on `DELETE` below) but is fully inert: `publish-due-posts` filters
   `is_active = true` (`index.ts:123`), so it cannot match or deliver. **Note the
   consequence:** as of this writing there is no active `webhook_configs` row at
   all, so *no* webhook platform currently delivers in production — see the
   "webhook-only platform currently has no active row" item in Phase 16.
2. ✅ **Neutralised by the owner.** `golive-verify-c5b717e1bc@example.com`
   (user `a34cb16a-254f-49f2-93a9-c64d1e173731`) was banned and its test-mode
   `pro` subscription downgraded to `free`. Verified from here: password login
   for that account is now refused (created a fresh account in the same minute
   and it logged in fine, so the refusal is account-scoped, not an outage).
   **The refusal is an HTTP 500, not a clean ban** — see Phase 16.
3. ✅ **Closed as "won't fix", by decision.** The owner reports the leaked value
   was only the anon/publishable key, project URL and project ID — all three
   already public in the client bundle by design — and no service-role key or
   real secret was ever in `20260323155000`. Decision: **not rotating**, because
   the security boundary here is RLS, not key secrecy. Do not re-raise this as a
   top blocker. (Phase 14's framing of it as "the top launch blocker" is hereby
   superseded.)
4. ✅ **Done — pushed 2026-10-14.** Committed as `0702c45` on branch
   `go-live/phase-15-gap-closure` and pushed to `origin`. `main` was left
   untouched, so nothing auto-deployed. Open the PR from
   `https://github.com/Twistted1/content-hub-CMS/pull/new/go-live/phase-15-gap-closure`.
5. ⚠️ **New, disclosed:** a second throwaway account
   (`authscope-<id>@example.com`) was created to *scope* the login-500 finding in
   Phase 16 — it was necessary to prove the failure was account-specific and not
   a production auth outage. It holds a plain `free` subscription and nothing
   else. Ban or remove it alongside the other one if you want the auth list
   clean.

**Environment note for the next agent:** `npm ci` failed with `EPERM` unlinking
`node_modules/@rollup/rollup-win32-x64-msvc/rollup.win32-x64-msvc.node` because
a stale `vite` dev-server process from this repo (PID identified via
`Get-CimInstance Win32_Process` filtered on the repo path) still held it. Killing
that process and its `esbuild` child freed it; `npm ci` then succeeded. Check for
stray repo-owned node processes before concluding an install is broken.

---

## Phase 21 — Peer review of the spend-limit work, and closing its schema gap (2026-10-19)

A second agent worked this branch on 2026-10-16 and pushed three commits:
`969a0fb` (AI spend limits on all three paid-API call sites), `b490ecc` (a
`package.json` so the receiver can deploy standalone), and `2785fdb` (**a fix to
my receiver**). Rather than assume they were fine, I reviewed them and rebased my
own work on top — nothing was overwritten.

- [x] **Their spend-limit implementation is sound, and it closes the biggest
      finding in Phase 18.** `supabase/functions/_shared/aiBudget.ts` is now the
      single enforcement point, called before every paid call in
      `content-pipeline`, `novee-chat` and `generate-strategy`, with
      `recordAiUsage` after each. It applies **both** an instance-wide ceiling and
      a **per-user monthly cap**, which fixes the "one heavy user 402s everyone"
      flaw *and* the two call sites that previously had no check at all. The old
      duplicate instance-global check in `content-pipeline` was removed rather
      than left alongside it. Their 8 tests are picked up by vitest and pass.
  - **Correcting my own Phase 18 wording:** it said "billing has zero server-side
    enforcement — any authenticated free user can spend the owner's AI budget."
    That is no longer true of *spend*. What remains true is that **no edge
    function reads `subscriptions`**, so the *plan* is still decorative: a free
    user can call these functions and will hit the per-user spend cap rather than
    being refused by entitlement. `AGENTS.md` now says exactly that.
- [x] **Verified their dependency exists in production rather than assuming.**
      The commit adds no migration, and the code reads a table (`ai_usage_log`)
      and a column (`per_user_monthly_budget`) that appear in no migration either
      — so the whole enforcement could have been silently no-op'ing. Probed live:
  - `GET /rest/v1/ai_usage_log?select=id` → **401 `42501 permission denied for
    function has_role`** — an RLS-policy error, so the table exists. A missing
    table returns `404 PGRST205`, confirmed by a control probe.
  - `GET /rest/v1/project_settings?select=per_user_monthly_budget` → **200 `[]`**,
    identical to the known-good `monthly_openai_budget` control. A missing column
    returns `42703`, confirmed earlier against `articles.slug`.
  - **Conclusion: both exist, so the enforcement is real, not a no-op.** Both were
    created in the dashboard.
- [x] **Fixed the latent bug that verification exposed.** Because those objects
      exist *only* in production and in no migration, any fresh environment (a
      self-host, the disposable E2E project, an OSS clone) would have the code and
      not the table — and the failure mode is the dangerous kind: `checkAiBudget`
      would read no rows and therefore **always allow**, `recordAiUsage`'s insert
      would fail, and **the only spend protection in the product would silently
      cease to exist while every test still passed.** New migration
      `20261019000001_add_ai_usage_log.sql` creates the table (RLS on, own-row
      read for users, admin read via `has_role((select auth.uid()), …)`, and **no
      insert policy** for `anon`/`authenticated` since only the service role
      writes) and adds `per_user_monthly_budget`, guarded by an
      `information_schema` check — because `project_settings` still has no
      `CREATE TABLE` here, and an unguarded `ALTER` would abort the whole
      migration run on a fresh database.
- [x] **Made the silent-failure paths loud.** `aiBudget.ts` now checks the error
      on both reads and on the insert, logs a message naming the failure and the
      migration to apply, and sets `degraded: true` on the result when spend could
      not be read. It still **fails open** on a read error — deliberately, for the
      same reason this project chose fail-open for the HaveIBeenPwned check: a
      dependency blip must not become a product outage, and this is a cost control
      rather than an authorisation boundary. What changed is that an unenforced
      limit is now *visible* instead of silent. **4 new tests** cover it (that
      file: 12).
- [x] **Their fix to my receiver was correct, and I had shipped a real flaw.**
      `server.mjs` bound `127.0.0.1` unconditionally — right for a local default,
      but it makes the process unreachable behind a cloud platform's edge proxy.
      They hit exactly that on Railway ("Application failed to respond" while the
      process logged healthy) and added a `HOST` env var that still defaults to
      loopback, so a cloud deploy opts in to `0.0.0.0` explicitly. That is the
      right shape, and my receiver would not have worked deployed as written.
      Recorded because it is the class of defect my own testing could not catch:
      everything I ran was on localhost.

**Verified:** `tsc --noEmit` clean, `eslint` 0 errors (**292** warnings),
**151 passed / 1 skipped** (was 139 — their 8 plus my 4), `vite build` clean.

**Open, unchanged by this phase:** no tier/plan gating from `subscriptions`; the
two AI budget settings are still instance-wide with no tenant dimension; and
`project_settings`' missing `CREATE TABLE` remains the top self-hosting blocker —
the new migration routes around it but does not fix it.

---

## Phase 20 — Webhook authenticity + a working reference receiver (2026-10-19)

The owner asked me to make the call on what to build next. **Decision: harden the
webhook path and ship a receiver.** Reasoning, recorded because the choice was
mine: (a) the live go-live blocker is that nothing delivers without a webhook
row, and the *hard* part of fixing that is building a receiver, not clicking a
checkbox; (b) it is on the critical path for both the Meta work and the website
bridge; (c) it needs **no product decision**, unlike the licence or entitlement
enforcement. Server-side entitlement enforcement is the bigger *security* item and
is deliberately left as its own clearly-scoped change, because "what should the
free tier allow" is genuinely a pricing decision.

- [x] **Outbound deliveries are now signed.** `signDelivery` / `deliveryHeaders`
  in `supabase/functions/_shared/publishDelivery.ts` add
  `X-Novus-Signature: sha256=<hex>` (HMAC-SHA256 over the **exact raw body**),
  plus `X-Novus-Delivery-Id` and `X-Novus-Timestamp`; both delivery paths use it.
  This closes a real hole: a receiver is a public endpoint, so without a
  signature it must trust whatever reaches its URL — anyone who learned the URL
  could publish through it, and a receiver forwarding to a social platform would
  post it.
  - Keyed by `WEBHOOK_SIGNING_SECRET`. **Unset means deliveries still go out but
    UNSIGNED**, with the delivery result recording `signed: false`, so the gap is
    visible rather than silent. Non-breaking, and honest about its default.
- [x] **A working reference receiver, with a self-test.**
  `tools/webhook-receiver/` implements what a real receiver needs and proves it:
  signature verification over raw bytes (constant time), a replay window, and
  **de-duplication on `delivery_id`** — which matters because the CMS retries with
  backoff, so a receiver that ignores it publishes the same post up to five times.
  `node tools/webhook-receiver/selftest.mjs` drives the running server over HTTP:
  **10/10**, including that a **tampered body is rejected** (the whole point of
  signing), that a wrong-secret signature is rejected, that a stale timestamp is
  refused, and that a repeated `delivery_id` is acknowledged rather than
  re-published.
- [x] **The receiver maps a delivery onto the site's `articles` row — in dry-run.**
  `toArticleRow` handles the four fields that are not obvious and each of which
  fails quietly: `author_id` (the site matches it by **substring**, so an unmapped
  id displays the *wrong person*), the duplicated `publish_date`/`date` text pair
  in `"OCTOBER 11, 2026"` form, `read_time` (derived), and `category` (the CMS's
  vocabulary does not match the site's filter list). **Writing is opt-in
  (`ARTICLES_COMMIT=1`) and needs the service-role key**, because
  `public.articles` has **no status column**: an insert is live on novusexchange.com
  immediately, with no draft state and no undo. Dry-run by default is the
  responsible choice for a table like that, and it makes the bridge an explicit
  publishing action rather than a side effect of approving content.
- [x] **Custom headers are now settable from the UI.** `/pipeline` → Webhooks
  gained a one-`Key: Value`-per-line headers box. `webhook_configs.headers` always
  supported this, but nothing could write it, so a receiver needing an auth token
  required a direct database write. (Still absent: a *per-webhook* signing
  secret — signing is deployment-wide for now.)
- [x] **Documented two previously undocumented secrets in `.env.example`:**
  `GEMINI_API_KEY` (required by `generate-strategy` and reachable from the
  Automation page, but documented nowhere) and `WEBHOOK_SIGNING_SECRET`.

**Verified:** `tsc --noEmit` clean, `eslint` 0 errors (**291** warnings, unchanged
by this phase), **139 passed / 1 skipped** (was 130; +9 signing tests, one of
which cross-checks my Web Crypto HMAC against `node:crypto` — an independent
known-answer check rather than a restatement of my own code), `vite build` clean,
`publish-e2e` **26/26** (the harness now recomputes the expected digest over the
body it actually received and asserts the header matches, which is exactly what a
receiver must do), receiver self-test **10/10**.

- [x] **Redeployed 2026-10-19 and confirmed to boot.** `publish-due-posts` and
  `content-pipeline` were redeployed by the owner. The one risk I could not
  verify beforehand was whether the deploy would resolve the new relative
  `../_shared/publishDelivery.ts` import — a bundler failure would mean the
  function never starts. **Verified externally:** an unauthenticated POST to
  `/functions/v1/publish-due-posts` returns `401 {"error":"Unauthorized"}`, i.e.
  the function reaches its **own** `authorize()` rather than failing to boot, so
  the module graph including `_shared` loaded. `content-pipeline` returns 401 at
  the gateway as expected (`verify_jwt = true`). `verify_jwt = false` is still
  live for `publish-due-posts`, matching `config.toml`.
  - **Limit of this evidence, stated plainly:** the pre-Phase-19 version returned
    an identical 401, so this proves the function **boots**, not which version is
    deployed. Nothing observable before authentication distinguishes them. The
    only way to confirm the *new* code is live is a real delivery showing the
    signature header — which needs an active `webhook_configs` row and a due
    post. **That remains unverified.**
  - Also re-checked after the deploy: the site's live feed is unaffected —
    `GET /rest/v1/articles` still `200`, `Content-Range: 0-3/*`.

**Still open on this path, deliberately:** only `post.publish` is ever fired (no
update/unpublish events), there is no per-webhook secret, and the retry contract
is documented only as the `delivery_id` de-duplication key.

---

## Phase 19 — Unified webhook delivery contract (2026-10-14)

Done so the Meta/Facebook/Instagram receiver can be built **once**, against a
contract that will not move. The owner asked whether to start on Meta; the answer
was "start the App Review paperwork, but not the receiver yet, because the
contract is about to change". This is that change.

- [x] **One envelope, defined once.** New
      `supabase/functions/_shared/publishDelivery.ts` is imported by **both**
      delivery paths. They previously sent *different* payloads:
      `publish-due-posts` sent `event: "post.publish"` with a **top-level**
      `platform` and only `{id, title, content, coverImageUrl}`, while
      `content-pipeline` sent `event: "post.published"` with a **nested**
      `platforms` array and extra fields. A receiver written against one silently
      mishandled the other — the kind of bug that looks like "Meta is broken".
- [x] **Added a stable `delivery_id`** (`postId:platform`) as an idempotency key.
      Deliberately **not** random: a retry must carry the same key or a receiver
      cannot tell a retry from a second post and will double-publish. This closes
      the idempotency half of the "formalize the webhook path" item.
- [x] **Added `type`** to the payload. Instagram cannot publish text-only and
      needs to know whether a delivery is a feed post, a Reel or a story; a
      receiver previously had to guess.
- [x] **Per-platform caption truncation, enforced on the delivery path.** Nothing
      truncated before: the same text went to every platform, so a long generated
      article **hard-failed LinkedIn (3000) and Instagram (2200)** — burning all
      five retries and parking the post as `failed` with a confusing provider
      error — while X was silently cut to 280. A shortened caption now ends in
      `…` so it reads as shortened rather than looking complete. The limits mirror
      `src/utils/platformLimits.ts`, which was previously used **only** for UI
      warnings and never enforced at publish time.
- [x] **`content-pipeline` now sends one delivery per platform** rather than one
      payload per webhook listing several platforms, because the unified envelope
      carries a single `platform`, truncation is per-platform, and `delivery_id`
      is only meaningful for one `(post, platform)` pair.
- [x] **Strengthened the weaker of the two SSRF guards.**
      `publish-due-posts`' `isPrivateOrLocalHost` missed `0.0.0.0/8`, CGNAT
      (`100.64.0.0/10`) and every IPv6 private range. Now matches
      `content-pipeline`'s. All of those are unroutable in public DNS, so closing
      the gap cannot block a legitimate receiver.
- [x] **Fixed `customer-portal`'s dead Lovable fallback.** It carried
      `id-preview--31c64459-….lovable.app` as **both** an allowlisted origin and
      the ultimate fallback, so with `SITE_URL` unset a paying customer's return
      from the billing portal landed on a dead page. Phase 6 fixed exactly this
      bug in `create-checkout` and missed this instance. Now uses the same
      `PRODUCTION_URL` + `SITE_URL` pattern as that fix.
- [x] **Verified on the wire, not just in source.** The receiver log shows the new
      envelope arriving with `delivery_id`, `type`, `tags`, `excerpt` and
      `scheduledAt` present. The `publish-e2e` harness was extended to assert
      these, and now reports **23/23 checks**; `publishPayloadParity.test.ts`
      imports the shared module directly (it has no Deno globals) and adds **18
      tests** pinning the envelope, the limits and the truncation behaviour,
      including that a space-less 10k token still fills the budget rather than
      collapsing to an ellipsis.

**Verified:** `tsc --noEmit` clean, `eslint` 0 errors (**291** warnings, +3 from
two `(p: any)` map params added in `publish-due-posts` to match that file's
existing untyped style), **130 passed / 1 skipped** (was 112), `vite build` clean,
`publish-e2e` 23/23.

**⚠️ Requires redeployment to take effect:** `publish-due-posts`,
`content-pipeline` and `customer-portal`. The `_shared/` import means all three
must be deployed from this revision — deploying only one leaves it importing a
module the others may not match. `supabase functions deploy` each, or all at once.

**Still open on this path (unchanged by this phase, and needed for a real Meta
receiver):** no shared secret or signature on the payload, so a receiver cannot
verify provenance; only `post.publish` is ever fired, so an edit or an unpublish
cannot be propagated; and `/pipeline`'s form still cannot set the auth headers the
schema supports.

---

## Phase 18 — Readiness audits: open-source, commercialization, headless (2026-10-14)

Three read-only audits run in response to the owner's questions about what's left
code-wise, whether the CMS feeds `novusexchange.com`, open-sourcing, and
commercialization. Two produced durable documents; nothing was changed in
`src/` or `supabase/` by this phase.

- **`docs/READINESS_GAP_ANALYSIS.md`** — open-source and commercialization
  readiness. **Verdict: open-source is close but has hard blockers (~1–2 weeks);
  hosted multi-customer SaaS is a data-model rewrite, not packaging (~6–10
  weeks).** The economical path is self-hosted / per-customer deployments
  (~2–3 weeks on top), which the existing single-tenant design already fits.
- **`docs/HEADLESS_CONSUMPTION.md`** — can the website read CMS content.

**The findings that matter most, and the ones I would act on first:**

- 🔴 **Production exposes a public `articles` API that this CMS does not manage.**
  `GET /rest/v1/articles` returns **4 real Novus Exchange articles** (Economics /
  Geopolitics, dated Sep–Oct 2026) plus an `authors` row, anonymously, with no
  key. But **no migration creates those tables, and no code in `src/` or
  `supabase/functions/` reads or writes them.** The content the live site shows
  and the content the CMS edits are **two disconnected systems**. Verified
  directly by the owner's agent, not inferred. **This needs a decision:** is
  `articles` the real public store to bring under migrations and have the CMS
  write, or a leftover to drop?
- 🔴 **Billing has zero server-side enforcement.** No edge function ever *reads*
  `subscriptions` — only writes (`stripe-webhook:95`, `demo-login:158`). The only
  tier gate is cosmetic and client-side (`Sidebar.tsx:140`). **Any authenticated
  free user can call `content-pipeline`, `novee-chat` or `generate-strategy`
  directly and spend the owner's OpenAI/Gemini budget.** This is a live cost leak
  and the highest-value security fix outstanding.
- 🔴 **The migration set cannot rebuild the database.** `project_settings` and
  `subscribers` are referenced by policies and `ALTER TABLE`s but **no migration
  `CREATE TABLE`s them** (verified: zero matches in 41 migrations), and one
  migration queries `project_settings` as key/value while another uses wide
  columns. `supabase db push` onto an empty project fails. This is why Phase 9
  had to rebuild the E2E project by introspecting live prod; the workaround was
  never applied to the repo.
- 🔴 **A 14-day free trial is advertised but not implemented.** `en.json:1992`
  and `:1888`, plus `Landing.tsx:231`, promise it; there is **no
  `trial_period_days` anywhere**. False-advertising and chargeback exposure.
- 🟠 **`customer-portal` still carries a dead Lovable preview host as both an
  allowed origin and the fallback** (`:56`, `:62`) — with `SITE_URL` unset, a
  paying customer's portal return lands on a dead page. Phase 6 fixed exactly
  this bug in `create-checkout` and **missed this instance**.
- 🟠 **Stripe price IDs are hardcoded in three files**
  (`create-checkout:13-18`, `check-subscription:12-15`,
  `stripe-webhook:115-118`), and `stripe-webhook`'s `resolveTier` falls through
  to `"free"` for unrecognised prices — so a second deployment that updates two
  of the three **silently downgrades paying customers to free**.
- 🟠 **Two other AI call sites have no budget check at all.** The only
  `monthly_openai_budget` use is `content-pipeline:120`; `novee-chat` and
  `generate-strategy` call OpenAI/Gemini unguarded. And the check itself is
  **instance-global** — `content-pipeline:110-113` sums `cost_estimate` across
  *all* users with no `user_id` filter, so one heavy user 402s everyone.
- 🟠 **`GEMINI_API_KEY` is required and undocumented.** `generate-strategy:38-41`
  needs it and `Automation.tsx:183` reaches it, but it is absent from
  `.env.example` and the README.
- 🟠 **`/pipeline`'s webhook form cannot set auth headers**, though the schema
  supports them (`20260323154601:37`) — name/URL/platform badges only. Any
  receiver needing a shared secret needs a direct DB write today.
  *(The envelope itself was fixed in Phase 19; the missing pieces on that path are
  now specifically: no shared secret/signature, no update/unpublish events, and no
  header UI.)*
- 🟡 **Articles created in `Articles.tsx` always pass `platforms: []`**
  (`:114-121`) → zero `post_platforms` rows → the delivery loop never runs → the
  post retries to the cap and parks as `failed` **with an empty error string**
  (`publish-due-posts:208-217`).
- 🟡 **No `LICENSE`, and none ever in git history.** `package.json` is
  `"private": true` with no `license` field, so the code is legally
  all-rights-reserved — **nobody may self-host or contribute.** Also missing:
  `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, `CHANGELOG.md`,
  `.nvmrc`, `engines`, `.editorconfig`, issue/PR templates.
- 🟡 **Self-hosting is blocked by hardcoded infrastructure:**
  `vercel.json:18` pins the CSP `connect-src` to the owner's Supabase host
  (breaking every other deployment's API calls), and the cron migrations
  hardcode the owner's project URL (`20260601130235:51,66,81`) so a
  self-hoster's cron would POST to the wrong project and silently never run.
- 🟡 **`supabase/.temp/cli-latest` is tracked**, and `api.json` — a "Headless API
  Distribution Channel" schedule — is dead config referenced by nothing.

- ✅ **Secret audit — clean, and it settles the open question above.** All 1244
  blobs across 625 commits on every ref were scanned: **no server-side secret
  exists in the working tree or anywhere in history** — no `service_role` key, no
  Stripe/OpenAI/OAuth secret, no DB password, no cloud/GitHub token. Only the
  public-by-design anon key and a Sentry ingest DSN are in history, and a
  history rewrite is therefore **not required**. Workflow secrets all use
  `${{ secrets.* }}` with no literals. **The one actionable item:**
  `.env.e2e.example:20` commits a real E2E test password, and that project
  (`amyzklcdwrspazveutqz`) is still live and answering on the network — change
  the password and placeholder the literal. Worth adding a gitleaks-style scan to
  CI, now that there is a clean baseline.
- ✅ **The anonymous `articles` exposure is read-only — verified, not assumed.**
  An `INSERT` reusing an existing primary key (so it provably could not create a
  row) returns
  `401 {"code":"42501","message":"new row violates row-level security policy for table \"articles\""}`,
  and the row count was unchanged afterwards. That is an RLS policy violation
  rather than a missing GRANT, so RLS **is** enabled on `articles` with a
  permissive SELECT policy for `anon` and **no INSERT policy**. A
  publicly-readable, non-writable table is a defensible design; the exposure the
  audit flagged is not the serious one it could have been. `UPDATE`/`DELETE`
  cannot be probed this way (RLS filters rows rather than denying the statement),
  so confirm the policy list in the dashboard if certainty is wanted.

**How the headless question was left:** the publishing direction works (webhook),
the consumption direction does not, and the `articles` decision above gates the
choice between two clean fixes. `docs/HEADLESS_CONSUMPTION.md` lays out five
options with effort; the recommendation is to adopt `articles` if it is the
intended store (~1–2 days) or publish a read-only `public_published_posts` view
if it is not (~2–4 h), and to harden the webhook path with a shared secret and
idempotency key either way.

**Not determined by any audit** (needs the dashboard): whether `articles` has RLS
enabled or is entirely unprotected, and whether `anon` can **write** to it — no
write was attempted. If that table is publicly writable it is a serious exposure
and should be the first thing checked.

---

## Phase 17 — LinkedIn publish confirmed live (2026-10-14)

The owner published a real post to their own LinkedIn feed through the app
("Testing my new publishing setup", 1 comment) and confirmed it visually.

- [x] **LinkedIn is now proven deliverable in production, via the direct/OAuth
      path.** This exercises `platform_oauth_tokens` (a real, unexpired access
      token) plus the LinkedIn publish call in
      `publish-post/index.ts:140` or `publish-due-posts/index.ts:51-67` — the
      first time that chain has been confirmed against a real account rather
      than a direct API call. Evidence is the owner's screenshot of the live
      post; **I did not independently verify it** (no account owns that row from
      this session, the LinkedIn API needs credentials I don't hold, and there
      is no log access here). Recorded as owner-reported, like the deployment
      versions above.
- [?] **Which of the two paths it took is unconfirmed, and it matters:**
  - `Platforms.tsx:227` `publishPostDirect` → the **`publish-post`** function,
    immediate ("publish now").
  - `Platforms.tsx:252` / `Articles.tsx:152` / `usePosts.publishPost` → queues
    the post as `scheduled` with `scheduled_at = now`, so the **`publish-due-posts`
    cron** delivers it on its next minute tick.
  If it went through the cron, that **also** validates the redeploy of
  `publish-due-posts` (v11) together with the newly-applied `claim_due_posts`
  migration — i.e. the same function this phase's webhook proof exercised, on
  the same atomically-claiming code path. If it went through `publish-post`,
  that function's deployed version is still unverified. Worth pinning down.
- 🔴 **This does not close the critical gap, and must not be read as doing so.**
  LinkedIn is a **direct** platform (`DIRECT_PLATFORMS`), so it never needed a
  `webhook_configs` row and its success is independent of the webhook path.
  **There is still no active `webhook_configs` row, so `instagram`, `facebook`,
  `tiktok`, `youtube`, `website` (and the UI-unreachable `rumble`/`podcast`)
  remain undeliverable in production.** The go-live status is unchanged: the
  mechanism is proven, the code is live, and the remaining step is operational —
  point at least one real webhook endpoint at a platform actually in use.
- ✅ **Effect on objective 3 (a real, non-test transaction):** objective 3 was
  already satisfied by the Stripe test-mode purchase (7/7, `tier: pro` written
  by the webhook). LinkedIn adds a second, independent proof of a different
  kind — publishing rather than billing — so the "can this thing actually
  transact with the outside world" question now has two answers instead of one.

---

## Phase 16 — Deployment gap and production anomalies (2026-10-14)

The owner reported that **`publish-due-posts` and `demo-login` had not been
redeployed since June 2026** — merged git code had never been shipped to
Supabase — and asked whether anything else I touched has the same gap. It does,
and this is the most consequential finding of the session.

- [x] **RESOLVED — `content-pipeline` and `schedule-from-templates` were stale in
      production; both are now redeployed and the objective-4 fix is live.** The
      owner redeployed `content-pipeline` (**v32**) and
      `schedule-from-templates` (**v13**) with this branch's code. The two files
      that carried the fix were:
  - `supabase/functions/content-pipeline/index.ts` — the `SCHEDULE_MODES` list,
    `normalizeScheduleMode`, and the total `mode === "immediate"` publishing
    gate.
  - `supabase/functions/schedule-from-templates/index.ts` — the
    `CRON_SCHEDULE_MODE` constant.
  **Deployment is confirmed by the operator, not verified by me** — see the
  note below on why that is the honest ceiling here.
  - What *is* externally verifiable was checked: an unauthenticated POST to
    `/functions/v1/publish-due-posts` and `/functions/v1/schedule-from-templates`
    returns each **function's own** `{"error":"Unauthorized"}`, not a gateway
    rejection — confirming `verify_jwt = false` is live for both, matching
    `supabase/config.toml:24-29`. `demo-login` returns `404` (the fail-closed
    version, not the old credential-minting one) and `stripe-webhook` returns
    `400` (signature check), so both are live and current.
  - **Why the version itself cannot be proven from an agent session:** deployed
    function source is not exposed by any API available here, and the one
    behavioural discriminator (an unrecognised `scheduleMode` is stored raw by
    the old code and normalised to `"scheduled"` by the new one) can only be
    observed by sending a request that reaches the `pipeline_runs` insert —
    which requires a valid user session *and* consumes a real OpenAI call. Not
    worth spending a fourth throwaway account and generation credit on, so this
    one rests on the operator's word, and the checklist says so rather than
    implying it was machine-verified.
- [x] **`demo-login` had also been running June-2026 source.** Redeployed by the
    owner (**v32**), alongside the three migrations the stale functions
    depended on: `pipeline_post_status`, `app_role_ui_values`,
    `publish_retry_tracking`. Independently corroborated here: `demo-login` now
    returns `404` unauthenticated, which is the Phase 12 fail-closed behaviour
    and not something the old version did.
- [x] **CORRECTED — the DELETE hang was not a database problem, and my lock
      hypothesis was wrong.** The owner ran the `pg_blocking_pids` diagnostic
      and it returned **zero rows** — nothing was blocked, which directly
      refutes the stuck-lock explanation I offered. The hang is isolated to
      their SQL tool; **the app's own delete paths are unaffected** (they go
      through PostgREST, a different path). The 22 `useX.delete` call sites
      listed in the first draft of this section are therefore **not** a
      production concern, and no app code or SQL needs changing. Recording the
      wrong hypothesis alongside its refutation deliberately: the lesson is that
      "even a zero-row DELETE hangs" pointed at a lock, and that inference was
      reasonable but still wrong — the only thing that settled it was running
      the query.
- [x] **RESOLVED — the ban-500 diagnosis was right.** Confirmed by the fix: the
      owner switched all three test accounts from `banned_until = 'infinity'` to
      a real date (`2099-12-31`) and the 500 `"Database error querying schema"`
      goes away. **`'infinity'` is not safe as a `banned_until` value on this
      project** — use a far-future finite timestamp instead. All three test
      accounts (`golive-verify-…`, `authscope-…` and the owner's own) are banned,
      their subscriptions downgraded to `free`, and nothing live references any
      of them. The production auth path was never affected (a fresh account
      created during the diagnosis logged in normally).
- ⚪ **Consequence for objective 1's production status, stated plainly:** with the
  proof row retired, there is currently **no active `webhook_configs` row**, so
  the production delivery proven earlier in this phase can no longer be repeated
  until a real row exists. The mechanism remains proven (20/20, and a real
  delivery was received and logged); the *operational* gap is open again by
  design, pending a real endpoint. That is the honest current state.

---

## Phase 12 — Independent audit + critical fixes (2026-09-18)

A fresh independent audit of the whole repo (structure/deps, Supabase
migrations/RLS/security, frontend hooks/state/i18n, cron/deployment)
found several items Phase 11 didn't catch. All were fixed in the same
session; each was verified against source, not assumed.

- [x] **`demo-login` was an unauthenticated session-minting backdoor
      (🔴 critical).** The function did `signInWithPassword` with a
      hardcoded email/password against the service-role client and
      returned that session to any anonymous caller — no JWT, no origin
      check, `verify_jwt = false`. Anyone who found the URL got a valid
      logged-in session. Rewritten to fail closed behind three
      independent server-side controls: `DEMO_LOGIN_ENABLED` must be
      exactly `true` (otherwise it returns 404 and looks like a missing
      route), the request `Origin` must be in `DEMO_ALLOWED_ORIGINS`,
      and a per-IP rate limit caps minting. The demo account's password
      is now randomly regenerated per call, so no credential for it is
      stored in the tree or survives a single use, and the account is
      forced down to the unprivileged `user` role / `free` tier on every
      call so it can't be used to reach an elevated role.
- [x] **A live production anon JWT was committed to a migration
      (🔴 critical).** `20260323155000_...sql` embedded a real
      `Authorization: Bearer <jwt>` in a `cron.schedule` body alongside
      a hardcoded project URL. That credential is in git history and
      must be treated as compromised — **the user still needs to rotate
      the anon key in the Supabase dashboard.** The migration was
      replaced with the Vault-backed `x-cron-secret` pattern every other
      job already uses, and the retired job unscheduled. Rewriting the
      original body in place is deliberate: rewriting what a past
      migration did would desynchronise environments that already ran it.
- [x] **`post_status` had two values the pipeline writes but no migration
      adds (🔴 critical).** `content-pipeline` inserts
      `awaiting_review` and the `sync_post_workflow_stage` trigger reads
      both `awaiting_review` and `generating`; neither was in the enum
      created by the initial migration. They exist in prod only because
      they were added out-of-band, exactly like `rejected` in Phase 7 —
      so replaying the migration history onto a fresh database made every
      pipeline insert fail with `invalid input value for enum
      post_status`. New migration `20260918000000_add_pipeline_post_status`
      closes the gap.
- [x] **`app_role` enum couldn't hold 3 of the 4 roles the UI offers
      (🟡 high).** The enum is `admin | moderator | user`, but
      `usersData.ts` offers `admin | editor | viewer | member` and
      `useUsers` writes the selected label straight into
      `user_roles.role`. Selecting Editor, Viewer or Member failed with
      `invalid input value for enum app_role`. Extended the enum to the
      UI vocabulary (`20260918000100_add_app_role_ui_values`) rather than
      renaming the UI, since the labels are what users see and what the
      i18n catalog is written against; `moderator` is retained because
      `useUserRole` still resolves it. `types.ts` updated to match.
- [x] **Publish failures were permanent and invisible (🔴 critical).**
      `publish-due-posts` claimed work by filtering `publish_attempted_at
      IS NULL` and then setting that column — and **nothing in the
      codebase ever cleared it**. One transient failure (webhook 500, 8s
      timeout, mid-refresh OAuth expiry) removed a post from the queue
      forever, with no retry. Worse, the claim was a select-then-update
      pair, so two overlapping cron ticks could both claim the same post
      and deliver it twice. Replaced with `claim_due_posts`, an atomic
      `FOR UPDATE SKIP LOCKED` RPC (service-role only) that adds a
      `publish_attempts` counter and exponential backoff (2m doubling to
      a 60m cap, 5 attempts). Success clears the bookkeeping; exhausted
      posts park as `failed` with the attempt count in `publish_error`;
      partially-delivered posts are kept `published` with the failures
      recorded rather than re-publishing what already landed.
- [x] **The UI reported undelivered posts as published (🔴 critical).**
      `usePosts.publishPost` set `status: "published"` and
      `published_at: now()` directly from the browser — a post could show
      as published having never been delivered anywhere. Platforms.tsx
      had the same problem as a "fallback" for webhook platforms, with a
      toast reading "Your post has been marked as published". `publishPost`
      now genuinely queues (status `scheduled`, `scheduled_at` = now,
      retry bookkeeping reset) and both pages say so; new
      `platforms.postQueuedTitle/Desc` keys added to both locales.
- [x] **Timezone contract for `scheduled_at` was undefined, and broken
      (🟡 high).** The Calendar built `` `${date}T${time}:00` `` with no
      offset, so Postgres interpreted the value in *the server's*
      timezone — a user in UTC-5 picking 09:00 had the post stored as
      09:00 server time, and the calendar and the scheduler disagreed
      about when it was due. `utils/scheduling.ts` had already been fixed
      to produce real UTC, so there were two contracts in the same app.
      Added `src/utils/scheduleTime.ts` (`localWallClockToUtcIso`,
      `utcIsoToLocalParts`, `toLocalDateKey`) as the single definition,
      and routed Calendar, Review, Platforms, Automation and
      ContentPipeline through it. Also fixed `Automation.tsx`'s
      `wallClock`, which pinned *local* hours to a `Z` suffix, and its
      `d.toISOString().split("T")[0]` date key, which rolls to the next
      day for evening hours in negative-offset zones.
- [x] **6 edge functions were missing from `supabase/config.toml`
      (🟡 high).** `content-pipeline`, `generate-strategy`, `oauth-init`,
      `publish-post`, `publish-due-posts` and `schedule-from-templates`
      had no entry, so they fell back to Supabase's default
      `verify_jwt = true` — and all three cron-invoked functions
      (`publish-due-posts`, `schedule-from-templates`) authenticate with
      the `x-cron-secret` header, not a JWT, so they'd have been rejected
      in a CLI deploy. Config rewritten with all 15 functions and an
      explicit, commented `verify_jwt` for each.
- [x] **Edge secrets were undocumented.** README and `.env.example`
      listed only 4 of the 14 secrets the functions actually read
      (missing all four OAuth keys, the three demo-login vars, and the
      full list of runtime-provided ones), and README's roles section
      still described the pre-fix 3-role enum. Both updated, including
      the Vault `cron_secret` procedure.

Verified after every change: `tsc --noEmit` clean, `eslint` 0 errors
(245 pre-existing `any` warnings), `vitest` 69/69 passing, production
build clean.

**Still needs the user, not more code:** rotate the anon key that leaked
in `20260323155000`'s migration (git history is public once pushed);
decide whether `demo-login` should exist at all in production (it's now
safe either way — leave `DEMO_LOGIN_ENABLED` unset to disable it).

---

## Phase 13 — Truth-in-UI and role-integrity pass (2026-09-18)

Continued the Phase 12 audit into the area it had not yet reached: what
the UI *claims* versus what the code actually does, plus the RBAC paths.
Six real defects, all fixed and verified (TSC clean, 69/69 tests, build
clean, i18n parity 1719/1719).

- [x] **Platforms page: the Connect button was theatre (🔴 high).** On the
      disconnected-platform cards, `onClick` only raised a toast saying
      "You'll be redirected to authenticate with your account" — it never
      called `connect()`, which `usePlatformOAuth` already exports and
      which opens the real OAuth popup via `oauth-init`. Every non-OAuth
      platform (Instagram, Facebook, TikTok, YouTube, Rumble, Podcast,
      Website) showed the same dead button. Those platforms deliver over
      `webhook_configs`, not OAuth, so there was never an OAuth flow to
      wire up — the button was simply lying. Fixed: the card now branches
      on `isDirectPlatform(id)`. Real OAuth platforms call `connect()` and
      disable while `connecting`; webhook platforms say so plainly and
      point at Content Pipeline > Webhooks (`webhookDeliveryDesc`,
      `webhookSetupCta`).
- [x] **Pinterest/Snapchat/Threads cards promised a connect that cannot
      exist (🟡 medium).** `availablePlatforms` is explicitly documented
      as "not yet integrated", yet each card carried the same
      "You'll be redirected to authenticate" toast. Replaced with a
      disabled "Not yet available" button (`notYetIntegrated`) that names
      the actual workaround.
- [x] **"SYNC ALL" fabricated a successful sync (🟡 medium).**
      `handleSync` was `setTimeout(2000)` then a toast reading "All
      platforms have been synced." No request was made; there is no
      analytics-ingestion backend to sync from (confirmed: no sync/analytics
      edge function exists). Now it genuinely refetches platform and OAuth
      state (`usePlatforms`/`usePlatformOAuth` both gained `refetch`) and
      says what it actually did — re-read connection and post state, does
      not ingest analytics.
- [x] **Publish retries were invisible in the UI (🟡 medium).** Phase 12
      made failures retry with backoff and recorded `publish_attempts` /
      `publish_error`, but nothing surfaced them: a post that had failed
      delivery three times looked identical to one never attempted. Added
      `PublishStatusBadge` (wired into `PostCard`, next to the status
      badge) showing "Retry n/5" or "Delivery failed (n attempts)" with
      the recorded error in a tooltip. Cap mirrors `p_max_attempts` in
      `claim_due_posts` via an exported `MAX_PUBLISH_ATTEMPTS`.
- [x] **Role changes could silently no-op, then flip back (🟡 medium).**
      `useUsers.updateUser` wrote roles with `.update()`. The Users list
      falls back to `"user"` for anyone without a `user_roles` row, so for
      such a user the update matched zero rows, reported success, and the
      displayed role reverted on the next refetch. Switched to a delete-
      then-upsert: `user_roles` is unique on `(user_id, role)`, so a
      multi-role user would otherwise keep both rows and the list's
      last-row-wins map would show a nondeterministic role.
- [x] **`useUserRole` was dead code carrying a stale role model
      (⚪ low).** Zero references anywhere; it knew only `admin |
      moderator | user` while the enum has held `editor | viewer | member`
      since Phase 12. Deleted rather than updated — nothing consumed it,
      and leaving it invites someone to rely on the three-role version.
- [x] **Handled errors left no trace (⚪ low).** Four user-facing failure
      paths only `console.error`'d. Added `src/lib/errorReporting.ts`
      (`reportError`, a no-op when `VITE_SENTRY_DSN` is unset) and routed
      the Novee chat failure, campaign launch, media upload, and editor
      image upload through it. `ErrorBoundary` already used Sentry.

**Verified as already correct, no change needed:** `user_roles` RLS
(`Admins can manage roles` is the only write policy — no self-escalation
path); `profiles.email` exists (`20260222000002`), so `demo-login`'s
profile lookup is valid; no `SERVICE_ROLE` reference anywhere in `src/`;
no tracked `.env` files and no JWTs in tracked source; webhook delivery is
genuinely implemented with SSRF validation, an 8s timeout, and
`redirect: "error"`.

**Still needs the user, not more code:** the two items carried over from
Phase 12 (rotate the leaked anon key; decide on `demo-login` in
production), plus the four plan- or live-account-gated items listed in
Phase 1.

---

## Phase 14 — Free leaked-password protection (2026-09-18)

Phase 1 carried an open item: Supabase's "Leaked Password Protection" is
gated behind the Pro plan, so it cannot be switched on for this project.
Replaced with a free implementation of the same check.

- [x] **Leaked-password check, free, no key, no plan (🔴 high).** New
      `src/utils/pwnedPassword.ts` queries the HaveIBeenPwned Pwned
      Passwords **range** API, which is free and unauthenticated, and
      which is the same corpus the Supabase toggle is built on. Uses
      k-anonymity: only the first 5 characters of the SHA-1 hash are
      transmitted (`crypto.subtle.digest`, no dependency added) and the
      remaining 35 are compared locally against the returned range. Sends
      `Add-Padding: true` so response size cannot be used to infer whether
      the prefix matched. 3s timeout via `AbortController`.
- [x] **Fail-open policy, deliberate and documented.** A HIBP outage must
      not become a signup outage, so an unreachable API allows the password
      through and reports the failure to Sentry instead. This matches how
      Supabase's own protection behaves. `fail_open` is not a flag here —
      there is one policy, chosen on purpose.
- [x] **Enforced at both reachable password entry points.** New
      `src/utils/passwordPolicy.ts`, wired into `Auth.tsx`'s `handleSignUp`
      and `SecuritySettings.tsx`'s `handlePasswordChange`. The check runs
      **before** the Supabase call, so a breached password is refused
      before any account exists — nothing has to be rolled back. (A client
      cannot delete its own auth user, since `auth.admin.deleteUser`
      requires a service role, so a check-after-create design would strand
      a weak account.) Both paths show a specific, translated message.
- [x] **Rejected design, recorded so it is not retried:** Supabase's
      `before_user_created` Auth Hook is **not** a substitute, and it is
      free on all plans. Its payload is the `auth.users` row shape
      (`id`, `email`, `app_metadata`, `user_metadata`, identities) — the
      password is only present as the bcrypt `encrypted_password`, so the
      hook has no plaintext to look up. Verified against the Supabase docs
      before writing any code.
- [x] **Verified against the real API, not only mocks.** 13 new tests
      (`pwnedPassword.test.ts`, `passwordPolicy.test.ts`) covering the
      count lookup, the 5-char-only prefix, padding, error propagation,
      fail-open on both rejection and 5xx, and that a breached password
      never reaches `signUp`/`updateUser`. Plus one network test gated on
      `HIBP_LIVE=1`, run for real: `isPasswordLeaked("password")` resolved
      `true` against api.pwnedpasswords.com.
- [x] **Documented in `.env.example`**, including why the Auth Hook cannot
      replace it and what true server-side enforcement would require.

**Residual limitation, stated plainly:** this is client-side, so a client
that calls `supabase.auth.signUp` directly still bypasses it. It is a real
improvement in default-safe behaviour, not a hard server-side guarantee.
Hard enforcement requires either the Pro toggle or moving signup behind an
owned backend that holds a service role key.

**Unrelated, and still open:** the leaked **anon JWT** committed in
`20260323155000` is a *separate* issue from the Pro-gated password toggle,
and is not fixed by any of the above. It needs a key rotation in
Dashboard → Settings → API, which is available on every plan including
free. That remains the top launch blocker.

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
- [x] **Root-cause light theme fix from a second Claude session's written
      diagnosis (Phase 10, 2026-08-29) — supersedes several items
      above.** After multiple rounds of user-reported design feedback
      ("purple's too strong," "greens screaming"), the user brought in a
      second Claude session specifically to diagnose this recurring
      problem and supplied its findings as a spec (`LIGHT_THEME_FIX.md`).
      Verified every claim in it against the actual current code before
      applying anything (it was accurate) and implemented all 6 steps,
      extending the scope slightly beyond what it specified. Root
      causes, all fixed at the CSS-token layer rather than per-component,
      dark theme confirmed unaffected (`tsc`/`eslint`/`vitest`/build
      clean after every step):
      1. `.glass`/`.glass-card`/`.glass-hover` tinted straight off
         `--foreground` — a correct frosted-white sheen in dark theme
         (foreground is near-white there) but a **10% black wash down
         every card plus a hard grey outline** in light theme
         (foreground is near-black there), with zero shadow anywhere to
         signal elevation any other way and `--background` identical to
         `--card` (zero page/card separation). This was the actual
         "smudged/flat" root cause. Added `--elev-tint`/`--elev-line`/
         `--elev-shadow` tokens (dark values reproduce today's
         appearance exactly); light theme gets a neutral hairline border
         + soft brand-tinted shadow instead of a tint wash, plus
         `--background` nudged off pure white.
      2. `.head-neon`'s purple glow (a `drop-shadow` behind gradient-text
         headlines) — striking on near-black, a blurry smudge on white.
         Now driven by a `--neon-a` token, zeroed in light theme;
         `--grad-primary` itself also shifted from the 500-shade hex
         pair to the 700-shade pair in light theme.
      3. **The sidebar's "stays dark in both themes, by design" decision
         from earlier in this same phase was reversed** on review — it
         was never a considered choice, it was the sidebar's own
         hardcoded white-alpha interaction states (`bg-white/[0.16]`
         active, `bg-white/[0.10]` hover, directly in Sidebar.tsx's JSX)
         never having been swept, same bug class as `.glass-card` just
         in JSX instead of CSS. Sidebar.tsx's `NavItem` now uses a
         `.sidebar-item` CSS class driven by `[aria-current="page"]`
         (which React Router's `NavLink` already stamps on the active
         link — no extra prop plumbing) instead of three conditional
         Tailwind strings, so light theme gets a genuinely light rail
         with a brand-tinted (not grey) active fill, dark theme
         unchanged. Logo mark, upgrade-card CTA, and every
         `border-sidebar-border/[0.1x]` alpha modifier (which existed
         only to tame the old always-white token) updated to match.
      4. ~90 hardcoded status/trend/chart-legend Tailwind classes
         (`text-emerald-400`, `bg-blue-500`, etc.) across ~15 files,
         tuned for a dark ground, read as "screaming" on white.
         Replaced with semantic tokens (`--success`/`--info`/`--warn`/
         `--brand-accent`, retuned per theme) registered in
         `tailwind.config.ts` — extended past the spec to also fold
         `red`/`rose` into the existing `--destructive` token and
         `green` into `--success`, so nothing regressed to full
         brightness after removing the prior turn's blunter `.light
         [class~="..."]` CSS-override patch (which is now deleted).
         Every genuine platform-brand color (YouTube red, TikTok pink,
         Twitter/X sky, LinkedIn blue, Instagram fuchsia/pink, Rumble
         green, the Calendar/Index platform-color objects,
         Platforms.tsx/PostCard.tsx's brand switch statements) and the
         heatmap's intensity-scale gradient were deliberately left
         untouched — correct in both themes by definition, not status
         colors.

      One deviation from the spec's "must be byte-identical in dark
      mode" instruction, done knowingly: `.glass-card` gained a subtle
      box-shadow it didn't have before (the spec's own Step 2 code adds
      one, unconditionally, using dark theme's non-zero
      `--elev-shadow-a`). In practice a soft black shadow under an
      already-near-black card is not visually perceptible, but it is not
      literally pixel-identical CSS. **Not independently visually
      verified against a browser** — this session has no way to render
      the app and take a screenshot; verification here is confined to
      the build/lint/test suite plus a very close manual reading of the
      generated CSS math against every value in the spec. Ask the user
      to confirm the actual on-screen result once deployed.

## Phase 11 — Final security/polish pass (2026-08-29)

User asked for a broad pre-launch pass: edge cases/error handling,
security (auth, input sanitization, file uploads), deployment readiness
(env vars, migrations), and UX polish (empty states, 404, favicons/SEO).
Investigated each against live systems rather than assuming; fixed what
was safely fixable, flagged the rest with a specific reason.

- [x] **Real, live file-upload security gap found and fixed.** The
      `post-images` storage bucket had `file_size_limit = null` and
      `allowed_mime_types = null` — no restriction at all, unlike its
      sibling `avatars`/`media` buckets. Its own RLS policy
      ("Authenticated users can upload to own post-images folder") lets
      *any* authenticated user `INSERT` into their own folder there, and
      the bucket is `public: true` — so any logged-in user could have
      uploaded an arbitrary file (an executable, anything) of arbitrary
      size and had it served publicly at a predictable URL. This is
      exactly the "malicious executable instead of an image" risk asked
      about, confirmed live via the actual RLS policy and bucket config,
      not assumed. Fixed directly on prod: `file_size_limit` set to
      20MB, `allowed_mime_types` set to the same image set
      `avatars`/`media` already use. Verified the only code path that
      writes here — `content-pipeline`'s server-side, service-role image
      upload — always writes PNGs well under that limit, so nothing
      existing breaks.
- [x] **`usePosts.ts`'s `uploadMedia` had no client-side file
      validation** — `ProfileSettings.tsx`'s avatar upload already
      checked type/size before uploading, this path didn't. The `media`
      bucket does enforce the real limit server-side (confirmed:
      50MB, image/video/audio only), so this was never actually
      exploitable, but a user hitting the block got a raw Supabase
      storage error instead of a message saying what's wrong. Added the
      same client-side check, matching the bucket's real limits.
- [x] **`index.html` had no `<link rel="icon">`** — relied entirely on
      browsers' implicit `/favicon.ico` convention (the file exists in
      `public/`, just never explicitly declared). Added the link tag
      plus a `theme-color` meta tag.
- [x] **Removed `public/Schedule Digital Presence.txt`** — a stray raw
      schedule dump that's been sitting in `public/` since very early in
      the project (predates Phase 1), unreferenced anywhere in the app,
      silently served to anyone who requested it at the site root.
- [x] **Confirmed clean**: `.env`/`.env.production`/`.env.e2e` are
      gitignored, only `.env.example`/`.env.e2e.example` (templates, no
      real values) are tracked; no `service_role` key or reference to
      one exists anywhere in client-side `src/` code. Env-var separation
      is correctly set up.
- [x] **404 page exists and works** (`NotFound.tsx`, i18n-wired, correct
      theme tokens, catch-all route registered last in `App.tsx`) — no
      changes needed.
- [x] **Leaked Password Protection — free substitute shipped (Phase 14,
      2026-09-18).** Flagged by the live security advisor; Supabase Auth
      checks new passwords against HaveIBeenPwned when this is on. User
      located the actual setting (Authentication → Sign In/Providers →
      Email → "Prevent use of leaked passwords") and confirmed live: the
      control is disabled with "Only available on Pro plan and above" —
      this project is on Supabase's Free tier. Supabase's own toggle
      remains unavailable, but the same check is now implemented for free
      against the HIBP Pwned Passwords range API — see Phase 14. Two
      caveats that keep this distinct from the Pro toggle: it is enforced
      client-side (a direct `supabase.auth.signUp` call still bypasses it),
      and it fails open during a HIBP outage. The Pro toggle remains the
      only hard server-side enforcement. Upgrading to Pro is still the way
      to close the bypass, but is no longer required to get the protection
      for normal flows.
- [ ] **`net._http_response` (pg_net's internal HTTP-response log,
      populated by this project's own `pg_cron` jobs firing every
      1–15 minutes) has 384 live rows but 146MB of table bloat** from
      historical churn — Supabase's own advisor flags this INFO/low
      severity. A `VACUUM FULL` would reclaim the space but explicitly
      incurs downtime per Supabase's own remediation note, so this
      wasn't run unprompted — schedule it for a low-traffic window if
      reclaiming the disk space matters, otherwise safe to ignore.
- [x] **Migrations/live-schema conflict from Phase 9 — fixed
      (2026-08-29, same session, later pass).** `supabase/migrations/
      20260222000001_create_automations.sql` attempted `CREATE TABLE
      public.automations` and `CREATE TYPE public.automation_status`,
      both already created by the earlier `20260127204449_...sql` with
      a different, incompatible schema and different enum values — a
      fresh replay of these migrations in order fails right here.
      Confirmed directly against live production: the actual
      `automations` table's columns match the first migration exactly,
      and this migration's version isn't present in Supabase's own
      applied-migrations ledger at all — it never successfully ran
      anywhere, so neutralizing it isn't rewriting history that actually
      happened. Confirmed nothing later references this file's
      never-applied columns/types. Replaced its body with a `SELECT 1;`
      no-op and an explanatory comment, so a fresh migration replay
      (e.g. rebuilding another disposable E2E project the way Phase 9
      needed to) no longer fails on it.
- [x] **Per-page SEO metadata — fixed (2026-08-29, same session, later
      pass).** Every route, including the public marketing pages search
      engines actually index (Pricing, Terms, Privacy, Cookies) plus
      Auth, shared one static `<title>`/`<meta description>` from
      `index.html`. Added `useDocumentMeta` — a plain `useEffect` + DOM
      writes, not `react-helmet-async` (this is a client-rendered-only
      SPA; helmet's real value, SSR-safe head management, doesn't
      apply) — setting the route's title, meta description, and
      `og:title`/`og:description`, resetting to the app-wide default on
      unmount. Wired into Terms, Privacy, Cookies, Pricing, and Auth
      using each page's existing i18n title key plus a new
      `metaDescription` key added to both `en.json` and `pt.json`,
      keeping full bilingual parity.
- [ ] **~18 unused indexes remain** (from earlier phases' advisor runs,
      re-confirmed present) — deliberately deferred until real
      production traffic exists to judge which are actually dead weight
      versus just unused so far.

**Genuinely left for the user, batched together for one pass later** (per
explicit request — these need the user's own action or decision, not
more code):
- **Leaked Password Protection — Supabase's toggle is "accepted, not
  fixable on Free."** User navigated to the actual setting and confirmed
  live: greyed out, "Only available on Pro plan and above." Not a toggle
  anyone missed — genuinely gated behind a Supabase plan upgrade. A free
  substitute covering normal signup and password-change flows is now in
  place instead (Phase 14, 2026-09-18); the Pro toggle is still the only
  hard server-side enforcement, and the user can skip Pro unless the
  client-side bypass matters to them.
- **`net._http_response` has 146MB of table bloat** from this project's
  own `pg_cron` churn (384 live rows, confirmed) — a `VACUUM FULL` would
  reclaim it but explicitly incurs downtime per Supabase's own
  remediation note, so it's the user's call on timing, not run
  unprompted.

Verified after every fix: `tsc --noEmit` clean, `eslint` 0 new errors,
`vitest` 63/63 passing, production build succeeds.

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
      **Partial verification added 2026-09-19:** the schedule source of truth
      was proven consistent — the inlined `SCHEDULES` table in
      `schedule-from-templates` was diffed against all eight
      `src/data/platforms/*.json` files and matches exactly for every
      platform, and a parity test now guards the duplicate category maps
      (`src/utils/websiteCategoryParity.test.ts`). What remains unproven is
      delivery itself, for the reason above.
      **Critical caveat confirmed 2026-09-19:** only `linkedin` and `twitter`
      publish directly (`publish-due-posts/index.ts:15`); the other six
      platforms require an active `webhook_configs` row or they fail with
      `No active webhook configured for {platform}`. Webhook configuration is
      therefore a go-live prerequisite, not an optional extra.
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
