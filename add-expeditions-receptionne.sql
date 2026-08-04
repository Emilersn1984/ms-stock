-- ============================================================
-- Migration : ajout du statut "receptionne" pour les expéditions
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

ALTER TABLE expeditions
  DROP CONSTRAINT IF EXISTS expeditions_statut_check;

ALTER TABLE expeditions
  ADD CONSTRAINT expeditions_statut_check
  CHECK (statut IN ('a_expedier', 'envoye', 'receptionne'));

ALTER TABLE expeditions
  ADD COLUMN IF NOT EXISTS date_reception TIMESTAMPTZ;
