-- ============================================================
-- Migration : plusieurs numéros de série par expédition
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- Rejouable sans risque.
-- ============================================================

-- Une expédition peut contenir plusieurs bouées, donc plusieurs numéros de série.
-- L'ancienne colonne numero_serie est conservée et tenue à jour avec le premier
-- numéro, pour les lignes anciennes et les filtres existants.
ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS numeros_serie TEXT[];

UPDATE expeditions
SET numeros_serie = ARRAY[numero_serie]
WHERE numero_serie IS NOT NULL AND numeros_serie IS NULL;
