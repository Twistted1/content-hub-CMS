import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "./useAuth";

export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive" | "pending";
  lastActive?: string;
  joinedDate: string;
  avatar?: string;
  permissions?: string[];
}

export function useUsers(options: { includeInvitations?: boolean } = {}) {
  const queryClient = useQueryClient();
  const { user: currentUser } = useAuth();
  const includeInvitations = options.includeInvitations ?? false;

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      // Fetch profiles and user_roles separately to avoid FK join error
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*"),
        supabase.from("user_roles").select("*"),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const rolesMap = new Map<string, string>();
      if (!rolesRes.error && rolesRes.data) {
        rolesRes.data.forEach((r: any) => rolesMap.set(r.user_id, r.role));
      }

      // Try to fetch invitations only where the Users page needs them.
      let invitations: any[] = [];
      if (includeInvitations) try {
        const { data, error: invitesError } = await (supabase as any)
          .from("invitations")
          .select("*")
          .eq("status", "pending");
        if (!invitesError && data) invitations = data;
      } catch { /* table may not exist */ }

      const activeUsers = (profilesRes.data || []).map((profile: any) => ({
        id: profile.user_id,
        name: profile.display_name || profile.email || "Unknown",
        email: profile.email || "",
        role: rolesMap.get(profile.user_id) || "user",
        status: (profile.status === "inactive" ? "inactive" : "active") as "active" | "inactive",
        lastActive: undefined,
        joinedDate: new Date(profile.created_at).toLocaleDateString(),
        avatar: profile.avatar_url || "",
        permissions: [],
      }));

      const pendingUsers = invitations.map((invite: any) => ({
        id: invite.id,
        name: invite.email,
        email: invite.email,
        role: invite.role,
        status: "pending" as const,
        joinedDate: new Date(invite.created_at).toLocaleDateString(),
        avatar: "",
        permissions: [],
      }));

      return [...activeUsers, ...pendingUsers] as User[];
    },
  });

  const addUser = useMutation({
    mutationFn: async (newUser: { email: string; role: string }) => {
      try {
        const { data, error } = await (supabase as any)
          .from("invitations")
          .insert({ email: newUser.email, role: newUser.role, token: crypto.randomUUID() })
          .select()
          .single();
        if (error) throw error;
        return data;
      } catch {
        throw new Error("Invitations feature not available");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("Invitation sent successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to invite user: ${error.message}`);
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<User> }) => {
      const dbUpdates: any = {};
      if (updates.name) dbUpdates.display_name = updates.name;
      // Was silently dropped before - the "Activate"/"Deactivate" actions
      // called this with { status } and nothing ever wrote it anywhere, so
      // the toggle reverted on every reload. profiles.status is a real
      // column now (RLS already lets admins update other users' rows).
      if (updates.status) dbUpdates.status = updates.status;

      if (Object.keys(dbUpdates).length > 0) {
        const { error } = await supabase
          .from("profiles")
          .update(dbUpdates)
          .eq("user_id", id);
        if (error) throw error;
      }

      if (updates.role) {
        const { error } = await supabase
          .from("user_roles")
          .update({ role: updates.role as any })
          .eq("user_id", id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to update user: ${error.message}`);
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (id: string) => {
      const target = users.find(u => u.id === id);
      if (target?.status === "pending") {
        const { error } = await (supabase as any).from("invitations").delete().eq("id", id);
        if (error) throw error;
        return;
      }

      // Was a total no-op for anyone who wasn't a pending invitation - it
      // just showed a toast and never touched the database, so the row
      // reappeared on every refresh. Deleting Supabase Auth accounts needs
      // the service role key (not available client-side), so "Remove"
      // here means what a Team Members list actually needs: drop them from
      // profiles/user_roles so they disappear from every admin view. Their
      // auth login itself isn't deleted.
      if (id === currentUser?.id) {
        throw new Error("You can't remove your own account");
      }
      const { error: roleError } = await supabase.from("user_roles").delete().eq("user_id", id);
      if (roleError) throw roleError;
      const { error: profileError } = await supabase.from("profiles").delete().eq("user_id", id);
      if (profileError) throw profileError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User removed successfully");
    },
    onError: (error: any) => {
      toast.error(`Failed to remove user: ${error.message}`);
    },
  });

  const resendInvite = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("invitations")
        .update({ created_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Invitation resent successfully");
    },
  });

  return {
    users,
    isLoading,
    error,
    addUser: addUser.mutate,
    updateUser: (id: string, updates: Partial<User>) => updateUser.mutate({ id, updates }),
    deleteUser: deleteUser.mutate,
    resendInvite: resendInvite.mutate,
  };
}
