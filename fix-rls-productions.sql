-- ============================================================
-- Fix RLS sur la table productions
-- Cause du bug : l'appli utilise une authentification custom
-- (table utilisateurs), pas supabase.auth. Les requêtes passent
-- donc par le rôle "anon", jamais "authenticated". Les policies
-- précédentes (TO authenticated) bloquaient silencieusement
-- l'insertion des productions -> "Production / semaine" restait à 0.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- ============================================================

DROP POLICY IF EXISTS "Lecture productions" ON productions;
CREATE POLICY "Lecture productions" ON productions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Ecriture productions" ON productions;
CREATE POLICY "Ecriture productions" ON productions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

-- Erreur 401 = il manque aussi le GRANT de base sur la table
-- (les policies RLS seules ne suffisent pas si le rôle n'a pas
-- le droit d'accès à la table).
GRANT SELECT, INSERT ON productions TO anon, authenticated;
