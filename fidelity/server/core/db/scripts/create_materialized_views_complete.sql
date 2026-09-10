-- Script completo per creare le materialized views ottimizzate
-- Include aree, canali, combinazioni con campo sigla e tutti gli indici

-- Prima elimina le view se esistono già
DROP MATERIALIZED VIEW IF EXISTS mv_aree_ottimizzata;
DROP MATERIALIZED VIEW IF EXISTS mv_canali_ottimizzata;
DROP MATERIALIZED VIEW IF EXISTS mv_combinazioni_ottimizzata;
DROP MATERIALIZED VIEW IF EXISTS mv_aree_canali_combinazioni;

-- 1. Materialized View per le Aree
CREATE MATERIALIZED VIEW mv_aree_ottimizzata AS
SELECT
    id_aree as id,
    codice_aree as codice,
    nome_aree as nome,
    id_gdo_aree as id_gdo,
    createdat,
    updatedat
FROM aree
ORDER BY nome_aree;

-- 2. Materialized View per i Canali
CREATE MATERIALIZED VIEW mv_canali_ottimizzata AS
SELECT
    id_canali as id,
    codice_canali as codice,
    nome_canali as nome,
    id_gdo_canali as id_gdo,
    createdat,
    updatedat
FROM canali
ORDER BY nome_canali;

-- 3. Materialized View per le Combinazioni con dati denormalizzati e campo sigla
CREATE MATERIALIZED VIEW mv_combinazioni_ottimizzata AS
SELECT
    cca.id_combinazione_canale_area as id,
    cca.id_gdo_combinazione_canale_area as id_gdo,
    cca.id_canale_combinazione_canale_area as id_canale,
    cca.id_area_combinazione_canale_area as id_area,
    cca.stato_combinazione_canale_area as stato,
    cca.createdat,
    cca.updatedat,

    -- Dati del canale denormalizzati
    c.codice_canali as canale_codice,
    c.nome_canali as canale_nome,

    -- Dati dell'area denormalizzati
    a.codice_aree as area_codice,
    a.nome_aree as area_nome,

    -- Campo sigla per combinazioni (codice_canale + "_" + codice_area)
    CONCAT(c.codice_canali, '_', a.codice_aree) as sigla

FROM combinazione_canale_area cca
LEFT JOIN canali c ON cca.id_canale_combinazione_canale_area = c.id_canali
LEFT JOIN aree a ON cca.id_area_combinazione_canale_area = a.id_aree
ORDER BY cca.createdat DESC;

-- 4. Materialized View Unificata (CORRETTA)
CREATE MATERIALIZED VIEW mv_aree_canali_combinazioni AS
WITH aree_data AS (
    SELECT
        id_aree::text as id,  -- Cast a text per uniformità
        codice_aree as codice,
        nome_aree as nome,
        id_gdo_aree::text as id_gdo,  -- Cast a text per uniformità
        createdat,
        updatedat,
        'AREA' as tipo_entita,
        -- Campi NULL per compatibilità UNION
        NULL::text as id_canale,  -- Cambiato da integer a text
        NULL::text as id_area,    -- Cambiato da integer a text
        NULL::text as stato,
        NULL::text as canale_codice,
        NULL::text as canale_nome,
        NULL::text as area_codice,
        NULL::text as area_nome
    FROM aree
),
canali_data AS (
    SELECT
        id_canali::text as id,  -- Cast a text per uniformità
        codice_canali as codice,
        nome_canali as nome,
        id_gdo_canali::text as id_gdo,  -- Cast a text per uniformità
        createdat,
        updatedat,
        'CANALE' as tipo_entita,
        -- Campi NULL per compatibilità UNION
        NULL::text as id_canale,  -- Cambiato da integer a text
        NULL::text as id_area,    -- Cambiato da integer a text
        NULL::text as stato,
        NULL::text as canale_codice,
        NULL::text as canale_nome,
        NULL::text as area_codice,
        NULL::text as area_nome
    FROM canali
),
combinazioni_data AS (
    SELECT
        cca.id_combinazione_canale_area::text as id,  -- Cast a text per uniformità
        NULL::text as codice, -- Non applicabile per combinazioni
        NULL::text as nome,   -- Non applicabile per combinazioni
        cca.id_gdo_combinazione_canale_area::text as id_gdo,  -- Cast a text per uniformità
        cca.createdat,
        cca.updatedat,
        'COMBINAZIONE' as tipo_entita,
        cca.id_canale_combinazione_canale_area::text as id_canale,  -- Cast a text
        cca.id_area_combinazione_canale_area::text as id_area,      -- Cast a text
        cca.stato_combinazione_canale_area::text as stato,
        -- Dati del canale associato
        c.codice_canali as canale_codice,
        c.nome_canali as canale_nome,
        -- Dati dell'area associata
        a.codice_aree as area_codice,
        a.nome_aree as area_nome
    FROM combinazione_canale_area cca
    LEFT JOIN canali c ON cca.id_canale_combinazione_canale_area = c.id_canali
    LEFT JOIN aree a ON cca.id_area_combinazione_canale_area = a.id_aree
)
SELECT
    -- Campi comuni a tutti i tipi
    id,
    id_gdo,
    createdat,
    updatedat,
    tipo_entita,

    -- Campi specifici per aree e canali
    codice,
    nome,

    -- Campi specifici per combinazioni
    id_canale,
    id_area,
    stato,

    -- Dati denormalizzati per combinazioni
    canale_codice,
    canale_nome,
    area_codice,
    area_nome,

    -- Campo sigla per combinazioni (codice_canale + "_" + codice_area)
    CASE
        WHEN tipo_entita = 'COMBINAZIONE' AND canale_codice IS NOT NULL AND area_codice IS NOT NULL
        THEN CONCAT(canale_codice, '_', area_codice)
        ELSE NULL
    END as sigla

