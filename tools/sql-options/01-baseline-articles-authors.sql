-- BASELINE: articles + authors — the last two tables no migration creates.
--
-- STATUS: draft. VERIFY THE COLUMN LIST FIRST (see the README in this directory),
-- then move this file into supabase/migrations/ as:
--
--     20260122999999_baseline_articles_authors.sql
--
-- Dated before 20260123000000_baseline_project_settings_subscribers.sql so the
-- two baselines run before everything else. (Nothing in the repository
-- references articles/authors, so ordering is not strictly required here — but
-- keeping baselines first is the convention that makes a fresh replay work.)
--
-- WHY THIS EXISTS
-- `articles` and `authors` were created directly in the Supabase dashboard. No
-- migration creates them, so a self-hosted or freshly-created project has no
-- table for novusexchange.com to read and the site renders empty.
--
-- WHY IT IS NOT ALREADY IN supabase/migrations/
-- The column list below was established by probing the live PostgREST API
-- (a missing column returns 42703, a missing table 404 PGRST205). That proves
-- which columns EXIST; it cannot prove nullability or defaults. Confirm those
-- with the information_schema query in this directory's README before applying
-- this to a fresh project, because a nullable/NOT NULL mismatch between this
-- file and production is a divergence that only shows up later, on the fresh
-- install, as an insert that fails or silently stores a null.
--
-- VERIFIED BY PROBE (2026-10-16):
--   articles HAS: id, title, excerpt, content, image_url, category, author_id,
--                 created_at, publish_date, date, read_time, tags
--   articles LACKS: word_count, featured, subtitle, updated_at, slug
--     -> note the site's own HANDOFF_DOCUMENTATION.md lists word_count and
--        featured, and an `author` JSONB column. None of those exist.
--     -> `date` EXISTS and is absent from types.ts, which is stale.
--   articles.id is INTEGER, not bigint and not uuid
--     (probed: `id=eq.notauuid` returns 22P02 "invalid input syntax for type
--      integer"). The site's handoff doc claims BIGINT PRIMARY KEY — wrong.
--   authors HAS: id, name, bio, avatar_url. It LACKS created_at/updated_at/role.
--   authors.id is TEXT (probed: `id=eq.<uuid>` returns 200, not a type error),
--     which matches the live value 'marcio-novus'.

-- ---------------------------------------------------------------------------
-- ORDER MATTERS: authors first, because articles.author_id references it.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.authors (
  id         text PRIMARY KEY,
  name       text NOT NULL,
  bio        text,
  avatar_url text
);

CREATE TABLE IF NOT EXISTS public.articles (
  -- `serial` per the owner's description of production; the probe confirms the
  -- integer family. If production's id has NO default (ids are supplied
  -- explicitly by whatever writes these rows — the site's browser editor uses
  -- `Prefer: resolution=merge-duplicates`, which implies explicit ids), then a
  -- sequence here is a harmless superset rather than a behaviour change.
  id           serial PRIMARY KEY,
  title        text NOT NULL,
  excerpt      text,
  content      text,
  image_url    text,
  category     text,
  author_id    text REFERENCES public.authors(id),
  created_at   timestamptz DEFAULT now(),
  -- Both text, and duplicated in production: the site renders publish_date and
  -- the schema also carries `date` with the same value in "OCTOBER 11, 2026"
  -- form. Confirmed to exist by probe.
  publish_date text,
  date         text,
  read_time    integer,
  tags         text[]
);

-- ---------------------------------------------------------------------------
-- RLS. This part is NOT optional and is the trap in this task.
--
-- The project_settings/subscribers baseline could create its tables with RLS
-- enabled and NO policies, because later migrations add those policies by name.
-- articles and authors have NO later migrations — nothing in the repository
-- references them at all. So a table-only baseline produces a fresh database
-- where RLS is on and the result is DENY-ALL: the website cannot read a single
-- row and silently renders its bundled fallback dossiers instead.
--
-- These SELECT policies are therefore required, and they match production
-- behaviour: an anonymous read of /rest/v1/articles returns 200 today.
-- ---------------------------------------------------------------------------

ALTER TABLE public.authors  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can read authors" ON public.authors;
CREATE POLICY "Public can read authors"
  ON public.authors FOR SELECT TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Public can read articles" ON public.articles;
CREATE POLICY "Public can read articles"
  ON public.articles FOR SELECT TO anon, authenticated
  USING (true);

-- DELIBERATELY NO insert/update/delete policy for anon or authenticated.
-- Verified: an INSERT as anon returns 42501 "new row violates row-level
-- security policy for table articles", so production is read-only to the
-- browser and this reproduces that. Writes are service-role only
-- (`tools/webhook-receiver/`).
--
-- DO NOT copy the policy from the site's HANDOFF_DOCUMENTATION.md:248-253:
--     FOR ALL USING (true) WITH CHECK (true)
-- That would make this table world-writable, and the site's anon key is
-- hardcoded in articleService.ts:34. Anyone could then deface novusexchange.com.

-- NOTE ON PRODUCTION: this whole file is a no-op there. Both tables exist, so
-- every CREATE TABLE IF NOT EXISTS is skipped. The two CREATE POLICY statements
-- are the exception — they will ADD a second, parallel SELECT policy alongside
-- whatever the dashboard already created. That is not a privilege change (the
-- table is already publicly readable) but it is redundant, so either accept the
-- duplication or run the DROP/CREATE against the existing policy's own name
-- instead. Check with the pg_policies query in the README.
