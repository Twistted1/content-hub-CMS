import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

/**
 * Platforms `publish-post` can publish directly. Wider than
 * `OAUTH_CONNECTABLE_PLATFORMS` below: Facebook publishes directly too, but
 * with a deployment-wide Business Manager token (`META_SYSTEM_USER_TOKEN` /
 * `META_PAGE_ID` in the edge functions), not a per-user OAuth connection, so
 * it has no "Connect" button and never appears in `platform_oauth_tokens`.
 */
export type DirectPlatform = "linkedin" | "twitter" | "facebook";

/**
 * How a platform actually receives content.
 *  - `direct`: published through the platform's official OAuth API.
 *  - `webhook`: delivered by `publish-due-posts` to a user-configured webhook
 *    in `webhook_configs` (Content Pipeline > Webhooks). There is no
 *    per-platform OAuth handshake for these.
 *
 * This governs the Platforms page's Connect-button UI specifically, which is
 * why Facebook is deliberately NOT here even though it is a `DirectPlatform`
 * for `publish-post` — `oauth-init` has no Facebook flow to connect to.
 */
export type ConnectionMode = "direct" | "webhook";

const OAUTH_CONNECTABLE_PLATFORMS = new Set<string>(["linkedin", "twitter"]);

export function getConnectionMode(platformId: string): ConnectionMode {
  return OAUTH_CONNECTABLE_PLATFORMS.has(platformId.toLowerCase()) ? "direct" : "webhook";
}

/** OAuth-connectable only (drives the Connect-button UI) — see the comment on `ConnectionMode`. */
export function isDirectPlatform(platformId: string): platformId is "linkedin" | "twitter" {
  return OAUTH_CONNECTABLE_PLATFORMS.has(platformId.toLowerCase());
}

export interface ConnectedAccount {
  id: string;
  platform: DirectPlatform;
  handle: string | null;
  provider_account_id: string | null;
  expires_at: string | null;
  created_at: string;
}

export function usePlatformOAuth() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [connecting, setConnecting] = useState<DirectPlatform | null>(null);

  const tokensQuery = useQuery({
    queryKey: ["platform_oauth_tokens", user?.id],
    queryFn: async () => {
      if (!user) return [] as ConnectedAccount[];
      const { data, error } = await (supabase as any)
        .from("platform_oauth_tokens")
        .select("id, platform, handle, provider_account_id, expires_at, created_at");
      if (error) throw error;
      return (data || []) as ConnectedAccount[];
    },
    enabled: !!user,
  });

  // Listen for callback messages from popup
  useEffect(() => {
    const expectedOrigin = (() => {
      try { return new URL(import.meta.env.VITE_SUPABASE_URL as string).origin; }
      catch { return null; }
    })();
    function onMessage(e: MessageEvent) {
      if (expectedOrigin && e.origin !== expectedOrigin) return;
      const data = e.data;
      if (!data || data.source !== "oauth-callback") return;
      setConnecting(null);
      if (data.success) {
        toast.success(`${data.platform === "linkedin" ? "LinkedIn" : "X"} connected`);
      } else {
        toast.error(`Connect failed: ${data.message}`);
      }
      queryClient.invalidateQueries({ queryKey: ["platform_oauth_tokens"] });
      queryClient.invalidateQueries({ queryKey: ["user_platforms"] });
    }
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [queryClient]);

  const connect = useCallback(async (platform: DirectPlatform) => {
    try {
      setConnecting(platform);
      const { data, error } = await supabase.functions.invoke("oauth-init", {
        body: { platform },
      });
      if (error) throw error;
      if (!data?.url) throw new Error("Missing auth URL");
      const w = 600, h = 720;
      const left = window.screenX + (window.innerWidth - w) / 2;
      const top = window.screenY + (window.innerHeight - h) / 2;
      window.open(
        data.url,
        "oauth_popup",
        `width=${w},height=${h},left=${left},top=${top}`
      );
    } catch (e: any) {
      setConnecting(null);
      toast.error(`Could not start OAuth: ${e.message}`);
    }
  }, []);

  const disconnect = useCallback(async (platform: DirectPlatform) => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from("platform_oauth_tokens")
      .delete()
      .eq("user_id", user.id)
      .eq("platform", platform);
    if (error) {
      toast.error("Disconnect failed: " + error.message);
      return;
    }
    toast.success("Disconnected");
    queryClient.invalidateQueries({ queryKey: ["platform_oauth_tokens"] });
  }, [user, queryClient]);

  return {
    accounts: tokensQuery.data || [],
    isLoading: tokensQuery.isLoading,
    connecting,
    connect,
    disconnect,
    refetch: tokensQuery.refetch,
    isConnected: (platform: DirectPlatform) =>
      (tokensQuery.data || []).some(a => a.platform === platform),
  };
}

export async function publishPostDirect(postId: string, platforms: DirectPlatform[]) {
  const { data, error } = await supabase.functions.invoke("publish-post", {
    body: { postId, platforms },
  });
  if (error) throw error;
  return data;
}