-- ============================================================
-- Migration : montant payé sur les achats de matières premières
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- Rejouable sans risque.
-- ============================================================

-- Montant dépensé pour la commande, en euros HT.
ALTER TABLE commandes ADD COLUMN IF NOT EXISTS montant_paye NUMERIC(10,2) DEFAULT NULL;
