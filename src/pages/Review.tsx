import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePosts, useMedia } from "@/hooks/usePosts";
import { Post } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { platforms as platformIdentities, platformColors } from "@/components/platforms/platformsData";
import { getPlatformLimit } from "@/utils/platformLimits";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import {
  Inbox, FileText, CalendarClock, CheckCircle2, XCircle, RotateCcw,
  ImageIcon, Clock, Sparkles, Loader2, Globe, X,
} from "lucide-react";

/* ── helpers ─────────────────────────────────────────────── */

function fmtKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function splitScheduledAt(raw?: string | null) {
  if (!raw) return { date: "", time: "" };
  const [datePart, timePart = ""] = raw.split("T");
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return { date: datePart, time: timePart.slice(0, 5) };
  const d = parseISO(raw);
  return { date: fmtKey(d), time: format(d, "HH:mm") };
}

function defaultScheduledAt() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

function getPlatformIdentity(id: string) {
  return platformIdentities.find((p) => p.id === id.toLowerCase());
}

const INPUT_CLS = "w-full bg-card border border-border rounded-xl px-3 py-2.5 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/60 transition-colors";
const LABEL_CLS = "block text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1.5";

/* ── platform badge ──────────────────────────────────────── */

function PlatformBadge({ platform }: { platform: string }) {
  const identity = getPlatformIdentity(platform);
  const color = platformColors[platform.toLowerCase()] || "hsl(var(--primary))";
  const Icon = identity?.icon || Globe;
  return (
    <span
      className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <Icon className="w-3 h-3" />
      {identity?.name || platform}
    </span>
  );
}

/* ── status badge ────────────────────────────────────────── */

function StatusBadge({ status }: { status: string }) {
  const { t } = useTranslation();
  const cap = status.charAt(0).toUpperCase() + status.slice(1).replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  const variant =
    status === "awaiting_review" ? "bg-orange-500/10 text-orange-400 border-orange-500/20" :
    status === "scheduled" ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
    status === "draft" ? "bg-muted text-muted-foreground border-border" :
    status === "rejected" ? "bg-destructive/10 text-destructive border-destructive/20" :
    "bg-primary/10 text-primary border-primary/20";
  return (
    <Badge variant="outline" className={`text-[10px] ${variant}`}>
      {t(`calendar.status${cap}`, { defaultValue: status.replace("_", " ") })}
    </Badge>
  );
}

/* ── post row ────────────────────────────────────────────── */

interface PostRowProps {
  post: Post;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  onOpen: (post: Post) => void;
}

