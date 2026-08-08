import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { usePosts, useMedia } from "@/hooks/usePosts";
import { Post } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { platforms as platformIdentities, platformColors } from "@/components/platforms/platformsData";
import { getPlatformLimit } from "@/utils/platformLimits";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import {
  Inbox, FileText, CalendarClock, CheckCircle2, XCircle, RotateCcw,
  ImageIcon, Clock, Sparkles, Loader2, Globe, ListChecks,
} from "lucide-react";

type TabKey = "needs-review" | "drafts" | "scheduled";

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

/* ── small tags ──────────────────────────────────────────── */

function PlatformTag({ platform }: { platform: string }) {
  const color = platformColors[platform.toLowerCase()] || "hsl(var(--primary))";
  return (
    <span
      className="text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md text-white shrink-0"
      style={{ backgroundColor: color }}
    >
      {platform}
    </span>
  );
}

function AiTag() {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase tracking-wider px-2 py-1 rounded-md bg-muted text-muted-foreground shrink-0">
      <Sparkles className="w-2.5 h-2.5" />
      {t("review.aiGenerated")}
    </span>
  );
}

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
    <Badge variant="outline" className={`text-[10px] shrink-0 ${variant}`}>
      {t(`calendar.status${cap}`, { defaultValue: status.replace("_", " ") })}
    </Badge>
  );
}

/* ── list row ────────────────────────────────────────────── */

interface PostRowProps {
  post: Post;
  active: boolean;
  selectable?: boolean;
  checked?: boolean;
  onToggleCheck?: (id: string) => void;
  onClick: () => void;
}

