-- schema-dopo: de4b2d71fe8bba59e5475121a8ee183ab4a9ad0dd87b16ef284aa3faca667e52
-- Oggetti delle versioni precedenti che nessun modello usa: una volta sola.
--
-- Si elimina solo cio' che e' vuoto e non serve a nient'altro; il resto si
-- tiene con un avviso, senza perdere dati.
-- 1. ordini_stampa.datadiconferma_ordinistampa: colonna storica (TIMESTAMP
--    senza fuso, default CURRENT_TIMESTAMP) con dati, non usata dal codice. Si
--    tiene ed e' ora nel modello OrdiniDiStampa, facoltativa: qui si aggiunge
--    dove manca (database della baseline), cosi' lo schema e' uguale ovunque, e
--    si toglie il NOT NULL dove c'e' (il codice non la scrive).
-- 2. utenti."sesso_Utenti" e "meta_Utenti": colonne della vecchia
--    denominazione, rimpiazzate da sesso_utenti e meta_utenti; si eliminano
--    solo se sono tutte NULL.
-- 3. foto_referenze e tipo_utente_punto_vendita: tabelle senza modello; si
--    eliminano solo se vuote e se nessuna chiave esterna le punta.
-- 4. permessi_ruolo_gdo: l'indice univoco a 4 colonne senza COALESCE delle
--    versioni precedenti (nome troncato da PostgreSQL a 63 caratteri) e'
--    quello che 0001 voleva sostituire con permessi_ruolo_gdo_unique_override,
--    ma 0001 lo toglie solo insieme al vincolo legacy a 3 colonne. Non impedisce
--    i doppioni con id_ruolo_utente_gdo NULL e nessun ON CONFLICT lo usa
--    (PermessiRepository.upsertPermessoRuoloGdo cerca e poi inserisce): si
--    elimina solo se c'e' l'indice con COALESCE, che e' piu' restrittivo.
DO $$
DECLARE
  colonna TEXT;
  tabella TEXT;
  valorizzata BOOLEAN;
  piena BOOLEAN;
  tipo_attuale TEXT;
  definizione TEXT;
BEGIN
  -- 1. Colonna storica degli ordini di stampa
  IF to_regclass('public.ordini_stampa') IS NOT NULL THEN
    ALTER TABLE public.ordini_stampa ADD COLUMN IF NOT EXISTS datadiconferma_ordinistampa TIMESTAMP;

    SELECT data_type INTO tipo_attuale FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ordini_stampa'
      AND column_name = 'datadiconferma_ordinistampa';
    IF tipo_attuale <> 'timestamp without time zone' THEN
      RAISE NOTICE 'ordini_stampa.datadiconferma_ordinistampa e'' %, non TIMESTAMP: resta com''e''', tipo_attuale;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'ordini_stampa'
        AND column_name = 'datadiconferma_ordinistampa' AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE public.ordini_stampa ALTER COLUMN datadiconferma_ordinistampa DROP NOT NULL;
    END IF;
  END IF;

  -- 2. Colonne di utenti con la vecchia denominazione (nomi esatti, maiuscole comprese)
  FOREACH colonna IN ARRAY ARRAY['sesso_Utenti', 'meta_Utenti'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'utenti' AND column_name = colonna
    ) THEN
      CONTINUE;
    END IF;

    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.utenti WHERE %I IS NOT NULL)', colonna) INTO valorizzata;
    IF valorizzata THEN
      RAISE NOTICE 'utenti.%: contiene valori, non si elimina', quote_ident(colonna);
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.utenti DROP COLUMN %I', colonna);
    RAISE NOTICE 'utenti.%: vuota, eliminata', quote_ident(colonna);
  END LOOP;

  -- 3. Tabelle senza modello
  FOREACH tabella IN ARRAY ARRAY['foto_referenze', 'tipo_utente_punto_vendita'] LOOP
    IF to_regclass(format('public.%I', tabella)) IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE contype = 'f'
        AND confrelid = to_regclass(format('public.%I', tabella))
        AND conrelid <> confrelid
    ) THEN
      RAISE NOTICE 'Tabella %: puntata da una chiave esterna, non si elimina', tabella;
      CONTINUE;
    END IF;

    EXECUTE format('SELECT EXISTS (SELECT 1 FROM public.%I)', tabella) INTO piena;
    IF piena THEN
      RAISE NOTICE 'Tabella %: contiene righe, non si elimina', tabella;
      CONTINUE;
    END IF;

    -- Senza CASCADE: se qualcos'altro la usa resta dov'e'
    BEGIN
      EXECUTE format('DROP TABLE public.%I', tabella);
      RAISE NOTICE 'Tabella %: vuota, eliminata', tabella;
    EXCEPTION WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'Tabella %: usata da altri oggetti, non si elimina', tabella;
    END;
  END LOOP;

  -- 4. Indice univoco legacy di permessi_ruolo_gdo, superato da quello con COALESCE
  IF to_regclass('public.permessi_ruolo_gdo') IS NOT NULL THEN
    SELECT indexdef INTO definizione FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'permessi_ruolo_gdo'
      AND indexname = 'permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_uten';

    IF definizione IS NULL THEN
      NULL;
    ELSIF definizione ILIKE '%COALESCE%' THEN
      RAISE NOTICE 'permessi_ruolo_gdo: indice permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_uten gia'' con COALESCE, si tiene';
    ELSIF NOT EXISTS (
      SELECT 1 FROM pg_indexes
      WHERE schemaname = 'public' AND tablename = 'permessi_ruolo_gdo'
        AND indexname = 'permessi_ruolo_gdo_unique_override'
        AND indexdef LIKE 'CREATE UNIQUE INDEX%'
        AND indexdef ILIKE '%COALESCE%'
    ) THEN
      RAISE NOTICE 'permessi_ruolo_gdo: manca l''indice univoco con COALESCE, l''indice permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_uten si tiene';
    ELSIF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.permessi_ruolo_gdo'::regclass
        AND conname = 'permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_uten'
    ) THEN
      ALTER TABLE public.permessi_ruolo_gdo
        DROP CONSTRAINT permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_uten;
      RAISE NOTICE 'permessi_ruolo_gdo: vincolo univoco legacy senza COALESCE eliminato';
    ELSE
      DROP INDEX public.permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_uten;
      RAISE NOTICE 'permessi_ruolo_gdo: indice univoco legacy senza COALESCE eliminato';
    END IF;
  END IF;
END $$;
