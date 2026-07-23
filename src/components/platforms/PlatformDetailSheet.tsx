import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip } from "recharts";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Calendar,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlatforms } from "@/hooks/usePlatforms";
import { formatDistanceToNow } from "date-fns";
import { PlatformData } from "./PlatformCard";
import { useTranslation } from "react-i18next";

interface PlatformDetailSheetProps {
  platform: PlatformData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getPlatformColor: (id: string) => string;
}

export function PlatformDetailSheet({ platform, open, onOpenChange, getPlatformColor }: PlatformDetailSheetProps) {
  const { t } = useTranslation();
  const { updatePlatformSettings, disconnectPlatform } = usePlatforms();

  const [localSettings, setLocalSettings] = useState(
    platform?.settings || {
      autoPublish: true,
      notifications: true,
      analytics: true,
      contentBackup: true,
    }
  );

  useEffect(() => {
    if (platform?.settings) {
      setLocalSettings(platform.settings);
    }
  }, [platform]);

  if (!platform) return null;

  const color = getPlatformColor(platform.id);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div
              className={cn("p-2.5 rounded-xl", `bg-${platform.id}`, "bg-opacity-20")}
            >
              <platform.icon
                className={cn("h-6 w-6", `text-${platform.id}`)}
              />
            </div>
            <div>
              <SheetTitle className="flex items-center gap-2">
                {platform.name}
                <Badge
                  className={cn(
                    "border-0 text-[10px]",
                    platform.status === "active"
                      ? "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))]"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  {platform.status === "active" ? t("platforms.active") : platform.connected ? t("platforms.paused") : t("platforms.notConnectedBadge")}
                </Badge>
              </SheetTitle>
              <SheetDescription>{platform.username || t("platforms.noAccountConnected")}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: FileText, label: t("platforms.statTotalPostsShort"), value: platform.totalPosts },
              { icon: Calendar, label: t("platforms.statScheduledShort"), value: platform.scheduledCount },
              { icon: CheckCircle2, label: t("platforms.statPublishedShort"), value: platform.publishedCount },
            ].map((stat) => (
              <div key={stat.label} className="p-3 rounded-lg bg-muted/50 border border-border">
                <div className="flex items-center gap-2 mb-1">
                  <stat.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">{stat.label}</span>
                </div>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>

          {/* Posts Chart */}
          {platform.weeklyData.some((d) => d.posts > 0) && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3">{t("platforms.postsCreatedLast7Days")}</h4>
              <div className="h-[160px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={platform.weeklyData}>
                    <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar dataKey="posts" fill={color} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <Separator />

          {/* Latest Post */}
          {platform.latestPost && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                {t("platforms.latestPost")}
              </h4>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm font-medium text-foreground mb-2">"{platform.latestPost.title}"</p>
                <Badge variant="outline" className="text-xs capitalize">
                  {t(`calendar.status${platform.latestPost.status.charAt(0).toUpperCase()}${platform.latestPost.status.slice(1)}`, { defaultValue: platform.latestPost.status.replace("_", " ") })}
                </Badge>
              </div>
            </div>
          )}

          {/* Schedule Info */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              {t("platforms.schedule")}
            </h4>
            <div className="flex gap-3">
              <div className="flex-1 p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
                <p className="text-2xl font-bold text-primary">{platform.scheduledCount}</p>
                <p className="text-xs text-muted-foreground">{t("platforms.pending")}</p>
              </div>
              <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-border text-center">
                <p className="text-2xl font-bold text-foreground">{platform.publishedCount}</p>
                <p className="text-xs text-muted-foreground">{t("platforms.statPublishedShort")}</p>
              </div>
              <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-border text-center">
                <p className="text-2xl font-bold text-foreground">{platform.totalPosts}</p>
                <p className="text-xs text-muted-foreground">{t("platforms.statTotalPostsShort")}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Settings */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              {t("platforms.platformSettings")}
            </h4>
            {!platform.dbId && (
              <p className="text-xs text-muted-foreground mb-3">
                {t("platforms.connectToConfigureSettings")}
              </p>
            )}
            <div className="space-y-3">
              {[
                { id: "autoPublish", label: t("platforms.settingAutoPublish"), description: t("platforms.settingAutoPublishDesc") },
                { id: "notifications", label: t("platforms.settingNotifications"), description: t("platforms.settingNotificationsDesc") },
                { id: "analytics", label: t("platforms.settingAnalytics"), description: t("platforms.settingAnalyticsDesc") },
                { id: "contentBackup", label: t("platforms.settingContentBackup"), description: t("platforms.settingContentBackupDesc") },
              ].map((setting) => (
                <div key={setting.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">{setting.label}</p>
                    <p className="text-xs text-muted-foreground">{setting.description}</p>
                  </div>
                  <Switch
                    checked={localSettings[setting.id as keyof typeof localSettings] ?? true}
                    disabled={!platform.dbId}
                    onCheckedChange={(checked) => {
                      if (!platform.dbId) {
                        toast.error(t("platforms.toastConnectFirst"));
                        return;
                      }
                      const newSettings = { ...localSettings, [setting.id]: checked };
                      setLocalSettings(newSettings);
                      updatePlatformSettings.mutate({
                        id: platform.dbId,
                        settings: newSettings,
                      });
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              className="flex-1 gap-2"
              onClick={() => {
                if (platform.url) {
                  window.open(platform.url, "_blank");
                } else {
                  window.open(`https://${platform.id === "twitter" ? "x" : platform.id}.com`, "_blank");
                }
              }}
            >
              <ExternalLink className="h-4 w-4" />
              {t("platforms.openPlatform", { name: platform.name })}
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              disabled={!platform.dbId}
              onClick={() => {
                if (!platform.dbId) return;
                disconnectPlatform.mutate(platform.dbId, {
                  onSuccess: () => onOpenChange(false)
                });
              }}
            >
              {t("platforms.disconnect")}
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
            <Clock className="h-3 w-3" />
            {platform.lastActivity
              ? t("platforms.lastActivity", { time: formatDistanceToNow(new Date(platform.lastActivity), { addSuffix: true }) })
              : t("platforms.noActivityYet")}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
