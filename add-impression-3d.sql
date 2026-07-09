-- ============================================================
-- Migration : pièces imprimées en 3D (production interne)
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

-- 1. Marqueur "pièce imprimée en 3D" (production interne vs achat fournisseur)
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS est_impression_3d BOOLEAN NOT NULL DEFAULT false;

-- 2. Temps d'impression en heures (remplace le délai fournisseur pour les pièces 3D)
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS temps_impression_heures NUMERIC DEFAULT NULL;
