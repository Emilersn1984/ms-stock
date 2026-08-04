-- ============================================================
-- Migration : date d'envoi prévisionnelle sur les expéditions
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS date_envoi_previsionnelle TIMESTAMPTZ DEFAULT NULL;
