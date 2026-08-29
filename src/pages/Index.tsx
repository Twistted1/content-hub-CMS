import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { usePosts } from "@/hooks/usePosts";
import { useAuth } from "@/hooks/useAuth";
import { useAutomations } from "@/hooks/useAutomations";
import { useNotes } from "@/hooks/useNotes";
import { usePlatforms } from "@/hooks/usePlatforms";
import { usePlatformOAuth, DirectPlatform } from "@/hooks/usePlatformOAuth";
import {
  format, subDays, isToday, isSameDay,
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
} from "date-fns";
import {
  computePlatformHealth,
  computeConnectedPlatformsCount,
  computeAutomationSuccessRate,
  computeDashboardTrends,
  computeDashboardGoals,
} from "@/utils/dashboardStats";
import {
  Plus, Eye, Zap, TrendingUp, TrendingDown, FileText, Calendar, Clock,
  Youtube, Instagram, Twitter, Linkedin, Facebook, Globe, Music2,
  CheckCircle2, BarChart3, ArrowRight, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useUserPreferencesStore } from "@/stores/useUserPreferencesStore";

// ── Platform config ────────────────────────────────────────────────────────────
const PLATFORM_CFG: Record<string, { Icon: any; color: string; bar: string; hex: string; label: string }> = {
  youtube:   { Icon: Youtube,   color: "text-red-500",     bar: "bg-red-500",     hex: "#ef4444", label: "YouTube" },
  tiktok:    { Icon: Music2,    color: "text-pink-400",    bar: "bg-pink-400",    hex: "#f472b6", label: "TikTok" },
  instagram: { Icon: Instagram, color: "text-fuchsia-400", bar: "bg-fuchsia-400", hex: "#e879f9", label: "Instagram" },
  twitter:   { Icon: Twitter,   color: "text-sky-400",     bar: "bg-sky-400",     hex: "#38bdf8", label: "X (Twitter)" },
  x:         { Icon: Twitter,   color: "text-sky-400",     bar: "bg-sky-400",     hex: "#38bdf8", label: "X (Twitter)" },
  linkedin:  { Icon: Linkedin,  color: "text-blue-500",    bar: "bg-blue-500",    hex: "#3b82f6", label: "LinkedIn" },
  facebook:  { Icon: Facebook,  color: "text-blue-600",    bar: "bg-blue-600",    hex: "#2563eb", label: "Facebook" },
  website:   { Icon: Globe,     color: "text-emerald-400", bar: "bg-emerald-400", hex: "#34d399", label: "Website" },
};

// ── Heatmap builder ────────────────────────────────────────────────────────────
const HEAT_COLORS = ["bg-foreground/5", "bg-emerald-900/60", "bg-emerald-700/70", "bg-emerald-500/80", "bg-emerald-400"];
function heatColor(n: number) {
  if (n === 0) return HEAT_COLORS[0];
  if (n === 1) return HEAT_COLORS[1];
  if (n === 2) return HEAT_COLORS[2];
  if (n <= 4)  return HEAT_COLORS[3];
  return HEAT_COLORS[4];
}
function buildHeatmap(posts: any[]) {
  const days = 84; // 12 weeks
  return Array.from({ length: days }, (_, i) => {
    const date = subDays(new Date(), days - 1 - i);
    const count = posts.filter(p => {
      const d = p.scheduledAt ? new Date(p.scheduledAt) : new Date(p.createdAt);
      return isSameDay(d, date);
    }).length;
    return { date, count };
  });
}

