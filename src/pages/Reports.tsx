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
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
    toast.success(t("reports.downloading", { file: `${report.name}.${report.format.toLowerCase()}` }));
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

  const handleSchedule = (report: ReportCardType) => {
    toast.info(t("reports.openingSchedule", { name: report.name }));
  };

  const handleQuickTemplate = (templateName: string) => {
    setCreateDialogOpen(true);
    toast.info(t("reports.templateSelected", { name: templateName }));
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <LoadingState message={t("reports.loading")} />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="page-title mb-2">{t("reports.title")}</h1>
            <p className="text-muted-foreground">
              {t("reports.subtitle")}
            </p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("reports.createReport")}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("reports.searchPlaceholder")}
              className="pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder={t("reports.typePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("reports.allTypes")}</SelectItem>
              <SelectItem value="performance">{t("reports.performance")}</SelectItem>
              <SelectItem value="analytics">{t("reports.analyticsType")}</SelectItem>
              <SelectItem value="financial">{t("reports.financial")}</SelectItem>
              <SelectItem value="marketing">{t("reports.marketing")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={dateFilter} onValueChange={setDateFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <Calendar className="mr-2 h-4 w-4" />
              <SelectValue placeholder={t("reports.datePlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">{t("reports.mostRecent")}</SelectItem>
              <SelectItem value="week">{t("reports.thisWeek")}</SelectItem>
              <SelectItem value="month">{t("reports.thisMonth")}</SelectItem>
              <SelectItem value="year">{t("reports.thisYear")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Reports List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("reports.availableReports")}</h2>
              <span className="text-sm text-muted-foreground">
                {t("reports.reportsCount", { filtered: filteredReports.length, total: cardReports.length })}
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
                    <h3 className="text-lg font-medium">{t("reports.noReportsFound")}</h3>
                    <p className="text-sm text-muted-foreground text-center mt-1">
                      {searchQuery || typeFilter !== "all"
                        ? t("reports.adjustFilters")
                        : t("reports.createFirstReport")}
                    </p>
                    <Button className="mt-4" onClick={() => setCreateDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      {t("reports.createReport")}
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
                <CardTitle className="text-base">{t("reports.reportStatistics")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("reports.totalReports")}</span>
                  <span className="font-medium">{reports.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("reports.ready")}</span>
                  <span className="font-medium">{reports.filter(r => r.status === "Ready").length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t("reports.title")}</span>
                  <span className="font-medium">{scheduledReports.length}</span>
                </div>
              </CardContent>
            </Card>

            {/* Scheduled Reports */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("reports.scheduledReports")}</CardTitle>
                <CardDescription>{t("reports.upcomingAutomated")}</CardDescription>
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
                            {t("reports.next", { date: new Date(report.scheduleNextRun).toLocaleDateString() })}
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
                    {t("reports.noScheduledReports")}
                  </p>
                )}
                <Button
                  variant="outline"
                  className="w-full"
                  size="sm"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="mr-2 h-3 w-3" />
                  {t("reports.scheduleNew")}
                </Button>
              </CardContent>
            </Card>

            {/* Report Templates */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{t("reports.quickTemplates")}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {quickTemplates.map((template) => {
                  const translatedName = t(`reports.template${template.name.replace(/\s+/g, "")}`, template.name);
                  return (
                    <Button
                      key={template.name}
                      variant="outline"
                      className="w-full justify-start"
                      size="sm"
                      onClick={() => handleQuickTemplate(translatedName)}
                    >
                      <template.icon className="mr-2 h-4 w-4" />
                      {translatedName}
                    </Button>
                  );
                })}
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
            <AlertDialogTitle>{t("reports.deleteReport")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("reports.deleteConfirm", { name: deleteReportTarget?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}
