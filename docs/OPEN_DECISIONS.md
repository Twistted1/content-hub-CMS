# Open decisions and actions

Everything still open on this project, in one place, split by **who can actually
do it**. Kept short on purpose: `docs/MASTER_CHECKLIST.md` holds the full history
and evidence, this holds only what is still outstanding.

Last updated 2026-10-16 (after Phase 24).

**The honest headline: nothing here blocks launching.** The product works — auth,
review, scheduling, publishing proven on two independent paths, billing verified
through to the database write, tiered spend caps enforced. What remains is one
operational step, one query, and a handful of optional improvements.

---

## A. Decisions only you can make

| # | Decision | Notes |
|---|---|---|
| A1 | **Are $1 / $5 / $15 the right per-tier AI caps?** | Chosen against real per-call costs (~$0.05 a pipeline post with an image, ~$0.01 a chat call), so free ≈ 20 image posts/month, pro ≈ 300. Worth a sanity check against what a *paying* customer would expect to do in a month before these numbers become visible to them. Nothing technical — a one-line change in `_shared/aiBudget.ts` if you want different values. |
| A2 | **Multi-tenancy: ever?** | The app is single-tenant by construction: `has_role()` reads a global `user_roles` table with no tenant column, and `project_settings` is one global row. Any customer granted `admin` can read and edit every other user's content, roles and billing. Fine for one owner, a blocker for selling seats to unrelated customers. A **product** decision that determines whether the `admin` split is work you ever need to do. |
| A3 | **Does the CMS→website bridge become real, and who pulls the trigger?** | `articles` has **no status column**, so any insert is live on novusexchange.com immediately — no draft state, no undo. `tools/webhook-receiver/` can do the write (dry-run by default), but whether it is wired up, and whether it is a deliberate human action or automatic, is your call. Today the site's own browser editor only writes one browser's `localStorage`, which looks like it works and is invisible to every other visitor. |

---

## B. Actions that need access this session does not have

| # | Action | Why it needs you |
|---|---|---|
| B1 | 🔴 **Verify your own subscription tier before relying on the automated pipeline.** The AI budget check is tier-aware, and a **missing** `subscriptions` row resolves to `free` → **$1/month**. `schedule-from-templates` invokes `content-pipeline` as the *automation owner*, so the cron is subject to its owner's cap. **If your account has no `subscriptions` row, or one whose `end_date` has passed, automated content generation stops after roughly a dollar of spend** — and it will look like a broken pipeline, not a billing limit. One query confirms it:<br>`select tier, end_date from public.subscriptions where user_id = '<your uid>';` | Needs a DB session. |
| B2 | **Deploy the receiver and point a `/pipeline` webhook row at it.** Follow `tools/webhook-receiver/DEPLOY.md`. **This is the last go-live gap** — today Instagram, Facebook, TikTok, YouTube and Website all fail with `No active webhook configured`. | Hosting account + CMS login. |
| B3 | **Redeploy the three billing functions** so the consolidated price table takes effect: `supabase functions deploy create-checkout check-subscription stripe-webhook`. Safe on its own — behaviour is identical until you set any `STRIPE_PRICE_*` secret. | Supabase CLI. |
| B4 | **Start Meta App Review** (`instagram_content_publish`, `pages_manage_posts`), if you have not. Days-to-weeks lead time, zero code dependency, and the most likely thing to blow a deadline. Note Instagram **cannot post text-only** — image, Reel, carousel or story only. | Your Meta business account. |
| B5 | **Move the committed E2E password to a GitHub secret**, then placeholder `.env.e2e.example:20`. Not done here deliberately: placeholder-ing it **breaks CI's E2E job** until the secret exists, so it must be a coordinated two-step. | GitHub repo settings. |

---

## C. Optional engineering, not required for launch

Improvements, not blockers. Nothing in section A or B depends on them.

| # | Item | Why it is worth doing eventually |
|---|---|---|
| C1 | **`security_barrier` on `public_published_posts`.** The view relies on its own `where status = 'published'` as the security boundary (its owner bypasses RLS), which is correct — but without `security_barrier = true` the planner may push a caller-supplied predicate *below* that filter, which is how a leaky operator can reveal rows the filter should have excluded. One line: `alter view public.public_published_posts set (security_barrier = true);`. Low urgency while nothing consumes the view; worth doing before something does. Prepared as a migration — see `supabase/migrations/20261016090000_*.sql`. | Cheap hardening of a public read surface. |
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
and 24:

**Your decisions:** the cross-user published-post read (confirmed a leak, policy
scoped down); the licence (AGPL-3.0-or-later, with `LICENSE` and the `package.json`
field); the 14-day trial (claim removed rather than implemented — the free tier
replaces it).

**Your DB actions:** the `articles`/`authors` baseline migration (last
self-hosting `CREATE TABLE` gap); `public_published_posts` applied; both throwaway
verification accounts banned with `2099-12-31`; the first account's orphan
`webhook_configs` row neutralised via `UPDATE` (DELETE hangs in the SQL tooling);
`GEMINI_API_KEY` confirmed set.

**Engineering:** the webhook delivery contract unified and signed, proven in
production; per-platform caption truncation; idempotency keys; tier-aware AI spend
enforcement; the migration baseline for `project_settings`/`subscribers`;
`ai_usage_log` under migration control; **the four Stripe price IDs consolidated
from three drifting copies into one table**; `customer-portal`'s dead Lovable
fallback; the `scheduleMode` union drift; a full history secret audit across 625
commits (clean); a working reference receiver with a deploy runbook; and the stale
deleted-migration reference in `aiBudget.ts`'s error paths.
