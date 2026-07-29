import { describe, it, expect } from "vitest";
import {
  computePlatformHealth,
  computeConnectedPlatformsCount,
  computeAutomationSuccessRate,
  computeDashboardTrends,
  computeDashboardGoals,
} from "./dashboardStats";
import type { Post } from "@/types";

function makePost(overrides: Partial<Post> & { platforms?: { platform: string }[] } = {}): Post {
  return {
    id: overrides.id ?? Math.random().toString(36),
    userId: "user-1",
    title: "Untitled",
    content: null,
    excerpt: null,
    status: "draft",
    type: "post" as any,
    scheduledAt: null,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    category: null,
    ...overrides,
  } as Post;
}

describe("computePlatformHealth", () => {
  it("excludes platforms with no posts", () => {
    const posts = [makePost({ platforms: [{ platform: "youtube" }] })];
    const result = computePlatformHealth(posts);
    expect(result.map((p) => p.key)).toEqual(["youtube"]);
  });

  it("computes queued count and publish percentage per platform", () => {
    const posts = [
      makePost({ status: "scheduled", platforms: [{ platform: "twitter" }] }),
      makePost({ status: "published", platforms: [{ platform: "twitter" }] }),
      makePost({ status: "draft", platforms: [{ platform: "twitter" }] }),
    ];
    const [twitter] = computePlatformHealth(posts);
    expect(twitter.queued).toBe(1);
    expect(twitter.pct).toBe(Math.round((1 / 3) * 100));
  });

  it("returns 0 pct when a platform has posts but none published", () => {
    const posts = [makePost({ status: "draft", platforms: [{ platform: "instagram" }] })];
    const [instagram] = computePlatformHealth(posts);
    expect(instagram.pct).toBe(0);
  });

  it("sorts by queued count descending", () => {
    const posts = [
      makePost({ status: "scheduled", platforms: [{ platform: "youtube" }] }),
      makePost({ status: "scheduled", platforms: [{ platform: "tiktok" }] }),
      makePost({ status: "scheduled", platforms: [{ platform: "tiktok" }] }),
    ];
    const result = computePlatformHealth(posts);
    expect(result[0].key).toBe("tiktok");
    expect(result[0].queued).toBe(2);
  });

  it("returns an empty array when there is no activity at all", () => {
    expect(computePlatformHealth([])).toEqual([]);
  });

  it("a post can count toward multiple platforms", () => {
    const posts = [
      makePost({
        status: "published",
        platforms: [{ platform: "linkedin" }, { platform: "facebook" }],
      }),
    ];
    const result = computePlatformHealth(posts);
    expect(result.map((p) => p.key).sort()).toEqual(["facebook", "linkedin"]);
  });
});

describe("computeConnectedPlatformsCount", () => {
  it("counts platforms present in user_platforms", () => {
    const count = computeConnectedPlatformsCount([{ platformType: "youtube" }, { platformType: "tiktok" }], () => false);
    expect(count).toBe(2);
  });

  it("counts direct-OAuth linkedin/twitter connections even without a user_platforms row", () => {
    const count = computeConnectedPlatformsCount([], (id) => id === "linkedin" || id === "twitter");
    expect(count).toBe(2);
  });

  it("does not double count a platform connected both ways", () => {
    const count = computeConnectedPlatformsCount([{ platformType: "twitter" }], (id) => id === "twitter");
    expect(count).toBe(1);
  });

  it("ignores direct-OAuth connection for platforms other than linkedin/twitter", () => {
    const count = computeConnectedPlatformsCount([], (id) => id === "youtube");
    expect(count).toBe(0);
  });

  it("returns 0 when nothing is connected", () => {
    expect(computeConnectedPlatformsCount([], () => false)).toBe(0);
  });
});

describe("computeAutomationSuccessRate", () => {
  it("returns null when there are no completed runs", () => {
    expect(computeAutomationSuccessRate([])).toBeNull();
    expect(computeAutomationSuccessRate([{ status: "running" }])).toBeNull();
  });

  it("computes the percentage of successful completed runs", () => {
    const runs = [{ status: "success" }, { status: "success" }, { status: "failed" }, { status: "running" }];
    expect(computeAutomationSuccessRate(runs)).toBe(Math.round((2 / 3) * 100));
  });

  it("is 0 when all completed runs failed", () => {
    expect(computeAutomationSuccessRate([{ status: "failed" }, { status: "failed" }])).toBe(0);
  });

  it("is 100 when all completed runs succeeded", () => {
    expect(computeAutomationSuccessRate([{ status: "success" }])).toBe(100);
  });
});

