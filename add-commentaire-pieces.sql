-- ============================================================
-- Migration : commentaire persistant sur les pièces
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

-- Note libre conservée sur la pièce, modifiable depuis le pop-up
-- de modification de stock. Distincte du commentaire des opérations,
-- qui reste la trace ponctuelle d'une modification dans l'historique.
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS commentaire TEXT DEFAULT NULL;
