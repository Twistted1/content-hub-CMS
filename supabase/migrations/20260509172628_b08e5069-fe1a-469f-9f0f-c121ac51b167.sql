-- 1. post_platforms: restrict to authenticated role
DROP POLICY IF EXISTS "Users can view platforms for own posts or admins can view all" ON public.post_platforms;
DROP POLICY IF EXISTS "Users can insert platforms for own posts" ON public.post_platforms;
DROP POLICY IF EXISTS "Users can update platforms for own posts or admins can update a" ON public.post_platforms;
DROP POLICY IF EXISTS "Users can delete platforms for own posts or admins can delete a" ON public.post_platforms;

CREATE POLICY "post_platforms_select_owner_or_admin"
ON public.post_platforms FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_platforms.post_id AND p.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "post_platforms_insert_owner"
ON public.post_platforms FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_platforms.post_id AND p.user_id = auth.uid())
);

CREATE POLICY "post_platforms_update_owner_or_admin"
ON public.post_platforms FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_platforms.post_id AND p.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

CREATE POLICY "post_platforms_delete_owner_or_admin"
ON public.post_platforms FOR DELETE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_platforms.post_id AND p.user_id = auth.uid())
  OR public.has_role(auth.uid(), 'admin'::public.app_role)
);

-- 2. pipeline_runs: add DELETE policy
CREATE POLICY "Users can delete own pipeline runs"
ON public.pipeline_runs FOR DELETE TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

-- 3. subscribers: replace `WITH CHECK (true)` with email validation
DROP POLICY IF EXISTS "Anyone can subscribe to newsletter" ON public.subscribers;
CREATE POLICY "Anyone can subscribe to newsletter"
ON public.subscribers FOR INSERT TO anon, authenticated
WITH CHECK (email IS NOT NULL AND length(email) > 3 AND email LIKE '%@%');