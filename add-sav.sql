-- ============================================================
-- Migration : module SAV (page dédiée)
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- Rejouable sans risque.
-- ============================================================

-- Un SAV = une reprise de matériel chez un client existant. Le matériel
-- retourné n'impacte aucun stock ; seul le colis de renvoi, créé dans
-- expeditions et pointé par expedition_id, suit le circuit habituel.
CREATE TABLE IF NOT EXISTS sav (
  id                    UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id             UUID        REFERENCES clients(id) ON DELETE SET NULL,
  -- Copie figée du nom, comme sur expeditions : la fiche client peut changer.
  nom_client            TEXT        NOT NULL,
  prenom_client         TEXT        NOT NULL,
  date_sav              DATE        NOT NULL,
  cause                 TEXT        NOT NULL CHECK (cause IN ('electronique', 'mecanique')),
  description           TEXT,
  remboursement_demande BOOLEAN     NOT NULL DEFAULT false,
  mode_recuperation     TEXT        NOT NULL CHECK (mode_recuperation IN ('mains_propres', 'envoi')),
  -- ExpeditionItem[] : même format que expeditions.items, repris tel quel
  -- pour le colis de renvoi.
  materiel              JSONB       NOT NULL DEFAULT '[]'::jsonb,
  -- Récupération du matériel chez le client (renseignés si mode « envoi »).
  transporteur          TEXT,
  numero_suivi          TEXT,
  date_renvoi_prevue    DATE,
  -- Colis de renvoi au client, créé automatiquement quand une date de renvoi
  -- est saisie. NULL tant qu'aucun renvoi n'est prévu.
  expedition_id         UUID        REFERENCES expeditions(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sav_date ON sav (date_sav DESC);

ALTER TABLE sav ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture sav" ON sav;
CREATE POLICY "Lecture sav" ON sav
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Ecriture sav" ON sav;
CREATE POLICY "Ecriture sav" ON sav
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Modification sav" ON sav;
CREATE POLICY "Modification sav" ON sav
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Suppression sav" ON sav;
CREATE POLICY "Suppression sav" ON sav
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON sav TO anon, authenticated;
