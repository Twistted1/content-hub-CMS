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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { usePlatforms } from "@/hooks/usePlatforms";
import { usePosts } from "@/hooks/usePosts";
import { LoadingState } from "@/components/ui/LoadingState";
import { PlatformCard, type PlatformCardData } from "@/components/platforms/PlatformCard";
import { PlatformDetailSheet } from "@/components/platforms/PlatformDetailSheet";
import { PostDialog } from "@/components/platforms/PostDialog";
import { ScheduleCalendar } from "@/components/platforms/ScheduleCalendar";
import { PostCard } from "@/components/platforms/PostCard";
import {
  PLATFORM_CONFIG,
  availablePlatforms,
  platformColors,
} from "@/components/platforms/platformsData";
import { Post, PostType, PlatformType } from "@/types";
import {
  RefreshCw,
  CheckCircle2,
  Plus,
  Globe,
  BarChart3,
  CalendarClock,
  FileText,
  Send,
  BookOpen,
} from "lucide-react";

export default function Platforms() {
  // ── Real data ────────────────────────────────────────────────────────────────
  const { platforms: dbPlatforms, isLoading: platformsLoading } = usePlatforms();
  const { posts, addPost, updatePost, deletePost, publishPost, isLoading: postsLoading } = usePosts();

  // ── UI state ─────────────────────────────────────────────────────────────────
  const [detailPlatform, setDetailPlatform] = useState<PlatformCardData | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("connected");
  const [syncing, setSyncing] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [isAddPlatformOpen, setIsAddPlatformOpen] = useState(false);
  const [newPlatform, setNewPlatform] = useState({ name: "", url: "", description: "" });
  const [newPost, setNewPost] = useState({
    title: "",
    content: "",
    platforms: [] as PlatformType[],
    scheduledDate: "",
    scheduledTime: "",
    type: "text" as PostType,
  });

  // ── Compute real post counts per platform ─────────────────────────────────────
  const postCountsByPlatform = useMemo(() => {
    const counts: Record<string, { scheduled: number; published: number }> = {};
    (posts || []).forEach((post) => {
      (post.platforms || []).forEach((pp) => {
        const p = pp.platform as string;
        if (!counts[p]) counts[p] = { scheduled: 0, published: 0 };
        if (pp.status === "scheduled") counts[p].scheduled++;
        if (pp.status === "published") counts[p].published++;
      });
    });
    return counts;
  }, [posts]);

  // ── Merge static config + DB settings + real post counts ─────────────────────
  const connectedPlatforms = useMemo<PlatformCardData[]>(() => {
    return PLATFORM_CONFIG.map((cfg) => {
      const dbEntry = dbPlatforms.find(
        (p) => p.platformType === cfg.id || (p.accountName ?? "").toLowerCase() === cfg.id
      );
      const counts = postCountsByPlatform[cfg.id] ?? { scheduled: 0, published: 0 };
      return {
        id: cfg.id,
        name: cfg.name,
        icon: cfg.icon,
        url: cfg.url,
        username: dbEntry?.username ?? dbEntry?.accountName ?? cfg.defaultUsername,
        status: (dbEntry?.status as "active" | "paused") ?? "active",
        lastSync: dbEntry?.lastSync ?? null,
        schedule: counts,
        dbId: dbEntry?.id,
        settings: dbEntry?.settings,
      };
    });
  }, [dbPlatforms, postCountsByPlatform]);

  // ── Real overview stats ───────────────────────────────────────────────────────
  const overviewStats = useMemo(() => {
    const totalScheduled = Object.values(postCountsByPlatform).reduce(
      (s, c) => s + c.scheduled, 0
    );
    const totalPublished = Object.values(postCountsByPlatform).reduce(
      (s, c) => s + c.published, 0
    );
    const totalDrafts = (posts || []).filter((p) => p.status === "draft").length;
    return {
      totalPlatforms: PLATFORM_CONFIG.length,
      totalScheduled,
      totalPublished,
      totalDrafts,
      totalPosts: (posts || []).length,
    };
  }, [postCountsByPlatform, posts]);

  const scheduledPosts = useMemo(
    () => (posts || []).filter((p) => p.status === "scheduled"),
    [posts]
  );

  const getPlatformColor = (id: string) => platformColors[id] || "hsl(var(--primary))";

  const getTailwindBg = (id: string) => {
    const map: Record<string, string> = {
      youtube: "bg-red-500/20 text-red-500",
      twitter: "bg-zinc-800/20 text-foreground",
      facebook: "bg-blue-600/20 text-blue-600",
      instagram: "bg-pink-600/20 text-pink-600",
      linkedin: "bg-blue-700/20 text-blue-700",
      tiktok: "bg-slate-900/20 text-foreground",
      website: "bg-teal-500/20 text-teal-500",
      podcast: "bg-purple-500/20 text-purple-500",
      rumble: "bg-green-500/20 text-green-500",
    };
    return map[id.toLowerCase()] || "bg-primary/20 text-primary";
  };

  // ── Handlers ──────────────────────────────────────────────────────────────────
  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      toast.success("Dashboard refreshed");
    }, 1200);
  };

  const handleCreatePost = () => {
    if (!newPost.title || !newPost.content || newPost.platforms.length === 0) {
      toast.error("Please fill in title, content, and select at least one platform.");
      return;
    }
    const isScheduled = !!(newPost.scheduledDate && newPost.scheduledTime);
    addPost.mutate({
      post: {
        title: newPost.title,
        content: newPost.content,
        status: isScheduled ? "scheduled" : "draft",
        type: newPost.type,
        scheduled_at: isScheduled
          ? new Date(`${newPost.scheduledDate}T${newPost.scheduledTime}`).toISOString()
          : null,
      },
      platforms: newPost.platforms as any[],
    });
    setNewPost({ title: "", content: "", platforms: [], scheduledDate: "", scheduledTime: "", type: "text" });
    setIsCreateDialogOpen(false);
    toast.success(isScheduled ? "Post scheduled." : "Saved as draft.");
  };

  const handleUpdatePost = () => {
    if (!editingPost) return;
    updatePost.mutate({
      id: editingPost.id,
      title: editingPost.title,
      content: editingPost.content ?? undefined,
      scheduled_at: editingPost.scheduledAt,
      type: editingPost.type,
    });
    setEditingPost(null);
    toast.success("Post updated.");
  };

  const handleDeletePost = (id: string) => {
    deletePost.mutate(id);
    toast.success("Post deleted.");
  };

  const handlePublishNow = (id: string) => {
    publishPost.mutate(id);
    toast.success("Post published.");
  };

  const togglePlatformSelection = (platformId: string, isNew: boolean) => {
    if (isNew) {
      setNewPost((prev) => ({
        ...prev,
        platforms: prev.platforms.includes(platformId as any)
          ? prev.platforms.filter((p) => p !== platformId)
          : [...prev.platforms, platformId as any],
      }));
    } else if (editingPost) {
      const current = (editingPost.platforms || []) as any[];
      const has = current.some((p) =>
        (typeof p === "string" ? p : p.platform) === platformId
      );
      setEditingPost({
        ...editingPost,
        platforms: has
          ? current.filter((p) => (typeof p === "string" ? p : p.platform) !== platformId)
          : [...current, platformId],
      } as any);
    }
  };

  if (platformsLoading || postsLoading) {
    return (
      <DashboardLayout>
        <LoadingState message="Loading platforms…" />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <TooltipProvider>
        <div className="space-y-8 animate-fade-in">

          {/* ── Header ── */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <h1 className="text-4xl font-black tracking-tighter text-white uppercase head-neon mb-2">
                Platforms
              </h1>
              <p className="text-sm text-muted-foreground max-w-xl">
                Manage content across all connected distribution channels.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                className="bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.08] text-white font-black uppercase text-[10px] tracking-widest px-6 py-6 rounded-2xl"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Refreshing…" : "Refresh"}
              </Button>
              <Button
                className="bg-primary hover:bg-primary/90 text-white font-black uppercase text-[10px] tracking-widest px-8 py-6 rounded-2xl shadow-xl shadow-primary/20"
                onClick={() => setIsAddPlatformOpen(true)}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Platform
              </Button>
            </div>
          </div>

          {/* ── Real overview stats ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                icon: CheckCircle2,
                label: "Active Platforms",
                value: overviewStats.totalPlatforms.toString(),
                color: "text-emerald-400",
              },
              {
                icon: CalendarClock,
                label: "Scheduled Posts",
                value: overviewStats.totalScheduled.toString(),
                color: "text-indigo-400",
              },
              {
                icon: Send,
                label: "Published",
                value: overviewStats.totalPublished.toString(),
                color: "text-primary",
              },
              {
                icon: BookOpen,
                label: "Total Posts",
                value: overviewStats.totalPosts.toString(),
                color: "text-purple-400",
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="glass-card p-4 flex flex-col gap-2 group hover:border-primary/40 transition-all"
              >
                <div className="flex items-center justify-between">
                  <stat.icon className={`h-4 w-4 ${stat.color} opacity-80`} />
                  <span className="text-[9px] font-black uppercase tracking-[0.1em] text-muted-foreground/50">
                    {stat.label}
                  </span>
                </div>
                <div className="text-2xl font-black text-white tracking-tighter">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* ── Tabs ── */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList className="bg-muted/50 flex-wrap">
              <TabsTrigger value="connected" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Platforms ({connectedPlatforms.length})
              </TabsTrigger>
              <TabsTrigger value="schedule" className="gap-2">
                <CalendarClock className="h-4 w-4" />
                Schedule ({scheduledPosts.filter((p) => p.status !== "published").length})
              </TabsTrigger>
              <TabsTrigger value="available" className="gap-2">
                <Plus className="h-4 w-4" />
                Available ({availablePlatforms.length})
              </TabsTrigger>
            </TabsList>

            {/* ── Connected Platforms ── */}
            <TabsContent value="connected" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                {connectedPlatforms.map((platform) => (
                  <PlatformCard
                    key={platform.id}
                    platform={platform}
                    isSelected={false}
                    onSelect={() => {}}
                    getPlatformColor={getPlatformColor}
                    onOpenDetail={(p) => {
                      setDetailPlatform(p);
                      setDetailOpen(true);
                    }}
                  />
                ))}
              </div>
            </TabsContent>

            {/* ── Schedule ── */}
            <TabsContent value="schedule" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Scheduled Posts</h3>
                  <p className="text-sm text-muted-foreground">
                    Manage and schedule content across all platforms
                  </p>
                </div>
                <PostDialog
                  isOpen={isCreateDialogOpen}
                  onOpenChange={setIsCreateDialogOpen}
                  newPost={newPost}
                  onNewPostChange={setNewPost}
                  onCreatePost={handleCreatePost}
                  connectedPlatforms={connectedPlatforms as any}
                  getPlatformColor={getPlatformColor}
                  togglePlatformSelection={(id) => togglePlatformSelection(id, true)}
                />
              </div>

              <ScheduleCalendar platforms={connectedPlatforms as any} />

              <div className="space-y-3">
                {scheduledPosts.filter((p) => p.status !== "published").length === 0 ? (
                  <Card className="bg-card border-border border-dashed">
                    <CardContent className="p-8 text-center">
                      <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-medium text-foreground mb-2">
                        No scheduled posts
                      </h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create your first post to get started
                      </p>
                      <Button onClick={() => setIsCreateDialogOpen(true)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Create Post
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  scheduledPosts
                    .filter((p) => p.status !== "published")
                    .map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        platforms={connectedPlatforms as any}
                        getPlatformColor={getPlatformColor}
                        onEdit={setEditingPost}
                        onDelete={handleDeletePost}
                        onPublish={handlePublishNow}
                      />
                    ))
                )}
              </div>
            </TabsContent>

            {/* ── Edit Post Dialog ── */}
            <Dialog open={!!editingPost} onOpenChange={(open) => !open && setEditingPost(null)}>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Edit Post</DialogTitle>
                  <DialogDescription>Update your scheduled post details.</DialogDescription>
                </DialogHeader>
                {editingPost && (
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input
                        value={editingPost.title}
                        onChange={(e) =>
                          setEditingPost({ ...editingPost, title: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Content</Label>
                      <Textarea
                        rows={4}
                        value={editingPost.content ?? ""}
                        onChange={(e) =>
                          setEditingPost({ ...editingPost, content: e.target.value })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Platforms</Label>
                      <div className="flex flex-wrap gap-2">
                        {connectedPlatforms.map((platform) => (
                          <div
                            key={platform.id}
                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                              (editingPost.platforms || []).some((p: any) =>
                                (typeof p === "string" ? p : p.platform) === platform.id
                              )
                                ? "border-primary bg-primary/10"
                                : "border-border hover:border-primary/50"
                            }`}
                            onClick={() => togglePlatformSelection(platform.id, false)}
                          >
                            <Checkbox
                              checked={(editingPost.platforms || []).some((p: any) =>
                                (typeof p === "string" ? p : p.platform) === platform.id
                              )}
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
                        <Label>Schedule Date</Label>
                        <Input
                          type="date"
                          value={
                            editingPost.scheduledAt
                              ? editingPost.scheduledAt.split("T")[0]
                              : ""
                          }
                          onChange={(e) => {
                            const time =
                              editingPost.scheduledAt?.includes("T")
                                ? editingPost.scheduledAt.split("T")[1]
                                : "00:00:00Z";
                            setEditingPost({
                              ...editingPost,
                              scheduledAt: e.target.value
                                ? `${e.target.value}T${time}`
                                : null,
                            } as any);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Schedule Time</Label>
                        <Input
                          type="time"
                          value={
                            editingPost.scheduledAt?.includes("T")
                              ? editingPost.scheduledAt.split("T")[1].substring(0, 5)
                              : ""
                          }
                          onChange={(e) => {
                            const date = editingPost.scheduledAt
                              ? editingPost.scheduledAt.split("T")[0]
                              : new Date().toISOString().split("T")[0];
                            setEditingPost({
                              ...editingPost,
                              scheduledAt: `${date}T${e.target.value}:00Z`,
                            } as any);
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
                  <Button onClick={handleUpdatePost}>Save Changes</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* ── Available Platforms ── */}
            <TabsContent value="available" className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Additional platforms that can be integrated via the{" "}
                <a href="/settings?tab=integrations" className="text-primary hover:underline">
                  Integrations settings
                </a>
                .
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {availablePlatforms.map((platform) => (
                  <Card
                    key={platform.id}
                    className="bg-card border-border border-dashed hover:border-primary/50 transition-all"
                  >
                    <CardContent className="p-6 text-center">
                      <div
                        className={`p-4 rounded-2xl mx-auto w-fit mb-4 ${getTailwindBg(platform.id)}`}
                      >
                        <platform.icon className="h-8 w-8" />
                      </div>
                      <h3 className="font-semibold text-lg mb-1">{platform.name}</h3>
                      <p className="text-sm text-muted-foreground mb-1">{platform.description}</p>
                      <p className="text-xs text-primary mb-4">{platform.users} active users</p>
                      <Button
                        className="w-full bg-primary hover:bg-primary/90"
                        onClick={() =>
                          toast.info(
                            `To connect ${platform.name}, configure it in Settings → Integrations.`
                          )
                        }
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Connect {platform.name}
                      </Button>
                    </CardContent>
                  </Card>
                ))}

                {/* Custom platform card */}
                <Card className="bg-muted/20 border-border border-dashed hover:border-primary/50 transition-all">
                  <CardContent className="p-6 text-center">
                    <div className="p-4 rounded-2xl bg-muted/50 mx-auto w-fit mb-4">
                      <Plus className="h-8 w-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg mb-1">Add Custom Platform</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Configure a custom webhook destination.
                    </p>
                    <Button variant="outline" className="w-full" onClick={() => setIsAddPlatformOpen(true)}>
                      Add Platform
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>

          {/* ── Platform detail sheet ── */}
          <PlatformDetailSheet
            platform={detailPlatform}
            open={detailOpen}
            onOpenChange={setDetailOpen}
            getPlatformColor={getPlatformColor}
          />
        </div>

        {/* ── Add Custom Platform Dialog ── */}
        <Dialog open={isAddPlatformOpen} onOpenChange={setIsAddPlatformOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Add Custom Platform</DialogTitle>
              <DialogDescription>
                Create a custom webhook endpoint for your content dashboard.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Platform Name</Label>
                <Input
                  placeholder="e.g. Medium, Substack, Custom CMS"
                  value={newPlatform.name}
                  onChange={(e) => setNewPlatform({ ...newPlatform, name: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Webhook URL (Optional)</Label>
                <Input
                  placeholder="https://"
                  value={newPlatform.url}
                  onChange={(e) => setNewPlatform({ ...newPlatform, url: e.target.value })}
                />
              </div>
              <div className="grid gap-2">
                <Label>Description</Label>
                <Textarea
                  placeholder="What type of content goes here?"
                  value={newPlatform.description}
                  onChange={(e) =>
                    setNewPlatform({ ...newPlatform, description: e.target.value })
                  }
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
                    toast.error("Platform name is required.");
                    return;
                  }
                  setIsAddPlatformOpen(false);
                  setNewPlatform({ name: "", url: "", description: "" });
                  toast.success(
                    `${newPlatform.name} added. Configure its webhook in Settings → Integrations.`
                  );
                }}
              >
                Add Platform
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </TooltipProvider>
    </DashboardLayout>
  );
}