describe("computeDashboardTrends", () => {
  // 2026-07-15 is a Wednesday.
  const now = new Date(2026, 6, 15, 12, 0, 0);

  it("counts posts created this month vs last month", () => {
    const posts = [
      makePost({ createdAt: new Date(2026, 6, 1).toISOString() }), // this month
      makePost({ createdAt: new Date(2026, 5, 15).toISOString() }), // last month
      makePost({ createdAt: new Date(2026, 4, 1).toISOString() }), // two months ago — excluded
    ];
    const trends = computeDashboardTrends(posts, now);
    expect(trends.createdThisMonth).toBe(1);
    expect(trends.createdLastMonth).toBe(1);
    expect(trends.totalPostsTrendUp).toBe(true);
  });

  it("does not leak a post created on the last day of last month into this month", () => {
    const posts = [makePost({ createdAt: new Date(2026, 5, 30, 23, 59, 59).toISOString() })];
    const trends = computeDashboardTrends(posts, now);
    expect(trends.createdThisMonth).toBe(0);
    expect(trends.createdLastMonth).toBe(1);
  });

  it("totalPostsTrendUp is true when this month ties last month (0 vs 0)", () => {
    const trends = computeDashboardTrends([], now);
    expect(trends.createdThisMonth).toBe(0);
    expect(trends.createdLastMonth).toBe(0);
    expect(trends.totalPostsTrendUp).toBe(true);
  });

  it("counts published posts this week vs last week", () => {
    const posts = [
      makePost({ status: "published", publishedAt: new Date(2026, 6, 14).toISOString() }), // this week
      makePost({ status: "published", publishedAt: new Date(2026, 6, 7).toISOString() }), // last week
      makePost({ status: "published", publishedAt: new Date(2026, 5, 20).toISOString() }), // long ago — excluded
      makePost({ status: "draft", publishedAt: new Date(2026, 6, 14).toISOString() }), // not published — excluded
    ];
    const trends = computeDashboardTrends(posts, now);
    expect(trends.publishedThisWeek).toBe(1);
    expect(trends.publishedLastWeek).toBe(1);
  });

  it("counts posts scheduled (created) within the last 7 days", () => {
    const posts = [
      makePost({ status: "scheduled", createdAt: subDaysIso(now, 3) }),
      makePost({ status: "scheduled", createdAt: subDaysIso(now, 10) }), // outside window
      makePost({ status: "draft", createdAt: subDaysIso(now, 1) }), // not scheduled
    ];
    const trends = computeDashboardTrends(posts, now);
    expect(trends.scheduledThisWeek).toBe(1);
  });
});

function subDaysIso(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

describe("computeDashboardGoals", () => {
  const baseInput = {
    publishedThisMonth: 45,
    publishedLastMonth: 30,
    scheduledPosts: 10,
    scheduledThisWeek: 3,
    totalPosts: 100,
    publishedPosts: 60,
    activeAutomationsCount: 2,
    automationsCount: 4,
  };

  it("computes monthly output progress against the 90 target, capped at 100%", () => {
    const goals = computeDashboardGoals({ ...baseInput, publishedThisMonth: 200 });
    const monthly = goals.find((g) => g.key === "monthlyOutput")!;
    expect(monthly.pct).toBe(100);
  });

  it("reports a positive change when this month beats last month", () => {
    const goals = computeDashboardGoals(baseInput);
    const monthly = goals.find((g) => g.key === "monthlyOutput")!;
    expect(monthly.changeValue).toBe(15);
  });

  it("reports null change for monthly output when there was no data last month", () => {
    const goals = computeDashboardGoals({ ...baseInput, publishedLastMonth: 0 });
    const monthly = goals.find((g) => g.key === "monthlyOutput")!;
    expect(monthly.changeValue).toBeNull();
  });

  it("computes publish rate as published/total, 0 when there are no posts", () => {
    const goals = computeDashboardGoals({ ...baseInput, totalPosts: 0, publishedPosts: 0 });
    const rate = goals.find((g) => g.key === "publishRate")!;
    expect(rate.pct).toBe(0);
    expect(rate.value).toBe("0%");
  });

  it("computes automation coverage as active/total, 0 when there are no automations", () => {
    const goals = computeDashboardGoals({ ...baseInput, activeAutomationsCount: 0, automationsCount: 0 });
    const coverage = goals.find((g) => g.key === "automationCoverage")!;
    expect(coverage.pct).toBe(0);
    expect(coverage.value).toBe("0/0");
  });

  it("returns all four goal keys", () => {
    const goals = computeDashboardGoals(baseInput);
    expect(goals.map((g) => g.key)).toEqual(["monthlyOutput", "scheduledQueue", "publishRate", "automationCoverage"]);
  });
});
