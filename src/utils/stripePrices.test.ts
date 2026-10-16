import { describe, it, expect, vi } from "vitest";
import {
  buildStripePriceTable,
  DEFAULT_PRICE_IDS,
  PRICE_ENV_NAMES,
  LEGACY_PRO_PRODUCTS,
} from "../../supabase/functions/_shared/stripePrices";

/**
 * The four price IDs used to be hardcoded independently in `create-checkout`,
 * `check-subscription` and `stripe-webhook`. These tests pin the two properties
 * that make one shared table worth having:
 *
 *   1. every view is derived from the same values, so the three can no longer
 *      disagree — the old worst case took a customer's money and then resolved
 *      their price to "free", downgrading them with no error anywhere;
 *   2. an env override is opt-in and trimmed, so a second deployment can set
 *      secrets instead of editing code, and a pasted trailing newline does not
 *      produce an opaque Stripe error.
 */

const noEnv = () => undefined;

describe("buildStripePriceTable — defaults", () => {
  it("uses the built-in values when nothing is overridden", () => {
    const { prices, overridden } = buildStripePriceTable(noEnv);
    expect(prices).toEqual(DEFAULT_PRICE_IDS);
    expect(Object.values(overridden).every((v) => v === false)).toBe(true);
  });

  it("derives priceToTier from the SAME table create-checkout writes from", () => {
    // This is the drift guard. If someone adds a plan to `prices` and forgets the
    // reverse map, this fails rather than silently resolving that plan to free.
    const { prices, priceToTier } = buildStripePriceTable(noEnv);
    for (const tier of ["starter", "pro"] as const) {
      for (const interval of ["monthly", "yearly"] as const) {
        expect(priceToTier[prices[tier][interval]]).toEqual({ tier, interval });
      }
    }
    expect(Object.keys(priceToTier)).toHaveLength(4);
  });

  it("maps each plan/interval to a distinct price", () => {
    const { prices } = buildStripePriceTable(noEnv);
    const ids = [
      prices.starter.monthly,
      prices.starter.yearly,
      prices.pro.monthly,
      prices.pro.yearly,
    ];
    expect(new Set(ids).size).toBe(4);
  });
});

describe("buildStripePriceTable — env overrides", () => {
  it("prefers an override over the default", () => {
    const { prices, priceToTier, overridden } = buildStripePriceTable((name) =>
      name === PRICE_ENV_NAMES.pro.monthly ? "price_OVERRIDE_pro_monthly" : undefined,
    );
    expect(prices.pro.monthly).toBe("price_OVERRIDE_pro_monthly");
    expect(overridden.pro_monthly).toBe(true);
    // The reverse map must follow the override, or the webhook would resolve the
    // real (overridden) price as unrecognised and downgrade the customer.
    expect(priceToTier["price_OVERRIDE_pro_monthly"]).toEqual({ tier: "pro", interval: "monthly" });
    // The old value is no longer mapped.
    expect(priceToTier[DEFAULT_PRICE_IDS.pro.monthly]).toBeUndefined();
    // Untouched entries keep their defaults.
    expect(prices.starter.monthly).toBe(DEFAULT_PRICE_IDS.starter.monthly);
  });

  it("trims whitespace, so a secret pasted with a newline still matches", () => {
    const { prices, priceToTier } = buildStripePriceTable((name) =>
      name === PRICE_ENV_NAMES.starter.yearly ? "  price_padded_yearly\n" : undefined,
    );
    expect(prices.starter.yearly).toBe("price_padded_yearly");
    expect(priceToTier["price_padded_yearly"]).toEqual({ tier: "starter", interval: "yearly" });
  });

  it("treats an empty or whitespace-only override as unset", () => {
    const { prices, overridden } = buildStripePriceTable((name) =>
      name === PRICE_ENV_NAMES.starter.monthly ? "   " : "",
    );
    expect(prices.starter.monthly).toBe(DEFAULT_PRICE_IDS.starter.monthly);
    expect(overridden.starter_monthly).toBe(false);
  });

  it("surfaces a duplicate mapping instead of silently keeping whichever won", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { priceToTier } = buildStripePriceTable((name) =>
      name === PRICE_ENV_NAMES.pro.monthly ? DEFAULT_PRICE_IDS.starter.monthly : undefined,
    );
    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0].join(" "))).toMatch(/MISCONFIGURED/i);
    // First writer wins, deterministically: starter is processed before pro.
    expect(priceToTier[DEFAULT_PRICE_IDS.starter.monthly]).toEqual({
      tier: "starter",
      interval: "monthly",
    });
    spy.mockRestore();
  });
});

describe("legacy product IDs", () => {
  it("still folds the old pro/enterprise products into pro", () => {
    // Live subscriptions reference these, so dropping them would downgrade real
    // customers — this asserts the set is not accidentally emptied.
    expect(LEGACY_PRO_PRODUCTS.has("prod_Tu23n9E83kU6SH")).toBe(true);
    expect(LEGACY_PRO_PRODUCTS.has("prod_Tu24enzVGb9KJl")).toBe(true);
  });
});
