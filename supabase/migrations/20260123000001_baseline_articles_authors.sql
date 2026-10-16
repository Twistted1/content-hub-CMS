-- `articles` and `authors` are the real, live public content store for
-- novusexchange.com (owner-confirmed; see docs/HEADLESS_CONSUMPTION.md) but,
-- like `project_settings`/`subscribers` before this, were created directly in
-- the Supabase dashboard rather than through a migration. On a fresh/self-hosted
-- project they simply would not exist, which is the last of the "migration set
-- cannot rebuild the database" gaps called out in AGENTS.md and
-- docs/READINESS_GAP_ANALYSIS.md.
--
-- Dated to run early (before the project_settings/subscribers baseline, though
-- the two are independent and ordering between them does not matter), using
-- IF NOT EXISTS throughout so this is a no-op against the existing production
-- database.
--
-- Column shapes, the FK, the index and the RLS policies below were introspected
-- directly from production on 2026-10-16 and match it exactly:
--   - articles.author_id -> authors.id is a real FK (articles_author_id_fkey),
--     not just a loose text match, despite the site's own reader
--     (articleService.ts) doing its own substring matching on author_id for
--     display - see docs/HEADLESS_CONSUMPTION.md for that mismatch.
--   - Both tables have RLS enabled with exactly one policy each: anonymous
--     SELECT. Confirmed separately (see docs/HEADLESS_CONSUMPTION.md's INSERT
--     probe) that anon has no write policy on `articles` - this migration does
--     not add one. Policy creation is guarded with a pg_policies existence
--     check inside a DO block (create-if-missing) rather than DROP IF EXISTS +
--     CREATE: DROP/DELETE statements have repeatedly hung through this
--     project's SQL tooling this session (not a real lock - confirmed via
--     pg_blocking_pids returning nothing - just a tool-level issue), so this
--     migration avoids DROP entirely rather than risk the same hang on a
--     database that already has the table and a differently-shaped policy.

CREATE TABLE IF NOT EXISTS public.authors (
  id text PRIMARY KEY,
  name text NOT NULL,
  avatar_url text,
  bio text
);

ALTER TABLE public.authors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'authors'
      AND policyname = 'Public authors are viewable by everyone'
  ) THEN
    CREATE POLICY "Public authors are viewable by everyone"
      ON public.authors FOR SELECT
      USING (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.articles (
  id serial PRIMARY KEY,
  title text NOT NULL,
  excerpt text,
  content text,
  image_url text,
  category text,
  author_id text REFERENCES public.authors(id),
  created_at timestamptz DEFAULT now(),
  publish_date text,
  read_time integer,
  tags text[],
  date text
);

CREATE INDEX IF NOT EXISTS idx_articles_author_id ON public.articles (author_id);

ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'articles'
      AND policyname = 'Public articles are viewable by everyone'
  ) THEN
    CREATE POLICY "Public articles are viewable by everyone"
      ON public.articles FOR SELECT
      USING (true);
  END IF;
END $$;
