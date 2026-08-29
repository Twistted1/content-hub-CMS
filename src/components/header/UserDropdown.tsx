import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  User,
  Settings,
  HelpCircle,
  LogOut,
  Moon,
  Sun,
  Keyboard,
  Bell,
  Shield,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
  DropdownMenuShortcut,
} from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useUserPreferencesStore } from "@/stores/useUserPreferencesStore";
import { useAuth } from "@/hooks/useAuth";
import { useTranslation } from "react-i18next";

export function UserDropdown() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { profile, appearance, updateAppearance } = useUserPreferencesStore();
  const { signOut } = useAuth();
  const { resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const isDark = (resolvedTheme ?? appearance.theme) === "dark";

  const handleThemeToggle = (checked: boolean) => {
    const next = checked ? "dark" : "light";
    updateAppearance({ theme: next });
    toast.success(t("settings.theme.toastChanged", { theme: t(`settings.theme.${next}`) }));
  };

  const handleLogout = async () => {
    const { error } = await signOut();
    setOpen(false);
    if (error) {
      toast.error(t("header.toastLogoutFailed"));
    } else {
      toast.success(t("header.toastLoggedOut"));
      navigate("/");
    }
  };

  const handleNavigate = (path: string, tab?: string) => {
    navigate(tab ? `${path}?tab=${tab}` : path);
    setOpen(false);
  };

  const handleKeyboardShortcuts = () => {
    toast.info(t("header.toastKeyboardShortcuts"));
    setOpen(false);
  };

  const handleHelp = () => {
    toast.info(t("header.toastHelpComingSoon"));
    setOpen(false);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="flex items-center gap-3 pl-2 h-auto py-1.5 hover:bg-secondary/50"
        >
          <Avatar className="h-9 w-9 border-2 border-primary">
            <AvatarImage src={profile.avatar} />
            <AvatarFallback className="bg-primary/20 text-primary text-sm font-medium">
              {profile.initials}
            </AvatarFallback>
          </Avatar>
          <div className="text-left hidden md:block">
            <p className="text-sm font-medium text-foreground">{profile.name}</p>
            <p className="text-xs text-muted-foreground">{profile.role}</p>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={profile.avatar} />
              <AvatarFallback className="bg-primary/20 text-primary">
                {profile.initials}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col space-y-1">
              <p className="text-sm font-medium">{profile.name}</p>
              <p className="text-xs text-muted-foreground">{profile.email}</p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={() => handleNavigate("/settings", "profile")}>
            <User className="mr-2 h-4 w-4" />
            <span>{t("header.profile")}</span>
            <Badge variant="secondary" className="ml-auto text-xs">
              {t("header.pro")}
            </Badge>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigate("/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            <span>{t("header.settings")}</span>
            <DropdownMenuShortcut>⌘S</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigate("/settings", "notifications")}>
            <Bell className="mr-2 h-4 w-4" />
            <span>{t("header.notifications")}</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleNavigate("/settings", "security")}>
            <Shield className="mr-2 h-4 w-4" />
            <span>{t("header.security")}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuGroup>
          <DropdownMenuItem onClick={handleKeyboardShortcuts}>
            <Keyboard className="mr-2 h-4 w-4" />
            <span>{t("header.keyboardShortcuts")}</span>
            <DropdownMenuShortcut>⌘/</DropdownMenuShortcut>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleHelp}>
            <HelpCircle className="mr-2 h-4 w-4" />
            <span>{t("header.helpSupport")}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="justify-between"
          onSelect={(e) => e.preventDefault()}
        >
          <div className="flex items-center">
            {isDark ? <Moon className="mr-2 h-4 w-4" /> : <Sun className="mr-2 h-4 w-4" />}
            <span>{t("header.darkMode")}</span>
          </div>
          <Switch checked={isDark} onCheckedChange={handleThemeToggle} className="ml-2" />
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleLogout}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>{t("header.logOut")}</span>
          <DropdownMenuShortcut>⇧⌘Q</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
