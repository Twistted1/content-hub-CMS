import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  CheckCircle2,
  Clock,
  Settings,
  BarChart3,
  ExternalLink,
  FileText,
  Calendar,
} from "lucide-react";
import React from "react";
import { toast } from "sonner";
import { usePlatforms } from "@/hooks/usePlatforms";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { useTranslation } from "react-i18next";

export interface PlatformData {
  id: string;
  name: string;
  icon: any;
  colorClass: string;
  bgGradient: string;
  connected: boolean;
  username: string | null;
  url?: string;
  totalPosts: number;
  scheduledCount: number;
  publishedCount: number;
  latestPost?: { title: string; status: string } | null;
  lastActivity: string | null;
  weeklyData: { day: string; posts: number }[];
  subPlatforms?: string[];
  dbId?: string;
  status: string;
  settings?: {
    autoPublish: boolean;
    notifications: boolean;
    analytics: boolean;
    contentBackup: boolean;
  };
}

interface PlatformCardProps {
  platform: PlatformData;
  isSelected: boolean;
  onSelect: (id: string) => void;
  getPlatformColor: (id: string) => string;
  onOpenDetail: (platform: PlatformData) => void;
}

export function PlatformCard({ platform, isSelected, onSelect, getPlatformColor, onOpenDetail }: PlatformCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { togglePlatformStatus } = usePlatforms();

  // Local state for immediate UI feedback
  const [localStatus, setLocalStatus] = React.useState(platform.status);

  // Sync if prop changes
  React.useEffect(() => {
    setLocalStatus(platform.status);
  }, [platform.status]);

  const handleCardClick = () => {
    onOpenDetail(platform);
  };

  const stopPropagation = (e: React.MouseEvent) => {
    e.stopPropagation();
  };

  return (
    <Card
      className={`h-full flex flex-col bg-card border-border overflow-hidden transition-all duration-300 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 cursor-pointer ${
        isSelected ? "ring-2 ring-primary" : ""
      }`}
      onClick={handleCardClick}
    >
      <div
        className="h-1.5"
        style={{ backgroundColor: getPlatformColor(platform.id) }}
      />
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl"
              style={{ backgroundColor: `${getPlatformColor(platform.id)}33` }}
            >
              <platform.icon
                className="h-5 w-5"
                style={{ color: getPlatformColor(platform.id) }}
              />
            </div>
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                {platform.name}
              </CardTitle>
              <CardDescription className="text-xs">
                {platform.url ? (
                  <a href={platform.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary hover:underline transition-colors block mt-0.5" onClick={(e) => e.stopPropagation()}>
                    {platform.username || platform.url}
                  </a>
                ) : (
                  platform.username || t("platforms.notConnectedStatus")
                )}
              </CardDescription>
            </div>
          </div>
          <Badge
            variant="default"
            className={`border-0 ${
              localStatus === "active"
                ? "bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] hover:bg-[hsl(var(--success))]/30"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />
            {localStatus === "active" ? t("platforms.active") : t("platforms.paused")}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between gap-4">
        <div className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: t("platforms.statTotalPostsShort"), value: platform.totalPosts },
              { label: t("platforms.statScheduledShort"), value: platform.scheduledCount },
              { label: t("platforms.statPublishedShort"), value: platform.publishedCount },
            ].map((stat) => (
              <div key={stat.label} className="p-2 rounded-lg bg-muted/50 text-center">
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Latest Post */}
          {platform.latestPost && (
            <div className="bg-muted/30 rounded-lg p-3 border border-border/50">
              <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
                <FileText className="h-3 w-3" />
                {t("platforms.latestPost")}
              </p>
              <p className="text-xs font-medium text-foreground mb-1 truncate">
                "{platform.latestPost.title}"
              </p>
              <Badge variant="outline" className="text-[10px] capitalize">
                {t(`calendar.status${platform.latestPost.status.charAt(0).toUpperCase()}${platform.latestPost.status.slice(1)}`, { defaultValue: platform.latestPost.status.replace("_", " ") })}
              </Badge>
            </div>
          )}

          {/* Schedule Info */}
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-primary/5 border border-primary/10">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              <span className="text-xs text-foreground">
                {platform.scheduledCount} {t("platforms.postsScheduledSuffix")}
              </span>
            </div>
            <Badge variant="outline" className="text-[10px]">
              {platform.publishedCount} {t("platforms.publishedSuffix")}
            </Badge>
          </div>
        </div>

        <div className="space-y-4">
          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="h-3 w-3" />
              {platform.lastActivity
                ? t("platforms.lastActivity", { time: formatDistanceToNow(new Date(platform.lastActivity), { addSuffix: true }) })
                : t("platforms.noActivityYet")}
            </div>
            <div onClick={stopPropagation}>
              <Switch
                checked={localStatus === "active"}
                disabled={!platform.dbId}
                onCheckedChange={(checked) => {
                  const newStatus = checked ? "active" : "paused";
                  setLocalStatus(newStatus);

                  if (platform.dbId) {
                    togglePlatformStatus.mutate({
                      id: platform.dbId,
                      status: newStatus,
                    });
                  } else {
                    toast.error(t("platforms.toastConnectFirst"));
                    setLocalStatus(platform.status);
                  }
                }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2" onClick={stopPropagation}>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1 text-xs"
              onClick={() => onOpenDetail(platform)}
            >
              <Settings className="h-3 w-3" />
              {t("platforms.configure")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1 text-xs"
              onClick={() => navigate("/analytics")}
            >
              <BarChart3 className="h-3 w-3" />
              {t("platforms.analyticsButton")}
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-1"
              onClick={() => {
                const urls: Record<string, string> = {
                  youtube: "https://youtube.com",
                  twitter: "https://x.com",
                  instagram: "https://instagram.com",
                  facebook: "https://facebook.com",
                  linkedin: "https://linkedin.com",
                  tiktok: "https://tiktok.com",
                  website: "https://example.com",
                  podcast: "https://podcasters.spotify.com",
                };
                window.open(platform.url || urls[platform.id] || "#", "_blank");
              }}
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
