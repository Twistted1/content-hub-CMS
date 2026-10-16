import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import { Post, PostStatus, PostType, PlatformType, Media, PostPlatform } from "@/types";

type PostRow = Database["public"]["Tables"]["posts"]["Row"];
type PostInsertType = Database["public"]["Tables"]["posts"]["Insert"];
type PostUpdateType = Database["public"]["Tables"]["posts"]["Update"];
type MediaRow = Database["public"]["Tables"]["media"]["Row"];

const mapPost = (row: PostRow): Post => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  content: row.content,
  excerpt: row.excerpt,
  status: row.status,
  type: row.type,
  scheduledAt: row.scheduled_at,
  publishedAt: row.published_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  category: row.category,
  coverImageUrl: row.cover_image_url,
  isAiGenerated: row.is_ai_generated,
  automationId: row.automation_id,
  pipelineRunId: row.pipeline_run_id,
  workflowStage: row.workflow_stage,
  reviewRequestedAt: row.review_requested_at,
  reviewedAt: row.reviewed_at,
  publishAttemptedAt: row.publish_attempted_at,
  publishAttempts: row.publish_attempts,
  publishError: row.publish_error,
});

const mapMedia = (row: MediaRow): Media => ({
  id: row.id,
  userId: row.user_id,
  postId: row.post_id,
  filename: row.filename,
  url: row.url,
  mimeType: row.mime_type,
  sizeBytes: row.size_bytes,
  createdAt: row.created_at,
});

