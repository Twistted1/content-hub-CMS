/**
 * The single source of truth for Stripe price IDs.
 *
 * WHY THIS EXISTS
 * The same four price IDs used to be hardcoded independently in three edge
 * functions — `create-checkout` (plan → price), `check-subscription` and
 * `stripe-webhook` (price → tier). The footgun was not the literals, it was that
 * updating two of the three left the third disagreeing. The worst case was
 * silent: a deployment that updated `create-checkout` but not `stripe-webhook`
 * would take the customer's money and then resolve the unrecognised price to
 * `"free"` in `resolveTier`, downgrading a paying customer with no error
 * anywhere. Deriving every view from one table makes that drift impossible
 * rather than merely unlikely.
 *
 * OVERRIDABLE, AND SAFE BY DEFAULT
 * Each ID can be overridden by an environment variable, so a second deployment
 * (self-host, or a new Stripe account) sets four secrets instead of editing this
 * file. With none set, the built-in defaults are used — the exact values that
 * were hardcoded before — so behaviour is unchanged until someone opts in.
 *
 * DELIBERATELY NOT MEMOISED
 * `getStripePriceTable()` rebuilds on every call. That is intentional and costs
 * microseconds: this project has already been bitten by a Supabase edge function
 * keeping a warm instance with a stale secret (the `STRIPE_WEBHOOK_SECRET`
 * incident), and a cached price table would reintroduce exactly that failure mode.
 *
 * `buildStripePriceTable` takes the env lookup as a parameter so it is a pure
 * function and can be tested without a Deno runtime.
 */

export type PaidTier = "starter" | "pro";
export type BillingInterval = "monthly" | "yearly";

/** The live values, which were previously duplicated across three functions. */
export const DEFAULT_PRICE_IDS: Record<PaidTier, Record<BillingInterval, string>> = {
  starter: {
    monthly: "price_1TUbGi99SwZHUFarbpocgTj2",
    yearly: "price_1TUbHN99SwZHUFarK9uTjwbD",
  },
  pro: {
    monthly: "price_1TUbI699SwZHUFar0ur6blfp",
    yearly: "price_1TUbIu99SwZHUFarlyuyIqnp",
  },
};

/** The opt-in override names, documented in `.env.example`. */
export const PRICE_ENV_NAMES: Record<PaidTier, Record<BillingInterval, string>> = {
  starter: {
    monthly: "STRIPE_PRICE_STARTER_MONTHLY",
    yearly: "STRIPE_PRICE_STARTER_YEARLY",
  },
  pro: {
    monthly: "STRIPE_PRICE_PRO_MONTHLY",
    yearly: "STRIPE_PRICE_PRO_YEARLY",
  },
};

/**
 * Legacy product IDs (the old $29 pro / $99 enterprise) folded into `pro`. Kept
 * because live subscriptions still reference them.
 */
export const LEGACY_PRO_PRODUCTS: ReadonlySet<string> = new Set([
  "prod_Tu23n9E83kU6SH",
  "prod_Tu24enzVGb9KJl",
]);

export interface StripePriceTable {
  /** plan → interval → Stripe price ID. Used by `create-checkout`. */
  prices: Record<PaidTier, Record<BillingInterval, string>>;
  /** price ID → tier + interval. Used by `check-subscription` and `stripe-webhook`. */
  priceToTier: Record<string, { tier: PaidTier; interval: BillingInterval }>;
  /** `"starter_monthly"` → whether the value came from env rather than the default. */
  overridden: Record<string, boolean>;
}

const TIERS: PaidTier[] = ["starter", "pro"];
const INTERVALS: BillingInterval[] = ["monthly", "yearly"];

export function buildStripePriceTable(
  getEnv: (name: string) => string | undefined,
): StripePriceTable {
  const prices = { starter: {}, pro: {} } as Record<PaidTier, Record<BillingInterval, string>>;
  const overridden: Record<string, boolean> = {};

  for (const tier of TIERS) {
    for (const interval of INTERVALS) {
      const envName = PRICE_ENV_NAMES[tier][interval];
      // Trim: a secret pasted with a trailing newline is a real and very
      // confusing failure, and Stripe would reject the ID with an opaque error.
      const fromEnv = (getEnv(envName) ?? "").trim();
      prices[tier][interval] = fromEnv || DEFAULT_PRICE_IDS[tier][interval];
      overridden[`${tier}_${interval}`] = Boolean(fromEnv);
    }
  }

  const priceToTier: Record<string, { tier: PaidTier; interval: BillingInterval }> = {};
  for (const tier of TIERS) {
    for (const interval of INTERVALS) {
      const id = prices[tier][interval];
      const existing = priceToTier[id];
      if (existing) {
        // Two plan/interval combos pointing at the same price. Keep the first and
        // say so: silently keeping whichever won the iteration order is how a
        // customer ends up on the wrong tier.
        console.error(
          `[stripePrices] MISCONFIGURED: price ${id} is mapped to both ` +
            `${existing.tier}/${existing.interval} and ${tier}/${interval}. ` +
            `Keeping the first. Check STRIPE_PRICE_* overrides.`,
        );
        continue;
      }
      priceToTier[id] = { tier, interval };
    }
  }

  return { prices, priceToTier, overridden };
}

/** Build the table from the edge function's environment. */
export function getStripePriceTable(): StripePriceTable {
  return buildStripePriceTable((name) => Deno.env.get(name) ?? undefined);
}
