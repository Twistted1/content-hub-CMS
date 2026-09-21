# Content Hub CMS — Full Audit & Go-Live Readiness Assessment

Revision audited: `59cdea98d666d124e4212de2b3f56c2932d89b20` (`main`), working
tree at `0c911f7` on branch `fix/audit-pipeline-hardening`.
Method: lifecycle audit (creation → generation → review → scheduling →
publishing) reading source directly, plus all local gates actually executed.
Every finding below carries a file:line reference. Findings that cannot be
proven from this environment are labelled **cannot verify here** rather than
scored as passing.

---

## PART 1 — What's working and solid

- **Build and quality gates pass, verified by running them.** `npm ci` exits
  0; `npx tsc --noEmit` reports zero errors; `vitest` runs 10 files, 85
  passed / 1 skipped; `npm run lint` is 0 errors / 289 warnings; `npm run
  build` succeeds in ~9s. CI (`.github/workflows/ci.yml:20-32`) runs exactly
  these four gates.
- **The schedule has one source of truth, and it agrees with the generator.**
  `src/data/platforms/*.json` feed `src/utils/scheduling.ts:24-33`. I
  extracted the inlined `SCHEDULES` table from
  `supabase/functions/schedule-from-templates/index.ts:17` and diffed it
  against all eight JSON files: **identical for twitter, instagram, tiktok,
  facebook, rumble, linkedin, youtube and website.** This was the Phase 9
  root cause; it is genuinely fixed.
- **Cron topology is correct and single.** `schedule-content` every 15 min
  (`schedule-from-templates`) and `publish-due-posts` every minute. The
  duplicate `legacy-pipeline` job is retired by
  `supabase/migrations/20260723000000_retire_legacy_pipeline.sql`, with the
  root cause documented in the migration header.
- **Publishing has real retry semantics.** `claim_due_posts`
  (`supabase/migrations/20260918000200_add_publish_retry_tracking.sql:31`)
  claims atomically with `FOR UPDATE SKIP LOCKED`, spaces retries with
  exponential backoff, and parks a post as `failed` at `p_max_attempts`
  (default 5). The previous select-then-update race is documented and gone.
- **Webhook targets are SSRF-guarded.** `content-pipeline/index.ts:15-42`
  rejects non-https, loopback, link-local, cloud-metadata (169.254),
  RFC1918 and CGNAT hosts.
- **The leaked JWT was removed from history-moving state and from the
  migration.** The cron migration no longer inlines a token; auth is via
  `x-cron-secret` checked against `get_cron_secret()`, which is granted to
  `service_role` only (`20260601130235_*.sql:25-26`). Diffing the working
  tree showed these as *removed* lines — remediation, not exposure.
- **Auth edges are fail-closed.** `verify_jwt` decisions audited in
  `supabase/config.toml:4-61`; every `false` is deliberate (cron-called,
  provider callbacks, Stripe webhook, demo-login behind its own gates).
- **Password hardening is real and tested.** `src/utils/passwordPolicy.ts`
  and `src/utils/pwnedPassword.ts` with matching test files.
- **UTC handling is explicit and tested.** `src/utils/scheduleTime.ts`
  documents the previous wall-clock bug and converts local ↔ UTC correctly,
  covered by `scheduleTime.test.ts`.
- **i18n parity is enforced by test**, not convention —
  `src/i18n/locales/parity.test.ts` (1722 keys, en/pt).

## PART 2 — Partial, incomplete, or at risk

| Item | Exists | Missing | Risk |
|---|---|---|---|
| **Only 2 of 8 platforms publish directly** | `publish-due-posts/index.ts:15` — `DIRECT_PLATFORMS = {linkedin, twitter}` | The other 6 need an active `webhook_configs` row or they throw `No active webhook configured for {platform}` (line 150) | **High** |
| **Manual publish is narrower than the scheduler** | `publish-post/index.ts:141` — LinkedIn/X only | Throws `Direct publishing not supported for {platform}` for the rest | Medium |
| **`scheduleMode` type union is wrong** | Typed `"immediate" \| "scheduled" \| "draft"` (`useContentPipeline.ts:100`) | `schedule-from-templates:242` sends `"awaiting_review"`, which is not in the union; `content-pipeline:278` then treats it as immediate | Medium |
| **E2E specs self-skip silently** | `e2e/authenticated.spec.ts:6-10` | Skips when `E2E_SUPABASE_SERVICE_ROLE_KEY` is absent, so a green E2E run may mean nothing ran | Medium |
| **Zero test coverage for generation, review transitions, publishing** | 10 unit files | The three highest-risk stages are untested | Medium |
| **`podcast` schedule exists backend-only** | `schedule-from-templates` SCHEDULES has `podcast` | No matching `src/data/platforms/podcast.json`; frontend defines podcast separately in `platformsData.ts:35` | Low |
| **`approved_at` column has no writer** | Column exists in `types.ts:503` | Nothing ever writes it; the requested→approved interval is unmeasurable | Low |

