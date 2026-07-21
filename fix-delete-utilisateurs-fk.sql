-- ============================================================
-- Correction de l'erreur 409 (Conflict) lors de la suppression
-- d'un utilisateur dans Login.
-- Cause : les tables "productions" et "commandes" référencent
-- utilisateurs(id) sans ON DELETE, donc Postgres bloque toute
-- suppression d'un utilisateur ayant déjà une production ou
-- une commande enregistrée.
-- Fix : passer ces FK en ON DELETE SET NULL pour conserver
-- l'historique (productions/commandes jamais supprimées) tout
-- en autorisant la suppression du membre.
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

ALTER TABLE productions
  DROP CONSTRAINT IF EXISTS productions_utilisateur_id_fkey;
ALTER TABLE productions
  ADD CONSTRAINT productions_utilisateur_id_fkey
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL;

ALTER TABLE commandes
  DROP CONSTRAINT IF EXISTS commandes_utilisateur_id_fkey;
ALTER TABLE commandes
  ADD CONSTRAINT commandes_utilisateur_id_fkey
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL;
