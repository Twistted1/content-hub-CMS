## Plan: Close out items 1–3 (Pricing, Publishing, Stability)

Three sequential workstreams. You can approve all three or tell me to stop after any phase.

---

### Phase 1 — Pricing restructure (Free / Starter $10 / Pro $20)

**Stripe products** (I create via tool):
- Content Hub Starter — $10/mo and $96/yr (~20% off)
- Content Hub Pro — $20/mo and $192/yr (~20% off)
- (Old $29 Pro and $99 Enterprise products left inactive in Stripe so existing subs keep working.)

**DB migration**
- Extend `subscription_tier` enum to add `'starter'` (keeping `free`, `pro`; deprecating `enterprise` from UI but enum stays intact for back-compat).

**Edge functions**
- `create-checkout`: replace `PRICE_IDS` with new map keyed by `{ plan: 'starter'|'pro', billing: 'monthly'|'yearly' }`; accept both in body.
- `check-subscription`: map returned `price.id` → tier (`starter`/`pro`) and include `billing_interval` in response.

**Frontend**
- `src/pages/Pricing.tsx`: new 3-tier layout (Free / Starter / Pro), monthly↔yearly toggle showing "Save ~20%", remove Enterprise card, replace with a small "Need more? Contact us" link.
- `src/pages/Landing.tsx`: update pricing teaser cards to match.
- `src/hooks/useSubscription.ts`: `SubscriptionTier = 'free' | 'starter' | 'pro'`; `createCheckout(plan, billing)`.
- Anywhere that gates by `tier === 'enterprise'` → fold into `'pro'`.

**Feature gating** (Starter vs Pro)
```text
Free     → 3 platforms,  50 posts/mo,  Novee 10/day
Starter  → 6 platforms, 300 posts/mo,  Novee 100/day, basic automations
Pro      → unlimited platforms & posts, unlimited Novee, full automations, API
```
Confirm or override these limits when approving.

---

### Phase 2 — External publishing decision

Currently "publishing" just fires a webhook (Zapier/Make). Three viable paths — pick one when approving:

| Option | What it means | Effort |
|---|---|---|
| A. Keep webhooks only | Document Zapier/Make recipes, polish UI copy so users know it's BYO-automation. | Low |
| B. Direct OAuth for 1–2 platforms | Implement real publishing for **LinkedIn + X** first (secrets already exist). YouTube/TikTok/IG/FB later. | Medium |
| C. Hybrid (recommended) | Ship B for LinkedIn + X now, keep webhooks as fallback for the others, mark them "Beta — via webhook" in the UI. | Medium |

My recommendation: **C**. Default plan assumes C unless you say otherwise.

---

### Phase 3 — Stability pass

- Run `security--run_security_scan` and fix any new findings.
- Run `supabase--linter` and resolve warnings.
- Sweep `useSubscription` consumers for the removed `'enterprise'` literal (TS will surface them).
- Smoke-test critical flows: signup → checkout (Starter monthly) → dashboard → create post → schedule → publish (webhook path).
- Verify cron jobs (`scheduled-pipeline`, `run-scheduled-automations`) still authenticate after the recent SERVICE_ROLE lockdown.
- Tidy: remove dead Enterprise references, update i18n strings (PT primary), update pricing memory.

---

### Manual actions you'll still need to do
1. Enable **Leaked Password Protection** in Supabase Auth dashboard.
2. (If choosing B/C) Configure LinkedIn + X OAuth redirect URIs in their developer dashboards — I'll give exact URLs.
3. In Stripe dashboard, archive the old $29/$99 prices once you confirm no active subs remain on them.

---

**Reply with:**
- "Go" → I execute all three phases with defaults (Hybrid publishing, gating limits above).
- Or specify changes (different limits, Option A/B for publishing, skip Phase 3, etc.).