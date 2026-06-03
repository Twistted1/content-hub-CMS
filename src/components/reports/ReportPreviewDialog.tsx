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
import { Printer, Download, FileText, Calendar, BarChart3 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { Report } from "./ReportCard";
import { usePosts } from "@/hooks/usePosts";
import { format, subDays, isAfter } from "date-fns";

interface ReportPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: Report | null;
}

const STATUS_COLORS: Record<string, string> = {
  published:      "#22c55e",
  scheduled:      "#6366f1",
  draft:          "#94a3b8",
  awaiting_review:"#f59e0b",
  failed:         "#ef4444",
};

const PLATFORM_COLORS: Record<string, string> = {
  twitter:   "#F8FAFC",
  instagram: "#E1306C",
  facebook:  "#1877F2",
  linkedin:  "#0A66C2",
  youtube:   "#EF4444",
  tiktok:    "#06B6D4",
  website:   "#14B8A6",
  podcast:   "#F97316",
  rumble:    "#22C55E",
};

export function ReportPreviewDialog({ open, onOpenChange, report }: ReportPreviewDialogProps) {
  const { posts } = usePosts();

  // ── Derive metrics from real post data ──────────────────────────────────────
  const metrics = useMemo(() => {
    if (!posts || posts.length === 0) return null;

    // Status breakdown
    const statusMap: Record<string, number> = {};
    posts.forEach((p) => {
      const s = p.status as string;
      statusMap[s] = (statusMap[s] || 0) + 1;
    });
    const statusData = Object.entries(statusMap).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1).replace(/_/g, " "),
      value,
      color: STATUS_COLORS[name] || "#94a3b8",
    }));

    // Platform breakdown
    const platformMap: Record<string, number> = {};
    posts.forEach((post) => {
      (post.platforms || []).forEach((pp) => {
        const p = pp.platform as string;
        platformMap[p] = (platformMap[p] || 0) + 1;
      });
    });
    const platformData = Object.entries(platformMap)
      .map(([name, count]) => ({
        platform: name.charAt(0).toUpperCase() + name.slice(1),
        count,
        fill: PLATFORM_COLORS[name] || "hsl(var(--primary))",
      }))
      .sort((a, b) => b.count - a.count);

    // Last 7 days activity
    const now = new Date();
    const dailyData = Array.from({ length: 7 }, (_, i) => {
      const day = subDays(now, 6 - i);
      const dayStart = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const dayEnd = new Date(dayStart.getTime() + 86400000);
      const count = posts.filter((p) => {
        const d = new Date(p.createdAt);
        return d >= dayStart && d < dayEnd;
      }).length;
      return { day: format(day, "EEE"), posts: count };
    });

    // Totals
    const totalPublished = posts.filter((p) => p.status === "published").length;
    const totalScheduled = posts.filter((p) => p.status === "scheduled").length;
    const totalDrafts    = posts.filter((p) => p.status === "draft").length;

    return { statusData, platformData, dailyData, totalPublished, totalScheduled, totalDrafts };
  }, [posts]);

  if (!report) return null;

  const handlePrint = () => window.print();

  const handleDownload = () => {
    if (!metrics) return;
    const lines = [
      `Report: ${report.name}`,
      `Type: ${report.type}`,
      `Generated: ${report.lastGenerated}`,
      `Format: ${report.format}`,
      "",
      "── Post Summary ──",
      `Published: ${metrics.totalPublished}`,
      `Scheduled: ${metrics.totalScheduled}`,
      `Drafts:    ${metrics.totalDrafts}`,
      `Total:     ${posts.length}`,
      "",
      "── Platform Breakdown ──",
      ...metrics.platformData.map((p) => `${p.platform}: ${p.count}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.name.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between flex-wrap gap-3">
            <div>
              <DialogTitle className="text-xl">{report.name}</DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Generated: {report.lastGenerated || "—"}
                {report.status && (
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    {report.status}
                  </Badge>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button size="sm" onClick={handleDownload} disabled={!metrics}>
                <Download className="h-4 w-4 mr-2" />
                Download .txt
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Report metadata */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Report Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Type</dt>
                  <dd className="font-medium">{report.type}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Format</dt>
                  <dd className="font-medium">{report.format}</dd>
                </div>
                {report.description && (
                  <div className="col-span-2">
                    <dt className="text-muted-foreground">Description</dt>
                    <dd className="font-medium">{report.description}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          {!metrics ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <BarChart3 className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No post data yet</p>
                <p className="text-sm mt-1">
                  Create posts and run the content pipeline to see analytics here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Post totals */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    Post Summary
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: "Published", value: metrics.totalPublished, color: "text-emerald-400" },
                      { label: "Scheduled", value: metrics.totalScheduled, color: "text-indigo-400" },
                      { label: "Drafts",    value: metrics.totalDrafts,    color: "text-muted-foreground" },
                    ].map((s) => (
                      <div key={s.label} className="p-4 rounded-lg bg-muted/50 text-center">
                        <p className={`text-3xl font-black ${s.color}`}>{s.value}</p>
                        <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Status breakdown pie */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Posts by Status</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[220px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={metrics.statusData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          label={({ name, value }) => `${name}: ${value}`}
                          labelLine={false}
                        >
                          {metrics.statusData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Platform breakdown bar */}
              {metrics.platformData.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Posts by Platform</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-[220px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={metrics.platformData} layout="vertical">
                          <CartesianGrid
                            strokeDasharray="3 3"
                            className="stroke-muted"
                            horizontal={false}
                          />
                          <XAxis type="number" className="text-xs" allowDecimals={false} />
                          <YAxis
                            dataKey="platform"
                            type="category"
                            width={90}
                            className="text-xs"
                          />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                            }}
                          />
                          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                            {metrics.platformData.map((entry, i) => (
                              <Cell key={i} fill={entry.fill} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Last 7 days activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Posts Created — Last 7 Days</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={metrics.dailyData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="day" className="text-xs" />
                        <YAxis className="text-xs" allowDecimals={false} />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--card))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                          }}
                        />
                        <Bar
                          dataKey="posts"
                          fill="hsl(var(--primary))"
                          radius={[4, 4, 0, 0]}
                          name="Posts Created"
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
