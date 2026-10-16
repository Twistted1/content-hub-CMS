-- Public read of published posts — the safe half, and the decision-gated half.
--
-- PART A is additive and safe to apply at any time.
-- PART B removes a live capability. It is COMMENTED OUT and is a decision, not a
-- fix. Do not enable it without deciding whether the current behaviour is
-- intentional.
--
-- BACKGROUND
-- Any authenticated user can currently read every `published` post across all
-- users. Verified by probe on 2026-10-16:
--   * draft / awaiting_review / scheduled / failed / rejected all return 0 rows
--   * published returns other users' rows
--   * it is NOT privilege escalation: the probe account's user_roles has one row
--     with role 'user', and the admin-only project_settings table returned []
--   * NO migration in the repository creates that policy — both the original
--     (20260126144110:56-58) and the Phase 12 rewrite (20260503150231:8-10) grant
--     owner-or-admin only. So it was added in the dashboard.
-- There is precedent for the pattern: `media` carries a
-- "Public can view published media" policy (20260127204449:29), so this may well
-- have been deliberate. See docs/MASTER_CHECKLIST.md Phase 22.
--
-- Note this does NOT affect novusexchange.com either way: the site reads
-- /rest/v1/articles and never queries posts (verified in its source).

-- ===========================================================================
-- PART A — a safe projection. Apply this regardless of the decision below.
-- ===========================================================================
--
-- WHY A VIEW RATHER THAN ANOTHER POLICY
-- An anonymous request to /rest/v1/posts currently fails hard with
--   401 42501 "permission denied for function has_role"
-- because the policies on `posts` call has_role(), whose EXECUTE was revoked
-- from anon — anon cannot even evaluate them. So "just add a policy" is not
-- available for a public feed. The view sidesteps that by being owned by the
-- migration runner, whose role bypasses RLS on the base table.
--
-- THAT MAKES THE WHERE CLAUSE THE SECURITY BOUNDARY. Two consequences:
--   1. `status = 'published'` is load-bearing. Editing it out exposes drafts.
--   2. Only the columns listed are exposed. Notably NOT user_id, cost_estimate,
--      publish_error, publish_attempts, workflow_*, review_requested_at,
--      reviewed_at or is_ai_generated.
-- `security_barrier` stops the planner pushing a caller-supplied predicate below
-- the view's own filter, which is how a leaky operator could otherwise reveal
-- rows the filter should have excluded.

create or replace view public.public_published_posts
with (security_barrier = true) as
select
  id,
  title,
  excerpt,
  content,
  category,
  cover_image_url,
  tags,
  type,
  published_at
from public.posts
where status = 'published'
  and published_at is not null;

comment on view public.public_published_posts is
  'Public read model for published content. Owned by the migration role, so it bypasses RLS on public.posts by design — the WHERE clause is the security boundary and must stay status = ''published''. Exposed to anon deliberately.';

grant select on public.public_published_posts to anon, authenticated;

-- Verify from outside: should return only published rows, and no user_id.
--   GET /rest/v1/public_published_posts?select=*&order=published_at.desc
-- Confirm the columns are absent:
--   GET /rest/v1/public_published_posts?select=user_id   -> expect 42703

-- ===========================================================================
-- PART B — DECISION REQUIRED. Removes the blanket read on `posts`.
-- ===========================================================================
--
-- If the cross-user read is intentional (a shared editorial team, or a
-- deliberate public feed), do nothing and record the decision.
--
-- If it is NOT intentional, the safest removal is name-agnostic: match on the
-- policy whose qual mentions 'published' rather than guessing its name. Confirm
-- what you are about to drop FIRST:
--
--   select tablename, polname, cmd, roles, qual
--     from pg_policies
--    where schemaname = 'public' and tablename = 'posts'
--    order by cmd, polname;
--
-- Then uncomment. It raises NOTICE for each policy dropped, so the output tells
-- you exactly what happened rather than leaving you guessing:
--
-- do $$
-- declare p record;
-- begin
--   for p in
--     select polname from pg_policies
--      where schemaname = 'public'
--        and tablename  = 'posts'
--        and cmd        = 'SELECT'
--        and qual ilike '%published%'
--   loop
--     execute format('drop policy %I on public.posts', p.polname);
--     raise notice 'dropped permissive SELECT policy on posts: %', p.polname;
--   end loop;
-- end $$;
--
-- WARNING: if the `posts` table also carries some other permissive policy that
-- merely happens to mention 'published' in its qual, this drops that too. That
-- is why the SELECT above is not optional. After dropping, re-run the probe as a
-- throwaway account and confirm published posts owned by other users return 0
-- rows, then confirm your own still work.
--
-- Multi-tenant note: on the hosted-SaaS path this matters more than it looks.
-- It is a cross-tenant content leak that requires no admin rights, so it is
-- broader than the global-super-admin issue already documented in
-- docs/READINESS_GAP_ANALYSIS.md.
