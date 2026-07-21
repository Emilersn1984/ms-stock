-- ============================================================
-- Ajout de la policy DELETE sur la table utilisateurs
-- (nécessaire pour que la suppression d'un membre dans Login
-- soit réellement persistée en base, et pas seulement en local)
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

DROP POLICY IF EXISTS "Suppression utilisateurs" ON utilisateurs;
CREATE POLICY "Suppression utilisateurs" ON utilisateurs
  FOR DELETE TO anon, authenticated USING (true);

GRANT DELETE ON utilisateurs TO anon, authenticated;
