-- schema-dopo: 8eea939c7540ae1b1647a64678509ae6790461f9cbbedb63b14841676938be8d
-- Correzioni delle installazioni esistenti, una volta sola.
--
-- Raccoglie cio' che prima girava a ogni avvio: gli script di
-- db/scripts/prima_della_sincronizzazione (tranne l'eliminazione dei tracciati
-- orfani, ora in 0002), fix_permessi_ruolo_unique_indexes.sql, la parte di
-- schema di v_attivita.sql, e il DDL che stava nel codice (migrazioneAccessi,
-- PermessiRepository, migrazioneConfig, versionePermessi).
--
-- Gira su tre tipi di database, quindi ogni passo controlla prima lo stato:
-- - creato dalla baseline 0000: e' gia' allineato ai modelli, qui si
--   aggiunge solo cio' che i modelli non descrivono (indici con COALESCE,
--   indici parziali di attivita, accessi_stato);
-- - installazione esistente adottata dopo l'ultima sincronizzazione legacy;
-- - installazione vecchia aggiornata a salto, senza quella sincronizzazione.


-- 1. Oggetti derivati delle versioni precedenti, che nessuno crea piu'.
-- Sulle installazioni vecchie possono esserci ancora e bloccherebbero l'ALTER
-- delle colonne qui sotto (v_tracciati_completi legge tracciati,
-- v_webhook_statistiche legge webhooks).
DROP MATERIALIZED VIEW IF EXISTS public.mv_aree_canali_combinazioni CASCADE;
DROP VIEW IF EXISTS public.v_utenti_completi_filtered CASCADE;
DROP VIEW IF EXISTS public.v_combinazioni_canale_area_stats CASCADE;
DROP VIEW IF EXISTS public.v_dashboard_utenti_attivita CASCADE;
DROP VIEW IF EXISTS public.v_ordini_stampa_dettagli CASCADE;
DROP VIEW IF EXISTS public.v_punti_vendita_completa CASCADE;
DROP VIEW IF EXISTS public.v_tracciati_completi CASCADE;
DROP VIEW IF EXISTS public.v_webhook_statistiche CASCADE;
DROP FUNCTION IF EXISTS public.refresh_all_materialized_views();
DROP FUNCTION IF EXISTS public.refresh_mv_aree_canali_combinazioni();
DROP FUNCTION IF EXISTS public.sp_report_promozione(TEXT, TEXT, DATE, DATE, TEXT);


-- 2. Tracciati: id_promo_tracciati era UUID, ma promo.id_promo e' VARCHAR,
-- quindi la chiave esterna non si poteva creare. Solo se e' ancora UUID.
-- Le righe orfane non si toccano qui: le gestisce 0002, con una copia.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tracciati'
      AND column_name = 'id_promo_tracciati' AND data_type = 'uuid'
  ) THEN
    ALTER TABLE public.tracciati
      ALTER COLUMN id_promo_tracciati TYPE VARCHAR(255) USING id_promo_tracciati::text;
  END IF;
END $$;


-- 3. Webhook: eventi_webhook era un array di enum_webhooks_eventi_webhook, che
-- l'ALTER di Sequelize non sapeva gestire. Diventa un array di VARCHAR con gli
-- stessi valori. Il default si toglie prima e si rimette dopo con il tipo
-- nuovo: lo faceva la sincronizzazione, che non c'e' piu' (modello: []).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'webhooks'
      AND column_name = 'eventi_webhook' AND udt_name = '_enum_webhooks_eventi_webhook'
  ) THEN
    ALTER TABLE public.webhooks ALTER COLUMN eventi_webhook DROP DEFAULT;
    ALTER TABLE public.webhooks
      ALTER COLUMN eventi_webhook TYPE VARCHAR(255)[] USING eventi_webhook::text[];
    ALTER TABLE public.webhooks
      ALTER COLUMN eventi_webhook SET DEFAULT ARRAY[]::VARCHAR(255)[];
  END IF;
