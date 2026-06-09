
-- 1) Add admin override to media bucket UPDATE policy to match the rest of the access model
DROP POLICY IF EXISTS "Users can update their own media files" ON storage.objects;
CREATE POLICY "Users can update their own media files"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'media'
  AND (
    (auth.uid())::text = (storage.foldername(name))[1]
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
);

-- 2) Pin search_path on update_updated_at_column to fix mutable search_path warning
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
