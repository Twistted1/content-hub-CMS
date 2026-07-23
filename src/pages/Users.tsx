import { useState, useMemo } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Users,
  UserPlus,
  Shield,
  Settings,
  Search,
  Mail,
  Clock,
  UserCheck,
  Trash2,
  UserX,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUsers, type User } from "@/hooks/useUsers";
import { UserCard } from "@/components/users/UserCard";
import { UserDialog } from "@/components/users/UserDialog";
import { RoleConfigDialog } from "@/components/users/RoleConfigDialog";
import { roles, permissions, rolePermissions } from "@/components/users/usersData";
import { useTranslation } from "react-i18next";

const ROLE_KEYS: Record<string, { label: string; desc: string }> = {
  admin: { label: "users.roleAdmin", desc: "users.roleAdminDesc" },
  editor: { label: "users.roleEditor", desc: "users.roleEditorDesc" },
  viewer: { label: "users.roleViewer", desc: "users.roleViewerDesc" },
  member: { label: "users.roleMember", desc: "users.roleMemberDesc" },
};

const PERMISSION_KEYS: Record<string, { label: string; desc: string }> = {
  manage_users: { label: "users.permManageUsers", desc: "users.permManageUsersDesc" },
  manage_content: { label: "users.permManageContent", desc: "users.permManageContentDesc" },
  manage_settings: { label: "users.permManageSettings", desc: "users.permManageSettingsDesc" },
  view_analytics: { label: "users.permViewAnalytics", desc: "users.permViewAnalyticsDesc" },
  view_content: { label: "users.permViewContent", desc: "users.permViewContentDesc" },
  publish_content: { label: "users.permPublishContent", desc: "users.permPublishContentDesc" },
};

