import React from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { CONTENT_SCHEDULE, DAYS, getCurrentPeriod } from "@/utils/scheduling";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ScheduleCalendarProps {
  platforms: any[];
}

export function ScheduleCalendar({ platforms }: ScheduleCalendarProps) {
  const { t } = useTranslation();
  const period = getCurrentPeriod();
  const schedule = CONTENT_SCHEDULE[period];

  const getPlatformDisplay = (platformName: string) => {
    return platforms.find(p => p.name.toLowerCase() === platformName.toLowerCase() || p.id.toLowerCase() === platformName.toLowerCase());
  };

  // Reorder days so Monday is first
  const displayDays = [...DAYS.slice(1), DAYS[0]];

  return (
    <div className="relative rounded-3xl bg-card/20 backdrop-blur-xl border border-foreground/10 shadow-2xl overflow-hidden mb-8 ring-1 ring-foreground/5">
      <div className="absolute top-[-50%] right-[-10%] w-[400px] h-[400px] bg-blue-500/10 rounded-full filter blur-[80px] pointer-events-none"></div>

      <div className="flex flex-col md:flex-row md:items-center justify-between p-6 border-b border-foreground/10 bg-foreground/[0.06] relative z-10">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-br from-primary/20 to-blue-500/20 rounded-2xl border border-foreground/10 shadow-inner">
            <Clock className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-outfit font-bold text-foreground flex items-center gap-2">
              {t("platforms.automatedOperations")} <Badge variant="secondary" className="bg-primary/20 text-primary border-none ml-2">{t("platforms.period")} {period}</Badge>
            </h2>
            <p className="text-sm text-muted-foreground/80 mt-1">{t("platforms.scheduleSubtitle")}</p>
          </div>
        </div>
      </div>

      <div className="p-6 relative z-10 bg-gradient-to-b from-transparent to-foreground/[0.06]">
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
          {displayDays.map((day) => {
            const slots = schedule[day] || [];

            return (
              <div key={day} className="flex flex-col border border-foreground/10 rounded-2xl overflow-hidden bg-foreground/5 backdrop-blur-md transition-all duration-300 hover:border-primary/40 hover:bg-foreground/10 hover:shadow-[0_8px_30px_rgba(45,212,191,0.15)] group">
                <div className="bg-gradient-to-b from-foreground/[0.08] to-transparent px-4 py-3 border-b border-foreground/10 text-center flex items-center justify-center">
                  <span className="font-outfit font-bold tracking-widest text-sm text-foreground/90 uppercase">{t(`workflowTest.days.${day}`, { defaultValue: day })}</span>
                </div>
                <div className="p-3 flex-grow flex flex-col gap-2.5 min-h-[140px]">
                  {slots.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      <div className="w-8 h-8 rounded-full border border-dashed border-foreground/20 flex items-center justify-center mb-2">
                        <span className="text-foreground/30 text-xs">-</span>
                      </div>
                      <span className="text-[10px] uppercase tracking-widest text-muted-foreground/50">{t("platforms.rest")}</span>
                    </div>
                  ) : (
                    slots.map((slot, idx) => {
                      const platformInfo = getPlatformDisplay(slot.platform);
                      return (
                        <div key={idx} className="flex flex-col gap-2 bg-foreground/[0.08] hover:bg-gradient-to-br hover:from-primary/20 hover:to-transparent transition-all duration-300 hover:-translate-y-1 p-3 rounded-xl border border-foreground/5 shadow-sm hover:shadow-lg hover:border-primary/30 group/slot">
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <div className="p-1.5 rounded-lg bg-card border border-foreground/10 shadow-inner group-hover/slot:border-primary/30 transition-colors">
                                {platformInfo && platformInfo.icon ? (
                                  <platformInfo.icon className="w-3.5 h-3.5 flex-shrink-0 text-foreground group-hover/slot:text-primary transition-colors" />
                                ) : null}
                              </div>
                              <span className="font-semibold text-xs tracking-wide text-foreground/80 group-hover/slot:text-foreground transition-colors truncate">{platformInfo ? platformInfo.name : slot.platform}</span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">{t("platforms.time")}</span>
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20 font-mono">
                              {slot.time}
                            </Badge>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
