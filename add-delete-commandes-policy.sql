-- ============================================================
-- Ajout de la policy DELETE sur la table commandes
-- (nécessaire pour le bouton "Supprimer" dans Commandes en cours)
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

DROP POLICY IF EXISTS "Suppression commandes" ON commandes;
CREATE POLICY "Suppression commandes" ON commandes
  FOR DELETE TO anon, authenticated USING (true);

GRANT DELETE ON commandes TO anon, authenticated;
