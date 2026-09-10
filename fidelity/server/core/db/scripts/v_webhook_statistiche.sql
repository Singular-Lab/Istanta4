-- Rimozione view esistente
DROP VIEW IF EXISTS public.v_webhook_statistiche CASCADE;

CREATE VIEW v_webhook_statistiche AS
SELECT
    w."id_webhook",
    w."nome_webhook",
    w."descrizione_webhook",
    w."url_webhook",
    w."stato_webhook",
    w."eventi_webhook",
    w."createdat_webhook",
    w."createdby_webhook",
    COUNT(tw."id_tentativo_webhook") as totale_tentativi,
    COUNT(CASE WHEN tw."stato_tentativo_webhook" = 'SUCCESSO' THEN 1 END) as tentativi_successo,
    COUNT(CASE WHEN tw."stato_tentativo_webhook" = 'FALLITO' THEN 1 END) as tentativi_falliti,
    COUNT(CASE WHEN tw."stato_tentativo_webhook" = 'RETRY' THEN 1 END) as tentativi_retry,
    AVG(tw."duration_ms") as durata_media_ms,
    MAX(tw."createdat_tentativo_webhook") as ultimo_tentativo
FROM "webhooks" w
LEFT JOIN "tentativi_webhook" tw ON w."id_webhook" = tw."id_webhook_tentativo_webhook"
GROUP BY w."id_webhook", w."nome_webhook", w."descrizione_webhook", w."url_webhook", w."stato_webhook",
         w."eventi_webhook", w."createdat_webhook", w."createdby_webhook";
