-- Type: STATO_ORDINI_STAMPA

-- Rimozione tipo esistente (ATTENZIONE: Verificare dipendenze prima di eseguire)
-- DROP TYPE IF EXISTS public."STATO_ORDINI_STAMPA" CASCADE;

CREATE TYPE public."STATO_ORDINI_STAMPA" AS ENUM
    ('ERRORE', 'IN_REVISIONE', 'REVISIONATO', 'FINITO');

ALTER TYPE public."STATO_ORDINI_STAMPA"
    OWNER TO postgres;
