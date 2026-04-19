import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsDropdown } from "@/components/header/NotificationsDropdown";
import { UserDropdown } from "@/components/header/UserDropdown";
import { SearchCommand } from "@/components/header/SearchCommand";
import { useLocation } from "react-router-dom";

const routeTitles: Record<string, string> = {
  "/dashboard": "Overview",
  "/automation": "Automation",
  "/platforms": "Platforms",
  "/calendar": "Content Calendar",
  "/articles": "Articles",
  "/projects": "Projects",
  "/strategies": "Strategies",
  "/notes": "Notes",
  "/analytics": "Analytics",
  "/reports": "Reports",
  "/gantt": "Gantt Chart",
  "/templates": "Templates",
  "/ai": "AI Assistant",
  "/users": "Users",
  "/import": "Import Data",
  "/settings": "Settings",
  "/pipeline": "Content Pipeline",
  "/models": "Content Models",
  "/workflow": "Workflow",
};

const formatTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function Header() {
  const location = useLocation();
  const title = routeTitles[location.pathname] || "Overview";
  const [time, setTime] = useState(formatTime);

  useEffect(() => {
    const id = setInterval(() => setTime(formatTime()), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6">
      {/* Workspace Selector */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
          <span className="text-xs uppercase tracking-wide">Workspace</span>
          <span className="font-medium text-foreground">My Workspace</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
        <span className="text-muted-foreground">|</span>
        <div className="flex flex-col">
          <h2 className="text-xl font-black text-foreground tracking-tighter uppercase leading-none">{title}</h2>
          <span className="text-[10px] font-bold text-primary uppercase tracking-widest leading-none mt-0.5">Content Hub</span>
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex items-center gap-4">
        <SearchCommand />

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{time}</span>
          <span className="text-xs uppercase">Local</span>
        </div>

        <NotificationsDropdown />

        <div className="pl-2 border-l border-border">
          <UserDropdown />
        </div>
      </div>
    </header>
  );
}
