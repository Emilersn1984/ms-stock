-- ============================================================
-- Migration : paramètres réglables à la main (colis fermés / semaine)
-- Table singleton (id fixe = 1) pour que la valeur soit partagée
-- et persistée d'une connexion à l'autre, pour tous les utilisateurs.
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- ============================================================

CREATE TABLE IF NOT EXISTS parametres (
  id                        SMALLINT     PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  colis_fermes_par_semaine  INTEGER      NOT NULL DEFAULT 0,
  updated_at                TIMESTAMPTZ  NOT NULL DEFAULT now()
);

INSERT INTO parametres (id, colis_fermes_par_semaine)
VALUES (1, 0)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE parametres ENABLE ROW LEVEL SECURITY;

-- L'appli utilise une authentification custom (table utilisateurs),
-- pas supabase.auth. Les requêtes passent donc par le rôle "anon".
DROP POLICY IF EXISTS "Lecture parametres" ON parametres;
CREATE POLICY "Lecture parametres" ON parametres
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Modification parametres" ON parametres;
CREATE POLICY "Modification parametres" ON parametres
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, UPDATE ON parametres TO anon, authenticated;
