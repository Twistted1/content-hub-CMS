import { useState, useRef } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { AreaChart, Area, XAxis, YAxis } from "recharts";
import { toast } from "@/hooks/use-toast";
import { useAppStore } from "@/stores/useAppStore";
import { usePosts } from "@/hooks/usePosts";
import { Post, PostType, PlatformType } from "@/types";
import { PlatformCard } from "@/components/platforms/PlatformCard";
import { PlatformDetailSheet } from "@/components/platforms/PlatformDetailSheet";
import { PostDialog } from "@/components/platforms/PostDialog";
import { ScheduleCalendar } from "@/components/platforms/ScheduleCalendar";
import { PostCard } from "@/components/platforms/PostCard";
import { platforms, totalStats, recentActivity, availablePlatforms, overallPerformance, platformColors } from "@/components/platforms/platformsData";
import {
  Music2,
  RefreshCw,
  CheckCircle2,
  Users,
  Eye,
  Heart,
  TrendingUp,
  Plus,
  Globe,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Zap,
  Share2,
  Activity,
  Calendar,
  Target,
  CalendarClock,
  FileText,
} from "lucide-react";

export default function Platforms() {
  const { posts, addPost, updatePost, deletePost, publishPost } = usePosts();
  const scheduledPosts = (posts || []).filter((p) => p.status === "scheduled");
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [detailPlatform, setDetailPlatform] = useState<any>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("connected");
  const [syncing, setSyncing] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [newPost, setNewPost] = useState({
    title: "",
    content: "",
    platforms: [] as PlatformType[],
    scheduledDate: "",
    scheduledTime: "",
    type: "text" as PostType,
  });
  
  const [isAddPlatformOpen, setIsAddPlatformOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState({ name: "", url: "", description: "" });
  const [customAvailablePlatforms, setCustomAvailablePlatforms] = useState<any[]>(availablePlatforms);
  
  const connectedPlatforms = platforms.filter((p) => p.connected);
  const disconnectedPlatforms = platforms.filter((p) => !p.connected);

  const getTailwindColor = (id: string) => {
    switch (id.toLowerCase()) {
      case 'youtube': return 'bg-red-500/20 text-red-500';
      case 'twitter': return 'bg-zinc-800/20 text-foreground';
      case 'facebook': return 'bg-blue-600/20 text-blue-600';
      case 'instagram': return 'bg-pink-600/20 text-pink-600';
      case 'linkedin': return 'bg-blue-700/20 text-blue-700';
      case 'tiktok': return 'bg-slate-900/20 text-foreground';
      case 'website': return 'bg-teal-500/20 text-teal-500';
      case 'podcast': return 'bg-purple-500/20 text-purple-500';
      case 'rumble': return 'bg-green-500/20 text-green-500';
      default: return 'bg-primary/20 text-primary';
    }
  };

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast({ title: "Sync complete", description: "All platforms have been synced." });
    }, 2000);
  };

  const getPlatformColor = (id: string) => platformColors[id] || "hsl(var(--primary))";

  const handleCreatePost = () => {
    if (!newPost.title || !newPost.content || newPost.platforms.length === 0) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields and select at least one platform.",
        variant: "destructive",
      });
      return;
    }

    const isScheduled = !!(newPost.scheduledDate && newPost.scheduledTime);
    addPost.mutate({
      post: {
        title: newPost.title,
        content: newPost.content,
        status: isScheduled ? "scheduled" : "draft",
        type: newPost.type,
        scheduled_at: isScheduled ? new Date(`${newPost.scheduledDate}T${newPost.scheduledTime}`).toISOString() : null
      },
      platforms: newPost.platforms as any[]
    });
    setNewPost({
      title: "",
      content: "",
      platforms: [],
      scheduledDate: "",
      scheduledTime: "",
      type: "text",
    });
    setIsCreateDialogOpen(false);
    toast({
      title: "Post created",
      description: isScheduled ? "Your post has been scheduled." : "Your post has been saved as a draft.",
    });
  };

  const handleUpdatePost = () => {
    if (!editingPost) return;
    
    updatePost.mutate({
      id: editingPost.id,
      title: editingPost.title,
      content: editingPost.content,
      scheduled_at: editingPost.scheduledAt,
      type: editingPost.type
    });
    setEditingPost(null);
    toast({
      title: "Post updated",
      description: "Your post has been updated successfully.",
    });
  };

  const handleDeletePost = (id: string) => {
    deletePost.mutate(id);
    toast({
      title: "Post deleted",
      description: "The post has been removed.",
    });
  };

  const handlePublishNow = (id: string) => {
    publishPost.mutate(id);
    toast({
      title: "Post published",
      description: "Your post has been published successfully.",
    });
  };

  const togglePlatformSelection = (platformId: string, isNew: boolean = true) => {
    if (isNew) {
      setNewPost(prev => ({
        ...prev,
        platforms: prev.platforms.includes(platformId as any)
          ? prev.platforms.filter((p: any) => p !== platformId)
          : [...prev.platforms, platformId as any]
      }));
    } else if (editingPost) {
      const currentPlatforms = (editingPost.platforms || []) as any[];
      const hasPlatform = currentPlatforms.some(p => (typeof p === 'string' ? p : p.platform) === platformId);
      setEditingPost({
        ...editingPost,
        platforms: hasPlatform
          ? currentPlatforms.filter(p => (typeof p === 'string' ? p : p.platform) !== platformId)
          : [...currentPlatforms, platformId]
      } as any);
    }
  };

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="space-y-8 animate-fade-in">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-white uppercase head-neon mb-2">Platforms</h1>
              <p className="text-sm text-muted-foreground font-medium max-w-xl opacity-60">
                Centralized neural-link for all connected social nodes. Monitor reach and orchestrate global transmissions.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.08] text-white font-black uppercase text-[10px] tracking-widest px-6 py-6 rounded-2xl transition-all"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "SYNCING..." : "SYNC ALL"}
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest px-8 py-6 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all" onClick={() => setIsAddPlatformOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                ADD PLATFORM
              </Button>
            </div>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {[
              { icon: Users, label: "Reach", value: totalStats.totalFollowers, change: `+${totalStats.weeklyGrowth}%`, positive: true, color: "text-primary" },
              { icon: Eye, label: "Impact", value: totalStats.totalViews, change: "+12.4%", positive: true, color: "text-blue-400" },
              { icon: Heart, label: "Pulse", value: totalStats.avgEngagement, change: "+0.3%", positive: true, color: "text-pink-400" },
              { icon: Share2, label: "Velocity", value: totalStats.totalShares, change: "+8.2%", positive: true, color: "text-amber-400" },
              { icon: CheckCircle2, label: "Nodes", value: `${totalStats.connectedPlatforms}/8`, subtext: "active", color: "text-emerald-400" },
              { icon: BarChart3, label: "Transmissions", value: totalStats.totalPosts.toLocaleString(), subtext: "all", color: "text-purple-400" },
              { icon: Calendar, label: "Queue", value: totalStats.scheduledPosts.toString(), subtext: "pending", color: "text-indigo-400" },
              { icon: TrendingUp, label: "Momentum", value: `+${totalStats.weeklyGrowth}%`, subtext: "avg", highlight: true, color: "text-primary" },
            ].map((stat, index) => (
              <div
                key={index}
                className={`glass-card p-4 flex flex-col gap-2 relative overflow-hidden group transition-all duration-500 hover:border-primary/40 ${
                  stat.highlight ? "border-primary/30 shadow-[0_0_20px_-10px_rgba(155,135,245,0.3)]" : ""
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <stat.icon className={`h-3.5 w-3.5 ${stat.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/50">{stat.label}</span>
                </div>
                <div className="text-xl font-black text-white tracking-tighter group-hover:text-primary transition-colors">{stat.value}</div>
                {stat.change ? (
                  <div className={`text-[9px] font-black flex items-center gap-1 ${stat.positive ? "text-emerald-400" : "text-rose-400"}`}>
                    {stat.positive ? <ArrowUpRight className="h-2 w-2" /> : <ArrowDownRight className="h-2 w-2" />}
                    {stat.change}
                  </div>
                ) : (
                  <div className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">{stat.subtext}</div>
                )}
              </div>
            ))}
          </div>

          {/* Performance Overview Chart */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Performance Overview</CardTitle>
                </div>
                <div className="flex gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-muted-foreground">Followers</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-chart-2" />
                    <span className="text-muted-foreground">Engagement %</span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ChartContainer
                config={{
                  followers: { label: "Followers", color: "hsl(var(--primary))" },
                  engagement: { label: "Engagement", color: "hsl(var(--chart-2))" },
                }}
                className="h-[180px] w-full"
              >
                <AreaChart data={overallPerformance}>
                  <defs>
                    <linearGradient id="followerGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area type="monotone" dataKey="followers" stroke="hsl(var(--primary))" fill="url(#followerGradient)" strokeWidth={2} />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-muted/50 flex-wrap">
              <TabsTrigger value="connected" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Connected ({connectedPlatforms.length})
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-2">
                <CalendarClock className="h-4 w-4" />
                Schedule ({scheduledPosts.filter(p => p.status !== "published").length})
              </TabsTrigger>
              <TabsTrigger value="available" className="gap-2">
                <Plus className="h-4 w-4" />
                Available ({disconnectedPlatforms.length + availablePlatforms.length})
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-2">
                <Zap className="h-4 w-4" />
                Activity
              </TabsTrigger>
              <TabsTrigger value="insights" className="gap-2">
                <Sparkles className="h-4 w-4" />
                Insights
              </TabsTrigger>
            </TabsList>

            {/* Connected Platforms Tab */}
            <TabsContent value="connected" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {connectedPlatforms.map((platform) => (
                  <PlatformCard
                    key={platform.id}
                    platform={platform}
                    isSelected={selectedPlatform === platform.id}
                    onSelect={(id) => setSelectedPlatform(selectedPlatform === id ? null : id)}
                    getPlatformColor={getPlatformColor}
                    onOpenDetail={(p) => {
                      setDetailPlatform(p);
                      setDetailOpen(true);
                    }}
                  />
                ))}
              </div>
            </TabsContent>

            {/* Schedule Tab */}
            <TabsContent value="schedule" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Scheduled Posts</h3>
                  <p className="text-sm text-muted-foreground">Manage and schedule content across all platforms</p>
                </div>
                <PostDialog
                  isOpen={isCreateDialogOpen}
                  onOpenChange={setIsCreateDialogOpen}
                  newPost={newPost}
                  onNewPostChange={setNewPost}
                  onCreatePost={handleCreatePost}
                  connectedPlatforms={connectedPlatforms}
                  getPlatformColor={getPlatformColor}
                  togglePlatformSelection={(id) => togglePlatformSelection(id, true)}
                />
              </div>

              <ScheduleCalendar platforms={connectedPlatforms} />

              <div className="space-y-3">
                {scheduledPosts.filter(p => p.status !== "published").length === 0 ? (
                  <Card className="bg-card border-border border-dashed">
                    <CardContent className="p-8 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">No scheduled posts</h3>
                      <p className="text-sm text-muted-foreground mb-4">Create your first post to get started</p>
                      <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create Post
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  scheduledPosts
                    .filter(p => p.status !== "published")
                    .map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        platforms={connectedPlatforms}
                        getPlatformColor={getPlatformColor}
                        onEdit={setEditingPost}
                        onDelete={handleDeletePost}
                        onPublish={handlePublishNow}
                      />
                    ))
                )}
              </div>
            </TabsContent>

            {/* Edit Post Dialog */}
            <Dialog open={!!editingPost} onOpenChange={(open) => !open && setEditingPost(null)}>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Edit Post</DialogTitle>
                  <DialogDescription>
                    Update your scheduled post details.
                  </DialogDescription>
                </DialogHeader>
                {editingPost && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-title">Title</Label>
                      <Input
                        id="edit-title"
                        value={editingPost.title}
                        onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-content">Content</Label>
                      <Textarea
                        id="edit-content"
                        rows={4}
                        value={editingPost.content}
                        onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Platforms</Label>
                      <div className="flex flex-wrap gap-2">
                        {connectedPlatforms.map((platform) => (
                          <div
                            key={platform.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                              (editingPost.platforms || []).some((p: any) => (typeof p === 'string' ? p : p.platform) === platform.id)
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => togglePlatformSelection(platform.id, false)}
                          >
                            <Checkbox
                              checked={(editingPost.platforms || []).some((p: any) => (typeof p === 'string' ? p : p.platform) === platform.id)}
                              onCheckedChange={() => togglePlatformSelection(platform.id, false)}
                            />
                            <platform.icon
                              className="h-4 w-4"
                              style={{ color: getPlatformColor(platform.id) }}
                            />
                            <span className="text-sm">{platform.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="edit-date">Schedule Date</Label>
                        <Input
                          id="edit-date"
                          type="date"
                          value={editingPost.scheduledAt ? editingPost.scheduledAt.split("T")[0] : ""}
                          onChange={(e) => {
                            const time = editingPost.scheduledAt && editingPost.scheduledAt.includes("T") ? editingPost.scheduledAt.split("T")[1] : "00:00:00Z";
                            setEditingPost({ ...editingPost, scheduledAt: e.target.value ? `${e.target.value}T${time}` : null } as any);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="edit-time">Schedule Time</Label>
                        <Input
                          id="edit-time"
                          type="time"
                          value={editingPost.scheduledAt && editingPost.scheduledAt.includes("T") ? editingPost.scheduledAt.split("T")[1].substring(0,5) : ""}
                          onChange={(e) => {
                            const date = editingPost.scheduledAt ? editingPost.scheduledAt.split("T")[0] : new Date().toISOString().split("T")[0];
                            setEditingPost({ ...editingPost, scheduledAt: `${date}T${e.target.value}:00Z` } as any);
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingPost(null)}>
                    Cancel
                  </Button>
                  <Button onClick={handleUpdatePost}>
                    Save Changes
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Available Platforms Tab */}
            <TabsContent value="available" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {disconnectedPlatforms.map((platform) => (
                  <Card
                    key={platform.id}
                    className="bg-card border-border border-dashed hover:border-primary/50 transition-all duration-300 hover:shadow-lg flex flex-col h-full"
                  >
                    <CardContent className="p-6 text-center flex flex-col flex-grow">
                      <div
                        className={`p-4 rounded-2xl mx-auto w-fit mb-4 ${getTailwindColor(platform.id)}`}
                      >
                        <platform.icon className="h-8 w-8" />
                      </div>
                      <h3 className="font-semibold text-lg mb-1 text-foreground">{platform.name}</h3>
                      <p className="text-sm text-muted-foreground mb-4 flex-grow">
                        Connect your {platform.name} account to track performance
                      </p>
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 mt-auto"
                        onClick={() => {
                          toast({
                            title: `Connecting ${platform.name}...`,
                            description: "You'll be redirected to authenticate with your account.",
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Connect {platform.name}
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {customAvailablePlatforms.map((platform) => (
                  <Card
                    key={platform.id}
                    className="bg-card border-border border-dashed hover:border-primary/50 transition-all duration-300 hover:shadow-lg"
                  >
                    <CardContent className="p-6 text-center">
                      <span className="text-5xl mb-4 block flex justify-center items-center h-12 w-12 mx-auto">
                        {typeof platform.icon === 'string' ? platform.icon : <platform.icon className="h-10 w-10 text-muted-foreground" />}
                      </span>
                      <h3 className="font-semibold text-lg mb-1 text-foreground">{platform.name}</h3>
                      <p className="text-sm text-muted-foreground mb-2">{platform.description}</p>
                      <p className="text-xs text-primary mb-4 flex-grow">{platform.users} active users</p>
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 mt-auto"
                        onClick={() => {
                          toast({
                            title: `Connecting ${platform.name}...`,
                            description: "You'll be redirected to authenticate with your account.",
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Connect {platform.name}
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                <Card className="bg-muted/20 border-border border-dashed hover:border-primary/50 transition-all flex flex-col h-full">
                  <CardContent className="p-6 text-center flex flex-col flex-grow">
                    <div className="p-4 rounded-2xl bg-muted/50 mx-auto w-fit mb-4">
                      <Plus className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1 text-foreground">Add Custom Platform</h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-grow">
                      Configure a new custom destination for your content.
                    </p>
                    <Button
                      variant="outline"
                      className="w-full mt-auto"
                      onClick={() => setIsAddPlatformOpen(true)}
                    >
                      Add Platform
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-primary" />
                      <CardTitle>Recent Activity</CardTitle>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                      toast({ title: "Activity log", description: "Full activity history coming soon." });
                    }}>
                      View All
                    </Button>
                  </div>
                  <CardDescription>Latest updates from your connected platforms</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {recentActivity.map((activity, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border/50 transition-all duration-200 hover:bg-muted/50"
                      >
                        <div
                          className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                            activity.positive
                              ? "bg-gradient-to-br from-emerald-500/20 to-emerald-600/10"
                              : "bg-gradient-to-br from-red-500/20 to-red-600/10"
                          }`}
                        >
                          <activity.icon
                            className={`h-6 w-6 ${activity.positive ? "text-emerald-500" : "text-red-500"}`}
                          />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge
                              variant="outline"
                              className="text-[10px] px-1.5 py-0"
                            >
                              {activity.platform}
                            </Badge>
                            <Badge
                              variant={activity.positive ? "default" : "destructive"}
                              className={`text-[10px] px-1.5 py-0 ${
                                activity.positive
                                  ? "bg-emerald-500/20 text-emerald-500 hover:bg-emerald-500/30"
                                  : ""
                              }`}
                            >
                              {activity.type}
                            </Badge>
                          </div>
                          <p className="font-medium text-foreground">{activity.action}</p>
                          <p className="text-sm text-muted-foreground">{activity.detail}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">{activity.time}</p>
                          {activity.positive ? (
                            <ArrowUpRight className="h-4 w-4 text-[hsl(var(--success))] ml-auto mt-1" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-destructive ml-auto mt-1" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Insights Tab */}
            <TabsContent value="insights" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Best Performing Platform */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">Best Performing</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-br from-pink-500/10 to-purple-500/10 border border-primary/20">
                      <div className="p-3 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-500/20">
                        <Music2 className="h-8 w-8 text-pink-500" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg text-foreground">TikTok</h3>
                        <p className="text-sm text-muted-foreground">Highest engagement rate this month</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">12.4%</p>
                        <p className="text-xs text-emerald-500 flex items-center justify-end gap-1">
                          <ArrowUpRight className="h-3 w-3" />
                          +5.8% growth
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 space-y-3">
                      <h4 className="text-sm font-medium text-muted-foreground">Platform Ranking</h4>
                      {connectedPlatforms
                        .sort((a, b) => parseFloat(b.stats?.engagement || "0") - parseFloat(a.stats?.engagement || "0"))
                        .map((platform, index) => (
                          <div key={platform.id} className="flex items-center gap-3">
                            <span className="text-lg font-bold text-muted-foreground w-6">#{index + 1}</span>
                            <platform.icon
                              className="h-5 w-5"
                              style={{ color: getPlatformColor(platform.id) }}
                            />
                            <span className="flex-1 text-sm text-foreground">{platform.name}</span>
                            <span className="text-sm font-medium text-foreground">
                              {platform.stats?.engagement}
                            </span>
                          </div>
                        ))}
                    </div>
                  </CardContent>
                </Card>

                {/* AI Recommendations */}
                <Card className="bg-card border-border">
                  <CardHeader>
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">AI Recommendations</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {[
                      {
                        title: "Post more on TikTok",
                        desc: "Your TikTok engagement is 4x higher than other platforms. Consider increasing posting frequency.",
                        priority: "high",
                      },
                      {
                        title: "Revitalize Facebook strategy",
                        desc: "Facebook reach has declined 5%. Try video content to boost engagement.",
                        priority: "medium",
                      },
                      {
                        title: "Optimal posting time",
                        desc: "Your audience is most active between 6-8 PM. Schedule posts accordingly.",
                        priority: "medium",
                      },
                      {
                        title: "Cross-promote content",
                        desc: "Repurpose your top YouTube videos as short clips for TikTok and Reels.",
                        priority: "low",
                      },
                    ].map((rec, index) => (
                      <div
                        key={index}
                        className="p-4 rounded-xl bg-muted/30 border border-border/50 hover:bg-muted/50 transition-all cursor-pointer"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <h4 className="font-medium text-foreground">{rec.title}</h4>
                              <Badge
                                variant={rec.priority === "high" ? "destructive" : rec.priority === "medium" ? "secondary" : "outline"}
                                className="text-[10px]"
                              >
                                {rec.priority}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{rec.desc}</p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary"
                            onClick={() => {
                              toast({
                                title: `Applying: ${rec.title}`,
                                description: "This recommendation has been added to your strategy.",
                              });
                            }}
                          >
                            Apply
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
          <PlatformDetailSheet
            platform={detailPlatform}
            open={detailOpen}
            onOpenChange={setDetailOpen}
            getPlatformColor={getPlatformColor}
          />
        </div>
      </TooltipProvider>
      {/* Add Custom Platform Dialog */}
      <Dialog open={isAddPlatformOpen} onOpenChange={setIsAddPlatformOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Add Custom Platform</DialogTitle>
            <DialogDescription>
              Create a custom integration endpoint for your content dashboard.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="platform-name">Platform Name</Label>
              <Input
                id="platform-name"
                placeholder="e.g. Medium, Substack, Custom CMS"
                value={newPlatform.name}
                onChange={(e) => setNewPlatform({ ...newPlatform, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="platform-url">Connection URL (Optional)</Label>
              <Input
                id="platform-url"
                placeholder="https://"
                value={newPlatform.url}
                onChange={(e) => setNewPlatform({ ...newPlatform, url: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="platform-desc">Description</Label>
              <Textarea
                id="platform-desc"
                placeholder="What type of content goes here?"
                value={newPlatform.description}
                onChange={(e) => setNewPlatform({ ...newPlatform, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPlatformOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={() => {
                if (!newPlatform.name) {
                  toast({ title: "Name required", description: "Please enter a platform name.", variant: "destructive" });
                  return;
                }
                setCustomAvailablePlatforms([...customAvailablePlatforms, {
                  id: newPlatform.name.toLowerCase().replace(/\s+/g, '-'),
                  name: newPlatform.name,
                  icon: Globe,
                  description: newPlatform.description || "Custom platform integration",
                  users: "Custom"
                }]);
                setIsAddPlatformOpen(false);
                setNewPlatform({ name: "", url: "", description: "" });
                toast({ title: "Platform Added", description: `${newPlatform.name} is now available for connection in your dashboard.` });
              }}
            >
              Add Platform
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
