-- Allow owners/admins to delete their own automation_runs
CREATE POLICY "Users can delete own automation runs"
ON public.automation_runs
FOR DELETE
USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

-- Prevent duplicate / spam newsletter signups for the same email
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_unique_idx
ON public.subscribers (lower(email));