import { useEffect, useRef, useState, useMemo } from "react";
import { format } from "date-fns";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Send,
  Bot,
  User,
  Trash2,
  MessageSquare,
  Zap,
  FileText,
  Play,
  Copy,
  Settings,
  Search,
  CheckCircle2,
  Info,
  Menu,
  Calendar as CalendarIcon,
  Twitter,
  Instagram,
  Wand2,
  Hash,
  Image,
  Lightbulb,
  ChevronLeft,
  LayoutDashboard,
  TrendingUp,
  Plus,
  Sparkles,
  PenTool,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useChat } from "@/hooks/useChat";
import { usePosts } from "@/hooks/usePosts";
import { useUJT } from "@/hooks/useUJT";
import { useNotes } from "@/hooks/useNotes";
import { useTemplates } from "@/hooks/useTemplates";
import { useSpeechRecognition, useSpeechSynthesisPlayer } from "@/hooks/useSpeech";
import { NotificationsDropdown } from "@/components/header/NotificationsDropdown";
import { UserDropdown } from "@/components/header/UserDropdown";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

// --- Types & Constants ---

const getQuickActions = (t: TFunction) => [
  { icon: <Wand2 className="w-3.5 h-3.5" />, label: t("aiAssistant.actionGeneratePost"), prompt: t("aiAssistant.promptGeneratePost") },
  { icon: <Hash className="w-3.5 h-3.5" />, label: t("aiAssistant.actionFindHashtags"), prompt: t("aiAssistant.promptFindHashtags") },
  { icon: <Image className="w-3.5 h-3.5" />, label: t("aiAssistant.actionCaptionImage"), prompt: t("aiAssistant.promptCaptionImage") },
  { icon: <Lightbulb className="w-3.5 h-3.5" />, label: t("aiAssistant.actionBrainstorm"), prompt: t("aiAssistant.promptBrainstorm") },
];

// --- Sub-components ---

