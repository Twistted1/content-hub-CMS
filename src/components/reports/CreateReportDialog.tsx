import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Calendar, FileText, BarChart3, PieChart, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

interface CreateReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateReport: (report: {
    name: string;
    description: string;
    type: string;
    format: string;
    schedule: boolean;
    frequency?: string;
  }) => void;
}

export function CreateReportDialog({
  open,
  onOpenChange,
  onCreateReport,
}: CreateReportDialogProps) {
  const { t } = useTranslation();
  const reportTypes = [
    { value: "Performance", label: t("reports.performance"), icon: TrendingUp },
    { value: "Analytics", label: t("reports.analyticsType"), icon: BarChart3 },
    { value: "Financial", label: t("reports.financial"), icon: PieChart },
    { value: "Marketing", label: t("reports.marketing"), icon: FileText },
  ];
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("");
  const [format, setFormat] = useState("PDF");
  const [schedule, setSchedule] = useState(false);
  const [frequency, setFrequency] = useState("weekly");

  const handleSubmit = () => {
    if (!name || !type) return;

    onCreateReport({
      name,
      description,
      type,
      format,
      schedule,
      frequency: schedule ? frequency : undefined,
    });

    // Reset form
    setName("");
    setDescription("");
    setType("");
    setFormat("PDF");
    setSchedule(false);
    setFrequency("weekly");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("reports.createNewReport")}</DialogTitle>
          <DialogDescription>
            {t("reports.createDialogDesc")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("reports.reportName")}</Label>
            <Input
              id="name"
              placeholder={t("reports.reportNamePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("reports.description")}</Label>
            <Textarea
              id="description"
              placeholder={t("reports.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("reports.reportType")}</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue placeholder={t("reports.selectType")} />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((rt) => (
                    <SelectItem key={rt.value} value={rt.value}>
                      <div className="flex items-center gap-2">
                        <rt.icon className="h-4 w-4" />
                        {rt.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("reports.format")}</Label>
              <Select value={format} onValueChange={setFormat}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PDF">PDF</SelectItem>
                  <SelectItem value="Excel">Excel</SelectItem>
                  <SelectItem value="CSV">CSV</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="schedule" className="cursor-pointer">
                  {t("reports.scheduleReport")}
                </Label>
              </div>
              <p className="text-sm text-muted-foreground">
                {t("reports.scheduleReportDesc")}
              </p>
            </div>
            <Switch
              id="schedule"
              checked={schedule}
              onCheckedChange={setSchedule}
            />
          </div>

          {schedule && (
            <div className="space-y-2">
              <Label>{t("reports.frequency")}</Label>
              <Select value={frequency} onValueChange={setFrequency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">{t("reports.daily")}</SelectItem>
                  <SelectItem value="weekly">{t("reports.weekly")}</SelectItem>
                  <SelectItem value="monthly">{t("reports.monthly")}</SelectItem>
                  <SelectItem value="quarterly">{t("reports.quarterly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSubmit} disabled={!name || !type}>
            {t("reports.createReport")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
