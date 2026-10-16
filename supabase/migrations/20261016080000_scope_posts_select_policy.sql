-- Phase 22 found that any authenticated user could read every OTHER user's
-- published posts, via a "status = 'published'" clause in posts's own SELECT
-- policy (role: public, name: "Users can view own posts, admins, or published
-- posts"). Owner decision (2026-10-16): this is a leak, not intended behaviour
-- - tighten it. A separate narrow read surface already exists for any future
-- public-read need (public_published_posts, see
-- 20261016070000_add_public_published_posts_view.sql); this migration does
-- not replace that, it just removes the cross-user hole in the base table's
-- own policy.
--
-- src/hooks/usePosts.ts's main posts query has no user_id filter at all - it
-- relies entirely on this policy. Its old comment described wanting a shared
-- "Global Master Calendar" for every signed-in user; the owner confirmed that
-- is not the intent and chose the scoped behaviour instead (own posts, any
-- status, plus admins seeing everything) - see that file's updated comment.
--
-- The drifted name only ever existed in production (a dashboard edit) - no
-- migration creates it. A fresh/self-hosted database already has the correct
-- policy under its original name and definition, from
-- 20260503150231_e2b46aab-92bf-455e-a957-8dc01f0a2d5d.sql. So this migration
-- is guarded: it only acts if the drifted name is actually present, and is a
-- true no-op everywhere else (including a from-scratch migration run).
--
-- Uses ALTER POLICY rather than DROP + CREATE, consistent with every other
-- policy change in this session: DROP/DELETE statements have repeatedly hung
-- through this project's SQL tooling (not a real lock - pg_blocking_pids
-- confirmed empty - just a tool-level issue), so this migration avoids DROP
-- entirely.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'posts'
      AND policyname = 'Users can view own posts, admins, or published posts'
  ) THEN
    ALTER POLICY "Users can view own posts, admins, or published posts" ON public.posts
      TO authenticated
      USING (
        (select auth.uid()) = user_id OR has_role((select auth.uid()), 'admin'::app_role)
      );

    ALTER POLICY "Users can view own posts, admins, or published posts" ON public.posts
      RENAME TO "Users can view own posts or admins view all";
  END IF;
END $$;
