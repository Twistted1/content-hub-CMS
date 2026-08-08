import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Share2,
  FolderKanban,
  Calendar,
  StickyNote,
  Target,
  Sparkles,
  Settings,
  FileText,
  BarChart3,
  FileSpreadsheet,
  GanttChart,
  Users,
  Upload,
  LogOut,
  Zap,
  ChevronRight,
  Diamond,
  Menu,
  Inbox,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { toast } from "sonner";

const mainNavItems = [
  { icon: LayoutDashboard, labelKey: "nav.overview", href: "/dashboard" },
  { icon: Share2, labelKey: "nav.platforms", href: "/platforms" },
  { icon: FolderKanban, labelKey: "nav.projects", href: "/projects" },
  { icon: Calendar, labelKey: "nav.calendar", href: "/calendar" },
  { icon: StickyNote, labelKey: "nav.notes", href: "/notes" },
  { icon: Target, labelKey: "nav.strategies", href: "/strategies" },
  { icon: GanttChart, labelKey: "nav.contentModels", href: "/models" },
];

const toolsNavItems = [
  { icon: Inbox, labelKey: "nav.reviewInbox", href: "/review" },
  { icon: Sparkles, labelKey: "nav.aiAssistant", href: "/ai" },
  { icon: Zap, labelKey: "nav.pipeline", href: "/pipeline" },
  { icon: Settings, labelKey: "nav.automation", href: "/automation" },
  { icon: FileText, labelKey: "nav.templates", href: "/templates" },
  { icon: BarChart3, labelKey: "nav.analytics", href: "/analytics" },
  { icon: FileSpreadsheet, labelKey: "nav.reports", href: "/reports" },
];

const adminNavItems = [
  { icon: Users, labelKey: "nav.users", href: "/users" },
  { icon: Upload, labelKey: "nav.importData", href: "/import" },
];

interface NavItemProps {
  icon: React.ElementType;
  labelKey: string;
  href: string;
}

const NavItem = ({ icon: Icon, labelKey, href, onNavigate }: NavItemProps & { onNavigate?: () => void }) => {
  const { t } = useTranslation();
  return (
    <NavLink
      to={href}
      onClick={onNavigate}
      className={cn(
        "group flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
        "text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-white/[0.05] border border-transparent hover:border-white/[0.05]"
      )}
      activeClassName="bg-white/[0.08] text-sidebar-foreground border-white/[0.1] shadow-lg shadow-black/20"
    >
      <div className="flex items-center gap-3">
        <div className="p-1 rounded-lg bg-white/[0.03] group-hover:bg-primary/10 transition-colors">
          <Icon className="h-4.5 w-4.5 group-hover:text-primary transition-colors" />
        </div>
        <span>{t(labelKey)}</span>
      </div>
      <ChevronRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-40 -translate-x-2 group-hover:translate-x-0 transition-all" />
    </NavLink>
  );
};

const NavSection = ({ title, items, onNavigate }: { title: string; items: NavItemProps[]; onNavigate?: () => void }) => (
  <div className="space-y-1.5">
    <h3 className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-3">
      {title}
    </h3>
    <div className="space-y-1">
      {items.map((item) => (
        <NavItem key={item.href} {...item} onNavigate={onNavigate} />
      ))}
    </div>
  </div>
);

const SidebarContent = ({ onNavigate }: { onNavigate?: () => void }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { tier } = useSubscription();

  const handleLogout = async () => {
    const { error } = await signOut();
    if (error) {
      toast.error(t("header.toastLogoutFailed"));
    } else {
      toast.success(t("header.toastLoggedOut"));
      navigate("/");
    }
  };

  return (
    <>
      <div className="flex items-center gap-3.5 px-6 py-8">
        <div className="flex flex-col gap-[4px] justify-center cursor-pointer w-9 h-11 transition-transform hover:scale-105">
          <div className="w-full h-[5px] bg-[#e62b2b] rounded-full"></div>
          <div className="w-full h-[5px] bg-white rounded-full"></div>
          <div className="w-full h-[5px] bg-[#8a94a6] rounded-full"></div>
        </div>
        <div>
          <h1 className="text-xl font-black text-sidebar-foreground tracking-tighter uppercase whitespace-nowrap leading-none">
            CONTENT <span className="text-primary">HUB</span>
          </h1>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded uppercase tracking-wider">{t("nav.headlessCms")}</span>
            <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-4 space-y-9 custom-scrollbar">
        <NavSection title={t("nav.main")} items={mainNavItems} onNavigate={onNavigate} />
        <NavSection title={t("nav.tools")} items={toolsNavItems} onNavigate={onNavigate} />
        <NavSection title={t("nav.admin")} items={adminNavItems} onNavigate={onNavigate} />

        {/* Upgrade Card — only for accounts that aren't already Pro; it was showing
            unconditionally to everyone, including paid Pro users, which reads as if
            they don't actually have what they paid for. */}
        {tier !== "pro" && (
        <div className="mt-8 mx-2 p-5 rounded-3xl bg-gradient-to-br from-white/[0.05] to-transparent border border-white/[0.08] relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition-opacity">
            <Sparkles className="h-12 w-12 text-primary" />
          </div>
          <h4 className="text-sm font-bold text-sidebar-foreground mb-1 relative z-10">{t("nav.proVersion")}</h4>
          <p className="text-[11px] text-muted-foreground mb-4 relative z-10">{t("nav.proVersionDesc")}</p>
          <button
            onClick={() => navigate("/pricing")}
            className="w-full py-2.5 rounded-xl bg-white text-black text-xs font-black hover:bg-primary hover:text-white transition-all shadow-lg shadow-white/5 active:scale-95 relative z-10"
          >
            {t("nav.upgradeNow")}
          </button>
        </div>
        )}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-sidebar-border/[0.06] bg-white/[0.02]">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-destructive/10 hover:text-destructive w-full transition-all duration-300 group"
        >
          <LogOut className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
          <span>{t("common.logout")}</span>
        </button>
      </div>
    </>
  );
};

export function Sidebar() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (isMobile) {
    return (
      <>
        <button
          onClick={() => setOpen(true)}
          aria-label={t("nav.openMenu")}
          className="fixed top-4 left-4 z-50 flex h-10 w-10 items-center justify-center rounded-xl bg-sidebar/90 backdrop-blur-xl border border-sidebar-border/[0.08] text-sidebar-foreground premium-shadow"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent
            side="left"
            className="w-72 max-w-[85vw] p-0 flex flex-col bg-sidebar border-sidebar-border/[0.06] text-sidebar-foreground"
          >
            <SidebarContent onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </>
    );
  }

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-72 bg-sidebar/80 backdrop-blur-2xl border-r border-sidebar-border/[0.06] flex flex-col premium-shadow">
      <SidebarContent />
    </aside>
  );
}
