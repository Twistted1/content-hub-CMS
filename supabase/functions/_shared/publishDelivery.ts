/**
 * The single definition of the outbound webhook delivery contract.
 *
 * Shared by both delivery paths so they cannot drift:
 *   - `publish-due-posts`   — the scheduled/cron path (what the Calendar uses)
 *   - `content-pipeline`    — the immediate "publish via webhooks" path
 *
 * Both are Deno edge functions, so a relative import works and there is no
 * bundler boundary to cross. This replaces two payloads that disagreed in both
 * the event name (`post.publish` vs `post.published`) and the shape (top-level
 * `platform` vs nested `platforms`), which meant a receiver written against one
 * silently mishandled the other.
 *
 * `src/utils/platformLimits.test`-style parity is asserted by
 * `src/utils/publishPayloadParity.test.ts`, which compares the caption limits
 * below against the frontend's `src/utils/platformLimits.ts`. The frontend copy
 * exists for authoring-time UI warnings and cannot be imported here.
 */

/** Per-platform caption limits. Values are the published limits for each API. */
export const PLATFORM_CAPTION_LIMITS: Record<string, number> = {
  twitter: 280,
  instagram: 2200,
  facebook: 63206,
  linkedin: 3000,
  tiktok: 2200,
  youtube: 5000,
  threads: 500,
  rumble: 5000,
  website: 100000,
  podcast: 4000,
};

/** Conservative fallback, so an unlisted platform still cannot send unbounded text. */
export const DEFAULT_CAPTION_LIMIT = 2200;

export function captionLimitFor(platform: string): number {
  return PLATFORM_CAPTION_LIMITS[platform] ?? DEFAULT_CAPTION_LIMIT;
}

/**
 * Truncate to the platform's caption limit, preferring a word boundary and
 * appending an ellipsis so a shortened caption reads as shortened rather than
 * looking complete. Text that already fits is returned untouched.
 *
 * This exists because nothing downstream truncates: an over-length post is
 * rejected by the platform's own API, which burns every retry and parks the post
 * as `failed` with a confusing provider error. LinkedIn (3000) and Instagram
 * (2200) both hard-fail a long generated article.
 */
export function formatContentForPlatform(platform: string, text: string): string {
  const limit = captionLimitFor(platform);
  if (text.length <= limit) return text;

  const ellipsis = "…";
  const room = limit - ellipsis.length;
  const clipped = text.slice(0, room);
  const lastBreak = clipped.lastIndexOf(" ");
  // Honour the word boundary only if it does not throw away most of the room.
  const body = lastBreak > room * 0.6 ? clipped.slice(0, lastBreak) : clipped;
  return body.trimEnd() + ellipsis;
}

/**
 * A stable idempotency key for one (post, platform) delivery.
 *
 * Deliberately *not* random: a retry of the same logical delivery must carry the
 * same key, or a receiver cannot distinguish a retry from a second post and will
 * double-publish. A post row becomes terminal (`published`) on success, so the
 * only repeat deliveries for a given pair are genuine retries.
 */
export function deliveryIdFor(postId: string, platform: string): string {
  return `${postId}:${platform}`;
}

/** The fields a caller must supply to build a delivery. */
export interface DeliveryInput {
  postId: string;
  platform: string;
  title?: string | null;
  /** Full, untruncated body. Truncation happens inside `buildDelivery`. */
  content?: string | null;
  excerpt?: string | null;
  tags?: string[] | null;
  /** Content type: post | reel | story | article | video | podcast | newsletter | thread. */
  type?: string | null;
  coverImageUrl?: string | null;
  scheduledAt?: string | null;
}

/** The exact JSON body POSTed to a `webhook_configs.url`. */
export interface DeliveryPayload {
  event: "post.publish";
  delivery_id: string;
  platform: string;
  post: {
    id: string;
    title: string | null;
    content: string;
    excerpt: string | null;
    tags: string[];
    type: string;
    coverImageUrl: string | null;
    scheduledAt: string | null;
  };
  timestamp: string;
}

/**
 * Build one delivery for one platform.
 *
 * `type` is included because Instagram cannot publish text-only at all and needs
 * to know whether a delivery is a feed post, a Reel or a story; without it a
 * receiver has to guess.
 */
export function buildDelivery(input: DeliveryInput): DeliveryPayload {
  const fullText = [input.title, input.content].filter(Boolean).join("\n\n");
  return {
    event: "post.publish",
    delivery_id: deliveryIdFor(input.postId, input.platform),
    platform: input.platform,
    post: {
      id: input.postId,
      title: input.title ?? null,
      content: formatContentForPlatform(input.platform, fullText),
      excerpt: input.excerpt ?? null,
      tags: input.tags ?? [],
      type: input.type || "text",
      coverImageUrl: input.coverImageUrl ?? null,
      scheduledAt: input.scheduledAt ?? null,
    },
    timestamp: new Date().toISOString(),
  };
}
