-- ============================================================
-- Migration : page Expédition (clients, expéditions, numéros de série)
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

-- ─── Clients ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clients (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  nom           TEXT        NOT NULL,
  prenom        TEXT        NOT NULL,
  langue        TEXT,
  adresse       TEXT,
  ville         TEXT,
  code_postal   TEXT,
  pays          TEXT,
  email         TEXT,
  telephone     TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture clients" ON clients;
CREATE POLICY "Lecture clients" ON clients
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Ecriture clients" ON clients;
CREATE POLICY "Ecriture clients" ON clients
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Modification clients" ON clients;
CREATE POLICY "Modification clients" ON clients
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON clients TO anon, authenticated;

-- ─── Expéditions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS expeditions (
  id                  UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  statut              TEXT        NOT NULL DEFAULT 'a_expedier' CHECK (statut IN ('a_expedier', 'envoye')),
  origine             TEXT        NOT NULL DEFAULT 'manuel' CHECK (origine IN ('manuel', 'stripe')),
  stripe_session_id   TEXT UNIQUE,
  client_id           UUID        REFERENCES clients(id) ON DELETE SET NULL,
  nom_destinataire    TEXT        NOT NULL DEFAULT '',
  prenom_destinataire TEXT        NOT NULL DEFAULT '',
  langue              TEXT,
  adresse             TEXT,
  ville               TEXT,
  code_postal         TEXT,
  pays                TEXT,
  version_code        TEXT,
  categorie           TEXT        CHECK (categorie IN ('vente', 'sav', 'demo', 'autre')),
  commentaire         TEXT,
  transporteur        TEXT,
  numero_suivi        TEXT,
  numero_serie        TEXT,
  items               JSONB       NOT NULL DEFAULT '[]'::jsonb,
  date_commande       TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_expedition     TIMESTAMPTZ,
  utilisateur_id      UUID        REFERENCES utilisateurs(id),
  created_at          TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE expeditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture expeditions" ON expeditions;
CREATE POLICY "Lecture expeditions" ON expeditions
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Ecriture expeditions" ON expeditions;
CREATE POLICY "Ecriture expeditions" ON expeditions
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Modification expeditions" ON expeditions;
CREATE POLICY "Modification expeditions" ON expeditions
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Suppression expeditions" ON expeditions;
CREATE POLICY "Suppression expeditions" ON expeditions
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON expeditions TO anon, authenticated;

-- Le webhook Stripe utilise la clé "service_role" (bypass RLS), donc
-- aucune policy supplémentaire n'est requise pour lui.

CREATE INDEX IF NOT EXISTS idx_expeditions_statut ON expeditions(statut);
CREATE INDEX IF NOT EXISTS idx_expeditions_client ON expeditions(client_id);

-- ─── Génération des numéros de série ───────────────────────────
CREATE SEQUENCE IF NOT EXISTS numero_serie_seq START 1;

GRANT USAGE, SELECT ON SEQUENCE numero_serie_seq TO anon, authenticated;

CREATE OR REPLACE FUNCTION generate_numero_serie()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN 'SN-' || to_char(now(), 'YY') || '-' || lpad(nextval('numero_serie_seq')::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

GRANT EXECUTE ON FUNCTION generate_numero_serie() TO anon, authenticated;
