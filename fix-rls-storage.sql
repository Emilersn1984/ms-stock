-- Supprimer les anciennes politiques RLS sur se-photos
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Delete Access" ON storage.objects;

-- Créer les bonnes politiques pour se-photos
CREATE POLICY "se-photos_public_select" ON storage.objects FOR SELECT
USING (bucket_id = 'se-photos');

CREATE POLICY "se-photos_authenticated_insert" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'se-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "se-photos_authenticated_update" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'se-photos' 
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'se-photos' 
  AND auth.role() = 'authenticated'
);

CREATE POLICY "se-photos_authenticated_delete" ON storage.objects FOR DELETE
USING (
  bucket_id = 'se-photos' 
  AND auth.role() = 'authenticated'
);
