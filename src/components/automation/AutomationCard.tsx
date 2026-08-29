import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, Pause, Clock, Zap, RefreshCw, MoreHorizontal, Pencil, Trash2, History, Copy, Twitter, Instagram, Facebook, Mail, Bell, Globe, Rocket } from "lucide-react";
import { triggerOptions } from "./automationData";
import { Automation } from "@/hooks/useAutomations";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

interface AutomationCardProps {
  automation: Automation;
  onToggle: (id: string) => void;
  onEdit: (automation: Automation) => void;
  onDelete: (id: string) => void;
  onRun: (id: string) => void;
  onViewHistory: (automation: Automation) => void;
  onDuplicate?: (id: string) => void;
}

export function AutomationCard({
  automation,
  onToggle,
  onEdit,
  onDelete,
  onRun,
  onViewHistory,
  onDuplicate,
}: AutomationCardProps) {
  const { t } = useTranslation();
  const triggerLabel = triggerOptions.find((opt) => opt.value === automation.trigger)?.label || automation.trigger;

  const getPlatformIcon = (platform: string) => {
    const p = platform.toLowerCase();
    if (p.includes("twitter") || p === "x") return <Twitter className="h-4 w-4" />;
    if (p.includes("instagram")) return <Instagram className="h-4 w-4" />;
    if (p.includes("facebook")) return <Facebook className="h-4 w-4" />;
    if (p.includes("email")) return <Mail className="h-4 w-4" />;
    if (p.includes("slack")) return <Bell className="h-4 w-4" />;
    if (p.includes("website")) return <Globe className="h-4 w-4" />;
    return <Zap className="h-4 w-4" />;
  };

  return (
    <div className="group relative flex items-center justify-between p-8 rounded-[2rem] border border-border/50 bg-card/20 backdrop-blur-3xl hover:bg-card/40 hover:border-primary/50 transition-all duration-500 shadow-2xl overflow-hidden">
      {/* Glow Effect on Hover */}
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
      
      {/* Decorative Brand Accent */}
      <div className={cn(
        "absolute top-0 right-[-20%] w-[40%] h-full rotate-12 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity duration-700 pointer-events-none",
        automation.status === "active" ? "bg-primary" : "bg-muted-foreground"
      )} />
      
      <div className="flex items-center gap-8 z-10">
        <div
          className={cn(
            "w-16 h-16 rounded-2xl shadow-inner border flex items-center justify-center transition-all duration-700",
            automation.status === "active"
              ? "bg-primary/20 text-primary border-primary/20 scale-100 group-hover:scale-110 shadow-primary/20"
              : "bg-muted/50 text-muted-foreground border-border/50 opacity-50"
          )}
        >
          {automation.status === "active" ? (
            <Play className="h-6 w-6 fill-primary/20" />
          ) : (
            <Pause className="h-6 w-6" />
          )}
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <h3 className="text-xl font-black italic uppercase tracking-tighter text-foreground group-hover:text-primary transition-colors">
              {automation.name}
            </h3>
            <Badge 
              variant="outline" 
              className={cn(
                "text-[10px] font-black uppercase tracking-[0.2em] px-3 py-1",
                automation.status === "active" 
                  ? "border-success/50 text-success bg-success/10" 
                  : "border-muted-foreground/20 text-muted-foreground bg-muted/10 opacity-60"
              )}
            >
              {t(`automation.status${automation.status.charAt(0).toUpperCase()}${automation.status.slice(1)}`, automation.status)}
            </Badge>
          </div>
          
          <p className="text-[13px] text-muted-foreground font-medium max-w-[500px] line-clamp-1 opacity-80 group-hover:opacity-100 transition-opacity">
            {automation.description}
          </p>
          
          <div className="flex flex-wrap items-center gap-6 pt-2">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/50 border border-border/50 shadow-sm">
              <Rocket className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/90">{triggerLabel}</span>
            </div>
            
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/50 border border-border/50 shadow-sm">
              <Clock className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/90">
                {automation.lastRun ? t("automation.last", { date: new Date(automation.lastRun).toLocaleDateString() }) : t("automation.never")}
              </span>
            </div>

            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-background/50 border border-border/50 shadow-sm">
              <RefreshCw className="h-3.5 w-3.5 text-primary" />
              <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/90">{t("automation.executions", { count: automation.runs })}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-8 z-10">
        <div className="hidden lg:flex items-center gap-2.5">
          {automation.platforms.slice(0, 4).map((platform) => (
            <div 
              key={platform} 
              title={platform}
              className="w-10 h-10 rounded-xl bg-background/80 border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary transition-all duration-300 cursor-help group-hover:shadow-[0_0_10px_rgba(168,85,247,0.1)]"
            >
              {getPlatformIcon(platform)}
            </div>
          ))}
          {automation.platforms.length > 4 && (
            <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-[10px] font-black text-primary">
              +{automation.platforms.length - 4}
            </div>
          )}
        </div>
        
        <div className="h-10 w-px bg-border/50 mx-4" />
        
        <div className="flex items-center gap-4">
          <Switch
            checked={automation.status === "active"}
            onCheckedChange={() => onToggle(automation.id)}
            className="data-[state=checked]:bg-primary scale-110"
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl hover:bg-primary/10 hover:text-primary transition-all border border-transparent hover:border-primary/20">
                <MoreHorizontal className="h-6 w-6" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 rounded-3xl border-border/50 bg-popover/95 backdrop-blur-3xl shadow-2xl p-3">
              <DropdownMenuItem onClick={() => onRun(automation.id)} className="rounded-xl h-12 font-black text-[11px] uppercase tracking-widest cursor-pointer gap-4">
                <div className="p-2 bg-success/10 rounded-lg">
                   <Play className="h-4 w-4 text-success" />
                </div>
                {t("automation.runPipeline")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onViewHistory(automation)} className="rounded-xl h-12 font-black text-[11px] uppercase tracking-widest cursor-pointer gap-4">
                <div className="p-2 bg-primary/10 rounded-lg">
                   <History className="h-4 w-4 text-primary" />
                </div>
                {t("automation.viewLogs")}
              </DropdownMenuItem>
              {onDuplicate && (
                <DropdownMenuItem onClick={() => onDuplicate(automation.id)} className="rounded-xl h-12 font-black text-[11px] uppercase tracking-widest cursor-pointer gap-4">
                  <div className="p-2 bg-info/10 rounded-lg">
                    <Copy className="h-4 w-4 text-info" />
                  </div>
                  {t("automation.cloneStream")}
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator className="bg-border/30 my-2 mx-2" />
              <DropdownMenuItem onClick={() => onEdit(automation)} className="rounded-xl h-12 font-black text-[11px] uppercase tracking-widest cursor-pointer gap-4">
                <div className="p-2 bg-warn/10 rounded-lg">
                   <Pencil className="h-4 w-4 text-warn" />
                </div>
                {t("automation.modify")}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onDelete(automation.id)}
                className="rounded-xl h-12 font-black text-[11px] uppercase tracking-widest text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer gap-4"
              >
                <div className="p-2 bg-destructive/10 rounded-lg">
                   <Trash2 className="h-4 w-4" />
                </div>
                {t("automation.terminate")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  );
}

