-- ============================================================
-- Migration : produits vendus, facture émise, fournisseur des pièces
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- Rejouable sans risque.
-- ============================================================

-- 1. Référence et fournisseur d'une pièce, affichés dans sa fiche.
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS reference TEXT;
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS fournisseur TEXT;

-- 2. Facture émise pour une vente : TRUE = oui, FALSE = non, NULL = non renseigné.
ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS facture_emise BOOLEAN;

-- 3. Les sous-ensembles qui peuvent sortir de l'atelier. Au moment d'une vente,
--    d'un don ou d'un SAV, on choisit parmi eux ; leurs composants sont
--    décomptés du stock à la validation de l'expédition.
ALTER TABLE sous_ensembles ADD COLUMN IF NOT EXISTS produit TEXT;

ALTER TABLE sous_ensembles DROP CONSTRAINT IF EXISTS sous_ensembles_produit_check;
ALTER TABLE sous_ensembles ADD CONSTRAINT sous_ensembles_produit_check
  CHECK (produit IS NULL OR produit IN ('bouee_complete', 'bouee_mecanique', 'boitier_bord', 'tourelle'));

CREATE UNIQUE INDEX IF NOT EXISTS sous_ensembles_produit_unique
  ON sous_ensembles (produit) WHERE produit IS NOT NULL;

UPDATE sous_ensembles SET produit = 'bouee_complete'  WHERE id = '25575b04-43d4-46d6-879a-722fd431c94d'; -- Colis terminé fermé
UPDATE sous_ensembles SET produit = 'bouee_mecanique' WHERE id = '06816350-6e51-47d6-86b0-d51cccb87672'; -- Bouée méca
UPDATE sous_ensembles SET produit = 'boitier_bord'    WHERE id = '1b4db443-0b9b-4f32-9c7c-9d95e845ea5e'; -- BB
UPDATE sous_ensembles SET produit = 'tourelle'        WHERE id = 'dc153d93-4624-40df-bbd7-f2b62bee7d3b'; -- Tourelle
