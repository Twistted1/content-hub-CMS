# Open decisions and actions

Everything still open on this project, in one place, split by **who can actually
do it**. Kept short on purpose: `docs/MASTER_CHECKLIST.md` holds the full history
and evidence, this holds only what is still outstanding.

Last updated 2026-10-17 (after Phase 25).

**The honest headline: nothing here blocks launching.** The product works — auth,
review, scheduling, publishing proven on two independent paths, billing verified
through to the database write, tiered spend caps enforced. What remains is one
operational step, two account-only actions, and a handful of optional
improvements.

---

## A. Decisions only you can make

| # | Decision | Notes |
|---|---|---|
| A1 | **Are $1 / $5 / $15 the right per-tier AI caps?** | Owner's answer 2026-10-17: "I don't know" — not a decision yet, so the caps are unchanged. Chosen against real per-call costs (~$0.05 a pipeline post with an image, ~$0.01 a chat call), so free ≈ 20 image posts/month, pro ≈ 300. Still worth a sanity check against what a *paying* customer would expect to do in a month before these numbers become visible to them, whenever you're ready. Nothing technical — a one-line change in `_shared/aiBudget.ts` if you want different values. Still open. |
| A3 | **The CMS→website bridge: owner's answer 2026-10-17 is "ideally yes."** | Mechanism already exists and is not the blocker — see B2. What *was* blocking it silently: no code path ever set `posts.category` at all (not `content-pipeline`'s insert, not `schedule-from-templates` — it only folded the day's category into the AI *prompt text*, never stored it), so every delivery's category was dropped before it reached a receiver. Fixed in Phase 25 — see below. What's still open, and is an editorial call, not an engineering one: the CMS's 7 categories (Geopolitics, Economics, Media, Technology, Security, Climate, Corporate Social Responsibility) don't match the site's fixed 8-item filter list (All, Illustrated Features, Brazil, Geopolitics, Economics, Tech-AI, Green-Tech, CSR) — only 2 overlap exactly. `tools/webhook-receiver/server.mjs`'s `SITE_CATEGORY_BY_CMS_CATEGORY` now fills the rest with a defensible guess (Technology→Tech-AI, Climate→Green-Tech, Media/Security→Geopolitics) that is explicitly flagged in its own comment as unconfirmed — review it before relying on it for real editorial categorisation. `author_id` is still hardcoded to `novus-ai` for every delivery (the envelope carries no author signal at all) — fine for a single-operator CMS, revisit if that changes. |

---

## B. Actions that need access this session does not have

| # | Action | Why it needs you |
|---|---|---|
| B2 | **Point a real `/pipeline` webhook row at the receiver.** Follow `tools/webhook-receiver/DEPLOY.md`. The receiver itself is already deployed and verified end-to-end (signed delivery, correct field mapping) — this is just adding the row. **This is the last go-live gap** — today Instagram, Facebook, TikTok, YouTube and Website all fail with `No active webhook configured`. Before flipping `ARTICLES_COMMIT=1` for real: review the category mapping in A3 above, and redeploy the receiver (Railway is tracking a stale branch — see note below). | Hosting account + CMS login. |
| B4 | **Start Meta App Review** (`instagram_content_publish`, `pages_manage_posts`), if you have not. Days-to-weeks lead time, zero code dependency, and the most likely thing to blow a deadline. Note Instagram **cannot post text-only** — image, Reel, carousel or story only. | Your Meta business account. |
| B5 | **Move the committed E2E password to a GitHub secret**, then placeholder `.env.e2e.example:20`. Not done here deliberately: placeholder-ing it **breaks CI's E2E job** until the secret exists, so it must be a coordinated two-step. | GitHub repo settings. |
| B6 | **Railway is tracking `go-live/phase-15-gap-closure`, not `main`.** The receiver's latest fixes (health check on `/`, hiding `signed` status, and now the category-mapping fix in Phase 25) landed on `main` via separate PRs and won't auto-deploy until Railway's branch is updated or a manual redeploy is triggered. | Railway dashboard. |

---

## C. Optional engineering, not required for launch

Improvements, not blockers. Nothing in section A or B depends on them.

| # | Item | Why it is worth doing eventually |
|---|---|---|
| C2 | **Per-webhook signing secret.** Signing is one deployment-wide `WEBHOOK_SIGNING_SECRET`, so every receiver shares a key and rotating one touches all. | Independent rotation per receiver. |
| C3 | **Update and unpublish events.** Only `post.publish` is ever fired, so editing or deleting a post cannot be propagated to a receiver. | Any real integration needs it; a website bridge certainly will. |
| C4 | **The `project_settings` cron dead code.** Two early migrations build `pg_cron` bodies querying it with a key/value shape and a wide-column shape, neither matching the real table. Harmless — the jobs were superseded and the SQL is only text until pg_cron fires it. | Historical confusion only. |
| C5 | **UI display prices are hardcoded** ($10/$96/$20 in `Pricing.tsx`/`Landing.tsx`), independent of the Stripe price IDs. | They can silently disagree with what is charged. |
| C6 | **`rumble` and `podcast` are unreachable** from both UI platform pickers. | Scheduling aims at platforms that cannot deliver. |
| C7 | **Website display order is `id` ascending**, so a new article renders last regardless of its date. | A site-side sort by date fixes it. |
| C8 | **`articles`/`authors` nullability is unverified.** Their baseline migration was introspected from production, but nullability and defaults cannot be read over PostgREST — only from `information_schema.columns`. | A fresh install could differ subtly from production. |

---

## D. Closed — for reference

Recorded so the list above is trustworthy as *the remainder*. Closed in Phases 23
through 25:

**Your decisions:** the cross-user published-post read (confirmed a leak, policy
scoped down); the licence (AGPL-3.0-or-later, with `LICENSE` and the `package.json`
field); the 14-day trial (claim removed rather than implemented — the free tier
replaces it); **multi-tenancy (A2): owner's answer 2026-10-17 is "not for now"** —
the `admin`/tenant split stays out of scope until that changes.

**Your DB actions:** the `articles`/`authors` baseline migration (last
self-hosting `CREATE TABLE` gap); `public_published_posts` applied, then hardened
with `security_barrier = true`; both throwaway verification accounts banned with
`2099-12-31`; the first account's orphan `webhook_configs` row neutralised via
`UPDATE` (DELETE hangs in the SQL tooling); `GEMINI_API_KEY` confirmed set; a
stale test-mode `subscriptions` row on the owner's own real account (`tier: pro`
with a `end_date` five weeks in the past, left over from an earlier Stripe e2e
proof-run) found by cross-checking live Stripe directly — zero subscriptions
existed there at any status — and reset to `free`/`null` to match reality; the
three billing functions (`create-checkout`, `check-subscription`,
`stripe-webhook`) redeployed so the consolidated Stripe price table took effect.

**Engineering:** the webhook delivery contract unified and signed, proven in
production; per-platform caption truncation; idempotency keys; tier-aware AI spend
enforcement; the migration baseline for `project_settings`/`subscribers`;
`ai_usage_log` under migration control; the four Stripe price IDs consolidated
from three drifting copies into one table; `customer-portal`'s dead Lovable
fallback; the `scheduleMode` union drift; a full history secret audit across 625
commits (clean); a working reference receiver with a deploy runbook; the stale
deleted-migration reference in `aiBudget.ts`'s error paths; **`posts.category`
now actually gets populated and carried through the whole delivery chain**
(`schedule-from-templates` → `content-pipeline` → `_shared/publishDelivery.ts`
→ `publish-due-posts` → the receiver's category mapping), closing a gap where
it was silently dropped at every stage.
