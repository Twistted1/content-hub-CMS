import { useState, useMemo, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, Share2, Mail, Bell, Plus, Search, Filter, ChevronDown, Trash2, Play, Pause, Twitter, Instagram, Facebook, Rocket, Sparkles, Wand2, Terminal, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { AutomationCard } from "@/components/automation/AutomationCard";
import { AutomationDialog } from "@/components/automation/AutomationDialog";
import { AutomationHistoryDialog } from "@/components/automation/AutomationHistoryDialog";
import { useAutomations, Automation, TriggerType, AutomationStatus } from "@/hooks/useAutomations";
import { triggerOptions, getQuickStats, workflowPresets } from "@/components/automation/automationData";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useUJT } from "@/hooks/useUJT";
import workflowContent from "@/data/workflow-content.json";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function AutomationPage() {
  const {
    automations,
    automationRuns,
    addAutomation,
    updateAutomation,
    deleteAutomation,
    deleteAutomations,
    toggleAutomation,
    toggleAutomations,
    duplicateAutomation,
    runAutomation,
    completeAutomationRun,
  } = useAutomations();

  const { processUJT } = useUJT();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [pipelineOpen, setPipelineOpen] = useState(false);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [pipelineStep, setPipelineStep] = useState(0);
  
  const [editingAutomation, setEditingAutomation] = useState<Automation | null>(null);
  const [selectedAutomation, setSelectedAutomation] = useState<Automation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AutomationStatus>("all");
  const [triggerFilter, setTriggerFilter] = useState<"all" | TriggerType>("all");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isProcessingPipeline, setIsProcessingPipeline] = useState(false);

  const quickStats = getQuickStats(automations);

  const filteredAutomations = useMemo(() => {
    return automations.filter((automation) => {
      const matchesSearch =
        automation.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        automation.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || automation.status === statusFilter;
      const matchesTrigger = triggerFilter === "all" || automation.trigger === triggerFilter;
      return matchesSearch && matchesStatus && matchesTrigger;
    });
  }, [automations, searchQuery, statusFilter, triggerFilter]);

  const handleRunPipeline = async () => {
    setIsProcessingPipeline(true);
    setPipelineOpen(true);
    setPipelineStep(0);
    setPipelineLogs(["Initializing Autonomous Strategy Pipeline...", "Connecting to AI Core..."]);

    const steps = [
      { log: "Fetching latest workflow blueprints from data-workflow-content.json...", delay: 800 },
      { log: "Performing semantic analysis on strategy templates...", delay: 1200 },
      { log: "Generating optimized creative assets for Instagram and Twitter...", delay: 1500 },
      { log: "Formatting media for multi-platform distribution...", delay: 1000 },
      { log: "Propagating content to Content Hub backend...", delay: 1200 },
      { log: "Synchronization complete. Content items successfully generated.", delay: 500 },
    ];

    for (let i = 0; i < steps.length; i++) {
       await new Promise(r => setTimeout(r, steps[i].delay));
       setPipelineLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${steps[i].log}`]);
       setPipelineStep(i + 1);
    }

    try {
      const template = {
        version: "1.0",
        items: [
          ...workflowContent.instagram.map(item => ({
            type: "POST",
            data: { title: item.topic, content: item.content, image: item.image, hashtags: item.hashtags },
            metadata: { platforms: ["instagram"], status: "scheduled", scheduled_at: new Date().toISOString() }
          })),
          ...workflowContent.twitter.map(item => ({
            type: "POST",
            data: { title: `${item.day} Thread`, content: item.tweets.join("\n\n"), image: item.image },
            metadata: { platforms: ["twitter"], status: "scheduled", scheduled_at: new Date().toISOString() }
          }))
        ]
      };

      await processUJT(template as any);
      setPipelineLogs(prev => [...prev, "✔ AI Pipeline process finalized successfully."]);
      toast.success("AI Workflow Pipeline completed!");
    } catch (error) {
      setPipelineLogs(prev => [...prev, "✖ CRITICAL ERROR: Pipeline failed to resolve."]);
      toast.error("Pipeline failed.");
    } finally {
      setIsProcessingPipeline(false);
    }
  };

  const handleToggle = (id: string) => {
    const automation = automations.find((a) => a.id === id);
    toggleAutomation(id);
    toast.success(
      `${automation?.name} ${automation?.status === "active" ? "paused" : "activated"}`
    );
  };

  const handleSave = (data: Omit<Automation, "id" | "createdAt" | "lastRun" | "runs">) => {
    if (editingAutomation) {
      updateAutomation(editingAutomation.id, data);
      toast.success("Automation updated");
    } else {
      addAutomation(data);
      toast.success("Automation created");
    }
    setEditingAutomation(null);
  };

  const handleEdit = (automation: Automation) => {
    setEditingAutomation(automation);
    setDialogOpen(true);
  };

  const handleDelete = (id: string) => {
    const automation = automations.find((a) => a.id === id);
    deleteAutomation(id);
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
    toast.success(`${automation?.name} deleted`);
  };

  const handleDuplicate = (id: string) => {
    const automation = automations.find((a) => a.id === id);
    duplicateAutomation(id);
    toast.success(`${automation?.name} duplicated`);
  };

  const handleRun = async (id: string) => {
    const automation = automations.find((a) => a.id === id);
    if (!automation) return;

    try {
      const runId = await runAutomation(id);
      toast.info(`Running ${automation.name}...`);

      setTimeout(() => {
        const success = Math.random() > 0.2;
        completeAutomationRun(
          runId,
          success,
          success
            ? `Successfully executed on ${automation.platforms.join(", ")}`
            : "Failed to connect to one or more platforms",
          id
        );
        if (success) {
          toast.success(`${automation.name} completed successfully`);
        } else {
          toast.error(`${automation.name} failed`);
        }
      }, 2000);
    } catch (e) {
      toast.error("Failed to start automation");
    }
  };

  const handleViewHistory = (automation: Automation) => {
    setSelectedAutomation(automation);
    setHistoryOpen(true);
  };

  const handleCreate = () => {
    setEditingAutomation(null);
    setDialogOpen(true);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredAutomations.map((a) => a.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => [...prev, id]);
    } else {
      setSelectedIds((prev) => prev.filter((sid) => sid !== id));
    }
  };

  const handleBulkActivate = () => {
    toggleAutomations(selectedIds, "active");
    toast.success(`${selectedIds.length} automations activated`);
    setSelectedIds([]);
  };

  const handleBulkPause = () => {
    toggleAutomations(selectedIds, "paused");
    toast.success(`${selectedIds.length} automations paused`);
    setSelectedIds([]);
  };

  const handleBulkDelete = () => {
    deleteAutomations(selectedIds);
    toast.success(`${selectedIds.length} automations deleted`);
    setSelectedIds([]);
  };

  const allSelected = filteredAutomations.length > 0 && selectedIds.length === filteredAutomations.length;
  const someSelected = selectedIds.length > 0;

  const getPlatformIcon = (iconName: string) => {
    switch (iconName) {
      case "Twitter": return <Twitter className="h-4 w-4" />;
      case "Instagram": return <Instagram className="h-4 w-4" />;
      case "Facebook": return <Facebook className="h-4 w-4" />;
      default: return <Rocket className="h-4 w-4" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 max-w-[1600px] mx-auto pb-12 animate-in fade-in duration-700">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
                <Settings className="h-6 w-6 animate-pulse-slow" />
              </div>
              <h1 className="text-xl font-black tracking-tighter text-foreground uppercase italic px-4 bg-gradient-to-r from-primary/20 to-transparent border-l-4 border-primary inline-block">
                Automation
              </h1>
            </div>
            <p className="text-lg font-black uppercase tracking-[0.3em] text-muted-foreground mt-2 opacity-60 ml-2">
              Workflow Engine & Content Distribution
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button 
              onClick={handleRunPipeline} 
              disabled={isProcessingPipeline}
              className="bg-card hover:bg-muted text-foreground border border-border font-black uppercase tracking-widest px-8 rounded-xl h-14 shadow-2xl gap-4 group relative overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative flex items-center gap-3">
                {isProcessingPipeline ? (
                  <Loader2 className="h-6 w-6 text-primary animate-spin" />
                ) : (
                  <Wand2 className="h-6 w-6 text-primary group-hover:rotate-12 transition-transform" />
                )}
                <span className="text-sm">Initiate AI Pipeline</span>
              </div>
            </Button>
            <Button onClick={handleCreate} className="bg-primary hover:opacity-90 text-white font-black uppercase tracking-widest px-10 rounded-xl h-14 shadow-xl shadow-primary/20 gap-3 border-0 transition-all hover:scale-[1.02] active:scale-[0.98]">
              <Plus className="h-6 w-6" />
              Create Stream
            </Button>
          </div>
        </div>

        {/* AI Workflow Pipeline Presets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {workflowPresets.map((preset) => (
            <Card key={preset.id} className="relative group overflow-hidden border-border/50 bg-card/10 backdrop-blur-xl hover:border-primary/50 transition-all duration-500 cursor-pointer hover:shadow-2xl hover:shadow-primary/5" onClick={() => toast.info(`Starting ${preset.name} setup...`)}>
              <div className="absolute top-0 right-0 p-6 opacity-[0.05] group-hover:scale-125 transition-transform duration-700">
                {getPlatformIcon(preset.icon)}
              </div>
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <div className={cn("p-4 rounded-2xl shadow-inner border border-border/50", preset.color)}>
                    {getPlatformIcon(preset.icon)}
                  </div>
                  <Badge variant="outline" className="text-[9px] font-black tracking-widest bg-background/50 border-primary/20 text-primary px-3 py-1">STRATEGY READY</Badge>
                </div>
                <h3 className="text-lg font-black italic uppercase tracking-tighter text-foreground mb-2 leading-none">{preset.name}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-8 line-clamp-2 opacity-80">{preset.description}</p>
                <div className="flex items-center justify-between pt-6 border-t border-border/50">
                  <div className="flex flex-col">
                    <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground opacity-60 mb-1">Frequency</span>
                    <span className="text-base font-black text-foreground">{preset.frequency}</span>
                  </div>
                  <Button variant="ghost" size="sm" className="rounded-xl h-10 px-5 font-black uppercase text-[10px] tracking-widest hover:bg-primary/10 hover:text-primary group border border-border/50">
                    Deploy
                    <Rocket className="ml-2 h-4 w-4 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quickStats.map((stat) => (
            <div key={stat.label} className="bg-card/20 backdrop-blur-3xl border border-border/30 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group hover:border-primary/50 transition-all duration-500">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-125 transition-transform duration-700">
                <stat.icon className="h-28 w-28" />
              </div>
              <div className="flex items-center justify-between mb-4">
                <div className={cn("p-4 rounded-2xl", stat.color, "bg-background/80 border border-border shadow-inner")}>
                  <stat.icon className="h-6 w-6" />
                </div>
                <Badge variant="outline" className="text-[9px] font-black bg-background/50 uppercase tracking-[0.2em] opacity-60 border-border/50">Realtime</Badge>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1 opacity-60">{stat.label}</p>
                <p className="text-xl font-black text-foreground tracking-tighter italic">{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Automations Table Section */}
        <Card className="bg-card/20 backdrop-blur-3xl border-border/50 shadow-2xl overflow-hidden rounded-[2.5rem]">
          <CardHeader className="p-10 border-b border-border/50 bg-muted/20">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8">
              <div>
                <CardTitle className="flex items-center gap-4 text-xl font-black uppercase italic tracking-tighter">
                  <Sparkles className="h-6 w-6 text-primary animate-pulse" />
                  Active Streams
                </CardTitle>
                <CardDescription className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60 mt-2">
                  Management console for your autonomous content distribution
                </CardDescription>
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <div className="relative group">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input
                    placeholder="Search streams..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-12 w-full sm:w-[320px] bg-background/50 border-border/50 h-12 rounded-xl focus:ring-primary/20 text-sm font-medium"
                  />
                </div>
                <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as "all" | AutomationStatus)}>
                  <SelectTrigger className="w-[160px] bg-background/50 border-border/50 h-12 rounded-xl text-xs font-bold uppercase tracking-widest">
                    <Filter className="h-4 w-4 mr-2 opacity-60" />
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-card/95 backdrop-blur-xl">
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="paused">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {/* Bulk Actions Bar */}
            {filteredAutomations.length > 0 && someSelected && (
              <div className="flex items-center gap-6 py-4 px-10 bg-primary/5 border-b border-border/30 animate-in fade-in slide-in-from-top-2">
                <div className="flex items-center gap-4">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={handleSelectAll}
                    className="border-primary/50 data-[state=checked]:bg-primary h-5 w-5 rounded-lg"
                  />
                  <span className="text-xs font-black uppercase tracking-widest text-primary">
                    {selectedIds.length} streams selected
                  </span>
                </div>
                <div className="flex items-center gap-3 ml-auto">
                  <Button variant="ghost" size="sm" onClick={handleBulkActivate} className="h-10 rounded-xl font-black uppercase text-[11px] tracking-widest text-emerald-500 hover:bg-emerald-500/10 gap-2 border border-emerald-500/20">
                    <Play className="h-4 w-4" />
                    Activate
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleBulkPause} className="h-10 rounded-xl font-black uppercase text-[11px] tracking-widest text-amber-500 hover:bg-amber-500/10 gap-2 border border-amber-500/20">
                    <Pause className="h-4 w-4" />
                    Pause
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleBulkDelete} className="h-10 rounded-xl font-black uppercase text-[11px] tracking-widest text-destructive hover:bg-destructive/10 gap-2 border border-destructive/20">
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </Button>
                </div>
              </div>
            )}

            <ScrollArea className="max-h-[700px]">
              <div className="p-10 space-y-6">
                {filteredAutomations.length === 0 ? (
                  <div className="text-center py-28 border-2 border-dashed border-border/50 rounded-[2rem] bg-muted/5">
                    <div className="w-24 h-24 bg-muted/20 rounded-full flex items-center justify-center mx-auto mb-8 opacity-20">
                      <Settings className="w-12 h-12" />
                    </div>
                    <p className="text-muted-foreground font-black uppercase tracking-widest text-sm">
                      {automations.length === 0
                        ? "Autonomous engine standby. Initialize a new stream."
                        : "No streams match the current query parameters."}
                    </p>
                    <Button onClick={handleCreate} variant="link" className="text-primary font-black uppercase tracking-widest text-[11px] mt-6 gap-2 group">
                      Initialize your first stream
                      <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </div>
                ) : (
                  filteredAutomations.map((automation) => (
                    <div key={automation.id} className="group/row flex items-center gap-8 p-1 relative">
                      <div className="absolute left-[-4px] h-full w-[6px] bg-primary rounded-full opacity-0 group-hover/row:opacity-100 transition-all duration-300 shadow-[0_0_15px_rgba(168,85,247,0.5)]" />
                      <Checkbox
                        checked={selectedIds.includes(automation.id)}
                        onCheckedChange={(checked) => handleSelectOne(automation.id, !!checked)}
                        className="border-border/50 data-[state=checked]:bg-primary h-6 w-6 rounded-lg transition-colors"
                      />
                      <div className="flex-1">
                        <AutomationCard
                          automation={automation}
                          onToggle={handleToggle}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                          onRun={handleRun}
                          onViewHistory={handleViewHistory}
                          onDuplicate={handleDuplicate}
                        />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* AI Pipeline Terminal Dialog */}
      <Dialog open={pipelineOpen} onOpenChange={setPipelineOpen}>
        <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden rounded-3xl border-border bg-[#0a0c10] shadow-[0_0_50px_rgba(0,0,0,0.5)]">
           <div className="bg-[#1a1c22] p-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-3">
                 <Terminal className="h-5 w-5 text-primary" />
                 <span className="text-xs font-black uppercase tracking-widest text-foreground">Autonomous Pipeline Console</span>
              </div>
              <div className="flex gap-1.5">
                 <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50" />
                 <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50" />
                 <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50" />
              </div>
           </div>
           
           <div className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                 {[
                   { label: "Status", value: isProcessingPipeline ? "Processing" : "Completed", color: isProcessingPipeline ? "text-amber-500" : "text-emerald-500" },
                   { label: "Stability", value: "99.2%", color: "text-primary" },
                   { label: "Active Agent", value: "Novee Core", color: "text-foreground" },
                   { label: "Target Set", value: "Multi-Platform", color: "text-foreground" },
                 ].map(stat => (
                   <div key={stat.label} className="p-3 bg-white/5 border border-white/5 rounded-xl">
                      <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground mb-1">{stat.label}</p>
                      <p className={cn("text-sm font-bold", stat.color)}>{stat.value}</p>
                   </div>
                 ))}
              </div>

              <ScrollArea className="h-64 rounded-2xl bg-[#000]/50 p-6 border border-white/5 font-mono text-[11px] leading-relaxed relative">
                 <div className="space-y-2">
                    {pipelineLogs.map((log, i) => (
                      <div key={i} className={cn("flex gap-3", log.startsWith("[") ? "text-muted-foreground" : "text-primary font-black uppercase")}>
                         <span className="opacity-30 select-none">{i + 1}</span>
                         <span>{log}</span>
                      </div>
                    ))}
                    {isProcessingPipeline && (
                      <div className="flex items-center gap-2 text-primary animate-pulse mt-2">
                         <Loader2 className="h-3 w-3 animate-spin" />
                         <span>Streaming response from Novee Core...</span>
                      </div>
                    )}
                 </div>
              </ScrollArea>

              <div className="flex items-center justify-between pt-4">
                 <p className="text-[10px] text-muted-foreground italic font-medium">Session ID: {Math.random().toString(36).substring(7).toUpperCase()}</p>
                 <Button 
                    disabled={isProcessingPipeline} 
                    onClick={() => setPipelineOpen(false)}
                    className="rounded-xl px-8 bg-primary hover:opacity-90 font-black uppercase text-[10px] tracking-widest gap-2"
                 >
                    {isProcessingPipeline ? "Analyzing System..." : "Acknowledge"}
                    {!isProcessingPipeline && <CheckCircle2 className="h-3 w-3" />}
                 </Button>
              </div>
           </div>
        </DialogContent>
      </Dialog>

      {/* Dialogs */}
      <AutomationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        automation={editingAutomation}
        onSave={handleSave}
      />
      <AutomationHistoryDialog
        open={historyOpen}
        onOpenChange={setHistoryOpen}
        automation={selectedAutomation}
        runs={automationRuns}
      />
    </DashboardLayout>
  );
}