export function usePosts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const postsQuery = useQuery({
    queryKey: ["posts", user?.id],
    queryFn: async () => {
      const query = supabase
        .from("posts")
        .select(`
          *,
          post_platforms (*),
          media (*)
        `);
      
      // No .eq("user_id", ...) here deliberately: RLS on `posts` already scopes
      // this to the caller's own rows, or every row for an admin (policy
      // "Users can view own posts or admins view all"). That policy used to
      // also expose every OTHER user's published posts to any authenticated
      // caller - a cross-user leak, not the shared team calendar a stale
      // comment here once described wanting. Fixed 2026-10-16: a non-admin now
      // sees only their own posts, any status; an admin still sees everything.
      // Ordering by scheduled_at keeps the calendar a consistent timeline.
      const { data, error } = await query.order("scheduled_at", { ascending: true });

      if (error) throw error;
      
      // Frontend De-duplication: Only show one post per time slot per platform
      const uniqueData = data.reduce((acc: any[], current: any) => {
        const platform = current.post_platforms?.[0]?.platform || 'none';
        const key = `${current.scheduled_at}_${platform}_${current.title}`;
        if (!acc.find(item => {
          const itemPlatform = item.post_platforms?.[0]?.platform || 'none';
          return `${item.scheduled_at}_${itemPlatform}_${item.title}` === key;
        })) {
          acc.push(current);
        }
        return acc;
      }, []);

      return uniqueData.map((row) => ({
        ...mapPost(row),
        platforms: (row.post_platforms as any[])?.map((p: any) => ({
          id: p.id,
          postId: p.post_id,
          platform: p.platform,
          status: p.status,
          platformPostId: p.platform_post_id,
          publishedAt: p.published_at,
          errorMessage: p.error_message,
        })),
        media: row.media?.map(mapMedia),
      }));
    },
    enabled: !!user,
  });

  const addPost = useMutation({
    mutationFn: async ({
      post,
      platforms,
      overrideUserId,
    }: {
      post: Omit<PostInsertType, "user_id">;
      platforms?: PlatformType[];
      overrideUserId?: string;
    }) => {
      const activeUserId = overrideUserId || user?.id;
      if (!activeUserId) throw new Error("Not authenticated");

      const { data: postData, error: postError } = await supabase
        .from("posts")
        .insert({ ...post, user_id: activeUserId })
        .select()
        .single();

      if (postError) throw postError;

      if (platforms && platforms.length > 0) {
        const platformInserts = platforms.map((platform) => ({
          post_id: postData.id,
          platform,
          status: post.status || ("draft" as PostStatus),
        }));

        const { error: platformError } = await supabase
          .from("post_platforms")
          .insert(platformInserts);

        if (platformError) throw platformError;
      }

      return mapPost(postData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post created");
    },
    onError: (error) => {
      toast.error("Failed to create post: " + error.message);
    },
  });

  const updatePost = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PostUpdateType> & { id: string }) => {
      const { data, error } = await supabase
        .from("posts")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return mapPost(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post updated");
    },
    onError: (error) => {
      toast.error("Failed to update post: " + error.message);
    },
  });

  const deletePost = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("posts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete post: " + error.message);
    },
  });

  // Queue a post for immediate delivery. This does NOT mark the post
  // published: delivery is performed by the `publish-due-posts` cron worker,
  // which sets `published_at` only after a platform actually accepts the post.
  // Setting `scheduled_at` to now makes the post due on the next worker tick.
  const publishPost = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("posts")
        .update({
          status: "scheduled" as PostStatus,
          scheduled_at: new Date().toISOString(),
          publish_error: null,
          publish_attempted_at: null,
          publish_attempts: 0,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return mapPost(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Queued for publishing — the scheduler will deliver it shortly");
    },
    onError: (error) => {
      toast.error("Failed to queue post for publishing: " + error.message);
    },
  });

  const schedulePost = useMutation({
    mutationFn: async ({ id, scheduledAt }: { id: string; scheduledAt: string }) => {
      const { data, error } = await supabase
        .from("posts")
        .update({
          status: "scheduled" as PostStatus,
          scheduled_at: scheduledAt,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return mapPost(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post scheduled");
    },
    onError: (error) => {
      toast.error("Failed to schedule post: " + error.message);
    },
  });

  return {
    posts: postsQuery.data || [],
    isLoading: postsQuery.isLoading,
    error: postsQuery.error,
    addPost,
    updatePost,
    deletePost,
    publishPost,
    schedulePost,
  };
}

export function useMedia() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const mediaQuery = useQuery({
    queryKey: ["media", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("media")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data.map(mapMedia);
    },
    enabled: !!user,
  });

  const uploadMedia = useMutation({
    mutationFn: async ({
      file,
      postId,
    }: {
      file: File;
      postId?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");

      // The "media" bucket already enforces this server-side (50MB,
      // image/video/audio only), so this isn't the real security boundary -
      // it just turns a raw Supabase storage rejection into a message that
      // actually tells the user what's wrong, before spending the upload.
      const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp", "video/mp4", "video/webm", "audio/mpeg", "audio/wav"];
      if (!allowedTypes.includes(file.type)) {
        throw new Error("Unsupported file type. Upload an image, video, or audio file.");
      }
      if (file.size > 50 * 1024 * 1024) {
        throw new Error("File is too large. Maximum size is 50MB.");
      }

      const fileExt = file.name.split(".").pop();
      const filePath = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("media")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("media")
        .getPublicUrl(filePath);

      const mediaInsert: any = {
        user_id: user.id,
        post_id: postId,
        filename: file.name,
        url: urlData.publicUrl,
        mime_type: file.type,
        size_bytes: file.size,
      };

      const { data, error } = await supabase
        .from("media")
        .insert(mediaInsert)
        .select()
        .single();

      if (error) throw error;
      return mapMedia(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      toast.success("Media uploaded");
    },
    onError: (error) => {
      toast.error("Failed to upload media: " + error.message);
    },
  });

  const deleteMedia = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("media").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["media"] });
      toast.success("Media deleted");
    },
    onError: (error) => {
      toast.error("Failed to delete media: " + error.message);
    },
  });

  return {
    media: mediaQuery.data || [],
    isLoading: mediaQuery.isLoading,
    error: mediaQuery.error,
    uploadMedia,
    deleteMedia,
  };
}
