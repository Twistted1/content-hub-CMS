-- Harden the public read view against predicate pushdown.
--
-- `public_published_posts` (added in 20261016070000) is owned by the migration
-- role, which bypasses RLS on `posts`. Its `where status = 'published'` is
-- therefore the *security boundary*, not a convenience filter — that is
-- deliberate and correct, and this migration does not change it.
--
-- The gap this closes is subtler. Without `security_barrier`, the planner is free
-- to evaluate a caller-supplied predicate BEFORE the view's own filter, because
-- from the planner's point of view they are just two conditions that can be
-- reordered. For a view whose WHERE clause is doing security work, that
-- reordering is a leak: a "leaky" operator (one that can raise an error, or whose
-- cost differs depending on the row) can reveal facts about rows the filter was
-- supposed to hide. Postgres documents `security_barrier` for exactly this case.
--
-- Concretely, an anon caller could probe `?id=eq.<uuid>` and learn from error
-- behaviour or timing whether a row exists that is NOT published — something the
-- view is meant to make indistinguishable from "no such row".
--
-- Nothing consumes this view yet, so nothing is broken today. This is cheap
-- insurance taken before something does.
--
-- ALTER VIEW rather than CREATE OR REPLACE: it changes only the view's options,
-- leaves the definition and grants untouched, and cannot accidentally drop the
-- column list or the `status = 'published'` filter. Consistent with this
-- project's preference for ALTER over DROP+CREATE (DROP statements have
-- repeatedly hung in its SQL tooling).
--
-- Guarded so it is a true no-op if the view is ever absent, rather than failing
-- the whole migration run.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'public_published_posts'
      AND c.relkind = 'v'
  ) THEN
    ALTER VIEW public.public_published_posts SET (security_barrier = true);
    RAISE NOTICE 'security_barrier enabled on public.public_published_posts';
  ELSE
    RAISE NOTICE 'public.public_published_posts not present; nothing to do';
  END IF;
END $$;

-- Verify (expect security_barrier=true among the options):
--   select c.relname, c.reloptions
--     from pg_class c join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and c.relname = 'public_published_posts';
--
-- Then re-confirm from outside that the boundary still holds:
--   GET /rest/v1/public_published_posts?select=*          -> only published rows
--   GET /rest/v1/public_published_posts?select=user_id    -> 42703, no such column