function PostRow({ post, selectable, selected, onToggleSelect, onOpen }: PostRowProps) {
  const { t } = useTranslation();
  const scheduled = post.scheduledAt ? parseISO(post.scheduledAt) : null;
  const platformList = Array.from(new Set((post.platforms || []).map((p) => p.platform)));

  return (
    <div
      className="flex items-start gap-3 p-4 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all cursor-pointer group"
      onClick={() => onOpen(post)}
    >
      {selectable && (
        <div className="pt-1" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={!!selected} onCheckedChange={() => onToggleSelect?.(post.id)} />
        </div>
      )}

      <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-muted/40 border border-border/50 flex items-center justify-center">
        {post.coverImageUrl ? (
          <img src={post.coverImageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-1">
          <h4 className="font-bold text-sm text-foreground truncate">{post.title || "—"}</h4>
          {post.isAiGenerated && (
            <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 border border-violet-500/20 shrink-0">
              <Sparkles className="w-2.5 h-2.5" />
              {t("review.aiGenerated")}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{post.content || post.excerpt || "—"}</p>
        <div className="flex items-center gap-1.5 flex-wrap">
          {platformList.map((p) => <PlatformBadge key={p} platform={p} />)}
          <StatusBadge status={post.status} />
          {scheduled && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-1 ml-1">
              <Clock className="w-3 h-3" />
              {format(scheduled, "MMM d, HH:mm")}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── editor modal ────────────────────────────────────────── */

function ReviewEditorModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const { t } = useTranslation();
  const { updatePost } = usePosts();
  const { uploadMedia } = useMedia();

  const initial = splitScheduledAt(post.scheduledAt);
  const [title, setTitle] = useState(post.title || "");
  const [content, setContent] = useState(post.content || "");
  const [coverImageUrl, setCoverImageUrl] = useState(post.coverImageUrl || "");
  const [date, setDate] = useState(initial.date);
  const [time, setTime] = useState(initial.time || "09:00");
  const [uploading, setUploading] = useState(false);

  const platformList = Array.from(new Set((post.platforms || []).map((p) => p.platform)));

  const runUpdate = (updates: Record<string, unknown>, successMessage: string) => {
    updatePost.mutate(
      { id: post.id, ...updates },
      {
        onSuccess: () => {
          toast.success(successMessage);
          onClose();
        },
      }
    );
  };

  const handleSaveChanges = () => {
    runUpdate({ title, content, cover_image_url: coverImageUrl || null }, t("review.postUpdated"));
  };

  const handleSendToDraft = () => {
    runUpdate(
      { title, content, cover_image_url: coverImageUrl || null, status: "draft", scheduled_at: null },
      t("review.postSentToDraft")
    );
  };

  const handleReject = () => {
    runUpdate(
      { title, content, cover_image_url: coverImageUrl || null, status: "rejected", reviewed_at: new Date().toISOString() },
      t("review.postRejected")
    );
  };

  const handleApproveAndSchedule = () => {
    if (!date) {
      toast.error(t("review.pickDateToApprove"));
      return;
    }
    const scheduledAt = `${date}T${time || "09:00"}:00`;
    runUpdate(
      {
        title,
        content,
        cover_image_url: coverImageUrl || null,
        status: "scheduled",
        scheduled_at: scheduledAt,
        reviewed_at: new Date().toISOString(),
      },
      t("review.postApproved")
    );
  };

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    try {
      const media = await uploadMedia.mutateAsync({ file, postId: post.id });
      setCoverImageUrl(media.url);
    } finally {
      setUploading(false);
    }
  };

  const saving = updatePost.isPending;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[92vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Inbox className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-black text-foreground tracking-tight">
                {post.status === "awaiting_review" ? t("review.reviewPost") : t("review.editPost")}
              </h2>
              <p className="text-[10px] text-muted-foreground font-medium">{t("review.editSubtitle")}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">

          {/* Meta info */}
          {(post.isAiGenerated || post.workflowStage || post.reviewedAt) && (
            <div className="flex items-center gap-2 flex-wrap">
              {post.isAiGenerated && (
                <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20">
                  <Sparkles className="w-3 h-3" />
                  {t("review.aiGenerated")}
                </span>
              )}
              {post.workflowStage && (
                <span className="text-[10px] text-muted-foreground font-bold">
                  {t("review.workflowStage", { stage: post.workflowStage })}
                </span>
              )}
              {post.reviewedAt && (
                <span className="text-[10px] text-muted-foreground font-bold">
                  {t("review.reviewedOn", { time: formatDistanceToNow(parseISO(post.reviewedAt), { addSuffix: true }) })}
                </span>
              )}
            </div>
          )}

          {/* Title */}
          <div>
            <label className={LABEL_CLS}>{t("review.titleLabel")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("review.titlePlaceholder")} className={INPUT_CLS} />
          </div>

          {/* Content */}
          <div>
            <label className={LABEL_CLS}>{t("review.contentLabel")}</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={5}
              placeholder={t("review.contentPlaceholder")}
              className={`${INPUT_CLS} resize-none leading-relaxed`}
            />
          </div>

          {/* Live per-platform character limits */}
          {platformList.length > 0 && (
            <div className="space-y-2">
              <label className={LABEL_CLS}>{t("calendar.platform")}</label>
              {platformList.map((platform) => {
                const limit = getPlatformLimit(platform);
                if (!limit) return null;
                const len = content.length;
                const over = len > limit.caption;
                const pct = Math.min(100, (len / limit.caption) * 100);
                return (
                  <div key={platform} className="p-3 rounded-xl bg-muted/20 border border-border/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <PlatformBadge platform={platform} />
                      <span className={`text-[10px] font-mono font-bold tabular-nums ${over ? "text-destructive" : pct > 85 ? "text-amber-400" : "text-muted-foreground"}`}>
                        {t("review.charsOf", { current: len.toLocaleString(), max: limit.caption.toLocaleString(), platform: limit.label })}
                      </span>
                    </div>
                    <div className="h-1 w-full rounded-full bg-muted/40 overflow-hidden">
                      <div
                        className={`h-full transition-all ${over ? "bg-destructive" : pct > 85 ? "bg-amber-400" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    {over && (
                      <p className="mt-1 text-[10px] text-destructive font-bold">
                        {t("review.exceedsLimit", { platform: limit.label, count: (len - limit.caption).toLocaleString() })}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {platformList.length === 0 && (
            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{t("review.noPlatforms")}</p>
          )}

          {/* Date + Time */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={LABEL_CLS} htmlFor="review-date">{t("review.scheduledDate")}</label>
              <input id="review-date" type="date" title={t("review.scheduledDate")} aria-label={t("review.scheduledDate")} value={date} onChange={(e) => setDate(e.target.value)} className={`${INPUT_CLS} input-dark-scheme`} />
            </div>
            <div>
              <label className={LABEL_CLS} htmlFor="review-time">{t("review.scheduledTime")}</label>
              <input id="review-time" type="time" title={t("review.scheduledTime")} aria-label={t("review.scheduledTime")} value={time} onChange={(e) => setTime(e.target.value)} className={`${INPUT_CLS} input-dark-scheme`} />
            </div>
          </div>

          {/* Image preview */}
          <div>
            <label className={LABEL_CLS}>{t("review.coverImage")}</label>
            {!coverImageUrl ? (
              <label className="flex flex-col items-center justify-center w-full h-28 bg-muted/20 border-2 border-dashed border-border hover:border-primary/40 rounded-xl cursor-pointer hover:bg-muted/30 transition-all group">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    <ImageIcon className="w-5 h-5 mb-1 text-muted-foreground/50 group-hover:scale-110 transition-transform" />
                    <span className="text-[11px] font-bold text-muted-foreground">{t("review.uploadImage")}</span>
                    <span className="text-[10px] text-muted-foreground/50">{t("review.noImage")}</span>
                  </>
                )}
                <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleImageUpload(f);
                }} />
              </label>
            ) : (
              <div className="relative w-full h-40 rounded-xl overflow-hidden border border-border group">
                <img src={coverImageUrl} alt="" className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <label className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-black rounded-lg cursor-pointer">
                    {uploading ? t("review.uploading") : t("review.replaceImage")}
                    <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleImageUpload(f);
                    }} />
                  </label>
                  <button onClick={() => setCoverImageUrl("")} className="px-3 py-1.5 bg-destructive text-destructive-foreground text-xs font-black rounded-lg">
                    {t("calendar.remove")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 gap-2 flex-wrap">
          <button
            onClick={handleReject}
            disabled={saving}
            className="px-4 py-2 text-xs font-black text-destructive hover:bg-destructive/10 rounded-xl transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <XCircle className="w-3.5 h-3.5" />
            {t("review.reject")}
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={handleSendToDraft}
              disabled={saving}
              className="px-4 py-2 text-xs font-black text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors disabled:opacity-40 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {t("review.sendBackToDraft")}
            </button>
            <button
              onClick={handleSaveChanges}
              disabled={saving}
              className="px-4 py-2 text-xs font-black text-foreground bg-muted hover:bg-muted/70 rounded-xl transition-colors disabled:opacity-40"
            >
              {t("review.saveChanges")}
            </button>
            <button
              onClick={handleApproveAndSchedule}
              disabled={saving}
              className="px-5 py-2 bg-primary hover:opacity-90 disabled:opacity-40 text-primary-foreground text-xs font-black rounded-xl transition-all flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              {t("review.approveAndSchedule")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── empty state ─────────────────────────────────────────── */

function EmptyState({ icon: Icon, label, spin }: { icon: any; label: string; spin?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className={`w-10 h-10 text-muted-foreground/20 mb-3 ${spin ? "animate-spin" : ""}`} />
      <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest opacity-60">{label}</p>
    </div>
  );
}

/* ── main page ───────────────────────────────────────────── */

export default function Review() {
  const { t } = useTranslation();
  const { posts, isLoading } = usePosts();
  const queryClient = useQueryClient();

  const [editingPost, setEditingPost] = useState<Post | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);
  const [activeTab, setActiveTab] = useState("needs-review");

  const needsReview = useMemo(() => posts.filter((p) => p.status === "awaiting_review"), [posts]);
  const drafts = useMemo(() => posts.filter((p) => p.status === "draft"), [posts]);
  const scheduled = useMemo(() => posts.filter((p) => p.status === "scheduled"), [posts]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setSelectedIds((prev) => (prev.size === needsReview.length ? new Set() : new Set(needsReview.map((p) => p.id))));
  };

  const handleBulkApprove = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    setBulkApproving(true);
    const nowIso = new Date().toISOString();
    try {
      const results = await Promise.all(
        ids.map((id) => {
          const post = needsReview.find((p) => p.id === id);
          const scheduledAt = post?.scheduledAt || defaultScheduledAt();
          return supabase
            .from("posts")
            .update({ status: "scheduled", scheduled_at: scheduledAt, reviewed_at: nowIso })
            .eq("id", id);
        })
      );
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;

      queryClient.invalidateQueries({ queryKey: ["posts"] });
      toast.success(t("review.bulkApproveSuccess", { count: ids.length }));
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(t("review.bulkApproveError", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBulkApproving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
            <Inbox className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="page-title mb-0">{t("review.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("review.subtitle")}</p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="needs-review" className="gap-1.5">
              <Inbox className="w-3.5 h-3.5" />
              {t("review.tabNeedsReview")}
              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">{needsReview.length}</span>
            </TabsTrigger>
            <TabsTrigger value="drafts" className="gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              {t("review.tabDrafts")}
              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">{drafts.length}</span>
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" />
              {t("review.tabScheduled")}
              <span className="ml-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-secondary text-secondary-foreground">{scheduled.length}</span>
            </TabsTrigger>
          </TabsList>

          {/* Needs Review */}
          <TabsContent value="needs-review" className="space-y-3 mt-4">
            {needsReview.length > 0 && (
              <div className="flex items-center justify-between px-1 py-2">
                <div className="flex items-center gap-2">
                  <Checkbox checked={selectedIds.size === needsReview.length && needsReview.length > 0} onCheckedChange={toggleSelectAll} />
                  <span className="text-xs font-bold text-muted-foreground">
                    {selectedIds.size > 0 ? t("review.selectedCount", { count: selectedIds.size }) : t("review.selectAll")}
                  </span>
                </div>
                <button
                  onClick={handleBulkApprove}
                  disabled={selectedIds.size === 0 || bulkApproving}
                  className="px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-40 text-primary-foreground text-xs font-black rounded-xl transition-all flex items-center gap-1.5"
                >
                  {bulkApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {bulkApproving ? t("review.approvingSelected") : t("review.approveSelected", { count: selectedIds.size })}
                </button>
              </div>
            )}
            {isLoading ? (
              <EmptyState icon={Loader2} label={t("review.loadingPosts")} spin />
            ) : needsReview.length === 0 ? (
              <EmptyState icon={Inbox} label={t("review.emptyNeedsReview")} />
            ) : (
              needsReview.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  selectable
                  selected={selectedIds.has(post.id)}
                  onToggleSelect={toggleSelect}
                  onOpen={setEditingPost}
                />
              ))
            )}
          </TabsContent>

          {/* Drafts */}
          <TabsContent value="drafts" className="space-y-3 mt-4">
            {isLoading ? (
              <EmptyState icon={Loader2} label={t("review.loadingPosts")} spin />
            ) : drafts.length === 0 ? (
              <EmptyState icon={FileText} label={t("review.emptyDrafts")} />
            ) : (
              drafts.map((post) => <PostRow key={post.id} post={post} onOpen={setEditingPost} />)
            )}
          </TabsContent>

          {/* Scheduled */}
          <TabsContent value="scheduled" className="space-y-3 mt-4">
            {isLoading ? (
              <EmptyState icon={Loader2} label={t("review.loadingPosts")} spin />
            ) : scheduled.length === 0 ? (
              <EmptyState icon={CalendarClock} label={t("review.emptyScheduled")} />
            ) : (
              scheduled.map((post) => <PostRow key={post.id} post={post} onOpen={setEditingPost} />)
            )}
          </TabsContent>
        </Tabs>
      </div>

      {editingPost && <ReviewEditorModal post={editingPost} onClose={() => setEditingPost(null)} />}
    </DashboardLayout>
  );
}
