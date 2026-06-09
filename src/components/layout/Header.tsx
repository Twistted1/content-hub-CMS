import { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NotificationsDropdown } from "@/components/header/NotificationsDropdown";
import { UserDropdown } from "@/components/header/UserDropdown";
import { SearchCommand } from "@/components/header/SearchCommand";
const formatTime = () =>
  new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

export function Header() {
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