END $$;


-- 4. Indici con il nome generato troncato da PostgreSQL a 63 caratteri: i
-- modelli ora danno un nome esplicito; qui si rinominano quelli esistenti, o
-- si eliminano se l'indice con il nome nuovo c'e' gia'.
DO $$
DECLARE
  rinomina CONSTANT TEXT[][] := ARRAY[
    ['display_context_punto_vendita_id_gdo_display_context_is_active_', 'display_context_pv_gdo_attivo'],
    ['attivita_utente_id_utente_attivita_utente_id_attivita_attivita_', 'attivita_utente_utente_attivita_uq']
  ];
  i INT;
BEGIN
  FOR i IN 1 .. array_length(rinomina, 1) LOOP
    IF to_regclass('public.' || rinomina[i][1]) IS NOT NULL THEN
      IF to_regclass('public.' || rinomina[i][2]) IS NULL THEN
        EXECUTE format('ALTER INDEX public.%I RENAME TO %I', rinomina[i][1], rinomina[i][2]);
      ELSE
        EXECUTE format('DROP INDEX public.%I', rinomina[i][1]);
      END IF;
    END IF;
  END LOOP;
END $$;


-- 5. Chiavi API dei ruoli GDO: a riposo si conserva solo l'hash.
-- L'applicazione salva sha256 della chiave e a ogni richiesta confronta sha256
-- della chiave presentata (middleware/apiKeyAuth.ts, hashApiKey): qui si
-- convertono le chiavi salvate in chiaro, cosi' le integrazioni esistenti
-- continuano a funzionare. Stessa conversione di hashApiKey: sha256 dei byte
-- UTF-8, esadecimale minuscolo.
-- Idempotente: un hash e' di 64 caratteri esadecimali minuscoli e non si
-- tocca, mentre le chiavi emesse da Fidelity sono di 160 caratteri.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ruolo_utente_gdo'
      AND column_name = 'api_key_ruolo_utente_gdo'
  ) THEN
    UPDATE public.ruolo_utente_gdo
    SET api_key_ruolo_utente_gdo = encode(sha256(convert_to(api_key_ruolo_utente_gdo, 'UTF8')), 'hex')
    WHERE api_key_ruolo_utente_gdo IS NOT NULL
      AND api_key_ruolo_utente_gdo <> ''
      AND api_key_ruolo_utente_gdo !~ '^[0-9a-f]{64}$';
  END IF;
END $$;


-- 6. Unicita' dei permessi per ruolo (prima PermessiRepository.migrateLegacyConstraint
-- e fix_permessi_ruolo_unique_indexes.sql, a ogni avvio).
-- Il vincolo legacy a 2 colonne impedisce i permessi per sotto-ruolo GDO;
-- l'indice a 3 colonne dei modelli non impedisce i duplicati quando
-- id_ruolo_utente_gdo e' NULL. Resta un solo indice univoco con COALESCE.
DO $$
BEGIN
  IF to_regclass('public.permessi_ruolo') IS NULL THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.permessi_ruolo'::regclass
      AND conname = 'permessi_ruolo_tipo_utente_id_permesso'
  ) THEN
    ALTER TABLE public.permessi_ruolo DROP CONSTRAINT permessi_ruolo_tipo_utente_id_permesso;
  END IF;
  DROP INDEX IF EXISTS public.permessi_ruolo_tipo_utente_id_permesso;

  -- Senza la colonna del sotto-ruolo l'indice non si puo' creare: lo schema
  -- non e' allineato ai modelli e non e' compito di questa correzione.
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'permessi_ruolo'
      AND column_name = 'id_ruolo_utente_gdo'
  ) THEN
    RAISE NOTICE 'permessi_ruolo senza id_ruolo_utente_gdo: indice univoco con COALESCE non creato';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'permessi_ruolo'
      AND indexname = 'permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo'
      AND indexdef LIKE 'CREATE UNIQUE INDEX%'
      AND indexdef ILIKE '%COALESCE%'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.permessi_ruolo'::regclass
        AND conname = 'permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo'
    ) THEN
      ALTER TABLE public.permessi_ruolo DROP CONSTRAINT permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo;
    END IF;
    DROP INDEX IF EXISTS public.permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo;

    -- Solo qui, dove l'indice univoco va creato: senza la pulizia fallirebbe.
    -- Resta l'ultima riga di ogni gruppo, come in PermessiRepository.
    DELETE FROM public.permessi_ruolo a
    USING public.permessi_ruolo b
    WHERE a.ctid < b.ctid
      AND a.tipo_utente = b.tipo_utente
      AND a.id_permesso = b.id_permesso
      AND a.id_ruolo_utente_gdo IS NOT DISTINCT FROM b.id_ruolo_utente_gdo;

    CREATE UNIQUE INDEX permessi_ruolo_tipo_utente_id_permesso_id_ruolo_utente_gdo
      ON public.permessi_ruolo (
        tipo_utente,
        id_permesso,
        COALESCE(id_ruolo_utente_gdo, '00000000-0000-0000-0000-000000000000'::uuid)
      );
  END IF;
