-- Drop overly permissive policy on automation_runs
DROP POLICY IF EXISTS "Enable authenticated access for automation" ON public.automation_runs;

-- Drop redundant permissive 'Admin Master Access' on posts (was applied to public role)
-- Replace with explicit user/admin policies (per command) to avoid public-role overreach
DROP POLICY IF EXISTS "Admin Master Access" ON public.posts;

CREATE POLICY "Users can view own posts or admins view all"
ON public.posts FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can insert own posts"
ON public.posts FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts or admins update all"
ON public.posts FOR UPDATE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can delete own posts or admins delete all"
ON public.posts FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- Remove credential columns from project_settings (should live in env secrets)
ALTER TABLE public.project_settings DROP COLUMN IF EXISTS supabase_url;
ALTER TABLE public.project_settings DROP COLUMN IF EXISTS supabase_anon_key;

-- Add admin-only SELECT policy on newsletter subscribers
CREATE POLICY "Only admins can view subscribers"
ON public.subscribers FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));