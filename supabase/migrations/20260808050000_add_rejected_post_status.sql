-- Review Inbox needs "Reject" to be a real status distinct from "draft" -
-- the post_status enum had no such value. Applied directly to prod earlier
-- in the same work session as the Review Inbox feature; added here after
-- the fact so the migration history on disk matches what's actually live.
ALTER TYPE post_status ADD VALUE IF NOT EXISTS 'rejected';
