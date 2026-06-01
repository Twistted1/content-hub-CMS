-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Vault secret for cron authentication
DO $$
DECLARE
  existing uuid;
BEGIN
  SELECT id INTO existing FROM vault.secrets WHERE name = 'cron_secret';
  IF existing IS NULL THEN
    PERFORM vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'cron_secret');
  END IF;
END $$;

-- 3. Helper for edge functions to read the secret (callable only with service_role)
CREATE OR REPLACE FUNCTION public.get_cron_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.get_cron_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_cron_secret() TO service_role;

-- 4. Remove old/broken jobs (safe if missing)
DO $$
DECLARE j record;
BEGIN
  FOR j IN SELECT jobid FROM cron.job WHERE jobname IN (
    'execute-automation-1min',
    'run-scheduled-automations',
    'run-scheduled-pipelines',
    'schedule-content',
    'publish-due-posts',
    'legacy-pipeline'
  ) LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- 5. Schedule new jobs.
-- Each one reads the cron_secret from vault at run time and posts it as `x-cron-secret`.
SELECT cron.schedule(
  'schedule-content',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://jvbucspwcjahqpoxskvr.supabase.co/functions/v1/schedule-from-templates',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := jsonb_build_object('source', 'pg_cron', 'time', now())
  );
  $cron$
);

SELECT cron.schedule(
  'publish-due-posts',
  '* * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://jvbucspwcjahqpoxskvr.supabase.co/functions/v1/publish-due-posts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := jsonb_build_object('source', 'pg_cron', 'time', now())
  );
  $cron$
);

SELECT cron.schedule(
  'legacy-pipeline',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://jvbucspwcjahqpoxskvr.supabase.co/functions/v1/scheduled-pipeline',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'cron_secret' LIMIT 1)
    ),
    body := jsonb_build_object('source', 'pg_cron', 'time', now())
  );
  $cron$
);