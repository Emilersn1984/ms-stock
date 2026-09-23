-- ============================================================
-- Migration : reprise des SAV saisis avant la page SAV
-- À exécuter une seule fois dans l'éditeur SQL Supabase.
-- Rejouable sans risque (aucun doublon : l'import est indexé sur
-- expedition_id).
-- ============================================================

-- Les SAV importés n'ont ni cause ni moyen de récupération : l'information
-- n'existe nulle part dans les anciennes lignes. Plutôt que d'inventer une
-- valeur, on autorise le vide et on laisse compléter depuis l'historique.
ALTER TABLE sav ALTER COLUMN cause DROP NOT NULL;
ALTER TABLE sav ALTER COLUMN mode_recuperation DROP NOT NULL;

-- Une expédition de catégorie SAV devient une reprise, rattachée à ce même
-- colis : le bandeau continue donc de compter 1 par SAV, sans double compte.
INSERT INTO sav (
  client_id, nom_client, prenom_client, date_sav, cause, description,
  remboursement_demande, mode_recuperation, materiel, date_renvoi_prevue, expedition_id
)
SELECT
  e.client_id,
  e.nom_destinataire,
  e.prenom_destinataire,
  e.date_commande::date,
  NULL,
  e.commentaire,
  false,
  NULL,
  COALESCE(e.items, '[]'::jsonb),
  -- Date de renvoi : la date prévisionnelle si elle est plausible (une ligne
  -- porte une année saisie de travers), sinon la date d'expédition réelle.
  CASE
    WHEN e.date_envoi_previsionnelle >= '2000-01-01' THEN e.date_envoi_previsionnelle::date
    WHEN e.date_expedition IS NOT NULL THEN e.date_expedition::date
    ELSE NULL
  END,
  e.id
FROM expeditions e
WHERE e.categorie = 'sav'
  AND NOT EXISTS (SELECT 1 FROM sav s WHERE s.expedition_id = e.id);
