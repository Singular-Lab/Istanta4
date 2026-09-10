DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_utenti_stato_Utenti') THEN
        CREATE TYPE "enum_utenti_stato_Utenti" AS ENUM ('ATTIVO', 'DISATTIVO', 'BLOCCATO', 'SOSPESO', 'ELIMINATO');
    END IF;
END$$; 