
-- 1. Remove dangerous "Global Admin View" on posts
DROP POLICY IF EXISTS "Global Admin View" ON public.posts;

-- 2. Storage policies for post-images bucket (owner-scoped writes, public read)
DROP POLICY IF EXISTS "Public can view post-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own folder in post-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own files in post-images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files in post-images" ON storage.objects;

CREATE POLICY "Public can view post-images"
ON storage.objects FOR SELECT
USING (bucket_id = 'post-images');

CREATE POLICY "Users can upload to own folder in post-images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'post-images'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update own files in post-images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'post-images'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Users can delete own files in post-images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'post-images'
  AND (auth.uid()::text = (storage.foldername(name))[1] OR public.has_role(auth.uid(), 'admin'::app_role))
);

-- 3. Lock down SECURITY DEFINER function execution from the API
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
-- Keep authenticated EXECUTE on has_role since RLS policies invoke it as the calling user
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
