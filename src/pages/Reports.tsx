import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Plus, 
  Search, 
  Filter,
  Calendar,
  BarChart3,
  FileText,
  Users,
  TrendingUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { ReportCard, Report as ReportCardType } from "@/components/reports/ReportCard";
import { CreateReportDialog } from "@/components/reports/CreateReportDialog";
import { ReportPreviewDialog } from "@/components/reports/ReportPreviewDialog";
import { quickTemplates, typeIcons } from "@/components/reports/reportsData";
import { useReports } from "@/hooks/useReports";
import { LoadingState } from "@/components/ui/LoadingState";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function mapToCardReport(r: any): ReportCardType {
  return {
    id: r.id,
    name: r.name,
    description: r.description || "",
    type: (r.type || "Performance") as ReportCardType["type"],
    icon: typeIcons[(r.type || "Performance") as keyof typeof typeIcons] || TrendingUp,
    lastGenerated: r.lastGenerated ? new Date(r.lastGenerated).toISOString().split("T")[0] : "—",
    status: (r.status || "Processing") as ReportCardType["status"],
    format: (r.format || "PDF") as ReportCardType["format"],
  };
}

export default function Reports() {
  const { reports, isLoading, addReport, deleteReport, regenerateReport } = useReports();
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("recent");
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [previewReport, setPreviewReport] = useState<ReportCardType | null>(null);
  const [deleteReportTarget, setDeleteReportTarget] = useState<ReportCardType | null>(null);

  const cardReports = useMemo(() => reports.map(mapToCardReport), [reports]);

  const filteredReports = useMemo(() => {
    return cardReports.filter((report) => {
      const matchesSearch =
        report.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType =
        typeFilter === "all" || report.type.toLowerCase() === typeFilter;
      return matchesSearch && matchesType;
    });
  }, [cardReports, searchQuery, typeFilter]);

  const scheduledReports = useMemo(() => {
    return reports.filter(r => r.scheduleFrequency);
  }, [reports]);

  const handleCreateReport = (data: {
    name: string;
    description: string;
    type: string;
    format: string;
    schedule: boolean;
    frequency?: string;
  }) => {
    let scheduleNextRun: string | undefined;
    if (data.schedule && data.frequency) {
      const now = new Date();
      switch (data.frequency) {
        case "daily": now.setDate(now.getDate() + 1); break;
        case "weekly": now.setDate(now.getDate() + 7); break;
        case "monthly": now.setMonth(now.getMonth() + 1); break;
        case "quarterly": now.setMonth(now.getMonth() + 3); break;
      }
      scheduleNextRun = now.toISOString();
    }

    addReport.mutate({
      name: data.name,
      description: data.description,
      type: data.type,
      format: data.format,
      scheduleFrequency: data.schedule ? data.frequency : undefined,
      scheduleNextRun,
    });
  };

  const handleDownload = (report: ReportCardType) => {
    toast.success(`Downloading ${report.name}.${report.format.toLowerCase()}`);
  };

  const handleRegenerate = (report: ReportCardType) => {
    regenerateReport.mutate(report.id as string);
  };

  const handleView = (report: ReportCardType) => {
    setPreviewReport(report);
  };

  const handleDeleteConfirm = () => {
    if (!deleteReportTarget) return;
    deleteReport.mutate(deleteReportTarget.id as string);
    setDeleteReportTarget(null);
  };

  const handleSchedule = (_report: ReportCardType) => {
    // Open the create dialog pre-filled for editing schedule — for now opens create
    setCreateDialogOpen(true);
  };

  const handleQuickTemplate = (_templateName: string) => {
    setCreateDialogOpen(true);
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading reports..." />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-foreground">Reports</h1>
            <p className="text-muted-foreground">
              Generate and manage your business reports
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Report
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search reports..."
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="performance">Performance</SelectItem>
              <SelectItem value="analytics">Analytics</SelectItem>
              <SelectItem value="financial">Financial</SelectItem>
              <SelectItem value="marketing">Marketing</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder="Date" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Most Recent</SelectItem>
              <SelectItem value="week">This Week</SelectItem>
              <SelectItem value="month">This Month</SelectItem>
              <SelectItem value="year">This Year</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Reports List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Available Reports</h2>
              <span className="text-sm text-muted-foreground">
                {filteredReports.length} of {cardReports.length} reports
              </span>
            </div>
            <div className="space-y-3">
              {filteredReports.length > 0 ? (
                filteredReports.map((report) => (
                  <ReportCard
                    key={report.id}
                    report={report}
                    onDownload={handleDownload}
                    onRegenerate={handleRegenerate}
                    onView={handleView}
                    onDelete={setDeleteReportTarget}
                    onSchedule={handleSchedule}
                  />
                ))
              ) : (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <FileText className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-medium">No reports found</h3>
                    <p className="text-sm text-muted-foreground text-center mt-1">
                      {searchQuery || typeFilter !== "all"
                        ? "Try adjusting your search or filters"
                        : "Create your first report to get started"}
                    </p>
                    <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Report
                    </Button>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Report Statistics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Total Reports</span>
                  <span className="font-medium">{reports.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Ready</span>
                  <span className="font-medium">{reports.filter(r => r.status === "Ready").length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Scheduled</span>
                  <span className="font-medium">{scheduledReports.length}</span>
                </div>
              </CardContent>
            </Card>

            {/* Scheduled Reports */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Scheduled Reports</CardTitle>
                <CardDescription>Upcoming automated reports</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {scheduledReports.length > 0 ? (
                  scheduledReports.map((report) => (
                    <div key={report.id} className="flex items-start gap-3 group">
                      <div className="rounded-full bg-primary/10 p-2">
                        <Calendar className="h-3 w-3 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{report.name}</p>
                        <p className="text-xs text-muted-foreground">{report.scheduleFrequency}</p>
                        {report.scheduleNextRun && (
                          <p className="text-xs text-muted-foreground">
                            Next: {new Date(report.scheduleNextRun).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteReport.mutate(report.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No scheduled reports
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="mr-2 h-3 w-3" />
                  Schedule New
                </Button>
              </CardContent>
            </Card>

            {/* Report Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick Templates</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quickTemplates.map((template) => (
                  <Button
                    key={template.name}
                    variant="outline"
                    className="w-full justify-start"
                    size="sm"
                    onClick={() => handleQuickTemplate(template.name)}
                  >
                    <template.icon className="mr-2 h-4 w-4" />
                    {template.name}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Create Report Dialog */}
      <CreateReportDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreateReport={handleCreateReport}
      />

      {/* Report Preview Dialog */}
      <ReportPreviewDialog
        open={!!previewReport}
        onOpenChange={(open) => !open && setPreviewReport(null)}
        report={previewReport}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteReportTarget} onOpenChange={(open) => !open && setDeleteReportTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Report</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteReportTarget?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
