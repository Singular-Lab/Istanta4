-- Type: SESSO_UTENTI

-- Rimozione tipo esistente (ATTENZIONE: Verificare dipendenze prima di eseguire)
-- DROP TYPE IF EXISTS public."SESSO_UTENTI" CASCADE;

CREATE TYPE public."SESSO_UTENTI" AS ENUM
    ('UOMO', 'DONNA', 'NON BINARIO', 'ALTRO');

ALTER TYPE public."SESSO_UTENTI"
    OWNER TO postgres;
