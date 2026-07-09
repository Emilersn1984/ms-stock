-- ============================================================
-- Migration : délai d'approvisionnement + historique productions
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

-- 1. Ajouter le champ "délai d'approvisionnement" sur les pièces (en semaines)
ALTER TABLE pieces ADD COLUMN IF NOT EXISTS delai_appro INTEGER DEFAULT NULL;

-- 2. Créer la table d'historique des productions
CREATE TABLE IF NOT EXISTS productions (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  sous_ensemble_id UUID      NOT NULL REFERENCES sous_ensembles(id) ON DELETE CASCADE,
  quantite       INTEGER     NOT NULL DEFAULT 1,
  utilisateur_id UUID        REFERENCES utilisateurs(id),
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 3. Activer Row Level Security
ALTER TABLE productions ENABLE ROW LEVEL SECURITY;

-- 4. Politique de lecture (tous les utilisateurs authentifiés)
DROP POLICY IF EXISTS "Lecture productions" ON productions;
CREATE POLICY "Lecture productions" ON productions
  FOR SELECT TO authenticated USING (true);

-- 5. Politique d'écriture (tous les utilisateurs authentifiés)
DROP POLICY IF EXISTS "Ecriture productions" ON productions;
CREATE POLICY "Ecriture productions" ON productions
  FOR INSERT TO authenticated WITH CHECK (true);
