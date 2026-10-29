-- schema-dopo: ed9433ebeb500d17fee3be2c1928c5d4ccbfe3fb6432e8475b8563e171fd6c19
-- Date doppie dei preset WhatsApp: una volta sola.
--
-- Il modello GDOWhatsappPreset dichiarava createdat/updatedat (default NOW()),
-- quelle che legge il client ("Ultimo aggiornamento" dei preset, lib/types), ma
-- lasciava attivi i timestamp di Sequelize con i nomi predefiniti: la tabella
-- ha anche createdAt/updatedAt NOT NULL. A ogni modifica Sequelize aggiornava
-- solo updatedAt, e updatedat restava la data di creazione. Ora il modello usa
-- solo createdat/updatedat (e aggiorna updatedat): le colonne in piu' si tolgono.
--
-- Per ciascuna coppia, solo dove c'e' ancora la colonna con la maiuscola:
-- 1. createdat/updatedat si aggiungono se mancano: senza default, per non
--    mettere la data di oggi sulle righe esistenti, poi con quello del modello;
-- 2. i valori si uniscono senza perderne: createdat tiene la data piu' vecchia
--    delle due, updatedat la piu' recente (LEAST e GREATEST ignorano i NULL);
--    si riscrivono solo le righe che cambiano;
-- 3. createdAt/updatedAt diventano facoltative (il modello non le scrive piu':
--    un INSERT fallirebbe) e si eliminano. Le view gestite sono gia' tolte dal
--    runner; se un altro oggetto le usa ancora restano, facoltative, con un avviso.
-- Le date arrivano da sessioni di Sequelize in UTC, come quella del runner: un
-- eventuale TIMESTAMP senza fuso si confronta nello stesso fuso in cui e' scritto.
DO $$
DECLARE
  r RECORD;
  aggiornate BIGINT;
BEGIN
  IF to_regclass('public.gdo_whatsapp_presets') IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('createdat', 'createdAt', 'LEAST'),
      ('updatedat', 'updatedAt', 'GREATEST')
    ) AS v(tenuta, doppia, scelta)
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'gdo_whatsapp_presets' AND column_name = r.doppia
    ) THEN
      CONTINUE;
    END IF;

    -- 1. La colonna del modello
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'gdo_whatsapp_presets' AND column_name = r.tenuta
    ) THEN
      EXECUTE format('ALTER TABLE public.gdo_whatsapp_presets ADD COLUMN %I TIMESTAMP WITH TIME ZONE', r.tenuta);
      EXECUTE format('ALTER TABLE public.gdo_whatsapp_presets ALTER COLUMN %I SET DEFAULT NOW()', r.tenuta);
      RAISE NOTICE 'gdo_whatsapp_presets.%: aggiunta', r.tenuta;
    END IF;

    -- 2. I valori
    EXECUTE format(
      'UPDATE public.gdo_whatsapp_presets SET %1$I = %3$s(%1$I, %2$I) WHERE %1$I IS DISTINCT FROM %3$s(%1$I, %2$I)',
      r.tenuta, r.doppia, r.scelta);
    GET DIAGNOSTICS aggiornate = ROW_COUNT;
    IF aggiornate > 0 THEN
      RAISE NOTICE 'gdo_whatsapp_presets.%: % righe aggiornate con i valori di %', r.tenuta, aggiornate, quote_ident(r.doppia);
    END IF;

    -- 3. La colonna doppia
    EXECUTE format('ALTER TABLE public.gdo_whatsapp_presets ALTER COLUMN %I DROP NOT NULL', r.doppia);
    BEGIN
      EXECUTE format('ALTER TABLE public.gdo_whatsapp_presets DROP COLUMN %I', r.doppia);
      RAISE NOTICE 'gdo_whatsapp_presets.%: eliminata, i valori sono in %', quote_ident(r.doppia), r.tenuta;
    EXCEPTION WHEN dependent_objects_still_exist THEN
      RAISE NOTICE 'gdo_whatsapp_presets.%: usata da altri oggetti, resta (facoltativa)', quote_ident(r.doppia);
    END;
  END LOOP;
END $$;
