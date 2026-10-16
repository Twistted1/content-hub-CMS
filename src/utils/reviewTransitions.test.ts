import { describe, it, expect } from "vitest";
import {
  approvedForSchedule,
  savedWithoutStatusChange,
  sentBackToDraft,
  rejected,
  bulkApproveTargets,
  type ReviewDraft,
} from "./reviewTransitions";

/**
 * The review inbox's status transitions had no test coverage at all, despite
 * being the only part of that page that writes to the database. These tests pin
 * what each action is allowed to change — in particular that *saving* never
 * approves, and that bulk-approve's whole-queue behaviour is intentional.
 */

const draft: ReviewDraft = {
  title: "Quarterly recap",
  content: "Body text",
  coverImageUrl: "https://example.com/cover.png",
};

const NO_COVER: ReviewDraft = { ...draft, coverImageUrl: null };

describe("approvedForSchedule", () => {
  const now = new Date("2026-10-14T09:00:00.000Z");
  const at = "2026-10-15T08:00:00.000Z";

  it("schedules at the instant it is given and records the review", () => {
    const patch = approvedForSchedule(draft, at, now);
    expect(patch.status).toBe("scheduled");
    expect(patch.scheduled_at).toBe(at);
    expect(patch.reviewed_at).toBe(now.toISOString());
  });

  it("carries the edited content through", () => {
    const patch = approvedForSchedule(draft, at, now);
    expect(patch.title).toBe(draft.title);
    expect(patch.content).toBe(draft.content);
    expect(patch.cover_image_url).toBe(draft.coverImageUrl);
  });

  it("normalises an absent cover image to null, not undefined", () => {
    // `undefined` would be dropped from the JSON body and leave the column
    // untouched, so clearing a cover image would silently not persist.
    expect(approvedForSchedule(NO_COVER, at, now).cover_image_url).toBeNull();
  });

  it("does not reinterpret the instant it is handed", () => {
    // The caller converts local wall clock -> UTC. If this function ever
    // re-parsed or shifted the value, that would reintroduce the timezone bug
    // `localWallClockToUtcIso` exists to prevent.
    const patch = approvedForSchedule(draft, "2026-01-01T00:00:00.000Z", now);
    expect(patch.scheduled_at).toBe("2026-01-01T00:00:00.000Z");
  });
});

describe("savedWithoutStatusChange", () => {
  it("writes no status, schedule or review stamp", () => {
    const patch = savedWithoutStatusChange(draft);
    expect(patch).not.toHaveProperty("status");
    expect(patch).not.toHaveProperty("scheduled_at");
    expect(patch).not.toHaveProperty("reviewed_at");
  });

  it("still persists the editable fields", () => {
    const patch = savedWithoutStatusChange(draft);
    expect(patch.title).toBe(draft.title);
    expect(patch.content).toBe(draft.content);
    expect(patch.cover_image_url).toBe(draft.coverImageUrl);
  });
});

describe("sentBackToDraft", () => {
  it("returns the post to draft", () => {
    expect(sentBackToDraft(draft).status).toBe("draft");
  });

  it("clears scheduled_at rather than leaving a stale future timestamp", () => {
    // A draft carrying a future scheduled_at makes the Calendar show a
    // scheduled post that the scheduler will never deliver.
    const patch = sentBackToDraft(draft);
    expect(patch.scheduled_at).toBeNull();
    expect(patch).toHaveProperty("scheduled_at");
  });

  it("does not stamp reviewed_at", () => {
    expect(sentBackToDraft(draft)).not.toHaveProperty("reviewed_at");
  });
});

describe("rejected", () => {
  const now = new Date("2026-10-14T09:00:00.000Z");

  it("rejects and records that it was reviewed", () => {
    const patch = rejected(draft, now);
    expect(patch.status).toBe("rejected");
    expect(patch.reviewed_at).toBe(now.toISOString());
  });

  it("keeps the shipped asymmetry: reject does not clear scheduled_at", () => {
    // Documented, not endorsed. Pinned so a change is deliberate rather than
    // accidental; a rejected post is never selected by `publish-due-posts`,
    // which filters `status = 'scheduled'`.
    expect(rejected(draft, now)).not.toHaveProperty("scheduled_at");
  });
});

describe("bulkApproveTargets", () => {
  const queue = ["p1", "p2", "p3"];

  it("acts only on the checked rows when something is checked", () => {
    expect(bulkApproveTargets(new Set(["p2"]), queue)).toEqual(["p2"]);
    expect(bulkApproveTargets(["p1", "p3"], queue)).toEqual(["p1", "p3"]);
  });

  it("falls back to the ENTIRE needs-review queue when nothing is checked", () => {
    // Owner-confirmed on 2026-10-14 as intentional ("Approve All"), not a bug.
    // If this assertion is what you are here to change, read the decision note
    // on `bulkApproveTargets` and confirm the intent first.
    expect(bulkApproveTargets(new Set(), queue)).toEqual(queue);
    expect(bulkApproveTargets([], queue)).toEqual(queue);
  });

  it("returns an independent array, so callers cannot mutate the queue", () => {
    const result = bulkApproveTargets(new Set(), queue);
    result.push("injected");
    expect(queue).toEqual(["p1", "p2", "p3"]);
  });

  it("returns nothing for an empty queue", () => {
    expect(bulkApproveTargets(new Set(), [])).toEqual([]);
  });
});
