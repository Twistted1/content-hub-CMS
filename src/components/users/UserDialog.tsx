import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { User, roles, permissions, rolePermissions } from "./usersData";
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

interface UserDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null;
  onSave: (data: Partial<User>) => void;
  mode: "create" | "edit" | "role";
}

export const UserDialog = ({
  open,
  onOpenChange,
  user,
  onSave,
  mode,
}: UserDialogProps) => {
  const { t } = useTranslation();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<User["role"]>("member");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setRole(user.role);
      setSelectedPermissions(user.permissions);
    } else {
      setName("");
      setEmail("");
      setRole("member");
      setSelectedPermissions(rolePermissions.member);
    }
  }, [user, open]);

  const handleRoleChange = (newRole: User["role"]) => {
    setRole(newRole);
    setSelectedPermissions(rolePermissions[newRole] || []);
  };

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((p) => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSave = () => {
    if (mode === "create") {
      onSave({
        name: name || email.split("@")[0],
        email,
        role,
        status: "pending",
        permissions: selectedPermissions,
      });
    } else if (mode === "role") {
      onSave({ role, permissions: selectedPermissions });
    } else {
      onSave({ name, email, permissions: selectedPermissions });
    }
    onOpenChange(false);
  };

  const getTitle = () => {
    switch (mode) {
      case "create":
        return t("users.inviteTeamMember");
      case "role":
        return t("users.changeRole");
      default:
        return t("users.editUser");
    }
  };

  const getDescription = () => {
    switch (mode) {
      case "create":
        return t("users.sendInvitationDesc");
      case "role":
        return t("users.updateRoleDesc", { name: user?.name });
      default:
        return t("users.updateUserDesc");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{getTitle()}</DialogTitle>
          <DialogDescription>{getDescription()}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {mode !== "role" && (
            <>
              {mode === "edit" && (
                <div className="space-y-2">
                  <Label htmlFor="name">{t("users.name")}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t("users.emailAddress")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.com"
                  disabled={mode === "edit"}
                />
              </div>
            </>
          )}

          {(mode === "create" || mode === "role") && (
            <div className="space-y-2">
              <Label>{t("users.role")}</Label>
              <Select value={role} onValueChange={(v) => handleRoleChange(v as User["role"])}>
                <SelectTrigger>
                  <SelectValue placeholder={t("users.selectRole")} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div>
                        <div className="font-medium">{t(ROLE_KEYS[r.value]?.label || r.label)}</div>
                        <div className="text-xs text-muted-foreground">
                          {t(ROLE_KEYS[r.value]?.desc || r.description)}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label>{t("users.permissions")}</Label>
            <div className="border rounded-lg p-3 space-y-3 max-h-48 overflow-y-auto">
              {permissions.map((permission) => (
                <div key={permission.id} className="flex items-start space-x-3">
                  <Checkbox
                    id={permission.id}
                    checked={selectedPermissions.includes(permission.id)}
                    onCheckedChange={() => handlePermissionToggle(permission.id)}
                  />
                  <div className="grid gap-0.5">
                    <label
                      htmlFor={permission.id}
                      className="text-sm font-medium cursor-pointer"
                    >
                      {t(PERMISSION_KEYS[permission.id]?.label || permission.label)}
                    </label>
                    <p className="text-xs text-muted-foreground">
                      {t(PERMISSION_KEYS[permission.id]?.desc || permission.description)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave} disabled={mode === "create" && !email}>
            {mode === "create" ? t("users.sendInvitation") : t("users.saveChanges")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
