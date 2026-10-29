-- schema-dopo: de4b2d71fe8bba59e5475121a8ee183ab4a9ad0dd87b16ef284aa3faca667e52
-- Chiavi primarie dei modelli dove mancano: una volta sola.
--
-- gdo_whatsapp_presets.id_gdowhatsappreset e utenti_guest."id_UtentiGuest" sono
-- chiavi primarie nei modelli e nella baseline, ma sulle installazioni vecchie
-- le tabelle non hanno chiave primaria (l'ALTER di Sequelize non la aggiunge) e
-- 0005 ha messo solo il NOT NULL: niente impedisce due righe con lo stesso id,
-- e findByPk, update e destroy le tratterebbero come una.
--
-- Per ogni tabella, solo se c'e' e non ha gia' una chiave primaria:
-- 1. con id NULL o ripetuti la chiave non si crea: un avviso, la tabella resta
--    com'e' e le righe vanno sistemate a mano (yarn migrazioni:verifica la
--    segnala come "chiave primaria mancante"), senza scegliere qui quale
--    doppione tenere;
-- 2. altrimenti si aggiunge con il nome che le da' PostgreSQL (<tabella>_pkey),
--    come sui database creati dalla baseline. Se quel nome e' gia' usato da un
--    altro oggetto (un indice creato a mano) la chiave non si crea, con un avviso.
-- Una tabella che ha gia' una chiave primaria non si tocca; se e' su un'altra
-- colonna lo dice un avviso.
-- Sui database creati dalla baseline le chiavi ci sono gia': non fa nulla.
DO $$
DECLARE
  r RECORD;
  tabella_oid REGCLASS;
  esistente TEXT;
  nulli BIGINT;
  doppi BIGINT;
  chiave TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('gdo_whatsapp_presets', 'id_gdowhatsappreset'),
      ('utenti_guest', 'id_UtentiGuest')
    ) AS v(tabella, colonna)
  LOOP
    tabella_oid := to_regclass(format('public.%I', r.tabella));
    IF tabella_oid IS NULL THEN
      CONTINUE;
    END IF;

    SELECT string_agg(quote_ident(a.attname), ', ') INTO esistente
    FROM pg_constraint k
    JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY (k.conkey)
    WHERE k.conrelid = tabella_oid AND k.contype = 'p';
    IF esistente IS NOT NULL THEN
      IF esistente <> quote_ident(r.colonna) THEN
        RAISE NOTICE 'Tabella %: ha gia'' la chiave primaria su %, diversa dal modello (%)',
          r.tabella, esistente, quote_ident(r.colonna);
      END IF;
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tabella AND column_name = r.colonna
    ) THEN
      RAISE NOTICE 'Tabella %: colonna % assente, chiave primaria non creata', r.tabella, quote_ident(r.colonna);
      CONTINUE;
    END IF;

    -- 1. Prima i dati: una chiave primaria non ammette NULL ne' doppioni
    EXECUTE format(
      'SELECT count(*) - count(%1$I), count(%1$I) - count(DISTINCT %1$I) FROM public.%2$I',
      r.colonna, r.tabella)
      INTO nulli, doppi;
    IF nulli > 0 OR doppi > 0 THEN
      RAISE NOTICE 'Tabella %: % NULL e % doppioni in %, chiave primaria non creata (righe da sistemare a mano)',
        r.tabella, nulli, doppi, quote_ident(r.colonna);
      CONTINUE;
    END IF;

    -- 2. Il nome dell'indice della chiave deve essere libero
    chiave := r.tabella || '_pkey';
    IF to_regclass(format('public.%I', chiave)) IS NOT NULL
      OR EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = tabella_oid AND conname = chiave) THEN
      RAISE NOTICE 'Tabella %: il nome % e'' gia'' usato da un altro oggetto, chiave primaria non creata', r.tabella, chiave;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I PRIMARY KEY (%I)', r.tabella, chiave, r.colonna);
    RAISE NOTICE 'Tabella %: chiave primaria % aggiunta', r.tabella, quote_ident(r.colonna);
  END LOOP;
END $$;
