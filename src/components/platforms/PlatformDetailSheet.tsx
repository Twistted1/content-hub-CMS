import { useState, useEffect } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Calendar,
  Settings,
  PauseCircle,
} from "lucide-react";
import { toast } from "sonner";
import { usePlatforms } from "@/hooks/usePlatforms";
import type { PlatformCardData } from "./PlatformCard";

interface PlatformDetailSheetProps {
  platform: PlatformCardData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getPlatformColor: (id: string) => string;
}

export function PlatformDetailSheet({
  platform,
  open,
  onOpenChange,
  getPlatformColor,
}: PlatformDetailSheetProps) {
  const { updatePlatformSettings, disconnectPlatform } = usePlatforms();

  const defaultSettings = {
    autoPublish: true,
    notifications: true,
    analytics: true,
    contentBackup: false,
  };

  const [localSettings, setLocalSettings] = useState(
    platform?.settings ?? defaultSettings
  );

  useEffect(() => {
    setLocalSettings(platform?.settings ?? defaultSettings);
  }, [platform]);

  if (!platform) return null;

  const color = getPlatformColor(platform.id);

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
      return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
    } catch {
      return "Unknown";
    }
  };

  const settingRows = [
    { id: "autoPublish",   label: "Auto-publish posts",   desc: "Automatically publish scheduled posts" },
    { id: "notifications", label: "Push notifications",   desc: "Get notified about platform activity" },
    { id: "analytics",     label: "Analytics tracking",   desc: "Track detailed performance metrics" },
    { id: "contentBackup", label: "Content backup",       desc: "Backup all published content" },
  ] as const;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{ backgroundColor: `${color}20` }}>
              <platform.icon className="h-6 w-6" style={{ color }} />
            </div>
            <div>
              <SheetTitle className="flex items-center gap-2">
                {platform.name}
                <Badge
                  className={
                    platform.status === "active"
                      ? "bg-emerald-500/20 text-emerald-400 border-0 text-[10px]"
                      : "bg-muted text-muted-foreground border-0 text-[10px]"
                  }
                >
                  {platform.status === "active" ? (
                    <><CheckCircle2 className="h-3 w-3 mr-1" />Active</>
                  ) : (
                    <><PauseCircle className="h-3 w-3 mr-1" />Paused</>
                  )}
                </Badge>
              </SheetTitle>
              <SheetDescription>{platform.username}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {/* Post counts — real data from Supabase */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Post Activity
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 text-center">
                <p className="text-3xl font-black text-primary">{platform.schedule.scheduled}</p>
                <p className="text-xs text-muted-foreground mt-1">Scheduled</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 border border-border text-center">
                <p className="text-3xl font-black text-foreground">{platform.schedule.published}</p>
                <p className="text-xs text-muted-foreground mt-1">Published</p>
              </div>
            </div>
          </div>

          {/* Last sync */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Last synced: {formatLastSync(platform.lastSync)}
          </div>

          <Separator />

          {/* Settings */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Platform Settings
            </h4>
            <div className="space-y-3">
              {settingRows.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">{s.label}</p>
                    <p className="text-xs text-muted-foreground">{s.desc}</p>
                  </div>
                  <Switch
                    checked={localSettings[s.id] ?? true}
                    onCheckedChange={(checked) => {
                      const next = { ...localSettings, [s.id]: checked };
                      setLocalSettings(next);
                      if (platform.dbId) {
                        updatePlatformSettings.mutate({ id: platform.dbId, settings: next });
                      } else {
                        toast.success(`${s.label} updated`);
                      }
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            {platform.url && (
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => window.open(platform.url, "_blank")}
              >
                <ExternalLink className="h-4 w-4" />
                Open {platform.name}
              </Button>
            )}
            {platform.dbId && (
              <Button
                variant="destructive"
                className="gap-2"
                onClick={() =>
                  disconnectPlatform.mutate(platform.dbId!, {
                    onSuccess: () => onOpenChange(false),
                  })
                }
              >
                Disconnect
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
