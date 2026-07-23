import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";
import { Automation, AutomationRun } from "@/hooks/useAutomations";
import { useTranslation } from "react-i18next";

interface AutomationHistoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  automation: Automation | null;
  runs: AutomationRun[];
}

export function AutomationHistoryDialog({
  open,
  onOpenChange,
  automation,
  runs,
}: AutomationHistoryDialogProps) {
  const { t } = useTranslation();
  if (!automation) return null;

  const automationRuns = runs.filter((r) => r.automationId === automation.id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t("automation.historyTitle")}</DialogTitle>
          <DialogDescription>{automation.name}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="h-[300px] pr-4">
          {automationRuns.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              {t("automation.noRunsYet")}
            </div>
          ) : (
            <div className="space-y-3">
              {automationRuns.map((run) => (
                <div
                  key={run.id}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="mt-0.5">
                    {run.status === "success" && (
                      <CheckCircle className="h-5 w-5 text-emerald-500" />
                    )}
                    {run.status === "failed" && (
                      <XCircle className="h-5 w-5 text-destructive" />
                    )}
                    {run.status === "running" && (
                      <Loader2 className="h-5 w-5 text-primary animate-spin" />
                    )}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <Badge
                        variant={
                          run.status === "success"
                            ? "default"
                            : run.status === "failed"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {run.status === "success" ? t("automation.success") : run.status === "failed" ? t("automation.failed") : run.status}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(run.startedAt).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">{run.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
