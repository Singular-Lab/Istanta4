-- Rimozione view esistente
DROP VIEW IF EXISTS public.v_combinazioni_canale_area_stats CASCADE;

CREATE VIEW v_combinazioni_canale_area_stats AS
SELECT
    cca."id_combinazione_canale_area",
    cca."stato_combinazione_canale_area",
    c."nome_canali" as nome_canale,
    c."codice_canali" as codice_canale,
    a."nome_aree" as nome_area,
    a."codice_aree" as codice_area,
    g."nome_gdo" as nome_gdo,
    COUNT(pv."id_puntivendita") as numero_punti_vendita,
    COUNT(DISTINCT pvu."idutenti_puntivenditautenti") as numero_utenti_associati,
    cca."createdat" as data_creazione_combinazione
FROM "combinazione_canale_area" cca
JOIN "canali" c ON cca."id_canale_combinazione_canale_area" = c."id_canali"
JOIN "aree" a ON cca."id_area_combinazione_canale_area" = a."id_aree"
JOIN "gdo" g ON cca."id_gdo_combinazione_canale_area" = g."id_gdo"
LEFT JOIN "punti_vendita" pv ON cca."id_combinazione_canale_area" = pv."id_combinazione_canale_area_puntivendita"
LEFT JOIN "punti_vendita_utenti" pvu ON pv."id_puntivendita" = pvu."idpuntivendita_puntivenditautenti"
GROUP BY cca."id_combinazione_canale_area", cca."stato_combinazione_canale_area", c."nome_canali", c."codice_canali",
         a."nome_aree", a."codice_aree", g."nome_gdo", cca."createdat";
