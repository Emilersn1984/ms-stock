-- D'abord, vérifions les politiques existantes
SELECT * FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';

-- Supprimons TOUTES les politiques sur storage.objects pour repartir à zéro
DROP POLICY IF EXISTS "se-photos_public_select" ON storage.objects;
DROP POLICY IF EXISTS "se-photos_authenticated_insert" ON storage.objects;
DROP POLICY IF EXISTS "se-photos_authenticated_update" ON storage.objects;
DROP POLICY IF EXISTS "se-photos_authenticated_delete" ON storage.objects;
DROP POLICY IF EXISTS "Public Access" ON storage.objects;
DROP POLICY IF EXISTS "Upload Access" ON storage.objects;
DROP POLICY IF EXISTS "Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Delete Access" ON storage.objects;

-- Désactivons temporairement RLS sur storage.objects pour tester
ALTER TABLE storage.objects DISABLE ROW LEVEL SECURITY;

-- Si ça fonctionne, nous réactiverons RLS avec les bonnes politiques plus tard
