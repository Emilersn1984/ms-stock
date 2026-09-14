-- ============================================================
-- Migration : gestion des stocks JLC (composants des cartes électroniques)
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- Rejouable sans risque.
-- ============================================================

-- 1. Nombre de produits à couvrir : stock min d'un composant = quantité par
--    produit × ce nombre (cellule F8 de l'onglet BOM de « JLC Stock Manager »).
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS jlc_stock_min INTEGER NOT NULL DEFAULT 40;

--    Dernier inventaire JLC importé, réaffiché à l'ouverture de la fenêtre :
--    tableau de { reference, mfr, jlc, globalSourcing }, nom du fichier et date.
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS jlc_inventaire JSONB;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS jlc_inventaire_fichier TEXT;
ALTER TABLE parametres ADD COLUMN IF NOT EXISTS jlc_inventaire_importe_le TIMESTAMPTZ;

-- 2. BOM des cartes électroniques, une ligne par référence JLCPCB.
CREATE TABLE IF NOT EXISTS jlc_bom (
  id                   UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  reference            TEXT        NOT NULL UNIQUE,
  quantite_par_produit INTEGER     NOT NULL CHECK (quantite_par_produit > 0),
  ordre                INTEGER     NOT NULL DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE jlc_bom ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture jlc_bom" ON jlc_bom;
CREATE POLICY "Lecture jlc_bom" ON jlc_bom
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Ecriture jlc_bom" ON jlc_bom;
CREATE POLICY "Ecriture jlc_bom" ON jlc_bom
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Modification jlc_bom" ON jlc_bom;
CREATE POLICY "Modification jlc_bom" ON jlc_bom
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Suppression jlc_bom" ON jlc_bom;
CREATE POLICY "Suppression jlc_bom" ON jlc_bom
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON jlc_bom TO anon, authenticated;

-- 3. BOM initiale, reprise de l'onglet BOM de « JLC Stock Manager.xlsx »
--    (68 références). Une référence déjà présente n'est pas écrasée.
INSERT INTO jlc_bom (reference, quantite_par_produit, ordre) VALUES
  ('C378939', 4, 1),
  ('C2876295', 2, 2),
  ('C2907266', 2, 3),
  ('C57112', 25, 4),
  ('C11177', 12, 5),
  ('C5122504', 1, 6),
  ('C882955', 9, 7),
  ('C17709', 4, 8),
  ('C2689538', 6, 9),
  ('C14663', 26, 10),
  ('C21122', 8, 11),
  ('C970285', 2, 12),
  ('C14858', 2, 13),
  ('C1972812', 2, 14),
  ('C350305', 1, 15),
  ('C22366943', 8, 16),
  ('C564034', 2, 17),
  ('C19269322', 2, 18),
  ('C17408', 17, 19),
  ('C132719', 1, 20),
  ('C4310', 2, 21),
  ('C29429', 3, 22),
  ('C57168', 2, 23),
  ('C2071163', 2, 24),
  ('C2137', 4, 25),
  ('C4364072', 2, 26),
  ('C2930157', 2, 27),
  ('C1644', 4, 28),
  ('C2991271', 2, 29),
  ('C5441007', 1, 30),
  ('C28323', 35, 31),
  ('C2907274', 4, 32),
  ('C4328', 4, 33),
  ('C12891', 30, 34),
  ('C3197885', 2, 35),
  ('C133307', 2, 36),
  ('C2661857', 18, 37),
  ('C252270', 2, 38),
  ('C26010', 2, 39),
  ('C149504', 19, 40),
  ('C17414', 43, 41),
  ('C3811795', 1, 42),
  ('C566013', 2, 43),
  ('C8308', 2, 44),
  ('C5219190', 4, 45),
  ('C7471117', 2, 46),
  ('C17513', 32, 47),
  ('C17506', 2, 48),
  ('C17675', 2, 49),
  ('C124378', 2, 50),
  ('C17540', 8, 51),
  ('C428486', 1, 52),
  ('C13967', 4, 53),
  ('C22356767', 2, 54),
  ('C17617', 6, 55),
  ('C151618', 9, 56),
  ('C238200', 8, 57),
  ('C94916', 4, 58),
  ('C5119087', 1, 59),
  ('C434807', 1, 60),
  ('C17415', 1, 61),
  ('C5301780', 2, 62),
  ('C98072', 1, 63),
  ('C90321', 1, 64),
  ('C8313', 2, 65),
  ('C22359707', 1, 66),
  ('C6542228', 16, 67),
  ('C277721', 1, 68)
ON CONFLICT (reference) DO NOTHING;