function PostRow({ post, active, selectable, checked, onToggleCheck, onClick }: PostRowProps) {
  const scheduledDate = post.scheduledAt ? parseISO(post.scheduledAt) : null;
  const platformList = Array.from(new Set((post.platforms || []).map((p) => p.platform)));

  return (
    <div
      onClick={onClick}
      className={cn(
        "flex items-start gap-2.5 p-3 rounded-xl border cursor-pointer transition-all",
        active ? "bg-primary/10 border-primary/40" : "bg-card border-border hover:border-primary/30"
      )}
    >
      {selectable && (
        <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={!!checked} onCheckedChange={() => onToggleCheck?.(post.id)} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
          {platformList.map((p) => <PlatformTag key={p} platform={p} />)}
          {post.isAiGenerated && <AiTag />}
        </div>
        <h4 className="font-bold text-sm text-foreground truncate">{post.title || "—"}</h4>
        <p className="text-xs text-muted-foreground truncate mt-0.5">{post.content || post.excerpt || "—"}</p>
        {scheduledDate && (
          <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-1.5">
            <Clock className="w-3 h-3" />
            {format(scheduledDate, "M/d/yyyy, h:mm a")}
          </span>
        )}
      </div>
    </div>
  );
}

/* ── detail / editor pane ────────────────────────────────── */

function ReviewEditorPane({ post }: { post: Post }) {
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
  const primaryPlatform = platformList[0];
  const primaryIdentity = primaryPlatform ? getPlatformIdentity(primaryPlatform) : undefined;
  const primaryLimit = primaryPlatform ? getPlatformLimit(primaryPlatform) : null;
  const PrimaryIcon = primaryIdentity?.icon || Globe;
  const primaryColor = primaryPlatform ? (platformColors[primaryPlatform.toLowerCase()] || "hsl(var(--primary))") : "hsl(var(--primary))";

  const contentLen = content.length;
  const over = primaryLimit ? contentLen > primaryLimit.caption : false;
  const pct = primaryLimit ? Math.min(100, (contentLen / primaryLimit.caption) * 100) : 0;

  const runUpdate = (updates: Record<string, unknown>, successMessage: string) => {
    updatePost.mutate(
      { id: post.id, ...updates },
      { onSuccess: () => toast.success(successMessage) }
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
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${primaryColor}22` }}>
            <PrimaryIcon className="w-4 h-4" style={{ color: primaryColor }} />
          </div>
          <h2 className="text-base font-black text-foreground tracking-tight truncate">
            {primaryLimit?.label || primaryIdentity?.name || t("review.editPost")}
          </h2>
          {post.isAiGenerated && <AiTag />}
        </div>
        <StatusBadge status={post.status} />
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
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
            rows={9}
            placeholder={t("review.contentPlaceholder")}
            className={`${INPUT_CLS} resize-none leading-relaxed`}
          />
          {primaryLimit && (
            <>
              <div className="mt-1.5 h-1 w-full rounded-full bg-muted/40 overflow-hidden">
                <div
                  className={`h-full transition-all ${over ? "bg-destructive" : pct > 85 ? "bg-amber-400" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <p className={`mt-1 text-[10px] font-mono font-bold tabular-nums ${over ? "text-destructive" : pct > 85 ? "text-amber-400" : "text-muted-foreground"}`}>
                {contentLen.toLocaleString()} / {primaryLimit.caption.toLocaleString()} {t("review.charactersSuffix")}
              </p>
              {over && (
                <p className="mt-0.5 text-[10px] text-destructive font-bold">
                  {t("review.exceedsLimit", { platform: primaryLimit.label, count: (contentLen - primaryLimit.caption).toLocaleString() })}
                </p>
              )}
            </>
          )}
          {platformList.length === 0 && (
            <p className="mt-1.5 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{t("review.noPlatforms")}</p>
          )}
        </div>

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

        {post.reviewedAt && (
          <p className="text-[10px] text-muted-foreground font-bold">
            {t("review.reviewedOn", { time: formatDistanceToNow(parseISO(post.reviewedAt), { addSuffix: true }) })}
          </p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-border shrink-0 gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleApproveAndSchedule}
            disabled={saving}
            className="px-5 py-2 bg-primary hover:opacity-90 disabled:opacity-40 text-primary-foreground text-xs font-black rounded-xl transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            {t("review.approveAndSchedule")}
          </button>
          <button
            onClick={handleSaveChanges}
            disabled={saving}
            className="px-4 py-2 text-xs font-black text-foreground bg-muted hover:bg-muted/70 rounded-xl transition-colors disabled:opacity-40"
          >
            {t("review.saveChanges")}
          </button>
          <button
            onClick={handleSendToDraft}
            disabled={saving}
            className="px-4 py-2 text-xs font-black text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors disabled:opacity-40 flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            {t("review.sendBackToDraft")}
          </button>
        </div>
        <button
          onClick={handleReject}
          disabled={saving}
          className="px-4 py-2 text-xs font-black text-destructive hover:bg-destructive/10 rounded-xl transition-colors disabled:opacity-40 flex items-center gap-1.5"
        >
          <XCircle className="w-3.5 h-3.5" />
          {t("review.reject")}
        </button>
      </div>
    </div>
  );
}

/* ── empty states ────────────────────────────────────────── */

function EmptyState({ icon: Icon, label, spin }: { icon: any; label: string; spin?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center h-full">
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

  const [activeTab, setActiveTab] = useState<TabKey>("needs-review");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  const needsReview = useMemo(() => posts.filter((p) => p.status === "awaiting_review"), [posts]);
  const drafts = useMemo(() => posts.filter((p) => p.status === "draft"), [posts]);
  const scheduled = useMemo(() => posts.filter((p) => p.status === "scheduled"), [posts]);

  const list = useMemo(() => {
    if (activeTab === "needs-review") return needsReview;
    if (activeTab === "drafts") return drafts;
    return scheduled;
  }, [activeTab, needsReview, drafts, scheduled]);

  // Derived, not stored: keeps the detail pane pointed at a real row without
  // an effect. Falls back to the first item whenever the active tab changes
  // or the previously open post falls out of this list (approved/rejected/
  // sent to draft), and re-syncs itself the moment `list` updates.
  const selectedPost = useMemo(() => {
    if (selectedPostId) {
      const found = list.find((p) => p.id === selectedPostId);
      if (found) return found;
    }
    return list[0] ?? null;
  }, [list, selectedPostId]);

  const toggleCheck = (id: string) => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    setCheckedIds((prev) => (prev.size === needsReview.length ? new Set() : new Set(needsReview.map((p) => p.id))));
  };

  const handleBulkApprove = async () => {
    const ids = checkedIds.size > 0 ? Array.from(checkedIds) : needsReview.map((p) => p.id);
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
      setCheckedIds(new Set());
    } catch (err) {
      toast.error(t("review.bulkApproveError", { error: err instanceof Error ? err.message : String(err) }));
    } finally {
      setBulkApproving(false);
    }
  };

  const emptyLabel =
    activeTab === "needs-review" ? t("review.emptyNeedsReview") :
    activeTab === "drafts" ? t("review.emptyDrafts") :
    t("review.emptyScheduled");
  const emptyIcon = activeTab === "needs-review" ? Inbox : activeTab === "drafts" ? FileText : CalendarClock;

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-8rem)] min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between shrink-0 pb-4">
          <h1 className="page-title mb-0">{t("review.title")}</h1>
          {activeTab === "needs-review" && needsReview.length > 0 && (
            <div className="flex items-center gap-2">
              <button
                onClick={toggleSelectAll}
                className="px-4 py-2 text-xs font-black text-foreground bg-muted hover:bg-muted/70 rounded-xl transition-colors flex items-center gap-1.5"
              >
                <ListChecks className="w-3.5 h-3.5" />
                {t("review.selectAll")}
              </button>
              <button
                onClick={handleBulkApprove}
                disabled={bulkApproving}
                className="px-4 py-2 bg-primary hover:opacity-90 disabled:opacity-40 text-primary-foreground text-xs font-black rounded-xl transition-all flex items-center gap-1.5"
              >
                {bulkApproving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {bulkApproving
                  ? t("review.approvingSelected")
                  : checkedIds.size > 0
                    ? t("review.approveSelected", { count: checkedIds.size })
                    : t("review.approveAll")}
              </button>
            </div>
          )}
        </div>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)} className="flex flex-col flex-1 min-h-0">
          <TabsList className="w-fit shrink-0">
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

          {/* Two-pane body: list on the left, editor on the right — always
              visible side by side, no modal popup to open/close. */}
          <div className="flex-1 min-h-0 flex gap-4 mt-4">
            <div className="w-[360px] shrink-0 overflow-y-auto space-y-2 pr-1">
              {isLoading ? (
                <EmptyState icon={Loader2} label={t("review.loadingPosts")} spin />
              ) : list.length === 0 ? (
                <EmptyState icon={emptyIcon} label={emptyLabel} />
              ) : (
                list.map((post) => (
                  <PostRow
                    key={post.id}
                    post={post}
                    active={post.id === selectedPostId}
                    selectable={activeTab === "needs-review"}
                    checked={checkedIds.has(post.id)}
                    onToggleCheck={toggleCheck}
                    onClick={() => setSelectedPostId(post.id)}
                  />
                ))
              )}
            </div>

            <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card overflow-hidden">
              {selectedPost ? (
                <ReviewEditorPane key={selectedPost.id} post={selectedPost} />
              ) : (
                <EmptyState icon={emptyIcon} label={isLoading ? t("review.loadingPosts") : emptyLabel} spin={isLoading} />
              )}
            </div>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
