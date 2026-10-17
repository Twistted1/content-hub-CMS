-- Migration to remove hardcoded Lovable infrastructure and set up a portable cron job.
-- This replaces the original migration 20260323155000_b1a79fb4-bc9c-4958-a6f7-585795902f66.sql
--
-- SUPERSEDED by 20260601130235_3886e818-a9ab-4e65-84a5-e2fc8aff223c.sql, which
-- unschedules the 'run-scheduled-pipelines' job below and replaces it with
-- vault-secret-authenticated jobs. Left unedited (a historical record, already
-- applied) even though the key/value `project_settings` shape it queries never
-- matched the real table — see AGENTS.md's "project_settings cron dead code"
-- note. Confirmed via `cron.job` in production: this job does not exist.

-- 1. Remove the hardcoded cron job if it exists
SELECT cron.unschedule('run-scheduled-pipelines');

-- 2. Create a cleaner, more portable trigger function (optional but recommended for observability)
-- We'll stick to a direct net.http_post in the cron for simplicity, but use placeholders.

/* 
  INSTRUCTIONS for the user:
  To finish "freeing" your project, run this SQL command in your Supabase SQL Editor 
  OR set these as database config variables:

  ALTER DATABASE postgres SET app.settings.supabase_url = 'https://your-project.supabase.co';
  ALTER DATABASE postgres SET app.settings.supabase_anon_key = 'your-anon-key';

  The cron job below will then automatically use your actual project details.
*/

-- 3. Schedule the new job (it will only fire correctly once the settings above are configured)
SELECT cron.schedule(
  'run-scheduled-pipelines',
  '*/15 * * * *',
  $$
  DO $inner$
    DECLARE
      project_url text;
      anon_key text;
    BEGIN
      SELECT value INTO project_url FROM public.project_settings WHERE key = 'supabase_url';
      SELECT value INTO anon_key FROM public.project_settings WHERE key = 'supabase_anon_key';

      IF project_url IS NOT NULL AND anon_key IS NOT NULL THEN
        PERFORM net.http_post(
            url := project_url || '/functions/v1/scheduled-pipeline',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || anon_key
            ),
            body := jsonb_build_object('time', now())
        );
      END IF;
    END;
  $inner$
  $$
);
