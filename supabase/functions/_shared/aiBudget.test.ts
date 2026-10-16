import { describe, it, expect, vi } from "vitest";
import { checkAiBudget, recordAiUsage, budgetExceededResponse } from "./aiBudget";

/**
 * `aiBudget.ts` has no Deno-only APIs (just `admin` duck-typed as a Supabase
 * client), so it's testable here under vitest even though the edge functions
 * that call it run under Deno — same reasoning as the rest of this project's
 * `_shared` modules.
 */

function mockAdmin({
  settingsRow = { monthly_openai_budget: 50, per_user_monthly_budget: 5 },
  usageRows = [] as Array<{ user_id: string; cost_estimate: number }>,
} = {}) {
  const insert = vi.fn().mockResolvedValue({ data: null, error: null });
  const from = vi.fn((table: string) => {
    if (table === "project_settings") {
      return { select: () => ({ single: async () => ({ data: settingsRow }) }) };
    }
    if (table === "ai_usage_log") {
      return {
        select: () => ({ gte: async () => ({ data: usageRows }) }),
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
    expect(check.userLimit).toBe(5);
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
});

describe("budgetExceededResponse", () => {
  it("gives a distinct message for the instance-wide limit vs. the per-user limit", () => {
    const instanceMsg = budgetExceededResponse({
      allowed: false, reason: "instance_budget_exceeded",
      instanceSpend: 50, instanceLimit: 50, userSpend: 1, userLimit: 5,
    }).message;
    const userMsg = budgetExceededResponse({
      allowed: false, reason: "user_budget_exceeded",
      instanceSpend: 10, instanceLimit: 50, userSpend: 5, userLimit: 5,
    }).message;
    expect(instanceMsg).not.toBe(userMsg);
    expect(instanceMsg).toMatch(/project.*owner/i);
    expect(userMsg).toMatch(/personal/i);
  });
});
