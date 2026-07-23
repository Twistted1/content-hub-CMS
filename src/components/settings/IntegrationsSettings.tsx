import { useState } from "react";
import {
  Link2,
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface APIKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string;
  permissions: string[];
}

interface ConnectedApp {
  id: string;
  name: string;
  icon: string;
  description: string;
  connected: boolean;
  connectedAt?: string;
  status?: "active" | "expired" | "error";
}

const initialAPIKeys: APIKey[] = [
  {
    id: "1",
    name: "Production API Key",
    key: "sk_live_xxxxxxxxxxxxxxxxxxxxxxxxxxx",
    createdAt: "2025-11-15",
    lastUsed: "2 hours ago",
    permissions: ["read", "write"],
  },
  {
    id: "2",
    name: "Development API Key",
    key: "sk_test_xxxxxxxxxxxxxxxxxxxxxxxxxxx",
    createdAt: "2025-12-01",
    lastUsed: "5 days ago",
    permissions: ["read"],
  },
];

const connectedApps: ConnectedApp[] = [
  {
    id: "twitter",
    name: "Twitter / X",
    icon: "𝕏",
    description: "Post and schedule tweets",
    connected: true,
    connectedAt: "2025-10-20",
    status: "active",
  },
  {
    id: "facebook",
    name: "Facebook",
    icon: "f",
    description: "Manage pages and post content",
    connected: true,
    connectedAt: "2025-10-18",
    status: "active",
  },
  {
    id: "instagram",
    name: "Instagram",
    icon: "📷",
    description: "Share photos and stories",
    connected: true,
    connectedAt: "2025-11-01",
    status: "active",
  },
  {
    id: "linkedin",
    name: "LinkedIn",
    icon: "in",
    description: "Connect to share professional content",
    connected: false,
  },
  {
    id: "tiktok",
    name: "TikTok",
    icon: "♪",
    description: "Short-form video content",
    connected: false,
  },
  {
    id: "youtube",
    name: "YouTube",
    icon: "▶",
    description: "Video uploads and community posts",
    connected: false,
  },
];

