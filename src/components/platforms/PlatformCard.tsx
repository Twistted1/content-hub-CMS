import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  CheckCircle2,
  Clock,
  Settings,
  BarChart3,
  ExternalLink,
  Calendar,
  PauseCircle,
} from "lucide-react";
import React from "react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlatforms } from "@/hooks/usePlatforms";
import { useNavigate } from "react-router-dom";

export interface PlatformCardData {
  id: string;
  name: string;
  icon: any;
  url: string;
  username: string;
  status: "active" | "paused";
  lastSync: string | null;
  /** Real counts derived from post_platforms in Supabase */
  schedule: { scheduled: number; published: number };
  /** user_platforms.id — undefined if no DB record yet */
  dbId?: string;
  settings?: {
    autoPublish: boolean;
    notifications: boolean;
    analytics: boolean;
    contentBackup: boolean;
  };
}

interface PlatformCardProps {
  platform: PlatformCardData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  getPlatformColor: (id: string) => string;
  onOpenDetail: (platform: PlatformCardData) => void;
}

export function PlatformCard({
  platform,
  isSelected,
  onSelect,
  getPlatformColor,
  onOpenDetail,
}: PlatformCardProps) {
  const navigate = useNavigate();
  const { togglePlatformStatus } = usePlatforms();
  const [localStatus, setLocalStatus] = React.useState<"active" | "paused">(platform.status);

  React.useEffect(() => {
    setLocalStatus(platform.status);
  }, [platform.status]);

  const color = getPlatformColor(platform.id);

  const stopProp = (e: React.MouseEvent) => e.stopPropagation();

  const formatLastSync = (raw: string | null) => {
    if (!raw) return "Never synced";
    try {
      const d = new Date(raw);
      const diff = Date.now() - d.getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return "Just now";
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
    } catch {
      return "Unknown";
    }
  };

  return (
    <Card
      className={cn(
        "bg-card border-border overflow-hidden transition-all duration-300",
        "hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 cursor-pointer",
        isSelected && "ring-2 ring-primary"
      )}
      onClick={() => onOpenDetail(platform)}
    >
      {/* Platform colour stripe */}
      <div className="h-1" style={{ backgroundColor: color }} />

      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl"
              style={{ backgroundColor: `${color}20` }}
            >
              <platform.icon className="h-5 w-5" style={{ color }} />
            </div>
            <div>
              <CardTitle className="text-base">{platform.name}</CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {platform.url ? (
                  <a
                    href={platform.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-primary hover:underline transition-colors"
                    onClick={stopProp}
                  >
                    {platform.username}
                  </a>
                ) : (
                  platform.username
                )}
              </CardDescription>
            </div>
          </div>

          <Badge
            variant="default"
            className={cn(
              "border-0 text-[10px]",
              localStatus === "active"
                ? "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
          >
            {localStatus === "active" ? (
              <><CheckCircle2 className="h-3 w-3 mr-1" />Active</>
            ) : (
              <><PauseCircle className="h-3 w-3 mr-1" />Paused</>
            )}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Real post counts */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xl font-bold text-foreground">{platform.schedule.scheduled}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Scheduled</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50 text-center">
            <p className="text-xl font-bold text-foreground">{platform.schedule.published}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Published</p>
          </div>
        </div>

        {/* Schedule pill */}
        <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/5 border border-primary/10">
          <div className="flex items-center gap-2">
            <Calendar className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-foreground">
              {platform.schedule.scheduled} post{platform.schedule.scheduled !== 1 ? "s" : ""} queued
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {platform.schedule.published} published
          </span>
        </div>

        {/* Footer row — last sync + toggle */}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {formatLastSync(platform.lastSync)}
          </div>

          <div onClick={stopProp}>
            <Switch
              checked={localStatus === "active"}
              onCheckedChange={(checked) => {
                const next = checked ? "active" : "paused";
                setLocalStatus(next);
                if (platform.dbId) {
                  togglePlatformStatus.mutate({ id: platform.dbId, status: next });
                } else {
                  toast.success(`Platform ${next === "active" ? "activated" : "paused"}`);
                }
              }}
            />
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2" onClick={stopProp}>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1 text-xs"
            onClick={() => onOpenDetail(platform)}
          >
            <Settings className="h-3 w-3" />
            Configure
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1 text-xs"
            onClick={() => navigate("/analytics")}
          >
            <BarChart3 className="h-3 w-3" />
            Analytics
          </Button>
          {platform.url && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => window.open(platform.url, "_blank")}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
