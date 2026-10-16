-- "Part A" from docs/HEADLESS_CONSUMPTION.md's Option A: a narrow, explicit
-- read surface for published content, so a future headless consumer (or an
-- anon probe) never has to go anywhere near the `posts` table directly.
--
-- This is deliberately NOT a fix for the Phase 22 finding (any authenticated
-- user can read every OTHER user's published post, via the "status =
-- 'published'" clause in `posts`'s own SELECT policy) - that policy still
-- exists after this migration runs. Whether that policy is intentional
-- (serving a future public-read use case) or a leak to tighten is the
-- owner's call, recorded as open in docs/MASTER_CHECKLIST.md Phase 22. This
-- view is additive and safe regardless of that decision: nothing currently
-- queries it, so creating it changes no live behaviour, and once something
-- does consume it, that caller no longer needs the permissive table-level
-- policy to exist at all.
--
-- Column list is allow-listed, not `select *`: excludes `user_id` (so a
-- reader can never correlate posts back to accounts) and every
-- review/workflow-internal column (workflow_step, workflow_stage,
-- review_requested_at, reviewed_at, approved_at, cost_estimate,
-- publish_attempts, publish_attempted_at, publish_error, automation_id,
-- pipeline_run_id) - none of that belongs in a public read surface.
--
-- The view's own `postgres`-owned definition bypasses `posts`'s RLS (the
-- usual Supabase/Postgres behaviour for a superuser-or-BYPASSRLS view
-- owner), so the `where status = 'published'` below is the real gate, not a
-- convenience - the view does not and must not rely on the base table's RLS
-- policy to be correct.
create or replace view public.public_published_posts as
select
  id,
  title,
  excerpt,
  content,
  category,
  read_time,
  tags,
  cover_image_url,
  type,
  published_at
from public.posts
where status = 'published';

comment on view public.public_published_posts is
  'Narrow, explicit read surface for published posts only. Allow-listed columns (no user_id, no review/workflow-internal fields). Does not rely on posts'' own RLS policy - filters status = ''published'' explicitly. See docs/HEADLESS_CONSUMPTION.md Option A.';

grant select on public.public_published_posts to anon, authenticated;
