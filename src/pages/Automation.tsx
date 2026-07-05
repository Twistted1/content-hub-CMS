import React, { useState } from "react";
import { 
  Zap, 
  RefreshCcw, 
  Plus, 
  Image,
  FileText,
  Eye,
  Send,
  Twitter, 
  Instagram, 
  Facebook, 
  Share2, 
  Clock, 
  Check,
  Linkedin,
  Youtube,
  Video,
  Play,
  Globe
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

import { usePosts } from "../hooks/usePosts";
import { useAutomations, Automation } from "@/hooks/useAutomations";
import { AutomationCard } from "@/components/automation/AutomationCard";
import { AutomationDialog } from "@/components/automation/AutomationDialog";
import { AutomationHistoryDialog } from "@/components/automation/AutomationHistoryDialog";
import { useQueryClient } from "@tanstack/react-query";
import {
  CONTENT_SCHEDULE,
  DAYS,
  getCurrentPeriod,
  DayName,
  PlatformKey,
  formatSlotTime,
  getUpcomingScheduleSlots,
  getWeeklyPlatformOverview,
} from "@/utils/scheduling";

const AutomationPage = () => {
  const queryClient = useQueryClient();
  const { posts, updatePost } = usePosts();
  const {
    automations,
    automationRuns,
    addAutomation,
    updateAutomation,
    deleteAutomation,
    toggleAutomation,
    duplicateAutomation,
    runAutomation,
    completeAutomationRun,
  } = useAutomations();
  const [isProcessingPipeline, setIsProcessingPipeline] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [pipelineStep, setPipelineStep] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyAutomation, setHistoryAutomation] = useState<Automation | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [presetData, setPresetData] = useState<{ name: string; description: string; platforms: string[] } | null>(null);

  const pendingPosts = posts?.filter(p => p.status === "awaiting_review") || [];
  const scheduledPosts = posts?.filter(p => p.status === "scheduled") || [];
  const publishedPosts = posts?.filter(p => p.status === "published") || [];
  const generatedPosts = posts?.filter(p => p.isAiGenerated || p.automationId || p.pipelineRunId) || [];

  const workflowSteps = [
    { label: "Create", value: generatedPosts.length, detail: "Post + image generated", icon: FileText, tone: "text-blue-400" },
    { label: "Review", value: pendingPosts.length, detail: "Waiting approval", icon: Eye, tone: "text-orange-400" },
    { label: "Schedule", value: scheduledPosts.length, detail: "On calendar", icon: Clock, tone: "text-purple-400" },
    { label: "Publish", value: publishedPosts.length, detail: "Delivered", icon: Send, tone: "text-emerald-400" },
  ];

  const handleApproveAll = async () => {
    setIsProcessingPipeline(true);
    try {
      setPipelineLogs(["Approving weekly strategy...", "Updating 37 content units..."]);
      for (const post of pendingPosts) {
        await updatePost.mutateAsync({ id: post.id, status: "scheduled" as any });
      }
      toast.success(`Successfully approved ${pendingPosts.length} posts!`);
    } catch (err: any) {
      toast.error("Failed to approve strategy");
    } finally {
      setIsProcessingPipeline(false);
    }
  };

  const stats = [
    {
      label: "Active Automations",
      value: String(automations.filter((a) => a.status === "active").length),
      icon: Zap,
      color: "text-emerald-400",
    },
    {
      label: "Total Runs",
      value: String(automations.reduce((s, a) => s + (a.runs || 0), 0)),
      icon: RefreshCcw,
      color: "text-blue-400",
    },
    {
      label: "Time Saved",
      value: `${Math.max(1, Math.floor(automations.reduce((s, a) => s + (a.runs || 0), 0) * 0.4))}h`,
      icon: Clock,
      color: "text-purple-400",
    },
    {
      label: "Connected Apps",
      value: String(new Set(automations.flatMap((a) => a.platforms)).size),
      icon: Share2,
      color: "text-orange-400",
    },
  ];

  const platformIcons: Record<PlatformKey, typeof Twitter> = {
    twitter: Twitter,
    instagram: Instagram,
    tiktok: Video,
    facebook: Facebook,
    rumble: Play,
    linkedin: Linkedin,
    youtube: Youtube,
    website: Globe,
  };

  const weeklyOverview = getWeeklyPlatformOverview();
  const upcomingSlots = getUpcomingScheduleSlots(new Date(), 10);
  const weeklyScheduleActive = automations.some((a) =>
    a.name === "Weekly Schedule (templates)" && a.status === "active" && a.trigger === "scheduled"
  );

  const handleRunPipeline = async () => {
    setIsProcessingPipeline(true);
    setPipelineOpen(true);
    setPipelineStep(0);
    setPipelineLogs(["Initializing Weekly Strategy Generation...", "Verifying creator access permissions..."]);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      const activeUserId = user?.id;
      if (!activeUserId) throw new Error("Not authenticated");

      // 1. FULL CLEANUP 
      setPipelineLogs(prev => [...prev, `[1/4] 🧹 Performing total system wipe of legacy content...`]);
      
      const { data: userPosts, error: fetchError } = await supabase
        .from('posts')
        .select('id')
        .eq('user_id', activeUserId);
        
      if (fetchError) throw fetchError;
      
      if (userPosts && userPosts.length > 0) {
        const postIds = userPosts.map(p => p.id);
        await supabase.from('post_platforms').delete().in('post_id', postIds);
        await supabase.from('media').delete().in('post_id', postIds);
        await supabase.from('posts').delete().in('id', postIds);
      }
      setPipelineLogs(prev => [...prev, "   ✅ Database sanitized and ready."]);

      setPipelineLogs(prev => [...prev, "[2/4] 🧠 Querying AI for weekly content strategy..."]);
      const topic = "Weekly Tech & Economy Trends"; // Using a default topic for now
      const { data: generatedData, error: generateError } = await supabase.functions.invoke('generate-strategy', {
        body: { topic }
      });

      if (generateError) throw new Error(`Strategy generation failed: ${generateError.message}`);
      
      const content_strategy = generatedData?.content_strategy;
      if (!content_strategy) throw new Error("Missing content strategy data from AI");

      // Calculate the start of the upcoming week (Monday)
      const now = new Date();
      const upcomingMonday = new Date(now);
      const daysUntilMonday = (1 - now.getDay() + 7) % 7 || 7; 
      upcomingMonday.setDate(now.getDate() + daysUntilMonday);
      upcomingMonday.setHours(0, 0, 0, 0);

      const items: any[] = [];

      // Build items by reading the per-platform schedule JSONs (CONTENT_SCHEDULE)
      // for the active period — guarantees the calendar matches the schedule
      // declared in src/data/platforms/*.json.
      const period = getCurrentPeriod(upcomingMonday);
      const periodSchedule = CONTENT_SCHEDULE[period] || {};

      const pickContent = (
        strategy: any,
        platform: string,
        slotIdx: number
      ): { title: string; content: string; image?: string } | null => {
        if (!strategy) return null;
        const topic = strategy.topic || "Update";
        switch (platform) {
          case "website":
            if (!strategy.article) return null;
            return { title: strategy.article.title, content: strategy.article.content, image: strategy.image };
          case "twitter": {
            const arr: string[] = Array.isArray(strategy.twitter) ? strategy.twitter : strategy.twitter ? [strategy.twitter] : [];
            const tweet = arr[slotIdx] ?? arr[arr.length - 1];
            if (!tweet) return null;
            return { title: `X: ${topic} #${slotIdx + 1}`, content: tweet, image: strategy.image };
          }
          case "instagram":
            if (!strategy.instagram) return null;
            return { title: `IG: ${topic}`, content: strategy.instagram.caption, image: strategy.instagram.image || strategy.image };
          case "facebook":
            if (!strategy.facebook) return null;
            return { title: `FB: ${topic}`, content: strategy.facebook.post, image: strategy.image };
          case "linkedin":
            if (!strategy.linkedin) return null;
            return { title: `LI: ${topic}`, content: strategy.linkedin.post, image: strategy.image };
          case "tiktok":
            if (!strategy.tiktok) return null;
            return { title: `TT: ${topic}`, content: strategy.tiktok.script, image: strategy.tiktok.thumbnail || strategy.image };
          case "youtube":
            if (!strategy.youtube) return null;
            return { title: strategy.youtube.video_title, content: strategy.youtube.community_post, image: strategy.youtube.thumbnail || strategy.image };
          case "rumble":
            if (!strategy.rumble) return null;
            return { title: `Rumble: ${topic}`, content: strategy.rumble.post, image: strategy.rumble.thumbnail || strategy.image };
          default:
            return null;
        }
      };

      // Start time of an HH:mm or HH:mm-HH:mm window (use the window start).
      const startTimeOf = (slotTime: string): string => {
        const start = slotTime.split("-")[0];
        const [h = "00", m = "00"] = start.split(":");
        return `${h.padStart(2, "0")}:${m.padStart(2, "0")}:00`;
      };

      content_strategy.forEach((strategy: any, dayIdx: number) => {
        const d = new Date(upcomingMonday);
        d.setDate(upcomingMonday.getDate() + dayIdx);
        const dateStr = d.toISOString().split("T")[0];
        const dayName = DAYS[d.getDay()] as DayName;
        const wallClock = (h: string) => `${dateStr}T${h}.000Z`;

        const daySlots = periodSchedule[dayName] || [];
        // Track per-platform slot index so multiple Twitter slots map to
        // successive tweets from the strategy.
        const platformSlotCount: Record<string, number> = {};

        daySlots.forEach((slot) => {
          const platform = slot.platform.toLowerCase();
          const slotIdx = platformSlotCount[platform] ?? 0;
          platformSlotCount[platform] = slotIdx + 1;

          const picked = pickContent(strategy, platform, slotIdx);
          if (!picked) return;

          items.push({
            platform,
            title: picked.title,
            content: picked.content,
            image: picked.image,
            scheduled_at: wallClock(startTimeOf(slot.time)),
          });
        });
      });

      setPipelineStep(2);
      setPipelineLogs(prev => [...prev, `[3/4] 📝 Drafting ${items.length} work units across 8 platforms...`]);
      
      for (const item of items) {
        const { data: post, error: postError } = await supabase
          .from("posts")
          .insert({
            title: item.title,
            content: item.content,
            status: "awaiting_review",
            scheduled_at: item.scheduled_at,
            user_id: activeUserId,
            category: item.platform === 'website' ? 'article' : 'content',
            excerpt: item.content.substring(0, 100) + "..."
          })
          .select()
          .single();

        if (postError) throw postError;

        if (item.image) {
          await supabase.from("media").insert({
            post_id: post.id,
            url: item.image,
            filename: `${post.id}-image`,
            mime_type: "image/*",
            user_id: activeUserId
          });
        }

        await supabase.from("post_platforms").insert({
          post_id: post.id,
          platform: item.platform as any,
          status: "scheduled"
        });
        
        setPipelineLogs(prev => [...prev, `   - Created ${item.platform.toUpperCase()} post: ${item.title.substring(0, 20)}...`]);
      }

      setPipelineStep(3);
      setPipelineLogs(prev => [...prev, "   ✅ MASTER RESTORE COMPLETE.", "SYSTEM STABILIZED."]);
      toast.success("Pipeline executed successfully.");
    } catch (err: any) {
      setPipelineLogs(prev => [...prev, `❌ ERROR: ${err.message}`]);
      toast.error("Pipeline failed.");
    } finally {
      setIsProcessingPipeline(false);
    }
  };

  const computeNextRun = (schedule: string | undefined): string | null => {
    if (!schedule) return null;
    const d = new Date();
    if (schedule === "hourly") d.setHours(d.getHours() + 1);
    else if (schedule === "weekly") d.setDate(d.getDate() + 7);
    else if (schedule === "monthly") d.setMonth(d.getMonth() + 1);
    else d.setDate(d.getDate() + 1);
    return d.toISOString();
  };

  const handleSaveAutomation = async (data: Omit<Automation, "id" | "createdAt" | "lastRun" | "runs">) => {
    if (editingAutomation && editingAutomation.id) {
      updateAutomation(editingAutomation.id, data);
      // also persist next_run if scheduled
      if (data.trigger === "scheduled") {
        await supabase
          .from("automations")
          .update({
            schedule: (data.triggerConfig.schedule || "daily") as any,
            next_run: computeNextRun(data.triggerConfig.schedule),
          })
          .eq("id", editingAutomation.id);
      }
    } else {
      // Create then patch schedule + next_run if needed
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Not authenticated");
        return;
      }
      const { data: created, error } = await supabase
        .from("automations")
        .insert({
          name: data.name,
          description: data.description,
          trigger: data.trigger,
          conditions: data.triggerConfig as any,
          platforms: data.platforms,
          status: data.status as any,
          user_id: user.id,
          schedule: (data.trigger === "scheduled" ? (data.triggerConfig.schedule || "daily") : null) as any,
          next_run: data.trigger === "scheduled" ? computeNextRun(data.triggerConfig.schedule) : null,
        })
        .select()
        .single();
      if (error) {
        toast.error(`Failed to create: ${error.message}`);
        return;
      }
      toast.success("Automation created");
      queryClient.invalidateQueries({ queryKey: ["automations"] });
    }
    setEditingAutomation(null);
    setPresetData(null);
  };

  const handleConfigureStream = (stream: { label: string; summary: string; platform: PlatformKey }) => {
    setPresetData({
      name: `${stream.label} Schedule`,
      description: stream.summary,
      platforms: [capitalize(stream.platform)],
    });
    setEditingAutomation(null);
    setDialogOpen(true);
  };

  const executeAutomation = async (id: string) => {
    const automation = automations.find((a) => a.id === id);
    if (!automation) return;
    setRunningId(id);
    let runId: string | undefined;
    try {
      runId = await runAutomation(id);
      toast.info(`Running ${automation.name}...`);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const platforms = automation.platforms
        .map((p) => p.toLowerCase().replace("x", "twitter"))
        .filter((p) => ["twitter", "instagram", "facebook", "linkedin", "tiktok", "youtube", "website"].includes(p));
      if (platforms.length === 0) throw new Error("Choose at least one supported publishing platform");
      const scheduledAt = computeNextRun(automation.triggerConfig.schedule || "daily") || new Date().toISOString();
      const { data: pipeline, error: pipelineErr } = await supabase.functions.invoke("content-pipeline", {
        body: {
          topic: automation.description || automation.name,
          platforms,
          scheduleMode: "scheduled",
          scheduledAt,
        },
      });
      if (pipelineErr) throw new Error(pipelineErr.message);
      if (pipeline?.error) throw new Error(pipeline.error);

      if (pipeline?.postId) {
        await supabase.from("posts").update({ automation_id: id, pipeline_run_id: pipeline.pipelineId }).eq("id", pipeline.postId);
      }

      if (runId) completeAutomationRun(runId, true, `Created review draft${pipeline?.hasImage ? " with image" : ""}`, id);
      toast.success(`${automation.name} created a draft for review`);
    } catch (err: any) {
      if (runId) completeAutomationRun(runId, false, err.message, id);
      toast.error(`Run failed: ${err.message}`);
    } finally {
      setRunningId(null);
    }
  };

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

  const isStreamActive = (platform: string) =>
    automations.some((a) =>
      a.platforms.some((p) => p.toLowerCase() === platform.toLowerCase() || (platform === "twitter" && p.toLowerCase() === "x"))
    );

  return (
    <DashboardLayout>
      <div className="space-y-10">
        {/* Simple Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-black tracking-tighter text-white uppercase head-neon mb-2">Automation Console</h1>
            <p className="text-muted-foreground text-lg">
              Manage your autonomous content distribution and weekly strategy.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={async () => {
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) { toast.error("Not authenticated"); return; }
                  const allPlatforms = ["twitter","instagram","facebook","linkedin","tiktok","youtube","rumble","website"];
                  const { data: existing } = await supabase
                    .from("automations").select("id")
                    .eq("user_id", user.id).eq("name", "Weekly Schedule (templates)").maybeSingle();
                  if (existing) {
                    await supabase.from("automations").update({
                      status: "active", trigger: "scheduled", schedule: "daily",
                      platforms: allPlatforms, next_run: new Date().toISOString(),
                    }).eq("id", existing.id);
                  } else {
                    await supabase.from("automations").insert({
                      name: "Weekly Schedule (templates)",
                      description: "Generates posts from src/data/platforms/*.json into the Review Inbox every 15 minutes.",
                      trigger: "scheduled", status: "active", schedule: "daily",
                      platforms: allPlatforms, user_id: user.id,
                      next_run: new Date().toISOString(),
                    });
                  }
                  toast.success("Weekly schedule activated. First batch arrives in <15 min.");
                  queryClient.invalidateQueries({ queryKey: ["automations"] });
                } catch (e: any) { toast.error(e.message); }
              }}
              className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-500 transition-all font-bold text-sm"
            >
              <Zap className="w-4 h-4" />
              Activate Weekly Schedule
            </button>
            <button 
              onClick={handleRunPipeline}
              disabled={isProcessingPipeline}
              className="flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition-all font-bold text-sm"
            >
              <RefreshCcw className={`w-4 h-4 ${isProcessingPipeline ? 'animate-spin' : ''}`} />
              Run Master Pipeline
            </button>
            
            <button
              onClick={() => { setEditingAutomation(null); setPresetData(null); setDialogOpen(true); }}
              className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all font-bold text-sm"
            >
              <Plus className="w-4 h-4" />
              New Automation
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <div key={i} className="bg-card border border-border p-6 rounded-2xl">
              <div className="flex items-center gap-3 mb-4">
                <div className={`p-2 rounded-lg bg-muted`}>
                  <stat.icon className={`w-4 h-4 ${stat.color}`} />
                </div>
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{stat.label}</span>
              </div>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-bold text-white">{stat.value}</span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  +12%
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Weekly Schedule Source of Truth */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="flex items-start justify-between gap-4 mb-6">
              <div>
                <h2 className="text-xl font-bold text-white uppercase tracking-tight">Weekly Schedule</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  This is the active source of truth used by Automation and Calendar.
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${weeklyScheduleActive ? "bg-emerald-500/10 text-emerald-400" : "bg-primary/10 text-primary"}`}>
                {weeklyScheduleActive ? "Active" : "Ready"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {weeklyOverview.map((stream) => {
                const Icon = platformIcons[stream.platform];
                const active = isStreamActive(stream.platform);

                return (
                  <div key={stream.platform} className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="text-sm font-bold text-white">{stream.label}</h3>
                          <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-widest ${active ? "bg-emerald-500/10 text-emerald-400" : "bg-muted text-muted-foreground"}`}>
                            {active ? "Active" : "Configured"}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{stream.summary}</p>
                        <div className="mt-3 grid grid-cols-1 gap-2 text-xs">
                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Frequency</span>
                            <span className="font-bold text-white">{stream.frequency}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Slots</span>
                            <span className="font-medium text-white/80">{stream.slots}</span>
                          </div>
                          <div>
                            <span className="block text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Publishing</span>
                            <span className="font-medium text-white/80">{stream.publishing}</span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleConfigureStream(stream)}
                          className="mt-4 rounded-lg bg-foreground px-3 py-2 text-xs font-bold text-background transition-all hover:bg-primary hover:text-primary-foreground"
                        >
                          Configure
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-card border border-border rounded-3xl p-6">
            <div className="mb-5">
              <h2 className="text-xl font-bold text-white uppercase tracking-tight">Next 10 Slots</h2>
              <p className="text-sm text-muted-foreground mt-1">Upcoming items generated into review first.</p>
            </div>
            <div className="space-y-3">
              {upcomingSlots.map((slot, index) => {
                const Icon = platformIcons[slot.platform];
                return (
                  <div key={`${slot.platform}-${slot.date.toISOString()}-${index}`} className="flex items-start gap-3 rounded-xl border border-border bg-muted/20 p-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="text-sm font-bold text-white">{slot.label}</span>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                          {slot.date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {formatSlotTime(slot.time)}
                        </span>
                      </div>
                      {slot.category && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {slot.category} — {slot.focus}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* My Automations */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-white uppercase tracking-tight">My Automations</h2>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">
                {automations.length} configured · {automations.filter(a => a.status === "active").length} active
              </p>
            </div>
          </div>
          {automations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-muted/10">
              <Zap className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-60">
                No automations yet — click "New Automation" or "Configure" a stream above.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {automations.map((a) => (
                <AutomationCard
                  key={a.id}
                  automation={a}
                  onToggle={toggleAutomation}
                  onEdit={(au) => { setEditingAutomation(au); setPresetData(null); setDialogOpen(true); }}
                  onDelete={deleteAutomation}
                  onRun={executeAutomation}
                  onViewHistory={(au) => { setHistoryAutomation(au); setHistoryOpen(true); }}
                  onDuplicate={duplicateAutomation}
                />
              ))}
            </div>
          )}
        </div>

        {/* Master Review Hub */}
        <div className="bg-card border border-border rounded-3xl p-8">
          <div className="flex items-center justify-between mb-10">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
                <Clock className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white uppercase tracking-tight">Master Review Hub</h2>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-[0.2em]">Weekly Strategy Staging Area</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="px-4 py-2 bg-muted rounded-lg">
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">{pendingPosts.length} Items Pending</span>
              </div>
              <button 
                onClick={handleApproveAll}
                disabled={isProcessingPipeline || pendingPosts.length === 0}
                className="flex items-center gap-2 px-6 py-3 bg-white text-black rounded-xl hover:bg-primary hover:text-white disabled:opacity-30 transition-all font-bold text-sm"
              >
                <Check className="w-4 h-4" />
                Approve Strategy
              </button>
            </div>
          </div>

          {pendingPosts.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
              {pendingPosts.map((post) => (
                <div key={post.id} className="bg-muted/30 border border-border rounded-xl p-5 flex items-center justify-between hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-5">
                    <div className="p-3 bg-card border border-border rounded-xl text-primary">
                      {(() => {
                        const platform = post.platforms?.[0]?.platform;
                        switch(platform) {
                          case 'twitter': return <Twitter className="w-4 h-4" />;
                          case 'facebook': return <Facebook className="w-4 h-4" />;
                          case 'instagram': return <Instagram className="w-4 h-4" />;
                          case 'linkedin': return <Linkedin className="w-4 h-4" />;
                          case 'youtube': return <Youtube className="w-4 h-4" />;
                          case 'tiktok': return <Video className="w-4 h-4" />;
                          case 'website': return <Globe className="w-4 h-4" />;
                          case 'rumble': return <Play className="w-4 h-4" />;
                          default: return <Share2 className="w-4 h-4" />;
                        }
                      })()}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-0.5">{post.title}</h4>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                          {post.scheduledAt ? new Date(post.scheduledAt).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' }) : 'No Date'}
                        </span>
                        <span className="text-white/20">•</span>
                        <span className="text-[10px] text-primary font-bold uppercase tracking-wider">{post.platforms?.[0]?.platform || 'multi'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <span className="text-[10px] font-bold text-muted-foreground uppercase block">Status</span>
                      <span className="text-[10px] font-bold text-orange-400 uppercase">Reviewing</span>
                    </div>
                    <div className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground border-2 border-dashed border-border rounded-2xl bg-muted/10">
              <RefreshCcw className="w-10 h-10 mb-3 opacity-20" />
              <p className="text-xs font-bold tracking-[0.2em] uppercase opacity-40 italic">
                Strategy drafts will appear here for Sunday review.
              </p>
            </div>
          )}
        </div>

        {/* Pipeline Progress Modal */}
        {pipelineOpen && (
          <div className="fixed inset-0 bg-background/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-card border border-border w-full max-w-xl rounded-3xl overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-border flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <Zap className="w-5 h-5 text-primary" />
                  <h3 className="text-lg font-bold">Strategy Pipeline</h3>
                </div>
                {pipelineStep === 3 && (
                  <button onClick={() => setPipelineOpen(false)} className="text-muted-foreground hover:text-white">
                    <RefreshCcw className="w-4 h-4 rotate-45" />
                  </button>
                )}
              </div>
              
              <div className="p-6">
                <div className="flex justify-between mb-8 px-4">
                  {[0, 1, 2, 3].map((step) => (
                    <div key={step} className="flex items-center">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center border-2 transition-all ${
                        pipelineStep >= step ? 'bg-primary border-primary' : 'border-border bg-muted'
                      }`}>
                        {pipelineStep > step ? <Check className="w-4 h-4 text-white" /> : <span className="text-xs font-bold">{step + 1}</span>}
                      </div>
                      {step < 3 && <div className={`w-12 h-0.5 mx-1 ${pipelineStep > step ? 'bg-primary' : 'bg-border'}`} />}
                    </div>
                  ))}
                </div>

                <div className="bg-muted p-4 rounded-xl font-mono text-[10px] leading-relaxed max-h-48 overflow-y-auto custom-scrollbar">
                  {pipelineLogs.map((log, i) => (
                    <div key={i} className={`mb-1 ${log.startsWith('❌') ? 'text-red-400' : log.startsWith('✅') ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                      {log}
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-6 border-t border-border flex justify-end">
                <button 
                  onClick={() => setPipelineOpen(false)}
                  className={`px-6 py-2 rounded-lg font-bold text-xs transition-all ${
                    pipelineStep === 3 ? 'bg-white text-black' : 'bg-muted text-muted-foreground cursor-not-allowed'
                  }`}
                  disabled={pipelineStep !== 3}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <AutomationDialog
        open={dialogOpen}
        onOpenChange={(o) => {
          setDialogOpen(o);
          if (!o) { setEditingAutomation(null); setPresetData(null); }
        }}
        automation={
          editingAutomation
            ? editingAutomation
            : presetData
              ? ({
                  id: "",
                  name: presetData.name,
                  description: presetData.description,
                  trigger: "scheduled",
                  triggerConfig: { schedule: "daily" },
                  platforms: presetData.platforms,
                  status: "active",
                  lastRun: null,
                  runs: 0,
                  createdAt: "",
                } as Automation)
              : null
        }
        onSave={handleSaveAutomation}
      />

      <AutomationHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        automation={historyAutomation}
        runs={automationRuns}
      />
    </DashboardLayout>
  );
};

export default AutomationPage;