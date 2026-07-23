import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GanttChart, Plus, Share2, Sparkles, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

/**
 * ContentModel Page
 * Represents the structure and relationship of content types within the CMS.
 */
export default function ContentModel() {
  const { t } = useTranslation();
  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-700">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <h1 className="page-title mb-2">{t("contentModel.title")}</h1>
            <p className="text-sm text-muted-foreground font-medium opacity-60">
              {t("contentModel.subtitle")}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="rounded-xl border-border bg-card/50 px-6 font-black uppercase text-[10px] tracking-widest gap-2">
               {t("contentModel.blueprintStatus")}
            </Button>
            <Button className="rounded-xl bg-primary hover:opacity-90 text-white font-black uppercase text-[10px] tracking-widest px-8 shadow-lg shadow-primary/20 gap-2">
              <Plus className="h-4 w-4" />
              {t("contentModel.defineModel")}
            </Button>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-card/20 backdrop-blur-3xl border border-border/50 rounded-[2.5rem] p-10 relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-12 opacity-[0.02] group-hover:scale-110 transition-transform duration-1000">
                <GanttChart className="h-48 w-48" />
             </div>

             <div className="relative z-10">
                <Badge variant="outline" className="mb-6 bg-primary/10 border-primary/20 text-primary text-[10px] font-black tracking-widest px-3">{t("contentModel.architecture")}</Badge>
                <h2 className="text-xl font-black tracking-tighter text-foreground mb-4 italic uppercase">{t("contentModel.visualMapping")}</h2>
                <p className="text-muted-foreground max-w-2xl leading-relaxed">
                  {t("contentModel.mappingDesc")}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12">
                   <div className="space-y-4 p-6 rounded-2xl bg-background/40 border border-border/50">
                      <div className="flex items-center gap-3 text-primary">
                         <Share2 className="h-5 w-5" />
                         <span className="text-[10px] font-black uppercase tracking-widest">{t("contentModel.crossPlatformSync")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">{t("contentModel.crossPlatformSyncDesc")}</p>
                   </div>
                   <div className="space-y-4 p-6 rounded-2xl bg-background/40 border border-border/50">
                      <div className="flex items-center gap-3 text-primary">
                         <Zap className="h-5 w-5" />
                         <span className="text-[10px] font-black uppercase tracking-widest">{t("contentModel.logicInjection")}</span>
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">{t("contentModel.logicInjectionDesc")}</p>
                   </div>
                </div>
             </div>
          </div>

          <div className="flex flex-col gap-6">
             <div className="bg-primary/5 border border-primary/20 rounded-[2rem] p-8 group hover:bg-primary/10 transition-all cursor-pointer">
                <div className="flex items-center gap-2 mb-4">
                   <Sparkles className="h-5 w-5 text-primary" />
                   <h3 className="text-sm font-black italic uppercase tracking-widest text-foreground">{t("contentModel.aiSchemaSuggest")}</h3>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{t("contentModel.aiSchemaSuggestDesc")}</p>
                <Button variant="link" className="p-0 h-auto text-[10px] font-black uppercase tracking-widest text-primary mt-6 group">
                   {t("contentModel.runAnalysis")}
                   <Zap className="ml-1 h-3 w-3 group-hover:scale-125 transition-transform" />
                </Button>
             </div>

             <div className="bg-card border border-border rounded-[2rem] p-8 flex flex-col justify-center items-center text-center">
                <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center mb-6 opacity-40">
                   <Plus className="h-8 w-8" />
                </div>
                <h4 className="font-black italic uppercase tracking-tighter text-foreground mb-2">{t("contentModel.noCustomModels")}</h4>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{t("contentModel.usingDefaultBlueprints")}</p>
             </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