FROM (
    SELECT * FROM aree_data
    UNION ALL
    SELECT * FROM canali_data
    UNION ALL
    SELECT * FROM combinazioni_data
) combined_data
ORDER BY tipo_entita, id;

-- Indici per ottimizzare le query - Aree
CREATE INDEX idx_mv_aree_id_gdo ON mv_aree_ottimizzata(id_gdo);
CREATE INDEX idx_mv_aree_codice ON mv_aree_ottimizzata(codice);
CREATE INDEX idx_mv_aree_nome ON mv_aree_ottimizzata(nome);

-- Indici per ottimizzare le query - Canali
CREATE INDEX idx_mv_canali_id_gdo ON mv_canali_ottimizzata(id_gdo);
CREATE INDEX idx_mv_canali_codice ON mv_canali_ottimizzata(codice);
CREATE INDEX idx_mv_canali_nome ON mv_canali_ottimizzata(nome);

-- Indici per ottimizzare le query - Combinazioni
CREATE INDEX idx_mv_combinazioni_id_gdo ON mv_combinazioni_ottimizzata(id_gdo);
CREATE INDEX idx_mv_combinazioni_id_canale ON mv_combinazioni_ottimizzata(id_canale);
CREATE INDEX idx_mv_combinazioni_id_area ON mv_combinazioni_ottimizzata(id_area);
CREATE INDEX idx_mv_combinazioni_stato ON mv_combinazioni_ottimizzata(stato);
CREATE INDEX idx_mv_combinazioni_canale_codice ON mv_combinazioni_ottimizzata(canale_codice);
CREATE INDEX idx_mv_combinazioni_area_codice ON mv_combinazioni_ottimizzata(area_codice);
CREATE INDEX idx_mv_combinazioni_sigla ON mv_combinazioni_ottimizzata(sigla);

-- Indici per ottimizzare le query - View Unificata
CREATE INDEX idx_mv_aree_canali_combinazioni_tipo_entita ON mv_aree_canali_combinazioni(tipo_entita);
CREATE INDEX idx_mv_aree_canali_combinazioni_id_gdo ON mv_aree_canali_combinazioni(id_gdo);
CREATE INDEX idx_mv_aree_canali_combinazioni_id_canale ON mv_aree_canali_combinazioni(id_canale) WHERE id_canale IS NOT NULL;
CREATE INDEX idx_mv_aree_canali_combinazioni_id_area ON mv_aree_canali_combinazioni(id_area) WHERE id_area IS NOT NULL;
CREATE INDEX idx_mv_aree_canali_combinazioni_stato ON mv_aree_canali_combinazioni(stato) WHERE stato IS NOT NULL;
CREATE INDEX idx_mv_aree_canali_combinazioni_sigla ON mv_aree_canali_combinazioni(sigla) WHERE sigla IS NOT NULL;

-- Indice unico per refresh concorrenti - MODIFICATI per gestire TEXT
CREATE UNIQUE INDEX idx_mv_aree_id ON mv_aree_ottimizzata(id);
CREATE UNIQUE INDEX idx_mv_canali_id ON mv_canali_ottimizzata(id);
CREATE UNIQUE INDEX idx_mv_combinazioni_id ON mv_combinazioni_ottimizzata(id);
CREATE UNIQUE INDEX idx_mv_aree_canali_combinazioni_unique ON mv_aree_canali_combinazioni(id, tipo_entita);

-- Funzioni per refresh delle materialized views
CREATE OR REPLACE FUNCTION refresh_all_materialized_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_aree_ottimizzata;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_canali_ottimizzata;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_combinazioni_ottimizzata;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_aree_canali_combinazioni;
END;
$$ LANGUAGE plpgsql;

-- Funzioni per refresh di singole views
CREATE OR REPLACE FUNCTION refresh_mv_aree()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_aree_ottimizzata;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_mv_canali()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_canali_ottimizzata;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_mv_combinazioni()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_combinazioni_ottimizzata;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_mv_aree_canali_combinazioni()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_aree_canali_combinazioni;
END;
$$ LANGUAGE plpgsql;

-- Test delle materialized views create
SELECT 'Materialized views create con successo!' as status;
SELECT COUNT(*) as total_aree FROM mv_aree_ottimizzata;
SELECT COUNT(*) as total_canali FROM mv_canali_ottimizzata;
SELECT COUNT(*) as total_combinazioni FROM mv_combinazioni_ottimizzata;
SELECT COUNT(*) as total_unified FROM mv_aree_canali_combinazioni;

-- Mostra alcune combinazioni con sigla per verifica
SELECT id, sigla, canale_codice, area_codice
FROM mv_combinazioni_ottimizzata
LIMIT 5;
