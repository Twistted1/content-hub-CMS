import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Clock, Send, Edit, Trash2, MoreVertical, Image, Video, FileText, Globe } from "lucide-react";
import { Post, PlatformType } from "@/types";
import { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

interface Platform {
  id: string;
  name: string;
  icon: any;
}

interface PostCardProps {
  post: Post;
  platforms: Platform[];
  getPlatformColor: (id: string) => string;
  onEdit: (post: Post) => void;
  onDelete: (id: string) => void;
  onPublish: (id: string) => void;
}

export function PostCard({ post, platforms, getPlatformColor, onEdit, onDelete, onPublish }: PostCardProps) {
  const { t } = useTranslation();
  const getPostTypeIcon = (type: string) => {
    switch (type) {
      case "image": return Image;
      case "video": return Video;
      case "carousel": return FileText;
      default: return FileText;
    }
  };

  const getPlatformIcon = (id: string) => {
    const platform = platforms.find(p => p.id.toLowerCase() === id.toLowerCase());
    return platform?.icon || Globe;
  };

  const getTailwindColor = (id: string) => {
    switch (id.toLowerCase()) {
      case 'youtube': return 'bg-red-500/20 text-red-500';
      case 'twitter': return 'bg-zinc-800/20 text-zinc-800 dark:bg-zinc-100/20 dark:text-zinc-100';
      case 'facebook': return 'bg-blue-600/20 text-blue-600';
      case 'instagram': return 'bg-pink-600/20 text-pink-600';
      case 'linkedin': return 'bg-blue-700/20 text-blue-700';
      case 'tiktok': return 'bg-slate-900/20 text-slate-900 dark:bg-slate-100/20 dark:text-slate-100';
      case 'website': return 'bg-teal-500/20 text-teal-500';
      case 'podcast': return 'bg-purple-500/20 text-purple-500';
      case 'rumble': return 'bg-green-500/20 text-green-500';
      default: return 'bg-primary/20 text-primary';
    }
  };

  const PostTypeIcon = getPostTypeIcon(post.type);

  // Parse scheduledAt
  const scheduledDate = post.scheduledAt ? new Date(post.scheduledAt) : null;

  return (
    <Card className="bg-card border-border hover:border-primary/30 transition-all">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-lg bg-muted/50">
              <PostTypeIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-foreground truncate">{post.title}</h4>
              <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{post.content}</p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                {post.platforms && post.platforms.map((postPlatform) => {
                  const PlatformIcon = getPlatformIcon(postPlatform.platform);
                  return (
                    <div
                      key={postPlatform.id}
                      className={`p-1.5 rounded-md ${getTailwindColor(postPlatform.platform)}`}
                    >
                      <PlatformIcon className="h-3 w-3" />
                    </div>
                  );
                })}
                <Badge
                  variant={post.status === "published" ? "default" : post.status === "scheduled" ? "secondary" : "outline"}
                  className="text-[10px] ml-2"
                >
                  {t(`calendar.status${post.status.charAt(0).toUpperCase()}${post.status.slice(1)}`, { defaultValue: post.status })}
                </Badge>
                {scheduledDate && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {scheduledDate.toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {post.status !== "published" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs"
                onClick={() => onPublish(post.id)}
              >
                <Send className="h-3 w-3" />
                {t("platforms.postPublish")}
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onEdit(post)}>
                  <Edit className="h-4 w-4 mr-2" />
                  {t("platforms.postEdit")}
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={() => onDelete(post.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t("platforms.postDelete")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
