import React, { useState } from "react";
import { 
  Zap, 
  RefreshCcw, 
  Plus, 
  Twitter, 
  Instagram, 
  Facebook, 
  Share2, 
  Clock, 
  ArrowUpRight,
  Filter,
  Search,
  Check,
  Settings,
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

const AutomationPage = () => {
  const { posts, updatePost } = usePosts();
  const [isProcessingPipeline, setIsProcessingPipeline] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [pipelineStep, setPipelineStep] = useState(0);

  const pendingPosts = posts?.filter(p => p.status === "awaiting_review") || [];

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
    { label: "Active Automations", value: "8", icon: Zap, color: "text-emerald-400" },
    { label: "Total Runs", value: "124", icon: RefreshCcw, color: "text-blue-400" },
    { label: "Time Saved", value: "48h", icon: Clock, color: "text-purple-400" },
    { label: "Connected Apps", value: "8", icon: Share2, color: "text-orange-400" },
  ];

  const streams = [
    { 
      id: "x-daily", 
      name: "X (Twitter) Daily", 
      platform: "twitter",
      description: "Automatically generate and publish 3 posts per day to X — morning, midday, and evening.",
      frequency: "3x Daily",
      status: "Strategy Ready",
      icon: Twitter
    },
    { 
      id: "ig-feed", 
      name: "Instagram Feed", 
      platform: "instagram",
      description: "Schedule high-quality Instagram posts with AI-generated captions and hashtags.",
      frequency: "1x Daily",
      status: "Strategy Ready",
      icon: Instagram
    },
    { 
      id: "fb-strategy", 
      name: "Facebook Strategy", 
      platform: "facebook",
      description: "Publish engaging Facebook updates tailored to your community and followers.",
      frequency: "1x Daily",
      status: "Strategy Ready",
      icon: Facebook
    },
    { 
      id: "li-insights", 
      name: "LinkedIn Insights", 
      platform: "linkedin",
      description: "Professional industry insights and articles distributed to your network daily.",
      frequency: "1x Daily",
      status: "Strategy Ready",
      icon: Linkedin
    },
    { 
      id: "web-articles", 
      name: "Website Articles", 
      platform: "website",
      description: "Deep-dive long-form articles and blog posts for your primary domain.",
      frequency: "1x Daily",
      status: "Strategy Ready",
      icon: Globe
    },
    { 
      id: "tt-viral", 
      name: "TikTok / Shorts", 
      platform: "tiktok",
      description: "Fast-paced video scripts and thumbnails optimized for mobile viewers.",
      frequency: "1x Daily",
      status: "Strategy Ready",
      icon: Video
    },
    { 
      id: "yt-hub", 
      name: "YouTube Community", 
      platform: "youtube",
      description: "Video titles, descriptions, community posts, and high-CTR thumbnails.",
      frequency: "1x Daily",
      status: "Strategy Ready",
      icon: Youtube
    },
    { 
      id: "rumble-stream", 
      name: "Rumble Distribution", 
      platform: "rumble",
      description: "Unfiltered video content and platform-specific social updates.",
      frequency: "1x Daily",
      status: "Strategy Ready",
      icon: Play
    },
    { 
      id: "media-hub", 
      name: "Media & Thumbnails", 
      platform: "website",
      description: "Automated generation of high-CTR thumbnails and social media assets.",
      frequency: "8x Daily",
      status: "Strategy Ready",
      icon: Share2
    }
  ];

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

      content_strategy.forEach((strategy: any, dayIdx: number) => {
        const d = new Date(upcomingMonday);
        d.setDate(upcomingMonday.getDate() + dayIdx);
        const dateStr = d.toISOString().split('T')[0];
        const dayName = d.toLocaleDateString('en-US', { weekday: 'long' });
        
        const wallClock = (h: string) => `${dateStr}T${h}.000Z`;

        // 1. WEBSITE ARTICLE
        if (strategy.article) {
          items.push({
            platform: "website",
            title: strategy.article.title,
            content: strategy.article.content,
            image: strategy.image,
            scheduled_at: wallClock("06:00:00")
          });
        }

        // 2. X (Twitter) - 3x Daily
        if (strategy.twitter) {
          const times = ["09:00:00", "13:00:00", "17:00:00"];
          strategy.twitter.slice(0, 3).forEach((tweet: string, idx: number) => {
            items.push({
              platform: "twitter",
              title: `X: ${strategy.topic} #${idx+1}`,
              content: tweet,
              image: strategy.image,
              scheduled_at: wallClock(times[idx])
            });
          });
        }

        // 3. INSTAGRAM - 1x Daily
        if (strategy.instagram) {
          items.push({
            platform: "instagram",
            title: `IG: ${strategy.topic}`,
            content: strategy.instagram.caption,
            image: strategy.instagram.image,
            scheduled_at: wallClock("11:00:00")
          });
        }

        // 4. FACEBOOK - 1x Daily (User requested work, giving full coverage)
        if (strategy.facebook) {
          items.push({
            platform: "facebook",
            title: `FB: ${strategy.topic}`,
            content: strategy.facebook.post,
            image: strategy.image,
            scheduled_at: wallClock("10:00:00")
          });
        }

        // 5. LINKEDIN - 1x Daily
        if (strategy.linkedin) {
          items.push({
            platform: "linkedin",
            title: `LI: ${strategy.topic}`,
            content: strategy.linkedin.post,
            image: strategy.image,
            scheduled_at: wallClock("08:30:00")
          });
        }

        // 6. TIKTOK - 1x Daily
        if (strategy.tiktok) {
          items.push({
            platform: "tiktok",
            title: `TT: ${strategy.topic}`,
            content: strategy.tiktok.script,
            image: strategy.tiktok.thumbnail,
            scheduled_at: wallClock("18:00:00")
          });
        }

        // 7. YOUTUBE - 1x Daily
        if (strategy.youtube) {
          items.push({
            platform: "youtube",
            title: strategy.youtube.video_title,
            content: strategy.youtube.community_post,
            image: strategy.youtube.thumbnail,
            scheduled_at: wallClock("15:00:00")
          });
        }

        // 8. RUMBLE - 1x Daily
        if (strategy.rumble) {
          items.push({
            platform: "rumble",
            title: `Rumble: ${strategy.topic}`,
            content: strategy.rumble.post,
            image: strategy.rumble.thumbnail,
            scheduled_at: wallClock("16:00:00")
          });
        }
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
            type: "image"
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

  return (
    <DashboardLayout>
      <div className="space-y-10">
        {/* Simple Header */}
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-white mb-2">Automation Console</h1>
            <p className="text-muted-foreground text-lg">
              Manage your autonomous content distribution and weekly strategy.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleRunPipeline}
              disabled={isProcessingPipeline}
              className="flex items-center gap-2 px-6 py-3 bg-secondary text-secondary-foreground rounded-xl hover:bg-secondary/80 transition-all font-bold text-sm"
            >
              <RefreshCcw className={`w-4 h-4 ${isProcessingPipeline ? 'animate-spin' : ''}`} />
              Run Master Pipeline
            </button>
            
            <button className="flex items-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:opacity-90 transition-all font-bold text-sm">
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

        {/* Streams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {streams.map((stream) => (
            <div key={stream.id} className="bg-card border border-border rounded-3xl p-8 hover:border-primary/50 transition-colors group">
              <div className="flex items-center justify-between mb-6">
                <div className="p-3 rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                  <stream.icon className="w-6 h-6 text-primary" />
                </div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest bg-primary/10 px-3 py-1 rounded-full">
                  {stream.status}
                </span>
              </div>

              <h3 className="text-xl font-bold mb-2 text-white">{stream.name}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed mb-8">
                {stream.description}
              </p>

              <div className="flex items-center justify-between pt-6 border-t border-border">
                <div>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Frequency</span>
                  <span className="text-sm font-bold text-white">{stream.frequency}</span>
                </div>
                <button className="px-4 py-2 bg-foreground text-background text-xs font-bold rounded-lg hover:bg-primary hover:text-white transition-all">
                  Configure
                </button>
              </div>
            </div>
          ))}
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
    </DashboardLayout>
  );
};

export default AutomationPage;