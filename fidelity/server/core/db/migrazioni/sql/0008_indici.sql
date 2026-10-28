-- schema-dopo: de4b2d71fe8bba59e5475121a8ee183ab4a9ad0dd87b16ef284aa3faca667e52
-- Indici dei modelli: una volta sola.
--
-- 1. Gli indici di utenti dichiarati dal modello mancano sulle installazioni
--    dove l'adozione non ha potuto allineare il modello (si fermava sul tipo di
--    stato_utenti, ora convertito da 0004). Nomi come li genera Sequelize.
--    - utenti_email_utenti e' univoco: se ci sono email ripetute non si crea
--      (avviso) e le righe vanno sistemate a mano.
--    - utenti_meta_utenti e' GIN, non btree: meta_utenti contiene la foto
--      profilo in base64 (fino a 2 MB) e un btree rifiuta le righe oltre ~2,7 KB
--      ("index row size exceeds"), cioe' il salvataggio della foto. Se c'e' gia'
--      con un altro metodo (database creati dalla baseline) si ricrea.
-- 2. Indici nuovi, dichiarati anche nei modelli, per le letture piu' frequenti:
--    promo per GDO e stato e per periodo di validita', tracciati per promo (anche
--    per il ON DELETE CASCADE da promo), attivita' di un utente dalla piu'
--    recente, ultima versione di un file di un kit.
-- Gli indici parziali idx_attivita_* li crea gia' 0001: ora sono anche nel modello.
-- Ogni indice si crea solo se tabella e colonne ci sono (altrimenti un avviso).
-- Niente CONCURRENTLY: le migrazioni girano prima che il server accetti richieste.
DO $$
DECLARE
  r RECORD;
  definizione TEXT;
BEGIN
  IF to_regclass('public.utenti') IS NOT NULL THEN
    -- Un btree su meta_utenti (baseline) blocca le foto profilo: si sostituisce
    SELECT indexdef INTO definizione FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'utenti' AND indexname = 'utenti_meta_utenti';
    IF definizione IS NOT NULL AND definizione NOT ILIKE '%USING gin%' THEN
      DROP INDEX public.utenti_meta_utenti;
      RAISE NOTICE 'Indice utenti_meta_utenti: btree sostituito da GIN';
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'utenti'
        AND column_name = 'meta_utenti' AND udt_name = 'jsonb'
    ) THEN
      CREATE INDEX IF NOT EXISTS utenti_meta_utenti ON public.utenti USING gin (meta_utenti);
    ELSE
      RAISE NOTICE 'utenti.meta_utenti assente o non JSONB: indice utenti_meta_utenti non creato';
    END IF;

    IF to_regclass('public.utenti_email_utenti') IS NULL THEN
      IF EXISTS (
        SELECT 1 FROM public.utenti GROUP BY email_utenti HAVING count(*) > 1
      ) THEN
        RAISE NOTICE 'utenti: email ripetute, indice univoco utenti_email_utenti non creato: tolti i doppioni, va creato con una migrazione nuova';
      ELSE
        CREATE UNIQUE INDEX utenti_email_utenti ON public.utenti (email_utenti);
      END IF;
    END IF;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('utenti_tipo_utenti', 'utenti', ARRAY['tipo_utenti'], 'tipo_utenti'),
      ('utenti_stato_utenti', 'utenti', ARRAY['stato_utenti'], 'stato_utenti'),
      ('utenti_nome_utenti_cognome_utenti', 'utenti', ARRAY['nome_utenti', 'cognome_utenti'], 'nome_utenti, cognome_utenti'),
      ('promo_gdo_stato', 'promo', ARRAY['gdo', 'stato'], 'gdo, stato'),
      ('promo_validita_dal_validita_al', 'promo', ARRAY['validita_dal', 'validita_al'], 'validita_dal, validita_al'),
      ('tracciati_id_promo_tracciati', 'tracciati', ARRAY['id_promo_tracciati'], 'id_promo_tracciati'),
      ('attivita_idutente_attivita_createdat', 'attivita', ARRAY['idutente_attivita', 'createdat'], 'idutente_attivita, createdat DESC'),
      ('files_runtime_log_kit_file_versione', 'files_runtime_log', ARRAY['id_kit_runtime', 'nome_file', 'versione'], 'id_kit_runtime, nome_file, versione DESC')
    ) AS v(nome, tabella, colonne, elenco)
  LOOP
    IF (
      SELECT count(*) FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = r.tabella AND column_name = ANY (r.colonne)
    ) < cardinality(r.colonne) THEN
      RAISE NOTICE 'Indice %: tabella % o colonne % assenti, non creato', r.nome, r.tabella, r.colonne;
      CONTINUE;
    END IF;

    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I (%s)', r.nome, r.tabella, r.elenco);
  END LOOP;
END $$;
