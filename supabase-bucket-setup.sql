-- Créer le bucket pour les photos des sous-ensembles
INSERT INTO storage.buckets (id, name, public)
VALUES ('se-photos', 'se-photos', true);

-- Donner les permissions d'accès au bucket
-- Politique pour les utilisateurs authentifiés (SELECT)
CREATE POLICY "Public Access" ON storage.objects FOR SELECT
USING (bucket_id = 'se-photos');

-- Politique pour les utilisateurs authentifiés (INSERT)
CREATE POLICY "Upload Access" ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'se-photos' 
  AND auth.role() = 'authenticated'
);

-- Politique pour les utilisateurs authentifiés (UPDATE)
CREATE POLICY "Update Access" ON storage.objects FOR UPDATE
USING (
  bucket_id = 'se-photos' 
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'se-photos' 
  AND auth.role() = 'authenticated'
);

-- Politique pour les utilisateurs authentifiés (DELETE)
CREATE POLICY "Delete Access" ON storage.objects FOR DELETE
USING (
  bucket_id = 'se-photos' 
  AND auth.role() = 'authenticated'
);
