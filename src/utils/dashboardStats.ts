import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subDays, subMonths } from "date-fns";
import type { Post } from "@/types";

const CORE_PLATFORM_IDS = ["youtube", "tiktok", "instagram", "twitter", "linkedin", "facebook"] as const;

export interface PlatformHealthEntry {
  key: string;
  queued: number;
  pct: number;
  hasActivity: boolean;
}

/**
 * Per-platform queued count and publish-success percentage, computed from
 * real posts. Only platforms with at least one post are returned, sorted by
 * queued count descending.
 */
export function computePlatformHealth(posts: Post[]): PlatformHealthEntry[] {
  return CORE_PLATFORM_IDS.map((key) => {
    const platformPosts = posts.filter((p) => (p as any).platforms?.some((pp: any) => pp.platform === key));
    const queued = platformPosts.filter((p) => p.status === "scheduled").length;
    const publishedCount = platformPosts.filter((p) => p.status === "published").length;
    const pct = platformPosts.length > 0 ? Math.round((publishedCount / platformPosts.length) * 100) : 0;
    return { key, queued, pct, hasActivity: platformPosts.length > 0 };
  })
    .filter((p) => p.hasActivity)
    .sort((a, b) => b.queued - a.queued);
}

/**
 * Count of core platforms the user has connected, via either a stored
 * user_platforms row or a direct-OAuth connection (linkedin/twitter only).
 */
export function computeConnectedPlatformsCount(
  userPlatforms: { platformType: string }[],
  isConnected: (id: string) => boolean
): number {
  return CORE_PLATFORM_IDS.filter(
    (id) =>
      userPlatforms.some((up) => up.platformType === id) ||
      ((id === "linkedin" || id === "twitter") && isConnected(id))
  ).length;
}

/**
 * Automation success rate as a percentage of completed (success or failed)
 * runs. Returns null when there are no completed runs yet, since 0% would
 * misleadingly imply failure rather than "no data".
 */
export function computeAutomationSuccessRate(automationRuns: { status: string }[]): number | null {
  const completedRuns = automationRuns.filter((r) => r.status === "success" || r.status === "failed");
  const successRuns = automationRuns.filter((r) => r.status === "success").length;
  return completedRuns.length > 0 ? Math.round((successRuns / completedRuns.length) * 100) : null;
}

export interface DashboardTrends {
  createdThisMonth: number;
  createdLastMonth: number;
  totalPostsTrendUp: boolean;
  publishedThisWeek: number;
  publishedLastWeek: number;
  publishedTrendUp: boolean;
  scheduledThisWeek: number;
  publishedThisMonth: number;
  publishedLastMonth: number;
}

/**
 * Month-over-month and week-over-week trend figures used by the dashboard
 * stat cards and goals. `now` is injected so this is deterministic and
 * testable rather than depending on the system clock.
 */
export function computeDashboardTrends(posts: Post[], now: Date): DashboardTrends {
  const startThisMonth = startOfMonth(now);
  const startLastMonth = startOfMonth(subMonths(now, 1));
  const endLastMonth = endOfMonth(subMonths(now, 1));

  const createdThisMonth = posts.filter((p) => p.createdAt && new Date(p.createdAt) >= startThisMonth).length;
  const createdLastMonth = posts.filter(
    (p) => p.createdAt && new Date(p.createdAt) >= startLastMonth && new Date(p.createdAt) <= endLastMonth
  ).length;
  const totalPostsTrendUp = createdThisMonth >= createdLastMonth;

  const startThisWeek = startOfWeek(now);
  const startLastWeek = startOfWeek(subDays(now, 7));
  const endLastWeek = endOfWeek(subDays(now, 7));

  const publishedThisWeek = posts.filter(
    (p) => p.status === "published" && p.publishedAt && new Date(p.publishedAt) >= startThisWeek
  ).length;
  const publishedLastWeek = posts.filter(
    (p) =>
      p.status === "published" &&
      p.publishedAt &&
      new Date(p.publishedAt) >= startLastWeek &&
      new Date(p.publishedAt) <= endLastWeek
  ).length;
  const publishedTrendUp = publishedThisWeek >= publishedLastWeek;

  const scheduledThisWeek = posts.filter(
    (p) => p.status === "scheduled" && p.createdAt && new Date(p.createdAt) >= subDays(now, 7)
  ).length;

  const publishedThisMonth = posts.filter(
    (p) => p.status === "published" && p.publishedAt && new Date(p.publishedAt) >= startThisMonth
  ).length;
  const publishedLastMonth = posts.filter(
    (p) =>
      p.status === "published" &&
      p.publishedAt &&
      new Date(p.publishedAt) >= startLastMonth &&
      new Date(p.publishedAt) <= endLastMonth
  ).length;

  return {
    createdThisMonth,
    createdLastMonth,
    totalPostsTrendUp,
    publishedThisWeek,
    publishedLastWeek,
    publishedTrendUp,
    scheduledThisWeek,
    publishedThisMonth,
    publishedLastMonth,
  };
}

export interface DashboardGoalInputs {
  publishedThisMonth: number;
  publishedLastMonth: number;
  scheduledPosts: number;
  scheduledThisWeek: number;
  totalPosts: number;
  publishedPosts: number;
  activeAutomationsCount: number;
  automationsCount: number;
}

export interface DashboardGoal {
  key: "monthlyOutput" | "scheduledQueue" | "publishRate" | "automationCoverage";
  value: string;
  targetValue: number;
  pct: number;
  changeValue: number | null;
}

/**
 * Numeric goal data (value/target/pct/change) with no i18n or presentation
 * baked in — callers translate `key`/`changeValue` into display strings.
 */
export function computeDashboardGoals(input: DashboardGoalInputs): DashboardGoal[] {
  const publishRatePct = input.totalPosts > 0 ? Math.round((input.publishedPosts / input.totalPosts) * 100) : 0;

  return [
    {
      key: "monthlyOutput",
      value: `${input.publishedThisMonth}`,
      targetValue: 90,
      pct: Math.min(100, Math.round((input.publishedThisMonth / 90) * 100)),
      changeValue: input.publishedLastMonth > 0 ? input.publishedThisMonth - input.publishedLastMonth : null,
    },
    {
      key: "scheduledQueue",
      value: `${input.scheduledPosts}`,
      targetValue: 20,
      pct: Math.min(100, Math.round((input.scheduledPosts / 20) * 100)),
      changeValue: input.scheduledThisWeek > 0 ? input.scheduledThisWeek : null,
    },
    {
      key: "publishRate",
      value: `${publishRatePct}%`,
      targetValue: 100,
      pct: publishRatePct,
      changeValue: null,
    },
    {
      key: "automationCoverage",
      value: `${input.activeAutomationsCount}/${input.automationsCount}`,
      targetValue: input.automationsCount,
      pct: input.automationsCount > 0 ? Math.round((input.activeAutomationsCount / input.automationsCount) * 100) : 0,
      changeValue: null,
    },
  ];
}
