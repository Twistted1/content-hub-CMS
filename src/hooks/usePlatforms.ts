import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { UserPlatform, PlatformType } from "@/types";

const mapUserPlatform = (row: any): UserPlatform => {
  const settings = row.settings as any;
  return {
    id: row.id,
    userId: row.user_id,
    platformType: row.platform_type as PlatformType,
    accountName: row.account_name,
    username: row.username,
    avatarUrl: row.avatar_url,
    settings: {
      autoPublish: settings?.autoPublish ?? true,
      notifications: settings?.notifications ?? true,
      analytics: settings?.analytics ?? true,
      contentBackup: settings?.contentBackup ?? false,
    },
    status: row.status,
    lastSync: row.last_sync,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

export function usePlatforms() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const platformsQuery = useQuery({
    queryKey: ["user_platforms", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("user_platforms")
        .select("*")
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []).map(mapUserPlatform);
    },
    enabled: !!user,
  });

  const updatePlatformSettings = useMutation({
    mutationFn: async ({ id, settings }: { id: string; settings: UserPlatform["settings"] }) => {
      const { data, error } = await (supabase as any)
        .from("user_platforms")
        .update({ settings: settings as any })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return mapUserPlatform(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_platforms"] });
      toast.success("Settings updated");
    },
    onError: (error: any) => {
      toast.error("Failed to update settings: " + error.message);
    },
  });

  const togglePlatformStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: "active" | "paused" }) => {
      const { data, error } = await (supabase as any)
        .from("user_platforms")
        .update({ status })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return mapUserPlatform(data);
    },
    onSuccess: (data: UserPlatform) => {
      queryClient.invalidateQueries({ queryKey: ["user_platforms"] });
      toast.success(`Platform ${data.status === "active" ? "activated" : "paused"}`);
    },
    onError: (error: any) => {
      toast.error("Failed to update status: " + error.message);
    },
  });

  const disconnectPlatform = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("user_platforms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user_platforms"] });
      toast.success("Platform disconnected");
    },
    onError: (error: any) => {
      toast.error("Failed to disconnect platform: " + error.message);
    },
  });

  return {
    platforms: platformsQuery.data || [],
    isLoading: platformsQuery.isLoading,
    error: platformsQuery.error,
    refetch: platformsQuery.refetch,
    updatePlatformSettings,
    togglePlatformStatus,
    disconnectPlatform,
  };
}
