DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_utenti_tipo_Utenti') THEN
        CREATE TYPE "enum_utenti_tipo_Utenti" AS ENUM ('Superadmin', 'Agenzia', 'Guest', 'PuntoVendita', 'GDO');
    END IF;
END$$; 