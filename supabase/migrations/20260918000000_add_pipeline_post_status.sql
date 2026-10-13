-- The content pipeline writes two post_status values that were never added by
-- a migration: `content-pipeline` inserts `awaiting_review` as the AI
-- generation gatekeeper, and the `sync_post_workflow_stage` trigger reads both
-- `awaiting_review` and `generating`. They reached production out-of-band, the
-- same way `rejected` did (see `add_rejected_post_status`).
--
-- Consequence before this fix: replaying the migration history onto a fresh
-- database (local `supabase db reset`, CI, disaster recovery) produced an enum
-- without these values, so every pipeline insert failed with
-- `invalid input value for enum post_status`. This migration closes that gap.
--
-- Each ADD VALUE is its own statement: Postgres forbids using a new enum value
-- in the same transaction that added it.

ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'awaiting_review';
ALTER TYPE public.post_status ADD VALUE IF NOT EXISTS 'generating';
