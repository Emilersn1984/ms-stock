-- ============================================================
-- Ajout de la policy DELETE sur la table clients
-- (nécessaire pour le bouton "Supprimer" dans la modale Clients)
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

DROP POLICY IF EXISTS "Suppression clients" ON clients;
CREATE POLICY "Suppression clients" ON clients
  FOR DELETE TO anon, authenticated USING (true);

GRANT DELETE ON clients TO anon, authenticated;
