-- Schedule the run-scheduled-automations edge function every 15 minutes
--
-- SUPERSEDED by 20260601130235_3886e818-a9ab-4e65-84a5-e2fc8aff223c.sql, which
-- unschedules the 'run-scheduled-automations' job below and replaces it with
-- vault-secret-authenticated jobs. Left unedited (a historical record, already
-- applied) even though the wide-column `project_settings` shape it queries
-- (`config.supabase_url`/`config.supabase_anon_key`) never matched the real
-- table — see AGENTS.md's "project_settings cron dead code" note. Confirmed
-- via `cron.job` in production: this job does not exist.
SELECT cron.schedule(
  'run-scheduled-automations',
  '*/15 * * * *',
  $inner$
  DO $body$
    DECLARE
      config record;
    BEGIN
      SELECT * INTO config FROM public.project_settings LIMIT 1;
      IF config.supabase_url IS NOT NULL AND config.supabase_anon_key IS NOT NULL THEN
        PERFORM net.http_post(
            url := config.supabase_url || '/functions/v1/run-scheduled-automations',
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || config.supabase_anon_key
            ),
            body := jsonb_build_object('time', now())
        );
      END IF;
    END;
  $body$;
  $inner$
);