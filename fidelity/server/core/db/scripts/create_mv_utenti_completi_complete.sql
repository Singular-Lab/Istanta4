-- =====================================================
-- SCRIPT COMPLETO PER MATERIALIZED VIEW UTENTI COMPLETI
-- Include: MV, Indici, Funzioni di filtro e di Refresh
--
-- Eseguito da Fidelity a ogni avvio, dopo la sincronizzazione dei modelli.
-- Prima della sincronizzazione prima_della_sincronizzazione/rimuovi_oggetti_derivati.sql
-- l'ha gia' eliminata: qui si ricrea sempre da zero, con i dati presenti.
-- L'applicazione la aggiorna da se' (UserService) dopo ogni modifica agli utenti.
-- =====================================================

-- 1. RIMOZIONE ESISTENTE (comprese le funzioni e i trigger delle versioni precedenti)
-- =====================================================
DROP MATERIALIZED VIEW IF EXISTS public.mv_utenti_completi CASCADE;
DROP FUNCTION IF EXISTS public.refresh_mv_utenti_completi() CASCADE;
DROP FUNCTION IF EXISTS public.refresh_mv_utenti_completi_with_params(BOOLEAN, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.trigger_refresh_mv_utenti_completi() CASCADE;
DROP FUNCTION IF EXISTS public.get_utenti_completi_filtered(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_utenti_completi_advanced(TEXT, TEXT, TEXT, BOOLEAN, BOOLEAN, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_current_user_type() CASCADE;
DROP FUNCTION IF EXISTS public.get_utenti_completi_current_user() CASCADE;
DROP FUNCTION IF EXISTS public.handle_mv_refresh_notification() CASCADE;
DROP VIEW IF EXISTS public.v_utenti_completi_filtered CASCADE;

-- 2. CREAZIONE MATERIALIZED VIEW CON FILTRO PER TIPO UTENTE
-- =====================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.mv_utenti_completi
TABLESPACE pg_default
AS
 SELECT u.id_utenti AS id,
    u.outsider_utenti AS outsider,
    u.nome_utenti AS nome,
    u.cognome_utenti AS cognome,
    u.email_utenti AS email,
    u.datadinascita_utenti AS datadinascita,
    u.residenza_utenti AS residenza,
    u.tipo_utenti AS tipo,
    u.stato_utenti AS stato,
    u.sesso_utenti AS sesso,
    u.telefono_utenti AS telefono,
    u.privatekey_utenti AS private_key,
    u.createdat,
    u.updatedat,
    u.meta_utenti AS meta,
    concat(u.nome_utenti, ' ', u.cognome_utenti) AS nome_completo,
        CASE
            WHEN u.datadinascita_utenti IS NOT NULL THEN EXTRACT(year FROM age(CURRENT_DATE::timestamp with time zone, u.datadinascita_utenti))
            ELSE NULL::numeric
        END AS eta,
    u.stato_utenti::text = 'ATTIVO' AS is_attivo,
    u.tipo_utenti::text = 'Superadmin' AS is_admin,
    COALESCE(jsonb_agg(DISTINCT jsonb_build_object('id', ci.id_canaliinterazione, 'tipo', ci.tipo_canaliinterazione, 'stato', ci.stato_canaliinterazione)) FILTER (WHERE ci.id_canaliinterazione IS NOT NULL), '[]'::jsonb) AS canali_interazione,
        CASE
            WHEN rug.id_ruolo_utente_gdo IS NOT NULL THEN jsonb_build_object('id', rug.id_ruolo_utente_gdo, 'ruolo', rug.ruolo_ruolo_utente_gdo)
            ELSE NULL::jsonb
        END AS ruolo_gdo,
        CASE
            WHEN pv.id_puntivendita IS NOT NULL THEN jsonb_build_object('id', pv.id_puntivendita, 'nome', pv.nome_puntivendita)
            ELSE NULL::jsonb
        END AS punto_vendita_collegato,
    count(ci.id_canaliinterazione) AS totale_canali_interazione,
    ug.id_utentegdo IS NOT NULL AS ha_ruolo_gdo,
    pvu.id_puntivenditautenti IS NOT NULL AS ha_punto_vendita
   FROM utenti u
     LEFT JOIN canali_interazione ci ON u.id_utenti = ci.idutente_canaliinterazione
     LEFT JOIN utenti_gdo ug ON u.id_utenti = ug.id_utente_utentegdo
     LEFT JOIN ruolo_utente_gdo rug ON ug.id_ruolo_utente_gdo = rug.id_ruolo_utente_gdo
     LEFT JOIN punti_vendita_utenti pvu ON u.id_utenti = pvu.idutenti_puntivenditautenti
     LEFT JOIN punti_vendita pv ON pvu.idpuntivendita_puntivenditautenti = pv.id_puntivendita
  WHERE u.outsider_utenti = false
  GROUP BY u.id_utenti, u.outsider_utenti, u.nome_utenti, u.cognome_utenti, u.email_utenti, u.datadinascita_utenti, u.residenza_utenti, u.tipo_utenti, u.stato_utenti, u.sesso_utenti, u.telefono_utenti, u.privatekey_utenti, u.createdat, u.updatedat, u.meta_utenti, rug.id_ruolo_utente_gdo, rug.ruolo_ruolo_utente_gdo, pv.id_puntivendita, pv.nome_puntivendita, ug.id_utentegdo, pvu.id_puntivenditautenti
WITH DATA;

-- 3. CREAZIONE INDICI
-- =====================================================

-- Indice GIN per canali_interazione (JSONB)
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_canali_gin
    ON public.mv_utenti_completi USING gin
    (canali_interazione)
    TABLESPACE pg_default;

-- Indice per email
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_email
    ON public.mv_utenti_completi USING btree
    (email COLLATE pg_catalog."default")
    TABLESPACE pg_default;

-- Indice per ha_punto_vendita
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_ha_punto_vendita
    ON public.mv_utenti_completi USING btree
    (ha_punto_vendita)
    TABLESPACE pg_default;

-- Indice per ha_ruolo_gdo
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_ha_ruolo_gdo
    ON public.mv_utenti_completi USING btree
    (ha_ruolo_gdo)
    TABLESPACE pg_default;

-- Indice UNIQUE per id
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_utenti_completi_id
    ON public.mv_utenti_completi USING btree
    (id)
    TABLESPACE pg_default;

-- Indice per is_admin
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_is_admin
    ON public.mv_utenti_completi USING btree
    (is_admin)
    TABLESPACE pg_default;

-- Indice per is_attivo
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_is_attivo
    ON public.mv_utenti_completi USING btree
    (is_attivo)
    TABLESPACE pg_default;

-- Indice per nome e cognome
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_nome_cognome
    ON public.mv_utenti_completi USING btree
    (nome COLLATE pg_catalog."default", cognome COLLATE pg_catalog."default")
    TABLESPACE pg_default;

-- Indice per nome_completo
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_nome_completo
    ON public.mv_utenti_completi USING btree
    (nome_completo COLLATE pg_catalog."default")
    TABLESPACE pg_default;

-- Indice per outsider
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_outsider
    ON public.mv_utenti_completi USING btree
    (outsider)
    TABLESPACE pg_default;

-- Indice GIN per punto_vendita_collegato (JSONB)
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_pv_gin
    ON public.mv_utenti_completi USING gin
    (punto_vendita_collegato)
    TABLESPACE pg_default;

-- Indice GIN per ruolo_gdo (JSONB)
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_ruolo_gin
    ON public.mv_utenti_completi USING gin
    (ruolo_gdo)
    TABLESPACE pg_default;

-- Indice per stato
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_stato
    ON public.mv_utenti_completi USING btree
    (stato)
    TABLESPACE pg_default;

-- Indice per tipo
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_tipo
    ON public.mv_utenti_completi USING btree
    (tipo)
    TABLESPACE pg_default;

-- Indice per totale_canali_interazione
CREATE INDEX IF NOT EXISTS idx_mv_utenti_completi_totale_canali
    ON public.mv_utenti_completi USING btree
    (totale_canali_interazione)
    TABLESPACE pg_default;

-- 4. FUNZIONI DI FILTRO PER TIPO UTENTE
-- =====================================================

-- Funzione per ottenere utenti filtrati per tipo utente richiedente
CREATE OR REPLACE FUNCTION public.get_utenti_completi_filtered(
    p_tipo_utente_richiedente TEXT DEFAULT NULL
)
RETURNS SETOF public.mv_utenti_completi
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se non viene specificato il tipo utente, mostra tutti
    IF p_tipo_utente_richiedente IS NULL THEN
        RETURN QUERY
        SELECT * FROM public.mv_utenti_completi;
        RETURN;
    END IF;

    -- Applica filtri basati sul tipo utente richiedente
    CASE p_tipo_utente_richiedente
        WHEN 'Superadmin' THEN
            -- Superadmin vede tutti
            RETURN QUERY
            SELECT * FROM public.mv_utenti_completi;

        WHEN 'GDO' THEN
            -- GDO vede tutti i tipi GDO e PuntoVendita
            RETURN QUERY
            SELECT * FROM public.mv_utenti_completi
            WHERE tipo IN ('GDO', 'PuntoVendita');

        WHEN 'PuntoVendita' THEN
            -- PuntoVendita vede solo i punti vendita
            RETURN QUERY
            SELECT * FROM public.mv_utenti_completi
            WHERE tipo = 'PuntoVendita';

        WHEN 'Agenzia' THEN
            -- Agenzia vede tutti tranne i Superadmin
            RETURN QUERY
            SELECT * FROM public.mv_utenti_completi
            WHERE tipo != 'Superadmin';

        ELSE
            -- Tipo utente non riconosciuto, mostra tutti
            RETURN QUERY
            SELECT * FROM public.mv_utenti_completi;
    END CASE;
END;
$$;

-- 5. FUNZIONI DI REFRESH
-- =====================================================

-- Funzione principale per refresh della materialized view
CREATE OR REPLACE FUNCTION public.refresh_mv_utenti_completi()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Log dell'operazione
    RAISE NOTICE 'Inizio refresh materialized view mv_utenti_completi: %', now();

    -- Refresh della materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_utenti_completi;

    -- Log del completamento
    RAISE NOTICE 'Completato refresh materialized view mv_utenti_completi: %', now();

EXCEPTION
    WHEN OTHERS THEN
        -- Log dell'errore
        RAISE WARNING 'Errore durante refresh materialized view mv_utenti_completi: %', SQLERRM;
        RAISE;
END;
$$;

-- Funzione per refresh con parametri
CREATE OR REPLACE FUNCTION public.refresh_mv_utenti_completi_with_params(
    p_concurrent BOOLEAN DEFAULT true,
    p_analyze BOOLEAN DEFAULT true
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Log dell'operazione
    RAISE NOTICE 'Inizio refresh materialized view mv_utenti_completi (concurrent: %, analyze: %): %',
                 p_concurrent, p_analyze, now();

    -- Refresh della materialized view con parametri
    IF p_concurrent THEN
        REFRESH MATERIALIZED VIEW CONCURRENTLY public.mv_utenti_completi;
    ELSE
        REFRESH MATERIALIZED VIEW public.mv_utenti_completi;
    END IF;

    -- Analisi delle statistiche se richiesta
    IF p_analyze THEN
        ANALYZE public.mv_utenti_completi;
    END IF;

    -- Log del completamento
    RAISE NOTICE 'Completato refresh materialized view mv_utenti_completi: %', now();

EXCEPTION
    WHEN OTHERS THEN
        -- Log dell'errore
        RAISE WARNING 'Errore durante refresh materialized view mv_utenti_completi: %', SQLERRM;
        RAISE;
END;
$$;

-- 6. GRANT PERMISSIONS
-- =====================================================

-- Concedi permessi di lettura
GRANT SELECT ON public.mv_utenti_completi TO PUBLIC;

-- Concedi permessi di esecuzione delle funzioni
GRANT EXECUTE ON FUNCTION public.refresh_mv_utenti_completi() TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.refresh_mv_utenti_completi_with_params(BOOLEAN, BOOLEAN) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_utenti_completi_filtered(TEXT) TO PUBLIC;

-- 7. COMMENTI E DOCUMENTAZIONE
-- =====================================================

COMMENT ON MATERIALIZED VIEW public.mv_utenti_completi IS
'Materialized view completa degli utenti con informazioni aggregate su canali di interazione, ruoli GDO e punti vendita collegati. Aggiornata dall''applicazione dopo ogni modifica agli utenti.';

COMMENT ON FUNCTION public.get_utenti_completi_filtered(TEXT) IS
'Funzione per ottenere utenti filtrati per tipo utente richiedente. Parametri: Superadmin (vede tutti), GDO (vede GDO e PuntoVendita), PuntoVendita (vede solo PuntoVendita), Agenzia (vede tutti tranne Superadmin).';

COMMENT ON FUNCTION public.refresh_mv_utenti_completi() IS
'Funzione per refresh della materialized view mv_utenti_completi con gestione errori e logging.';

COMMENT ON FUNCTION public.refresh_mv_utenti_completi_with_params(BOOLEAN, BOOLEAN) IS
'Funzione per refresh della materialized view con parametri per controllo concorrenza e analisi statistiche.';

-- 8. PRIMO REFRESH
-- =====================================================

-- Esegui il primo refresh per popolare la materialized view
SELECT public.refresh_mv_utenti_completi();
