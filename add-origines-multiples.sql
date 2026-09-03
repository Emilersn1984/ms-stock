-- ============================================================
-- Migration : origines multiples + CA TTC réalisé
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- Rejouable sans risque.
-- ============================================================

-- 1. Une vente peut avoir plusieurs origines (Web + B2B, par exemple).
--    L'ancienne colonne origine_vente est conservée mais n'est plus lue.
ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS origines_vente TEXT[];

UPDATE expeditions
SET origines_vente = ARRAY[origine_vente]
WHERE origine_vente IS NOT NULL AND origines_vente IS NULL;

-- 2. Chiffre d'affaires TTC réalisé sur le mois, affiché dans le bandeau
--    des projections. NULL = valeur calculée (CA HT du mois x 1,2) ;
--    une valeur saisie prend le pas sur le calcul.
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS ca_ttc_realise NUMERIC(12,2);
