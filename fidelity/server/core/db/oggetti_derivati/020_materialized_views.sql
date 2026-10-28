-- Materialized view di aree, canali e combinazioni canale/area, con indici e
-- funzioni di refresh. Le leggono AreaService, CanaleService,
-- CombinazioneAreeCanaliService e PuntoVenditaService.
--
-- Oggetto derivato: lo ricrea migrazioni/oggettiDerivati.ts quando questo
-- file cambia o una delle view manca. Deve restare autosufficiente e
-- rieseguibile: elimina e ricrea, e CREATE MATERIALIZED VIEW le popola con i
-- dati presenti.

DROP MATERIALIZED VIEW IF EXISTS public.mv_aree_ottimizzata CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_canali_ottimizzata CASCADE;
DROP MATERIALIZED VIEW IF EXISTS public.mv_combinazioni_ottimizzata CASCADE;

-- 1. Materialized View per le Aree
CREATE MATERIALIZED VIEW public.mv_aree_ottimizzata AS
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
CREATE MATERIALIZED VIEW public.mv_canali_ottimizzata AS
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
CREATE MATERIALIZED VIEW public.mv_combinazioni_ottimizzata AS
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

-- Indici per ottimizzare le query - Aree
CREATE INDEX idx_mv_aree_id_gdo ON public.mv_aree_ottimizzata(id_gdo);
CREATE INDEX idx_mv_aree_codice ON public.mv_aree_ottimizzata(codice);
CREATE INDEX idx_mv_aree_nome ON public.mv_aree_ottimizzata(nome);

-- Indici per ottimizzare le query - Canali
CREATE INDEX idx_mv_canali_id_gdo ON public.mv_canali_ottimizzata(id_gdo);
CREATE INDEX idx_mv_canali_codice ON public.mv_canali_ottimizzata(codice);
CREATE INDEX idx_mv_canali_nome ON public.mv_canali_ottimizzata(nome);

-- Indici per ottimizzare le query - Combinazioni
CREATE INDEX idx_mv_combinazioni_id_gdo ON public.mv_combinazioni_ottimizzata(id_gdo);
CREATE INDEX idx_mv_combinazioni_id_canale ON public.mv_combinazioni_ottimizzata(id_canale);
CREATE INDEX idx_mv_combinazioni_id_area ON public.mv_combinazioni_ottimizzata(id_area);
CREATE INDEX idx_mv_combinazioni_stato ON public.mv_combinazioni_ottimizzata(stato);
CREATE INDEX idx_mv_combinazioni_canale_codice ON public.mv_combinazioni_ottimizzata(canale_codice);
CREATE INDEX idx_mv_combinazioni_area_codice ON public.mv_combinazioni_ottimizzata(area_codice);
CREATE INDEX idx_mv_combinazioni_sigla ON public.mv_combinazioni_ottimizzata(sigla);

-- Indice unico per refresh concorrenti
CREATE UNIQUE INDEX idx_mv_aree_id ON public.mv_aree_ottimizzata(id);
CREATE UNIQUE INDEX idx_mv_canali_id ON public.mv_canali_ottimizzata(id);
CREATE UNIQUE INDEX idx_mv_combinazioni_id ON public.mv_combinazioni_ottimizzata(id);

-- Funzioni per refresh di singole views, chiamate dai servizi dopo le modifiche
CREATE OR REPLACE FUNCTION public.refresh_mv_aree()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_aree_ottimizzata;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refresh_mv_canali()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_canali_ottimizzata;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.refresh_mv_combinazioni()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_combinazioni_ottimizzata;
END;
$$ LANGUAGE plpgsql;