export function IntegrationsSettings() {
  const { t } = useTranslation();
  const [apiKeys, setAPIKeys] = useState<APIKey[]>(initialAPIKeys);
  const [apps, setApps] = useState<ConnectedApp[]>(connectedApps);
  const [showAPIKeyDialog, setShowAPIKeyDialog] = useState(false);
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());
  const [newKeyForm, setNewKeyForm] = useState({
    name: "",
    permissions: "read",
  });

  const toggleKeyVisibility = (id: string) => {
    const newVisible = new Set(visibleKeys);
    if (newVisible.has(id)) {
      newVisible.delete(id);
    } else {
      newVisible.add(id);
    }
    setVisibleKeys(newVisible);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("settings.integrations.toastCopied"));
  };

  const handleCreateAPIKey = () => {
    if (!newKeyForm.name) {
      toast.error(t("settings.integrations.toastEnterKeyName"));
      return;
    }

    const newKey: APIKey = {
      id: Date.now().toString(),
      name: newKeyForm.name,
      key: `sk_${newKeyForm.permissions === "read" ? "test" : "live"}_${Math.random().toString(36).substring(2, 30)}`,
      createdAt: new Date().toISOString().split("T")[0],
      lastUsed: "Never",
      permissions: newKeyForm.permissions === "read" ? ["read"] : ["read", "write"],
    };

    setAPIKeys([...apiKeys, newKey]);
    setNewKeyForm({ name: "", permissions: "read" });
    setShowAPIKeyDialog(false);
    toast.success(t("settings.integrations.toastKeyCreated"));
  };

  const handleRevokeKey = (id: string) => {
    setAPIKeys(apiKeys.filter((key) => key.id !== id));
    toast.success(t("settings.integrations.toastKeyRevoked"));
  };

  const handleConnectApp = (id: string) => {
    setApps(
      apps.map((app) =>
        app.id === id
          ? { ...app, connected: true, connectedAt: new Date().toISOString().split("T")[0], status: "active" as const }
          : app
      )
    );
    toast.success(t("settings.integrations.toastAppConnected"));
  };

  const handleDisconnectApp = (id: string) => {
    setApps(
      apps.map((app) =>
        app.id === id
          ? { ...app, connected: false, connectedAt: undefined, status: undefined }
          : app
      )
    );
    toast.success(t("settings.integrations.toastAppDisconnected"));
  };

  return (
    <div className="space-y-6">
      {/* API Keys */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Link2 className="h-5 w-5" />
                {t("settings.integrations.apiKeysTitle")}
              </CardTitle>
              <CardDescription>
                {t("settings.integrations.apiKeysDesc")}
              </CardDescription>
            </div>
            <Button onClick={() => setShowAPIKeyDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t("settings.integrations.createKey")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {apiKeys.map((apiKey) => (
              <div
                key={apiKey.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{apiKey.name}</p>
                    <div className="flex gap-1">
                      {apiKey.permissions.map((perm) => (
                        <Badge key={perm} variant="secondary" className="text-xs">
                          {perm}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <code className="text-sm text-muted-foreground bg-muted px-2 py-0.5 rounded">
                      {visibleKeys.has(apiKey.id)
                        ? apiKey.key
                        : apiKey.key.replace(/./g, "•").slice(0, 20) + "..."}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => toggleKeyVisibility(apiKey.id)}
                    >
                      {visibleKeys.has(apiKey.id) ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => copyToClipboard(apiKey.key)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.integrations.createdOn")} {apiKey.createdAt} • {t("settings.integrations.lastUsed")} {apiKey.lastUsed}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleRevokeKey(apiKey.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Connected Apps */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.integrations.connectedAppsTitle")}</CardTitle>
          <CardDescription>
            {t("settings.integrations.connectedAppsDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {apps.map((app, index) => (
              <div key={app.id}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted text-lg font-bold">
                      {app.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium">{app.name}</p>
                        {app.connected && app.status && (
                          <Badge
                            variant={app.status === "active" ? "default" : "destructive"}
                            className="text-xs"
                          >
                            {app.status === "active" ? (
                              <>
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                {t("settings.integrations.connected")}
                              </>
                            ) : (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                {app.status}
                              </>
                            )}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{t(`settings.integrations.appDescriptions.${app.id}`)}</p>
                      {app.connected && app.connectedAt && (
                        <p className="text-xs text-muted-foreground">
                          {t("settings.integrations.connectedOn")} {app.connectedAt}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {app.connected ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toast.info(t("settings.integrations.refresh"))}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDisconnectApp(app.id)}
                        >
                          {t("settings.integrations.disconnect")}
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" onClick={() => handleConnectApp(app.id)}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        {t("settings.integrations.connect")}
                      </Button>
                    )}
                  </div>
                </div>
                {index < apps.length - 1 && <Separator className="mt-4" />}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Webhooks */}
      <Card>
        <CardHeader>
          <CardTitle>{t("settings.integrations.webhooksTitle")}</CardTitle>
          <CardDescription>
            {t("settings.integrations.webhooksDesc")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t("settings.integrations.enableWebhooks")}</Label>
              <p className="text-sm text-muted-foreground">
                {t("settings.integrations.enableWebhooksDesc")}
              </p>
            </div>
            <Switch onCheckedChange={(checked) => toast.success(checked ? t("settings.integrations.toastWebhooksEnabled") : t("settings.integrations.toastWebhooksDisabled"))} />
          </div>
          <div className="space-y-2">
            <Label>{t("settings.integrations.webhookUrl")}</Label>
            <div className="flex gap-2">
              <Input placeholder="https://your-server.com/webhook" />
              <Button variant="outline">{t("settings.integrations.test")}</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create API Key Dialog */}
      <Dialog open={showAPIKeyDialog} onOpenChange={setShowAPIKeyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("settings.integrations.createApiKeyTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.integrations.createApiKeyDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="key-name">{t("settings.integrations.keyName")}</Label>
              <Input
                id="key-name"
                placeholder={t("settings.integrations.keyNamePlaceholder")}
                value={newKeyForm.name}
                onChange={(e) =>
                  setNewKeyForm({ ...newKeyForm, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="permissions">{t("settings.integrations.permissions")}</Label>
              <Select
                value={newKeyForm.permissions}
                onValueChange={(value) =>
                  setNewKeyForm({ ...newKeyForm, permissions: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="read">{t("settings.integrations.readOnly")}</SelectItem>
                  <SelectItem value="write">{t("settings.integrations.readWrite")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAPIKeyDialog(false)}>
              {t("settings.integrations.cancel")}
            </Button>
            <Button onClick={handleCreateAPIKey}>{t("settings.integrations.createKey")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
