-- =====================================================
-- VIEW ATTIVITÀ CON FILTRI PER TIPO UTENTE
-- Include: Filtri automatici basati sui permessi utente
-- Include: Cutoff temporale per nuovi utenti
-- Include: Categoria e priorità attività
-- =====================================================

-- Rimozione view e funzioni esistenti
DROP VIEW IF EXISTS public.v_attivita CASCADE;
DROP FUNCTION IF EXISTS public.get_attivita_filtered(TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.get_attivita_advanced(TEXT, TEXT, TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_attivita_for_user(UUID, TEXT, INTEGER, INTEGER) CASCADE;
DROP FUNCTION IF EXISTS public.get_attivita_for_user(UUID, TEXT, INTEGER, INTEGER, TEXT, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.count_unread_attivita_for_user(UUID, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.cleanup_expired_attivita() CASCADE;

-- Creazione ENUM per categoria e priorità (se non esistono)
DO $$ BEGIN
    CREATE TYPE categoria_attivita_enum AS ENUM ('ACCOUNT', 'PRODUZIONE', 'PUBBLICAZIONE', 'STAMPA', 'INTEGRAZIONI');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE priorita_attivita_enum AS ENUM ('ALTA', 'MEDIA', 'BASSA');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Aggiungi colonne alla tabella attivita se non esistono
DO $$ BEGIN
    ALTER TABLE attivita ADD COLUMN categoria_attivita VARCHAR(50);
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE attivita ADD COLUMN priorita_attivita VARCHAR(20) DEFAULT 'MEDIA';
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE attivita ADD COLUMN expires_at TIMESTAMP;
EXCEPTION
    WHEN duplicate_column THEN null;
END $$;

-- Creazione indice per expires_at per ottimizzare cleanup
CREATE INDEX IF NOT EXISTS idx_attivita_expires_at ON attivita(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attivita_categoria ON attivita(categoria_attivita) WHERE categoria_attivita IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attivita_priorita ON attivita(priorita_attivita) WHERE priorita_attivita IS NOT NULL;

-- Creazione view base per le attività (include nuovi campi)
CREATE OR REPLACE VIEW public.v_attivita AS
SELECT
    a.id_attivita AS id,
    a.createdat AS data_creazione,
    a.idutente_attivita AS assegnato_a_id,
    CASE
        WHEN u.id_utenti IS NULL THEN 'System'
        ELSE COALESCE(u.nome_utenti, 'N/A')
    END AS nome_assegnato,
    CASE
        WHEN u.id_utenti IS NULL THEN ''
        ELSE COALESCE(u.cognome_utenti, 'N/A')
    END AS cognome_assegnato,
    a.tipo_attivita AS tipo,
    a.meta_attivita AS meta,
    a.categoria_attivita AS categoria,
    a.priorita_attivita AS priorita,
    a.expires_at,
    u.tipo_utenti AS tipo_utente_assegnato,
    u.stato_utenti AS stato_utente_assegnato,
    u.email_utenti AS email_assegnato,
    a.updatedat AS data_aggiornamento,
    CASE
        WHEN a.updatedat > a.createdat THEN true
        ELSE false
    END AS is_aggiornata,
    CASE
        WHEN u.meta_utenti->>'photo' IS NOT NULL AND (
            COALESCE(u.meta_utenti->>'photoPrivacy', 'tutti') = 'tutti'
        ) THEN u.meta_utenti->>'photo'
        ELSE NULL
    END AS photo,
    COALESCE(u.meta_utenti->>'photoPrivacy', 'tutti') AS photo_privacy,
    CASE
        WHEN au.id_attivita_utente IS NOT NULL THEN true
        ELSE false
    END AS is_read
FROM
    attivita a
LEFT JOIN
    utenti u ON a.idutente_attivita = u.id_utenti
LEFT JOIN
    attivita_utente au ON a.id_attivita = au.id_attivita_attivita_utente
WHERE
    -- Escludi attività scadute
    (a.expires_at IS NULL OR a.expires_at > NOW())
ORDER BY
    a.createdat DESC;

-- Funzione per ottenere attività filtrate per tipo utente richiedente
CREATE OR REPLACE FUNCTION public.get_attivita_filtered(
    p_tipo_utente_richiedente TEXT DEFAULT NULL
)
RETURNS SETOF public.v_attivita
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Se non viene specificato il tipo utente, mostra tutte le attività
    IF p_tipo_utente_richiedente IS NULL THEN
        RETURN QUERY
        SELECT * FROM public.v_attivita;
        RETURN;
    END IF;

    -- Applica filtri basati sul tipo utente richiedente
    CASE p_tipo_utente_richiedente
        WHEN 'Superadmin' THEN
            -- Superadmin vede tutte le attività
            RETURN QUERY
            SELECT * FROM public.v_attivita;

        WHEN 'GDO' THEN
            -- GDO vede solo attività assegnate a utenti GDO e PuntoVendita
            RETURN QUERY
            SELECT * FROM public.v_attivita
            WHERE tipo_utente_assegnato IN ('GDO', 'PuntoVendita');

        WHEN 'PuntoVendita' THEN
            -- PuntoVendita vede solo attività assegnate a punti vendita
            RETURN QUERY
            SELECT * FROM public.v_attivita
            WHERE tipo_utente_assegnato = 'PuntoVendita';

        WHEN 'Agenzia' THEN
            -- Agenzia vede tutte le attività tranne quelle assegnate a Superadmin
            RETURN QUERY
            SELECT * FROM public.v_attivita
            WHERE tipo_utente_assegnato != 'Superadmin';

        ELSE
            -- Tipo utente non riconosciuto, mostra tutte le attività
            RETURN QUERY
            SELECT * FROM public.v_attivita;
    END CASE;
END;
$$;

-- Funzione per ottenere attività con filtri avanzati
CREATE OR REPLACE FUNCTION public.get_attivita_advanced(
    p_tipo_utente_richiedente TEXT DEFAULT NULL,
    p_tipo_attivita TEXT DEFAULT NULL,
    p_tipo_utente_assegnato TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT NULL,
    p_offset INTEGER DEFAULT 0
)
RETURNS SETOF public.v_attivita
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_query TEXT;
    v_where_conditions TEXT := '';
BEGIN
    -- Costruisci la query base
    v_query := 'SELECT * FROM public.v_attivita';

    -- Applica filtri per tipo utente richiedente
    IF p_tipo_utente_richiedente IS NOT NULL THEN
        CASE p_tipo_utente_richiedente
            WHEN 'Superadmin' THEN
                -- Nessun filtro aggiuntivo
                NULL;
            WHEN 'GDO' THEN
                v_where_conditions := ' WHERE tipo_utente_assegnato IN (''GDO'', ''PuntoVendita'')';
            WHEN 'PuntoVendita' THEN
                v_where_conditions := ' WHERE tipo_utente_assegnato = ''PuntoVendita''';
            WHEN 'Agenzia' THEN
                v_where_conditions := ' WHERE tipo_utente_assegnato != ''Superadmin''';
        END CASE;
    END IF;

    -- Aggiungi filtri opzionali
    IF p_tipo_attivita IS NOT NULL THEN
        IF v_where_conditions = '' THEN
            v_where_conditions := ' WHERE tipo = ' || quote_literal(p_tipo_attivita);
        ELSE
            v_where_conditions := v_where_conditions || ' AND tipo = ' || quote_literal(p_tipo_attivita);
        END IF;
    END IF;

    IF p_tipo_utente_assegnato IS NOT NULL THEN
        IF v_where_conditions = '' THEN
            v_where_conditions := ' WHERE tipo_utente_assegnato = ' || quote_literal(p_tipo_utente_assegnato);
        ELSE
            v_where_conditions := v_where_conditions || ' AND tipo_utente_assegnato = ' || quote_literal(p_tipo_utente_assegnato);
        END IF;
    END IF;

    -- Aggiungi LIMIT e OFFSET se specificati
    IF p_limit IS NOT NULL THEN
        v_where_conditions := v_where_conditions || ' LIMIT ' || p_limit || ' OFFSET ' || p_offset;
    END IF;

    -- Esegui la query finale
    RETURN QUERY
    EXECUTE v_query || v_where_conditions;
END;
$$;

-- Funzione PRINCIPALE per ottenere attività con:
-- 1. is_read corretto per l'utente specifico
-- 2. Cutoff temporale: l'utente vede solo attività create DOPO la sua registrazione
-- 3. Filtri per categoria e priorità
CREATE OR REPLACE FUNCTION public.get_attivita_for_user(
    p_user_id UUID,
    p_tipo_utente_richiedente TEXT DEFAULT NULL,
    p_limit INTEGER DEFAULT NULL,
    p_offset INTEGER DEFAULT 0,
    p_categoria TEXT DEFAULT NULL,
    p_solo_non_lette BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
    id UUID,
    data_creazione TIMESTAMPTZ,
    assegnato_a_id UUID,
    nome_assegnato TEXT,
    cognome_assegnato TEXT,
    tipo TEXT,
    meta JSONB,
    categoria TEXT,
    priorita TEXT,
    tipo_utente_assegnato TEXT,
    stato_utente_assegnato TEXT,
    email_assegnato TEXT,
    data_aggiornamento TIMESTAMPTZ,
    is_aggiornata BOOLEAN,
    photo TEXT,
    photo_privacy TEXT,
    is_read BOOLEAN,
    expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_created_at TIMESTAMPTZ;
BEGIN
    -- Recupera la data di creazione dell'utente per il cutoff
    SELECT u.createdat INTO v_user_created_at
    FROM utenti u
    WHERE u.id_utenti = p_user_id;

    -- Se l'utente non esiste, usa una data molto vecchia (vede tutto)
    IF v_user_created_at IS NULL THEN
        v_user_created_at := '1970-01-01'::TIMESTAMPTZ;
    END IF;

    RETURN QUERY
    SELECT
        a.id_attivita AS id,
        a.createdat::TIMESTAMPTZ AS data_creazione,
        a.idutente_attivita AS assegnato_a_id,
        (
            CASE
                WHEN u.id_utenti IS NULL THEN 'System'
                ELSE COALESCE(u.nome_utenti, 'N/A')
            END
        )::TEXT AS nome_assegnato,
        (
            CASE
                WHEN u.id_utenti IS NULL THEN ''
                ELSE COALESCE(u.cognome_utenti, 'N/A')
            END
        )::TEXT AS cognome_assegnato,
        a.tipo_attivita::TEXT AS tipo,
        a.meta_attivita AS meta,
        a.categoria_attivita::TEXT AS categoria,
        a.priorita_attivita::TEXT AS priorita,
        u.tipo_utenti::TEXT AS tipo_utente_assegnato,
        u.stato_utenti::TEXT AS stato_utente_assegnato,
        u.email_utenti::TEXT AS email_assegnato,
        a.updatedat::TIMESTAMPTZ AS data_aggiornamento,
        CASE
            WHEN a.updatedat > a.createdat THEN true
            ELSE false
        END AS is_aggiornata,
        CASE
            WHEN u.meta_utenti->>'photo' IS NOT NULL AND (
                COALESCE(u.meta_utenti->>'photoPrivacy', 'tutti') = 'tutti'
                OR a.idutente_attivita = p_user_id
            ) THEN u.meta_utenti->>'photo'
            ELSE NULL
        END AS photo,
        COALESCE(u.meta_utenti->>'photoPrivacy', 'tutti') AS photo_privacy,
        CASE
            WHEN au.id_attivita_utente IS NOT NULL THEN true
            ELSE false
        END AS is_read,
        a.expires_at::TIMESTAMPTZ AS expires_at
    FROM attivita a
    LEFT JOIN utenti u ON a.idutente_attivita = u.id_utenti
    LEFT JOIN attivita_utente au ON a.id_attivita = au.id_attivita_attivita_utente
        AND au.id_utente_attivita_utente = p_user_id
    WHERE
        -- CUTOFF TEMPORALE: Mostra solo attività create dopo la registrazione dell'utente
        a.createdat >= v_user_created_at
        -- Escludi attività scadute
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        -- Filtro per tipo utente richiedente
        -- NOTA: u.tipo_utenti può essere NULL se l'attività non ha utente assegnato
        AND (
            p_tipo_utente_richiedente IS NULL
            OR p_tipo_utente_richiedente = 'Superadmin'
            OR u.tipo_utenti IS NULL  -- Mostra sempre le attività senza utente assegnato
            OR (p_tipo_utente_richiedente = 'GDO' AND u.tipo_utenti IN ('GDO', 'PuntoVendita'))
            OR (p_tipo_utente_richiedente = 'PuntoVendita' AND u.tipo_utenti = 'PuntoVendita')
            OR (p_tipo_utente_richiedente = 'Agenzia' AND u.tipo_utenti != 'Superadmin')
        )
        -- Filtro per categoria (opzionale) - cast a TEXT per confronto
        AND (p_categoria IS NULL OR a.categoria_attivita::TEXT = p_categoria)
        -- Filtro solo non lette (opzionale)
        AND (NOT p_solo_non_lette OR au.id_attivita_utente IS NULL)
    ORDER BY a.createdat DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

-- Funzione per contare le notifiche non lette per utente (con cutoff)
CREATE OR REPLACE FUNCTION public.count_unread_attivita_for_user(
    p_user_id UUID,
    p_tipo_utente_richiedente TEXT DEFAULT NULL
)
RETURNS TABLE (
    totale BIGINT,
    per_categoria JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_created_at TIMESTAMPTZ;
    v_totale BIGINT;
    v_per_categoria JSONB;
BEGIN
    -- Recupera la data di creazione dell'utente per il cutoff
    SELECT u.createdat INTO v_user_created_at
    FROM utenti u
    WHERE u.id_utenti = p_user_id;

    IF v_user_created_at IS NULL THEN
        v_user_created_at := '1970-01-01'::TIMESTAMPTZ;
    END IF;

    -- Conta totale non lette
    SELECT COUNT(*) INTO v_totale
    FROM attivita a
    LEFT JOIN utenti u ON a.idutente_attivita = u.id_utenti
    LEFT JOIN attivita_utente au ON a.id_attivita = au.id_attivita_attivita_utente
        AND au.id_utente_attivita_utente = p_user_id
    WHERE
        a.createdat >= v_user_created_at
        AND (a.expires_at IS NULL OR a.expires_at > NOW())
        AND au.id_attivita_utente IS NULL
        AND (
            p_tipo_utente_richiedente IS NULL
            OR p_tipo_utente_richiedente = 'Superadmin'
            OR u.tipo_utenti IS NULL  -- Mostra sempre le attività senza utente assegnato
            OR (p_tipo_utente_richiedente = 'GDO' AND u.tipo_utenti IN ('GDO', 'PuntoVendita'))
            OR (p_tipo_utente_richiedente = 'PuntoVendita' AND u.tipo_utenti = 'PuntoVendita')
            OR (p_tipo_utente_richiedente = 'Agenzia' AND u.tipo_utenti != 'Superadmin')
        );

    -- Conta per categoria (usa cast a TEXT per evitare problemi con enum)
    SELECT jsonb_object_agg(categoria, cnt) INTO v_per_categoria
    FROM (
        SELECT
            COALESCE(a.categoria_attivita::TEXT, 'SENZA_CATEGORIA') AS categoria,
            COUNT(*) AS cnt
        FROM attivita a
        LEFT JOIN utenti u ON a.idutente_attivita = u.id_utenti
        LEFT JOIN attivita_utente au ON a.id_attivita = au.id_attivita_attivita_utente
            AND au.id_utente_attivita_utente = p_user_id
        WHERE
            a.createdat >= v_user_created_at
            AND (a.expires_at IS NULL OR a.expires_at > NOW())
            AND au.id_attivita_utente IS NULL
            AND (
                p_tipo_utente_richiedente IS NULL
                OR p_tipo_utente_richiedente = 'Superadmin'
                OR u.tipo_utenti IS NULL  -- Mostra sempre le attività senza utente assegnato
                OR (p_tipo_utente_richiedente = 'GDO' AND u.tipo_utenti IN ('GDO', 'PuntoVendita'))
                OR (p_tipo_utente_richiedente = 'PuntoVendita' AND u.tipo_utenti = 'PuntoVendita')
                OR (p_tipo_utente_richiedente = 'Agenzia' AND u.tipo_utenti != 'Superadmin')
            )
        GROUP BY COALESCE(a.categoria_attivita::TEXT, 'SENZA_CATEGORIA')
    ) sub;

    RETURN QUERY SELECT v_totale, COALESCE(v_per_categoria, '{}'::JSONB);
END;
$$;

-- Funzione per pulizia automatica delle attività scadute
CREATE OR REPLACE FUNCTION public.cleanup_expired_attivita()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted INTEGER;
BEGIN
    -- Elimina prima i record di lettura associati
    DELETE FROM attivita_utente
    WHERE id_attivita_attivita_utente IN (
        SELECT id_attivita FROM attivita WHERE expires_at < NOW()
    );

    -- Poi elimina le attività scadute
    DELETE FROM attivita WHERE expires_at < NOW();
    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN v_deleted;
END;
$$;

-- Grant permissions
GRANT SELECT ON public.v_attivita TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_attivita_filtered(TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_attivita_advanced(TEXT, TEXT, TEXT, INTEGER, INTEGER) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_attivita_for_user(UUID, TEXT, INTEGER, INTEGER, TEXT, BOOLEAN) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.count_unread_attivita_for_user(UUID, TEXT) TO PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_attivita() TO PUBLIC;

-- Commenti e documentazione
COMMENT ON VIEW public.v_attivita IS
'View delle attività con informazioni complete sugli utenti assegnati, categoria, priorità e filtri per tipo utente.';

COMMENT ON FUNCTION public.get_attivita_filtered(TEXT) IS
'Funzione per ottenere attività filtrate per tipo utente richiedente. Parametri: Superadmin (vede tutte), GDO (vede GDO e PuntoVendita), PuntoVendita (vede solo PuntoVendita), Agenzia (vede tutte tranne Superadmin).';

COMMENT ON FUNCTION public.get_attivita_advanced(TEXT, TEXT, TEXT, INTEGER, INTEGER) IS
'Funzione avanzata per ottenere attività con filtri multipli: tipo richiedente, tipo attività, tipo utente assegnato, limit e offset.';

COMMENT ON FUNCTION public.get_attivita_for_user(UUID, TEXT, INTEGER, INTEGER, TEXT, BOOLEAN) IS
'Funzione principale per ottenere attività. Include: cutoff temporale (utente vede solo attività create dopo la sua registrazione), is_read corretto, filtri per categoria e priorità.';

COMMENT ON FUNCTION public.count_unread_attivita_for_user(UUID, TEXT) IS
'Conta le notifiche non lette per un utente, rispettando il cutoff temporale. Restituisce totale e conteggio per categoria.';

COMMENT ON FUNCTION public.cleanup_expired_attivita() IS
'Elimina le attività scadute (expires_at < NOW()). Restituisce il numero di record eliminati.';
-- =====================================================
-- ONE-SHOT: Assegnazione categoria_attivita
-- ENUM-safe (usa enum_attivita_categoria_attivita)
-- Nessuna funzione, nessun trigger, nessuna tabella
-- =====================================================

UPDATE attivita
SET categoria_attivita =
    CASE
        -- =====================
        -- ACCOUNT
        -- =====================
        WHEN tipo_attivita = 'CREAZIONE_UTENTE'
            THEN 'ACCOUNT'::enum_attivita_categoria_attivita

        WHEN tipo_attivita = 'ELIMINAZIONE_UTENTE'
            THEN 'ACCOUNT'::enum_attivita_categoria_attivita

        WHEN tipo_attivita = 'MODIFICA_WORKSPACE_WEBPLIANT'
            THEN 'ACCOUNT'::enum_attivita_categoria_attivita

        -- =====================
        -- PRODUZIONE
        -- =====================
        WHEN tipo_attivita = 'CREAZIONE_RUNTIME_KIT_AUTOMATICO'
            THEN 'PRODUZIONE'::enum_attivita_categoria_attivita

        WHEN tipo_attivita = 'CREAZIONE_RUNTIME_KIT_MANUALE'
            THEN 'PRODUZIONE'::enum_attivita_categoria_attivita

        WHEN tipo_attivita = 'CREAZIONE_DESIGN_KIT'
            THEN 'PRODUZIONE'::enum_attivita_categoria_attivita

        WHEN tipo_attivita = 'CREAZIONE_LAVORAZIONE'
            THEN 'PRODUZIONE'::enum_attivita_categoria_attivita

        WHEN tipo_attivita = 'UPLOAD_FILE_MANUALE'
            THEN 'PRODUZIONE'::enum_attivita_categoria_attivita

        WHEN tipo_attivita = 'IMPORT_TRACCIATO'
            THEN 'PRODUZIONE'::enum_attivita_categoria_attivita

        -- =====================
        -- PUBBLICAZIONE
        -- =====================
        WHEN tipo_attivita = 'PUBBLICAZIONE_WEBPLIANT'
            THEN 'PUBBLICAZIONE'::enum_attivita_categoria_attivita

        WHEN tipo_attivita = 'INVIO_FILES_FTP'
            THEN 'PUBBLICAZIONE'::enum_attivita_categoria_attivita

        WHEN tipo_attivita = 'INVIO_FILE_CORREGGO'
            THEN 'PUBBLICAZIONE'::enum_attivita_categoria_attivita

        WHEN tipo_attivita = 'PUBBLICAZIONE_FILE_CORREGGO'
            THEN 'PUBBLICAZIONE'::enum_attivita_categoria_attivita

        -- =====================
        -- STAMPA
        -- =====================
        WHEN tipo_attivita = 'CREAZIONE_ORDINE_DI_STAMPA'
            THEN 'STAMPA'::enum_attivita_categoria_attivita

        -- =====================
        -- INTEGRAZIONI
        -- =====================
        WHEN tipo_attivita = 'RICHIESTA_WEBPLIANT'
            THEN 'INTEGRAZIONI'::enum_attivita_categoria_attivita

        -- =====================
        -- FALLBACK DI SICUREZZA
        -- =====================
        ELSE 'INTEGRAZIONI'::enum_attivita_categoria_attivita
    END
WHERE
    categoria_attivita IS NULL;
