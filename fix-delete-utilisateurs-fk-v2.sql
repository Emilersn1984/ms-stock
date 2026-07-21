-- ============================================================
-- Diagnostic + fix générique : trouve TOUTES les FK qui
-- référencent utilisateurs(id) et les passe en ON DELETE SET NULL
-- (ou ON DELETE CASCADE si la colonne est NOT NULL).
-- À exécuter dans le SQL Editor Supabase.
-- ============================================================

-- 1) DIAGNOSTIC : exécute ceci en premier pour voir quelles
-- tables/contraintes bloquent la suppression.
SELECT
  tc.table_name,
  tc.constraint_name,
  kcu.column_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_name = ccu.constraint_name
JOIN information_schema.referential_constraints rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'utilisateurs';

-- 2) FIX AUTOMATIQUE : applique ON DELETE SET NULL sur toutes
-- les FK trouvées ci-dessus qui référencent utilisateurs(id).
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT
      tc.table_name,
      tc.constraint_name,
      kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.constraint_column_usage ccu
      ON tc.constraint_name = ccu.constraint_name
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'utilisateurs'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.table_name, r.constraint_name);
    EXECUTE format(
      'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES utilisateurs(id) ON DELETE SET NULL',
      r.table_name, r.constraint_name, r.column_name
    );
    RAISE NOTICE 'Corrigé: %.% (contrainte %)', r.table_name, r.column_name, r.constraint_name;
  END LOOP;
END $$;
