import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";
import {
  CheckCircle2,
  Heart,
  TrendingUp,
  Clock,
  ExternalLink,
  Sparkles,
  MessageCircle,
  Calendar,
  Eye,
  Share2,
  Users,
  Settings,
  Bell,
  Shield,
} from "lucide-react";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { usePlatforms } from "@/hooks/usePlatforms";
import { PlatformType } from "@/types";

interface PlatformData {
  id: string;
  name: string;
  icon: LucideIcon;
  colorClass: string;
  bgGradient: string;
  connected: boolean;
  username: string;
  followers: number;
  followersDisplay: string;
  posts: number;
  lastSync: string;
  status: string;
  stats: { views: string; engagement: string; shares: string };
  weeklyGrowth: number;
  topPost?: { likes: number; comments: number; title: string };
  weeklyData: { day: string; followers: number; views: number }[];
  schedule?: { pending: number; published: number };
  subPlatforms?: string[];
  dbId?: string;
  settings?: {
    autoPublish: boolean;
    notifications: boolean;
    analytics: boolean;
    contentBackup: boolean;
  };
}

interface PlatformDetailSheetProps {
  platform: PlatformData | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getPlatformColor: (id: string) => string;
}

export function PlatformDetailSheet({ platform, open, onOpenChange, getPlatformColor }: PlatformDetailSheetProps) {
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
                <Badge className="bg-[hsl(var(--success))]/20 text-[hsl(var(--success))] border-0 text-[10px]">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Active
                </Badge>
              </SheetTitle>
              <SheetDescription>{platform.username}</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="space-y-6 pb-6">
          {/* Key Stats */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { icon: Users, label: "Followers", value: platform.followersDisplay },
              { icon: Eye, label: "Views", value: platform.stats.views },
              { icon: Heart, label: "Engagement", value: platform.stats.engagement },
              { icon: Share2, label: "Shares", value: platform.stats.shares },
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

          {/* Growth Chart */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3">Weekly Performance</h4>
            <div className="h-[160px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={platform.weeklyData}>
                  <defs>
                    <linearGradient id={`gradient-${platform.id}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={color} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      color: "hsl(var(--foreground))",
                    }}
                  />
                  <Area type="monotone" dataKey="views" stroke={color} fill={`url(#gradient-${platform.id})`} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Growth */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground">Weekly Growth</span>
              <span className={platform.weeklyGrowth >= 0 ? "text-[hsl(var(--success))]" : "text-destructive"}>
                {platform.weeklyGrowth >= 0 ? "+" : ""}{platform.weeklyGrowth}%
              </span>
            </div>
            <Progress value={Math.min(Math.abs(platform.weeklyGrowth) * 10, 100)} className="h-2" />
          </div>

          <Separator />

          {/* Top Post */}
          {platform.topPost && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Top Performing Post
              </h4>
              <div className="p-4 rounded-lg bg-muted/30 border border-border/50">
                <p className="text-sm font-medium text-foreground mb-2">"{platform.topPost.title}"</p>
                <div className="flex gap-4 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Heart className="h-4 w-4 text-destructive" />
                    {platform.topPost.likes.toLocaleString()} likes
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <MessageCircle className="h-4 w-4 text-primary" />
                    {platform.topPost.comments.toLocaleString()} comments
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Schedule Info */}
          {platform.schedule && (
            <div>
              <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Schedule
              </h4>
              <div className="flex gap-3">
                <div className="flex-1 p-3 rounded-lg bg-primary/5 border border-primary/10 text-center">
                  <p className="text-2xl font-bold text-primary">{platform.schedule.pending}</p>
                  <p className="text-xs text-muted-foreground">Pending</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <p className="text-2xl font-bold text-foreground">{platform.schedule.published}</p>
                  <p className="text-xs text-muted-foreground">Published</p>
                </div>
                <div className="flex-1 p-3 rounded-lg bg-muted/50 border border-border text-center">
                  <p className="text-2xl font-bold text-foreground">{platform.posts}</p>
                  <p className="text-xs text-muted-foreground">Total Posts</p>
                </div>
              </div>
            </div>
          )}

          <Separator />

          {/* Settings */}
          <div>
            <h4 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Settings className="h-4 w-4 text-primary" />
              Platform Settings
            </h4>
            <div className="space-y-3">
              {[
                { id: "autoPublish", label: "Auto-publish posts", description: "Automatically publish scheduled posts" },
                { id: "notifications", label: "Push notifications", description: "Get notified about engagement spikes" },
                { id: "analytics", label: "Analytics tracking", description: "Track detailed performance metrics" },
                { id: "contentBackup", label: "Content backup", description: "Backup all published content" },
              ].map((setting) => (
                <div key={setting.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/50">
                  <div>
                    <p className="text-sm font-medium text-foreground">{setting.label}</p>
                    <p className="text-xs text-muted-foreground">{setting.description}</p>
                  </div>
                  <Switch
                    checked={localSettings[setting.id as keyof typeof localSettings] ?? true}
                    onCheckedChange={(checked) => {
                      // Update local state immediately for visual responsiveness
                      const newSettings = { ...localSettings, [setting.id]: checked };
                      setLocalSettings(newSettings);
                      
                      // Also push to DB if connected
                      if (platform.dbId) {
                        updatePlatformSettings.mutate({
                          id: platform.dbId,
                          settings: newSettings,
                        });
                      } else {
                        toast.success(`${setting.label} updated`);
                      }
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
                // @ts-ignore - url property might not be in type definition yet
                if (platform.url) {
                   // @ts-ignore
                   window.open(platform.url, "_blank");
                } else {
                   window.open(`https://${platform.id === "twitter" ? "x" : platform.id}.com`, "_blank");
                }
              }}
            >
              <ExternalLink className="h-4 w-4" />
              Open {platform.name}
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={() => {
                if (!platform.dbId) return;
                disconnectPlatform.mutate(platform.dbId, {
                  onSuccess: () => onOpenChange(false)
                });
              }}
            >
              Disconnect
            </Button>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground pt-2">
            <Clock className="h-3 w-3" />
            Last synced {platform.lastSync}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
