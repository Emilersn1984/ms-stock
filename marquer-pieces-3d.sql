-- ============================================================
-- Marque automatiquement comme "impression 3D" toutes les pièces
-- dont la catégorie contient "3d" (insensible à la casse)
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

-- 1. Vérification avant modification — liste les pièces qui seront marquées
SELECT id, nom, categorie, est_impression_3d, temps_impression_heures
FROM pieces
WHERE categorie ILIKE '%3d%';

-- 2. Marquage effectif (décommenter et exécuter après vérification ci-dessus)
-- UPDATE pieces
-- SET est_impression_3d = true
-- WHERE categorie ILIKE '%3d%';
