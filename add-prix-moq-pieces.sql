-- ============================================================
-- Migration : prix unitaire et MOQ sur les pièces
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- Rejouable sans risque.
-- ============================================================

-- Prix d'achat unitaire en euros HT.
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS prix_unitaire NUMERIC(10,2) DEFAULT NULL;

-- MOQ : quantité minimale de commande imposée par le fournisseur.
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS moq INTEGER DEFAULT NULL;
