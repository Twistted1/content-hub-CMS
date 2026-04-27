import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Twitter, Instagram, Facebook, Globe, Linkedin, ArrowUpRight, ArrowDownRight, Activity } from "lucide-react";
import { usePosts } from "@/hooks/usePosts";

const PLATFORM_ICONS: Record<string, any> = {
  twitter: Twitter,
  instagram: Instagram,
  facebook: Facebook,
  linkedin: Linkedin,
  website: Globe,
};

const PLATFORM_COLORS: Record<string, { icon: string; accent: string }> = {
  twitter: { icon: "text-sky-400", accent: "bg-sky-500" },
  instagram: { icon: "text-pink-500", accent: "bg-pink-500" },
  facebook: { icon: "text-blue-600", accent: "bg-blue-600" },
  linkedin: { icon: "text-blue-500", accent: "bg-blue-500" },
  website: { icon: "text-emerald-500", accent: "bg-emerald-500" },
};

export function PlatformPerformance() {
  const { posts, isLoading } = usePosts();

  // Aggregate posts by platform
  const stats = posts.reduce((acc: any, post: any) => {
    const platform = post.platforms?.[0]?.platform?.toLowerCase() || 'website';
    if (!acc[platform]) acc[platform] = 0;
    acc[platform]++;
    return acc;
  }, {});

  const totalPosts = posts.length || 1;
  
  const platforms = Object.entries(stats).map(([name, count]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    count: count as number,
    icon: PLATFORM_ICONS[name] || Globe,
    meta: PLATFORM_COLORS[name] || { icon: "text-muted-foreground", accent: "bg-muted" }
  })).sort((a, b) => b.count - a.count);

  return (
    <Card className="bg-card/20 backdrop-blur-3xl border-border/50 shadow-2xl overflow-hidden rounded-[2.5rem] group h-full">
      <CardHeader className="p-10 border-b border-border/50 flex flex-row items-center justify-between bg-muted/20">
        <div>
          <CardTitle className="text-xl font-black uppercase italic tracking-tighter flex items-center gap-4">
             <Activity className="h-6 w-6 text-primary" />
             Platform Distribution
          </CardTitle>
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mt-2 opacity-60">Success metrics per network</p>
        </div>
      </CardHeader>
      <CardContent className="p-10 space-y-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
        ) : platforms.length === 0 ? (
          <div className="py-20 text-center text-muted-foreground">
             <p className="text-xs font-bold uppercase tracking-widest opacity-40 italic">No distribution data available</p>
          </div>
        ) : (
          platforms.map((platform) => {
            const percentage = (platform.count / totalPosts) * 100;
            const Icon = platform.icon;
            return (
              <div key={platform.name} className="space-y-3 group-item">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={cn("p-2.5 rounded-xl bg-muted/30 group-hover:bg-muted/50 transition-colors", platform.meta.icon)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-black italic uppercase tracking-tighter text-sm text-foreground">{platform.name}</p>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">{platform.count} posts deployed</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-foreground opacity-40 group-hover:opacity-100 transition-opacity">{Math.round(percentage)}%</span>
                </div>
                      <div className="h-1 bg-muted/30 rounded-full overflow-hidden relative">
                        <div 
                          className={cn("absolute inset-y-0 left-0 rounded-full transition-all duration-1000 dynamic-fill-bar", platform.meta.accent)} 
                          ref={(el) => {
                            if (el) el.style.width = `${percentage}%`;
                          }}
                        />
                      </div>
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
