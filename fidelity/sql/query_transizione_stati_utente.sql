-- 0. Se vedi ancora 25P02, esci dalla transazione abortita
ROLLBACK;

-- 1. Controlla se il vecchio enum ha dipendenze ancora attive
SELECT n.nspname, t.typname, c.relname, a.attname
FROM   pg_type t
JOIN   pg_namespace n ON n.oid = t.typnamespace
JOIN   pg_attribute a ON a.atttypid = t.oid
JOIN   pg_class     c ON c.oid      = a.attrelid
WHERE  t.typname = 'TIPO_UTENTE';          -- usa le MAIUSCOLE se serve
-- Se qui vedi altre tabelle/colonne, convertili prima di fare DROP TYPE.

-- 2. Riparti con una nuova transazione pulita
BEGIN;

-- 3. Crea il nuovo enum (minuscolo va bene)
CREATE TYPE TIPO_UTENTE_NEW AS ENUM
    ('Superadmin','Agenzia','Admin','Guest','PuntoVendita','GDO');

-- 4. Rimuovi il DEFAULT sulla colonna se esiste
ALTER TABLE utenti
  ALTER COLUMN "tipo_Utenti" DROP DEFAULT;

-- 5. Migra la colonna al nuovo tipo
ALTER TABLE utenti
  ALTER COLUMN "tipo_Utenti" TYPE TIPO_UTENTE_NEW
  USING CASE
         WHEN "tipo_Utenti" = 'Singular'     THEN 'Superadmin'::TIPO_UTENTE_NEW
         WHEN "tipo_Utenti" = 'GdoMKT'       THEN 'Agenzia'::TIPO_UTENTE_NEW
         WHEN "tipo_Utenti" = 'Cliente'      THEN 'Admin'::TIPO_UTENTE_NEW
         WHEN "tipo_Utenti" = 'PuntoVendita' THEN 'Guest'::TIPO_UTENTE_NEW
        WHEN "tipo_Utenti" = 'PuntoVendita' THEN 'PuntoVendita'::TIPO_UTENTE_NEW
         ELSE NULL
       END;

-- 6. Solo se TUTTO è andato bene fin qui, rimuovi il vecchio enum
DROP TYPE "TIPO_UTENTE";   -- attenzione alle virgolette

-- 7. Rinomina il nuovo tipo
ALTER TYPE TIPO_UTENTE_NEW RENAME TO "TIPO_UTENTE";

COMMIT;
