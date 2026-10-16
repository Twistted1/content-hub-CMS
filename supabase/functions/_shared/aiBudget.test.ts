import { describe, it, expect, vi } from "vitest";
import { checkAiBudget, recordAiUsage, budgetExceededResponse } from "./aiBudget";

/**
 * `aiBudget.ts` has no Deno-only APIs (just `admin` duck-typed as a Supabase
 * client), so it's testable here under vitest even though the edge functions
 * that call it run under Deno — same reasoning as the rest of this project's
 * `_shared` modules.
 */

function mockAdmin({
  settingsRow = { monthly_openai_budget: 50 },
  usageRows = [] as Array<{ user_id: string; cost_estimate: number }>,
  // undefined = no subscriptions row for anyone (resolves to "free", same as a
  // never-subscribed user) — matches checkAiBudget's conservative default.
  subscriptionRow = undefined as { tier: string; end_date: string | null } | undefined,
} = {}) {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn((table: string) => {
    if (table === "project_settings") {
      return { select: () => ({ single: async () => ({ data: settingsRow, error: null }) }) };
    }
    if (table === "subscriptions") {
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: subscriptionRow ?? null, error: null }) }),
        }),
      };
    }
    if (table === "ai_usage_log") {
      return {
        select: () => ({ gte: async () => ({ data: usageRows, error: null }) }),
        insert,
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
  return { from, _insert: insert };
}

describe("checkAiBudget", () => {
  it("allows a user with no prior spend", async () => {
    const admin = mockAdmin();
    const check = await checkAiBudget(admin, "user-a");
    expect(check.allowed).toBe(true);
    expect(check.userSpend).toBe(0);
    expect(check.instanceSpend).toBe(0);
  });

  it("blocks once the instance-wide total is reached, even for a user with zero spend of their own", async () => {
    const admin = mockAdmin({
      usageRows: [
        { user_id: "someone-else", cost_estimate: 50 },
      ],
    });
    const check = await checkAiBudget(admin, "user-a");
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe("instance_budget_exceeded");
  });

  it("blocks a single user once THEIR OWN spend hits the per-user cap, independent of others", async () => {
    const admin = mockAdmin({
      usageRows: [
        { user_id: "user-a", cost_estimate: 5 },
        { user_id: "user-b", cost_estimate: 0.1 }, // instance total (5.1) stays well under 50
      ],
    });
    const check = await checkAiBudget(admin, "user-a");
    expect(check.allowed).toBe(false);
    expect(check.reason).toBe("user_budget_exceeded");
  });

  it("does NOT block a different user who hasn't hit their own cap, even if someone else has — this is the actual bug being fixed", async () => {
    const admin = mockAdmin({
      usageRows: [
        { user_id: "heavy-user", cost_estimate: 5 }, // at their own cap
      ],
    });
    const check = await checkAiBudget(admin, "light-user");
    expect(check.allowed).toBe(true);
    expect(check.userSpend).toBe(0);
  });

  it("only sums the target user's own rows into userSpend, not everyone's", async () => {
    const admin = mockAdmin({
      usageRows: [
        { user_id: "user-a", cost_estimate: 1 },
        { user_id: "user-a", cost_estimate: 2 },
        { user_id: "user-b", cost_estimate: 10 },
      ],
    });
    const check = await checkAiBudget(admin, "user-a");
    expect(check.userSpend).toBe(3);
    expect(check.instanceSpend).toBe(13);
  });

  it("falls back to sane defaults when project_settings has no row", async () => {
    const admin = mockAdmin({ settingsRow: undefined as any });
    const check = await checkAiBudget(admin, "user-a");
    expect(check.instanceLimit).toBe(50);
    expect(check.userLimit).toBe(1); // free-tier default when there's no subscription row either
    expect(check.allowed).toBe(true);
  });
});

describe("checkAiBudget — tier-based per-user limit", () => {
  it("defaults an unsubscribed user to the free-tier limit ($1)", async () => {
    const check = await checkAiBudget(mockAdmin(), "user-a");
    expect(check.tier).toBe("free");
    expect(check.userLimit).toBe(1);
  });

  it("gives a starter subscriber the starter limit ($5)", async () => {
    const admin = mockAdmin({
      subscriptionRow: { tier: "starter", end_date: new Date(Date.now() + 86_400_000).toISOString() },
    });
    const check = await checkAiBudget(admin, "user-a");
    expect(check.tier).toBe("starter");
    expect(check.userLimit).toBe(5);
  });

  it("gives a pro subscriber the pro limit ($15)", async () => {
    const admin = mockAdmin({
      subscriptionRow: { tier: "pro", end_date: new Date(Date.now() + 86_400_000).toISOString() },
    });
    const check = await checkAiBudget(admin, "user-a");
    expect(check.tier).toBe("pro");
    expect(check.userLimit).toBe(15);
  });

  it("treats a pro subscription whose end_date has already passed as free (webhook hasn't caught up yet)", async () => {
    const admin = mockAdmin({
      subscriptionRow: { tier: "pro", end_date: new Date(Date.now() - 86_400_000).toISOString() },
    });
    const check = await checkAiBudget(admin, "user-a");
    expect(check.tier).toBe("free");
    expect(check.userLimit).toBe(1);
  });

  it("a starter subscriber is not blocked by spend that exceeds the free limit but not their own", async () => {
    const admin = mockAdmin({
      subscriptionRow: { tier: "starter", end_date: null },
      usageRows: [{ user_id: "user-a", cost_estimate: 2 }], // over free's $1, under starter's $5
    });
    const check = await checkAiBudget(admin, "user-a");
    expect(check.allowed).toBe(true);
  });
});

describe("recordAiUsage", () => {
  it("inserts one row with the user, source and cost", async () => {
    const admin = mockAdmin();
    await recordAiUsage(admin, "user-a", "novee-chat", 0.01);
    expect(admin._insert).toHaveBeenCalledWith({
      user_id: "user-a",
      source: "novee-chat",
      cost_estimate: 0.01,
    });
  });

  it("reports failure instead of silently discarding the insert error", async () => {
    // The original version awaited this insert and threw the result away, so a
    // missing `ai_usage_log` produced no signal anywhere: every budget read then
    // saw zero spend and the limits silently stopped applying. Whatever else
    // changes, this must not go back to being invisible.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const admin = mockAdmin();
    admin._insert.mockResolvedValue({ data: null, error: { message: "relation does not exist" } });
    const ok = await recordAiUsage(admin, "user-a", "content-pipeline", 0.05);
    expect(ok).toBe(false);
    expect(spy).toHaveBeenCalled();
    expect(String(spy.mock.calls[0].join(" "))).toMatch(/FAILED TO RECORD/i);
    spy.mockRestore();
  });
});

describe("degraded enforcement (the silent-no-op failure mode)", () => {
  function failingUsageAdmin() {
    const from = vi.fn((table: string) => {
      if (table === "project_settings") {
        return {
          select: () => ({
            single: async () => ({ data: { monthly_openai_budget: 50 }, error: null }),
          }),
        };
      }
      if (table === "subscriptions") {
        return {
          select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }),
        };
      }
      if (table === "ai_usage_log") {
        return {
          select: () => ({
            gte: async () => ({ data: null, error: { message: "permission denied for table ai_usage_log" } }),
          }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    return { from };
  }

  it("flags the check as degraded so an unenforced limit is visible, not silent", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const check = await checkAiBudget(failingUsageAdmin(), "user-a");
    // Fail-open on a read failure is deliberate (a cost control must not become a
    // product outage), but it must say so.
    expect(check.allowed).toBe(true);
    expect(check.degraded).toBe(true);
    expect(String(spy.mock.calls[0].join(" "))).toMatch(/NOT BEING ENFORCED/i);
    spy.mockRestore();
  });

  it("is not degraded on a healthy read", async () => {
    const check = await checkAiBudget(mockAdmin(), "user-a");
    expect(check.degraded).toBeUndefined();
  });

  it("still enforces the cap when the read succeeds", async () => {
    const check = await checkAiBudget(
      mockAdmin({ usageRows: [{ user_id: "user-a", cost_estimate: 5 }] }),
      "user-a",
    );
    expect(check.allowed).toBe(false);
    expect(check.degraded).toBeUndefined();
  });
});

describe("budgetExceededResponse", () => {
  it("gives a distinct message for the instance-wide limit vs. the per-user limit", () => {
    const instanceMsg = budgetExceededResponse({
      allowed: false, reason: "instance_budget_exceeded",
      instanceSpend: 50, instanceLimit: 50, userSpend: 1, userLimit: 5, tier: "starter",
    }).message;
    const userMsg = budgetExceededResponse({
      allowed: false, reason: "user_budget_exceeded",
      instanceSpend: 10, instanceLimit: 50, userSpend: 5, userLimit: 5, tier: "starter",
    }).message;
    expect(instanceMsg).not.toBe(userMsg);
    expect(instanceMsg).toMatch(/project.*owner/i);
    expect(userMsg).toMatch(/plan/i);
  });

  it("suggests upgrading for a free or starter user, but not a pro user already at the top tier", () => {
    const starterMsg = budgetExceededResponse({
      allowed: false, reason: "user_budget_exceeded",
      instanceSpend: 10, instanceLimit: 50, userSpend: 5, userLimit: 5, tier: "starter",
    }).message;
    const proMsg = budgetExceededResponse({
      allowed: false, reason: "user_budget_exceeded",
      instanceSpend: 10, instanceLimit: 50, userSpend: 15, userLimit: 15, tier: "pro",
    }).message;
    expect(starterMsg).toMatch(/upgrade/i);
    expect(proMsg).not.toMatch(/upgrade/i);
  });
});
