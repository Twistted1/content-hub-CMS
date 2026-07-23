import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { permissions } from "./usersData";
import { useTranslation } from "react-i18next";

const ROLE_KEYS: Record<string, string> = {
  admin: "users.roleAdmin",
  editor: "users.roleEditor",
  viewer: "users.roleViewer",
  member: "users.roleMember",
};

const PERMISSION_KEYS: Record<string, { label: string; desc: string }> = {
  manage_users: { label: "users.permManageUsers", desc: "users.permManageUsersDesc" },
  manage_content: { label: "users.permManageContent", desc: "users.permManageContentDesc" },
  manage_settings: { label: "users.permManageSettings", desc: "users.permManageSettingsDesc" },
  view_analytics: { label: "users.permViewAnalytics", desc: "users.permViewAnalyticsDesc" },
  view_content: { label: "users.permViewContent", desc: "users.permViewContentDesc" },
  publish_content: { label: "users.permPublishContent", desc: "users.permPublishContentDesc" },
};

interface RoleConfigDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: { value: string; label: string; description: string; color: string };
  currentPermissions: string[];
  onSave: (permissions: string[]) => void;
}

export const RoleConfigDialog = ({
  open,
  onOpenChange,
  role,
  currentPermissions,
  onSave,
}: RoleConfigDialogProps) => {
  const { t } = useTranslation();
  const roleLabel = t(ROLE_KEYS[role.value] || role.label);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(currentPermissions);

  const handlePermissionToggle = (permissionId: string) => {
    setSelectedPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((p) => p !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSave = () => {
    onSave(selectedPermissions);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("users.configureRole", { role: roleLabel })}</DialogTitle>
          <DialogDescription>
            {t("users.configureRoleDesc", { role: roleLabel.toLowerCase() })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="border rounded-lg p-3 space-y-3">
            {permissions.map((permission) => (
              <div key={permission.id} className="flex items-start space-x-3">
                <Checkbox
                  id={`role-${permission.id}`}
                  checked={selectedPermissions.includes(permission.id)}
                  onCheckedChange={() => handlePermissionToggle(permission.id)}
                />
                <div className="grid gap-0.5">
                  <label
                    htmlFor={`role-${permission.id}`}
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

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          <Button onClick={handleSave}>{t("users.saveConfiguration")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
