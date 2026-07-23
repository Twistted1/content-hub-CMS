import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { 
  MoreHorizontal, 
  Edit, 
  Key, 
  Trash2, 
  UserCheck, 
  UserX,
  Copy,
} from "lucide-react";
import { User, getStatusColor, getRoleColor } from "./usersData";
import { useTranslation } from "react-i18next";

const ROLE_LABEL_KEYS: Record<string, string> = {
  admin: "users.roleAdmin",
  editor: "users.roleEditor",
  viewer: "users.roleViewer",
  member: "users.roleMember",
};

const STATUS_LABEL_KEYS: Record<string, string> = {
  active: "users.active",
  inactive: "users.inactive",
  pending: "users.pending",
};

interface UserCardProps {
  user: User;
  selected: boolean;
  onSelect: (checked: boolean) => void;
  onEdit: () => void;
  onChangeRole: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
}

export const UserCard = ({
  user,
  selected,
  onSelect,
  onEdit,
  onChangeRole,
  onToggleStatus,
  onDelete,
}: UserCardProps) => {
  const { t } = useTranslation();
  const statusColor = getStatusColor(user.status);
  const roleColor = getRoleColor(user.role);

  return (
    <div className="flex items-center gap-4 p-4 rounded-lg border bg-card hover:bg-accent/5 transition-colors">
      <Checkbox
        checked={selected}
        onCheckedChange={onSelect}
        aria-label={t("users.selectUser", { name: user.name })}
      />
      
      <Avatar className="h-10 w-10">
        <AvatarImage src={user.avatar} />
        <AvatarFallback>
          {user.name
            .split(" ")
            .map((n) => n[0])
            .join("")}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{user.name}</div>
        <div className="text-sm text-muted-foreground truncate">{user.email}</div>
      </div>

      <Badge className={roleColor} variant={roleColor ? undefined : "outline"}>
        {t(ROLE_LABEL_KEYS[user.role] || user.role)}
      </Badge>

      <Badge className={statusColor} variant={statusColor ? undefined : "secondary"}>
        {t(STATUS_LABEL_KEYS[user.status] || user.status)}
      </Badge>

      <div className="text-sm text-muted-foreground hidden md:block w-24">
        {user.lastActive}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>{t("users.actions")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            {t("users.editUser")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onChangeRole}>
            <Key className="mr-2 h-4 w-4" />
            {t("users.changeRole")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(user.email)}>
            <Copy className="mr-2 h-4 w-4" />
            {t("users.copyEmail")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onToggleStatus}>
            {user.status === "active" ? (
              <>
                <UserX className="mr-2 h-4 w-4" />
                {t("users.deactivate")}
              </>
            ) : (
              <>
                <UserCheck className="mr-2 h-4 w-4" />
                {t("users.activate")}
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="text-destructive"
            onClick={onDelete}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {t("users.removeUser")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
