import { describe, it, expect } from "vitest";
import { DISPLAY_AMOUNTS_USD } from "../../supabase/functions/_shared/stripePrices";
import { PLAN_PRICING_USD } from "../data/pricing";

/**
 * `Pricing.tsx` and `Landing.tsx` both render dollar amounts derived from
 * `src/data/pricing.ts`, which used to be two independently hardcoded copies
 * that could (and did, per AGENTS.md) silently disagree. This pins that single
 * source against `_shared/stripePrices.ts`'s `DISPLAY_AMOUNTS_USD` — the
 * amounts confirmed directly against the live Stripe price objects — so a
 * change to one without the other fails the build instead of shipping a wrong
 * number to a paying customer.
 */
describe("pricing parity", () => {
  it("UI display prices match the confirmed Stripe amounts", () => {
    expect(PLAN_PRICING_USD.starter).toEqual(DISPLAY_AMOUNTS_USD.starter);
    expect(PLAN_PRICING_USD.pro).toEqual(DISPLAY_AMOUNTS_USD.pro);
  });

  it("free plan has no charge", () => {
    expect(PLAN_PRICING_USD.free).toEqual({ monthly: 0, yearly: 0 });
  });
});