END $$;


-- 7. Unicita' degli override per GDO (prima PermessiRepository.migrateLegacyGdoConstraint,
-- a ogni avvio). Il modello non dichiara l'indice univoco: e' solo qui.
-- Il vincolo legacy a 3 colonne e l'indice di Sequelize a 4 colonne senza
-- COALESCE si tolgono insieme, come faceva il repository.
DO $$
BEGIN
  IF to_regclass('public.permessi_ruolo_gdo') IS NULL THEN
    RETURN;
  END IF;

  IF to_regclass('public.permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.permessi_ruolo_gdo'::regclass
        AND conname = 'permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso'
    ) THEN
      ALTER TABLE public.permessi_ruolo_gdo DROP CONSTRAINT permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso;
    END IF;
    DROP INDEX IF EXISTS public.permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso;

    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conrelid = 'public.permessi_ruolo_gdo'::regclass
        AND conname = 'permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_utente_gdo'
    ) THEN
      ALTER TABLE public.permessi_ruolo_gdo DROP CONSTRAINT permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_utente_gdo;
    END IF;
    DROP INDEX IF EXISTS public.permessi_ruolo_gdo_id_gdo_tipo_utente_id_permesso_id_ruolo_utente_gdo;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'permessi_ruolo_gdo'
      AND column_name = 'id_ruolo_utente_gdo'
  ) THEN
    RAISE NOTICE 'permessi_ruolo_gdo senza id_ruolo_utente_gdo: indice univoco con COALESCE non creato';
    RETURN;
  END IF;

  IF to_regclass('public.permessi_ruolo_gdo_unique_override') IS NULL THEN
    -- Solo qui, dove l'indice univoco va creato: senza la pulizia fallirebbe.
    DELETE FROM public.permessi_ruolo_gdo a
    USING public.permessi_ruolo_gdo b
    WHERE a.ctid < b.ctid
      AND a.id_gdo = b.id_gdo
      AND a.tipo_utente = b.tipo_utente
      AND a.id_permesso = b.id_permesso
      AND a.id_ruolo_utente_gdo IS NOT DISTINCT FROM b.id_ruolo_utente_gdo;

    CREATE UNIQUE INDEX permessi_ruolo_gdo_unique_override
      ON public.permessi_ruolo_gdo (
        id_gdo,
        tipo_utente,
        id_permesso,
        COALESCE(id_ruolo_utente_gdo, '00000000-0000-0000-0000-000000000000'::uuid)
      );
  END IF;
END $$;


-- 8. Sotto-ruolo GDO delle voci di menu (prima migrazioneAccessi, a ogni avvio):
-- serve alla migrazione degli accessi e al menu.
ALTER TABLE IF EXISTS public.menu_items ADD COLUMN IF NOT EXISTS id_ruolo_utente_gdo UUID;


