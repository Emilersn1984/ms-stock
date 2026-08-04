-- ============================================================
-- Migration : correction de la génération du numéro de série
-- Le numéro de série est modifiable à la main par les admins.
-- La génération automatique doit repartir du dernier numéro
-- réellement utilisé (même s'il a été modifié manuellement),
-- au lieu d'une séquence indépendante qui pouvait générer des
-- doublons ou revenir en arrière après une modification manuelle.
-- À exécuter une seule fois dans l'éditeur SQL Supabase
-- ============================================================

CREATE OR REPLACE FUNCTION generate_numero_serie()
RETURNS TEXT
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  dernier_numero INTEGER;
BEGIN
  -- On récupère le plus grand numéro déjà utilisé (ventes uniquement),
  -- en extrayant la partie numérique finale du numéro de série existant.
  SELECT COALESCE(MAX((regexp_match(numero_serie, '(\d+)$'))[1]::INTEGER), 0)
  INTO dernier_numero
  FROM expeditions
  WHERE categorie = 'vente'
    AND numero_serie IS NOT NULL
    AND numero_serie ~ '\d+$';

  RETURN 'SN-' || lpad((dernier_numero + 1)::text, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- La séquence n'est plus utilisée par la fonction mais on la laisse
-- en place au cas où ; elle peut être supprimée manuellement si besoin.
