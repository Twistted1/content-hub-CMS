import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDashboardStats } from "./useDashboardStats";
import { usePosts } from "@/hooks/usePosts";
import type { Post } from "@/types";

vi.mock("@/hooks/usePosts", () => ({
  usePosts: vi.fn(),
}));

function mockPosts(posts: Partial<Post>[], isLoading = false) {
  vi.mocked(usePosts).mockReturnValue({
    posts: posts as Post[],
    isLoading,
  } as unknown as ReturnType<typeof usePosts>);
}

describe("useDashboardStats", () => {
  it("returns all-zero stats when there are no posts", () => {
    mockPosts([]);
    const { result } = renderHook(() => useDashboardStats());
    expect(result.current.totalPosts).toBe(0);
    expect(result.current.platformBreakdown).toEqual([]);
    expect(result.current.recentActivity).toEqual([]);
  });

  it("counts posts by status", () => {
    mockPosts([
      { status: "published", createdAt: new Date().toISOString() },
      { status: "scheduled", createdAt: new Date().toISOString() },
      { status: "scheduled", createdAt: new Date().toISOString() },
      { status: "draft", createdAt: new Date().toISOString() },
    ]);
    const { result } = renderHook(() => useDashboardStats());
    expect(result.current.totalPosts).toBe(4);
    expect(result.current.publishedPosts).toBe(1);
    expect(result.current.scheduledPosts).toBe(2);
    expect(result.current.draftPosts).toBe(1);
  });

  it("builds a platform breakdown sorted by count descending", () => {
    mockPosts([
      { createdAt: new Date().toISOString(), platforms: [{ platform: "twitter" } as any] },
      { createdAt: new Date().toISOString(), platforms: [{ platform: "twitter" } as any] },
      { createdAt: new Date().toISOString(), platforms: [{ platform: "linkedin" } as any] },
    ]);
    const { result } = renderHook(() => useDashboardStats());
    expect(result.current.platformBreakdown).toEqual([
      { name: "Twitter", count: 2, change: 0, positive: true },
      { name: "Linkedin", count: 1, change: 0, positive: true },
    ]);
  });

  it("builds 7 days of recent activity ending today, with today's posts included", () => {
    const now = new Date();
    mockPosts([{ status: "published", createdAt: now.toISOString() }]);
    const { result } = renderHook(() => useDashboardStats());
    expect(result.current.recentActivity).toHaveLength(7);
    const today = result.current.recentActivity[result.current.recentActivity.length - 1];
    expect(today.posts).toBe(1);
    expect(today.published).toBe(1);
  });

  it("excludes a post created exactly at the start of the following day", () => {
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
    mockPosts([{ status: "draft", createdAt: startOfTomorrow.toISOString() }]);
    const { result } = renderHook(() => useDashboardStats());
    const totalCounted = result.current.recentActivity.reduce((sum, d) => sum + d.posts, 0);
    expect(totalCounted).toBe(0);
  });

  it("passes through the isLoading flag from usePosts", () => {
    mockPosts([], true);
    const { result } = renderHook(() => useDashboardStats());
    expect(result.current.isLoading).toBe(true);
  });
});