-- 9. Configurazione per GDO (prima migrazioneConfig, a ogni avvio).
ALTER TABLE IF EXISTS public.config ADD COLUMN IF NOT EXISTS id_gdo_config UUID;
ALTER TABLE IF EXISTS public.config ADD COLUMN IF NOT EXISTS funzionalita JSONB;


-- 10. Versione dei permessi condivisa fra i processi (prima versionePermessi,
-- a ogni avvio). Non e' un modello: la crea questa migrazione (versionePermessi la
-- ricrea a runtime se manca, in modo idempotente).
-- schema_accessi parte da 0, cosi' la migrazione degli accessi riconosce
-- un'installazione che non l'ha ancora fatta.
CREATE TABLE IF NOT EXISTS public.accessi_stato (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  versione BIGINT NOT NULL DEFAULT 1,
  schema_accessi INTEGER NOT NULL DEFAULT 0,
  aggiornato_il TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO public.accessi_stato (id) VALUES (1) ON CONFLICT (id) DO NOTHING;


-- 11. Attivita': categoria, priorita' e scadenza (prima v_attivita.sql, a
-- ogni avvio). Sui database allineati ai modelli le colonne ci sono gia'; se
-- mancano si aggiungono con i tipi del modello (models/attivita.ts), non con
-- i VARCHAR del vecchio script. Gli indici parziali non sono nei modelli.
DO $$
BEGIN
  IF to_regclass('public.attivita') IS NULL THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attivita'
      AND column_name = 'categoria_attivita'
  ) THEN
    IF to_regtype('public.enum_attivita_categoria_attivita') IS NULL THEN
      CREATE TYPE public.enum_attivita_categoria_attivita
        AS ENUM ('ACCOUNT', 'PRODUZIONE', 'PUBBLICAZIONE', 'STAMPA', 'INTEGRAZIONI');
    END IF;
    ALTER TABLE public.attivita
      ADD COLUMN categoria_attivita public.enum_attivita_categoria_attivita;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'attivita'
      AND column_name = 'priorita_attivita'
  ) THEN
    IF to_regtype('public.enum_attivita_priorita_attivita') IS NULL THEN
      CREATE TYPE public.enum_attivita_priorita_attivita
        AS ENUM ('ALTA', 'MEDIA', 'BASSA');
    END IF;
    ALTER TABLE public.attivita
      ADD COLUMN priorita_attivita public.enum_attivita_priorita_attivita DEFAULT 'MEDIA';
  END IF;

  ALTER TABLE public.attivita ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

  CREATE INDEX IF NOT EXISTS idx_attivita_expires_at
    ON public.attivita (expires_at) WHERE expires_at IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_attivita_categoria
    ON public.attivita (categoria_attivita) WHERE categoria_attivita IS NOT NULL;
  CREATE INDEX IF NOT EXISTS idx_attivita_priorita
    ON public.attivita (priorita_attivita) WHERE priorita_attivita IS NOT NULL;
END $$;


-- 12. Enum creati da v_attivita.sql e mai usati: il modello usa
-- enum_attivita_*. Si eliminano solo se nessuna colonna li usa.
DO $$
DECLARE
  tipo TEXT;
BEGIN
  FOREACH tipo IN ARRAY ARRAY['categoria_attivita_enum', 'priorita_attivita_enum'] LOOP
    IF to_regtype('public.' || tipo) IS NULL THEN
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE udt_schema = 'public' AND udt_name IN (tipo, '_' || tipo)
    ) THEN
      RAISE NOTICE 'Tipo % usato da una colonna: non si elimina', tipo;
      CONTINUE;
    END IF;

    -- Qualcos'altro lo usa (una funzione, un dominio): resta dov'e'.
    BEGIN
      EXECUTE format('DROP TYPE public.%I', tipo);
    EXCEPTION WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'Tipo % ancora usato: non si elimina', tipo;
    END;
  END LOOP;
END $$;
