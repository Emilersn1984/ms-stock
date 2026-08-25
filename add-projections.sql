-- ============================================================
-- Migration : page Projections (3 mois)
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- Rejouable sans risque.
-- ============================================================

-- 1. Paramètres de projection, dans la table singleton existante.
--    objectif_vente_mensuel remplace colis_fermes_par_semaine, qui devient
--    l'objectif exprimé par mois. L'ancienne colonne est conservée le temps
--    de la reprise, mais n'est plus lue par l'application.
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS objectif_vente_mensuel INTEGER NOT NULL DEFAULT 0;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS prix_vente_moyen_ttc NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS tresorerie_initiale NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Reprise : l'objectif hebdomadaire devient mensuel (52 semaines / 12 mois).
UPDATE parametres
SET objectif_vente_mensuel = ROUND(colis_fermes_par_semaine * 52.0 / 12.0)
WHERE id = 1 AND objectif_vente_mensuel = 0;

-- 2. Lignes du plan de trésorerie sur 3 mois.
--    montant_m0/m1/m2 à NULL sur une ligne « auto » = valeur calculée par
--    l'application ; une valeur saisie prend le pas sur le calcul.
CREATE TABLE IF NOT EXISTS projections_lignes (
  id          UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  section     TEXT          NOT NULL CHECK (section IN ('recettes', 'depenses')),
  categorie   TEXT          NOT NULL,
  libelle     TEXT          NOT NULL,
  ordre       INTEGER       NOT NULL DEFAULT 0,
  montant_m0  NUMERIC(12,2),
  montant_m1  NUMERIC(12,2),
  montant_m2  NUMERIC(12,2),
  -- 'ca' = chiffre d'affaires, 'achats_mp' = achats de matières premières.
  -- NULL = ligne entièrement saisie à la main.
  auto        TEXT          CHECK (auto IN ('ca', 'achats_mp')),
  created_at  TIMESTAMPTZ   DEFAULT now()
);

ALTER TABLE projections_lignes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture projections" ON projections_lignes;
CREATE POLICY "Lecture projections" ON projections_lignes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Ecriture projections" ON projections_lignes;
CREATE POLICY "Ecriture projections" ON projections_lignes
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Modification projections" ON projections_lignes;
CREATE POLICY "Modification projections" ON projections_lignes
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Suppression projections" ON projections_lignes;
CREATE POLICY "Suppression projections" ON projections_lignes
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON projections_lignes TO anon, authenticated;

-- 3. Lignes initiales, reprises du fichier BP-TrèsLite - 3 mois.
INSERT INTO projections_lignes (section, categorie, libelle, ordre, auto)
SELECT * FROM (VALUES
  ('recettes', 'Chiffre d''affaires TTC',        'Ventes de produits',        10, 'ca'),
  ('recettes', 'Chiffre d''affaires TTC',        'Prestations d''ingénierie', 20, NULL),
  ('recettes', 'Subventions & Prêts d''honneur', 'Réseau entreprendre',       30, NULL),
  ('recettes', 'Subventions & Prêts d''honneur', 'INPI',                      40, NULL),
  ('recettes', 'Subventions & Prêts d''honneur', 'CII',                       50, NULL),
  ('depenses', 'Personnel',       'Émile',                        10, NULL),
  ('depenses', 'Personnel',       'Louis',                        20, NULL),
  ('depenses', 'Personnel',       'Stagiaires',                   30, NULL),
  ('depenses', 'Personnel',       'Gabriel',                      40, NULL),
  ('depenses', 'R&D',             'Sous-traitance',               50, NULL),
  ('depenses', 'R&D',             'Brevet',                       60, NULL),
  ('depenses', 'R&D',             'Achats matériel',              70, NULL),
  ('depenses', 'Production',      'Investissements (moules)',     80, NULL),
  ('depenses', 'Production',      'SAV',                          90, NULL),
  ('depenses', 'Production',      'Achat dropshipping (spade)',  100, NULL),
  ('depenses', 'Production',      'Achats matières premières',   110, 'achats_mp'),
  ('depenses', 'Marketing',       'Site internet + part variable ventes', 120, NULL),
  ('depenses', 'Marketing',       'Publicité en ligne',          130, NULL),
  ('depenses', 'Marketing',       'Salons',                      140, NULL),
  ('depenses', 'Marketing',       'Déplacements',                150, NULL),
  ('depenses', 'Divers',          'Non attribués',               160, NULL),
  ('depenses', 'Divers',          'Frais postaux',               170, NULL),
  ('depenses', 'Divers',          'OVH / Comptable / banque / Odoo / incubateur / AG / Assurance', 180, NULL),
  ('depenses', 'TVA',             'TVA à reverser',              190, NULL),
  ('depenses', 'Emprunt bancaire','Crédit Agricole Finistère',   200, NULL)
) AS v(section, categorie, libelle, ordre, auto)
WHERE NOT EXISTS (SELECT 1 FROM projections_lignes);
