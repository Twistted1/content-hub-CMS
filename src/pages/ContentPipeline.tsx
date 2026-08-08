import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  Zap, Play, Clock, CheckCircle2, XCircle, Loader2,
  Image, FileText, Send, Calendar, Webhook, Plus, Trash2,
  Sparkles, ArrowRight, Globe
} from "lucide-react";
import { useContentPipeline, type PipelineRun, type WebhookConfig } from "@/hooks/useContentPipeline";
import { format } from "date-fns";
import { useTranslation } from "react-i18next";

const PLATFORM_OPTIONS = [
  { value: "twitter", label: "X (Twitter)" },
  { value: "instagram", label: "Instagram" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" },
  { value: "linkedin", label: "LinkedIn" },
  { value: "website", label: "Website" },
];

const getStatusIcon = (status: string) => {
  switch (status) {
    case "completed": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "running": return <Loader2 className="h-4 w-4 text-primary animate-spin" />;
    case "failed": return <XCircle className="h-4 w-4 text-destructive" />;
    default: return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

const getStepLabel = (t: (key: string) => string, step: string) => {
  const labels: Record<string, string> = {
    started: t("pipeline.stepStarted"),
    generating_content: t("pipeline.stepGeneratingContent"),
    content_generated: t("pipeline.stepContentGenerated"),
    generating_image: t("pipeline.stepGeneratingImage"),
    image_generated: t("pipeline.stepImageGenerated"),
    image_failed: t("pipeline.stepImageFailed"),
    image_skipped: t("pipeline.stepImageSkipped"),
    creating_post: t("pipeline.stepCreatingPost"),
    post_created: t("pipeline.stepPostCreated"),
    firing_webhooks: t("pipeline.stepFiringWebhooks"),
    webhooks_fired: t("pipeline.stepWebhooksFired"),
  };
  return labels[step] || step;
};

export default function ContentPipeline() {
  const { t } = useTranslation();
  const { pipelineRuns, webhooks, isLoading, runPipeline, addWebhook, deleteWebhook, toggleWebhook } = useContentPipeline();

  const [topic, setTopic] = useState("");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(["twitter"]);
  const [scheduleMode, setScheduleMode] = useState<"immediate" | "scheduled" | "draft">("draft");
  const [scheduledAt, setScheduledAt] = useState("");
  const [isRunning, setIsRunning] = useState(false);

  // Webhook form
  const [whDialogOpen, setWhDialogOpen] = useState(false);
  const [whName, setWhName] = useState("");
  const [whUrl, setWhUrl] = useState("");
  const [whPlatforms, setWhPlatforms] = useState<string[]>([]);

  const handleRun = async () => {
    if (!topic.trim() || selectedPlatforms.length === 0) return;
    setIsRunning(true);
    try {
      await runPipeline.mutateAsync({
        topic: topic.trim(),
        platforms: selectedPlatforms,
        scheduleMode,
        scheduledAt: scheduleMode === "scheduled" ? scheduledAt : undefined,
      });
      setTopic("");
    } finally {
      setIsRunning(false);
    }
  };

  const togglePlatform = (platform: string) => {
    setSelectedPlatforms(prev =>
      prev.includes(platform)
        ? prev.filter(p => p !== platform)
        : [...prev, platform]
    );
  };

  const handleAddWebhook = () => {
    if (!whName.trim() || !whUrl.trim()) return;
    addWebhook.mutate({ name: whName, url: whUrl, platforms: whPlatforms });
    setWhDialogOpen(false);
    setWhName("");
    setWhUrl("");
    setWhPlatforms([]);
  };

  const completedRuns = pipelineRuns.filter(r => r.status === "completed").length;
  const runningRuns = pipelineRuns.filter(r => r.status === "running").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="page-title mb-2">{t("pipeline.title")}</h1>
          <p className="text-sm text-muted-foreground font-medium max-w-xl opacity-60">
            {t("pipeline.subtitle")}
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-6 md:grid-cols-4 mb-8">
          <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-primary/40 transition-all duration-500">
            <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 blur-[40px] rounded-full -mr-12 -mt-12 group-hover:bg-primary/10 transition-all" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{t("pipeline.totalOperations")}</span>
              <Zap className="h-5 w-5 text-primary" />
            </div>
            <div className="text-4xl font-black text-white tracking-tighter relative z-10">{pipelineRuns.length}</div>
          </div>

          <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-emerald-500/40 transition-all duration-500">
            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 blur-[40px] rounded-full -mr-12 -mt-12 group-hover:bg-emerald-500/10 transition-all" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{t("pipeline.successRate")}</span>
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div className="text-4xl font-black text-emerald-500 tracking-tighter relative z-10">{completedRuns}</div>
          </div>

          <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-amber-500/40 transition-all duration-500">
            <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 blur-[40px] rounded-full -mr-12 -mt-12 group-hover:bg-amber-500/10 transition-all" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{t("pipeline.activeNodes")}</span>
              <Loader2 className="h-5 w-5 text-amber-500 animate-spin" />
            </div>
            <div className="text-4xl font-black text-amber-500 tracking-tighter relative z-10">{runningRuns}</div>
          </div>

          <div className="glass-card p-6 flex flex-col gap-4 relative overflow-hidden group hover:border-blue-500/40 transition-all duration-500">
            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 blur-[40px] rounded-full -mr-12 -mt-12 group-hover:bg-blue-500/10 transition-all" />
            <div className="flex items-center justify-between relative z-10">
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{t("pipeline.integrations")}</span>
              <Webhook className="h-5 w-5 text-blue-500" />
            </div>
            <div className="flex items-baseline gap-2 relative z-10">
              <div className="text-4xl font-black text-white tracking-tighter">{webhooks.filter(w => w.isActive).length}</div>
              <span className="text-[10px] font-black text-muted-foreground/40 uppercase tracking-widest">{t("pipeline.active")}</span>
            </div>
          </div>
        </div>

        <Tabs defaultValue="create" className="space-y-6">
          <TabsList className="bg-white/[0.07] border border-white/[0.16] p-1.5 rounded-2xl h-auto">
            <TabsTrigger value="create" className="text-[10px] font-black uppercase tracking-[0.2em] px-8 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">{t("pipeline.tabCreate")}</TabsTrigger>
            <TabsTrigger value="history" className="text-[10px] font-black uppercase tracking-[0.2em] px-8 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">{t("pipeline.tabHistory")}</TabsTrigger>
            <TabsTrigger value="webhooks" className="text-[10px] font-black uppercase tracking-[0.2em] px-8 py-3 rounded-xl data-[state=active]:bg-primary data-[state=active]:text-white transition-all">{t("pipeline.tabWebhooks")}</TabsTrigger>
          </TabsList>

          {/* CREATE PIPELINE TAB */}
          <TabsContent value="create" className="space-y-4">
            <div className="grid gap-6 lg:grid-cols-5">
              {/* Pipeline Form */}
              <Card className="lg:col-span-3 bg-card border-border">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-foreground">
                    <Sparkles className="h-5 w-5 text-primary" />
                    {t("pipeline.automatedGeneration")}
                  </CardTitle>
                  <CardDescription>
                    {t("pipeline.automatedGenerationDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Topic */}
                  <div className="space-y-2">
                    <Label>{t("pipeline.contentTopic")}</Label>
                    <Textarea
                      placeholder={t("pipeline.contentTopicPlaceholder")}
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      className="min-h-[100px]"
                      disabled={isRunning}
                    />
                  </div>

                  {/* Platforms */}
                  <div className="space-y-2">
                    <Label>{t("pipeline.targetPlatforms")}</Label>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORM_OPTIONS.map((p) => (
                        <Badge
                          key={p.value}
                          variant={selectedPlatforms.includes(p.value) ? "default" : "outline"}
                          className="cursor-pointer px-3 py-1.5"
                          onClick={() => !isRunning && togglePlatform(p.value)}
                        >
                          {p.label}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Schedule Mode */}
                  <div className="space-y-2">
                    <Label>{t("pipeline.afterGeneration")}</Label>
                    <Select value={scheduleMode} onValueChange={(v: any) => setScheduleMode(v)} disabled={isRunning}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">
                          <span className="flex items-center gap-2"><FileText className="h-3 w-3" /> {t("pipeline.saveAsDraft")}</span>
                        </SelectItem>
                        <SelectItem value="scheduled">
                          <span className="flex items-center gap-2"><Calendar className="h-3 w-3" /> {t("pipeline.schedule")}</span>
                        </SelectItem>
                        <SelectItem value="immediate">
                          <span className="flex items-center gap-2"><Send className="h-3 w-3" /> {t("pipeline.publishViaWebhooks")}</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {scheduleMode === "scheduled" && (
                    <div className="space-y-2">
                      <Label>{t("pipeline.scheduleDateTime")}</Label>
                      <Input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        disabled={isRunning}
                      />
                    </div>
                  )}

                  {/* Run Button */}
                  <Button
                    size="lg"
                    className="w-full gap-2 bg-primary hover:opacity-90 text-white font-black uppercase tracking-widest py-6 rounded-2xl shadow-xl shadow-primary/20 border-0"
                    onClick={handleRun}
                    disabled={isRunning || !topic.trim() || selectedPlatforms.length === 0}
                  >
                    {isRunning ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("pipeline.generatingCampaign")}
                      </>
                    ) : (
                      <>
                        <Zap className="h-4 w-4" />
                        {t("pipeline.runPipeline")}
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Pipeline Steps Visual */}
              <Card className="lg:col-span-2 bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-sm text-foreground">{t("pipeline.automationFlow")}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { icon: Sparkles, label: t("pipeline.step1Label"), desc: t("pipeline.step1Desc") },
                      { icon: FileText, label: t("pipeline.step2Label"), desc: t("pipeline.step2Desc") },
                      { icon: Image, label: t("pipeline.step3Label"), desc: t("pipeline.step3Desc") },
                      { icon: Calendar, label: t("pipeline.step4Label"), desc: t("pipeline.step4Desc") },
                    ].map((step, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-muted text-primary shadow-sm">
                          <step.icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-bold text-foreground leading-tight">{step.label}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{step.desc}</p>
                        </div>
                        {i < 3 && <ArrowRight className="h-4 w-4 text-border mt-3" />}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* HISTORY TAB */}
          <TabsContent value="history" className="space-y-4">
            <ScrollArea className="h-[600px]">
              <div className="space-y-3">
                {pipelineRuns.length === 0 ? (
                  <Card>
                    <CardContent className="py-12 text-center text-muted-foreground">
                      <Zap className="h-12 w-12 mx-auto mb-4 opacity-20" />
                      <p>{t("pipeline.noRunsYet")}</p>
                    </CardContent>
                  </Card>
                ) : (
                  pipelineRuns.map((run) => (
                    <PipelineRunCard key={run.id} run={run} />
                  ))
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* WEBHOOKS TAB */}
          <TabsContent value="webhooks" className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">{t("pipeline.publishWebhooks")}</h3>
                <p className="text-sm text-muted-foreground">
                  {t("pipeline.publishWebhooksDesc")}
                </p>
              </div>
              <Dialog open={whDialogOpen} onOpenChange={setWhDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    {t("pipeline.addWebhook")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t("pipeline.addWebhookEndpoint")}</DialogTitle>
                    <DialogDescription>
                      {t("pipeline.addWebhookDesc")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("pipeline.name")}</Label>
                      <Input placeholder={t("pipeline.namePlaceholder")} value={whName} onChange={(e) => setWhName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("pipeline.webhookUrl")}</Label>
                      <Input placeholder="https://hooks.zapier.com/..." value={whUrl} onChange={(e) => setWhUrl(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("pipeline.platformsOptional")}</Label>
                      <div className="flex flex-wrap gap-2">
                        {PLATFORM_OPTIONS.map((p) => (
                          <Badge
                            key={p.value}
                            variant={whPlatforms.includes(p.value) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => setWhPlatforms(prev =>
                              prev.includes(p.value) ? prev.filter(x => x !== p.value) : [...prev, p.value]
                            )}
                          >
                            {p.label}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setWhDialogOpen(false)}>{t("common.cancel")}</Button>
                    <Button onClick={handleAddWebhook} disabled={!whName.trim() || !whUrl.trim()}>{t("pipeline.addWebhook")}</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>

            <div className="space-y-3">
              {webhooks.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center text-muted-foreground">
                    <Webhook className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p>{t("pipeline.noWebhooksConfigured")}</p>
                  </CardContent>
                </Card>
              ) : (
                webhooks.map((wh) => (
                  <Card key={wh.id}>
                    <CardContent className="flex items-center justify-between py-4">
                      <div className="flex items-center gap-3">
                        <Webhook className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{wh.name}</p>
                          <p className="text-xs text-muted-foreground font-mono">{wh.url}</p>
                          {wh.platforms.length > 0 && (
                            <div className="flex gap-1 mt-1">
                              {wh.platforms.map(p => (
                                <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Switch
                          checked={wh.isActive}
                          onCheckedChange={() => toggleWebhook.mutate({ id: wh.id, isActive: wh.isActive })}
                        />
                        <Button variant="ghost" size="icon" onClick={() => deleteWebhook.mutate(wh.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}

function PipelineRunCard({ run }: { run: PipelineRun }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);

  const progress = run.status === "completed" ? 100 : run.status === "running"
    ? Math.min(90, (run.steps.length / 7) * 100)
    : 0;

  return (
    <Card className="cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(run.status)}
            <div>
              <p className="font-medium">{run.topic}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(run.createdAt), "MMM d, yyyy HH:mm")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {run.platforms.map(p => (
              <Badge key={p} variant="secondary" className="text-xs">{p}</Badge>
            ))}
            <Badge variant={run.status === "completed" ? "default" : run.status === "running" ? "secondary" : "destructive"}>
              {run.status}
            </Badge>
          </div>
        </div>

        {run.status === "running" && (
          <Progress value={progress} className="mt-3 h-2" />
        )}

        {expanded && (
          <div className="mt-4 space-y-2 border-t pt-3">
            <p className="text-xs font-medium text-muted-foreground uppercase">{t("pipeline.pipelineSteps")}</p>
            {run.steps.map((step, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="h-3 w-3 text-green-500" />
                <span>{getStepLabel(t, step.step)}</span>
                <span className="text-xs text-muted-foreground ml-auto">
                  {format(new Date(step.ts), "HH:mm:ss")}
                </span>
              </div>
            ))}
            {run.result && (
              <div className="mt-2 p-3 rounded-md bg-muted text-sm">
                <p><strong>{t("pipeline.post")}:</strong> {run.result.title}</p>
                <p><strong>{t("pipeline.image")}:</strong> {run.result.hasImage ? t("pipeline.yes") : t("pipeline.no")}</p>
                <p><strong>{t("pipeline.status")}:</strong> {run.result.postStatus}</p>
              </div>
            )}
            {run.errorMessage && (
              <p className="text-sm text-destructive">{run.errorMessage}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
