-- `publish_attempted_at` was written as a one-way lock: `publish-due-posts`
-- selected only rows where it was NULL and set it on the way out, and nothing
-- anywhere in the codebase ever cleared it. A single transient failure (a
-- webhook 500, an 8s timeout, an expired OAuth token mid-refresh) removed that
-- post from the publish queue permanently.
--
-- Two things change here:
--
--   1. `publish_attempts` tracks how many times delivery has been tried, and
--      `publish_attempted_at` is reinterpreted as "last attempt time". A row
--      becomes eligible again once an exponential backoff has elapsed.
--   2. `claim_due_posts` performs the claim in one atomic statement using
--      `FOR UPDATE SKIP LOCKED`. The previous select-then-update pair was not
--      atomic, so two overlapping cron ticks could both claim the same post
--      and deliver it twice.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS publish_attempts integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.posts.publish_attempted_at IS
  'Timestamp of the most recent publish attempt. Combined with publish_attempts to space out retries; cleared on success.';
COMMENT ON COLUMN public.posts.publish_attempts IS
  'Number of publish attempts made for this post. Reset to 0 on success; the post is parked as failed once it reaches the retry cap.';

-- Supports the claim query, which filters on status + scheduled_at and then
-- orders by how long a post has been waiting.
CREATE INDEX IF NOT EXISTS idx_posts_publish_retry
  ON public.posts (scheduled_at)
  WHERE status = 'scheduled' AND scheduled_at IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_due_posts(
  p_batch_size integer DEFAULT 50,
  p_base_backoff interval DEFAULT interval '2 minutes',
  p_max_backoff interval DEFAULT interval '60 minutes',
  p_max_attempts integer DEFAULT 5
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  title text,
  content text,
  cover_image_url text,
  publish_attempts integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  WITH claimable AS (
    SELECT p.id
    FROM public.posts p
    WHERE p.status = 'scheduled'
      AND p.scheduled_at IS NOT NULL
      AND p.scheduled_at <= now()
      AND p.publish_attempts < p_max_attempts
      AND (
        p.publish_attempted_at IS NULL
        OR p.publish_attempted_at
           <= now() - least(p_base_backoff * power(2, p.publish_attempts), p_max_backoff)
      )
    ORDER BY p.scheduled_at ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE public.posts target
  SET publish_attempted_at = now(),
      publish_attempts = target.publish_attempts + 1
  FROM claimable
  WHERE target.id = claimable.id
  RETURNING target.id, target.user_id, target.title, target.content,
            target.cover_image_url, target.publish_attempts;
$$;

-- Only the cron path (service role) may drain the publish queue.
REVOKE ALL ON FUNCTION public.claim_due_posts(integer, interval, interval, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_due_posts(integer, interval, interval, integer)
  TO service_role;
