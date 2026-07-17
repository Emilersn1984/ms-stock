-- ============================================================
-- Migration : gestionnaire de commandes (onglet Livraisons)
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

CREATE TABLE IF NOT EXISTS commandes (
  id                     UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  piece_id               UUID        NOT NULL REFERENCES pieces(id) ON DELETE CASCADE,
  quantite_commandee     INTEGER     NOT NULL,
  date_commande          DATE        NOT NULL DEFAULT CURRENT_DATE,
  date_livraison_prevue  DATE,
  transporteur           TEXT,
  numero_suivi           TEXT,
  statut                 TEXT        NOT NULL DEFAULT 'en_cours' CHECK (statut IN ('en_cours', 'receptionnee')),
  date_reception         TIMESTAMPTZ,
  utilisateur_id         UUID        REFERENCES utilisateurs(id),
  created_at             TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE commandes ENABLE ROW LEVEL SECURITY;

-- L'appli utilise une authentification custom (table utilisateurs),
-- pas supabase.auth. Les requêtes passent donc par le rôle "anon".
DROP POLICY IF EXISTS "Lecture commandes" ON commandes;
CREATE POLICY "Lecture commandes" ON commandes
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Ecriture commandes" ON commandes;
CREATE POLICY "Ecriture commandes" ON commandes
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Modification commandes" ON commandes;
CREATE POLICY "Modification commandes" ON commandes
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE ON commandes TO anon, authenticated;
