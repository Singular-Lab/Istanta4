-- schema-dopo: de4b2d71fe8bba59e5475121a8ee183ab4a9ad0dd87b16ef284aa3faca667e52
-- Lunghezze dei VARCHAR come nei modelli: una volta sola.
--
-- Sulle installazioni vecchie queste colonne sono VARCHAR senza limite, mentre
-- i modelli le dichiarano con una lunghezza (DataTypes.STRING e' VARCHAR(255)):
-- - ordini_stampa.id_promo_ordinistampa e tracciati.id_promo_tracciati:
--   VARCHAR(255), come promo.id_promo a cui puntano;
-- - utenti.privatekey_utenti VARCHAR(512), utenti.telefono_utenti VARCHAR(20).
-- Il limite si mette solo se tutti i valori ci stanno: un valore piu' lungo non
-- si tronca, si lascia la colonna com'e' con un avviso (yarn migrazioni:verifica
-- la segnala) e va corretto a mano.
-- Attenzione: la conversione riscrive la tabella; tracciati contiene i file
-- importati (blobfile_tracciati) e puo' richiedere tempo.
DO $$
DECLARE
  r RECORD;
  massima INTEGER;
  tipo_attuale TEXT;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('ordini_stampa', 'id_promo_ordinistampa', 255),
      ('tracciati', 'id_promo_tracciati', 255),
      ('utenti', 'privatekey_utenti', 512),
      ('utenti', 'telefono_utenti', 20)
    ) AS v(tabella, colonna, lunghezza)
  LOOP
    SELECT format_type(a.atttypid, a.atttypmod) INTO tipo_attuale
    FROM pg_attribute a
    WHERE a.attrelid = to_regclass(format('public.%I', r.tabella))
      AND a.attname = r.colonna AND a.attnum > 0 AND NOT a.attisdropped;

    -- Solo i VARCHAR con una lunghezza diversa (o senza): un altro tipo non e' compito di questa migrazione
    IF tipo_attuale IS NULL
      OR tipo_attuale NOT LIKE 'character varying%'
      OR tipo_attuale = format('character varying(%s)', r.lunghezza) THEN
      CONTINUE;
    END IF;

    EXECUTE format('SELECT max(length(%I)) FROM public.%I', r.colonna, r.tabella) INTO massima;
    IF massima > r.lunghezza THEN
      RAISE NOTICE 'Colonna %.%: un valore e'' lungo % caratteri, oltre %: resta %',
        r.tabella, r.colonna, massima, r.lunghezza, tipo_attuale;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE VARCHAR(%s)', r.tabella, r.colonna, r.lunghezza);
    RAISE NOTICE 'Colonna %.%: da % a VARCHAR(%)', r.tabella, r.colonna, tipo_attuale, r.lunghezza;
  END LOOP;
END $$;
