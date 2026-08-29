import { useState, useMemo } from "react";
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
import { BarChart, Bar, XAxis, YAxis } from "recharts";
import { toast } from "@/hooks/use-toast";
import { usePosts } from "@/hooks/usePosts";
import { usePlatforms } from "@/hooks/usePlatforms";
import { Post, PostType, PlatformType } from "@/types";
import { PlatformCard, PlatformData } from "@/components/platforms/PlatformCard";
import { PlatformDetailSheet } from "@/components/platforms/PlatformDetailSheet";
import { PostDialog } from "@/components/platforms/PostDialog";
import { ScheduleCalendar } from "@/components/platforms/ScheduleCalendar";
import { PostCard } from "@/components/platforms/PostCard";
import { platforms as platformIdentities, availablePlatforms, platformColors } from "@/components/platforms/platformsData";
import { DirectPublishingPanel } from "@/components/platforms/DirectPublishingPanel";
import { usePlatformOAuth, publishPostDirect, DirectPlatform } from "@/hooks/usePlatformOAuth";
import { subDays, format, isSameDay, formatDistanceToNow } from "date-fns";
import {
  RefreshCw,
  CheckCircle2,
  Plus,
  Globe,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Activity,
  Calendar,
  CalendarClock,
  FileText,
} from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Platforms() {
  const { t } = useTranslation();
  const { posts, addPost, updatePost, deletePost, publishPost } = usePosts();
  const { isConnected } = usePlatformOAuth();
  const { platforms: userPlatforms } = usePlatforms();
  const scheduledPosts = (posts || []).filter((p) => p.status === "scheduled");
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [detailPlatform, setDetailPlatform] = useState<PlatformData | null>(null);
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

  // Merge static branding config with real connection status (user_platforms /
  // OAuth tokens) and real post counts. No follower/view/engagement numbers -
  // this app has no analytics ingestion pipeline to source them from.
  const last7Days = useMemo(() => Array.from({ length: 7 }, (_, i) => subDays(new Date(), 6 - i)), []);

  const platforms: PlatformData[] = useMemo(() => {
    return platformIdentities.map((identity) => {
      const userPlatform = userPlatforms.find((up) => up.platformType === identity.id);
      const directConnected =
        (identity.id === "linkedin" || identity.id === "twitter") &&
        isConnected(identity.id as DirectPlatform);
      const connected = !!userPlatform || directConnected;

      const platformPosts = (posts || []).filter((p) =>
        ((p as any).platforms || []).some((pp: any) => pp.platform === identity.id)
      );
      const scheduledCount = platformPosts.filter((p) => p.status === "scheduled").length;
      const publishedCount = platformPosts.filter((p) => p.status === "published").length;
      const latestPost = [...platformPosts].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )[0];

      const weeklyData = last7Days.map((day) => ({
        day: format(day, "EEE"),
        posts: platformPosts.filter((p) => isSameDay(new Date(p.createdAt), day)).length,
      }));

      return {
        ...identity,
        connected,
        username: userPlatform?.username || userPlatform?.accountName || null,
        dbId: userPlatform?.id,
        status: userPlatform?.status || (connected ? "active" : "inactive"),
        settings: userPlatform?.settings,
        totalPosts: platformPosts.length,
        scheduledCount,
        publishedCount,
        latestPost: latestPost ? { title: latestPost.title, status: latestPost.status } : null,
        lastActivity: userPlatform?.lastSync || latestPost?.createdAt || null,
        weeklyData,
      };
    });
  }, [userPlatforms, posts, isConnected, last7Days]);

  const connectedPlatforms = platforms.filter((p) => p.connected);
  const disconnectedPlatforms = platforms.filter((p) => !p.connected);

  const platformPostDistribution = connectedPlatforms
    .filter((p) => p.totalPosts > 0)
    .map((p) => ({ name: p.name, posts: p.totalPosts }))
    .sort((a, b) => b.posts - a.posts);

  const recentPosts = [...(posts || [])]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

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
      toast({ title: t("platforms.syncCompleteTitle"), description: t("platforms.syncCompleteDesc") });
    }, 2000);
  };

  const getPlatformColor = (id: string) => platformColors[id] || "hsl(var(--primary))";

  const handleCreatePost = () => {
    if (!newPost.title || !newPost.content || newPost.platforms.length === 0) {
      toast({
        title: t("platforms.missingFieldsTitle"),
        description: t("platforms.missingFieldsDesc"),
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
      title: t("platforms.postCreatedTitle"),
      description: isScheduled ? t("platforms.postScheduledDesc") : t("platforms.postDraftDesc"),
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
      title: t("platforms.postUpdatedTitle"),
      description: t("platforms.postUpdatedDesc"),
    });
  };

  const handleDeletePost = (id: string) => {
    deletePost.mutate(id);
    toast({
      title: t("platforms.postDeletedTitle"),
      description: t("platforms.postDeletedDesc"),
    });
  };

  const handlePublishNow = async (id: string) => {
    const post = posts.find((p) => p.id === id);
    const targetPlatforms = ((post?.platforms || []) as any[])
      .map((p) => (typeof p === "string" ? p : p.platform))
      .filter((p): p is DirectPlatform => p === "linkedin" || p === "twitter");
    const directPlatforms = targetPlatforms.filter((p) => isConnected(p));

    if (directPlatforms.length > 0) {
      try {
        const result = await publishPostDirect(id, directPlatforms);
        const failed = (result?.results || []).filter((r: any) => !r.success);
        if (result?.success) {
          toast({
            title: t("platforms.postPublishedTitle"),
            description: failed.length
              ? t("platforms.publishedPartialDesc", { count: failed.length })
              : t("platforms.publishedToDesc", { platforms: directPlatforms.join(", ") }),
          });
        } else {
          toast({
            title: t("platforms.publishFailedTitle"),
            description: failed.map((f: any) => `${f.platform}: ${f.error}`).join("; "),
            variant: "destructive",
          });
        }
      } catch (e: any) {
        toast({ title: t("platforms.publishFailedTitle"), description: e.message, variant: "destructive" });
      }
      return;
    }

    // Fallback: mark as published (webhook-driven platforms)
    publishPost.mutate(id);
    toast({
      title: t("platforms.postPublishedTitle"),
      description: t("platforms.postMarkedPublishedDesc"),
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
              <h1 className="page-title mb-2">{t("platforms.title")}</h1>
              <p className="text-sm text-muted-foreground font-medium max-w-xl opacity-60">
                {t("platforms.subtitle")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="bg-foreground/[0.07] border-foreground/[0.16] hover:bg-foreground/[0.16] text-foreground font-black uppercase text-[10px] tracking-widest px-6 py-6 rounded-2xl transition-all"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? t("platforms.syncing") : t("platforms.syncAll")}
              </Button>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-black uppercase text-[10px] tracking-widest px-8 py-6 rounded-2xl shadow-xl shadow-primary/20 active:scale-95 transition-all" onClick={() => setIsAddPlatformOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t("platforms.addPlatform")}
              </Button>
            </div>
          </div>

          {/* Overview Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { icon: CheckCircle2, label: t("platforms.statConnected"), value: `${connectedPlatforms.length}/${platforms.length}`, subtext: t("platforms.statPlatformsSubtext"), color: "text-success" },
              { icon: BarChart3, label: t("platforms.statTotalPosts"), value: (posts || []).length.toString(), subtext: t("platforms.statAllTime"), color: "text-brand-accent" },
              { icon: Calendar, label: t("platforms.statScheduled"), value: scheduledPosts.filter((p) => p.status !== "published").length.toString(), subtext: t("platforms.statPending"), color: "text-info" },
              { icon: FileText, label: t("platforms.statPublished"), value: (posts || []).filter((p) => p.status === "published").length.toString(), subtext: t("platforms.statAllTime"), color: "text-primary" },
            ].map((stat, index) => (
              <div
                key={index}
                className="glass-card p-4 flex flex-col gap-2 relative overflow-hidden group transition-all duration-500 hover:border-primary/40"
              >
                <div className="flex items-center justify-between mb-1">
                  <stat.icon className={`h-3.5 w-3.5 ${stat.color} opacity-80 group-hover:opacity-100 transition-opacity`} />
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/50">{stat.label}</span>
                </div>
                <div className="text-xl font-black text-foreground tracking-tighter group-hover:text-primary transition-colors">{stat.value}</div>
                <div className="text-[9px] font-black text-muted-foreground/30 uppercase tracking-widest">{stat.subtext}</div>
              </div>
            ))}
          </div>

          {/* Posts by Platform */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">{t("platforms.postsByPlatform")}</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              {platformPostDistribution.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {t("platforms.noPostsYetChart")}
                </p>
              ) : (
                <ChartContainer
                  config={{ posts: { label: t("platforms.postsLabel"), color: "hsl(var(--primary))" } }}
                  className="h-[180px] w-full"
                >
                  <BarChart data={platformPostDistribution}>
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} allowDecimals={false} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="posts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <DirectPublishingPanel />

          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-muted/50 flex-wrap">
              <TabsTrigger value="connected" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                {t("platforms.tabConnected")} ({connectedPlatforms.length})
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-2">
                <CalendarClock className="h-4 w-4" />
                {t("platforms.tabSchedule")} ({scheduledPosts.filter(p => p.status !== "published").length})
              </TabsTrigger>
              <TabsTrigger value="available" className="gap-2">
                <Plus className="h-4 w-4" />
                {t("platforms.tabAvailable")} ({disconnectedPlatforms.length + availablePlatforms.length})
              </TabsTrigger>
              <TabsTrigger value="activity" className="gap-2">
                <Zap className="h-4 w-4" />
                {t("platforms.tabActivity")}
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
                  <h3 className="text-lg font-semibold text-foreground">{t("platforms.scheduledPostsTitle")}</h3>
                  <p className="text-sm text-muted-foreground">{t("platforms.scheduledPostsDesc")}</p>
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
                      <h3 className="text-lg font-medium text-foreground mb-2">{t("platforms.noScheduledPosts")}</h3>
                      <p className="text-sm text-muted-foreground mb-4">{t("platforms.noScheduledPostsDesc")}</p>
                      <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        {t("platforms.createPost")}
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
                  <DialogTitle>{t("platforms.editPostTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("platforms.editPostDesc")}
                  </DialogDescription>
                </DialogHeader>
                {editingPost && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-title">{t("platforms.editTitle")}</Label>
                      <Input
                        id="edit-title"
                        value={editingPost.title}
                        onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-content">{t("platforms.editContent")}</Label>
                      <Textarea
                        id="edit-content"
                        rows={4}
                        value={editingPost.content}
                        onChange={(e) => setEditingPost({ ...editingPost, content: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("platforms.postPlatforms")}</Label>
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
                        <Label htmlFor="edit-date">{t("platforms.scheduleDate")}</Label>
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
                        <Label htmlFor="edit-time">{t("platforms.scheduleTime")}</Label>
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
                    {t("platforms.cancel")}
                  </Button>
                  <Button onClick={handleUpdatePost}>
                    {t("platforms.saveChanges")}
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
                        {t("platforms.connectAccountPrefix")} {platform.name} {t("platforms.connectAccountSuffix")}
                      </p>
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 mt-auto"
                        onClick={() => {
                          toast({
                            title: t("platforms.connectingToast", { name: platform.name }),
                            description: t("platforms.connectingDesc"),
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t("platforms.connectButton", { name: platform.name })}
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
                      <p className="text-xs text-primary mb-4 flex-grow">{platform.users} {t("platforms.activeUsersSuffix")}</p>
                      <Button
                        className="w-full bg-primary hover:bg-primary/90 mt-auto"
                        onClick={() => {
                          toast({
                            title: t("platforms.connectingToast", { name: platform.name }),
                            description: t("platforms.connectingDesc"),
                          });
                        }}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t("platforms.connectButton", { name: platform.name })}
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                <Card className="bg-muted/20 border-border border-dashed hover:border-primary/50 transition-all flex flex-col h-full">
                  <CardContent className="p-6 text-center flex flex-col flex-grow">
                    <div className="p-4 rounded-2xl bg-muted/50 mx-auto w-fit mb-4">
                      <Plus className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1 text-foreground">{t("platforms.addCustomPlatform")}</h3>
                    <p className="text-sm text-muted-foreground mb-4 flex-grow">
                      {t("platforms.addCustomPlatformDesc")}
                    </p>
                    <Button
                      variant="outline"
                      className="w-full mt-auto"
                      onClick={() => setIsAddPlatformOpen(true)}
                    >
                      {t("platforms.addPlatformButton")}
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="space-y-4">
              <Card className="bg-card border-border">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    <CardTitle>{t("platforms.recentActivity")}</CardTitle>
                  </div>
                  <CardDescription>{t("platforms.recentActivityDesc")}</CardDescription>
                </CardHeader>
                <CardContent>
                  {recentPosts.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">
                      {t("platforms.noPostsYetActivity")}
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {recentPosts.map((post) => {
                        const postPlatforms = ((post as any).platforms || []) as any[];
                        return (
                          <div
                            key={post.id}
                            className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border/50 transition-all duration-200 hover:bg-muted/50"
                          >
                            <div className="h-12 w-12 rounded-xl flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/10">
                              <FileText className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1 flex-wrap">
                                {postPlatforms.map((pp, i) => (
                                  <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0 capitalize">
                                    {pp.platform}
                                  </Badge>
                                ))}
                                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 capitalize">
                                  {t(`calendar.status${post.status.charAt(0).toUpperCase()}${post.status.slice(1)}`, { defaultValue: post.status.replace("_", " ") })}
                                </Badge>
                              </div>
                              <p className="font-medium text-foreground">{post.title}</p>
                            </div>
                            <div className="text-right">
                              <p className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(post.createdAt), { addSuffix: true })}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
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
            <DialogTitle>{t("platforms.addCustomPlatformDialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("platforms.addCustomPlatformDialogDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="platform-name">{t("platforms.platformName")}</Label>
              <Input
                id="platform-name"
                placeholder={t("platforms.platformNamePlaceholder")}
                value={newPlatform.name}
                onChange={(e) => setNewPlatform({ ...newPlatform, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="platform-url">{t("platforms.connectionUrl")}</Label>
              <Input
                id="platform-url"
                placeholder="https://"
                value={newPlatform.url}
                onChange={(e) => setNewPlatform({ ...newPlatform, url: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="platform-desc">{t("platforms.descriptionLabel")}</Label>
              <Textarea
                id="platform-desc"
                placeholder={t("platforms.descriptionPlaceholder")}
                value={newPlatform.description}
                onChange={(e) => setNewPlatform({ ...newPlatform, description: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddPlatformOpen(false)}>
              {t("platforms.cancel")}
            </Button>
            <Button
              onClick={() => {
                if (!newPlatform.name) {
                  toast({ title: t("platforms.nameRequiredTitle"), description: t("platforms.nameRequiredDesc"), variant: "destructive" });
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
                toast({ title: t("platforms.platformAddedTitle"), description: t("platforms.platformAddedDesc", { name: newPlatform.name }) });
              }}
            >
              {t("platforms.addPlatformButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
