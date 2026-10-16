-- `project_settings` and `subscribers` were created directly in the Supabase
-- dashboard rather than through a migration, so `supabase db push` against an
-- empty/self-hosted project fails: every later migration that ALTERs or adds
-- policies to these tables (starting 20260323170000) assumes they already
-- exist. This is the missing baseline, so the migration set can rebuild the
-- schema from scratch. Dated before every existing migration so it runs first.
--
-- Column shapes and constraints below were introspected directly from
-- production on 2026-10-16 and match it exactly. RLS is enabled with no
-- policies here (deny-all) — the real policies are layered on by the later
-- migrations that already exist, so creating them here too would conflict
-- with those migrations' own CREATE POLICY statements.
--
-- IF NOT EXISTS throughout makes this a no-op against the existing production
-- database, which already has both tables.

CREATE TABLE IF NOT EXISTS public.project_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  monthly_openai_budget numeric DEFAULT 50.00,
  current_month_spend numeric DEFAULT 0.00,
  last_reset_date timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.project_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.subscribers (
  id serial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;