// ── Mini Calendar ──────────────────────────────────────────────────────────────
function MiniCalendar({ posts }: { posts: any[] }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(new Date());
  const calDays = eachDayOfInterval({
    start: startOfWeek(startOfMonth(current)),
    end: endOfWeek(endOfMonth(current)),
  });
  const hasSched = (day: Date) =>
    posts.some(p => p.scheduledAt && isSameDay(new Date(p.scheduledAt), day));

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={() => setCurrent(d => { const n = new Date(d); n.setMonth(d.getMonth() - 1); return n; })}
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
        >‹</button>
        <span className="text-xs font-black text-foreground uppercase tracking-wider">{format(current, "MMMM yyyy")}</span>
        <button
          onClick={() => setCurrent(d => { const n = new Date(d); n.setMonth(d.getMonth() + 1); return n; })}
          className="w-6 h-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted"
        >›</button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {(t("dashboard.home.weekdayInitials", { returnObjects: true }) as string[]).map((d, i) => (
          <div key={i} className="text-center text-[9px] font-black text-muted-foreground py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {calDays.map((day, i) => {
          const inMonth = day.getMonth() === current.getMonth();
          const today   = isToday(day);
          const sched   = hasSched(day);
          return (
            <div key={i} className={cn(
              "relative flex items-center justify-center w-7 h-7 mx-auto rounded-md text-[10px] font-semibold",
              today   ? "bg-primary text-primary-foreground font-black"
                      : inMonth ? "text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
                                : "text-muted-foreground/30"
            )}>
              {format(day, "d")}
              {sched && !today && (
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-success" />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/40 flex-wrap">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success inline-block" /><span className="text-[9px] text-muted-foreground">{t("dashboard.home.calendarScheduled")}</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warn inline-block" /><span className="text-[9px] text-muted-foreground">{t("dashboard.home.highVolume")}</span></div>
      </div>
    </div>
  );
}

// ── Stat Card ──────────────────────────────────────────────────────────────────
function StatCard({ title, value, badge, sub, trendUp, color }: {
  title: string; value: string | number; badge: string;
  sub?: string; trendUp?: boolean; color?: string;
}) {
  return (
    <div className="glass-card p-6 flex flex-col gap-4 hover:border-primary/40 transition-all duration-300 group">
      <div className="flex items-center justify-between">
        <Badge variant="outline" className="text-[10px] font-black uppercase tracking-[0.15em] bg-foreground/[0.07] border-foreground/[0.16] text-muted-foreground/60 py-1 px-3 rounded-xl">{badge}</Badge>
        <div className={cn("w-2 h-2 rounded-full animate-pulse shadow-[0_0_8px]", trendUp ? "bg-success shadow-success/50" : "bg-destructive shadow-destructive/50")} />
      </div>
      <div>
        <p className={cn("text-4xl font-black tracking-tighter mb-1", color ?? "text-foreground")}>{value}</p>
        <p className="text-[11px] text-muted-foreground font-black uppercase tracking-widest opacity-60">{title}</p>
      </div>
      {sub && (
        <div className={cn("flex items-center gap-2 text-[10px] font-black uppercase tracking-wider", trendUp ? "text-success" : "text-destructive")}>
          <div className={cn("p-1 rounded-lg", trendUp ? "bg-success/10" : "bg-destructive/10")}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          </div>
          <span>{sub}</span>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
const Index = () => {
  const { t } = useTranslation();
  const stats      = useDashboardStats();
  const { posts }  = usePosts();
  const { user }   = useAuth();
  const { profile } = useUserPreferencesStore();
  const { automations, automationRuns } = useAutomations();
  const { notes }  = useNotes();
  const { platforms: userPlatforms } = usePlatforms();
  const { isConnected } = usePlatformOAuth();
  const navigate   = useNavigate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const hour     = now.getHours();
  const greeting = hour < 12 ? t("dashboard.greeting.morning") : hour < 17 ? t("dashboard.greeting.afternoon") : t("dashboard.greeting.evening");
  const userName = profile.name || user?.email?.split("@")[0] || "Admin";
  const dayLabel = format(now, "EEEE, MMMM d, yyyy").toUpperCase();

  // Today's queue
  const todayQueue = posts
    .filter(p => p.scheduledAt && isToday(new Date(p.scheduledAt)))
    .sort((a, b) => new Date(a.scheduledAt!).getTime() - new Date(b.scheduledAt!).getTime());

  // Platform breakdown for donut
  const platMap: Record<string, number> = {};
  posts.forEach(p =>
    (p as any).platforms?.forEach((pp: any) => {
      platMap[pp.platform] = (platMap[pp.platform] || 0) + 1;
    })
  );
  const platSlices = Object.entries(platMap).map(([k, v]) => ({
    name: PLATFORM_CFG[k]?.label ?? k,
    value: v,
    hex:   PLATFORM_CFG[k]?.hex ?? "#6366f1",
  }));

  // Activity chart — last 30 days
  const chartData = Array.from({ length: 30 }, (_, i) => {
    const d = subDays(now, 29 - i);
    return {
      label: format(d, "d"),
      Published: posts.filter(p => p.publishedAt && isSameDay(new Date(p.publishedAt), d)).length,
      Scheduled: posts.filter(p => p.scheduledAt && isSameDay(new Date(p.scheduledAt), d)).length,
      Drafts:    posts.filter(p => p.status === "draft" && isSameDay(new Date(p.createdAt), d)).length,
    };
  });

  // Heatmap
  const heatCells = buildHeatmap(posts);
  const heatWeeks: typeof heatCells[] = [];
  for (let i = 0; i < heatCells.length; i += 7) heatWeeks.push(heatCells.slice(i, i + 7));

  // Platform health, connection count, automation success rate, and
  // month/week trend math live in src/utils/dashboardStats.ts so they're
  // unit-testable without mounting this component.
  const platformHealth = computePlatformHealth(posts);
  const connectedPlatformsCount = computeConnectedPlatformsCount(userPlatforms, (id) => isConnected(id as DirectPlatform));
  const autoSuccessRate = computeAutomationSuccessRate(automationRuns);
  const completedAutomationRunsCount = automationRuns.filter(
    (r) => r.status === "success" || r.status === "failed"
  ).length;
  const activeAutomationsCount = automations.filter((a: any) => a.status === "active").length;

  const {
    totalPostsTrendUp,
    publishedTrendUp,
    scheduledThisWeek,
    publishedThisMonth,
    publishedLastMonth,
  } = computeDashboardTrends(posts, now);

  const publishRatePct = stats.totalPosts > 0 ? Math.round((stats.publishedPosts / stats.totalPosts) * 100) : 0;

  // Goals — all derived from real posts/automations data, no fabricated numbers
  const goalValues = computeDashboardGoals({
    publishedThisMonth,
    publishedLastMonth,
    scheduledPosts: stats.scheduledPosts,
    scheduledThisWeek,
    totalPosts: stats.totalPosts,
    publishedPosts: stats.publishedPosts,
    activeAutomationsCount,
    automationsCount: automations.length,
  });
  const goalLabels: Record<typeof goalValues[number]["key"], { label: string; target: string; color: string }> = {
    monthlyOutput: { label: t("dashboard.home.goalMonthlyOutput"), target: `90 ${t("dashboard.home.postsLower")}`, color: "bg-success" },
    scheduledQueue: { label: t("dashboard.home.goalScheduledQueue"), target: `20 ${t("dashboard.home.postsLower")}`, color: "bg-info" },
    publishRate: { label: t("dashboard.home.goalPublishRate"), target: "100%", color: "bg-brand-accent" },
    automationCoverage: { label: t("dashboard.home.goalAutomationCoverage"), target: t("dashboard.home.automationsCount", { count: automations.length }), color: "bg-warn" },
  };
  const goals = goalValues.map((g) => ({
    label: goalLabels[g.key].label,
    value: g.value,
    target: goalLabels[g.key].target,
    pct: g.pct,
    change:
      g.changeValue === null
        ? ""
        : g.key === "monthlyOutput"
        ? `${g.changeValue >= 0 ? "+" : ""}${g.changeValue} ${t("dashboard.home.postsLower")}`
        : g.key === "scheduledQueue"
        ? t("dashboard.home.addedThisWeek", { count: g.changeValue })
        : "",
    color: goalLabels[g.key].color,
  }));

  // Activity feed
  const activityFeed = posts.slice(0, 5).map((p, i) => ({
    text: p.status === "published"
      ? `${(p as any).platforms?.[0]?.platform ?? "Post"} ${t("dashboard.home.publishedSuccessfully")}`
      : p.status === "scheduled"
      ? `${(p as any).platforms?.[0]?.platform ?? "Post"} ${t("dashboard.home.scheduledLower")}`
      : `${p.title.slice(0, 28)}… ${t("dashboard.home.draftSaved")}`,
    ago:    `${i * 8 + 2}${t("dashboard.home.minAgo")}`,
    status: p.status as string,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">

        {/* ── Greeting Banner ─────────────────────────────────────────── */}
        <div className="relative overflow-hidden rounded-[2.5rem] glass-card p-10 group">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-transparent to-blue-600/10 opacity-50" />
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/20 blur-[100px] rounded-full animate-pulse" />
          
          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <span className="h-[1px] w-8 bg-primary/50" />
                <p className="text-[11px] font-black uppercase tracking-[0.4em] text-primary">{dayLabel}</p>
              </div>
              <h1 className="text-3xl font-black tracking-tighter text-foreground mb-4 leading-[0.9]">
                {greeting},<br />
                <span className="head-neon">{userName.charAt(0).toUpperCase() + userName.slice(1)}</span> 👋
              </h1>
              <div className="flex items-center gap-6 mt-6">
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-foreground/50 uppercase tracking-widest mb-1">{t("dashboard.home.todaysPulse")}</span>
                  <p className="text-sm text-foreground font-bold">
                    <span className="text-primary">{todayQueue.length}</span> {t("dashboard.home.itemsInQueueSuffix")}
                  </p>
                </div>
                <div className="w-[1px] h-8 bg-foreground/10" />
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-foreground/50 uppercase tracking-widest mb-1">{t("dashboard.home.strategyHealth")}</span>
                  <p className="text-sm text-foreground font-bold">
                    <span className="text-success">{stats.scheduledPosts}</span> {t("dashboard.home.readyToDeploySuffix")}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch gap-4 shrink-0">
              <Button onClick={() => navigate("/calendar")} className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[11px] tracking-[0.2em] gap-3 px-8 py-7 rounded-2xl shadow-2xl shadow-primary/40 group active:scale-95 transition-all">
                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" /> {t("dashboard.home.newCampaign")}
              </Button>
              <Button onClick={() => navigate("/pipeline")} variant="outline" className="bg-foreground/[0.07] border-foreground/[0.20] hover:bg-foreground/[0.12] text-foreground font-black uppercase text-[11px] tracking-[0.2em] gap-3 px-8 py-7 rounded-2xl backdrop-blur-xl active:scale-95 transition-all">
                <Eye className="w-5 h-5" /> {t("dashboard.home.reviseQueue")}
              </Button>
            </div>
          </div>
        </div>

        {/* ── 6 Stat Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title={t("dashboard.stats.totalPosts")}  value={stats.totalPosts}    badge={t("dashboard.home.totalPostsBadge")}   sub={t("dashboard.home.vsLastMonth")} trendUp={totalPostsTrendUp}  color="text-foreground" />
          <StatCard title={t("dashboard.home.scheduled")}    value={stats.scheduledPosts} badge={t("dashboard.home.scheduledBadge")}  sub={t("dashboard.home.todayCount", { count: todayQueue.length })} trendUp color="text-info" />
          <StatCard title={t("dashboard.home.drafts")}       value={stats.draftPosts}    badge={t("dashboard.home.draftsBadge")} sub={stats.draftPosts > 0 ? t("dashboard.home.needReview", { count: stats.draftPosts }) : t("dashboard.home.allClear")} color="text-warn" />
          <StatCard title={t("dashboard.stats.publishedPosts")}    value={stats.publishedPosts} badge={t("dashboard.home.publishedBadge")} sub={t("dashboard.home.vsLastWeek")} trendUp={publishedTrendUp} color="text-success" />
          <StatCard title={t("dashboard.home.connectedPlatforms")} value={connectedPlatformsCount} badge={t("dashboard.home.platformsBadge")} color="text-brand-accent" />
          <StatCard title={t("dashboard.home.autoSuccess")} value={autoSuccessRate !== null ? `${autoSuccessRate}%` : "—"} badge={t("dashboard.home.liveBadge")} sub={completedAutomationRunsCount > 0 ? t("dashboard.home.runsCount", { count: completedAutomationRunsCount }) : t("dashboard.home.noRunsYet")} trendUp={autoSuccessRate !== null ? autoSuccessRate >= 80 : undefined} color="text-primary" />
        </div>

        {/* ── Activity Chart + Platform Health ────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-xl font-black text-foreground tracking-tight uppercase head-neon">{t("dashboard.home.velocityInsights")}</h2>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-1 opacity-50">{t("dashboard.home.growthTrajectory")}</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mb-3">
              {[[t("dashboard.home.published"),"bg-success"],[t("dashboard.home.scheduled"),"bg-info"],[t("dashboard.home.drafts"),"bg-brand-accent"]].map(([l,c]) => (
                <div key={l} className="flex items-center gap-1.5">
                  <span className={cn("w-3 h-1 rounded-full inline-block", c)} />
                  <span className="text-[10px] text-muted-foreground">{l}</span>
                </div>
              ))}
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={chartData} margin={{ left: -20, right: 0, top: 5, bottom: 0 }}>
                <defs>
                  <linearGradient id="gP" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#34d399" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gS" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#60a5fa" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="gD" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#a78bfa" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 11, color: "hsl(var(--popover-foreground))" }} itemStyle={{ color: "hsl(var(--popover-foreground))" }} labelStyle={{ color: "hsl(var(--popover-foreground))" }} />
                <Area type="monotone" dataKey="Published" stroke="#34d399" strokeWidth={2} fill="url(#gP)" dot={false} />
                <Area type="monotone" dataKey="Scheduled" stroke="#60a5fa" strokeWidth={2} fill="url(#gS)" dot={false} />
                <Area type="monotone" dataKey="Drafts"    stroke="#a78bfa" strokeWidth={2} fill="url(#gD)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-black text-foreground tracking-tight uppercase">{t("dashboard.home.platformHealth")}</h2>
              <button onClick={() => navigate("/platforms")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-foreground/[0.07] border border-foreground/[0.16] hover:bg-foreground/[0.12] text-primary transition-all">
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {platformHealth.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground opacity-60">
                  <BarChart3 className="w-10 h-10 mb-3 opacity-20" />
                  <p className="text-[10px] font-black uppercase tracking-widest text-center">{t("dashboard.home.noHealthData")}</p>
                </div>
              )}
              {platformHealth.map(({ key, queued, pct }) => {
                const cfg = PLATFORM_CFG[key];
                if (!cfg) return null;
                const { Icon, color, bar } = cfg;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <Icon className={cn("w-4 h-4 shrink-0", color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-bold text-foreground">{cfg.label}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-[9px] text-muted-foreground">{t("dashboard.home.queued", { count: queued })}</span>
                          <span className={cn("text-[10px] font-black", pct >= 90 ? "text-success" : pct >= 70 ? "text-warn" : "text-destructive")}>{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full dynamic-fill-bar", bar)} ref={(el) => { if (el) el.style.width = `${pct}%`; }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Distribution + Today's Queue + Mini Calendar ─────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Distribution donut */}
          <div className="glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-black text-foreground tracking-tight uppercase">{t("dashboard.home.distribution")}</h2>
              <button onClick={() => navigate("/analytics")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-foreground/[0.07] border border-foreground/[0.16] hover:bg-foreground/[0.12] text-primary transition-all">
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            {platSlices.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={160}>
                  <PieChart>
                    <Pie data={platSlices} cx="50%" cy="50%" innerRadius={45} outerRadius={65} dataKey="value" strokeWidth={4} stroke="rgba(0,0,0,0.5)">
                      {platSlices.map((s, i) => <Cell key={i} fill={s.hex} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-3 mt-6">
                  {platSlices.map(s => (
                    <div key={s.name} className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider">
                      <div className="flex items-center gap-3">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 shadow-[0_0_10px]" style={{ backgroundColor: s.hex, boxShadow: `0 0 10px ${s.hex}66` }} />
                        <span className="text-muted-foreground/80">{s.name}</span>
                      </div>
                      <span className="text-foreground">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-60">
                <BarChart3 className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">{t("dashboard.home.noData")}</p>
              </div>
            )}
          </div>

          {/* Today's Queue */}
          <div className="glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Clock className="w-5 h-5 text-primary" />
                </div>
                <h2 className="text-lg font-black text-foreground tracking-tight uppercase">{t("dashboard.home.todaysQueueTitle")}</h2>
              </div>
              <button onClick={() => navigate("/pipeline")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-foreground/[0.07] border border-foreground/[0.16] hover:bg-foreground/[0.12] text-primary transition-all">
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            {todayQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-60">
                <Calendar className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest">{t("dashboard.home.quietCycles")}</p>
                <button onClick={() => navigate("/calendar")} className="mt-4 text-[10px] font-black text-primary hover:underline uppercase tracking-widest">{t("dashboard.home.initialize")}</button>
              </div>
            ) : (
              <div className="space-y-4">
                {todayQueue.slice(0, 8).map((post: any) => {
                  const plat   = post.platforms?.[0]?.platform ?? "website";
                  const cfg    = PLATFORM_CFG[plat];
                  const Icon   = cfg?.Icon ?? Globe;
                  const timeStr = post.scheduledAt ? format(new Date(post.scheduledAt), "HH:mm") : "--:--";
                  const sc = post.status === "scheduled" ? "text-success bg-success/10 border-success/20"
                           : post.status === "draft"     ? "text-warn bg-warn/10 border-warn/20"
                           : "text-info bg-info/10 border-info/20";
                  return (
                    <div key={post.id} className="flex items-center gap-4 group cursor-pointer">
                      <span className="text-[10px] font-black text-muted-foreground w-10 shrink-0 tabular-nums opacity-60 group-hover:opacity-100 transition-opacity">{timeStr}</span>
                      <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center bg-foreground/[0.07] border border-foreground/[0.16] group-hover:border-primary/40 transition-all", cfg?.color ?? "text-muted-foreground")}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <span className="text-xs text-foreground flex-1 truncate font-bold group-hover:text-primary transition-colors">{post.title}</span>
                      <span className={cn("text-[8px] font-black uppercase px-2 py-1 rounded-lg border shrink-0 tracking-widest", sc)}>
                        {post.status === "scheduled" ? t("dashboard.home.scheduled") : post.status.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mini Calendar */}
          <div className="glass-card p-8">
            <div className="flex items-center gap-3 mb-8">
              <div className="p-2 rounded-xl bg-info/10">
                <Calendar className="w-5 h-5 text-info" />
              </div>
              <h2 className="text-lg font-black text-foreground tracking-tight uppercase">{t("dashboard.home.orchestrator")}</h2>
            </div>
            <MiniCalendar posts={posts} />
          </div>
        </div>

        {/* ── Heatmap + Activity Feed ──────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-black text-foreground tracking-tight uppercase">{t("dashboard.home.deploymentIntensity")}</h2>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-1 opacity-50">{t("dashboard.home.publishingMatrix")}</p>
              </div>
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-muted-foreground/60">
                <span>{t("dashboard.home.low")}</span>
                <div className="flex gap-1 px-2">
                  {HEAT_COLORS.map((c, i) => <span key={i} className={cn("w-3 h-3 rounded-[3px] inline-block", c)} />)}
                </div>
                <span>{t("dashboard.home.peak")}</span>
              </div>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
              {heatWeeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1.5 shrink-0">
                  {week.map((day, di) => (
                    <div key={di} title={`${format(day.date, "MMM d")}: ${day.count} ${t("dashboard.home.postsLower")}`}
                      className={cn("w-4 h-4 rounded-[4px] hover:ring-2 hover:ring-primary/50 transition-all cursor-crosshair", heatColor(day.count))} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-lg font-black text-foreground tracking-tight uppercase">{t("dashboard.home.liveStream")}</h2>
              <div className="flex items-center gap-3 px-4 py-1.5 rounded-full bg-success/10 border border-success/20 shadow-[0_0_15px_rgba(52,211,153,0.1)]">
                <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-[10px] font-black text-success uppercase tracking-[0.2em]">{t("dashboard.home.liveStatus")}</span>
              </div>
            </div>
            <div className="space-y-6">
              {activityFeed.length === 0 ? (
                <p className="text-xs text-muted-foreground opacity-60 text-center py-10 uppercase tracking-widest font-black">{t("dashboard.home.noRecentActivity")}</p>
              ) : activityFeed.map((item, i) => (
                <div key={i} className="flex items-start gap-5 group">
                  <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 border transition-all",
                    item.status === "published" ? "bg-success/10 border-success/20 text-success" :
                    item.status === "scheduled" ? "bg-info/10 border-info/20 text-info" : "bg-warn/10 border-warn/20 text-warn"
                  )}>
                    {item.status === "published" ? <CheckCircle2 className="w-5 h-5" />
                     : item.status === "scheduled" ? <Clock className="w-5 h-5" />
                     : <FileText className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-bold group-hover:text-primary transition-colors leading-tight">{item.text}</p>
                    <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1.5 opacity-50">{item.ago}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Recent Posts + Quick Notes ───────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-foreground">{t("dashboard.home.recentPostsTitle")}</h2>
              <button onClick={() => navigate("/articles")} className="text-[10px] font-black text-primary hover:underline flex items-center gap-1">{t("dashboard.home.viewAll")} <ArrowRight className="w-3 h-3" /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {[t("dashboard.home.tableContent"), t("dashboard.home.tablePlatform"), t("dashboard.home.tableStatus"), t("dashboard.home.tableDate")].map(h => (
                      <th key={h} className="pb-2 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {posts.length === 0 ? (
                    <tr><td colSpan={4} className="py-6 text-center text-muted-foreground text-xs">{t("dashboard.home.noPostsYet")}</td></tr>
                  ) : posts.slice(0, 6).map(post => {
                    const plat = (post as any).platforms?.[0]?.platform ?? "website";
                    const cfg  = PLATFORM_CFG[plat];
                    const sc   = post.status === "published" ? "text-success"
                               : post.status === "scheduled" ? "text-info" : "text-warn";
                    return (
                      <tr key={post.id} className="hover:bg-muted/20 transition-colors">
                        <td className="py-2.5 pr-3"><span className="text-foreground font-medium truncate max-w-[140px] block">{post.title}</span></td>
                        <td className="py-2.5 pr-3">
                          <span className={cn("text-[10px] font-black px-2 py-0.5 rounded-md bg-muted/50", cfg?.color ?? "text-muted-foreground")}>
                            {cfg?.label ?? plat}
                          </span>
                        </td>
                        <td className={cn("py-2.5 pr-3 font-black capitalize", sc)}>{post.status}</td>
                        <td className="py-2.5 text-muted-foreground">{format(new Date(post.createdAt), "MMM d")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-foreground">{t("dashboard.home.quickNotesTitle")}</h2>
              <button onClick={() => navigate("/notes")} className="text-[10px] font-black text-primary hover:underline flex items-center gap-1">{t("dashboard.home.viewAll")} <ArrowRight className="w-3 h-3" /></button>
            </div>
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t("dashboard.home.noNotesYet")}</p>
            ) : notes.slice(0, 4).map((note: any) => (
              <div key={note.id} className="p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer mb-2">
                <p className="text-xs font-bold text-foreground">{note.title}</p>
                {note.content && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{note.content}</p>}
              </div>
            ))}
            <button onClick={() => navigate("/notes")} className="w-full py-2 border border-dashed border-border/50 rounded-xl text-[10px] font-black text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors mt-1">
              {t("dashboard.home.addNote")}
            </button>
          </div>
        </div>

        {/* ── Goals & KPIs + Automation Status ────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-black text-foreground tracking-tight uppercase">{t("dashboard.home.strategicTargets")}</h2>
                <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] mt-1 opacity-50">{t("dashboard.home.benchmarks")}</p>
              </div>
              <button onClick={() => navigate("/analytics")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-foreground/[0.07] border border-foreground/[0.16] hover:bg-foreground/[0.12] text-primary transition-all">
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {goals.map(g => (
                <div key={g.label} className="bg-foreground/[0.05] border border-foreground/[0.12] rounded-2xl p-6 group hover:border-primary/30 transition-all">
                  {g.change && (
                    <div className="flex justify-end mb-2">
                      <span className="text-[10px] font-black text-success bg-success/10 px-2 py-0.5 rounded-lg">{g.change}</span>
                    </div>
                  )}
                  <p className="text-3xl font-black text-foreground tracking-tighter mb-1">{g.value}</p>
                  <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-60 mb-1">{g.label}</p>
                  <p className="text-[9px] text-muted-foreground/40 font-bold">{t("dashboard.home.target", { value: g.target })}</p>
                  <div className="h-2 bg-foreground/[0.10] rounded-full overflow-hidden mt-4">
                    <div className={cn("h-full rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]", g.color)} style={{ width: `${g.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-8">
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-warn/10 text-warn">
                  <Zap className="w-5 h-5 shadow-[0_0_15px_rgba(245,158,11,0.2)]" />
                </div>
                <h2 className="text-lg font-black text-foreground tracking-tight uppercase">{t("dashboard.home.neuralPathways")}</h2>
              </div>
              <button onClick={() => navigate("/automation")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-foreground/[0.07] border border-foreground/[0.16] hover:bg-foreground/[0.12] text-primary transition-all">
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
            {automations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground opacity-60">
                <Sparkles className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest text-center">{t("dashboard.home.noActivePathways")}</p>
                <button onClick={() => navigate("/automation")} className="mt-4 text-[10px] font-black text-primary hover:underline uppercase tracking-widest">{t("dashboard.home.connectHub")}</button>
              </div>
            ) : (
              <div className="space-y-4">
                {automations.slice(0, 6).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between p-4 rounded-2xl bg-foreground/[0.05] border border-foreground/[0.12] hover:bg-foreground/[0.08] transition-all group">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground group-hover:text-primary transition-colors truncate">{a.name}</p>
                      <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest mt-1 opacity-50">{a.platforms?.join(", ") ?? t("dashboard.home.multiPlatform")}</p>
                    </div>
                    <div className={cn("w-10 h-5 rounded-full relative ml-4 shrink-0 cursor-pointer transition-all", a.status === "active" ? "bg-primary shadow-[0_0_15px_rgba(155,135,245,0.4)]" : "bg-foreground/10")}>
                      <div className={cn("absolute top-1 w-3 h-3 rounded-full bg-background transition-all shadow-sm", a.status === "active" ? "right-1" : "left-1")} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default Index;
