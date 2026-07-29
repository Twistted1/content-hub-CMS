import { useMemo } from "react";
import { usePosts } from "@/hooks/usePosts";
import { subDays, format } from "date-fns";

interface DashboardStats {
  totalPosts: number;
  publishedPosts: number;
  scheduledPosts: number;
  draftPosts: number;
  platformBreakdown: { name: string; count: number; change: number; positive: boolean }[];
  recentActivity: { day: string; posts: number; published: number }[];
  isLoading: boolean;
}

export function useDashboardStats(): DashboardStats {
  const { posts, isLoading } = usePosts();

  return useMemo(() => {
    if (!posts || posts.length === 0) {
      return {
        totalPosts: 0,
        publishedPosts: 0,
        scheduledPosts: 0,
        draftPosts: 0,
        platformBreakdown: [],
        recentActivity: [],
        isLoading,
      };
    }

    const now = new Date();
    const totalPosts = posts.length;
    const publishedPosts = posts.filter(p => p.status === "published").length;
    const scheduledPosts = posts.filter(p => p.status === "scheduled").length;
    const draftPosts = posts.filter(p => p.status === "draft").length;

    // Platform breakdown from post_platforms
    const platformCounts = new Map<string, number>();
    posts.forEach(p => {
      const platforms = (p as any).platforms || [];
      platforms.forEach((pp: any) => {
        const name = pp.platform;
        platformCounts.set(name, (platformCounts.get(name) || 0) + 1);
      });
    });

    const platformBreakdown = Array.from(platformCounts.entries())
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
        change: 0,
        positive: true,
      }))
      .sort((a, b) => b.count - a.count);

    // Recent activity - last 7 days
    const recentActivity = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(now, i);
      const dayStr = format(day, "EEE");
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);

      const dayPosts = posts.filter(p => {
        const created = new Date(p.createdAt);
        return created >= dayStart && created < dayEnd;
      });

      const dayPublished = dayPosts.filter(p => p.status === "published").length;
      recentActivity.push({ day: dayStr, posts: dayPosts.length, published: dayPublished });
    }

    return {
      totalPosts,
      publishedPosts,
      scheduledPosts,
      draftPosts,
      platformBreakdown,
      recentActivity,
      isLoading,
    };
  }, [posts, isLoading]);
}
