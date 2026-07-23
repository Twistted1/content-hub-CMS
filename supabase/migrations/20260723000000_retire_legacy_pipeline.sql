-- Retire the legacy content pipeline.
--
-- Root cause: the "Activate Weekly Schedule" button (src/pages/Automation.tsx)
-- upserts a single `automations` row with trigger='scheduled', status='active'.
-- Both `schedule-from-templates` (the current, correct pipeline — reads the
-- per-platform JSON schedule source of truth in src/data/platforms/*.json)
-- and the legacy `scheduled-pipeline` function query that exact same row.
-- Since `legacy-pipeline` (this cron job) fires every 15 minutes in parallel
-- with `schedule-content`, every user who activates weekly automation gets
-- TWO pipelines generating posts into awaiting_review: the correct one, and
-- a second batch from `scheduled-pipeline`, which uses the automation's
-- free-text `description` field as the OpenAI generation topic — producing
-- garbage duplicate content and burning OpenAI budget for no reason.
--
-- Fix: unschedule the legacy cron job. The `scheduled-pipeline` edge function
-- itself is removed from the repo in this same change (no longer deployed).

SELECT cron.unschedule('legacy-pipeline');
