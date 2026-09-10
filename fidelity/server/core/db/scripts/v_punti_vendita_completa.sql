-- Rimozione view esistente
DROP VIEW IF EXISTS public.v_punti_vendita_completa CASCADE;

CREATE VIEW v_punti_vendita_completa AS
SELECT
    pv."id_puntivendita",
    pv."nome_puntivendita",
    pv."citta_puntivendita",
    pv."provincia_puntiVendita",
    pv."regione_puntivendita",
    pv."cap_puntivendita",
    pv."indirizzo_puntivendita",
    pv."lat_puntivendita",
    pv."lon_puntivendita",
    pv."ragionesociale_puntivendita",
    pv."telefono_puntivendita",
    g."nome_gdo" as nome_gdo,
    c."nome_canali" as nome_canale,
    c."codice_canali" as codice_canale,
    a."nome_aree" as nome_area,
    a."codice_aree" as codice_area,
    cca."stato_combinazione_canale_area",
    COUNT(pvu."id_puntivenditautenti") as numero_utenti_associati
FROM "punti_vendita" pv
JOIN "gdo" g ON pv."id_gdo_puntivendita" = g."id_gdo"
JOIN "combinazione_canale_area" cca ON pv."id_combinazione_canale_area_puntivendita" = cca."id_combinazione_canale_area"
JOIN "canali" c ON cca."id_canale_combinazione_canale_area" = c."id_canali"
JOIN "aree" a ON cca."id_area_combinazione_canale_area" = a."id_aree"
LEFT JOIN "punti_vendita_utenti" pvu ON pv."id_puntivendita" = pvu."idpuntivendita_puntivenditautenti"
GROUP BY pv."id_puntivendita", pv."nome_puntivendita", pv."citta_puntivendita", pv."provincia_puntiVendita",
         pv."regione_puntivendita", pv."cap_puntivendita", pv."indirizzo_puntivendita", pv."lat_puntivendita",
         pv."lon_puntivendita", pv."ragionesociale_puntivendita", pv."telefono_puntivendita", g."nome_gdo",
         c."nome_canali", c."codice_canali", a."nome_aree", a."codice_aree", cca."stato_combinazione_canale_area";
