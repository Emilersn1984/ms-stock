-- ============================================================
-- Migration : mois de départ des projections
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- Rejouable sans risque.
-- ============================================================

-- Premier des 3 mois affichés dans la page Projections. Avancé d'un mois
-- à chaque clic sur « Passer au mois suivant », jamais automatiquement.
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS projections_mois_debut DATE;

UPDATE parametres
SET projections_mois_debut = date_trunc('month', CURRENT_DATE)::date
WHERE id = 1 AND projections_mois_debut IS NULL;
