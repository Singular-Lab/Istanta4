-- ============================================================================
-- Stored Procedure: sp_report_promozione
-- Descrizione: Genera un report completo di performance per una o più
--              promozioni di una GDO, attraversando l'intera catena:
--              promo → runtime_kit → referenze → files_runtime → ordini_stampa
--
-- Parametri:
--   p_id_gdo       TEXT    - Identificativo della GDO (obbligatorio)
--   p_id_promo     TEXT    - ID di una singola promo (NULL = tutte)
--   p_data_da      DATE    - Filtro data inizio validità (NULL = nessun filtro)
--   p_data_a       DATE    - Filtro data fine validità (NULL = nessun filtro)
--   p_stato        TEXT    - Filtro stato promo (NULL = tutti gli stati)
--
-- Restituisce una riga per promozione con:
--   - dati anagrafici della promo
--   - conteggi kit totali e per stato lavorazione
--   - conteggi referenze e file
--   - stato ordini di stampa
--   - percentuali di completamento
--   - durata media lavorazione
-- ============================================================================

DROP FUNCTION IF EXISTS sp_report_promozione(TEXT, TEXT, DATE, DATE, TEXT);

CREATE OR REPLACE FUNCTION sp_report_promozione(
    p_id_gdo       TEXT,
    p_id_promo     TEXT     DEFAULT NULL,
    p_data_da      DATE     DEFAULT NULL,
    p_data_a       DATE     DEFAULT NULL,
    p_stato        TEXT     DEFAULT NULL
)
RETURNS TABLE (
    -- Anagrafica promo
    id_promo                TEXT,
    nome_promo              VARCHAR,
    stato                   TEXT,
    validita_dal            DATE,
    validita_al             DATE,
    data_registrazione      DATE,

    -- Kit runtime
    totale_kit              BIGINT,
    kit_in_lavorazione      BIGINT,
    kit_pubblicati          BIGINT,
    kit_in_revisione        BIGINT,
    kit_con_errori          BIGINT,
    kit_eliminati           BIGINT,

    -- Referenze
    totale_referenze        BIGINT,
    referenze_con_foto      BIGINT,
    referenze_con_foto_extra BIGINT,
    media_referenze_per_kit NUMERIC,

    -- File
    totale_file             BIGINT,
    file_con_errori         BIGINT,
    file_opzionali          BIGINT,

    -- Ordini di stampa
    totale_ordini_stampa    BIGINT,
    ordini_finiti           BIGINT,
    ordini_in_revisione     BIGINT,
    ordini_con_errore       BIGINT,

    -- Metriche calcolate
    perc_kit_completati     NUMERIC,
    perc_file_ok            NUMERIC,
    durata_media_lavorazione_ore NUMERIC,
    giorni_alla_scadenza    INTEGER
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
    RETURN QUERY
    WITH promo_filtrate AS (
        SELECT p.*
        FROM promo p
        WHERE p.gdo = p_id_gdo
          AND (p_id_promo IS NULL OR p.id_promo = p_id_promo)
          AND (p_data_da  IS NULL OR p.validita_dal >= p_data_da)
          AND (p_data_a   IS NULL OR p.validita_al  <= p_data_a)
          AND (p_stato    IS NULL OR p.stato::TEXT   = p_stato)
    ),

    -- Aggregazione kit per promo
    kit_stats AS (
        SELECT
            rk.id_promo,
            COUNT(*)                                                            AS totale_kit,
            COUNT(*) FILTER (WHERE rk.stato_lavorazione::TEXT = 'IN_LAVORAZIONE')       AS kit_in_lavorazione,
            COUNT(*) FILTER (WHERE rk.stato_lavorazione::TEXT = 'PUBBLICATO')            AS kit_pubblicati,
            COUNT(*) FILTER (WHERE rk.stato_lavorazione::TEXT = 'IN_REVISIONE')          AS kit_in_revisione,
            COUNT(*) FILTER (WHERE rk.stato_lavorazione::TEXT = 'IN_LAVORAZIONE_CON_ERRORI') AS kit_con_errori,
            COUNT(*) FILTER (WHERE rk.stato_lavorazione::TEXT = 'ELIMINATO')             AS kit_eliminati,
            AVG(
                CASE
                    WHEN rk.fine_lavorazione IS NOT NULL AND rk.inizio_lavorazione IS NOT NULL
                    THEN EXTRACT(EPOCH FROM (rk.fine_lavorazione - rk.inizio_lavorazione)) / 3600.0
                    ELSE NULL
                END
            ) AS durata_media_ore
        FROM runtime_kit rk
        INNER JOIN promo_filtrate pf ON rk.id_promo = pf.id_promo
        GROUP BY rk.id_promo
    ),

    -- Aggregazione referenze per promo
    ref_stats AS (
        SELECT
            r.id_promo,
            COUNT(*)                                                   AS totale_referenze,
            COUNT(*) FILTER (WHERE array_length(r.foto, 1) > 0)       AS referenze_con_foto,
            COUNT(*) FILTER (WHERE jsonb_array_length(r.foto_extra) > 0) AS referenze_con_foto_extra
        FROM referenze r
        INNER JOIN promo_filtrate pf ON r.id_promo = pf.id_promo
        GROUP BY r.id_promo
    ),

    -- Aggregazione file per promo (via runtime_kit)
    file_stats AS (
        SELECT
            rk.id_promo,
            COUNT(fr.id)                                              AS totale_file,
            COUNT(fr.id) FILTER (WHERE fr.error IS NOT NULL AND fr.error <> '') AS file_con_errori,
            COUNT(fr.id) FILTER (WHERE fr.is_optional = TRUE)         AS file_opzionali
        FROM files_runtime fr
        INNER JOIN runtime_kit rk ON fr.id_runtime = rk.id
        INNER JOIN promo_filtrate pf ON rk.id_promo = pf.id_promo
        GROUP BY rk.id_promo
    ),

    -- Aggregazione ordini di stampa per promo
    ods_stats AS (
        SELECT
            os.id_promo_ordinistampa                                  AS id_promo,
            COUNT(*)                                                  AS totale_ordini,
            COUNT(*) FILTER (WHERE os.stato_ordinistampa::TEXT = 'FINITO')       AS ordini_finiti,
            COUNT(*) FILTER (WHERE os.stato_ordinistampa::TEXT = 'IN_REVISIONE') AS ordini_in_revisione,
            COUNT(*) FILTER (WHERE os.stato_ordinistampa::TEXT = 'ERRORE')       AS ordini_con_errore
        FROM ordini_stampa os
        INNER JOIN promo_filtrate pf ON os.id_promo_ordinistampa = pf.id_promo
        GROUP BY os.id_promo_ordinistampa
    )

    -- Unione finale
    SELECT
        pf.id_promo::TEXT,
        pf.nome_promo,
        pf.stato::TEXT,
        pf.validita_dal::DATE,
        pf.validita_al::DATE,
        pf.data_registrazione::DATE,

        -- Kit
        COALESCE(ks.totale_kit, 0),
        COALESCE(ks.kit_in_lavorazione, 0),
        COALESCE(ks.kit_pubblicati, 0),
        COALESCE(ks.kit_in_revisione, 0),
        COALESCE(ks.kit_con_errori, 0),
        COALESCE(ks.kit_eliminati, 0),

        -- Referenze
        COALESCE(rs.totale_referenze, 0),
        COALESCE(rs.referenze_con_foto, 0),
        COALESCE(rs.referenze_con_foto_extra, 0),
        CASE
            WHEN COALESCE(ks.totale_kit, 0) > 0
            THEN ROUND(COALESCE(rs.totale_referenze, 0)::NUMERIC / ks.totale_kit, 2)
            ELSE 0
        END,

        -- File
        COALESCE(fs.totale_file, 0),
        COALESCE(fs.file_con_errori, 0),
        COALESCE(fs.file_opzionali, 0),

        -- Ordini di stampa
        COALESCE(os.totale_ordini, 0),
        COALESCE(os.ordini_finiti, 0),
        COALESCE(os.ordini_in_revisione, 0),
        COALESCE(os.ordini_con_errore, 0),

        -- Metriche calcolate
        CASE
            WHEN COALESCE(ks.totale_kit, 0) > 0
            THEN ROUND(
                (COALESCE(ks.kit_pubblicati, 0)::NUMERIC / ks.totale_kit) * 100, 1
            )
            ELSE 0
        END,
        CASE
            WHEN COALESCE(fs.totale_file, 0) > 0
            THEN ROUND(
                ((COALESCE(fs.totale_file, 0) - COALESCE(fs.file_con_errori, 0))::NUMERIC / fs.totale_file) * 100, 1
            )
            ELSE 100
        END,
        ROUND(COALESCE(ks.durata_media_ore, 0)::NUMERIC, 2),
        CASE
            WHEN pf.validita_al IS NOT NULL
            THEN (pf.validita_al::DATE - CURRENT_DATE)
            ELSE NULL
        END

    FROM promo_filtrate pf
    LEFT JOIN kit_stats  ks ON pf.id_promo = ks.id_promo
    LEFT JOIN ref_stats  rs ON pf.id_promo = rs.id_promo
    LEFT JOIN file_stats fs ON pf.id_promo = fs.id_promo
    LEFT JOIN ods_stats  os ON pf.id_promo = os.id_promo

    ORDER BY pf.validita_dal DESC NULLS LAST;
END;
$$;

-- ============================================================================
-- Esempi di utilizzo:
--
-- 1. Report completo per una GDO:
--    SELECT * FROM sp_report_promozione('id-della-gdo');
--
-- 2. Singola promozione:
--    SELECT * FROM sp_report_promozione('id-gdo', 'id-promo');
--
-- 3. Promozioni in un intervallo di date:
--    SELECT * FROM sp_report_promozione('id-gdo', NULL, '2026-01-01', '2026-03-31');
--
-- 4. Solo promozioni in lavorazione:
--    SELECT * FROM sp_report_promozione('id-gdo', NULL, NULL, NULL, 'IN_LAVORAZIONE');
--
-- 5. Promozioni con kit con errori (filtraggio lato client):
--    SELECT * FROM sp_report_promozione('id-gdo')
--    WHERE kit_con_errori > 0;
--
-- 6. Top 5 promozioni più grandi per referenze:
--    SELECT * FROM sp_report_promozione('id-gdo')
--    ORDER BY totale_referenze DESC LIMIT 5;
--
-- 7. Promozioni in scadenza nei prossimi 7 giorni:
--    SELECT * FROM sp_report_promozione('id-gdo')
--    WHERE giorni_alla_scadenza BETWEEN 0 AND 7;
-- ============================================================================
