-- Users page "Activate"/"Deactivate" wrote nowhere: profiles had no status
-- column, so the toggle was pure UI state that reverted on every reload.
-- RLS on profiles already lets admins UPDATE rows they don't own
-- ("Users can update own profile or admins can update all"), so once this
-- column exists the existing admin-write path just works.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_status_check CHECK (status IN ('active', 'inactive'));
