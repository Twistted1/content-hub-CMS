import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface Template {
  id: string;
  name: string;
  description: string;
  category: string;
  platforms: string[];
  uses: number;
  isFavorite: boolean;
  createdAt: string;
  content?: string;
}

export type NewTemplate = Omit<Template, "id" | "createdAt" | "uses" | "isFavorite">;

export function useTemplates() {
  const queryClient = useQueryClient();

  const { data: templates = [], isLoading, error } = useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((tpl) => ({
        id: tpl.id,
        name: tpl.name,
        description: tpl.description,
        category: tpl.category,
        platforms: tpl.platforms || [],
        uses: tpl.uses,
        isFavorite: tpl.is_favorite,
        createdAt: tpl.created_at,
        content: tpl.content || "",
      })) as Template[];
    },
  });

  const addTemplate = useMutation({
    mutationFn: async (newTemplate: NewTemplate) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("templates")
        .insert({
          name: newTemplate.name,
          description: newTemplate.description,
          category: newTemplate.category,
          platforms: newTemplate.platforms,
          content: newTemplate.content || "",
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create template: ${error.message}`);
    },
  });

  const updateTemplate = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Template> }) => {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.category !== undefined) dbUpdates.category = updates.category;
      if (updates.platforms !== undefined) dbUpdates.platforms = updates.platforms;
      if (updates.content !== undefined) dbUpdates.content = updates.content;
      if (updates.uses !== undefined) dbUpdates.uses = updates.uses;
      if (updates.isFavorite !== undefined) dbUpdates.is_favorite = updates.isFavorite;

      const { error } = await supabase
        .from("templates")
        .update(dbUpdates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      // Silent for favorite/uses toggles handled with their own toasts by the caller
      if (!("isFavorite" in variables.updates) && !("uses" in variables.updates)) {
        toast.success("Template updated successfully");
      }
    },
    onError: (error) => {
      toast.error(`Failed to update template: ${error.message}`);
    },
  });

  const deleteTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete template: ${error.message}`);
    },
  });

  const duplicateTemplate = useMutation({
    mutationFn: async (template: Template) => {
      const userId = (await supabase.auth.getUser()).data.user?.id;
      if (!userId) throw new Error("Not authenticated");

      const { data, error } = await supabase
        .from("templates")
        .insert({
          name: `${template.name} (Copy)`,
          description: template.description,
          category: template.category,
          platforms: template.platforms,
          content: template.content || "",
          user_id: userId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template duplicated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to duplicate template: ${error.message}`);
    },
  });

  return {
    templates,
    isLoading,
    error,
    addTemplate,
    updateTemplate: (id: string, updates: Partial<Template>) => updateTemplate.mutate({ id, updates }),
    deleteTemplate: deleteTemplate.mutate,
    duplicateTemplate,
  };
}
