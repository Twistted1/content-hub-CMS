import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { PostType, PlatformType } from "@/types";
import { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import React from "react";

interface Platform {
  id: string;
  name: string;
  icon: any;
}

export interface NewPost {
  title: string;
  content: string;
  platforms: PlatformType[];
  scheduledDate: string;
  scheduledTime: string;
  type: PostType;
}

interface PostDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  newPost: NewPost;
  onNewPostChange: (post: NewPost) => void;
  onCreatePost: () => void;
  connectedPlatforms: Platform[];
  getPlatformColor: (id: string) => string;
  togglePlatformSelection: (platformId: string) => void;
}

export function PostDialog({
  isOpen,
  onOpenChange,
  newPost,
  onNewPostChange,
  onCreatePost,
  connectedPlatforms,
  getPlatformColor,
  togglePlatformSelection,
}: PostDialogProps) {
  const { t } = useTranslation();
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button className="gap-2 bg-primary hover:bg-primary/90">
          <Plus className="h-4 w-4" />
          {t("platforms.createPost")}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t("platforms.createPostDialogTitle")}</DialogTitle>
          <DialogDescription>
            {t("platforms.createPostDialogDesc")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">{t("platforms.postTitle")}</Label>
            <Input
              id="title"
              placeholder={t("platforms.postTitlePlaceholder")}
              value={newPost.title}
              onChange={(e) => onNewPostChange({ ...newPost, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="content">{t("platforms.postContent")}</Label>
            <Textarea
              id="content"
              placeholder={t("platforms.postContentPlaceholder")}
              rows={4}
              value={newPost.content}
              onChange={(e) => onNewPostChange({ ...newPost, content: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>{t("platforms.contentType")}</Label>
            <Select
              value={newPost.type}
              onValueChange={(value: PostType) =>
                onNewPostChange({ ...newPost, type: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={t("platforms.selectContentType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">{t("platforms.typeText")}</SelectItem>
                <SelectItem value="image">{t("platforms.typeImage")}</SelectItem>
                <SelectItem value="video">{t("platforms.typeVideo")}</SelectItem>
                <SelectItem value="carousel">{t("platforms.typeCarousel")}</SelectItem>
                <SelectItem value="reel">{t("platforms.typeReel")}</SelectItem>
                <SelectItem value="thread">{t("platforms.typeThread")}</SelectItem>
                <SelectItem value="article">{t("platforms.typeArticle")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("platforms.postPlatforms")}</Label>
            <div className="flex flex-wrap gap-2">
              {connectedPlatforms.map((platform) => (
                <div
                  key={platform.id}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all ${
                    newPost.platforms.includes(platform.id as PlatformType)
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => togglePlatformSelection(platform.id)}
                >
                  <Checkbox
                    checked={newPost.platforms.includes(platform.id as PlatformType)}
                    onCheckedChange={() => togglePlatformSelection(platform.id)}
                  />
                  <platform.icon
                    className="h-4 w-4"
                    style={{ color: getPlatformColor(platform.id) }}
                  />
                  <span className="text-sm">{platform.name}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">{t("platforms.scheduleDate")}</Label>
              <Input
                id="date"
                type="date"
                value={newPost.scheduledDate}
                onChange={(e) => onNewPostChange({ ...newPost, scheduledDate: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">{t("platforms.scheduleTime")}</Label>
              <Input
                id="time"
                type="time"
                value={newPost.scheduledTime}
                onChange={(e) => onNewPostChange({ ...newPost, scheduledTime: e.target.value })}
              />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("platforms.cancel")}
          </Button>
          <Button onClick={onCreatePost}>
            {newPost.scheduledDate && newPost.scheduledTime ? t("platforms.schedulePost") : t("platforms.saveAsDraft")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
