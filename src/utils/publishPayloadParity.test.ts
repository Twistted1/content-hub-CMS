import { describe, it, expect } from "vitest";
import {
  PLATFORM_CAPTION_LIMITS,
  DEFAULT_CAPTION_LIMIT,
  captionLimitFor,
  formatContentForPlatform,
  deliveryIdFor,
  buildDelivery,
} from "../../supabase/functions/_shared/publishDelivery";
import { PLATFORM_LIMITS } from "./platformLimits";

/**
 * The outbound webhook contract is shared by two edge functions and mirrored on
 * the frontend for authoring-time warnings. These tests do three jobs:
 *
 *  1. stop the caption limits drifting between the delivery path and the UI,
 *  2. pin the truncation behaviour (previously nothing truncated at all, so a
 *     long post hard-failed LinkedIn/Instagram and silently lost text on X),
 *  3. lock the *unified* envelope shape, so the two delivery paths cannot drift
 *     back apart — they used to disagree on both the event name and the shape.
 *
 * The shared module is imported directly rather than parsed as text: it has no
 * Deno globals and no remote imports, so the real implementation is exercised.
 */

describe("caption limits match the frontend", () => {
  it("agrees with src/utils/platformLimits.ts for every platform we deliver to", () => {
    for (const [platform, limit] of Object.entries(PLATFORM_CAPTION_LIMITS)) {
      const frontend = PLATFORM_LIMITS[platform];
      expect(frontend, `frontend has no limit for "${platform}"`).toBeDefined();
      expect(frontend.caption, `caption limit drifted for "${platform}"`).toBe(limit);
    }
  });

  it("covers every frontend platform except the x/twitter alias", () => {
    // `x` is a UI alias that `normalizePlatform` rewrites to `twitter` before
    // anything is delivered, so the delivery side does not need its own entry.
    const frontendKeys = Object.keys(PLATFORM_LIMITS).filter((k) => k !== "x");
    for (const key of frontendKeys) {
      expect(PLATFORM_CAPTION_LIMITS[key], `no delivery limit for "${key}"`).toBeDefined();
    }
  });

  it("falls back to a bounded limit for an unknown platform", () => {
    expect(captionLimitFor("myspace")).toBe(DEFAULT_CAPTION_LIMIT);
    expect(DEFAULT_CAPTION_LIMIT).toBeGreaterThan(0);
  });
});

describe("formatContentForPlatform", () => {
  it("returns text that already fits completely untouched", () => {
    const short = "A short post.";
    expect(formatContentForPlatform("twitter", short)).toBe(short);
    expect(formatContentForPlatform("linkedin", short)).toBe(short);
  });

  it("never exceeds the platform limit", () => {
    const long = "word ".repeat(5000);
    for (const platform of Object.keys(PLATFORM_CAPTION_LIMITS)) {
      const out = formatContentForPlatform(platform, long);
      expect(out.length, `${platform} exceeded its limit`).toBeLessThanOrEqual(
        PLATFORM_CAPTION_LIMITS[platform],
      );
    }
  });

  it("marks truncation with an ellipsis so a cut caption is visibly cut", () => {
    const long = Array(500).fill("word").join(" ");
    const out = formatContentForPlatform("twitter", long);
    expect(out.endsWith("…")).toBe(true);
  });

  it("prefers a word boundary", () => {
    const long = Array(500).fill("word").join(" ");
    const out = formatContentForPlatform("twitter", long);
    // Should end mid-list on a completed word, not mid-word.
    expect(out.slice(0, -1).trimEnd().endsWith("word")).toBe(true);
    expect(out).not.toContain("wor…");
  });

  it("hard-cuts rather than returning almost nothing when there are no spaces", () => {
    // A single 10k-character token must still fill the budget, not collapse to
    // an ellipsis because the last space was at index 0.
    const noSpaces = "a".repeat(10000);
    const out = formatContentForPlatform("twitter", noSpaces);
    expect(out.length).toBe(280);
    expect(out.endsWith("…")).toBe(true);
  });

  it("is a no-op at exactly the limit", () => {
    const exact = "b".repeat(280);
    expect(formatContentForPlatform("twitter", exact)).toBe(exact);
  });
});

describe("deliveryIdFor", () => {
  it("is stable across retries of the same post+platform", () => {
    // The whole point: a retry must be recognisable as the same delivery, or a
    // receiver double-publishes.
    expect(deliveryIdFor("post-1", "instagram")).toBe(deliveryIdFor("post-1", "instagram"));
  });

  it("distinguishes different platforms and posts", () => {
    expect(deliveryIdFor("post-1", "instagram")).not.toBe(deliveryIdFor("post-1", "facebook"));
    expect(deliveryIdFor("post-1", "instagram")).not.toBe(deliveryIdFor("post-2", "instagram"));
  });
});

describe("buildDelivery — the unified envelope", () => {
  const input = {
    postId: "post-1",
    platform: "instagram",
    title: "Title",
    content: "Body",
    excerpt: "Excerpt",
    tags: ["a", "b"],
    type: "reel",
    coverImageUrl: "https://example.com/c.png",
    scheduledAt: "2026-10-14T10:00:00.000Z",
  };

  it("uses the single agreed event name", () => {
    // The cron path used to send "post.publish" and the immediate path
    // "post.published". One name, asserted, so they cannot diverge again.
    expect(buildDelivery(input).event).toBe("post.publish");
  });

  it("carries a top-level platform (not a nested platforms array)", () => {
    const d = buildDelivery(input) as Record<string, unknown>;
    expect(d.platform).toBe("instagram");
    expect(d).not.toHaveProperty("platforms");
    expect((d.post as Record<string, unknown>)).not.toHaveProperty("platforms");
  });

  it("includes type, tags, excerpt and scheduledAt", () => {
    const d = buildDelivery(input).post;
    expect(d.type).toBe("reel");
    expect(d.tags).toEqual(["a", "b"]);
    expect(d.excerpt).toBe("Excerpt");
    expect(d.scheduledAt).toBe("2026-10-14T10:00:00.000Z");
  });

  it("defaults type to text and tags to an empty array", () => {
    const d = buildDelivery({ postId: "p", platform: "facebook" }).post;
    expect(d.type).toBe("text");
    expect(d.tags).toEqual([]);
    expect(d.excerpt).toBeNull();
    expect(d.coverImageUrl).toBeNull();
    expect(d.scheduledAt).toBeNull();
  });

  it("joins title and content, and truncates to the platform limit", () => {
    const long = buildDelivery({
      postId: "p",
      platform: "twitter",
      title: "T",
      content: "body ".repeat(1000),
    });
    expect(long.post.content.startsWith("T\n\n")).toBe(true);
    expect(long.post.content.length).toBeLessThanOrEqual(280);
  });

  it("truncates per platform, so the same post differs on X and LinkedIn", () => {
    const content = "word ".repeat(2000);
    const tw = buildDelivery({ postId: "p", platform: "twitter", content });
    const li = buildDelivery({ postId: "p", platform: "linkedin", content });
    expect(tw.post.content.length).toBeLessThanOrEqual(280);
    expect(li.post.content.length).toBeLessThanOrEqual(3000);
    expect(li.post.content.length).toBeGreaterThan(tw.post.content.length);
  });

  it("carries an ISO timestamp", () => {
    // Build once: two calls differ by a millisecond and would flake.
    const { timestamp } = buildDelivery(input);
    expect(new Date(timestamp).toISOString()).toBe(timestamp);
  });
});
