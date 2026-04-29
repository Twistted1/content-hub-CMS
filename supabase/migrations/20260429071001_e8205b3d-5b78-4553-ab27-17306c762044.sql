-- Schedule the run-scheduled-automations edge function every 15 minutes
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