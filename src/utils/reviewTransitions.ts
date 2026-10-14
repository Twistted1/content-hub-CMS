import type { PostStatus } from "@/types";

/**
 * The review-inbox status transitions, as pure functions.
 *
 * They live here rather than inline in `pages/Review.tsx` for two reasons: the
 * transitions are the part of that page that actually writes to the database
 * (the rest is presentation), and one of them — bulk approve — encodes a
 * **deliberate product decision** that a future reader could easily mistake for
 * a bug and "fix". Putting it in a named, tested function is how that decision
 * survives.
 *
 * Behaviour here is extracted verbatim from the handlers that shipped; nothing
 * about what is written changed when it moved.
 */

/** The editable fields the review editor holds for the open post. */
export interface ReviewDraft {
  title: string;
  content: string;
  coverImageUrl: string | null;
}

/** The subset of a `posts` row a review action writes. */
export interface ReviewPatch {
  title: string;
  content: string;
  cover_image_url: string | null;
  status?: PostStatus;
  scheduled_at?: string | null;
  reviewed_at?: string;
}

const fields = (draft: ReviewDraft) => ({
  title: draft.title,
  content: draft.content,
  cover_image_url: draft.coverImageUrl || null,
});

/**
 * Approve and schedule. Requires an already-resolved UTC instant — the caller
 * converts the picker's local wall clock via `localWallClockToUtcIso`, so this
 * function cannot accidentally introduce the timezone bug that utility exists
 * to prevent.
 */
export function approvedForSchedule(
  draft: ReviewDraft,
  scheduledAt: string,
  now: Date = new Date(),
): ReviewPatch {
  return {
    ...fields(draft),
    status: "scheduled",
    scheduled_at: scheduledAt,
    reviewed_at: now.toISOString(),
  };
}

/**
 * Save edits without deciding anything. Deliberately writes no `status`,
 * `scheduled_at` or `reviewed_at`: saving a draft must not approve it.
 */
export function savedWithoutStatusChange(draft: ReviewDraft): ReviewPatch {
  return fields(draft);
}

/**
 * Send back to draft. Clears `scheduled_at` — a draft must not keep a stale
 * future timestamp, which would otherwise make the Calendar and the scheduler
 * disagree about a post that is not scheduled at all.
 */
export function sentBackToDraft(draft: ReviewDraft): ReviewPatch {
  return {
    ...fields(draft),
    status: "draft",
    scheduled_at: null,
  };
}

/**
 * Reject. Stamps `reviewed_at` so the reviewer's action is recorded.
 *
 * Note the asymmetry with `sentBackToDraft`: this leaves `scheduled_at` as it
 * was. That is the shipped behaviour, preserved rather than changed here — a
 * rejected post is not selected by `publish-due-posts` (which filters
 * `status = 'scheduled'`), so it is inert either way.
 */
export function rejected(draft: ReviewDraft, now: Date = new Date()): ReviewPatch {
  return {
    ...fields(draft),
    status: "rejected",
    reviewed_at: now.toISOString(),
  };
}

/**
 * Which posts a bulk approve should act on.
 *
 * **This is a deliberate product decision, confirmed by the product owner on
 * 2026-10-14, not an oversight.** With nothing checked, it returns the entire
 * needs-review queue — and the button is labelled "Approve All" in that state
 * (`pages/Review.tsx`), so the blast radius is stated on the control itself.
 * With anything checked it acts only on the checked rows.
 *
 * It is spelled out here, and pinned by `reviewTransitions.test.ts`, so that
 * nobody later "fixes" it into requiring a selection without that being a
 * conscious choice. If you are reading this because you are about to change it:
 * confirm the intent first — the current behaviour is intended.
 */
export function bulkApproveTargets(
  checkedIds: Iterable<string>,
  needsReviewIds: readonly string[],
): string[] {
  const checked = Array.from(checkedIds);
  return checked.length > 0 ? checked : [...needsReviewIds];
}
