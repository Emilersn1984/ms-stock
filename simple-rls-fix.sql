-- Créer les politiques RLS pour le bucket se-photos (sans supprimer les anciennes)
CREATE POLICY "Allow public select on se-photos" ON storage.objects FOR SELECT
USING (bucket_id = 'se-photos');

CREATE POLICY "Allow insert on se-photos" ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'se-photos');

CREATE POLICY "Allow update on se-photos" ON storage.objects FOR UPDATE
USING (bucket_id = 'se-photos');

CREATE POLICY "Allow delete on se-photos" ON storage.objects FOR DELETE
USING (bucket_id = 'se-photos');
