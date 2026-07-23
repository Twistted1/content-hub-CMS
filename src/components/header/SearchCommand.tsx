import { useState, useEffect } from "react";
import { Search, Folder, FileText, Zap, User, Target, ArrowRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useNavigate } from "react-router-dom";
import { useGlobalSearch, SearchResult } from "@/hooks/useGlobalSearch";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "react-i18next";

const iconMap: Record<string, React.ElementType> = {
  Folder,
  FileText,
  Zap,
  User,
  Target,
};

const typeColors: Record<SearchResult["type"], string> = {
  project: "bg-blue-500/10 text-blue-500",
  post: "bg-green-500/10 text-green-500",
  automation: "bg-yellow-500/10 text-yellow-500",
  user: "bg-purple-500/10 text-purple-500",
  strategy: "bg-orange-500/10 text-orange-500",
};

export function SearchCommand() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const results = useGlobalSearch(query);
  const navigate = useNavigate();

  // Keyboard shortcut to open search
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleSelect = (result: SearchResult) => {
    navigate(result.link);
    setOpen(false);
    setQuery("");
  };

  const quickLinks = [
    { label: t("header.navDashboard"), link: "/", icon: "Folder" },
    { label: t("header.navPlatforms"), link: "/platforms", icon: "FileText" },
    { label: t("header.navAutomation"), link: "/automation", icon: "Zap" },
    { label: t("header.navStrategies"), link: "/strategies", icon: "Target" },
    { label: t("header.navUsers"), link: "/users", icon: "User" },
  ];

  // Group results by type
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.type]) acc[result.type] = [];
    acc[result.type].push(result);
    return acc;
  }, {} as Record<string, SearchResult[]>);

  return (
    <>
      {/* Search trigger */}
      <div
        className="relative cursor-pointer"
        onClick={() => setOpen(true)}
      >
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t("header.searchPlaceholder")}
          className="w-80 pl-10 bg-secondary border-border cursor-pointer"
          readOnly
        />
        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
          <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground">⌘</kbd>
          <kbd className="px-1.5 py-0.5 text-xs bg-muted rounded text-muted-foreground">K</kbd>
        </div>
      </div>

      {/* Command dialog */}
      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder={t("header.searchDialogPlaceholder")}
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.length < 2 ? (
            <>
              <CommandEmpty>{t("header.startTyping")}</CommandEmpty>
              <CommandGroup heading={t("header.quickLinks")}>
                {quickLinks.map((link) => {
                  const Icon = iconMap[link.icon] || Folder;
                  return (
                    <CommandItem
                      key={link.link}
                      onSelect={() => {
                        navigate(link.link);
                        setOpen(false);
                      }}
                    >
                      <Icon className="mr-2 h-4 w-4" />
                      <span>{link.label}</span>
                      <ArrowRight className="ml-auto h-4 w-4 text-muted-foreground" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </>
          ) : results.length === 0 ? (
            <CommandEmpty>{t("header.noResultsFor")} "{query}"</CommandEmpty>
          ) : (
            <>
              {Object.entries(groupedResults).map(([type, items]) => (
                <CommandGroup key={type} heading={type.charAt(0).toUpperCase() + type.slice(1) + "s"}>
                  {items.map((result) => {
                    const Icon = iconMap[result.icon] || Folder;
                    return (
                      <CommandItem
                        key={`${result.type}-${result.id}`}
                        onSelect={() => handleSelect(result)}
                        className="flex items-center gap-3"
                      >
                        <div className={`p-1.5 rounded ${typeColors[result.type]}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{result.title}</p>
                          <p className="text-xs text-muted-foreground truncate">
                            {result.description}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {result.type}
                        </Badge>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              ))}
            </>
          )}
          <CommandSeparator />
          <CommandGroup heading={t("header.tips")}>
            <div className="px-2 py-2 text-xs text-muted-foreground">
              <p>{t("header.press")} <kbd className="px-1 py-0.5 bg-muted rounded">↵</kbd> {t("header.tipSelect")}</p>
              <p>{t("header.press")} <kbd className="px-1 py-0.5 bg-muted rounded">esc</kbd> {t("header.tipClose")}</p>
            </div>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
