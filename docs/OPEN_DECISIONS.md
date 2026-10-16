# Open decisions and actions

Everything still open on this project, in one place, split by **who can actually
do it**. Kept short on purpose: `docs/MASTER_CHECKLIST.md` holds the full history
and evidence, this holds only what is still outstanding.

Last updated 2026-10-16.

**The honest headline: nothing here blocks launching.** The product works —
auth, review, scheduling, publishing proven on two independent paths, billing
verified through to the database write, tiered spend caps enforced. What remains
is a handful of small decisions and operational steps, most of which only matter
*after* you make a choice you have not made yet.

---

## A. Decisions only you can make

| # | Decision | Options / recommendation | What it unblocks |
|---|---|---|---|
| A1 | **The cross-user published read.** Any authenticated user can currently read every `published` post across all users. Status-specific, not privilege escalation, and no migration creates it — it was added in the dashboard. | **(a) Intentional** → record it and do nothing. There is precedent: `media` already carries a `"Public can view published media"` policy. **(b) A leak** → run Part B of `tools/sql-options/02-published-post-read.sql`. Part A (the safe view) is worth applying either way. | Only matters for multi-tenancy. Single tenant: near-harmless. |
| A2 | **The licence.** | **AGPL-3.0** or **open-core** (permissive core, hosted/enterprise paid). MIT gives away the hosted business, which is your commercial path given single-tenant architecture. | Open-sourcing at all. ~10 minutes once decided. |
| A3 | **The advertised 14-day trial.** Two locales and the FAQ promise it; `trial_period_days` does not exist anywhere. | **Implement** it in `create-checkout`, or **delete** the claim. Currently it is a false-advertising and chargeback exposure. | Marketing accuracy. Either answer is fine; leaving it is not. |
| A4 | **Are $1 / $5 / $15 the right AI caps?** | They were chosen against real per-call costs (~$0.05 a pipeline post, ~$0.01 a chat call), so free ≈ 20 image posts/month. Worth a sanity check against what a Pro customer would expect to *do* in a month before publishing the numbers. | Nothing technical. |
| A5 | **Your own account's tier.** 🔴 **Check this.** ⚠️ See B1. | `select tier, end_date from public.subscriptions where user_id = '<your uid>';` | Whether your automated pipeline keeps running. |

---

## B. Actions that need access this session does not have

| # | Action | Why it needs you |
|---|---|---|
| B1 | 🔴 **Verify your own subscription tier before relying on the cron pipeline.** The AI budget check is tier-aware, and a **missing** `subscriptions` row resolves to `free` → **$1/month**. `schedule-from-templates` calls `content-pipeline` as the automation's owner, so the cron is subject to your own cap. If your account has no row or a stale `end_date`, **automated content generation stops after roughly one dollar of spend.** One query confirms it. | Needs a DB session. |
| B2 | **Run the `information_schema` query, then move the baseline into `supabase/migrations/`** as `20260122999999_baseline_articles_authors.sql`. The file is written; only nullability/defaults need confirming. | Only a DB session can introspect them. |
| B3 | **Apply Part A of the published-read SQL** (safe, additive, worth doing regardless of A1). | Needs a DB session. |
| B4 | **Deploy the receiver and point a `/pipeline` webhook row at it.** Follow `tools/webhook-receiver/DEPLOY.md`. **This closes the original go-live gap** — today Instagram, Facebook, TikTok, YouTube and Website still cannot deliver. | Hosting account + CMS login. |
| B5 | **Ban the two throwaway accounts** from verification: `golive-sign-8325@example.com`, `golive-sign2-62084@example.com`. Use `2099-12-31`, **not** `'infinity'` — GoTrue cannot parse infinity and the login fails with a 500 that reads like an outage. | Dashboard / service role. |
| B6 | **Delete the first throwaway's orphan rows.** Exact SQL is in Phase 22 of the checklist; one `webhook_configs` row points at a throwaway `webhook.site` receiver. | SQL access — its password was never saved, so it could not be cleaned up from here. |
| B7 | **Meta App Review.** Start it if you have not. Days-to-weeks lead time, zero code dependency, and the single most likely thing to blow a deadline. Instagram additionally **cannot post text-only** — image, Reel, carousel or story only. | Your Meta business account. |
| B8 | **Move the committed E2E password to a GitHub secret**, then placeholder `.env.e2e.example:20`. Not done here deliberately: placeholder-ing it **breaks CI's E2E job** until the secret exists, so it has to be a coordinated two-step. | GitHub repo settings. |

---

## C. Optional engineering, not required for launch

These are improvements, not blockers. Nothing depends on them except future work.

| # | Item | Why it is worth doing eventually |
|---|---|---|
| C1 | **Per-webhook signing secret.** Signing is currently one deployment-wide `WEBHOOK_SIGNING_SECRET`, so every receiver shares a key. | Lets you rotate one receiver without touching the others. |
| C2 | **Update and unpublish events.** Only `post.publish` is ever fired, so editing or deleting a post cannot be propagated to a receiver. | Any real integration eventually needs it; a website bridge certainly will. |
| C3 | **The `project_settings` cron dead code.** Two early migrations build `pg_cron` bodies that query it with a key/value shape and a wide-column shape, neither matching the real table. Harmless — the jobs were superseded and the SQL is only text until pg_cron fires it. | Historical confusion only. |
| C4 | **Display prices in the UI are hardcoded** ($10/$96/$20 in `Pricing.tsx`/`Landing.tsx`), independent of the Stripe price IDs. | They can silently disagree with what Stripe actually charges. |
| C5 | **`articles`/`authors` FK and write path.** The site's browser editor ("Save Article & Update Feed") only writes that one browser's `localStorage`, because the anon key cannot write to `articles`. | It looks like it works and is invisible to every other visitor. |
| C6 | **`rumble` and `podcast` are unreachable** from both UI platform pickers. | Scheduling aims at platforms that cannot deliver. |
| C7 | **Display order on the website is `id` ascending**, so a new article renders last regardless of its date. | A site-side sort by date fixes it. |

---

## D. Done, for reference

Closed recently, so the list above is the real remainder: the webhook delivery
contract is unified and signed (proven in production); per-platform caption
truncation; idempotency keys; AI spend enforced and tier-aware; the migration
baseline for `project_settings`/`subscribers`; `ai_usage_log` under migration
control; the Stripe price table consolidated from three copies into one;
`customer-portal`'s dead Lovable fallback; the `scheduleMode` union drift; the
secret audit across all 625 commits (clean); and a working reference receiver
with a deploy runbook.
