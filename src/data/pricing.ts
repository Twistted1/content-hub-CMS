/**
 * The single source of truth for the dollar amounts shown in the UI
 * (`Pricing.tsx`'s plan cards and `Landing.tsx`'s pricing teaser).
 *
 * These are **display values only** — the actual charge is whatever Stripe's
 * price object says, keyed by the price IDs in
 * `supabase/functions/_shared/stripePrices.ts`. The two were previously
 * hardcoded independently in `Pricing.tsx` and `Landing.tsx`, which is how a
 * price change could show two different numbers on two pages. Collecting them
 * here removes that specific drift; it does not remove the need to update
 * this file (and `stripePrices.ts`'s `DISPLAY_AMOUNTS_USD`, which
 * `src/utils/pricingParity.test.ts` pins against it) when a real Stripe price
 * changes — there is no live fetch, by design: see `stripePrices.ts`'s
 * header for why these amounts are not fetched from Stripe at render time.
 */
export const PLAN_PRICING_USD = {
  free: { monthly: 0, yearly: 0 },
  starter: { monthly: 10, yearly: 96 },
  pro: { monthly: 20, yearly: 192 },
} as const;

export type PlanKey = keyof typeof PLAN_PRICING_USD;
