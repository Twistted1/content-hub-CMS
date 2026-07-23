import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, MoreVertical, RefreshCw, Eye, Trash2, Settings, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

export interface Report {
  id: number | string;
  name: string;
  description: string;
  type: "Performance" | "Analytics" | "Financial" | "Marketing";
  icon: LucideIcon;
  lastGenerated: string;
  status: "Ready" | "Processing" | "Failed";
  format: "PDF" | "Excel" | "CSV";
}

interface ReportCardProps {
  report: Report;
  onDownload: (report: Report) => void;
  onRegenerate: (report: Report) => void;
  onView: (report: Report) => void;
  onDelete: (report: Report) => void;
  onSchedule: (report: Report) => void;
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "Ready":
      return "bg-success/10 text-success";
    case "Processing":
      return "bg-warning/10 text-warning";
    case "Failed":
      return "bg-destructive/10 text-destructive";
    default:
      return "bg-muted text-muted-foreground";
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case "Performance":
      return "bg-primary/10 text-primary";
    case "Analytics":
      return "bg-chart-4/10 text-chart-4";
    case "Financial":
      return "bg-success/10 text-success";
    case "Marketing":
      return "bg-chart-2/10 text-chart-2";
    default:
      return "bg-muted text-muted-foreground";
  }
};

export function ReportCard({
  report,
  onDownload,
  onRegenerate,
  onView,
  onDelete,
  onSchedule,
}: ReportCardProps) {
  const { t } = useTranslation();
  const Icon = report.icon;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-muted p-3">
            <Icon className="h-5 w-5 text-muted-foreground" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-medium">{report.name}</h3>
                <p className="text-sm text-muted-foreground line-clamp-1">
                  {report.description}
                </p>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onView(report)}>
                    <Eye className="mr-2 h-4 w-4" />
                    {t("reports.viewReport")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onSchedule(report)}>
                    <Calendar className="mr-2 h-4 w-4" />
                    {t("reports.schedule")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onRegenerate(report)}>
                    <Settings className="mr-2 h-4 w-4" />
                    {t("reports.editSettings")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive"
                    onClick={() => onDelete(report)}
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className={getTypeColor(report.type)}>
                {report.type}
              </Badge>
              <Badge variant="secondary" className={getStatusColor(report.status)}>
                {report.status}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {t("reports.lastGenerated", { date: report.lastGenerated })}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDownload(report)}
                disabled={report.status !== "Ready"}
              >
                <Download className="mr-2 h-3 w-3" />
                {report.format}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRegenerate(report)}
                disabled={report.status === "Processing"}
              >
                <RefreshCw className={`mr-2 h-3 w-3 ${report.status === "Processing" ? "animate-spin" : ""}`} />
                Regenerate
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
