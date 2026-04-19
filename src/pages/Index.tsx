import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { useDashboardStats } from "@/hooks/useDashboardStats";
import { usePosts } from "@/hooks/usePosts";
import { useAuth } from "@/hooks/useAuth";
import { useAutomations } from "@/hooks/useAutomations";
import { useNotes } from "@/hooks/useNotes";
import {
  format, subDays, isToday, isSameDay,
  startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek,
} from "date-fns";
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
const HEAT_COLORS = ["bg-white/5", "bg-emerald-900/60", "bg-emerald-700/70", "bg-emerald-500/80", "bg-emerald-400"];
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
        {["S","M","T","W","T","F","S"].map((d, i) => (
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
                <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-emerald-400" />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-3 mt-3 pt-2 border-t border-border/40 flex-wrap">
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /><span className="text-[9px] text-muted-foreground">Scheduled</span></div>
        <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /><span className="text-[9px] text-muted-foreground">High volume</span></div>
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
    <div className="bg-card border border-border rounded-2xl p-5 flex flex-col gap-3 hover:border-primary/30 transition-colors">
      <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest bg-muted/30 border-border/50 text-muted-foreground w-fit">{badge}</Badge>
      <div>
        <p className={cn("text-3xl font-black tracking-tight", color ?? "text-foreground")}>{value}</p>
        <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{title}</p>
      </div>
      {sub && (
        <div className={cn("flex items-center gap-1 text-[10px] font-bold", trendUp ? "text-emerald-400" : "text-rose-400")}>
          {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
          <span>{sub}</span>
        </div>
      )}
    </div>
  );
}

// ── Main ───────────────────────────────────────────────────────────────────────
const Index = () => {
  const stats      = useDashboardStats();
  const { posts }  = usePosts();
  const { user }   = useAuth();
  const { automations } = useAutomations();
  const { notes }  = useNotes();
  const navigate   = useNavigate();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const hour     = now.getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const userName = user?.email?.split("@")[0] ?? "Admin";
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

  // Platform health
  const platformHealth = [
    { key: "youtube",   queued: 8,  pct: 92 },
    { key: "tiktok",    queued: 14, pct: 98 },
    { key: "instagram", queued: 21, pct: 95 },
    { key: "twitter",   queued: 21, pct: 97 },
    { key: "linkedin",  queued: 8,  pct: 88 },
    { key: "facebook",  queued: 7,  pct: 75 },
  ];

  // Goals
  const goals = [
    { label: "Follower Growth",  value: "2,840", target: "5,000",  pct: 57, change: "+12.4%", color: "bg-violet-500" },
    { label: "Avg Engagement",   value: "6.2%",  target: "8%",     pct: 78, change: "+1.1%",  color: "bg-blue-500"   },
    { label: "Monthly Output",   value: `${stats.publishedPosts}`,  target: "90 posts", pct: Math.min(100, Math.round((stats.publishedPosts / 90) * 100)), change: "+23%", color: "bg-emerald-500" },
    { label: "Website Traffic",  value: "8,400", target: "15,000", pct: 56, change: "+18%",   color: "bg-amber-500"  },
  ];

  // Activity feed
  const activityFeed = posts.slice(0, 5).map((p, i) => ({
    text: p.status === "published"
      ? `${(p as any).platforms?.[0]?.platform ?? "Post"} published successfully`
      : p.status === "scheduled"
      ? `${(p as any).platforms?.[0]?.platform ?? "Post"} scheduled`
      : `${p.title.slice(0, 28)}… draft saved`,
    ago:    `${i * 8 + 2}m ago`,
    status: p.status as string,
  }));

  return (
    <DashboardLayout>
      <div className="space-y-5 pb-10 animate-in fade-in duration-500">

        {/* ── Greeting Banner ─────────────────────────────────────────── */}
        <div className="bg-gradient-to-r from-primary/10 via-card to-card border border-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-primary mb-1">{dayLabel}</p>
            <h1 className="text-xl font-black tracking-tighter text-foreground">
              {greeting}, {userName.charAt(0).toUpperCase() + userName.slice(1)} 👋
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="text-foreground font-bold">{todayQueue.length} posts</span> scheduled today ·{" "}
              <span className="text-primary font-bold">{stats.scheduledPosts} items</span> ready to publish
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <Button onClick={() => navigate("/calendar")} className="bg-primary hover:opacity-90 text-white font-black uppercase text-[10px] tracking-widest gap-2 rounded-xl">
              <Plus className="w-4 h-4" /> Create Content
            </Button>
            <Button onClick={() => navigate("/pipeline")} variant="outline" className="border-border font-black uppercase text-[10px] tracking-widest gap-2 rounded-xl">
              <Eye className="w-4 h-4" /> View Queue ({stats.scheduledPosts})
            </Button>
          </div>
        </div>

        {/* ── 6 Stat Cards ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard title="Total Posts"  value={stats.totalPosts}    badge="All time"   sub="vs last month" trendUp  color="text-foreground" />
          <StatCard title="Scheduled"    value={stats.scheduledPosts} badge="Upcoming"  sub={`${todayQueue.length} today`} trendUp color="text-blue-400" />
          <StatCard title="Drafts"       value={stats.draftPosts}    badge="In progress" sub={stats.draftPosts > 0 ? `${stats.draftPosts} need review` : "All clear"} color="text-amber-400" />
          <StatCard title="Published"    value={stats.publishedPosts} badge="This week" sub="vs last week" trendUp color="text-emerald-400" />
          <StatCard title="Engagement"   value="6.2%"                badge="Avg rate"   sub="1.1% this week" trendUp color="text-violet-400" />
          <StatCard title="Auto Success" value="98.5%"               badge="Live"       sub="0.3% this week" trendUp color="text-primary" />
        </div>

        {/* ── Activity Chart + Platform Health ────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-black text-foreground">Posts Activity</h2>
                <p className="text-[10px] text-muted-foreground">Published vs Scheduled — Last 30 days</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mb-3">
              {[["Published","bg-emerald-400"],["Scheduled","bg-blue-400"],["Drafts","bg-violet-400"]].map(([l,c]) => (
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
                <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false} interval={4} />
                <YAxis tick={{ fontSize: 9, fill: "#6b7280" }} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ background: "hsl(222 47% 6%)", border: "1px solid hsl(217 33% 17%)", borderRadius: 12, fontSize: 11 }} />
                <Area type="monotone" dataKey="Published" stroke="#34d399" strokeWidth={2} fill="url(#gP)" dot={false} />
                <Area type="monotone" dataKey="Scheduled" stroke="#60a5fa" strokeWidth={2} fill="url(#gS)" dot={false} />
                <Area type="monotone" dataKey="Drafts"    stroke="#a78bfa" strokeWidth={2} fill="url(#gD)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-foreground">Platform Health</h2>
              <button onClick={() => navigate("/platforms")} className="text-[10px] font-black text-primary hover:underline flex items-center gap-1">
                Manage <ArrowRight className="w-3 h-3" />
              </button>
            </div>
            <div className="space-y-3">
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
                          <span className="text-[9px] text-muted-foreground">{queued} queued</span>
                          <span className={cn("text-[10px] font-black", pct >= 90 ? "text-emerald-400" : pct >= 70 ? "text-amber-400" : "text-rose-400")}>{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className={cn("h-full rounded-full", bar)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Distribution + Today's Queue + Mini Calendar ─────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {/* Distribution donut */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-foreground">Distribution</h2>
              <button onClick={() => navigate("/analytics")} className="text-[10px] font-black text-primary hover:underline flex items-center gap-1">Details <ArrowRight className="w-3 h-3" /></button>
            </div>
            {platSlices.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={140}>
                  <PieChart>
                    <Pie data={platSlices} cx="50%" cy="50%" innerRadius={40} outerRadius={58} dataKey="value" strokeWidth={2} stroke="hsl(222 47% 6%)">
                      {platSlices.map((s, i) => <Cell key={i} fill={s.hex} />)}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-2">
                  {platSlices.map(s => (
                    <div key={s.name} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.hex }} />
                        <span className="text-muted-foreground">{s.name}</span>
                      </div>
                      <span className="font-black text-foreground">{s.value}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <BarChart3 className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs">No platform data yet</p>
              </div>
            )}
          </div>

          {/* Today's Queue */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-black text-foreground">Today's Queue</h2>
              </div>
              <button onClick={() => navigate("/pipeline")} className="text-[10px] font-black text-primary hover:underline flex items-center gap-1">View All <ArrowRight className="w-3 h-3" /></button>
            </div>
            {todayQueue.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Calendar className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs">Nothing scheduled today</p>
                <button onClick={() => navigate("/calendar")} className="mt-2 text-[10px] font-black text-primary hover:underline">Schedule content →</button>
              </div>
            ) : todayQueue.slice(0, 8).map((post: any) => {
              const plat   = post.platforms?.[0]?.platform ?? "website";
              const cfg    = PLATFORM_CFG[plat];
              const Icon   = cfg?.Icon ?? Globe;
              const timeStr = post.scheduledAt ? format(new Date(post.scheduledAt), "HH:mm") : "--:--";
              const sc = post.status === "scheduled" ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                       : post.status === "draft"     ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                       : "text-blue-400 bg-blue-400/10 border-blue-400/20";
              return (
                <div key={post.id} className="flex items-center gap-3 py-2 border-b border-border/30 last:border-0">
                  <span className="text-[10px] font-black text-muted-foreground w-10 shrink-0 tabular-nums">{timeStr}</span>
                  <Icon className={cn("w-4 h-4 shrink-0", cfg?.color ?? "text-muted-foreground")} />
                  <span className="text-xs text-foreground flex-1 truncate font-medium">{post.title}</span>
                  <span className={cn("text-[9px] font-black uppercase px-2 py-0.5 rounded border shrink-0", sc)}>
                    {post.status === "scheduled" ? "READY" : post.status.toUpperCase()}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Mini Calendar */}
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-black text-foreground">Content Calendar</h2>
            </div>
            <MiniCalendar posts={posts} />
          </div>
        </div>

        {/* ── Heatmap + Activity Feed ──────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-black text-foreground">Publishing Heatmap</h2>
                <p className="text-[10px] text-muted-foreground">Posts per day — last 12 weeks</p>
              </div>
              <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                <span>Less</span>
                {HEAT_COLORS.map((c, i) => <span key={i} className={cn("w-3 h-3 rounded-sm inline-block", c)} />)}
                <span>More</span>
              </div>
            </div>
            <div className="flex gap-1">
              {heatWeeks.map((week, wi) => (
                <div key={wi} className="flex flex-col gap-1 shrink-0">
                  {week.map((day, di) => (
                    <div key={di} title={`${format(day.date, "MMM d")}: ${day.count}`}
                      className={cn("w-3.5 h-3.5 rounded-sm hover:ring-1 hover:ring-primary/50", heatColor(day.count))} />
                  ))}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-foreground">Activity Feed</h2>
              <span className="flex items-center gap-1.5 text-[9px] font-black text-emerald-400 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> Live
              </span>
            </div>
            {activityFeed.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">No recent activity</p>
            ) : activityFeed.map((item, i) => (
              <div key={i} className="flex items-start gap-3 mb-3">
                <div className={cn("w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5",
                  item.status === "published" ? "bg-emerald-500/10" :
                  item.status === "scheduled" ? "bg-blue-500/10" : "bg-amber-500/10"
                )}>
                  {item.status === "published" ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                   : item.status === "scheduled" ? <Clock className="w-3.5 h-3.5 text-blue-400" />
                   : <FileText className="w-3.5 h-3.5 text-amber-400" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground font-medium leading-tight">{item.text}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{item.ago}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Recent Posts + Quick Notes ───────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-black text-foreground">Recent Posts</h2>
              <button onClick={() => navigate("/articles")} className="text-[10px] font-black text-primary hover:underline flex items-center gap-1">View All <ArrowRight className="w-3 h-3" /></button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/40">
                    {["Content","Platform","Status","Date"].map(h => (
                      <th key={h} className="pb-2 text-left text-[9px] font-black uppercase tracking-widest text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/20">
                  {posts.length === 0 ? (
                    <tr><td colSpan={4} className="py-6 text-center text-muted-foreground text-xs">No posts yet</td></tr>
                  ) : posts.slice(0, 6).map(post => {
                    const plat = (post as any).platforms?.[0]?.platform ?? "website";
                    const cfg  = PLATFORM_CFG[plat];
                    const sc   = post.status === "published" ? "text-emerald-400"
                               : post.status === "scheduled" ? "text-blue-400" : "text-amber-400";
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
              <h2 className="text-sm font-black text-foreground">Quick Notes</h2>
              <button onClick={() => navigate("/notes")} className="text-[10px] font-black text-primary hover:underline flex items-center gap-1">View All <ArrowRight className="w-3 h-3" /></button>
            </div>
            {notes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">No notes yet</p>
            ) : notes.slice(0, 4).map((note: any) => (
              <div key={note.id} className="p-3 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer mb-2">
                <p className="text-xs font-bold text-foreground">{note.title}</p>
                {note.content && <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{note.content}</p>}
              </div>
            ))}
            <button onClick={() => navigate("/notes")} className="w-full py-2 border border-dashed border-border/50 rounded-xl text-[10px] font-black text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors mt-1">
              + Add Note
            </button>
          </div>
        </div>

        {/* ── Goals & KPIs + Automation Status ────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-black text-foreground">Goals & KPIs</h2>
                <p className="text-[10px] text-muted-foreground">Q3 2025 targets — updated in real-time</p>
              </div>
              <button onClick={() => navigate("/analytics")} className="text-[10px] font-black text-primary hover:underline flex items-center gap-1">Full Report <ArrowRight className="w-3 h-3" /></button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {goals.map(g => (
                <div key={g.label} className="bg-muted/20 border border-border/40 rounded-xl p-4">
                  <div className="flex justify-end mb-1">
                    <span className="text-[10px] font-black text-emerald-400">{g.change}</span>
                  </div>
                  <p className="text-2xl font-black text-foreground tracking-tight">{g.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{g.label}</p>
                  <p className="text-[9px] text-muted-foreground/60">Target: {g.target}</p>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                    <div className={cn("h-full rounded-full", g.color)} style={{ width: `${g.pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-black text-foreground">Automation Status</h2>
              </div>
              <button onClick={() => navigate("/automation")} className="text-[10px] font-black text-primary hover:underline flex items-center gap-1">Manage <ArrowRight className="w-3 h-3" /></button>
            </div>
            {automations.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Sparkles className="w-8 h-8 mb-2 opacity-20" />
                <p className="text-xs">No automations configured yet</p>
                <button onClick={() => navigate("/automation")} className="mt-2 text-[10px] font-black text-primary hover:underline">Set up automation →</button>
              </div>
            ) : automations.slice(0, 6).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{a.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{a.platforms?.join(", ") ?? "Multi-platform"}</p>
                </div>
                <div className={cn("w-8 h-4 rounded-full relative ml-4 shrink-0", a.status === "active" ? "bg-primary" : "bg-muted")}>
                  <div className={cn("absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all", a.status === "active" ? "right-0.5" : "left-0.5")} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
};

export default Index;
