-- Rimozione view esistente
DROP VIEW IF EXISTS public.v_dashboard_utenti_attivita CASCADE;

CREATE VIEW v_dashboard_utenti_attivita AS
SELECT
    u."id_utenti",
    u."nome_utenti",
    u."cognome_utenti",
    u."email_utenti",
    u."tipo_utenti",
    u."stato_utenti",
    u."outsider_utenti",
    COUNT(a."id_attivita") as totale_attivita,
    COUNT(CASE WHEN a."createdat" >= CURRENT_DATE - INTERVAL '30 days' THEN 1 END) as attivita_ultimi_30_giorni,
    MAX(a."createdat") as ultima_attivita
FROM "utenti" u
LEFT JOIN "attivita" a ON u."id_utenti" = a."idutente_attivita"
GROUP BY u."id_utenti", u."nome_utenti", u."cognome_utenti", u."email_utenti", u."tipo_utenti", u."stato_utenti", u."outsider_utenti";
