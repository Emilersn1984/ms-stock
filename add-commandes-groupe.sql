-- ============================================================
-- Migration : commande multi-références
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- Rejouable sans risque.
-- ============================================================

-- Une commande peut porter sur plusieurs références. Chaque référence reste
-- une ligne de `commandes` (la réception se fait pièce par pièce), mais les
-- lignes d'une même commande partagent un groupe_id.
-- Le montant payé n'est porté que par la première ligne du groupe, pour que
-- les totaux restent justes en sommant simplement la colonne.
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS groupe_id UUID;

CREATE INDEX IF NOT EXISTS idx_commandes_groupe ON commandes(groupe_id);
