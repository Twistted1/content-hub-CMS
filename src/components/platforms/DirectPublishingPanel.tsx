import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { usePlatformOAuth, DirectPlatform } from "@/hooks/usePlatformOAuth";
import { Linkedin, Twitter, CheckCircle2, Loader2, Plug, Unplug } from "lucide-react";

const PROVIDERS: { id: DirectPlatform; name: string; icon: any; bg: string }[] = [
  { id: "linkedin", name: "LinkedIn", icon: Linkedin, bg: "bg-[#0A66C2]/10 text-[#0A66C2]" },
  { id: "twitter", name: "X (Twitter)", icon: Twitter, bg: "bg-foreground/10 text-foreground" },
];

export function DirectPublishingPanel() {
  const { accounts, connect, disconnect, connecting, isConnected, isLoading } = usePlatformOAuth();

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-primary" />
              Direct Publishing
            </CardTitle>
            <CardDescription>
              Connect LinkedIn or X to publish posts directly via their official APIs (no webhooks needed).
            </CardDescription>
          </div>
          <Badge variant="outline" className="hidden sm:inline-flex">OAuth 2.0</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {PROVIDERS.map(p => {
          const connected = isConnected(p.id);
          const account = accounts.find(a => a.platform === p.id);
          const Icon = p.icon;
          const isThisConnecting = connecting === p.id;
          return (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 rounded-lg border bg-card/40 p-4"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${p.bg}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium leading-none">{p.name}</p>
                  <p className="text-xs text-muted-foreground truncate mt-1">
                    {connected ? account?.handle || "Connected" : "Not connected"}
                  </p>
                </div>
              </div>
              {connected ? (
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Live
                  </Badge>
                  <Button
                    size="sm" variant="ghost"
                    onClick={() => disconnect(p.id)}
                    title="Disconnect"
                  >
                    <Unplug className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  onClick={() => connect(p.id)}
                  disabled={isThisConnecting || isLoading}
                >
                  {isThisConnecting ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-1" /> Connecting…</>
                  ) : (
                    "Connect"
                  )}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}