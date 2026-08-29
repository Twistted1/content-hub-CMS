import { Monitor, Moon, Sun, Palette } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useUserPreferencesStore } from "@/stores/useUserPreferencesStore";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import i18n from "@/i18n";

const languages = [
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
  { value: "fr", label: "Français" },
  { value: "de", label: "Deutsch" },
  { value: "pt", label: "Português" },
  { value: "ja", label: "日本語" },
  { value: "zh", label: "中文" },
];

const dateFormats = [
  { value: "MM/dd/yyyy", label: "MM/DD/YYYY (12/31/2024)" },
  { value: "dd/MM/yyyy", label: "DD/MM/YYYY (31/12/2024)" },
  { value: "yyyy-MM-dd", label: "YYYY-MM-DD (2024-12-31)" },
];

export function AppearanceSettings() {
  const { appearance, updateAppearance } = useUserPreferencesStore();
  const { t } = useTranslation();

  const handleLanguageChange = (value: string) => {
    updateAppearance({ language: value });
    i18n.changeLanguage(value);
    toast.success(t("settings.language.toastLanguageUpdated"));
  };

  const handleThemeChange = (value: string) => {
    updateAppearance({ theme: value as "light" | "dark" | "system" });
    toast.success(t("settings.theme.toastChanged", { theme: t(`settings.theme.${value}`) }));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            {t("settings.theme.title")}
          </CardTitle>
          <CardDescription>
            {t("settings.theme.description")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={appearance.theme}
            onValueChange={handleThemeChange}
            className="grid grid-cols-3 gap-4"
          >
            <Label
              htmlFor="light"
              className={`flex flex-col items-center justify-between rounded-md border-2 bg-popover p-4 cursor-pointer transition-colors ${appearance.theme === "light" ? "border-primary" : "border-muted hover:border-muted-foreground/30"}`}
            >
              <RadioGroupItem value="light" id="light" className="sr-only" />
              <Sun className="h-6 w-6 mb-3" />
              <span className="text-sm font-medium">{t("settings.theme.light")}</span>
            </Label>
            <Label
              htmlFor="dark"
              className={`flex flex-col items-center justify-between rounded-md border-2 bg-popover p-4 cursor-pointer transition-colors ${appearance.theme === "dark" ? "border-primary" : "border-muted hover:border-muted-foreground/30"}`}
            >
              <RadioGroupItem value="dark" id="dark" className="sr-only" />
              <Moon className="h-6 w-6 mb-3" />
              <span className="text-sm font-medium">{t("settings.theme.dark")}</span>
            </Label>
            <Label
              htmlFor="system"
              className={`flex flex-col items-center justify-between rounded-md border-2 bg-popover p-4 cursor-pointer transition-colors ${appearance.theme === "system" ? "border-primary" : "border-muted hover:border-muted-foreground/30"}`}
            >
              <RadioGroupItem value="system" id="system" className="sr-only" />
              <Monitor className="h-6 w-6 mb-3" />
              <span className="text-sm font-medium">{t("settings.theme.system")}</span>
            </Label>
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.display.title")}</CardTitle>
          <CardDescription>
            {t("settings.display.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.display.compactMode")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.display.compactModeDescription")}
              </p>
            </div>
            <Switch
              checked={appearance.compactMode}
              onCheckedChange={(checked) => {
                updateAppearance({ compactMode: checked });
                toast.success(checked ? t("settings.display.toastCompactEnabled") : t("settings.display.toastCompactDisabled"));
              }}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.display.animations")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.display.animationsDescription")}
              </p>
            </div>
            <Switch
              checked={appearance.showAnimations}
              onCheckedChange={(checked) => {
                updateAppearance({ showAnimations: checked });
                toast.success(checked ? t("settings.display.toastAnimationsEnabled") : t("settings.display.toastAnimationsDisabled"));
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.language.title")}</CardTitle>
          <CardDescription>
            {t("settings.language.description")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("settings.language.language")}</Label>
              <Select
                value={appearance.language}
                onValueChange={handleLanguageChange}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {languages.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("settings.language.dateFormat")}</Label>
              <Select
                value={appearance.dateFormat}
                onValueChange={(value) => {
                  updateAppearance({ dateFormat: value });
                  toast.success(t("settings.language.toastDateFormatUpdated"));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dateFormats.map((format) => (
                    <SelectItem key={format.value} value={format.value}>
                      {format.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("settings.language.timeFormat")}</Label>
            <RadioGroup
              value={appearance.timeFormat}
              onValueChange={(value) => {
                updateAppearance({ timeFormat: value as "12h" | "24h" });
                toast.success(t("settings.language.toastTimeFormatUpdated"));
              }}
              className="flex gap-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="12h" id="12h" />
                <Label htmlFor="12h" className="font-normal cursor-pointer">
                  {t("settings.language.12hour")}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="24h" id="24h" />
                <Label htmlFor="24h" className="font-normal cursor-pointer">
                  {t("settings.language.24hour")}
                </Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
