import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Printer, Share2 } from "lucide-react";
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
} from "recharts";
import { Report } from "./ReportCard";
import { usePosts } from "@/hooks/usePosts";
import { subMonths, format, isAfter, isBefore } from "date-fns";

interface ReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: Report | null;
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? "+100%" : "0%";
  const pct = ((current - previous) / previous) * 100;
  return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

export function ReportPreviewDialog({
  open,
  onOpenChange,
  report,
}: ReportPreviewDialogProps) {
  const { posts } = usePosts();

  // Current period = last 30 days, previous period = the 30 days before that.
  const periodStart = useMemo(() => subMonths(new Date(), 1), []);
  const previousPeriodStart = useMemo(() => subMonths(new Date(), 2), []);

  const currentPosts = useMemo(
    () => (posts || []).filter((p) => isAfter(new Date(p.createdAt), periodStart)),
    [posts, periodStart]
  );
  const previousPosts = useMemo(
    () =>
      (posts || []).filter(
        (p) =>
          isAfter(new Date(p.createdAt), previousPeriodStart) &&
          isBefore(new Date(p.createdAt), periodStart)
      ),
    [posts, previousPeriodStart, periodStart]
  );

  const countByStatus = (list: typeof currentPosts, status: string) =>
    list.filter((p) => p.status === status).length;

  const tableData = useMemo(() => {
    const rows: { metric: string; current: number; previous: number }[] = [
      { metric: "Total Posts", current: currentPosts.length, previous: previousPosts.length },
      {
        metric: "Published",
        current: countByStatus(currentPosts, "published"),
        previous: countByStatus(previousPosts, "published"),
      },
      {
        metric: "Scheduled",
        current: countByStatus(currentPosts, "scheduled"),
        previous: countByStatus(previousPosts, "scheduled"),
      },
      {
        metric: "Awaiting Review",
        current: countByStatus(currentPosts, "awaiting_review"),
        previous: countByStatus(previousPosts, "awaiting_review"),
      },
    ];
    return rows.map((r) => ({
      ...r,
      change: pctChange(r.current, r.previous),
    }));
  }, [currentPosts, previousPosts]);

  const trendData = useMemo(() => {
    const months: { month: string; value: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i);
      const key = format(monthDate, "MMM");
      const count = (posts || []).filter(
        (p) => format(new Date(p.createdAt), "MMM yyyy") === format(monthDate, "MMM yyyy")
      ).length;
      months.push({ month: key, value: count });
    }
    return months;
  }, [posts]);

  const platformData = useMemo(() => {
    const counts = new Map<string, number>();
    currentPosts.forEach((p) => {
      const platforms = (p as any).platforms || [];
      platforms.forEach((pp: any) => {
        counts.set(pp.platform, (counts.get(pp.platform) || 0) + 1);
      });
    });
    return Array.from(counts.entries())
      .map(([category, sales]) => ({
        category: category.charAt(0).toUpperCase() + category.slice(1),
        sales,
      }))
      .sort((a, b) => b.sales - a.sales);
  }, [currentPosts]);

  if (!report) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl">{report.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Generated: {report.lastGenerated}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" size="sm">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button size="sm">
                <Download className="h-4 w-4 mr-2" />
                Download {report.format}
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Executive Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Executive Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                This {report.type.toLowerCase()} report covers content activity for the last 30 days
                compared to the prior 30-day period, drawn directly from your posts. {tableData[0].current}{" "}
                posts were created in this period ({tableData[0].change} vs. the previous period), with{" "}
                {tableData[1].current} published.
              </p>
            </CardContent>
          </Card>

          {/* Key Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Key Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 font-medium">Metric</th>
                      <th className="text-right py-2 font-medium">Current Period</th>
                      <th className="text-right py-2 font-medium">Previous Period</th>
                      <th className="text-right py-2 font-medium">Change</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableData.map((row) => (
                      <tr key={row.metric} className="border-b border-border last:border-0">
                        <td className="py-2">{row.metric}</td>
                        <td className="text-right py-2 font-medium">{row.current}</td>
                        <td className="text-right py-2 text-muted-foreground">{row.previous}</td>
                        <td className="text-right py-2">
                          <Badge
                            variant="secondary"
                            className={
                              row.change.startsWith("-")
                                ? "bg-destructive/10 text-destructive"
                                : "bg-success/10 text-success"
                            }
                          >
                            {row.change}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Trend Chart */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Posts Created Per Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendData}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" className="text-xs" />
                    <YAxis className="text-xs" allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke="hsl(var(--primary))"
                      fillOpacity={1}
                      fill="url(#colorValue)"
                      name="Posts"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Platform Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Posts by Platform</CardTitle>
            </CardHeader>
            <CardContent>
              {platformData.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No platform data for this period yet.
                </p>
              ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platformData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" className="text-xs" allowDecimals={false} />
                    <YAxis dataKey="category" type="category" width={80} className="text-xs" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="sales" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              )}
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}
