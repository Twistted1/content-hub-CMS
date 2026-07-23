import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Project, ProjectStatus, Task } from "@/types";
import { toast } from "sonner";

export function useProjects() {
  const queryClient = useQueryClient();

  const { data: projects = [], isLoading, error } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      return data.map((project: any) => ({
        id: project.id,
        title: project.name,
        description: project.description || "",
        status: project.status as ProjectStatus,
        priority: project.priority || "medium",
        dueDate: project.end_date ? new Date(project.end_date).toISOString().split('T')[0] : "",
        progress: project.progress || 0,
        comments: 0, // Placeholder
        attachments: 0, // Placeholder
        assignees: (project.assignees || []).map((name: string) => ({ name })),
        tags: project.tags || [],
        createdAt: project.created_at,
      })) as Project[];
    },
  });

  const addProject = useMutation({
    mutationFn: async (newProject: Omit<Project, "id" | "createdAt">) => {
      // First try inserting with all fields
      const { data, error } = await supabase
        .from("projects")
        .insert({
          name: newProject.title,
          description: newProject.description,
          status: newProject.status,
          priority: newProject.priority,
          end_date: newProject.dueDate || null,
          progress: newProject.progress,
          tags: newProject.tags,
          assignees: newProject.assignees.map(a => a.name),
          user_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (!error) return data;

      // If error relates to missing columns, retry with minimal fields
      if (error.code === "42703" || error.message?.includes("priority") || error.message?.includes("progress") || error.message?.includes("tags") || error.message?.includes("assignees")) {
         console.warn("Extended columns missing, retrying with minimal fields");
         const { data: retryData, error: retryError } = await supabase
          .from("projects")
          .insert({
            name: newProject.title,
            description: newProject.description,
            status: newProject.status,
            end_date: newProject.dueDate || null,
            user_id: (await supabase.auth.getUser()).data.user?.id,
          })
          .select()
          .single();

         if (retryError) throw retryError;

         toast.warning("Project created. Some fields (priority, tags, progress, assignees) were not saved because the database schema is outdated.");
         return retryData;
      }

      throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      // Success toast is handled in mutationFn if it was a retry, or here if standard
      if (!document.querySelector(".sonner-toast-warning")) {
        toast.success("Project created successfully");
      }
    },
    onError: (error) => {
      toast.error(`Failed to create project: ${error.message}`);
    },
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Project> }) => {
      const dbUpdates: any = {};
      if (updates.title) dbUpdates.name = updates.title;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.priority) dbUpdates.priority = updates.priority;
      if (updates.dueDate !== undefined) dbUpdates.end_date = updates.dueDate || null;
      if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
      if (updates.tags) dbUpdates.tags = updates.tags;
      if (updates.assignees) dbUpdates.assignees = updates.assignees.map(a => a.name);

      const { error } = await supabase
        .from("projects")
        .update(dbUpdates)
        .eq("id", id);

      if (error) {
         // Handle missing columns for update
         if (error.code === "42703" || error.message?.includes("priority") || error.message?.includes("progress") || error.message?.includes("tags") || error.message?.includes("assignees")) {
            console.warn("Extended columns missing, retrying update with minimal fields");
            // Remove the problematic fields
            delete dbUpdates.priority;
            delete dbUpdates.progress;
            delete dbUpdates.tags;
            delete dbUpdates.assignees;
            
            // Retry only if there are still fields to update
            if (Object.keys(dbUpdates).length > 0) {
              const { error: retryError } = await supabase
                .from("projects")
                .update(dbUpdates)
                .eq("id", id);
                
              if (retryError) throw retryError;
              
              toast.warning("Project updated. Some fields could not be saved because the database schema is outdated.");
            }
            return;
         }
         throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      if (!document.querySelector(".sonner-toast-warning")) {
        toast.success("Project updated successfully");
      }
    },
    onError: (error) => {
      toast.error(`Failed to update project: ${error.message}`);
    },
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("projects")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete project: ${error.message}`);
    },
  });

  const moveProject = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: ProjectStatus }) => {
      const { error } = await supabase
        .from("projects")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Project status updated");
    },
    onError: (error) => {
      toast.error(`Failed to move project: ${error.message}`);
    },
  });

  return {
    projects,
    isLoading,
    error,
    addProject,
    updateProject: (id: string, updates: Partial<Project>) => updateProject.mutate({ id, updates }),
    deleteProject: deleteProject.mutate,
    moveProject: (id: string, status: ProjectStatus) => moveProject.mutate({ id, status }),
  };
}

export function useTasks() {
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;

      return data.map((task: any) => ({
        id: task.id,
        projectId: task.project_id,
        name: task.name,
        description: task.description,
        status: task.status,
        priority: task.priority,
        startDate: task.start_date,
        duration: task.duration,
        progress: task.progress,
        dependencies: task.dependencies,
        assigneeId: task.assignee_id,
        dueDate: task.due_date,
        createdAt: task.created_at,
      })) as Task[];
    },
  });

  const addTask = useMutation({
    mutationFn: async (newTask: Omit<Task, "id" | "createdAt">) => {
      const { data, error } = await supabase
        .from("tasks")
        .insert({
          project_id: newTask.projectId,
          name: newTask.name,
          description: newTask.description,
          status: newTask.status,
          priority: newTask.priority,
          start_date: newTask.startDate,
          duration: newTask.duration,
          progress: newTask.progress,
          dependencies: newTask.dependencies,
          assignee_id: newTask.assigneeId,
          due_date: newTask.dueDate,
          user_id: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task created successfully");
    },
    onError: (error) => {
      toast.error(`Failed to create task: ${error.message}`);
    },
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Task> }) => {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.status) dbUpdates.status = updates.status;
      if (updates.priority) dbUpdates.priority = updates.priority;
      if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
      if (updates.duration !== undefined) dbUpdates.duration = updates.duration;
      if (updates.progress !== undefined) dbUpdates.progress = updates.progress;
      if (updates.dependencies) dbUpdates.dependencies = updates.dependencies;
      if (updates.assigneeId) dbUpdates.assignee_id = updates.assigneeId;
      if (updates.dueDate) dbUpdates.due_date = updates.dueDate;

      const { error } = await supabase
        .from("tasks")
        .update(dbUpdates)
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task updated successfully");
    },
    onError: (error) => {
      toast.error(`Failed to update task: ${error.message}`);
    },
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("tasks")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted successfully");
    },
    onError: (error) => {
      toast.error(`Failed to delete task: ${error.message}`);
    },
  });

  return {
    tasks,
    isLoading,
    error,
    addTask: addTask.mutate,
    updateTask: (id: string, updates: Partial<Task>) => updateTask.mutate({ id, updates }),
    deleteTask: deleteTask.mutate,
  };
}