const UsersPage = () => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { users, addUser, updateUser, deleteUser, resendInvite } = useUsers({ includeInvitations: true });
  
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  
  // Dialog states
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userDialogMode, setUserDialogMode] = useState<"create" | "edit" | "role">("create");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [roleConfigOpen, setRoleConfigOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<{ value: string; label: string; description: string; color: string } | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === "all" || user.status === statusFilter;
      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, searchQuery, statusFilter, roleFilter]);

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedUsers(filteredUsers.map((u) => u.id));
    } else {
      setSelectedUsers([]);
    }
  };

  const handleSelectUser = (userId: string, checked: boolean) => {
    if (checked) {
      setSelectedUsers([...selectedUsers, userId]);
    } else {
      setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    }
  };

  const handleInviteUser = () => {
    setSelectedUser(null);
    setUserDialogMode("create");
    setUserDialogOpen(true);
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setUserDialogMode("edit");
    setUserDialogOpen(true);
  };

  const handleChangeRole = (user: User) => {
    setSelectedUser(user);
    setUserDialogMode("role");
    setUserDialogOpen(true);
  };

  const handleUserDialogSave = (data: Partial<User>) => {
    if (userDialogMode === "create") {
      addUser({
        email: data.email || "",
        role: data.role || "member",
      });
      toast({
        title: t("users.invitationSent"),
        description: t("users.invitationSentDesc", { email: data.email }),
      });
    } else if (selectedUser) {
      if (userDialogMode === "role") {
        updateUser(selectedUser.id, { role: data.role });
        if (data.permissions) {
          updateUser(selectedUser.id, { permissions: data.permissions });
        }
        toast({
          title: t("users.roleUpdated"),
          description: t("users.roleUpdatedDesc", { name: selectedUser.name }),
        });
      } else {
        updateUser(selectedUser.id, data);
        toast({
          title: t("users.userUpdated"),
          description: t("users.userUpdatedDesc", { name: selectedUser.name }),
        });
      }
    }
  };

  const handleDeleteUser = (userId: string) => {
    const user = users.find((u) => u.id === userId);
    deleteUser(userId);
    setSelectedUsers(selectedUsers.filter((id) => id !== userId));
    toast({
      title: t("users.userRemoved"),
      description: t("users.userRemovedDesc", { name: user?.name || "User" }),
    });
  };

  const handleBulkDelete = () => {
    selectedUsers.forEach(id => deleteUser(id));
    toast({
      title: t("users.usersRemoved"),
      description: t("users.usersRemovedDesc", { count: selectedUsers.length }),
    });
    setSelectedUsers([]);
  };

  const handleBulkActivate = () => {
    selectedUsers.forEach((id) => {
      const user = users.find((u) => u.id === id);
      if (user && user.status !== "active") {
        updateUser(id, { status: "active" });
      }
    });
    toast({
      title: t("users.usersActivated"),
      description: t("users.usersActivatedDesc", { count: selectedUsers.length }),
    });
    setSelectedUsers([]);
  };

  const handleBulkDeactivate = () => {
    selectedUsers.forEach((id) => {
      const user = users.find((u) => u.id === id);
      if (user && user.status === "active") {
        updateUser(id, { status: "inactive" });
      }
    });
    toast({
      title: t("users.usersDeactivated"),
      description: t("users.usersDeactivatedDesc", { count: selectedUsers.length }),
    });
    setSelectedUsers([]);
  };

  const handleResendInvite = (userId: string) => {
    resendInvite(userId);
    const user = users.find((u) => u.id === userId);
    toast({
      title: t("users.invitationResent"),
      description: t("users.invitationResentDesc", { email: user?.email }),
    });
  };

  const handleConfigureRole = (role: { value: string; label: string; description: string; color: string }) => {
    setSelectedRole(role);
    setRoleConfigOpen(true);
  };

  const handleRoleConfigSave = (permissions: string[]) => {
    toast({
      title: t("users.roleConfigured"),
      description: t("users.roleConfiguredDesc", { role: selectedRole ? t(ROLE_KEYS[selectedRole.value]?.label || selectedRole.label) : "" }),
    });
  };

  // Stats
  const activeUsers = users.filter((u) => u.status === "active").length;
  const pendingUsers = users.filter((u) => u.status === "pending").length;
  const adminUsers = users.filter((u) => u.role === "admin").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="page-title mb-2">{t("users.title")}</h1>
            <p className="text-muted-foreground">
              {t("users.subtitle")}
            </p>
          </div>
          <Button onClick={handleInviteUser}>
            <UserPlus className="mr-2 h-4 w-4" />
            {t("users.inviteUser")}
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("users.totalUsers")}</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{users.length}</div>
              <p className="text-xs text-muted-foreground">{t("users.teamMembers")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("users.activeUsers")}</CardTitle>
              <UserCheck className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{activeUsers}</div>
              <p className="text-xs text-muted-foreground">{t("users.currentlyActive")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("users.pendingInvites")}</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingUsers}</div>
              <p className="text-xs text-muted-foreground">{t("users.awaitingResponse")}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t("users.admins")}</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{adminUsers}</div>
              <p className="text-xs text-muted-foreground">{t("users.fullAccess")}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs defaultValue="members" className="space-y-4">
          <TabsList>
            <TabsTrigger value="members">{t("users.tabMembers")}</TabsTrigger>
            <TabsTrigger value="roles">{t("users.tabRoles")}</TabsTrigger>
            <TabsTrigger value="invitations">{t("users.tabInvitations")}</TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-4">
                  <div>
                    <CardTitle>{t("users.tabMembers")}</CardTitle>
                    <CardDescription>
                      {t("users.teamMembersDesc")}
                    </CardDescription>
                  </div>

                  {/* Filters */}
                  <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder={t("users.searchPlaceholder")}
                        className="pl-8"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <Select value={statusFilter} onValueChange={setStatusFilter}>
                      <SelectTrigger className="w-full md:w-[140px]">
                        <SelectValue placeholder={t("users.statusPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("users.allStatus")}</SelectItem>
                        <SelectItem value="active">{t("users.active")}</SelectItem>
                        <SelectItem value="inactive">{t("users.inactive")}</SelectItem>
                        <SelectItem value="pending">{t("users.pending")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <Select value={roleFilter} onValueChange={setRoleFilter}>
                      <SelectTrigger className="w-full md:w-[140px]">
                        <SelectValue placeholder={t("users.rolePlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">{t("users.allRoles")}</SelectItem>
                        {roles.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {t(ROLE_KEYS[role.value]?.label || role.label)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Bulk Actions */}
                  {selectedUsers.length > 0 && (
                    <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
                      <span className="text-sm font-medium">
                        {t("users.selected", { count: selectedUsers.length })}
                      </span>
                      <div className="flex-1" />
                      <Button variant="outline" size="sm" onClick={handleBulkActivate}>
                        <UserCheck className="mr-2 h-4 w-4" />
                        {t("users.activate")}
                      </Button>
                      <Button variant="outline" size="sm" onClick={handleBulkDeactivate}>
                        <UserX className="mr-2 h-4 w-4" />
                        {t("users.deactivate")}
                      </Button>
                      <Button variant="destructive" size="sm" onClick={handleBulkDelete}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        {t("users.remove")}
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {/* Select All */}
                <div className="flex items-center gap-3 pb-4 border-b mb-4">
                  <Checkbox
                    checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                    onCheckedChange={handleSelectAll}
                    aria-label={t("users.selectAll")}
                  />
                  <span className="text-sm text-muted-foreground">
                    {t("users.selectAllCount", { count: filteredUsers.length })}
                  </span>
                </div>

                {/* User List */}
                <div className="space-y-2">
                  {filteredUsers.length > 0 ? (
                    filteredUsers.map((user) => (
                      <UserCard
                        key={user.id}
                        user={user as any}
                        selected={selectedUsers.includes(user.id)}
                        onSelect={(checked) => handleSelectUser(user.id, checked)}
                        onEdit={() => handleEditUser(user)}
                        onChangeRole={() => handleChangeRole(user)}
                        onToggleStatus={() => updateUser(user.id, { status: user.status === 'active' ? 'inactive' : 'active' })}
                        onDelete={() => handleDeleteUser(user.id)}
                      />
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Users className="mx-auto h-12 w-12 mb-4 opacity-50" />
                      <p>{t("users.noUsersFound")}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="roles" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t("users.rolesTitle")}</CardTitle>
                  <CardDescription>
                    {t("users.rolesDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {roles.map((role) => (
                    <div
                      key={role.value}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{t(ROLE_KEYS[role.value]?.label || role.label)}</div>
                        <div className="text-sm text-muted-foreground">
                          {t(ROLE_KEYS[role.value]?.desc || role.description)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t("users.usersCount", { count: users.filter((u) => u.role === role.value).length })}
                        </div>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => handleConfigureRole(role)}>
                        <Settings className="mr-2 h-4 w-4" />
                        {t("users.configure")}
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t("users.permissionsTitle")}</CardTitle>
                  <CardDescription>
                    {t("users.permissionsDesc")}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {permissions.map((permission) => (
                    <div
                      key={permission.id}
                      className="flex items-center justify-between rounded-lg border p-4"
                    >
                      <div className="space-y-1">
                        <div className="font-medium">{t(PERMISSION_KEYS[permission.id]?.label || permission.label)}</div>
                        <div className="text-sm text-muted-foreground">
                          {t(PERMISSION_KEYS[permission.id]?.desc || permission.description)}
                        </div>
                      </div>
                      <Switch defaultChecked />
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="invitations" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("users.pendingInvitations")}</CardTitle>
                <CardDescription>
                  {t("users.invitationsDesc")}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {users.filter((u) => u.status === "pending").length > 0 ? (
                  <div className="space-y-4">
                    {users
                      .filter((u) => u.status === "pending")
                      .map((user) => (
                        <div
                          key={user.id}
                          className="flex items-center justify-between rounded-lg border p-4"
                        >
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              <Mail className="h-5 w-5 text-muted-foreground" />
                            </div>
                            <div>
                              <div className="font-medium">{user.email}</div>
                              <div className="text-sm text-muted-foreground">
                                {t("users.invitedAs", { role: user.role, date: user.joinedDate })}
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleResendInvite(user.id)}
                            >
                              <RefreshCw className="mr-2 h-4 w-4" />
                              {t("users.resend")}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteUser(user.id)}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <Mail className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p>{t("users.noPendingInvitations")}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      <UserDialog
        open={userDialogOpen}
        onOpenChange={setUserDialogOpen}
        user={selectedUser as any}
        onSave={handleUserDialogSave}
        mode={userDialogMode}
      />

      {selectedRole && (
        <RoleConfigDialog
          open={roleConfigOpen}
          onOpenChange={setRoleConfigOpen}
          role={selectedRole}
          currentPermissions={rolePermissions[selectedRole.value] || []}
          onSave={handleRoleConfigSave}
        />
      )}
    </DashboardLayout>
  );
};

export default UsersPage;
