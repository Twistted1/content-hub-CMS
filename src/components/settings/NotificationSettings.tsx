import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useUserPreferencesStore } from "@/stores/useUserPreferencesStore";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function NotificationSettings() {
  const { t } = useTranslation();
  const { notifications, updateNotifications } = useUserPreferencesStore();

  const handleToggle = (key: keyof typeof notifications) => {
    updateNotifications({ [key]: !notifications[key] });
    toast.success(t("settings.notifications.toastUpdated"));
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.notifications.channelsTitle")}</CardTitle>
          <CardDescription>
            {t("settings.notifications.channelsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.notifications.email")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.emailDesc")}
              </p>
            </div>
            <Switch
              checked={notifications.emailNotifications}
              onCheckedChange={() => handleToggle("emailNotifications")}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.notifications.push")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.pushDesc")}
              </p>
            </div>
            <Switch
              checked={notifications.pushNotifications}
              onCheckedChange={() => handleToggle("pushNotifications")}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.notifications.weeklyDigest")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.weeklyDigestDesc")}
              </p>
            </div>
            <Switch
              checked={notifications.weeklyDigest}
              onCheckedChange={() => handleToggle("weeklyDigest")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.notifications.activityTitle")}</CardTitle>
          <CardDescription>
            {t("settings.notifications.activityDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.notifications.postPublished")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.postPublishedDesc")}
              </p>
            </div>
            <Switch
              checked={notifications.postPublished}
              onCheckedChange={() => handleToggle("postPublished")}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.notifications.automationCompleted")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.automationCompletedDesc")}
              </p>
            </div>
            <Switch
              checked={notifications.automationCompleted}
              onCheckedChange={() => handleToggle("automationCompleted")}
            />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.notifications.teamUpdates")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.teamUpdatesDesc")}
              </p>
            </div>
            <Switch
              checked={notifications.teamUpdates}
              onCheckedChange={() => handleToggle("teamUpdates")}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("settings.notifications.marketingTitle")}</CardTitle>
          <CardDescription>
            {t("settings.notifications.marketingDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.notifications.marketingEmails")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.notifications.marketingEmailsDesc")}
              </p>
            </div>
            <Switch
              checked={notifications.marketingEmails}
              onCheckedChange={() => handleToggle("marketingEmails")}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
