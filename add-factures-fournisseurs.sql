-- ============================================================
-- Migration : factures fournisseurs à payer (page Projections)
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- Rejouable sans risque.
-- ============================================================

-- date_paiement à NULL = facture encore à payer ; une date = facture réglée.
CREATE TABLE IF NOT EXISTS factures_fournisseurs (
  id             UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  fournisseur    TEXT          NOT NULL,
  libelle        TEXT,
  montant_ttc    NUMERIC(12,2) NOT NULL DEFAULT 0,
  date_echeance  DATE          NOT NULL,
  date_paiement  DATE,
  created_at     TIMESTAMPTZ   DEFAULT now()
);

ALTER TABLE factures_fournisseurs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Lecture factures fournisseurs" ON factures_fournisseurs;
CREATE POLICY "Lecture factures fournisseurs" ON factures_fournisseurs
  FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "Ecriture factures fournisseurs" ON factures_fournisseurs;
CREATE POLICY "Ecriture factures fournisseurs" ON factures_fournisseurs
  FOR INSERT TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Modification factures fournisseurs" ON factures_fournisseurs;
CREATE POLICY "Modification factures fournisseurs" ON factures_fournisseurs
  FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Suppression factures fournisseurs" ON factures_fournisseurs;
CREATE POLICY "Suppression factures fournisseurs" ON factures_fournisseurs
  FOR DELETE TO anon, authenticated USING (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON factures_fournisseurs TO anon, authenticated;