function HeaderStat({ icon, count, label, color }: any) {
  const colorMap: any = {
    indigo: "bg-primary/10 text-primary border-primary/20",
    amber: "bg-amber-500/10 text-amber-500 border-amber-500/20",
    rose: "bg-rose-500/10 text-rose-500 border-rose-500/20",
    emerald: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
  };
  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-[11px] font-bold tracking-tight ${colorMap[color] || colorMap.indigo}`}>
      <span>{icon}</span>
      <span className="flex items-center gap-1">
        <span className="text-foreground">{count}</span>
        <span className="opacity-70 font-medium lowercase">{label}</span>
      </span>
    </div>
  );
}

function AISidebar({ onQuickAction, onNewChat }: any) {
  const { t } = useTranslation();
  const QUICK_ACTIONS = getQuickActions(t);
  const TIPS = [
    { text: t("aiAssistant.tip1"), icon: "💡" },
    { text: t("aiAssistant.tip2"), icon: "🎯" },
    { text: t("aiAssistant.tip3"), icon: "✨" },
    { text: t("aiAssistant.tip4"), icon: "📊" },
  ];
  return (
    <aside className="w-full md:w-[310px] bg-card border-r border-border flex flex-col h-full overflow-y-auto custom-scrollbar">
      <div className="p-6">
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary hover:text-primary-foreground hover:bg-primary transition-all">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-[#a855f7] flex items-center justify-center shadow-lg shadow-primary/20">
              <Bot className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-black text-foreground leading-none tracking-tight">{t("aiAssistant.title")}</h2>
              <p className="text-[10px] font-bold text-muted-foreground mt-1">{t("aiAssistant.subtitle")}</p>
            </div>
          </div>
        </div>

        <Button
          onClick={onNewChat}
          className="w-full h-12 mb-8 bg-gradient-to-r from-primary to-[#a855f7] hover:opacity-90 text-primary-foreground rounded-2xl flex items-center justify-center gap-2 group transition-all shadow-xl shadow-primary/10 border-0"
        >
          <Plus className="w-4 h-4 group-hover:rotate-90 transition-transform duration-300" />
          <span className="text-[11px] font-black uppercase tracking-[0.2em]">{t("aiAssistant.newChat")}</span>
        </Button>

        <div className="bg-muted/30 border border-border rounded-[32px] p-5 mb-8 shadow-sm">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">{t("aiAssistant.quickActions")}</h3>
          <div className="space-y-1">
            {QUICK_ACTIONS.map(action => (
              <button
                key={action.label}
                onClick={() => onQuickAction(action.prompt)}
                className="w-full flex items-center justify-between px-4 py-3 rounded-2xl transition-all group text-muted-foreground hover:text-foreground hover:bg-muted"
              >
                <div className="flex items-center gap-4">
                  <span className="text-muted-foreground group-hover:text-primary transition-colors">{action.icon}</span>
                  <span className="text-xs font-bold tracking-tight">{action.label}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="bg-muted/30 border border-border rounded-[32px] p-5 shadow-sm">
          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-4">{t("aiAssistant.aiTips")}</h3>
          <div className="space-y-4">
            {TIPS.map((tip, i) => (
              <div key={i} className="flex gap-3 items-center p-3 rounded-2xl bg-card border border-border">
                <span className="text-sm">{tip.icon}</span>
                <p className="text-[10px] font-bold text-muted-foreground leading-tight">{tip.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  );
}

const AIAssistant = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { messages, isLoading, sendMessage, resetChat, addGreeting, enhanceText } = useChat();
  const { addPost } = usePosts();
  const { posts } = usePosts();
  const { processUJT } = useUJT();
  const { notes } = useNotes();
  const { templates } = useTemplates();
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  // AISidebar was a fixed 310px inline column regardless of viewport - on a
  // phone that left almost nothing for the chat panel, which is exactly the
  // vertical-wrapped-text overflow seen on mobile. Same fix as Calendar's
  // sidebar: an overlay Sheet on mobile, closed by default, instead of a
  // column that shares layout flow with the chat.
  const [sidebarOpen, setSidebarOpen] = useState(true);
  useEffect(() => {
    if (isMobile) setSidebarOpen(false);
  }, [isMobile]);

  const [enhancing, setEnhancing] = useState(false);

  // Mic input — appends the transcript onto whatever was already typed
  // rather than replacing it, so voice and keyboard input can mix.
  const micBaseTextRef = useRef("");
  const { supported: micSupported, listening, start: startListening, stop: stopListening } = useSpeechRecognition(
    (finalTranscript) => {
      if (inputRef.current) {
        const base = micBaseTextRef.current;
        inputRef.current.value = (base ? base + " " : "") + finalTranscript;
      }
    },
    (reason) => {
      const key = reason === "not-allowed" || reason === "permission-denied"
        ? "aiAssistant.micErrorPermission"
        : reason === "audio-capture"
        ? "aiAssistant.micErrorNoDevice"
        : reason === "no-speech"
        ? "aiAssistant.micErrorNoSpeech"
        : "aiAssistant.micErrorGeneric";
      toast({ title: t("aiAssistant.micErrorTitle"), description: t(key), variant: "destructive" });
    }
  );
  const handleMicToggle = () => {
    if (listening) {
      stopListening();
    } else {
      micBaseTextRef.current = inputRef.current?.value.trim() || "";
      startListening();
    }
  };

  // Voice replies — auto-speaks each new assistant message when enabled,
  // plus a per-message play/stop button regardless of the toggle state.
  const [voiceRepliesOn, setVoiceRepliesOn] = useState(false);
  const { supported: ttsSupported, speakingId, speak, stop: stopSpeaking } = useSpeechSynthesisPlayer();
  const lastSpokenIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!voiceRepliesOn || !ttsSupported || isLoading) return;
    const last = messages[messages.length - 1];
    if (last && last.role === "assistant" && last.id !== lastSpokenIdRef.current) {
      lastSpokenIdRef.current = last.id;
      speak(last.content, last.id);
    }
  }, [messages, isLoading, voiceRepliesOn, ttsSupported, speak]);

  useEffect(() => {
    if (messages.length === 0) {
      addGreeting(t("aiAssistant.greeting"));
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!inputRef.current?.value.trim()) return;
    const val = inputRef.current.value;
    inputRef.current.value = "";
    await sendMessage(val);
  };

  const handleEnhance = async () => {
    const draft = inputRef.current?.value.trim();
    if (!draft) {
      toast({ title: t("aiAssistant.enhanceEmptyTitle"), description: t("aiAssistant.enhanceEmptyDesc") });
      return;
    }
    setEnhancing(true);
    try {
      const improved = await enhanceText(draft);
      if (improved && inputRef.current) {
        inputRef.current.value = improved;
        inputRef.current.focus();
      }
    } catch (err) {
      toast({
        title: t("aiAssistant.enhanceFailedTitle"),
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setEnhancing(false);
    }
  };

  const handleInsertTemplate = (content: string) => {
    if (inputRef.current) {
      inputRef.current.value = content;
      inputRef.current.focus();
    }
  };

  const handleProcessCampaign = async (jsonStr: string) => {
    try {
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return;
      
      const template = JSON.parse(jsonMatch[0]);
      await processUJT(template);
      toast({
        title: t("aiAssistant.campaignLaunchedTitle"),
        description: t("aiAssistant.campaignLaunchedDesc", { count: template.items?.length || 0 }),
      });
    } catch (err) {
      console.error("Failed to process campaign:", err);
      toast({
        title: t("aiAssistant.processFailedTitle"),
        description: t("aiAssistant.processFailedDesc"),
        variant: "destructive",
      });
    }
  };

  const handleQuickAction = (prompt: string) => {
    if (inputRef.current) {
      inputRef.current.value = prompt + " ";
      inputRef.current.focus();
    }
  };

  const handleNewChat = () => {
    resetChat();
    addGreeting(t("aiAssistant.greeting"));
    toast({ title: t("aiAssistant.newChatStarted") });
  };

  return (
    <DashboardLayout>
      <div className="flex bg-transparent overflow-hidden h-[calc(100vh-8rem)]">
        {isMobile ? (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="w-[85vw] max-w-[310px] p-0 bg-card border-border overflow-y-auto custom-scrollbar">
              <AISidebar onQuickAction={(prompt: string) => { handleQuickAction(prompt); setSidebarOpen(false); }} onNewChat={() => { handleNewChat(); setSidebarOpen(false); }} />
            </SheetContent>
          </Sheet>
        ) : (
          <AISidebar onQuickAction={handleQuickAction} onNewChat={handleNewChat} />
        )}

        <div className="flex-1 flex flex-col min-w-0 relative">
          <div className="px-4 md:px-8 py-3 md:py-4 flex items-center justify-between gap-2 z-30">
            <div className="flex items-center gap-2 md:gap-6 min-w-0">
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label={t("aiAssistant.title")}
                  className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg bg-foreground/[0.07] border border-border text-muted-foreground"
                >
                  <Menu className="w-4 h-4" />
                </button>
              )}
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)] shrink-0" />
                <h1 className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground truncate">{t("aiAssistant.strategyConsole")}</h1>
              </div>
              <div className="h-4 w-px bg-border/50 hidden sm:block" />
              <div className="items-center gap-2 hidden sm:flex">
                <Bot className="h-3 w-3 text-primary" />
                <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{t("aiAssistant.activeAssistant")}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 md:gap-4 shrink-0">
              <button
                type="button"
                disabled={!ttsSupported}
                onClick={() => {
                  const next = !voiceRepliesOn;
                  setVoiceRepliesOn(next);
                  if (!next) stopSpeaking();
                }}
                title={!ttsSupported ? t("aiAssistant.voiceUnsupported") : voiceRepliesOn ? t("aiAssistant.voiceRepliesOn") : t("aiAssistant.voiceRepliesOff")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 md:px-3 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest transition-all shrink-0",
                  voiceRepliesOn ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border hover:text-foreground",
                  !ttsSupported && "opacity-40 cursor-not-allowed"
                )}
              >
                {voiceRepliesOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
              </button>
              <div className="relative group hidden sm:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                <input
                  type="text"
                  placeholder={t("aiAssistant.searchChatPlaceholder")}
                  className="bg-muted border border-border rounded-full py-1.5 pl-9 pr-4 text-[11px] font-bold text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/50 w-48 transition-all"
                />
              </div>
            </div>
          </div>

          <main className="flex-1 overflow-hidden flex flex-col items-center pt-4 md:pt-8">
            <div className="w-full max-w-4xl flex-1 flex flex-col px-3 md:px-6">
              <ScrollArea className="flex-1 pr-4 custom-scrollbar mb-4">
                <div className="flex-1 overflow-y-auto space-y-6 px-4 py-8 custom-scrollbar mb-4" id="chat-messages">
                {messages.map((m) => {
                  const isUJT = m.content.includes('"version": "1.0"') && m.content.includes('"items":');
                  
                  return (
                    <div key={m.id} className={cn(
                      "flex flex-col max-w-[85%] animate-in fade-in slide-in-from-bottom-2 duration-300",
                      m.role === "user" ? "ml-auto items-end" : "mr-auto items-start"
                    )}>
                      <div className={cn(
                        "group relative px-6 py-4 rounded-3xl shadow-lg border backdrop-blur-md transition-all",
                        m.role === "user" 
                          ? "bg-primary text-primary-foreground border-primary shadow-primary/20 rounded-tr-none" 
                          : "bg-card text-foreground border-border shadow-black/20 rounded-tl-none"
                      )}>
                        <p className="text-[13px] font-medium leading-relaxed whitespace-pre-wrap">{m.content}</p>
                        
                        {isUJT && m.role === "assistant" && (
                          <div className="mt-6 p-4 rounded-2xl bg-muted border border-border shadow-inner animate-in zoom-in-95 duration-500">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center gap-2">
                                <Zap className="h-4 w-4 text-primary" />
                                <span className="text-[10px] font-black uppercase tracking-widest text-foreground">{t("aiAssistant.campaignDetected")}</span>
                              </div>
                              <Badge variant="outline" className="text-[9px] bg-background">{t("aiAssistant.versionReady")}</Badge>
                            </div>
                            <p className="text-[11px] text-muted-foreground mb-4">{t("aiAssistant.campaignDetectedDesc")}</p>
                            <Button
                              onClick={() => handleProcessCampaign(m.content)}
                              className="w-full bg-primary hover:opacity-90 text-primary-foreground font-black uppercase tracking-widest h-10 rounded-xl shadow-lg shadow-primary/10 gap-2 border-0"
                            >
                              <Play className="h-4 w-4" />
                              {t("aiAssistant.processCampaign")}
                            </Button>
                          </div>
                        )}

                        <div className={cn(
                          "absolute top-0 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity translate-y-[-100%] pb-1",
                          m.role === "user" ? "right-0" : "left-0"
                        )}>
                          {m.role === "assistant" && ttsSupported && (
                            <button
                              onClick={() => (speakingId === m.id ? stopSpeaking() : speak(m.content, m.id))}
                              title={speakingId === m.id ? t("aiAssistant.stopSpeaking") : t("aiAssistant.speakMessage")}
                              className="text-muted-foreground/50 hover:text-primary transition-colors"
                            >
                              {speakingId === m.id ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
                            </button>
                          )}
                          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50">
                            {format(new Date(m.timestamp), "h:mm a")}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
                {isLoading && (
                  <div className="mr-auto items-start flex flex-col">
                    <div className="bg-card px-6 py-4 rounded-3xl rounded-tl-none border border-border shadow-lg animate-pulse flex items-center gap-2">
                      <div className="flex gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
              </ScrollArea>

              <div className="pt-4 pb-8 w-full">
                <div className="relative group">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary to-[#a855f7] rounded-[36px] blur opacity-10 group-focus-within:opacity-20 transition duration-500"></div>
                  <div className="relative bg-card border border-border rounded-[32px] overflow-hidden shadow-2xl">
                    <Textarea
                      ref={inputRef}
                      placeholder={t("aiAssistant.inputPlaceholder")}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      className="min-h-[100px] max-h-[300px] w-full bg-transparent border-none focus-visible:ring-0 text-foreground placeholder-muted-foreground text-sm px-4 md:px-8 py-4 md:py-6 resize-none custom-scrollbar font-medium"
                      disabled={isLoading}
                    />
                    <div className="px-3 md:px-8 pb-4 md:pb-6 flex items-center justify-between gap-2 border-t border-border/50 pt-3 md:pt-4">
                      <div className="flex gap-1.5 md:gap-3">
                        <button
                          type="button"
                          title={t("aiAssistant.enhancePrompt")}
                          onClick={handleEnhance}
                          disabled={enhancing}
                          className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all border border-border disabled:opacity-50"
                        >
                          {enhancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        </button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button type="button" title={t("aiAssistant.editTemplate")} className="p-2 rounded-xl bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all border border-border">
                              <PenTool className="w-4 h-4" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-64">
                            {templates.length === 0 ? (
                              <div className="px-3 py-2 text-xs text-muted-foreground">{t("aiAssistant.noTemplates")}</div>
                            ) : (
                              templates.map((tpl) => (
                                <DropdownMenuItem key={tpl.id} onClick={() => handleInsertTemplate(tpl.content || tpl.description || "")}>
                                  {tpl.name}
                                </DropdownMenuItem>
                              ))
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <button
                          type="button"
                          title={!micSupported ? t("aiAssistant.micUnsupported") : listening ? t("aiAssistant.micStop") : t("aiAssistant.micStart")}
                          disabled={!micSupported}
                          onClick={handleMicToggle}
                          className={cn(
                            "p-2 rounded-xl transition-all border",
                            listening
                              ? "bg-destructive/10 text-destructive border-destructive/30 animate-pulse"
                              : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 border-border",
                            !micSupported && "opacity-40 cursor-not-allowed"
                          )}
                        >
                          {listening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                        </button>
                      </div>
                      <Button
                        onClick={handleSend}
                        disabled={isLoading}
                        className="h-9 md:h-12 px-3 md:px-8 rounded-2xl bg-gradient-to-r from-primary to-[#a855f7] hover:opacity-90 text-primary-foreground font-black uppercase text-[10px] tracking-[0.2em] shadow-xl shadow-primary/20 border-0 shrink-0"
                      >
                        <span className="mr-2 hidden sm:inline">{t("aiAssistant.sendMessage")}</span>
                        <Send className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
                <p className="text-[10px] text-center text-muted-foreground mt-6 font-bold uppercase tracking-widest opacity-50">
                  {t("aiAssistant.disclaimer")}
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AIAssistant;
