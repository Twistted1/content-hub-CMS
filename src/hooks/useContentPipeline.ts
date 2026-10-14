import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { ScheduleMode } from "@/utils/scheduleMode";
import { normalizeScheduleMode } from "@/utils/scheduleMode";

export interface PipelineRun {
  id: string;
  userId: string;
  status: string;
  topic: string;
  platforms: string[];
  /**
   * The mode this run was started with. `schedule-from-templates` stores
   * `"awaiting_review"` here, so it must be part of the union — see
   * `src/utils/scheduleMode.ts`.
   */
  scheduleMode: ScheduleMode;
  scheduledAt: string | null;
  steps: Array<{ step: string; ts: string; [key: string]: any }>;
  result: any;
  postId: string | null;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface WebhookConfig {
  id: string;
  userId: string;
  name: string;
  url: string;
  platforms: string[];
  headers: Record<string, string>;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export function useContentPipeline() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const pipelineRunsQuery = useQuery({
    queryKey: ["pipeline_runs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("pipeline_runs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []).map((r: any): PipelineRun => ({
        id: r.id,
        userId: r.user_id,
        status: r.status,
        topic: r.topic,
        platforms: r.platforms || [],
        // `schedule_mode` is a plain text column, so a row written before the
        // union was widened can hold anything. Resolve it rather than trusting
        // the cast, so the UI never renders a mode it has no label for.
        scheduleMode: normalizeScheduleMode(r.schedule_mode),
        scheduledAt: r.scheduled_at,
        steps: r.steps || [],
        result: r.result,
        postId: r.post_id,
        errorMessage: r.error_message,
        createdAt: r.created_at,
        completedAt: r.completed_at,
      }));
    },
    enabled: !!user,
    refetchInterval: 5000, // Poll for updates
  });

  const webhooksQuery = useQuery({
    queryKey: ["webhook_configs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("webhook_configs")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((w: any): WebhookConfig => ({
        id: w.id,
        userId: w.user_id,
        name: w.name,
        url: w.url,
        platforms: w.platforms || [],
        headers: w.headers || {},
        isActive: w.is_active,
        createdAt: w.created_at,
        updatedAt: w.updated_at,
      }));
    },
    enabled: !!user,
  });

  const runPipeline = useMutation({
    mutationFn: async (params: {
      topic: string;
      platforms: string[];
      scheduleMode: ScheduleMode;
      scheduledAt?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("content-pipeline", {
        body: params,
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["pipeline_runs"] });
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success(`Pipeline complete: "${data.title}" created`);
    },
    onError: (error: any) => {
      toast.error(`Pipeline failed: ${error.message}`);
    },
  });

  const addWebhook = useMutation({
    mutationFn: async (webhook: { name: string; url: string; platforms: string[]; headers?: Record<string, string> }) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await (supabase as any)
        .from("webhook_configs")
        .insert({
          user_id: user.id,
          name: webhook.name,
          url: webhook.url,
          platforms: webhook.platforms,
          headers: webhook.headers || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook_configs"] });
      toast.success("Webhook added");
    },
    onError: (error: any) => {
      toast.error(`Failed to add webhook: ${error.message}`);
    },
  });

  const deleteWebhook = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("webhook_configs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook_configs"] });
      toast.success("Webhook removed");
    },
    onError: (error: any) => {
      toast.error(`Failed to remove webhook: ${error.message}`);
    },
  });

  const toggleWebhook = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await (supabase as any)
        .from("webhook_configs")
        .update({ is_active: !isActive })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["webhook_configs"] });
      toast.success("Webhook updated");
    },
  });

  return {
    pipelineRuns: pipelineRunsQuery.data || [],
    webhooks: webhooksQuery.data || [],
    isLoading: pipelineRunsQuery.isLoading,
    runPipeline,
    addWebhook,
    deleteWebhook,
    toggleWebhook,
  };
}
