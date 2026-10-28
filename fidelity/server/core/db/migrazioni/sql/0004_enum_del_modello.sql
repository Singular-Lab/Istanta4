-- schema-dopo: de4b2d71fe8bba59e5475121a8ee183ab4a9ad0dd87b16ef284aa3faca667e52
-- Enum dei modelli al posto dei tipi delle versioni precedenti: una volta sola.
--
-- Sulle installazioni nate dagli script SQL di prima alcune colonne usano ancora
-- i tipi "STATO_UTENTI", "TIPO_UTENTE", "TIPO_ATTIVITA",
-- "STATO_COMBINAZIONE_CANALE_AREA", "STATO_ORDINI_STAMPA" e
-- "MODALITA_TIPO_DI_EXPORT", e attivita.categoria_attivita/priorita_attivita
-- sono VARCHAR. L'ALTER di Sequelize non li sapeva convertire (l'adozione si
-- fermava su questi modelli, e il resto del loro allineamento non girava) e
-- "STATO_ORDINI_STAMPA" non ha IN_INVIO, che serve al blocco dell'invio FTP.
--
-- Per ogni colonna, solo se non usa gia' l'enum del modello:
-- 1. i valori nei dati devono stare nell'enum del modello: altrimenti la
--    migrazione si ferma con l'elenco dei valori da correggere;
-- 2. l'enum del modello si crea con i valori del modello se manca; se c'e' ma
--    gli mancano valori si ricrea completo, o, se lo usa gia' un'altra colonna,
--    gli si aggiungono (ma un valore aggiunto si usa solo dopo il commit: se
--    servisse subito ai dati ci si ferma con le istruzioni);
-- 3. il default si toglie (non si converte da solo), la colonna si converte
--    passando dal testo e si rimette il default del modello, se ne ha uno;
-- 4. alla fine il tipo vecchio si elimina, solo se niente lo usa piu'.
-- Sui database creati dalla baseline le colonne usano gia' gli enum: non fa nulla.
-- Le view sono gia' tolte dal runner e non bloccano l'ALTER.
--
-- I valori devono restare uguali a quelli dei modelli (schema.json): lo
-- controlla db/__tests__/migrazioniCorrettive.test.ts.
DO $$
DECLARE
  r RECORD;
  tabella_oid REGCLASS;
  tipo_attuale OID;
  tipo_modello OID;
  default_attuale TEXT;
  elenco TEXT;
  valore TEXT;
  sconosciuti TEXT[];
  mancanti TEXT[];
  aggiunti TEXT[];
  usati TEXT[];
  vecchi OID[] := ARRAY[]::OID[];
  vecchio OID;
  nome_vecchio TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('utenti', 'stato_utenti', 'enum_utenti_stato_utenti',
        ARRAY['ATTIVO', 'DISATTIVO', 'BLOCCATO', 'SOSPESO', 'ELIMINATO'], 'ATTIVO'),
      ('utenti', 'tipo_utenti', 'enum_utenti_tipo_utenti',
        ARRAY['Superadmin', 'Agenzia', 'Guest', 'PuntoVendita', 'GDO', 'Category', 'Marketing', 'IT'], NULL),
      ('attivita', 'tipo_attivita', 'enum_attivita_tipo_attivita',
        ARRAY['CREAZIONE_UTENTE', 'ELIMINAZIONE_UTENTE', 'CREAZIONE_RUNTIME_KIT_AUTOMATICO',
          'CREAZIONE_RUNTIME_KIT_MANUALE', 'UPLOAD_FILE_MANUALE', 'MODIFICA_WORKSPACE_WEBPLIANT',
          'CREAZIONE_DESIGN_KIT', 'IMPORT_TRACCIATO', 'CREAZIONE_LAVORAZIONE', 'PUBBLICAZIONE_WEBPLIANT',
          'RICHIESTA_WEBPLIANT', 'CREAZIONE_ORDINE_DI_STAMPA', 'INVIO_FILES_FTP', 'INVIO_FILE_CORREGGO',
          'PUBBLICAZIONE_FILE_CORREGGO'], NULL),
      ('attivita', 'categoria_attivita', 'enum_attivita_categoria_attivita',
        ARRAY['ACCOUNT', 'PRODUZIONE', 'PUBBLICAZIONE', 'STAMPA', 'INTEGRAZIONI'], NULL),
      ('attivita', 'priorita_attivita', 'enum_attivita_priorita_attivita',
        ARRAY['ALTA', 'MEDIA', 'BASSA'], 'MEDIA'),
      ('combinazione_canale_area', 'stato_combinazione_canale_area', 'enum_combinazione_canale_area_stato_combinazione_canale_area',
        ARRAY['ATTIVO', 'DISATTIVO'], NULL),
      ('ordini_stampa', 'stato_ordinistampa', 'enum_ordini_stampa_stato_ordinistampa',
        ARRAY['ERRORE', 'IN_REVISIONE', 'IN_INVIO', 'REVISIONATO', 'FINITO'], NULL),
      ('tipi_export', 'modalita_tipiexport', 'enum_tipi_export_modalita_tipiexport',
        ARRAY['ESPORTA_TUTTO_INSIEME', 'ESPORTA_PER_PAGINA'], NULL)
    ) AS v(tabella, colonna, tipo, valori, predefinito)
  LOOP
    tabella_oid := to_regclass(format('public.%I', r.tabella));
    IF tabella_oid IS NULL THEN
      CONTINUE;
    END IF;

    SELECT a.atttypid, pg_get_expr(d.adbin, d.adrelid)
      INTO tipo_attuale, default_attuale
    FROM pg_attribute a
    LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
    WHERE a.attrelid = tabella_oid AND a.attname = r.colonna
      AND a.attnum > 0 AND NOT a.attisdropped;
    IF NOT FOUND THEN
      RAISE NOTICE 'Colonna %.% assente: non si converte', r.tabella, r.colonna;
      CONTINUE;
    END IF;

    tipo_modello := to_regtype(format('public.%I', r.tipo));
    IF tipo_modello IS NOT NULL AND tipo_attuale = tipo_modello THEN
      CONTINUE;
    END IF;

    -- 1. Un valore che il modello non conosce non si puo' convertire: si
    -- corregge a mano, senza scegliere qui al posto di chi conosce i dati.
    EXECUTE format(
      'SELECT array_agg(DISTINCT %1$I::text ORDER BY %1$I::text) FROM public.%2$I
       WHERE %1$I IS NOT NULL AND NOT (%1$I::text = ANY ($1))',
      r.colonna, r.tabella)
      INTO sconosciuti USING r.valori;
    IF sconosciuti IS NOT NULL THEN
      RAISE EXCEPTION 'Colonna %.%: valori % non previsti dall''enum del modello % (%). Correggere i dati e riavviare',
        r.tabella, r.colonna, sconosciuti, r.tipo, array_to_string(r.valori, ', ');
    END IF;

    -- 2. Enum del modello, con tutti i valori del modello.
    SELECT string_agg(quote_literal(u.v), ', ' ORDER BY u.n) INTO elenco
    FROM unnest(r.valori) WITH ORDINALITY AS u(v, n);
    aggiunti := ARRAY[]::TEXT[];
    IF tipo_modello IS NULL THEN
      EXECUTE format('CREATE TYPE public.%I AS ENUM (%s)', r.tipo, elenco);
    ELSE
      SELECT array_agg(u.v ORDER BY u.n) INTO mancanti
      FROM unnest(r.valori) WITH ORDINALITY AS u(v, n)
      WHERE NOT EXISTS (
        SELECT 1 FROM pg_enum e WHERE e.enumtypid = tipo_modello AND e.enumlabel = u.v
      );
      IF mancanti IS NOT NULL THEN
        BEGIN
          -- Di solito non lo usa nessuno (l'aveva creato l'ALTER fallito di
          -- Sequelize): si ricrea completo, e i valori si usano subito.
          EXECUTE format('DROP TYPE public.%I', r.tipo);
          EXECUTE format('CREATE TYPE public.%I AS ENUM (%s)', r.tipo, elenco);
        EXCEPTION WHEN dependent_objects_still_exist THEN
          FOREACH valore IN ARRAY mancanti LOOP
            EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', r.tipo, valore);
          END LOOP;
          aggiunti := mancanti;
        END;
      END IF;
    END IF;

    -- Un valore appena aggiunto con ADD VALUE non si usa nella stessa transazione.
    IF cardinality(aggiunti) > 0 THEN
      EXECUTE format(
        'SELECT array_agg(DISTINCT %1$I::text) FROM public.%2$I WHERE %1$I::text = ANY ($1)',
        r.colonna, r.tabella)
        INTO usati USING aggiunti;
      IF usati IS NOT NULL THEN
        RAISE EXCEPTION 'Colonna %.%: il tipo % e'' usato da altre colonne e non ha i valori % che servono ai dati. Aggiungerli a mano (ALTER TYPE public.% ADD VALUE ...) e riavviare',
          r.tabella, r.colonna, r.tipo, usati, r.tipo;
      END IF;
    END IF;

    -- 3. Il default del tipo vecchio non si converte: si toglie e si rimette
    -- quello del modello.
    IF default_attuale IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT', r.tabella, r.colonna);
    END IF;
    EXECUTE format(
      'ALTER TABLE public.%1$I ALTER COLUMN %2$I TYPE public.%3$I USING %2$I::text::public.%3$I',
      r.tabella, r.colonna, r.tipo);
    IF r.predefinito IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %L::public.%I',
        r.tabella, r.colonna, r.predefinito, r.tipo);
    ELSIF default_attuale IS NOT NULL THEN
      RAISE NOTICE 'Colonna %.%: tolto il default %, il modello non ne ha', r.tabella, r.colonna, default_attuale;
    END IF;
    RAISE NOTICE 'Colonna %.% convertita in %', r.tabella, r.colonna, r.tipo;

    IF EXISTS (SELECT 1 FROM pg_type WHERE oid = tipo_attuale AND typtype = 'e')
      AND NOT (tipo_attuale = ANY (vecchi)) THEN
      vecchi := vecchi || tipo_attuale;
    END IF;
  END LOOP;

  -- 4. Tipi vecchi: si eliminano solo se nessun altro oggetto li usa.
  FOREACH vecchio IN ARRAY vecchi LOOP
    nome_vecchio := vecchio::regtype::text;
    BEGIN
      EXECUTE format('DROP TYPE %s', nome_vecchio);
      RAISE NOTICE 'Tipo % eliminato', nome_vecchio;
    EXCEPTION WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'Tipo % ancora usato: non si elimina', nome_vecchio;
    END;
  END LOOP;
END $$;
