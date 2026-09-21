-- Scheduled the legacy `scheduled-pipeline` function every 15 minutes.
--
-- NOTE: this migration originally embedded a live production anon JWT in the
-- job body and a hardcoded project URL. That credential is committed to git
-- history and must be treated as compromised; it has been replaced with the
-- Vault-backed `x-cron-secret` pattern used by every other job. The legacy
-- function was later retired (see `retire_legacy_pipeline`), so the job is
-- unscheduled here as well.
--
-- History is left intact on purpose: a migration that rewrites what a past
-- migration did would desynchronise environments that already ran it.

SELECT cron.unschedule('run-scheduled-pipelines')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'run-scheduled-pipelines');
