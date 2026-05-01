import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Note } from "@/types";
import { toast } from "sonner";

export function useNotes() {
  const queryClient = useQueryClient();
  const notesTable = () => (supabase as any).from("notes");

  const { data: notes = [], isLoading, error } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await notesTable()
        .select("*")
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false });

      if (error?.code === "42P01" || error?.message?.includes("Could not find the table")) {
        return [] as Note[];
      }

      if (error) throw error;

      return data.map((note: any) => ({
        id: note.id,
        title: note.title,
        content: note.content || "",
        tags: note.tags || [],
        isPinned: note.is_pinned,
        color: note.color || "bg-card",
        startDate: note.start_date,
        dueDate: note.due_date,
        createdAt: note.created_at,
        updatedAt: note.updated_at,
      })) as Note[];
    },
  });

  const addNote = useMutation({
    mutationFn: async (newNote: Omit<Note, "id" | "createdAt" | "updatedAt">) => {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error("Not authenticated");

      const { data, error } = await notesTable()
        .insert({
          title: newNote.title,
          content: newNote.content,
          tags: newNote.tags,
          is_pinned: newNote.isPinned,
          color: newNote.color,
          start_date: newNote.startDate,
          due_date: newNote.dueDate,
          user_id: user.user.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create note: ${error.message}`);
    },
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Note> }) => {
      const dbUpdates: any = {};
      if (updates.title) dbUpdates.title = updates.title;
      if (updates.content !== undefined) dbUpdates.content = updates.content;
      if (updates.tags) dbUpdates.tags = updates.tags;
      if (updates.isPinned !== undefined) dbUpdates.is_pinned = updates.isPinned;
      if (updates.color) dbUpdates.color = updates.color;
      if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
      if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
      dbUpdates.updated_at = new Date().toISOString();

      const { error } = await notesTable()
        .update(dbUpdates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update note: ${error.message}`);
    },
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await notesTable()
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete note: ${error.message}`);
    },
  });

  return {
    notes,
    isLoading,
    error,
    addNote,
    updateNote: (id: string, updates: Partial<Note>) => updateNote.mutate({ id, updates }),
    deleteNote: deleteNote.mutate,
  };
}