Correction to prior assumptions worth recording: `workflow_stage` and
`review_requested_at` **do** have a writer — the `sync_post_workflow_stage`
trigger (`supabase/migrations/20260430212700_*.sql:13-38`) maintains both on
every status change. The earlier claim that they were orphaned columns was
wrong.

## PART 3 — Blockers and critical issues

1. **Uncommitted work existed only in one container.** At audit time, ~55
   files of substantial work (security remediation, retry tracking, password
   policy, scheduling utilities) were uncommitted with **zero commits ahead
   of `origin/main`**. One container loss would have destroyed all of it.
   *Now fixed* — committed to `fix/audit-pipeline-hardening`.
2. **A decorative webhook form told users they had configured delivery when
   they had not.** `Settings → Integrations` rendered a URL input, toggle and
   `Test` button with no handlers and no mutation. Because 6 of 8 platforms
   require a webhook to publish, this is not cosmetic. *Now fixed* — the card
   reads real rows and links to `/pipeline`.
3. **Bulk approve can schedule the entire inbox in one click.**
   `src/pages/Review.tsx:456` — `handleBulkApprove` falls back to
   `needsReview.map(p => p.id)` when nothing is checked. With auto-publishing
   live, that approves and schedules everything pending. The button does read
   "Approve All", so it is arguably intentional — **left unchanged pending
   your decision**, flagged because the blast radius is large.

## PART 4 — Improvements and enhancements

- Type `scheduleMode` as a shared union that includes `"awaiting_review"`.
- Surface publish mode per platform in the UI (direct vs webhook, and whether
  that webhook exists) instead of failing at publish time.
- Add integration tests against Stripe's test mode — the one external service
  that offers a sandbox; most social platforms do not.
- Reconcile the backend-only `podcast` schedule entry with the frontend.
- Reduce the 289 lint warnings (all `no-explicit-any`, 0 errors) opportunistically.
- Formal deletion of the 6 retired 410-stub edge functions via the dashboard.

## PART 5 — Go-live action plan

| Priority | Task | Effort | Areas |
|---|---|---|---|
| 🔴 CRITICAL | Commit/push in-progress work so it is recoverable | 15 min | entire working tree |
| 🔴 CRITICAL | Decide bulk-approve semantics (keep "Approve All" or require selection) | 30 min | `src/pages/Review.tsx:456` |
| 🔴 CRITICAL | Configure webhooks for the 6 non-direct platforms, or accept that only LinkedIn/X deliver | 1–2 h + credentials | `webhook_configs`, `/pipeline` |
| 🟡 HIGH | Fix `scheduleMode` union drift | 30 min | `useContentPipeline.ts:100`, `schedule-from-templates:242` |
| 🟡 HIGH | Verify publish end-to-end against a local webhook receiver | 2–3 h | `publish-due-posts`, `claim_due_posts` |
| 🟡 HIGH | Make E2E self-skip visible (report skipped, not passed) | 1 h | `e2e/*`, `.github/workflows/e2e.yml` |
| 🟢 MEDIUM | Add tests for generation, review transitions, publishing | 1 day | `src/**`, edge functions |
| 🟢 MEDIUM | Surface per-platform publish mode in UI | 3–4 h | `Platforms.tsx`, `Automation.tsx` |
| 🟢 MEDIUM | Fix backend-only `podcast` schedule drift | 1 h | `schedule-from-templates`, `platformsData.ts` |
| ⚪ LOW | Reduce lint warnings; delete 410 stubs; drop `approved_at` | 3–4 h | various |

**Total estimated time to go-live:** ~1 day of code work plus webhook
configuration; longer if live-account verification is required.
**Recommended deployment target:** existing Vercel setup (already bound to
`main` with auto-deploy); Supabase for backend. No Docker work needed.

## PART 6 — Summary and recommendation

The codebase is in materially better shape than a typical go-live candidate:
all gates pass, the schedule source of truth is real and verified consistent,
cron is single and correct, publishing has atomic claims and real retry
backoff, and the previously leaked JWT is remediated. The genuine blocker is
not code quality — it is that **most platforms cannot actually deliver**.
Only LinkedIn and X publish directly; the other six require a webhook
configuration you have not yet created, so a calendar that looks full can be
largely undeliverable. The second risk is operational: a large body of
finished work sat uncommitted in a single container. Both are addressed —
the work is committed, and the misleading Settings form that made webhook
setup look done is replaced. My recommendation: treat "configure and verify
webhooks for the six non-direct platforms" as the single must-do before
inviting testers, and decide the bulk-approve question the same day.

---

### Cannot verify here (operator action required)

- Live LinkedIn/X publish, and webhook delivery to any platform — needs real
  connected accounts or a receiver you control.
- Stripe checkout/webhook against a live account.
- Live cron execution history.
- Authenticated-page mobile responsiveness (dev server cannot reach Supabase
  from this sandbox; the unauthenticated pages were verified previously).
- Supabase's official leaked-password-protection toggle (Pro tier only;
  free substitute shipped and accepted).
