-- Rimozione view esistente
DROP VIEW IF EXISTS public.v_tracciati_completi CASCADE;

CREATE VIEW v_tracciati_completi AS
SELECT
    t."id_tracciati",
    t."filename_tracciati",
    t."createdat" as data_creazione_tracciato,
    t."context_tracciati",
    JSONB_EXTRACT_PATH_TEXT(t."context_tracciati", 'promo_id') as promo_id,
    JSONB_EXTRACT_PATH_TEXT(t."context_tracciati", 'user_id') as user_id,
    JSONB_EXTRACT_PATH_TEXT(t."context_tracciati", 'action') as action,
    LENGTH(t."blobfile_tracciati") as dimensione_file_bytes,
    u."nome_utenti" as nome_utente_creatore,
    u."email_utenti" as email_utente_creatore
FROM "tracciati" t
LEFT JOIN "utenti" u ON JSONB_EXTRACT_PATH_TEXT(t."context_tracciati", 'user_id')::uuid = u."id_utenti";
