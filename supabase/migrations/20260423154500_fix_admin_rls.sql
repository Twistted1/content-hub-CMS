
-- Fix RLS policies for posts to allow admins to insert for other users
DROP POLICY IF EXISTS "Users can insert own posts" ON public.posts;
CREATE POLICY "Users can insert own posts or admins can insert for all"
ON public.posts FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Fix RLS policies for media to allow admins to insert for other users
DROP POLICY IF EXISTS "Users can insert own media" ON public.media;
CREATE POLICY "Users can insert own media or admins can insert for all"
ON public.media FOR INSERT
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Fix RLS policies for post_platforms to allow admins to insert for other users' posts
DROP POLICY IF EXISTS "Users can insert platforms for own posts" ON public.post_platforms;
CREATE POLICY "Users can insert platforms for own posts or admins can insert for all"
ON public.post_platforms FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.posts 
    WHERE posts.id = post_platforms.post_id 
    AND (posts.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  )
);
