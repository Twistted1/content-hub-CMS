import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { usePosts } from "./usePosts";
import { useNotes } from "./useNotes";
import { useProjects } from "./useProjects";
import { useStrategies } from "./useStrategies";
import { UniversalTemplate, UJTItem } from "@/types";
import { toast } from "sonner";

import { getNextOptimalDate } from "@/utils/scheduling";

export function useUJT() {
  const { user } = useAuth();
  const { addPost } = usePosts();
  const { addNote } = useNotes();
  const { addProject } = useProjects();
  const { addStrategy } = useStrategies();

  const processUJT = async (template: UniversalTemplate, targetUserId?: string) => {
    const activeUser = targetUserId || user?.id;
    if (!activeUser) {
      toast.error("You must be logged in to import content");
      return;
    }

    if (template.version !== "1.0") {
      toast.error("Unsupported UJT version");
      return;
    }

    toast.info(`Processing ${template.items.length} items...`);

    const results = {
      success: 0,
      failed: 0,
    };

    for (const item of template.items) {
      try {
        switch (item.type) {
          case "ARTICLE":
          case "POST": {
            const platform = item.metadata?.platforms?.[0] || "website";
            const scheduledAt = item.metadata?.scheduled_at || getNextOptimalDate(platform).toISOString();
            
            await addPost.mutateAsync({
              post: {
                title: item.data?.title || "Untitled Post",
                content: item.data?.content || "",
                excerpt: item.data?.excerpt || item.data?.content?.substring(0, 160) || "",
                type: item.type === "ARTICLE" ? "article" : (item.data?.type || "text"),
                status: (item.metadata?.status || (scheduledAt ? "scheduled" : "draft")) as any,
                scheduled_at: scheduledAt,
                category: item.metadata?.category || "General",
                cover_image_url: item.data?.img || item.data?.image || item.imageUrl || ""
              },
              platforms: item.metadata?.platforms || [platform],
              overrideUserId: activeUser,
            });
            break;
          }

          case "NOTE":
            await addNote.mutateAsync({
              title: item.data.title || "Untitled Note",
              content: item.data.content || "",
              isPinned: item.metadata?.isPinned || false,
              color: item.metadata?.color || "bg-card",
              tags: item.metadata?.tags || [],
            });
            break;

          case "PROJECT":
            await addProject.mutateAsync({
              title: item.data.title || "New Project",
              description: item.data.description || "",
              status: (item.metadata?.status === "backlog" ? "planning" : item.metadata?.status || "planning") as any,
              priority: (item.metadata?.priority || "medium") as any,
              dueDate: item.metadata?.scheduled_at || "",
              startDate: new Date().toISOString().split('T')[0],
              progress: 0,
              assignees: [],
              tags: item.metadata?.tags || [],
              attachments: 0,
              comments: 0
            });
            break;

          case "STRATEGY":
            await addStrategy({
              name: item.data.name || "New Strategy",
              description: item.data.description || "",
              status: (item.metadata?.status || "planning") as any,
              platforms: item.metadata?.platforms || [],
              goalItems: item.data.goals || []
            });
            break;

          default:
            console.warn(`Unknown UJT item type: ${item.type}`);
            results.failed++;
            continue;
        }
        results.success++;
      } catch (error) {
        console.error(`Failed to process UJT item:`, item, error);
        results.failed++;
      }
    }

    if (results.failed === 0) {
      toast.success(`Successfully imported ${results.success} items`);
    } else {
      toast.warning(`Import complete: ${results.success} success, ${results.failed} failed`);
    }
  };

  return { processUJT };
}
