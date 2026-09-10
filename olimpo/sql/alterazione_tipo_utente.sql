-- ATTENZIONE: Questa operazione modifica la struttura della tabella ed è difficile da annullare.
-- Assicurati di avere un backup.
CREATE TYPE public.tipo_utenti_finale AS ENUM
    ('Superadmin', 'GDO', 'PuntoVendita', 'Agenzia', 'Guest');
ALTER TABLE auth
ALTER COLUMN tipo_utente TYPE tipo_utenti_finale -- Sostituisci con il nome del NUOVO tipo ENUM
USING CASE
    WHEN tipo_utente::text = 'Singular' THEN 'Superadmin'
    WHEN tipo_utente::text IN ('AgeziaGraficaAdmin', 'AgeziaGraficaUser', 'Tipografia') THEN 'Agenzia'
    WHEN tipo_utente::text IN ('GdoMkt', 'GdoAdmin', 'GdoUser') THEN 'GDO'
    WHEN tipo_utente::text = 'PuntoVendita' THEN 'PuntoVendita'
    ELSE 'Guest' -- Valore di default per i casi non mappati
END::tipo_utenti_finale; -- Sostituisci con il nome del NUOVO tipo ENUM