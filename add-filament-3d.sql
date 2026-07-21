-- ============================================================
-- Migration : suivi du filament PETG consommé par les pièces
-- imprimées en 3D
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

-- 1. On remplace le "temps d'impression (heures)" par une masse de
--    plastique en grammes, nécessaire pour imprimer 1 unité de la pièce.
ALTER TABLE pieces RENAME COLUMN temps_impression_heures TO masse_filament_grammes;

-- 2. Marqueur "cette pièce est un stock de filament 3D" (ex: PETG).
--    Une pièce marquée ainsi voit son stock automatiquement décrémenté
--    à chaque fois qu'une pièce imprimée en 3D est réapprovisionnée.
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS est_filament_3d BOOLEAN NOT NULL DEFAULT false;

-- 3. Marquer la pièce "PETG plastique 3d" comme stock de filament.
--    Adaptez le nom ci-dessous si besoin avant d'exécuter.
UPDATE pieces
SET est_filament_3d = true
WHERE nom ILIKE '%petg%';

-- 4. Vérification
SELECT id, nom, quantite, seuil_rouge, seuil_jaune, seuil_vert, est_filament_3d
FROM pieces
WHERE est_filament_3d = true;
