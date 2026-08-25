-- ============================================================
-- Migration : page Ventes
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

-- 1. Montant payé par le client, en euros.
--    Reste NULL pour les expéditions qui ne sont pas des ventes.
ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS montant_paye NUMERIC(10,2) DEFAULT NULL;

-- 2. Nouvelle valeur "don" pour le type de commande.
--    Les valeurs existantes (vente, sav, demo, autre) restent acceptées
--    pour ne pas invalider les lignes déjà enregistrées.
ALTER TABLE expeditions DROP CONSTRAINT IF EXISTS expeditions_categorie_check;
ALTER TABLE expeditions ADD CONSTRAINT expeditions_categorie_check
  CHECK (categorie IN ('vente', 'sav', 'demo', 'autre', 'don'));

-- 3. Origine de la vente, son commentaire libre, et le type de bateau.
--    Attention : la colonne "origine" existante décrit la source technique
--    de la ligne (manuel / stripe), d'où le nom distinct "origine_vente".
ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS origine_vente TEXT DEFAULT NULL;
ALTER TABLE expeditions DROP CONSTRAINT IF EXISTS expeditions_origine_vente_check;
ALTER TABLE expeditions ADD CONSTRAINT expeditions_origine_vente_check
  CHECK (origine_vente IS NULL OR origine_vente IN ('web', 'salon', 'b2b', 'autre'));

ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS commentaire_origine TEXT DEFAULT NULL;
ALTER TABLE expeditions ADD COLUMN IF NOT EXISTS type_bateau TEXT DEFAULT NULL;

-- 4. Sous-ensemble représentant une « bouée complète ».
--    Sert à décompter automatiquement le stock quand une vente de ce type
--    est finalisée, sans avoir à choisir le contenu du colis à la main.
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS sous_ensemble_bouee_id UUID
  REFERENCES sous_ensembles(id) ON DELETE SET NULL;

UPDATE parametres
SET sous_ensemble_bouee_id = (SELECT id FROM sous_ensembles WHERE nom = 'Colis terminé fermé' LIMIT 1)
WHERE id = 1 AND sous_ensemble_bouee_id IS NULL;
