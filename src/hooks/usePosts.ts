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
      let query = supabase
        .from("posts")
        .select(`
          *,
          post_platforms (*),
          media (*)
        `);
      
      // If NOT admin, we would filter by user_id, 
      // but for this CMS we want a Global Master Calendar for all admins.
      // We will order by scheduled_at to ensure a consistent timeline.
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

  const publishPost = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("posts")
        .update({
          status: "published" as PostStatus,
          published_at: new Date().toISOString(),
        })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return mapPost(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success("Post published");
    },
    onError: (error) => {
      toast.error("Failed to publish post: " + error.message);
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
