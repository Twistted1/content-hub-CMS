import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadingState } from "@/components/ui/LoadingState";
import { 
  TrendingUp, 
  TrendingDown, 
  FileText, 
  Eye, 
  Clock, 
  Calendar as CalendarIcon,
  ArrowUpRight,
  Download,
  Calendar,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend
} from "recharts";
import { toast } from "sonner";
import { usePosts } from "@/hooks/usePosts";
import { subDays, subMonths, format, isAfter } from "date-fns";
import { useTranslation } from "react-i18next";

function getPeriodStart(period: string): Date {
  const now = new Date();
  switch (period) {
    case "7d": return subDays(now, 7);
    case "30d": return subDays(now, 30);
    case "90d": return subDays(now, 90);
    case "1y": return subMonths(now, 12);
    default: return subDays(now, 30);
  }
}

export default function Analytics() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState("30d");
  const { posts, isLoading } = usePosts();

  const periodStart = useMemo(() => getPeriodStart(period), [period]);

  const filteredPosts = useMemo(() => {
    return (posts || []).filter(p => isAfter(new Date(p.createdAt), periodStart));
  }, [posts, periodStart]);

  // Stats
  const stats = useMemo(() => {
    const total = filteredPosts.length;
    const published = filteredPosts.filter(p => p.status === "published").length;
    const scheduled = filteredPosts.filter(p => p.status === "scheduled").length;
    const drafts = filteredPosts.filter(p => p.status === "draft").length;

    return [
      { title: t("analytics.totalPosts"), value: total.toString(), change: `${published} ${t("analytics.published").toLowerCase()}`, trend: "up" as const, icon: FileText },
      { title: t("analytics.published"), value: published.toString(), change: t("analytics.inThisPeriod"), trend: "up" as const, icon: Eye },
      { title: t("analytics.scheduled"), value: scheduled.toString(), change: t("analytics.upcoming"), trend: "up" as const, icon: Clock },
      { title: t("analytics.drafts"), value: drafts.toString(), change: t("analytics.inProgress"), trend: "up" as const, icon: CalendarIcon },
    ];
  }, [filteredPosts, t]);

  // Timeline data
  const timelineData = useMemo(() => {
    const buckets: Record<string, { name: string; created: number; published: number }> = {};
    const now = new Date();

    if (period === "7d") {
      for (let i = 6; i >= 0; i--) {
        const day = subDays(now, i);
        const key = format(day, "EEE");
        buckets[key] = { name: key, created: 0, published: 0 };
      }
      filteredPosts.forEach(p => {
        const key = format(new Date(p.createdAt), "EEE");
        if (buckets[key]) {
          buckets[key].created++;
          if (p.status === "published") buckets[key].published++;
        }
      });
    } else if (period === "30d") {
      for (let i = 3; i >= 0; i--) {
        const key = `Week ${4 - i}`;
        buckets[key] = { name: key, created: 0, published: 0 };
      }
      filteredPosts.forEach(p => {
        const daysAgo = Math.floor((now.getTime() - new Date(p.createdAt).getTime()) / 86400000);
        const weekIndex = Math.min(3, Math.floor(daysAgo / 7));
        const key = `Week ${4 - weekIndex}`;
        if (buckets[key]) {
          buckets[key].created++;
          if (p.status === "published") buckets[key].published++;
        }
      });
    } else {
      // Monthly buckets
      const months = period === "90d" ? 3 : 12;
      for (let i = months - 1; i >= 0; i--) {
        const month = subMonths(now, i);
        const key = format(month, "MMM");
        buckets[key] = { name: key, created: 0, published: 0 };
      }
      filteredPosts.forEach(p => {
        const key = format(new Date(p.createdAt), "MMM");
        if (buckets[key]) {
          buckets[key].created++;
          if (p.status === "published") buckets[key].published++;
        }
      });
    }

    return Object.values(buckets);
  }, [filteredPosts, period]);

  // Platform distribution
  const platformData = useMemo(() => {
    const counts = new Map<string, number>();
    filteredPosts.forEach(p => {
      const platforms = (p as any).platforms || [];
      platforms.forEach((pp: any) => {
        counts.set(pp.platform, (counts.get(pp.platform) || 0) + 1);
      });
    });

    const platformColors = [
      "hsl(var(--primary))",
      "hsl(var(--chart-2))",
      "hsl(var(--chart-3))",
      "hsl(var(--chart-4))",
      "hsl(var(--chart-5))",
      "hsl(var(--warning))",
    ];

    return Array.from(counts.entries()).map(([name, value], i) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
      color: platformColors[i % platformColors.length],
    }));
  }, [filteredPosts]);

  // Status breakdown
  const statusData = useMemo(() => {
    const statuses = ["draft", "scheduled", "published", "awaiting_review", "failed"];
    return statuses.map(s => ({
      source: s.replace("_", " ").replace(/\b\w/g, c => c.toUpperCase()),
      count: filteredPosts.filter(p => p.status === s).length,
    })).filter(s => s.count > 0);
  }, [filteredPosts]);

  // Post type breakdown
  const typeData = useMemo(() => {
    const counts = new Map<string, number>();
    filteredPosts.forEach(p => {
      counts.set(p.type, (counts.get(p.type) || 0) + 1);
    });
    return Array.from(counts.entries())
      .map(([type, count]) => ({
        type: type.charAt(0).toUpperCase() + type.slice(1),
        count,
      }))
      .sort((a, b) => b.count - a.count);
  }, [filteredPosts]);

  const handleExport = () => {
    let csv = "Analytics Report\nPeriod," + period + "\n\n";
    csv += "Metric,Value\n";
    stats.forEach(s => { csv += `${s.title},${s.value}\n`; });
    csv += "\nTimeline\nPeriod,Created,Published\n";
    timelineData.forEach(t => { csv += `${t.name},${t.created},${t.published}\n`; });
    csv += "\nPlatform Distribution\nPlatform,Posts\n";
    platformData.forEach(p => { csv += `${p.name},${p.value}\n`; });
    csv += "\nPost Types\nType,Count\n";
    typeData.forEach(t => { csv += `${t.type},${t.count}\n`; });

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `analytics-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(t("analytics.exportSuccess"));
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message={t("analytics.loading")} />
      </DashboardLayout>
    );
  }

  const hasData = filteredPosts.length > 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title mb-2">{t("analytics.title")}</h1>
            <p className="text-muted-foreground">
              {t("analytics.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="w-[140px]">
                <Calendar className="mr-2 h-4 w-4" />
                <SelectValue placeholder={t("analytics.last30Days")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7d">{t("analytics.last7Days")}</SelectItem>
                <SelectItem value="30d">{t("analytics.last30Days")}</SelectItem>
                <SelectItem value="90d">{t("analytics.last90Days")}</SelectItem>
                <SelectItem value="1y">{t("analytics.lastYear")}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport} disabled={!hasData}>
              <Download className="mr-2 h-4 w-4" />
              {t("analytics.export")}
            </Button>
          </div>
        </div>

        {!hasData ? (
          <Card>
            <CardContent>
              <EmptyState
                icon={BarChart3}
                title={t("analytics.noDataTitle")}
                description={t("analytics.noDataDesc")}
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {stats.map((stat) => (
                <Card key={stat.title}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
                    <stat.icon className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{stat.value}</div>
                    <div className="flex items-center text-xs text-muted-foreground">
                      {stat.change}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts Section */}
            <Tabs defaultValue="timeline" className="space-y-4">
              <TabsList>
                <TabsTrigger value="timeline">{t("analytics.timeline")}</TabsTrigger>
                <TabsTrigger value="platforms">{t("analytics.platforms")}</TabsTrigger>
                <TabsTrigger value="status">{t("analytics.status")}</TabsTrigger>
              </TabsList>

              <TabsContent value="timeline" className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-3">
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle>{t("analytics.contentTimeline")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={timelineData}>
                            <defs>
                              <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                              </linearGradient>
                              <linearGradient id="colorPublished" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis dataKey="name" className="text-xs" />
                            <YAxis className="text-xs" allowDecimals={false} />
                            <Tooltip 
                              contentStyle={{ 
                                backgroundColor: "hsl(var(--card))", 
                                border: "1px solid hsl(var(--border))",
                                borderRadius: "8px"
                              }} 
                            />
                            <Area
                              type="monotone"
                              dataKey="created"
                              name={t("analytics.created")}
                              stroke="hsl(var(--primary))"
                              fillOpacity={1}
                              fill="url(#colorCreated)"
                            />
                            <Area
                              type="monotone"
                              dataKey="published"
                              name={t("analytics.published")}
                              stroke="hsl(var(--chart-2))"
                              fillOpacity={1}
                              fill="url(#colorPublished)"
                            />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>{t("analytics.platformDistribution")}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {platformData.length > 0 ? (
                        <>
                          <div className="h-[200px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={platformData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={50}
                                  outerRadius={80}
                                  paddingAngle={5}
                                  dataKey="value"
                                >
                                  {platformData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <Tooltip />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="mt-4 space-y-2">
                            {platformData.map((platform) => (
                              <div key={platform.name} className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <div 
                                    className="h-3 w-3 rounded-full" 
                                    style={{ backgroundColor: platform.color } as React.CSSProperties}
                                  />
                                  <span className="text-sm">{platform.name}</span>
                                </div>
                                <span className="text-sm font-medium">{platform.value}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-8">
                          {t("analytics.noPlatformData")}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="platforms" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("analytics.postsByPlatform")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={platformData} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis type="number" className="text-xs" allowDecimals={false} />
                          <YAxis dataKey="name" type="category" width={100} className="text-xs" />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px"
                            }}
                          />
                          <Bar dataKey="value" name={t("analytics.totalPosts")} fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="status" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t("analytics.postsByStatus")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[300px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={statusData}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                          <XAxis dataKey="source" className="text-xs" />
                          <YAxis className="text-xs" allowDecimals={false} />
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: "hsl(var(--card))", 
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px"
                            }} 
                          />
                          <Bar dataKey="count" name={t("analytics.totalPosts")} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Post Types Table */}
            <Card>
              <CardHeader>
                <CardTitle>{t("analytics.contentTypes")}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border text-left text-sm text-muted-foreground">
                        <th className="pb-3 font-medium">{t("analytics.type")}</th>
                        <th className="pb-3 font-medium">{t("analytics.count")}</th>
                        <th className="pb-3 font-medium">{t("analytics.percentOfTotal")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {typeData.map((item) => (
                        <tr key={item.type} className="border-b border-border last:border-0">
                          <td className="py-3">
                            <span className="font-medium">{item.type}</span>
                          </td>
                          <td className="py-3">{item.count}</td>
                          <td className="py-3">
                            <Badge variant="secondary">
                              {filteredPosts.length > 0 ? Math.round((item.count / filteredPosts.length) * 100) : 0}%
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
