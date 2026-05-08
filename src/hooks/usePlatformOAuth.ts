import { useEffect, useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type DirectPlatform = "linkedin" | "twitter";

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
    function onMessage(e: MessageEvent) {
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