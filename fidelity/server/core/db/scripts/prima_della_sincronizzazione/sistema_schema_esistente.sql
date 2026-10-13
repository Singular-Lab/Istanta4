-- Correzioni dello schema delle installazioni esistenti, PRIMA della
-- sincronizzazione dei modelli. Gira dopo rimuovi_oggetti_derivati.sql.
--
-- I modelli sono stati corretti perche' l'ALTER di models:sync non falliva
-- piu' (Sequelize 6 genera SQL non valido in alcuni casi). Sulle installazioni
-- gia' sincronizzate con la versione precedente restano pero' tipi e nomi che
-- l'ALTER non sa convertire da solo: qui si portano allo stato dei modelli.
--
-- Ogni correzione controlla prima lo stato del database: su un database vuoto
-- o gia' corretto non fa nulla.

-- Tracciati: id_promo_tracciati era UUID, ma promo.id_promo e' VARCHAR, quindi
-- la chiave esterna non si poteva creare. Le righe che puntano a una promo che
-- non esiste piu' si eliminano: con la chiave esterna (ON DELETE CASCADE)
-- sarebbero state eliminate insieme alla promo, e impedirebbero di crearla.
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

  IF to_regclass('public.tracciati') IS NOT NULL AND to_regclass('public.promo') IS NOT NULL THEN
    DELETE FROM public.tracciati t
    WHERE NOT EXISTS (
      SELECT 1 FROM public.promo p WHERE p.id_promo = t.id_promo_tracciati::text
    );
  END IF;
END $$;

-- Webhook: eventi_webhook era un array di enum_webhooks_eventi_webhook, che
-- l'ALTER di Sequelize non sa gestire. Diventa un array di VARCHAR con gli
-- stessi valori. Il default si toglie prima: Sequelize lo reimposta dopo, con
-- il tipo nuovo.
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
  END IF;
END $$;

-- Indici con il nome generato troncato da PostgreSQL a 63 caratteri: Sequelize
-- non li riconosceva e provava a ricrearli a ogni sincronizzazione. I modelli
-- ora danno un nome esplicito; qui si rinominano quelli esistenti.
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
